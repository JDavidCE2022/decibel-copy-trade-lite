import { read, subaccountAddr } from "./decibel.js";

const markets = await read.markets.getAll();
console.log(`Available perpetual markets (${markets.length}):`);
for (const m of markets) {
  console.log(`  - ${m.market_name}`);
}

const btc = markets.find((m) => m.market_name.includes("BTC"));
if (btc) {
  const prices = await read.marketPrices.getByName({ marketName: btc.market_name });
  console.log(`\nLive price for ${btc.market_name}:`, prices[0]);
} else {
  console.log("\nNo BTC market found in the list above.");
}

console.log("\nYour subaccount:", subaccountAddr);

try {
  const overview = await read.accountOverview.getByAddr({ subAddr: subaccountAddr });
  console.log("Balance/equity:", overview.perp_equity_balance);
} catch (err) {
  // A subaccount with no deposits doesn't have an overview yet — that's "$0", not an error.
  if (err instanceof Error && err.message.includes("404")) {
    console.log("Balance/equity: $0 (no deposits yet)");
  } else {
    console.log("Couldn't read the balance:", (err as Error).message);
  }
}

const positions = await read.userPositions.getByAddr({ subAddr: subaccountAddr, includeDeleted: false, limit: 10 });
console.log("Open positions:", positions.length === 0 ? "none" : positions);

const openOrders = await read.userOpenOrders.getByAddr({ subAddr: subaccountAddr });
console.log("Open orders:", openOrders.total_count === 0 ? "none" : openOrders.items);
