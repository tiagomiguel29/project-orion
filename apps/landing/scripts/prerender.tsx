import { mkdir, readFile, writeFile } from "node:fs/promises";
import React from "react";
import { renderToString } from "react-dom/server";
import { RouterProvider } from "@tanstack/react-router";
import { createLandingRouter } from "../src/app";

const distUrl = new URL("../dist/", import.meta.url);
const template = await readFile(new URL("index.html", distUrl), "utf8");
const pages = [
  {
    path: "/", file: "index.html",
    title: "Scope — Open-source infrastructure monitoring",
    description: "Monitor servers, containers, and Cloudflare tunnels with live metrics, history, and alerts. Self-host Scope with Docker and install its lightweight Go agent.",
  },
  {
    path: "/docs", file: "docs/index.html",
    title: "Install Scope — Self-hosted monitoring guide",
    description: "Deploy Scope with Docker images, install the Go agent in one command, and configure alerts through webhooks, Discord, Resend, Amazon SES, or SMTP.",
  },
] as const;

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function siteUrlFromEnv(): string {
  const raw = process.env.SCOPE_LANDING_URL || "";
  if (!raw) return "";
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("SCOPE_LANDING_URL must be an HTTPS origin, for example https://scope.example.com");
  }
  return url.origin;
}

const siteUrl = siteUrlFromEnv();
const websiteId = process.env.SCOPE_UMAMI_WEBSITE_ID || "";
const scriptUrl = process.env.SCOPE_UMAMI_SCRIPT_URL || "";
if (websiteId && !/^[\w-]{8,80}$/.test(websiteId)) throw new Error("Invalid SCOPE_UMAMI_WEBSITE_ID");
if (scriptUrl && new URL(scriptUrl).protocol !== "https:") throw new Error("SCOPE_UMAMI_SCRIPT_URL must use HTTPS");

for (const page of pages) {
  const router = createLandingRouter(page.path);
  await router.load();
  const markup = renderToString(<RouterProvider router={router} />);
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  const canonical = siteUrl ? `${siteUrl}${page.path}` : "";
  const html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/<meta\s+name="description"[\s\S]*?\/>/, `<meta name="description" content="${description}" />`)
    .replace(/<meta\s+property="og:title"[^>]*\/>/, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta\s+property="og:description"[\s\S]*?\/>/, `<meta property="og:description" content="${description}" />`)
    .replace(/<meta\s+name="twitter:title"[^>]*\/>/, `<meta name="twitter:title" content="${title}" />`)
    .replace(/<meta\s+name="twitter:description"[^>]*\/>/, `<meta name="twitter:description" content="${description}" />`)
    .replace("<!-- SCOPE_CANONICAL -->", canonical ? `<link rel="canonical" href="${canonical}" /><meta property="og:url" content="${canonical}" />` : "<!-- SCOPE_CANONICAL -->")
    .replace("<!-- SCOPE_SOCIAL -->", siteUrl ? `<meta property="og:image" content="${siteUrl}/social-card.png" /><meta property="og:image:alt" content="Scope open-source infrastructure monitoring dashboard" /><meta name="twitter:image" content="${siteUrl}/social-card.png" />` : "<!-- SCOPE_SOCIAL -->")
    .replace('<div id="root"></div>', `<div id="root">${markup}</div>`);
  const destination = new URL(page.file, distUrl);
  await mkdir(new URL(".", destination), { recursive: true });
  await writeFile(destination, html);
}

await writeFile(new URL("runtime-config.js", distUrl),
  `window.__SCOPE_LANDING_CONFIG__ = ${JSON.stringify({ siteUrl, umamiWebsiteId: websiteId, umamiScriptUrl: scriptUrl })};\n`);
await writeFile(new URL("robots.txt", distUrl),
  `User-agent: *\nAllow: /\n${siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml\n` : ""}`);
if (siteUrl) {
  await writeFile(new URL("sitemap.xml", distUrl),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map((page) => `<url><loc>${siteUrl}${page.path}</loc></url>`).join("")}</urlset>\n`);
}
