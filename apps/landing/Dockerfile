# Build from the repository root so the workspace lockfile and deployment
# example used by the documentation remain available.
FROM node:24-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/web/package.json apps/web/
COPY apps/landing/package.json apps/landing/
RUN npm ci --workspace @project-orion/landing --include=dev --include-workspace-root=false --no-audit --no-fund
COPY apps/landing apps/landing
COPY deploy/compose.yml deploy/compose.yml
ARG SCOPE_LANDING_URL
ARG SCOPE_UMAMI_SCRIPT_URL
ARG SCOPE_UMAMI_WEBSITE_ID
ENV SCOPE_LANDING_URL=$SCOPE_LANDING_URL \
    SCOPE_UMAMI_SCRIPT_URL=$SCOPE_UMAMI_SCRIPT_URL \
    SCOPE_UMAMI_WEBSITE_ID=$SCOPE_UMAMI_WEBSITE_ID
RUN npm run build:landing

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build --chown=node:node /repo/apps/landing/dist ./dist
COPY --from=build --chown=node:node /repo/apps/landing/server.mjs ./server.mjs
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "Promise.all(['/', '/docs'].map(p=>fetch('http://127.0.0.1:3000'+p))).then(rs=>process.exit(rs.every(r=>r.ok)?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
