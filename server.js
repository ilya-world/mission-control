const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
};

function resolvePath(requestUrl) {
  const parsed = url.parse(requestUrl);
  const pathname = decodeURIComponent(parsed.pathname || "/");
  const normalized = path.normalize(pathname).replace(/^\.\.(?:\\|\/|$)/, "");
  if (normalized === "/") {
    return path.join(ROOT, "index.html");
  }
  return path.join(ROOT, normalized);
}

const server = http.createServer((req, res) => {
  const filePath = resolvePath(req.url);

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Mission Control server running at http://localhost:${PORT}`);
});
