const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

const COMPRESSIBLE = new Set([
  "text/html; charset=utf-8",
  "text/css; charset=utf-8",
  "application/javascript; charset=utf-8",
  "application/json; charset=utf-8",
  "image/svg+xml",
]);

const cache = new Map();

function getFile(filePath, contentType) {
  const { mtimeMs } = fs.statSync(filePath);
  const cached = cache.get(filePath);
  if (cached && cached.mtimeMs === mtimeMs) return cached;

  const raw = fs.readFileSync(filePath);
  const entry = {
    mtimeMs,
    raw,
    gzip: COMPRESSIBLE.has(contentType) && raw.length > 512 ? zlib.gzipSync(raw, { level: 6 }) : null,
    etag: `"${crypto.createHash("md5").update(raw).digest("hex")}"`,
    contentType,
  };

  cache.set(filePath, entry);
  return entry;
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);

  if (urlPath === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    return res.end("ok");
  }

  let filePath = path.join(__dirname, urlPath === "/" ? "/index.html" : urlPath);

  if (!filePath.startsWith(__dirname + path.sep)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("403 Forbidden");
  }

  let stats;
  try {
    stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      filePath = path.join(filePath, "index.html");
      stats = fs.statSync(filePath);
    }
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("404 Not Found");
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const file = getFile(filePath, contentType);
  const isAsset = filePath.includes("assets");

  if (req.headers["if-none-match"] === file.etag) {
    res.writeHead(304, { ETag: file.etag });
    return res.end();
  }

  const headers = {
    "Content-Type": contentType,
    ETag: file.etag,
    Vary: "Accept-Encoding",
    "Cache-Control": isAsset ? "public, max-age=31536000, immutable" : "no-cache",
  };

  const acceptsGzip = (req.headers["accept-encoding"] || "").includes("gzip");
  const body = file.gzip && acceptsGzip ? file.gzip : file.raw;
  if (file.gzip && acceptsGzip) headers["Content-Encoding"] = "gzip";
  headers["Content-Length"] = body.length;

  res.writeHead(200, headers);
  res.end(body);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`SENERGY running on ${PORT}`);
});
