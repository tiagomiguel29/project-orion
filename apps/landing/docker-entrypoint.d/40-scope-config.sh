#!/bin/sh
set -eu

html_root=${SCOPE_LANDING_ROOT:-/usr/share/nginx/html}
template_root=${SCOPE_LANDING_TEMPLATES:-/etc/scope}
site_url=${SCOPE_LANDING_URL:-}
website_id=${SCOPE_UMAMI_WEBSITE_ID:-}
script_url=${SCOPE_UMAMI_SCRIPT_URL:-}

if [ -n "$site_url" ]; then
  site_url=${site_url%/}
  if ! printf '%s' "$site_url" | grep -Eq '^https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]+)?$'; then
    echo 'SCOPE_LANDING_URL must be an HTTPS origin (for example https://scope.example.com)' >&2
    exit 1
  fi
fi
if [ -n "$website_id" ] && ! printf '%s' "$website_id" | grep -Eq '^[A-Za-z0-9_-]{8,80}$'; then
  echo 'SCOPE_UMAMI_WEBSITE_ID is invalid' >&2
  exit 1
fi
if [ -n "$script_url" ] && ! printf '%s' "$script_url" | grep -Eq '^https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]+)?(/[A-Za-z0-9._~/%-]*)?$'; then
  echo 'SCOPE_UMAMI_SCRIPT_URL must be an HTTPS script URL' >&2
  exit 1
fi

printf 'window.__SCOPE_LANDING_CONFIG__ = {"siteUrl":"%s","umamiWebsiteId":"%s","umamiScriptUrl":"%s"};\n' \
  "$site_url" "$website_id" "$script_url" > "$html_root/runtime-config.js"

for page in home docs; do
  if [ "$page" = home ]; then
    source_file="$template_root/index.html"
    target_file="$html_root/index.html"
    page_path=/
  else
    source_file="$template_root/docs.html"
    target_file="$html_root/docs/index.html"
    page_path=/docs
  fi
  if [ -n "$site_url" ]; then
    canonical="$site_url$page_path"
    sed \
      -e "s|<!-- SCOPE_CANONICAL -->|<link rel=\"canonical\" href=\"$canonical\" /><meta property=\"og:url\" content=\"$canonical\" />|" \
      -e "s|<!-- SCOPE_SOCIAL -->|<meta property=\"og:image\" content=\"$site_url/social-card.png\" /><meta property=\"og:image:alt\" content=\"Scope open-source infrastructure monitoring dashboard\" /><meta name=\"twitter:image\" content=\"$site_url/social-card.png\" />|" \
      "$source_file" > "$target_file"
  else
    cp "$source_file" "$target_file"
  fi
done

printf 'User-agent: *\nAllow: /\n' > "$html_root/robots.txt"
if [ -n "$site_url" ]; then
  printf 'Sitemap: %s/sitemap.xml\n' "$site_url" >> "$html_root/robots.txt"
  printf '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>%s/</loc></url><url><loc>%s/docs</loc></url></urlset>\n' \
    "$site_url" "$site_url" > "$html_root/sitemap.xml"
else
  rm -f "$html_root/sitemap.xml"
fi
