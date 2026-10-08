# syntax=docker/dockerfile:1
# Multi-stage build. The LAST stage ("production") is what `docker build .` produces.
#   docker build -t clinic-app .                       -> production image
#   docker build --target test -t clinic-test .        -> image that runs the test-suite

# ---- 1) Build the React app ------------------------------------------------
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- 2) Install only production dependencies for the API -------------------
FROM node:20-alpine AS backend-deps
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev

# ---- 3) Test image (needs a MongoDB: see docker-compose.test.yml) ----------
FROM node:20-bookworm-slim AS test
ENV NODE_ENV=test MONGOMS_DISABLE_POSTINSTALL=1
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
CMD ["sh", "-c", "npm run lint && npm test"]

# ---- 4) Small production image --------------------------------------------
FROM node:20-alpine AS production
ENV NODE_ENV=production \
    PORT=5000 \
    UPLOAD_DIR=/app/uploads \
    FRONTEND_DIST=/app/public
WORKDIR /app
COPY --from=backend-deps /app/node_modules ./node_modules
COPY backend/package*.json ./
COPY backend/src ./src
COPY backend/scripts ./scripts
COPY --from=frontend-build /app/frontend/dist ./public
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1
CMD ["node", "src/server.js"]
