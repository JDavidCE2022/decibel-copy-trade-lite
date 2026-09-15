import express from "express";
import { placeMarketOrder } from "./orders.js";
import { getDashboard } from "./dashboard.js";
import { crearSenal, listarSenales, obtenerVelasParaSenal } from "./signals.js";
import { subaccountAddr } from "./decibel.js";

const MARKET = "BTC/USD";
// In this project you're both the trader and the "builder" (see Chapter 3
// of the guide) — that's why every order, manual or copied, carries your
// own subaccount as builderAddr. That way the builder-code flow from
// MUST-HAVE requirement #2 always applies, not just in an isolated test.
const BUILDER_FEE_BPS = 10;

const app = express();
app.use(express.json());
app.use(express.static("public"));

// Read-only: feeds the screen (price, balance, positions, orders).
app.get("/api/dashboard", async (_req, res) => {
  try {
    const data = await getDashboard(MARKET);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, reason: err instanceof Error ? err.message : "Unknown error" });
  }
});

// The one "big button" from the brief: buy or sell a size.
app.post("/api/order", async (req, res) => {
  const { side, size } = req.body ?? {};

  if (side !== "buy" && side !== "sell") {
    res.status(400).json({ ok: false, reason: "Choose buy or sell" });
    return;
  }

  const sizeHuman = Number(size);
  if (!Number.isFinite(sizeHuman) || sizeHuman <= 0) {
    res.status(400).json({ ok: false, reason: "Size must be a number greater than 0" });
    return;
  }

  try {
    const result = await placeMarketOrder({
      marketName: MARKET,
      isBuy: side === "buy",
      sizeHuman,
      builderAddr: subaccountAddr,
      builderFeeBps: BUILDER_FEE_BPS,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, reason: err instanceof Error ? err.message : "Unknown error" });
  }
});

// Signal history: create a new one, and list them all.
app.post("/api/signals", async (req, res) => {
  const { side, tpPct, slPct, holdHours } = req.body ?? {};
  try {
    const result = await crearSenal({
      market: MARKET,
      side,
      tpPct: Number(tpPct) / 100, // the user types "3", not "0.03"
      slPct: Number(slPct) / 100,
      holdMinutes: Number(holdHours) * 60,
    });
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, reason: err instanceof Error ? err.message : "Unknown error" });
  }
});

app.get("/api/signals", async (_req, res) => {
  try {
    const signals = await listarSenales();
    res.json({ ok: true, signals });
  } catch (err) {
    res.status(500).json({ ok: false, reason: err instanceof Error ? err.message : "Unknown error" });
  }
});

// Historical price + a signal's entry/TP/SL, to draw its chart.
app.get("/api/signals/:id/candles", async (req, res) => {
  try {
    const data = await obtenerVelasParaSenal(req.params.id);
    if (!data) {
      res.status(404).json({ ok: false, reason: "Signal not found" });
      return;
    }
    res.json({ ok: true, ...data });
  } catch (err) {
    res.status(500).json({ ok: false, reason: err instanceof Error ? err.message : "Unknown error" });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
