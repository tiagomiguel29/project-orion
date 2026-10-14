# Next.js web dashboard image. Build context must be the repository ROOT (npm
# workspace monorepo). Browser connection settings are served by the dynamic
# /runtime-config endpoint, so this image can be reused at any deployment URL.

FROM node:22 AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/web/package.json apps/web/
COPY apps/landing/package.json apps/landing/
RUN npm ci

COPY apps/web apps/web

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace @project-orion/web

FROM node:22-slim AS runtime
LABEL org.opencontainers.image.source="https://github.com/tiagomiguel29/project-orion"
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./
COPY --from=build /repo/apps/web/package.json ./apps/web/
COPY --from=build /repo/apps/web/next.config.mjs ./apps/web/
COPY --from=build /repo/apps/web/.next ./apps/web/.next
COPY --from=build /repo/apps/web/public ./apps/web/public
WORKDIR /repo/apps/web
EXPOSE 3000
CMD ["npm", "run", "start"]
