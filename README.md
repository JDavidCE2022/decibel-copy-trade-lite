# Decibel Copy-Trade Lite

## Video: https://youtu.be/cG1dFIz2pu4

A dead-simple BTC trading screen on Decibel (Aptos testnet), plus a copy-trade
layer: publish a signal (Long/Short, TP%, SL%, hold time), see it charted
against live price, and let anyone copy it with one click.

Built for the Decibel "Copy-Trade Lite" take-home.

## Stack

- **TypeScript / Node.js** — the only option, since `@decibeltrade/sdk` is a
  TypeScript/JavaScript-only package (no Python SDK exists).
- **Express** — a small local backend. It is the only thing that ever talks
  to `@decibeltrade/sdk`; it holds the private key and the Aptos API key.
- **Plain HTML/CSS/JS** for the frontend — no framework. The browser never
  sees any secret; it only calls two small JSON APIs on the backend.
- **A JSON file** (`data/signals.json`) as the signal history store — no
  database needed for this scope.
- `tsx` to run TypeScript directly (no build step needed for the MVP).

## How to run it

```bash
npm install
cp .env.example .env   # fill in PRIVATE_KEY and APTOS_NODE_API_KEY (see below)
npm run serve
```

Open `http://localhost:3000`.

There's also `npm run dev`, a small CLI smoke test that prints the market
list, live BTC price, and your account state — useful to sanity-check the
SDK connection independently of the web UI.

### Getting the two required env values

- `PRIVATE_KEY` — an Aptos **testnet** account. Run `npx tsx src/generate-account.ts`
  to generate a fresh one (never reuse a mainnet key here).
- `APTOS_NODE_API_KEY` — a free API key from
  [build.aptoslabs.com](https://build.aptoslabs.com) (server-side / non-client
  usage — it is never sent to the browser).

## What's implemented

**MUST**
- [x] Connect to Decibel on Aptos testnet, authenticate a wallet from an env var
- [x] Two-step builder-code flow (`approveMaxBuilderFee` → `placeOrder`), verified live on testnet with a real filled order
- [x] Kid-friendly trade screen: pick BTC, Buy/Sell, size, one big button
- [x] Live-ish account state (balance, positions, open orders) via polling

**SHOULD**
- [x] Signal authoring (market, side, live entry price, TP%, SL%, hold duration)
- [x] Chart: live price history + entry/TP/SL reference lines (hand-rolled inline SVG, no charting library)
- [x] One-click copy — reuses the exact same order-placement code path as the manual trade screen
- [x] Persistent signal history (JSON file), listed newest-first

**STRETCH** — not attempted (out of scope for the time box; see "What I'd do with another day").

## Testnet collateral

Decibel's public testnet phase had appeared to conclude in early 2026
(mainnet launched February 26, 2026), and `app.decibel.trade` only serves
mainnet now — its "Enable Trading" flow prompts a **mainnet** signature,
which was correctly never approved, per the testnet-only rule for this repo.
No faucet/mint path was documented anywhere in the SDK, CLI, or the ~170-page
docs index.

A Decibel team member pointed me to the actual testnet frontend,
`testnet-app.decibel.trade`, which does have a "Mint USDC" faucet button.
Once minted, the exact same account and code in this repo placed and
**filled** a real order end-to-end — no code changes were needed for
that part, only the missing piece of information about where testnet lived.

## Real bugs this collateral unlocked (found and fixed)

Two real bugs only surfaced once there was collateral to actually fill an
order against — before that, every failed order looked identical whether the
cause was missing funds or something else:

- **`write.placeOrder` needs `subaccountAddr` passed explicitly.** The SDK
  extracts the filled order's `orderId` by matching the on-chain event's
  `user` field against `subaccountAddr ?? account.accountAddress`. Without
  passing it, the SDK compared against the wallet address instead of the
  subaccount address that actually appears in the event — so a real,
  successful fill was silently reported as "order didn't execute (probably
  insufficient funds)", even though the trade had gone through.
- **Decibel matches orders asynchronously.** The `placeOrder` transaction's
  own event only ever shows `status: ACKNOWLEDGED` — the order was accepted
  into the network's async matching engine, not that it filled. The actual
  match happens a little later, processed by the network in the background
  (confirmed by reading the raw on-chain transaction and watching the
  position update a few seconds after submission).

Separately, without collateral, `placeOrder` on a resting (GTC) order returns
`{ success: true, orderId: undefined }` — the on-chain contract silently
discards an order it can't margin, without aborting the transaction. A naive
implementation would report "trade placed!" when nothing happened.
`src/orders.ts` treats a missing `orderId` as a failure with a clear reason,
specifically to avoid this silent-success trap (see the "unhappy path"
safety rule below).

## Architecture

```
public/            → static frontend (HTML/CSS/JS), talks only to /api/*
src/server.ts      → Express routes, the only bridge to the SDK layer
src/decibel.ts      → SDK clients + account/subaccount setup (shared)
src/orders.ts       → order placement, chain-unit conversion, silent-failure guard
src/dashboard.ts    → read-only account state for the UI
src/signals.ts      → signal CRUD + candlestick lookup, JSON file storage
data/signals.json   → signal history (gitignored; created at runtime)
```

The backend/frontend split exists for one reason: the private key must never
reach the browser. The frontend only calls two JSON endpoints
(`/api/dashboard`, `/api/order`, `/api/signals*`); it never imports the SDK.

## Real bugs found while building this (AI-assisted, human-verified)

Every one of these was caught by actually running the code against testnet,
not by reading docs:

1. **`moduleResolution: "NodeNext"` broke type-checking** on valid SDK
   imports, because the SDK's own compiled `.d.ts` files use extensionless
   relative imports. Switched to `"Bundler"` resolution (matches how `tsx`
   actually loads the code).
2. **The SDK's own `readme.md` disagrees with its compiled types** in
   several places (e.g. `marketPrices.getByName` takes an object, not a bare
   string, in the real `.d.ts`). Trusted the compiled types over the prose.
3. **`price`/`size` must be integers in chain units**, not human decimals —
   `Math.floor(amount * 10 ** decimals)`. Passing `0.001` directly throws a
   `BigInt` conversion error deep in the Aptos SDK.
4. **`userLeverage` is a plain integer in `[0, 255]`**, not basis points as
   one readme example's comment claimed (`1000` for "10x" is out of range).
5. **Placing an order requires `configureUserSettingsForMarket` first**, once
   per market — otherwise both that call and `placeOrder` abort with a
   generic `EOBJECT_DOES_NOT_EXIST` Move error that has nothing to do with
   permissions (this was initially misdiagnosed as a builder-registration
   gate before being traced to missing initialization order).
6. **The silent order-rejection behavior** described above.
7. **`placeOrder` silently fails to report a real fill without `subaccountAddr`**
   — see "Real bugs this collateral unlocked" above.
8. **Decibel's async order matching** — a `placeOrder` transaction's own
   event confirms acceptance, not a fill; see above.

## Biggest safety risk in this submission

The private key is a real signer for a real (testnet) account. Mitigation:
it only ever lives in `.env` (gitignored, never printed to logs or sent to
the browser), the backend is the sole process that constructs the SDK's
write client, and every write call is wrapped so a failure returns a typed
`{ ok: false, reason }` instead of throwing into an unhandled rejection.

## What I'd do with another day

- WebSocket subscriptions (`marketPrices.subscribeByName`, etc.) instead of
  polling.
- Mark signal outcome (hit TP / hit SL / expired) by polling fills after
  `expiresAt`.
- A tiny author leaderboard from the signal history.
- Mobile layout pass (the current CSS is single-column and phone-width
  already, but untested on a real device).

## AI usage disclosure

This project was built with Claude Code as a pair-programming partner:
Claude wrote essentially all of the code, one feature at a time, explaining
the reasoning behind each choice before moving on. Each piece was run for
real against Decibel testnet and verified before proceeding — the bug list
above is the direct result of that verification loop, not guesswork. I
directed scope and ordering, made the product/security judgment calls (e.g.
what counts as an acceptable fallback while testnet collateral was hard to
find, English vs. Spanish for this README), and tested every feature myself
in the browser before considering it done.
