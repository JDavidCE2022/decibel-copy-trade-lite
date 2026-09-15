import { TimeInForce } from "@decibeltrade/sdk";
import { read, write, subaccountAddr } from "./decibel.js";

function aUnidadesDeCadena(cantidadHumana: number, decimales: number): number {
  return Math.floor(cantidadHumana * 10 ** decimales);
}

export type OrderResult =
  | { ok: true; orderId: string; transactionHash: string }
  | { ok: false; reason: string };

/**
 * Places a "market" order (really an aggressive IOC at the live price,
 * which is how a market order is simulated on an order book).
 *
 * IMPORTANT: result.success === true from the SDK isn't enough to know the
 * trade actually happened — a rejection for insufficient margin also
 * returns success:true but with no orderId (see Chapter 7 of the guide).
 * That's why this function normalizes both cases as a failure with a
 * clear message.
 *
 * Also, Decibel matches orders asynchronously: the transaction's own event
 * only confirms the order was ACCEPTED (status ACKNOWLEDGED), not that it
 * was already filled — the actual matching happens a bit later, processed
 * by the network in the background.
 */
export async function placeMarketOrder(params: {
  marketName: string;
  isBuy: boolean;
  sizeHuman: number;
  builderAddr?: string;
  builderFeeBps?: number;
}): Promise<OrderResult> {
  const { marketName, isBuy, sizeHuman, builderAddr, builderFeeBps } = params;

  if (!Number.isFinite(sizeHuman) || sizeHuman <= 0) {
    return { ok: false, reason: "El tamaño debe ser un número mayor que 0" };
  }

  const markets = await read.markets.getAll();
  const market = markets.find((m) => m.market_name === marketName);
  if (!market) {
    return { ok: false, reason: `No existe el mercado ${marketName}` };
  }

  const [priceData] = await read.marketPrices.getByName({ marketName });
  if (!priceData) {
    return { ok: false, reason: "No se pudo leer el precio en vivo" };
  }

  // Makes sure the subaccount is configured for this market. It's needed
  // before the first order in each market; on later calls the contract
  // rejects it because it already exists — that's not a real error.
  try {
    await write.configureUserSettingsForMarket({
      marketAddr: market.market_addr,
      subaccountAddr,
      isCross: true,
      userLeverage: 5,
    });
  } catch {
    // Already configured — carry on.
  }

  // This is an IOC (immediate-or-cancel), not a real market order: it only
  // fills if it crosses the order book at the moment it's sent. If we used
  // the exact mark_px, the book could have moved since the last read and
  // the order would cancel with zero fill — indistinguishable from a
  // margin rejection. This 1% buffer guarantees it crosses like a real
  // aggressive buy/sell.
  const SLIPPAGE = 0.01;
  const precioConColchon = isBuy ? priceData.mark_px * (1 + SLIPPAGE) : priceData.mark_px * (1 - SLIPPAGE);

  const price = aUnidadesDeCadena(precioConColchon, market.px_decimals);
  const size = aUnidadesDeCadena(sizeHuman, market.sz_decimals);

  try {
    const result = await write.placeOrder({
      marketName,
      price,
      size,
      isBuy,
      timeInForce: TimeInForce.ImmediateOrCancel,
      isReduceOnly: false,
      tickSize: market.tick_size,
      builderAddr,
      builderFee: builderFeeBps,
      // Without this, the SDK looks for the order_id by comparing against
      // the wallet address instead of the subaccount, and never finds it
      // even when it does exist in the on-chain event (a real bug found
      // by testing live).
      subaccountAddr,
    });

    if (!result.success) {
      return { ok: false, reason: result.error };
    }
    if (!result.orderId) {
      return {
        ok: false,
        reason: "La orden no se ejecutó (probablemente fondos insuficientes)",
      };
    }
    return { ok: true, orderId: result.orderId, transactionHash: result.transactionHash };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Error desconocido" };
  }
}
