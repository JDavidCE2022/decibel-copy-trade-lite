import { read, subaccountAddr } from "./decibel.js";

const markets = await read.markets.getAll();
console.log(`Mercados perpetuos disponibles (${markets.length}):`);
for (const m of markets) {
  console.log(`  - ${m.market_name}`);
}

const btc = markets.find((m) => m.market_name.includes("BTC"));
if (btc) {
  const prices = await read.marketPrices.getByName({ marketName: btc.market_name });
  console.log(`\nPrecio en vivo de ${btc.market_name}:`, prices[0]);
} else {
  console.log("\nNo se encontró un mercado de BTC en la lista de arriba.");
}

console.log("\nTu subcuenta:", subaccountAddr);

try {
  const overview = await read.accountOverview.getByAddr({ subAddr: subaccountAddr });
  console.log("Balance/equity:", overview.perp_equity_balance);
} catch (err) {
  // Una subcuenta sin depósitos no tiene overview todavía — es "$0", no un error.
  if (err instanceof Error && err.message.includes("404")) {
    console.log("Balance/equity: $0 (sin depósitos todavía)");
  } else {
    console.log("No se pudo leer el balance:", (err as Error).message);
  }
}

const positions = await read.userPositions.getByAddr({ subAddr: subaccountAddr, includeDeleted: false, limit: 10 });
console.log("Posiciones abiertas:", positions.length === 0 ? "ninguna" : positions);

const openOrders = await read.userOpenOrders.getByAddr({ subAddr: subaccountAddr });
console.log("Órdenes abiertas:", openOrders.total_count === 0 ? "ninguna" : openOrders.items);
