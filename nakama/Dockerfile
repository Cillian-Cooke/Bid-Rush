FROM node:22-alpine AS node-builder
WORKDIR /backend

COPY nakama/package.json nakama/package-lock.json* ./
RUN npm install

COPY src/game ./src/game
COPY nakama/src ./nakama/src
COPY nakama/scripts ./nakama/scripts

WORKDIR /backend/nakama
RUN node scripts/build.mjs

FROM heroiclabs/nakama:3.26.0
COPY --from=node-builder /backend/nakama/build/index.js /nakama/data/modules/build/index.js
COPY nakama/local.yml /nakama/data/local.yml
COPY nakama/fly.entrypoint.sh /nakama/fly.entrypoint.sh
USER root
RUN chmod +x /nakama/fly.entrypoint.sh
# Nakama image runs as non-root by default in some tags; keep executable entrypoint
ENTRYPOINT ["/nakama/fly.entrypoint.sh"]
