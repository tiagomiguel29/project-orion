# syntax=docker/dockerfile:1
FROM node:22 AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/web/package.json apps/web/
COPY apps/landing/package.json apps/landing/
RUN npm ci
COPY apps/landing apps/landing
COPY deploy/compose.yml deploy/compose.yml
RUN npm run build --workspace @project-orion/landing

FROM nginx:1.27-alpine
LABEL org.opencontainers.image.source="https://github.com/tiagomiguel29/project-orion"
COPY apps/landing/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/landing/dist /usr/share/nginx/html
COPY --from=build /repo/apps/landing/dist/index.html /etc/scope/index.html
COPY --from=build /repo/apps/landing/dist/docs/index.html /etc/scope/docs.html
COPY apps/landing/docker-entrypoint.d/40-scope-config.sh /docker-entrypoint.d/40-scope-config.sh
RUN chmod +x /docker-entrypoint.d/40-scope-config.sh
EXPOSE 80
