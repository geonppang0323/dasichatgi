// 내 컴퓨터에서 바로 실행해 보는 간단한 서버 (Vercel 없이)
// 사용법: 같은 폴더에 .env 파일을 만들고 SERVICE_KEY=... 를 적은 뒤  node dev-server.mjs
// 그다음 브라우저에서 http://localhost:3000 열기
import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

// .env 읽기
const envPath = join(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/")) {
    const name = url.pathname.slice(5).replace(/[^a-z]/g, "");
    const file = join(root, "api", `${name}.js`);
    if (!name || name.startsWith("_") || !existsSync(file)) { res.writeHead(404); res.end("not found"); return; }
    let body = "";
    for await (const chunk of req) body += chunk;
    const vreq = { method: req.method, query: Object.fromEntries(url.searchParams), body: body ? JSON.parse(body) : {} };
    const vres = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(o) { res.writeHead(this.statusCode, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(o)); },
    };
    try {
      const mod = await import(`./api/${name}.js`);
      await mod.default(vreq, vres);
    } catch (e) {
      res.writeHead(500); res.end(String(e));
    }
    return;
  }
  const path = url.pathname === "/" ? "/index.html" : url.pathname;
  try {
    const data = await readFile(join(root, path.replace(/\.\./g, "")));
    res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404); res.end("not found");
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
  console.log(`다시찾기 실행 중: http://localhost:${port}`);
  if (process.env.MOCK === "1") console.log("(예시 데이터 모드)");
  else if (!process.env.SERVICE_KEY) console.log("주의: SERVICE_KEY가 없습니다. .env 파일을 확인하세요.");
});
