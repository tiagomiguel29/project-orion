import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("./dist/", import.meta.url)));
const port = Number(process.env.PORT || 3000);
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }

  if (pathname === "/") pathname = "/index.html";
  else if (pathname === "/docs" || pathname === "/docs/") pathname = "/docs/index.html";
  const file = resolve(root, `.${pathname}`);
  if (!file.startsWith(`${root}${sep}`)) {
    response.writeHead(404).end();
    return;
  }

  try {
    const body = await readFile(file);
    const headers = { "Content-Type": types[extname(file)] || "application/octet-stream" };
    if (pathname === "/runtime-config.js") headers["Cache-Control"] = "no-store";
    if (pathname.startsWith("/assets/")) headers["Cache-Control"] = "public, max-age=31536000, immutable";
    response.writeHead(200, headers).end(request.method === "HEAD" ? undefined : body);
  } catch (error) {
    response.writeHead(["ENOENT", "ENOTDIR", "EISDIR"].includes(error.code) ? 404 : 500).end();
  }
}).listen(port, "0.0.0.0");
