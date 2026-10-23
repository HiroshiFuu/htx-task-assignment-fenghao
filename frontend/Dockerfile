# syntax=docker/dockerfile:1

# ---- build: static assets ------------------------------------------------------------
FROM node:24.11.1-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# ---- runtime: nginx serving the SPA and proxying /api ---------------------------------
# The unprivileged image runs as a non-root user (uid 101) and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.29.3-alpine AS runtime
# Not in conf.d: everything there is included at http level, which would apply
# these headers to /api responses as well.
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/"]
