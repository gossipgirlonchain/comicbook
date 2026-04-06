# ComicBook.com — Digital Vending Machine

A gacha-style NFT vending machine built on Next.js 16, Privy wallet auth, and Solana, powered by the CollectorCrypt API.

## Repository Setup

### Prerequisites

- Node.js 18+ (tested on v25.2.1)
- npm or pnpm
- A [Privy](https://dashboard.privy.io) account with an app configured
- A CollectorCrypt API key (request via Discord)

### Install

```bash
git clone https://github.com/gossipgirlonchain/comicbook.git
cd comicbook
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Client-side (exposed to browser)
NEXT_PUBLIC_PRIVY_APP_ID=<your-privy-app-id>
NEXT_PUBLIC_PRIVY_CLIENT_ID=<your-privy-client-id>
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_USDC_MINT_ADDRESS=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr

# Server-side ONLY (never exposed to browser)
COLLECTOR_CRYPT_API_KEY=<your-collectorcrypt-api-key>
COLLECTOR_CRYPT_BASE_URL=https://dev-gacha.collectorcrypt.com
```

| Variable | Public? | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Yes | Privy dashboard > Settings > API Keys > App ID |
| `NEXT_PUBLIC_PRIVY_CLIENT_ID` | Yes | Privy dashboard > Settings > Clients > Client ID |
| `NEXT_PUBLIC_SOLANA_NETWORK` | Yes | `devnet` for testing, `mainnet-beta` for production |
| `NEXT_PUBLIC_USDC_MINT_ADDRESS` | Yes | USDC SPL token mint address for the target network |
| `COLLECTOR_CRYPT_API_KEY` | No | Server-side only. Request from CollectorCrypt team |
| `COLLECTOR_CRYPT_BASE_URL` | No | `https://dev-gacha.collectorcrypt.com` (dev) or production URL |
| `SOLANA_RPC` | No | Optional. Custom Solana RPC URL (defaults to public devnet) |

### Run Locally

```bash
npm run dev
```

Opens at `http://localhost:3000`.

### Build

```bash
npm run build
npm start
```

## Privy Configuration

The Privy provider is configured in `app/providers.tsx`:

- **Login methods**: Google, Email, Wallet
- **Embedded wallets**: Auto-created for Solana on first login
- **External wallets**: Phantom, Solflare, etc. via `toSolanaWalletConnectors()`
- **Theme**: Dark mode with ComicBook.com brand accent (#ffb91d)

Ensure your deployment domain is added to **Privy Dashboard > Settings > Domains**.

## API Proxy Architecture

All CollectorCrypt API calls are proxied through a single Next.js API route to keep the API key server-side.

```
Browser                    Next.js Server              CollectorCrypt
  |                            |                            |
  |  GET /api/gacha/status     |                            |
  |--------------------------->|                            |
  |                            |  GET /api/status           |
  |                            |  x-api-key: <secret>       |
  |                            |--------------------------->|
  |                            |                            |
  |                            |  { machineStatus: "..." }  |
  |                            |<---------------------------|
  |  { machineStatus: "..." }  |                            |
  |<---------------------------|                            |
```

### Route: `/api/gacha/[...path]`

**File**: `app/api/gacha/[...path]/route.ts`

- Supports GET and POST
- Forwards the path segments to `COLLECTOR_CRYPT_BASE_URL/api/{path}`
- Injects `x-api-key` header server-side
- **Endpoint allowlist**: Only known CollectorCrypt endpoints are permitted (see `ALLOWED_ENDPOINTS` in the route file). Unknown paths return 404.
- **Rate limiting**: 60 requests/minute per IP. Returns 429 when exceeded.

### Allowed Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `status` | Machine status (running/stopped) |
| GET | `stock` | Pack inventory levels |
| GET | `getAllWinners` | Recent pack openings |
| GET | `getNfts` | All NFTs (optional `?owner=` filter) |
| GET | `purchasedPacks` | User's purchased packs (`?wallet=`) |
| GET | `getGifted` | User's gifted packs (`?wallet=`) |
| GET | `buyback/check` | Poll buyback completion (`?memo=`) |
| POST | `generatePack` | Create unsigned pack purchase transaction |
| POST | `submitTransaction` | Submit a signed transaction |
| POST | `openPack` | Poll for pack opening result |
| POST | `generateYoloPacks` | Batch generate multiple packs |
| POST | `buyback` | Initiate NFT buyback |
| POST | `generatePurchasedPack` | Create message to sign for purchased pack |
| POST | `usePurchasedPack` | Consume a purchased pack |
| POST | `generateGift` | Create gift transaction |

### Route: `/api/getUsdcBalance`

**File**: `app/api/getUsdcBalance/route.ts`

- POST with `{ address: string }`
- Queries Solana RPC for USDC token account balance
- Returns `{ balance: number }`

## Application Structure

```
app/
  layout.tsx              Root layout (fonts, Privy provider)
  providers.tsx           Privy configuration
  page.tsx                Home — gacha machine with card grid
  globals.css             Theme, animations, custom CSS

  components/
    Header.tsx            Nav bar with auth-gated links
    PrivyConnect.tsx      Login button / wallet display / USDC balance
    VendingMachine.tsx    Pack selection, purchase flow, stats, winners
    PackReveal.tsx        Video intro + card flip reveal + buyback
    NftGallery.tsx        Reusable NFT grid (used in inventory)
    WinnersFeed.tsx       Horizontal scrolling winners ticker

  marketplace/
    page.tsx              Browse all cards — filter, sort, search
    [id]/page.tsx         Card detail — image, attributes, buy button

  inventory/page.tsx      User's collection, purchased packs, gifted packs
  profile/page.tsx        Stats, rarity breakdown, leaderboard

  api/
    gacha/[...path]/route.ts   CollectorCrypt API proxy
    getUsdcBalance/route.ts    Solana USDC balance lookup

lib/
  api.ts                  API client (gachaApi object with all endpoints)
  types.ts                TypeScript types, pack config, rarity colors
  solana.ts               Transaction signing, message signing, image URL helper

public/
  gacha-video.webm        Pack opening intro video
  cb-logo-*.png           ComicBook.com brand logos
  cb-bug-*.png            ComicBook.com bug mascot
```

## Core Flows

### Pack Purchase

1. User selects pack type (Standard $50 / Legendary $250)
2. Client calls `generatePack(walletAddress, packType)` → receives unsigned base64 transaction
3. Transaction is deserialized and signed via Privy wallet
4. Signed transaction submitted via `submitTransaction()`
5. Client polls `openPack(memo)` every 500ms (30s timeout)
6. Result returned with NFT metadata, rarity, points
7. Pack reveal video plays → card flip animation → NFT displayed

### YOLO Multi-Pack

Same as above but `generateYoloPacks()` returns an array of transactions. All are signed sequentially, submitted, then results polled and displayed in a summary grid.

### Buyback

- Available for 24 hours after opening
- Returns 85% of insured value
- Flow: `buyback()` → sign tx → `submitTransaction()` → `pollBuybackCheck(memo)`

### Gifted Packs

- Receiving: Visible in `/inventory` Gifted Packs tab
- Opening: `generatePurchasedPack()` → sign message → `usePurchasedPack()` → `openPack()`

## Security

- **API key isolation**: `COLLECTOR_CRYPT_API_KEY` is server-side only, injected by the proxy
- **Endpoint allowlist**: Only known CollectorCrypt endpoints are forwarded
- **Rate limiting**: 60 req/min per IP on all proxy routes
- **Security headers**: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **No secrets in client bundle**: All `NEXT_PUBLIC_` vars are safe to expose
- **Wallet signing**: All transaction signing happens client-side via Privy — no private keys on server

## Deployment (Vercel)

### First Deploy

1. Connect the GitHub repo to Vercel
2. Set all environment variables in Vercel dashboard (Settings > Environment Variables)
3. Deploy

### Production Checklist

- [ ] Set `NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta`
- [ ] Set `NEXT_PUBLIC_USDC_MINT_ADDRESS` to mainnet USDC mint (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`)
- [ ] Set `COLLECTOR_CRYPT_BASE_URL` to production URL
- [ ] Rotate `COLLECTOR_CRYPT_API_KEY` for production
- [ ] Set `NEXT_PUBLIC_PRIVY_APP_ID` and `NEXT_PUBLIC_PRIVY_CLIENT_ID` for production Privy app
- [ ] Add production domain to Privy allowed domains
- [ ] Set `SOLANA_RPC` to a paid RPC provider (Helius, QuickNode, etc.)

### Redeployment

Push to `main` branch on `gossipgirlonchain/comicbook` — Vercel auto-deploys.

## Dev USDC (Devnet Testing)

Get test USDC at [spl-token-faucet.com](https://spl-token-faucet.com/?token-name=USDC-Dev) using mint `Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr`.

## CollectorCrypt API Docs

Full API documentation: [docs.collectorcrypt.com/gacha/api](https://docs.collectorcrypt.com/gacha/api)
