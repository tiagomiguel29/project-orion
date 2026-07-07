# Next.js web dashboard image. Build context must be the repository ROOT (npm
# workspace monorepo). NEXT_PUBLIC_API_URL is baked in at build time because
# it is inlined into the client bundle, so it must point at the URL the browser
# uses to reach the backend (the host-published port, not the compose network).

FROM node:22 AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/web/package.json apps/web/
RUN npm ci

COPY apps/web apps/web

ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace @project-orion/web

FROM node:22-slim AS runtime
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
