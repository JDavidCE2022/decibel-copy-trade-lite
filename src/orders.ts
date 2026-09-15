import { TimeInForce } from "@decibeltrade/sdk";
import { read, write, subaccountAddr } from "./decibel.js";

function aUnidadesDeCadena(cantidadHumana: number, decimales: number): number {
  return Math.floor(cantidadHumana * 10 ** decimales);
}

export type OrderResult =
  | { ok: true; orderId: string; transactionHash: string }
  | { ok: false; reason: string };

/**
 * Coloca una orden "a mercado" (en realidad una IOC agresiva al precio en
 * vivo, que es como se simula un market order en un libro de órdenes).
 *
 * IMPORTANTE: result.success === true del SDK no basta para saber si el
 * trade ocurrió de verdad — un rechazo por margen insuficiente también
 * devuelve success:true pero sin orderId (ver Capítulo 7 de la guía). Por
 * eso esta función normaliza ambos casos como fallo con un mensaje claro.
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

  // Asegura que la subcuenta esté configurada para este mercado. Es
  // necesaria antes de la primera orden en cada mercado; en las siguientes
  // veces el contrato la rechaza porque ya existe — no es un error real.
  try {
    await write.configureUserSettingsForMarket({
      marketAddr: market.market_addr,
      subaccountAddr,
      isCross: true,
      userLeverage: 5,
    });
  } catch {
    // Ya estaba configurada — seguimos.
  }

  const price = aUnidadesDeCadena(priceData.mark_px, market.px_decimals);
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
