FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine
# Patch OS packages that have fixes available (keeps the Trivy gate green), then drop back to the non-root user.
USER root
RUN apk upgrade --no-cache
USER 101
LABEL org.opencontainers.image.source="https://github.com/shauryaraghav/LegalRiskDetectionFullStack"
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO /dev/null http://127.0.0.1:8080/ || exit 1
