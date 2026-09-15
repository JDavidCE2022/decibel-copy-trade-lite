import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { CandlestickInterval } from "@decibeltrade/sdk";
import { read } from "./decibel.js";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "signals.json");

export type Signal = {
  id: string;
  market: string;
  side: "buy" | "sell";
  entryPrice: number;
  tpPct: number;
  slPct: number;
  tpPrice: number;
  slPrice: number;
  holdMinutes: number;
  createdAt: string;
  expiresAt: string;
};

async function leerTodas(): Promise<Signal[]> {
  if (!existsSync(DATA_FILE)) return [];
  const raw = await readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw) as Signal[];
}

async function guardarTodas(signals: Signal[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(signals, null, 2), "utf-8");
}

export type CrearSenalInput = {
  market: string;
  side: "buy" | "sell";
  tpPct: number; // as a fraction: 0.03 = 3%
  slPct: number;
  holdMinutes: number;
};

export type CrearSenalResult = { ok: true; signal: Signal } | { ok: false; reason: string };

/**
 * Creates and persists a signal. The entry price is ALWAYS read live from
 * the SDK here on the server (never trusting a price sent by the browser)
 * — that way nobody can make up a favorable entry.
 */
export async function crearSenal(input: CrearSenalInput): Promise<CrearSenalResult> {
  const { market, side, tpPct, slPct, holdMinutes } = input;

  if (side !== "buy" && side !== "sell") {
    return { ok: false, reason: "El lado debe ser Long o Short" };
  }
  if (!Number.isFinite(tpPct) || tpPct <= 0) {
    return { ok: false, reason: "El take profit debe ser un porcentaje mayor que 0" };
  }
  if (!Number.isFinite(slPct) || slPct <= 0) {
    return { ok: false, reason: "El stop loss debe ser un porcentaje mayor que 0" };
  }
  if (!Number.isFinite(holdMinutes) || holdMinutes <= 0) {
    return { ok: false, reason: "La duración debe ser mayor que 0" };
  }

  const [priceRow] = await read.marketPrices.getByName({ marketName: market });
  if (!priceRow) {
    return { ok: false, reason: `No se pudo leer el precio en vivo de ${market}` };
  }
  const entryPrice = priceRow.mark_px;

  // Long: TP above the entry, SL below. Short: exactly the opposite.
  const tpPrice = side === "buy" ? entryPrice * (1 + tpPct) : entryPrice * (1 - tpPct);
  const slPrice = side === "buy" ? entryPrice * (1 - slPct) : entryPrice * (1 + slPct);

  const now = new Date();
  const signal: Signal = {
    id: randomUUID(),
    market,
    side,
    entryPrice,
    tpPct,
    slPct,
    tpPrice,
    slPrice,
    holdMinutes,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + holdMinutes * 60_000).toISOString(),
  };

  const todas = await leerTodas();
  todas.unshift(signal); // most recent first
  await guardarTodas(todas);

  return { ok: true, signal };
}

export async function listarSenales(): Promise<Signal[]> {
  return leerTodas();
}

export async function obtenerSenal(id: string): Promise<Signal | null> {
  const todas = await leerTodas();
  return todas.find((s) => s.id === id) ?? null;
}

/**
 * Historical price to draw a signal's chart: from when it was published
 * until now (or until it expired, whichever comes first).
 */
export async function obtenerVelasParaSenal(id: string) {
  const signal = await obtenerSenal(id);
  if (!signal) return null;

  const startTime = new Date(signal.createdAt).getTime();
  const endTime = Math.min(Date.now(), new Date(signal.expiresAt).getTime());

  if (endTime <= startTime) {
    // Signal just published — there isn't even a minute of history yet.
    return { signal, candles: [] as Awaited<ReturnType<typeof read.candlesticks.getByName>> };
  }

  const candles = await read.candlesticks.getByName({
    marketName: signal.market,
    interval: CandlestickInterval.OneMinute,
    startTime,
    endTime,
  });

  return { signal, candles };
}
