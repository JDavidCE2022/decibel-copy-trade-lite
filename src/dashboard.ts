import { read, subaccountAddr } from "./decibel.js";

export async function getDashboard(marketName: string) {
  const markets = await read.markets.getAll();
  const market = markets.find((m) => m.market_name === marketName) ?? null;

  const priceRows = market ? await read.marketPrices.getByName({ marketName }) : [];
  const price = priceRows[0]?.mark_px ?? null;

  let balance = 0;
  try {
    const overview = await read.accountOverview.getByAddr({ subAddr: subaccountAddr });
    balance = overview.perp_equity_balance;
  } catch (err) {
    // A subaccount with no deposits doesn't have an overview yet — that's "$0", not an error.
    if (!(err instanceof Error && err.message.includes("404"))) {
      throw err;
    }
  }

  const positions = await read.userPositions.getByAddr({
    subAddr: subaccountAddr,
    includeDeleted: false,
    limit: 20,
  });

  const openOrders = await read.userOpenOrders.getByAddr({ subAddr: subaccountAddr });

  return {
    market: marketName,
    price,
    balance,
    positions,
    openOrders: openOrders.items,
  };
}
