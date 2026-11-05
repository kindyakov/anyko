FROM oven/bun:1.4.4 AS source
WORKDIR /app
COPY package.json bun.lock ./
COPY apps ./apps
COPY packages ./packages

FROM source AS build
RUN bun install --frozen-lockfile
RUN bun --filter @anyko/web build

FROM source AS production
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.4.4 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=production --chown=bun:bun /app /app
USER bun

FROM runtime AS api
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["bun", "src/index.ts"]

FROM runtime AS worker
WORKDIR /app/apps/worker
EXPOSE 3002
CMD ["bun", "src/index.ts"]

FROM runtime AS web
COPY --from=build --chown=bun:bun /app/apps/web/.next /app/apps/web/.next
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["bun", "--bun", "next", "start", "--hostname", "0.0.0.0"]
