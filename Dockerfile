# syntax=docker/dockerfile:1.7

# ---------- build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

# Install deps first so we can benefit from Docker layer caching.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy the rest of the source and build.
COPY index.html vite.config.js ./
COPY src ./src
RUN npm run build

# ---------- runtime stage ----------
FROM nginx:1.27-alpine AS runtime

# Custom server config: SPA fallback + gzip + long cache for hashed assets.
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
