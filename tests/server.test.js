const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { gunzipSync } = require("node:zlib");
const server = require("../server");

before(() => new Promise(resolve => server.listen(0, "127.0.0.1", resolve)));
after(() => new Promise(resolve => server.close(resolve)));

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port: server.address().port, path, ...options }, res => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("malformed URLs return 400 and the server keeps serving requests", async () => {
  for (const path of ["/%", "/%E0%A4%A", "/%00", "/assets/%5cserver.js"]) {
    assert.equal((await request(path)).status, 400, path);
    assert.equal((await request("/health")).body.toString(), "ok");
  }
});

test("source, configuration, traversal and unknown paths are not public", async () => {
  for (const path of ["/server.js", "/package.json", "/Dockerfile", "/.git/HEAD", "/tests/server.test.js", "/scripts/social-card.html", "/assets/../server.js", "/assets/%2e%2e/server.js", "/missing"]) {
    assert.equal((await request(path)).status, 404, path);
  }
});

test("published pages, styles, scripts, fonts and search files are served", async () => {
  for (const path of ["/", "/privacy.html", "/offer.html", "/css/fonts.css", "/js/main.js", "/assets/fonts/manrope-normal-cyrillic-v1.woff2", "/assets/img/social-preview-v1.jpg", "/robots.txt", "/sitemap.xml"]) {
    const response = await request(path);
    assert.equal(response.status, 200, path);
    assert.ok(response.body.length > 0, path);
    assert.equal(response.headers["x-content-type-options"], "nosniff");
  }
});

test("HEAD, conditional requests and gzip preserve HTTP semantics", async () => {
  const normal = await request("/");
  const head = await request("/", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.body.length, 0);
  assert.equal(head.headers["content-length"], String(normal.body.length));
  assert.equal(normal.headers["cache-control"], "no-cache");
  const unchanged = await request("/", { headers: { "If-None-Match": normal.headers.etag } });
  assert.equal(unchanged.status, 304);
  assert.equal(unchanged.body.length, 0);
  const compressed = await request("/", { headers: { "Accept-Encoding": "gzip" } });
  assert.equal(compressed.headers["content-encoding"], "gzip");
  assert.deepEqual(gunzipSync(compressed.body), normal.body);
  const disabled = await request("/", { headers: { "Accept-Encoding": "gzip;q=0, identity" } });
  assert.equal(disabled.headers["content-encoding"], undefined);
  assert.deepEqual(disabled.body, normal.body);
});

test("canonical redirect retains query and unsupported methods are rejected", async () => {
  const redirect = await request("/index.html?utm_source=test");
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.location, "/?utm_source=test");
  const post = await request("/", { method: "POST" });
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, "GET, HEAD");
});
