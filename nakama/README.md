# Bid Rush - Nakama backend
#
# Single authoritative backend: accounts, ranked RP, leaderboards,
# matchmaking, custom rooms, and live auction matches.
#
# Local:
#   cd nakama && npm install && npm run docker:up
# Console: http://127.0.0.1:7351  (admin / password)
# API / WS: http://127.0.0.1:7350
#
# Client env:
#   VITE_NAKAMA_HOST=127.0.0.1
#   VITE_NAKAMA_PORT=7350
#   VITE_NAKAMA_SERVER_KEY=defaultkey
#   VITE_NAKAMA_USE_SSL=false
#
# Rebuild after server code changes:
#   npm run docker:up
