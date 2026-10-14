import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app";

const configured = window.__SCOPE_LANDING_CONFIG__ ?? {};
window.__SCOPE_LANDING_CONFIG__ = {
  siteUrl: configured.siteUrl || import.meta.env.VITE_SCOPE_LANDING_URL || "",
  umamiWebsiteId: configured.umamiWebsiteId || import.meta.env.VITE_SCOPE_UMAMI_WEBSITE_ID || "",
  umamiScriptUrl: configured.umamiScriptUrl || import.meta.env.VITE_SCOPE_UMAMI_SCRIPT_URL || "",
};

const { siteUrl, umamiWebsiteId, umamiScriptUrl } = window.__SCOPE_LANDING_CONFIG__;
if (umamiWebsiteId && /^[\w-]{8,80}$/.test(umamiWebsiteId)) {
  const source = umamiScriptUrl || "https://cloud.umami.is/script.js";
  try {
    const url = new URL(source);
    if (url.protocol === "https:") {
      const script = document.createElement("script");
      script.defer = true;
      script.src = url.toString();
      script.dataset.websiteId = umamiWebsiteId;
      script.dataset.doNotTrack = "true";
      script.dataset.excludeSearch = "true";
      script.dataset.excludeHash = "true";
      if (siteUrl) script.dataset.domains = new URL(siteUrl).hostname;
      document.head.append(script);
    }
  } catch { /* Invalid analytics URL; the landing page still works. */ }
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
