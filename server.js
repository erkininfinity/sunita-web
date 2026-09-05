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
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

const COMPRESSIBLE = new Set([
  "text/html; charset=utf-8",
  "text/css; charset=utf-8",
  "application/javascript; charset=utf-8",
  "application/json; charset=utf-8",
  "image/svg+xml",
  "text/plain; charset=utf-8",
  "application/xml; charset=utf-8",
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

const publicPages = new Set(["/", "/index.html", "/privacy.html", "/offer.html", "/robots.txt", "/sitemap.xml"]);
const server = http.createServer((req, res) => {
  function error(status, message) {
    res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    res.end(message);
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return error(405, "405 Method Not Allowed");
  }
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split("?")[0]);
  } catch {
    return error(400, "400 Bad Request");
  }
  if (!urlPath.startsWith("/") || /[\\\0]/.test(urlPath)) return error(400, "400 Bad Request");
  if (urlPath === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    return res.end(req.method === "HEAD" ? undefined : "ok");
  }
  // Serve only published pages and assets, never source/configuration/test files.
  const ext = path.extname(urlPath).toLowerCase();
  const publicAsset = /^\/(assets|css|js)\//.test(urlPath) && Object.hasOwn(MIME_TYPES, ext);
  if (urlPath.split("/").some(part => part.startsWith(".")) || (!publicPages.has(urlPath) && !publicAsset)) {
    return error(404, "404 Not Found");
  }
  if (urlPath === "/index.html") {
    const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    res.writeHead(301, { Location: "/" + query });
    return res.end();
  }
  const filePath = path.join(__dirname, urlPath === "/" ? "/index.html" : urlPath);
  const contentType = MIME_TYPES[ext] || "text/html; charset=utf-8";
  let file;
  try {
    const resolved = fs.realpathSync(filePath);
    if (!resolved.startsWith(__dirname + path.sep) || !fs.statSync(resolved).isFile()) return error(404, "404 Not Found");
    file = getFile(resolved, contentType);
  } catch {
    return error(404, "404 Not Found");
  }
  const headers = {
    "Content-Type": contentType,
    ETag: file.etag,
    Vary: "Accept-Encoding",
    "Cache-Control": urlPath.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
  if (req.headers["if-none-match"] === file.etag) {
    res.writeHead(304, headers);
    return res.end();
  }
  const acceptsGzip = (req.headers["accept-encoding"] || "").split(",").some(value => {
    const [encoding, ...parameters] = value.trim().split(";");
    const quality = parameters.find(parameter => /^\s*q=/.test(parameter));
    return encoding === "gzip" && (!quality || Number(quality.trim().slice(2)) > 0);
  });
  const body = file.gzip && acceptsGzip ? file.gzip : file.raw;
  if (file.gzip && acceptsGzip) headers["Content-Encoding"] = "gzip";
  headers["Content-Length"] = body.length;
  res.writeHead(200, headers);
  res.end(req.method === "HEAD" ? undefined : body);
});

if (require.main === module) {
  server.listen(PORT, "0.0.0.0", () => console.log(`SENERGY running on ${PORT}`));
}
module.exports = server;
