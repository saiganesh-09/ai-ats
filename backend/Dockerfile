# NestJS API — multi-stage: build once, run lean.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --chown=node:node package*.json ./
# Local-storage fallback dir must be writable by the runtime user.
RUN mkdir -p storage && chown node:node storage
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1
# Migrate then start — one command for any environment.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
