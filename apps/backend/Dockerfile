# NestJS backend image. The build context must be the repository ROOT because
# this is an npm workspace monorepo (the lockfile and hoisted node_modules live
# at the root). See docker-compose.dev.yml / apps/backend/docker-compose.yml.

FROM node:22 AS build
WORKDIR /repo

# Install workspace dependencies from the root lockfile. Copy just the manifests
# first so this layer is cached until a dependency actually changes.
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/web/package.json apps/web/
RUN npm ci

# Build the backend (nest build also copies **/*.proto into dist via nest-cli).
COPY apps/backend apps/backend
RUN npm run build --workspace @project-orion/backend

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./
COPY --from=build /repo/apps/backend/package.json ./apps/backend/
COPY --from=build /repo/apps/backend/dist ./apps/backend/dist
WORKDIR /repo/apps/backend
EXPOSE 4000 50052
CMD ["node", "dist/main"]
