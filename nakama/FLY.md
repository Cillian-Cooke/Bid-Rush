# Deploy Nakama + Postgres on Fly.io

Config in this folder: `fly.toml`, `fly.entrypoint.sh`, `Dockerfile`.

## You run these in your own terminal

This environment can’t complete `fly auth login` (needs your browser).

```bash
# Install CLI once
curl -L https://fly.io/install.sh | sh
export PATH="$HOME/.fly/bin:$PATH"

# Log in (browser)
fly auth login

# From repo root — create app, Postgres, secrets, deploy
cd "/home/cillian/Personal Projects/Bidding Game"
./nakama/fly-setup.sh
```

Or step-by-step (same outcome): see below.

### Manual steps

```bash
export PATH="$HOME/.fly/bin:$PATH"
cd "/home/cillian/Personal Projects/Bidding Game"

fly apps create bid-rush-nakama
fly postgres create --name bid-rush-db --region lhr --vm-size shared-cpu-1x --volume-size 3 --initial-cluster-size 1
fly postgres attach bid-rush-db --app bid-rush-nakama

# Generate + set secrets (save the SOCKET key for Vercel!)
SOCKET_KEY=$(openssl rand -hex 16)
fly secrets set --app bid-rush-nakama \
  NAKAMA_SOCKET_SERVER_KEY="$SOCKET_KEY" \
  NAKAMA_CONSOLE_USERNAME="admin" \
  NAKAMA_CONSOLE_PASSWORD="$(openssl rand -hex 12)" \
  NAKAMA_RUNTIME_HTTP_KEY="$(openssl rand -hex 16)" \
  NAKAMA_SESSION_ENCRYPTION_KEY="$(openssl rand -hex 16)" \
  NAKAMA_SESSION_REFRESH_KEY="$(openssl rand -hex 16)"
echo "VITE_NAKAMA_SERVER_KEY=$SOCKET_KEY"

fly deploy . --config nakama/fly.toml --dockerfile nakama/Dockerfile --ha=false
```

## After deploy

| What | URL |
|------|-----|
| API / WebSocket | `https://bid-rush-nakama.fly.dev` |
| Console | `https://bid-rush-nakama.fly.dev:8443` |

### Vercel project env

```bash
VITE_NAKAMA_HOST=bid-rush-nakama.fly.dev
VITE_NAKAMA_PORT=443
VITE_NAKAMA_SERVER_KEY=<NAKAMA_SOCKET_SERVER_KEY from above>
VITE_NAKAMA_USE_SSL=true
```

Redeploy Vercel after saving env (Vite inlines these at build time).

### Ops

```bash
fly status --app bid-rush-nakama
fly logs --app bid-rush-nakama
fly secrets list --app bid-rush-nakama
```
