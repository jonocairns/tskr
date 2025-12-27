## Getting Started

If you have Nix + direnv installed, entering the repo will automatically load the dev shell:

```bash
direnv allow
```

First, run the development server:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

For full setup details, see Development setup.

## Development setup

Prereqs:
- Node 24 (matches `flake.nix`) or use the Nix dev shell
- pnpm 10 (via `corepack enable`)

1) Copy the example env file:

```bash
cp .env.example .env
```

2) Update `.env` as needed. At minimum set `NEXTAUTH_SECRET` and `NEXTAUTH_URL`.
   `DATABASE_URL` defaults to `file:./prisma/dev.db`. Push notifications need the VAPID
   variables.

3) Install dependencies and prepare Prisma:

```bash
pnpm install
pnpm db:generate
pnpm db:sync
```

4) Start the dev server:

```bash
pnpm dev
```

## Docker

Build the image:

```bash
docker build -t tskr .
```

Run the container (persists the SQLite db and generated secrets under `/data`):

```bash
docker run --rm \
  -p 3000:3000 \
  -v tskr-data:/data \
  -e NEXTAUTH_URL="http://localhost:3000" \
  tskr
```

Notes:
- `DATABASE_URL` is optional; the entrypoint defaults to `file:/data/dev.db`.
- Set `NEXTAUTH_SECRET` for stable sessions. If unset, the entrypoint generates one and
  stores it in `/data/tskr-secrets.env`.
- Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` to enable push
  notifications; otherwise the entrypoint will generate keys on first run.

