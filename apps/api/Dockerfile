FROM node:22-alpine
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# The shared package is complete before install: the root postinstall compiles it.
COPY packages/shared packages/shared
RUN pnpm install --frozen-lockfile --filter api...
COPY apps/api apps/api
WORKDIR /repo/apps/api
CMD ["sh", "-c", "pnpm migrate && pnpm seed && pnpm dev:poll"]
