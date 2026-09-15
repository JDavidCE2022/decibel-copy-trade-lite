import express from "express";
import { placeMarketOrder } from "./orders.js";
import { getDashboard } from "./dashboard.js";

const MARKET = "BTC/USD";

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
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, reason: err instanceof Error ? err.message : "Error desconocido" });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
