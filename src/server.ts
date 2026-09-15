import express from "express";
import { placeMarketOrder } from "./orders.js";
import { getDashboard } from "./dashboard.js";
import { crearSenal, listarSenales, obtenerVelasParaSenal } from "./signals.js";
import { subaccountAddr } from "./decibel.js";

const MARKET = "BTC/USD";
// En este proyecto tú eres tanto el trader como el "builder" (ver Capítulo 3
// de la guía) — por eso cada orden, sea manual o copiada, lleva tu propia
// subcuenta como builderAddr. Así el flujo de builder codes del requisito
// OBLIGATORIO #2 aplica siempre, no solo en una prueba aislada.
const BUILDER_FEE_BPS = 10;

const app = express();
app.use(express.json());
app.use(express.static("public"));

// Solo lectura: alimenta la pantalla (precio, balance, posiciones, órdenes).
app.get("/api/dashboard", async (_req, res) => {
  try {
    const data = await getDashboard(MARKET);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, reason: err instanceof Error ? err.message : "Error desconocido" });
  }
});

// El único botón "grande" del enunciado: comprar o vender un tamaño.
app.post("/api/order", async (req, res) => {
  const { side, size } = req.body ?? {};

  if (side !== "buy" && side !== "sell") {
    res.status(400).json({ ok: false, reason: "Elige comprar o vender" });
    return;
  }

  const sizeHuman = Number(size);
  if (!Number.isFinite(sizeHuman) || sizeHuman <= 0) {
    res.status(400).json({ ok: false, reason: "El tamaño debe ser un número mayor que 0" });
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
    res.status(500).json({ ok: false, reason: err instanceof Error ? err.message : "Error desconocido" });
  }
});

// Historial de señales: crear una nueva, y listarlas todas.
app.post("/api/signals", async (req, res) => {
  const { side, tpPct, slPct, holdHours } = req.body ?? {};
  try {
    const result = await crearSenal({
      market: MARKET,
      side,
      tpPct: Number(tpPct) / 100, // el usuario escribe "3", no "0.03"
      slPct: Number(slPct) / 100,
      holdMinutes: Number(holdHours) * 60,
    });
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, reason: err instanceof Error ? err.message : "Error desconocido" });
  }
});

app.get("/api/signals", async (_req, res) => {
  try {
    const signals = await listarSenales();
    res.json({ ok: true, signals });
  } catch (err) {
    res.status(500).json({ ok: false, reason: err instanceof Error ? err.message : "Error desconocido" });
  }
});

// Precio histórico + entrada/TP/SL de una señal, para dibujar su gráfico.
app.get("/api/signals/:id/candles", async (req, res) => {
  try {
    const data = await obtenerVelasParaSenal(req.params.id);
    if (!data) {
      res.status(404).json({ ok: false, reason: "Señal no encontrada" });
      return;
    }
    res.json({ ok: true, ...data });
  } catch (err) {
    res.status(500).json({ ok: false, reason: err instanceof Error ? err.message : "Error desconocido" });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
