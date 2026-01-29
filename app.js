const STORAGE_KEY = "mission-control-state";

const defaultState = {
  tasks: {},
  rootIds: [],
  contexts: ["Работа", "Дом"],
  flags: [
    { id: "flag-urgent", name: "Срочно", icon: "⚡", order: 1 },
    { id: "flag-focus", name: "Фокус", icon: "🎯", order: 2 },
  ],
  areas: [
    { id: "area-main", name: "Основная", viewId: "view-active", hideCompleted: true },
  ],
  views: [
    {
      id: "view-active",
      name: "Активные действия",
      filters: {
        contexts: [],
        tag: "",
        flagId: "",
        favoriteOnly: false,
        types: ["task", "goal"],
        projectStatus: [],
        hasDates: "any",
        startRange: "",
        dueRange: "",
        timeMin: "",
        timeMax: "",
      },
      grouping: "none",
      sorting: "order",
      columns: ["title", "dueAt", "startAt", "contexts", "tag", "flag", "time"],
    },
  ],
  hotkeys: {
    newTask: "n",
    newSubtask: "shift+n",
    toggleComplete: "x",
    focusSearch: "/",
    switchOutline: "ctrl+1",
    switchTodo: "ctrl+2",
  },
};

const state = loadState();
let activeAreaId = state.areas[0]?.id ?? null;
let activeTaskId = null;
let draggedTaskId = null;

const elements = {
  areas: document.getElementById("areas"),
  views: document.getElementById("views"),
  addArea: document.getElementById("add-area"),
  addView: document.getElementById("add-view"),
  tabs: document.querySelectorAll(".tab"),
  panels: document.querySelectorAll("[data-tab-panel]"),
  tree: document.getElementById("tree"),
  todoList: document.getElementById("todo-list"),
  activeView: document.getElementById("active-view"),
  hideCompleted: document.getElementById("hide-completed"),
  filters: document.getElementById("filters"),
  inspector: document.getElementById("inspector-body"),
  closeInspector: document.getElementById("close-inspector"),
  addRootTask: document.getElementById("add-root-task"),
  addRootProject: document.getElementById("add-root-project"),
  addRootFolder: document.getElementById("add-root-folder"),
  search: document.getElementById("search"),
  searchResults: document.getElementById("search-results"),
  exportJson: document.getElementById("export-json"),
  importJson: document.getElementById("import-json"),
  exportCsv: document.getElementById("export-csv"),
  status: document.getElementById("status"),
  hotkeys: document.getElementById("hotkeys"),
  reminderModal: document.getElementById("reminder-modal"),
  reminderList: document.getElementById("reminder-list"),
  dismissReminders: document.getElementById("dismiss-reminders"),
};

ensureSeedTasks();
renderAll();
setupEvents();
startReminderTicker();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return structuredClone(defaultState);
    }
    return { ...structuredClone(defaultState), ...JSON.parse(raw) };
  } catch (error) {
    console.error("Failed to load state", error);
    return structuredClone(defaultState);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    elements.status.textContent = "Все изменения сохранены";
  } catch (error) {
    elements.status.textContent = "Ошибка сохранения — попробуйте снова";
    console.error("Failed to save", error);
  }
}

function ensureSeedTasks() {
  if (Object.keys(state.tasks).length > 0) return;

  const rootTask = createTask({
    title: "Запустить Mission Control",
    type: "project",
    projectStatus: "InProgress",
  });
  const child1 = createTask({
    title: "Сформировать дерево задач",
    parentId: rootTask.id,
  });
  const child2 = createTask({
    title: "Настроить активные действия",
    parentId: rootTask.id,
    startAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  });
  const child3 = createTask({
    title: "Проверить напоминания",
    parentId: rootTask.id,
    reminderEnabled: true,
    reminderAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });
  state.rootIds.push(rootTask.id);
  state.tasks[rootTask.id].children = [child1.id, child2.id, child3.id];
  state.rootIds.push(
    createTask({
      title: "Личная цель: фокус на месяц",
      type: "goal",
      goalType: "month",
    }).id,
  );
}

function createTask(data) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  state.tasks[id] = {
    id,
    title: data.title ?? "Новая задача",
    notes: data.notes ?? "",
    type: data.type ?? "task",
    goalType: data.goalType ?? "",
    completed: false,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    parentId: data.parentId ?? null,
    orderIndex: data.orderIndex ?? 0,
    contexts: data.contexts ?? [],
    tag: data.tag ?? "",
    flagId: data.flagId ?? "",
    favorite: data.favorite ?? false,
    startAt: data.startAt ?? "",
    dueAt: data.dueAt ?? "",
    inheritDates: data.inheritDates ?? true,
    reminderEnabled: data.reminderEnabled ?? false,
    reminderAt: data.reminderAt ?? "",
    snoozePreset: data.snoozePreset ?? "10",
    repeatEnabled: data.repeatEnabled ?? false,
    repeatInterval: data.repeatInterval ?? "weekly",
    dependencies: data.dependencies ?? [],
    dependencyMode: data.dependencyMode ?? "ALL",
    dependencyDelayMinutes: data.dependencyDelayMinutes ?? 0,
    timeMin: data.timeMin ?? "",
    timeMax: data.timeMax ?? "",
    projectStatus: data.projectStatus ?? "NotStarted",
    sequential: data.sequential ?? false,
    children: data.children ?? [],
  };
  return state.tasks[id];
}

function renderAll() {
  renderAreas();
  renderViews();
  renderTree();
  renderTodo();
  renderInspector();
  renderHotkeys();
  renderSearchResults();
}

function renderAreas() {
  elements.areas.innerHTML = "";
  state.areas.forEach((area) => {
    const card = document.createElement("button");
    card.className = `card ${area.id === activeAreaId ? "active" : ""}`;
    card.textContent = area.name;
    card.addEventListener("click", () => {
      activeAreaId = area.id;
      renderAll();
    });
    card.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const action = prompt("rename / delete", "rename");
      if (action === "delete") {
        state.areas = state.areas.filter((item) => item.id !== area.id);
        if (activeAreaId === area.id) {
          activeAreaId = state.areas[0]?.id ?? null;
        }
      } else if (action) {
        area.name = prompt("Новое имя", area.name) ?? area.name;
      }
      saveState();
      renderAll();
    });
    elements.areas.appendChild(card);
  });
}

function renderViews() {
  elements.views.innerHTML = "";
  elements.activeView.innerHTML = "";
  state.views.forEach((view) => {
    const card = document.createElement("button");
    card.className = "card";
    card.textContent = view.name;
    card.addEventListener("click", () => {
      const activeArea = getActiveArea();
      if (activeArea) {
        activeArea.viewId = view.id;
        saveState();
        renderAll();
      }
    });
    card.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const action = prompt("rename / duplicate / delete", "rename");
      if (action === "duplicate") {
        const copy = structuredClone(view);
        copy.id = crypto.randomUUID();
        copy.name = `${view.name} (copy)`;
        state.views.push(copy);
      } else if (action === "delete") {
        state.views = state.views.filter((item) => item.id !== view.id);
      } else if (action) {
        view.name = prompt("Новое имя", view.name) ?? view.name;
      }
      saveState();
      renderAll();
    });
    elements.views.appendChild(card);

    const option = document.createElement("option");
    option.value = view.id;
    option.textContent = view.name;
    elements.activeView.appendChild(option);
  });

  const activeArea = getActiveArea();
  elements.activeView.value = activeArea?.viewId ?? "";
  elements.hideCompleted.checked = activeArea?.hideCompleted ?? false;
}

function renderTree() {
  elements.tree.innerHTML = "";
  state.rootIds.forEach((id) => {
    const task = state.tasks[id];
    if (!task) return;
    elements.tree.appendChild(renderTreeItem(task));
  });
}

function renderTreeItem(task) {
  const container = document.createElement("div");
  container.className = "tree-item";
  container.draggable = true;
  container.dataset.taskId = task.id;

  container.addEventListener("dragstart", (event) => {
    draggedTaskId = task.id;
    event.dataTransfer.effectAllowed = "move";
  });

  container.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  });

  container.addEventListener("drop", (event) => {
    event.preventDefault();
    if (!draggedTaskId || draggedTaskId === task.id) return;
    moveTask(draggedTaskId, task.id);
    draggedTaskId = null;
    saveState();
    renderAll();
  });

  const header = document.createElement("header");
  const titleWrap = document.createElement("div");
  const title = document.createElement("div");
  title.className = "task-title";
  title.contentEditable = true;
  title.textContent = task.title;
  title.addEventListener("blur", () => {
    task.title = title.textContent.trim() || "Без названия";
    task.updatedAt = new Date().toISOString();
    saveState();
    renderAll();
  });
  titleWrap.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "task-meta";
  meta.textContent = `${task.type.toUpperCase()} · ${task.completed ? "Завершено" : "В работе"}`;
  titleWrap.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "panel-actions";
  const toggle = document.createElement("button");
  toggle.textContent = task.completed ? "Вернуть" : "Завершить";
  toggle.addEventListener("click", () => {
    toggleTaskCompletion(task);
  });
  const addChild = document.createElement("button");
  addChild.className = "secondary";
  addChild.textContent = "+ Подзадача";
  addChild.addEventListener("click", () => {
    const child = createTask({ title: "Новая подзадача", parentId: task.id });
    task.children.push(child.id);
    saveState();
    renderAll();
  });
  const open = document.createElement("button");
  open.className = "secondary";
  open.textContent = "Инспектор";
  open.addEventListener("click", () => {
    activeTaskId = task.id;
    renderInspector();
  });
  const sequential = document.createElement("button");
  sequential.className = "secondary";
  sequential.textContent = task.sequential ? "По порядку: да" : "По порядку: нет";
  sequential.addEventListener("click", () => {
    task.sequential = !task.sequential;
    saveState();
    renderAll();
  });

  actions.append(toggle, addChild, open, sequential);
  header.append(titleWrap, actions);
  container.appendChild(header);

  const childrenWrap = document.createElement("div");
  childrenWrap.className = "tree-children";
  task.children
    .map((id) => state.tasks[id])
    .filter(Boolean)
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .forEach((child) => {
      childrenWrap.appendChild(renderTreeItem(child));
    });
  if (task.children.length) {
    container.appendChild(childrenWrap);
  }
  return container;
}

function renderTodo() {
  const activeArea = getActiveArea();
  const view = state.views.find((item) => item.id === activeArea?.viewId) ?? state.views[0];
  if (!view) return;

  renderFilters(view);
  const items = getActiveTasks(view, activeArea?.hideCompleted);
  elements.todoList.innerHTML = "";
  items.forEach((task) => {
    const card = document.createElement("div");
    card.className = `todo-card ${task.completed ? "completed" : ""}`;

    const header = document.createElement("div");
    header.innerHTML = `<strong>${task.title}</strong>`;

    const meta = document.createElement("div");
    meta.className = "task-meta";
    meta.innerHTML = `Контексты: ${task.contexts.join(", ") || "—"} · Тег: ${task.tag || "—"}`;

    const chips = document.createElement("div");
    chips.className = "panel-actions";
    chips.appendChild(makeChip(`Тип: ${task.type}`));
    if (task.dueAt) {
      chips.appendChild(makeChip(`Срок: ${formatDate(task.dueAt)}`));
    }
    if (task.startAt) {
      chips.appendChild(makeChip(`Начало: ${formatDate(task.startAt)}`));
    }
    if (task.flagId) {
      const flag = state.flags.find((item) => item.id === task.flagId);
      chips.appendChild(makeChip(`Флаг: ${flag?.icon ?? ""} ${flag?.name ?? ""}`));
    }

    const actions = document.createElement("div");
    actions.className = "panel-actions";
    const toggle = document.createElement("button");
    toggle.textContent = task.completed ? "Вернуть" : "Завершить";
    toggle.addEventListener("click", () => {
      toggleTaskCompletion(task);
    });
    const open = document.createElement("button");
    open.className = "secondary";
    open.textContent = "Инспектор";
    open.addEventListener("click", () => {
      activeTaskId = task.id;
      renderInspector();
    });
    actions.append(toggle, open);

    card.append(header, meta, chips, actions);
    elements.todoList.appendChild(card);
  });
}

function renderFilters(view) {
  elements.filters.innerHTML = "";
  elements.filters.append(
    makeSelectFilter("Контекст", "filter-contexts", state.contexts, view.filters.contexts, true),
    makeSelectFilter("Флаг", "filter-flag", ["", ...state.flags.map((flag) => flag.id)], [view.filters.flagId]),
    makeTextFilter("Тег", "filter-tag", view.filters.tag),
    makeSelectFilter("Тип", "filter-type", ["", "task", "project", "folder", "goal"], view.filters.types),
    makeSelectFilter("Избранное", "filter-favorite", ["", "yes"], view.filters.favoriteOnly ? ["yes"] : []),
  );
}

function renderInspector() {
  elements.inspector.innerHTML = "";
  const task = activeTaskId ? state.tasks[activeTaskId] : null;
  if (!task) {
    elements.inspector.innerHTML = "<p>Выберите задачу, чтобы увидеть свойства.</p>";
    return;
  }

  const fields = [
    makeField("Название", makeInput(task.title, (value) => updateTask(task, { title: value }))),
    makeField(
      "Тип",
      makeSelect(
        ["task", "project", "folder", "goal"],
        task.type,
        (value) => updateTask(task, { type: value }),
      ),
    ),
    makeField(
      "Статус проекта",
      makeSelect(
        ["NotStarted", "InProgress", "Waiting", "Completed"],
        task.projectStatus,
        (value) => updateTask(task, { projectStatus: value }),
      ),
    ),
    makeField(
      "Контексты",
      makeInput(task.contexts.join(", "), (value) =>
        updateTask(task, { contexts: splitList(value) }),
      ),
    ),
    makeField("Тег", makeInput(task.tag, (value) => updateTask(task, { tag: value }))),
    makeField(
      "Флаг",
      makeSelect(
        ["", ...state.flags.map((flag) => flag.id)],
        task.flagId,
        (value) => updateTask(task, { flagId: value }),
        (value) => {
          const flag = state.flags.find((item) => item.id === value);
          return flag ? `${flag.icon} ${flag.name}` : "Без флага";
        },
      ),
    ),
    makeField(
      "Избранное",
      makeCheckbox(task.favorite, (value) => updateTask(task, { favorite: value })),
    ),
    makeField(
      "Начало",
      makeInput(task.startAt, (value) => updateTask(task, { startAt: value }), "datetime-local"),
    ),
    makeField(
      "Срок",
      makeInput(task.dueAt, (value) => updateTask(task, { dueAt: value }), "datetime-local"),
    ),
    makeField(
      "Время (мин, мин-макс)",
      wrapRow(
        makeInput(task.timeMin, (value) => updateTask(task, { timeMin: value }), "number"),
        makeInput(task.timeMax, (value) => updateTask(task, { timeMax: value }), "number"),
      ),
    ),
    makeField(
      "Последовательно",
      makeCheckbox(task.sequential, (value) => updateTask(task, { sequential: value })),
    ),
    makeField(
      "Напоминание",
      wrapRow(
        makeCheckbox(task.reminderEnabled, (value) => updateTask(task, { reminderEnabled: value })),
        makeInput(task.reminderAt, (value) => updateTask(task, { reminderAt: value }), "datetime-local"),
      ),
    ),
    makeField(
      "Повтор",
      wrapRow(
        makeCheckbox(task.repeatEnabled, (value) => updateTask(task, { repeatEnabled: value })),
        makeSelect(
          ["daily", "weekly", "monthly", "yearly"],
          task.repeatInterval,
          (value) => updateTask(task, { repeatInterval: value }),
        ),
      ),
    ),
    makeField(
      "Зависимости (ID через запятую)",
      makeInput(task.dependencies.join(", "), (value) =>
        updateTask(task, { dependencies: splitList(value) }),
      ),
    ),
    makeField(
      "Режим зависимостей",
      makeSelect(["ALL", "ANY"], task.dependencyMode, (value) =>
        updateTask(task, { dependencyMode: value }),
      ),
    ),
    makeField(
      "Задержка после зависимостей (мин)",
      makeInput(task.dependencyDelayMinutes, (value) =>
        updateTask(task, { dependencyDelayMinutes: Number(value) || 0 }),
      ),
    ),
    makeField("Заметки", makeTextarea(task.notes, (value) => updateTask(task, { notes: value }))),
  ];

  const actions = document.createElement("div");
  actions.className = "panel-actions";
  const skipRepeat = document.createElement("button");
  skipRepeat.className = "secondary";
  skipRepeat.textContent = "Пропустить повтор";
  skipRepeat.addEventListener("click", () => {
    if (!task.repeatEnabled) return;
    advanceRepeat(task);
  });
  actions.appendChild(skipRepeat);

  fields.forEach((field) => elements.inspector.appendChild(field));
  elements.inspector.appendChild(actions);
}

function renderHotkeys() {
  elements.hotkeys.innerHTML = "";
  Object.entries(state.hotkeys).forEach(([action, value]) => {
    const row = document.createElement("div");
    row.className = "card";
    row.innerHTML = `<strong>${action}</strong>`;
    const input = document.createElement("input");
    input.value = value;
    input.addEventListener("change", () => {
      state.hotkeys[action] = input.value.trim();
      saveState();
    });
    row.appendChild(input);
    elements.hotkeys.appendChild(row);
  });
}

function renderSearchResults() {
  const query = elements.search.value.trim().toLowerCase();
  elements.searchResults.innerHTML = "";
  if (!query) return;
  const results = Object.values(state.tasks).filter((task) => {
    return (
      task.title.toLowerCase().includes(query) ||
      task.notes.toLowerCase().includes(query) ||
      task.tag.toLowerCase().includes(query)
    );
  });
  results.slice(0, 8).forEach((task) => {
    const card = document.createElement("button");
    card.className = "card";
    card.textContent = task.title;
    card.addEventListener("click", () => {
      activeTaskId = task.id;
      switchTab("outline");
      renderInspector();
    });
    elements.searchResults.appendChild(card);
  });
}

function setupEvents() {
  elements.addArea.addEventListener("click", () => {
    const name = prompt("Название области", "Новая область");
    if (!name) return;
    const id = crypto.randomUUID();
    state.areas.push({ id, name, viewId: state.views[0]?.id ?? "", hideCompleted: true });
    activeAreaId = id;
    saveState();
    renderAll();
  });

  elements.addView.addEventListener("click", () => {
    const name = prompt("Название вида", "Новый вид");
    if (!name) return;
    state.views.push({
      id: crypto.randomUUID(),
      name,
      filters: structuredClone(state.views[0].filters),
      grouping: "none",
      sorting: "order",
      columns: ["title", "dueAt", "startAt", "contexts", "tag", "flag", "time"],
    });
    saveState();
    renderAll();
  });

  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  elements.addRootTask.addEventListener("click", () => addRootTask("task"));
  elements.addRootProject.addEventListener("click", () => addRootTask("project"));
  elements.addRootFolder.addEventListener("click", () => addRootTask("folder"));

  elements.activeView.addEventListener("change", () => {
    const activeArea = getActiveArea();
    if (activeArea) {
      activeArea.viewId = elements.activeView.value;
      saveState();
      renderTodo();
    }
  });

  elements.hideCompleted.addEventListener("change", () => {
    const activeArea = getActiveArea();
    if (activeArea) {
      activeArea.hideCompleted = elements.hideCompleted.checked;
      saveState();
      renderTodo();
    }
  });

  elements.search.addEventListener("input", renderSearchResults);
  elements.exportJson.addEventListener("click", exportJson);
  elements.importJson.addEventListener("change", importJson);
  elements.exportCsv.addEventListener("click", exportCsv);
  elements.closeInspector.addEventListener("click", () => {
    activeTaskId = null;
    renderInspector();
  });

  document.addEventListener("keydown", (event) => {
    const combo = toCombo(event);
    if (combo === state.hotkeys.newTask) {
      event.preventDefault();
      addRootTask("task");
    }
    if (combo === state.hotkeys.newSubtask && activeTaskId) {
      event.preventDefault();
      const parent = state.tasks[activeTaskId];
      const child = createTask({ title: "Новая подзадача", parentId: parent.id });
      parent.children.push(child.id);
      saveState();
      renderAll();
    }
    if (combo === state.hotkeys.toggleComplete && activeTaskId) {
      event.preventDefault();
      toggleTaskCompletion(state.tasks[activeTaskId]);
    }
    if (combo === state.hotkeys.focusSearch) {
      event.preventDefault();
      elements.search.focus();
    }
    if (combo === state.hotkeys.switchOutline) {
      event.preventDefault();
      switchTab("outline");
    }
    if (combo === state.hotkeys.switchTodo) {
      event.preventDefault();
      switchTab("todo");
    }
  });

  elements.dismissReminders.addEventListener("click", () => {
    elements.reminderModal.hidden = true;
  });
}

function addRootTask(type) {
  const task = createTask({ title: "Новая задача", type });
  state.rootIds.push(task.id);
  saveState();
  renderAll();
}

function getActiveArea() {
  return state.areas.find((area) => area.id === activeAreaId);
}

function toggleTaskCompletion(task) {
  task.completed = !task.completed;
  task.completedAt = task.completed ? new Date().toISOString() : null;
  task.updatedAt = new Date().toISOString();
  if (task.completed && task.repeatEnabled) {
    spawnRepeat(task);
  }
  saveState();
  renderAll();
}

function updateTask(task, changes) {
  Object.assign(task, changes, { updatedAt: new Date().toISOString() });
  saveState();
  renderAll();
}

function moveTask(taskId, newParentId) {
  const task = state.tasks[taskId];
  if (!task) return;
  removeFromParent(taskId);
  task.parentId = newParentId;
  const newParent = state.tasks[newParentId];
  if (newParent) {
    newParent.children.push(taskId);
  } else {
    state.rootIds.push(taskId);
  }
}

function removeFromParent(taskId) {
  const task = state.tasks[taskId];
  if (!task) return;
  if (task.parentId) {
    const parent = state.tasks[task.parentId];
    if (parent) {
      parent.children = parent.children.filter((id) => id !== taskId);
    }
  } else {
    state.rootIds = state.rootIds.filter((id) => id !== taskId);
  }
}

function getActiveTasks(view, hideCompleted) {
  let tasks = Object.values(state.tasks);
  if (view.name === "Активные действия") {
    tasks = tasks.filter((task) => isActiveTask(task));
  }
  if (hideCompleted) {
    tasks = tasks.filter((task) => !task.completed);
  }
  if (view.filters.favoriteOnly) {
    tasks = tasks.filter((task) => task.favorite);
  }
  if (view.filters.tag) {
    tasks = tasks.filter((task) => task.tag === view.filters.tag);
  }
  if (view.filters.flagId) {
    tasks = tasks.filter((task) => task.flagId === view.filters.flagId);
  }
  if (view.filters.contexts.length) {
    tasks = tasks.filter((task) => view.filters.contexts.every((ctx) => task.contexts.includes(ctx)));
  }
  if (view.filters.types.length) {
    tasks = tasks.filter((task) => view.filters.types.includes(task.type));
  }
  if (view.filters.timeMin) {
    tasks = tasks.filter((task) => Number(task.timeMin) >= Number(view.filters.timeMin));
  }
  if (view.filters.timeMax) {
    tasks = tasks.filter((task) => Number(task.timeMax) <= Number(view.filters.timeMax));
  }
  if (view.sorting === "title") {
    tasks.sort((a, b) => a.title.localeCompare(b.title));
  }
  return tasks;
}

function isActiveTask(task) {
  if (task.completed) return false;
  if (task.type === "folder" || task.type === "project") return false;
  if (hasIncompleteChildren(task)) return false;
  if (task.startAt && new Date(task.startAt) > new Date()) return false;
  if (!dependenciesSatisfied(task)) return false;
  if (!sequentialSatisfied(task)) return false;
  return true;
}

function hasIncompleteChildren(task) {
  return task.children.some((id) => {
    const child = state.tasks[id];
    return child && !child.completed;
  });
}

function dependenciesSatisfied(task) {
  if (!task.dependencies.length) return true;
  const deps = task.dependencies.map((id) => state.tasks[id]).filter(Boolean);
  if (!deps.length) return true;
  const completedDeps = deps.filter((dep) => dep.completed && dep.completedAt);
  const mode = task.dependencyMode;
  const delay = Number(task.dependencyDelayMinutes || 0) * 60 * 1000;
  if (mode === "ALL" && completedDeps.length !== deps.length) return false;
  if (mode === "ANY" && completedDeps.length === 0) return false;

  if (delay > 0) {
    const timestamps = completedDeps.map((dep) => new Date(dep.completedAt).getTime());
    const base = mode === "ALL" ? Math.max(...timestamps) : Math.min(...timestamps);
    return Date.now() >= base + delay;
  }
  return true;
}

function sequentialSatisfied(task) {
  let current = task;
  while (current.parentId) {
    const parent = state.tasks[current.parentId];
    if (!parent) break;
    if (parent.sequential) {
      const firstIncomplete = parent.children
        .map((id) => state.tasks[id])
        .find((child) => child && !child.completed);
      if (!firstIncomplete) return false;
      if (!isDescendant(task.id, firstIncomplete.id)) {
        return false;
      }
    }
    current = parent;
  }
  return true;
}

function isDescendant(taskId, ancestorChildId) {
  if (taskId === ancestorChildId) return true;
  const task = state.tasks[taskId];
  if (!task || !task.parentId) return false;
  if (task.parentId === ancestorChildId) return true;
  return isDescendant(task.parentId, ancestorChildId);
}

function spawnRepeat(task) {
  const newTask = createTask({
    title: task.title,
    notes: task.notes,
    type: task.type,
    parentId: task.parentId,
    repeatEnabled: task.repeatEnabled,
    repeatInterval: task.repeatInterval,
  });
  advanceRepeat(newTask, task);
  if (task.parentId) {
    state.tasks[task.parentId].children.push(newTask.id);
  } else {
    state.rootIds.push(newTask.id);
  }
}

function advanceRepeat(task, baseTask = task) {
  const baseDate = baseTask.dueAt || baseTask.startAt || new Date().toISOString();
  const date = new Date(baseDate);
  const interval = task.repeatInterval;
  if (interval === "daily") date.setDate(date.getDate() + 1);
  if (interval === "weekly") date.setDate(date.getDate() + 7);
  if (interval === "monthly") date.setMonth(date.getMonth() + 1);
  if (interval === "yearly") date.setFullYear(date.getFullYear() + 1);
  task.startAt = date.toISOString();
  task.dueAt = date.toISOString();
  saveState();
  renderAll();
}

function makeField(label, control) {
  const wrapper = document.createElement("div");
  wrapper.className = "field";
  const title = document.createElement("label");
  title.textContent = label;
  wrapper.append(title, control);
  return wrapper;
}

function makeInput(value, onChange, type = "text") {
  const input = document.createElement("input");
  input.type = type;
  input.value = value ?? "";
  input.addEventListener("change", () => onChange(input.value));
  return input;
}

function makeTextarea(value, onChange) {
  const textarea = document.createElement("textarea");
  textarea.value = value ?? "";
  textarea.addEventListener("change", () => onChange(textarea.value));
  return textarea;
}

function makeSelect(options, value, onChange, labelFormatter) {
  const select = document.createElement("select");
  options.forEach((optionValue) => {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = labelFormatter ? labelFormatter(optionValue) : optionValue || "—";
    select.appendChild(option);
  });
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  return select;
}

function makeCheckbox(value, onChange) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(value);
  input.addEventListener("change", () => onChange(input.checked));
  return input;
}

function makeChip(text) {
  const chip = document.createElement("span");
  chip.className = "badge";
  chip.textContent = text;
  return chip;
}

function wrapRow(...nodes) {
  const row = document.createElement("div");
  row.className = "panel-actions";
  nodes.forEach((node) => row.appendChild(node));
  return row;
}

function splitList(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("ru-RU");
}

function makeSelectFilter(label, id, options, selectedValues, multiple = false) {
  const wrapper = document.createElement("div");
  wrapper.className = "field";
  const title = document.createElement("label");
  title.textContent = label;
  const select = document.createElement("select");
  select.id = id;
  select.multiple = multiple;
  options.forEach((optionValue) => {
    const option = document.createElement("option");
    option.value = optionValue;
    const flag = state.flags.find((item) => item.id === optionValue);
    option.textContent = flag ? `${flag.icon} ${flag.name}` : optionValue || "—";
    if (selectedValues.includes(optionValue)) {
      option.selected = true;
    }
    select.appendChild(option);
  });
  select.addEventListener("change", () => {
    const view = state.views.find((item) => item.id === getActiveArea()?.viewId);
    if (!view) return;
    if (multiple) {
      view.filters.contexts = Array.from(select.selectedOptions).map((option) => option.value);
    } else if (id === "filter-flag") {
      view.filters.flagId = select.value;
    } else if (id === "filter-type") {
      view.filters.types = select.value ? [select.value] : [];
    } else if (id === "filter-favorite") {
      view.filters.favoriteOnly = Boolean(select.value);
    }
    saveState();
    renderTodo();
  });
  wrapper.append(title, select);
  return wrapper;
}

function makeTextFilter(label, id, value) {
  const wrapper = document.createElement("div");
  wrapper.className = "field";
  const title = document.createElement("label");
  title.textContent = label;
  const input = document.createElement("input");
  input.id = id;
  input.value = value;
  input.addEventListener("change", () => {
    const view = state.views.find((item) => item.id === getActiveArea()?.viewId);
    if (!view) return;
    view.filters.tag = input.value.trim();
    saveState();
    renderTodo();
  });
  wrapper.append(title, input);
  return wrapper;
}

function exportJson() {
  const data = JSON.stringify(state, null, 2);
  downloadFile("mission-control.json", data, "application/json");
}

function importJson(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      Object.assign(state, parsed);
      activeAreaId = state.areas[0]?.id ?? null;
      saveState();
      renderAll();
    } catch (error) {
      alert("Не удалось прочитать JSON");
    }
  };
  reader.readAsText(file);
}

function exportCsv() {
  const view = state.views.find((item) => item.id === getActiveArea()?.viewId);
  const tasks = getActiveTasks(view, getActiveArea()?.hideCompleted);
  const rows = [
    ["Title", "Type", "StartAt", "DueAt", "Contexts", "Tag", "Flag", "TimeMin", "TimeMax"],
    ...tasks.map((task) => [
      task.title,
      task.type,
      task.startAt,
      task.dueAt,
      task.contexts.join(";"),
      task.tag,
      task.flagId,
      task.timeMin,
      task.timeMax,
    ]),
  ];
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  downloadFile("mission-control-todo.csv", csv, "text/csv");
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function switchTab(name) {
  elements.tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === name);
  });
  elements.panels.forEach((panel) => {
    panel.hidden = panel.id !== name;
  });
}

function toCombo(event) {
  const keys = [];
  if (event.ctrlKey) keys.push("ctrl");
  if (event.shiftKey) keys.push("shift");
  if (event.altKey) keys.push("alt");
  const key = event.key.toLowerCase();
  if (!["control", "shift", "alt"].includes(key)) {
    keys.push(key);
  }
  return keys.join("+");
}

function startReminderTicker() {
  setInterval(() => {
    const due = Object.values(state.tasks).filter((task) => {
      if (!task.reminderEnabled || !task.reminderAt) return false;
      if (task.completed) return false;
      return new Date(task.reminderAt) <= new Date();
    });
    if (!due.length) return;
    renderReminders(due);
  }, 30 * 1000);
}

function renderReminders(tasks) {
  elements.reminderList.innerHTML = "";
  tasks.forEach((task) => {
    const item = document.createElement("div");
    item.className = "reminder-item";
    item.innerHTML = `<strong>${task.title}</strong><div class="task-meta">${formatDate(
      task.reminderAt,
    )}</div>`;
    const actions = document.createElement("div");
    actions.className = "panel-actions";
    const open = document.createElement("button");
    open.className = "secondary";
    open.textContent = "Открыть";
    open.addEventListener("click", () => {
      activeTaskId = task.id;
      renderInspector();
      elements.reminderModal.hidden = true;
    });
    const disable = document.createElement("button");
    disable.className = "secondary";
    disable.textContent = "Выключить";
    disable.addEventListener("click", () => {
      task.reminderEnabled = false;
      saveState();
      renderAll();
    });
    const snooze = document.createElement("button");
    snooze.className = "secondary";
    snooze.textContent = "Отложить";
    snooze.addEventListener("click", () => {
      const minutes = Number(task.snoozePreset || 10);
      const next = new Date();
      next.setMinutes(next.getMinutes() + minutes);
      task.reminderAt = next.toISOString();
      saveState();
      renderAll();
    });
    actions.append(open, disable, snooze);
    item.appendChild(actions);
    elements.reminderList.appendChild(item);
  });
  elements.reminderModal.hidden = false;
  if (Notification.permission === "granted") {
    tasks.forEach((task) => new Notification(`Напоминание: ${task.title}`));
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission();
  }
}
