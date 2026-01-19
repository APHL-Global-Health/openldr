FROM node:24-alpine AS base

ARG APP_NAME=@openldr/web
ARG APP_LOC=openldr-web
 
FROM base AS builder
RUN apk update
RUN apk add --no-cache libc6-compat python3 make g++
# Set working directory
WORKDIR /app
RUN npm install turbo --global
COPY . .
RUN turbo prune ${APP_NAME} --docker
COPY ./apps/${APP_LOC}/.env* ./out/full/apps/${APP_LOC}/
 
# Add lockfile and package.json's of isolated subworkspace
FROM base AS installer
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install turbo --global
 
# First install the dependencies (as they change less often)
COPY --from=builder /app/out/json/ .

RUN npm ci --include=optional

COPY --from=builder /app/out/full/ .

RUN turbo run build
 
FROM base AS runner
WORKDIR /app

COPY --from=installer /app .

WORKDIR /app/apps/${APP_LOC}
CMD ["npm", "start"]