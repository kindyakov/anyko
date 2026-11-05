FROM oven/bun:1.4.4 AS source
WORKDIR /app
COPY package.json bun.lock ./
COPY apps ./apps
COPY packages ./packages

FROM source AS tools
RUN bun install --frozen-lockfile
RUN bun --filter @anyko/database generate

FROM tools AS build
RUN bun --filter @anyko/web build

FROM source AS production
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.4.4 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=production --chown=bun:bun /app /app
COPY --from=tools --chown=bun:bun /app/packages/database/generated /app/packages/database/generated
USER bun

FROM runtime AS api
WORKDIR /app/apps/api
EXPOSE 3021
CMD ["bun", "src/index.ts"]

FROM runtime AS worker
WORKDIR /app/apps/worker
EXPOSE 3022
CMD ["bun", "src/index.ts"]

FROM runtime AS web
ENV PORT=3020
COPY --from=build --chown=bun:bun /app/apps/web/.next /app/apps/web/.next
WORKDIR /app/apps/web
EXPOSE 3020
CMD ["bun", "--bun", "next", "start", "--hostname", "0.0.0.0"]
