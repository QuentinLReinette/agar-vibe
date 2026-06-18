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
CMD ["npm", "run", "dev", "--workspace=packages/client"]

# Builder stage
FROM base AS builder
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/client/package*.json ./packages/client/
RUN npm ci
COPY tsconfig.json ./
COPY packages/shared ./packages/shared
COPY packages/client ./packages/client
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/client

# Production stage using Nginx
FROM nginx:alpine AS runner
COPY --from=builder /app/packages/client/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
