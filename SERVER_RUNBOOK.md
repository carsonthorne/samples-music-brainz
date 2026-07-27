# Sample Graph Server Runbook

This project runs one local web/API listener:

- Node/Express app: `PORT`, default `3001`

The public web domain should be handled by Cloudflare Tunnel, matching the
current Chinese Checkers setup:

```yaml
ingress:
  - hostname: samples.your-domain.com
    service: http://localhost:3001
  - service: http_status:404
```

That means Cloudflare receives HTTPS traffic for the public hostname and
`cloudflared` forwards browser and API traffic to the Node server's local
listener on port `3001`.

If you choose a different subdomain, replace `samples.your-domain.com` in the
Cloudflare Tunnel config. The app itself can keep using port `3001`.

## Connect To The Old Laptop

Use Tailscale to reach the laptop even when it is not on the same Wi-Fi network.

```sh
tailscale status
ssh carsonthorne@100.126.110.36
```

If the Tailscale IP changes, find the right machine in `tailscale status` and
SSH to that `100.x.y.z` address instead.

## Put The Project On The Laptop

From the laptop, clone or update the repo wherever you keep projects:

```sh
cd ~
git clone <repo-url> samples-music-brainz
cd samples-music-brainz
```

If the repo is already there:

```sh
cd ~/samples-music-brainz
git pull
```

The runtime database is large and is intentionally not baked into the Docker
image. Put it here before starting the service:

```text
data/sample-graph-runtime.sqlite
```

From this Mac, one direct way to copy it over Tailscale is:

```sh
rsync -ah --progress data/sample-graph-runtime.sqlite carsonthorne@100.126.110.36:~/samples-music-brainz/data/
```

The current database is several GB, so `rsync` is nicer than `scp` if the
connection drops and you need to resume.

## Start Or Reattach To Tmux

Tmux keeps the server running after the SSH window closes.

```sh
tmux ls
tmux attach -t sample-graph
```

If the session does not exist:

```sh
tmux new -s sample-graph
```

Useful tmux keys:

- Detach without stopping anything: `Ctrl-b`, then `d`
- Split pane left/right: `Ctrl-b`, then `%`
- Split pane top/bottom: `Ctrl-b`, then `"`
- Move between panes: `Ctrl-b`, then arrow key
- Scroll back: `Ctrl-b`, then `[`
- Exit scroll mode: `q`

## Run The App Server

From the project directory on the laptop:

```sh
docker compose up --build
```

Expected local URL:

```text
http://127.0.0.1:3001
```

Expected health check:

```text
http://127.0.0.1:3001/api/health
```

Expected public URL:

```text
https://samples.your-domain.com
```

If the tunnel is running but the Node server is not, public requests will fail
with a bad gateway style error because nothing is listening on port `3001`.

That error means "Cloudflare Tunnel is alive, but the app is not."

## Restart After Code Changes

Inside the tmux pane running `docker compose up --build`:

1. Stop the service with `Ctrl-c`.
2. Pull or edit your changes.
3. Start it again:

```sh
docker compose up --build
```

If you prefer to keep it in the background:

```sh
docker compose up --build -d
docker compose logs -f samples-graph
```

## Check What Is Running

```sh
lsof -iTCP:3001 -sTCP:LISTEN
docker compose ps
curl http://127.0.0.1:3001/api/health
```

Port `3001` should be the Node/Express app serving both the Vite frontend and
the `/api/*` routes.

## Cloudflare Tunnel

If Chinese Checkers is already running through a Cloudflare Tunnel on this
MacBook, the simplest setup is to add a second hostname to that same tunnel.
Add this project as another ingress rule before the final `http_status:404`
catch-all:

```yaml
  - hostname: samples.your-domain.com
    service: http://localhost:3001
```

Then create the DNS route:

```sh
cloudflared tunnel route dns <existing-tunnel-name-or-uuid> samples.your-domain.com
```

Restart the tunnel after editing its config:

```sh
cloudflared tunnel run <existing-tunnel-name-or-uuid>
```

If you want a separate tunnel for this project instead:

```sh
cloudflared tunnel create samples-music-brainz
cloudflared tunnel route dns samples-music-brainz samples.your-domain.com
cloudflared tunnel run samples-music-brainz
```

This repo includes `cloudflared-config.sample.yml` as a starter config. Copy its
contents into the MacBook's Cloudflare Tunnel config and replace the tunnel ID,
credentials path, and hostname.

If `cloudflared` is installed as a macOS service or launch agent, restart that
service instead of running `cloudflared tunnel run` manually.
