FROM node:24-alpine AS base
RUN corepack enable

ARG APP_NAME=@openldr/init

FROM base AS builder
RUN apk update
RUN apk add --no-cache libc6-compat
# Set working directory
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune ${APP_NAME} --docker

# Add lockfile and package.json's of isolated subworkspace
FROM base AS installer
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo

# First install the dependencies (as they change less often)
COPY --from=builder /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=builder /app/out/full/ .
RUN turbo run build --filter=${APP_NAME}

FROM base AS runner
WORKDIR /app

# Install Docker CLI for docker exec/cp commands used by MinIO and Postgres init
RUN apk add --no-cache docker-cli curl

COPY --from=installer /app .

WORKDIR /app/apps/openldr-init
CMD ["pnpm", "start"]
