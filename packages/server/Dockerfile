FROM node:20-alpine AS base
WORKDIR /app

# Development stage
FROM base AS dev
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/server/package*.json ./packages/server/
COPY packages/client/package*.json ./packages/client/
RUN npm ci
COPY . .
CMD ["npm", "run", "dev", "--workspace=packages/server"]

# Builder stage
FROM base AS builder
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/server/package*.json ./packages/server/
RUN npm ci
COPY tsconfig.json ./
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/server

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/server/package*.json ./packages/server/
RUN npm ci --omit=dev
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production
CMD ["node", "packages/server/dist/index.js"]
