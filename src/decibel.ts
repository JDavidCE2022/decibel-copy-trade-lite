import { DecibelReadDex, DecibelWriteDex, TESTNET_CONFIG, getPrimarySubaccountAddr } from "@decibeltrade/sdk";
import { Ed25519Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const privateKeyEnv = process.env.PRIVATE_KEY;
if (!privateKeyEnv) {
  throw new Error("Falta PRIVATE_KEY en .env — ver .env.example");
}

export const account = new Ed25519Account({
  privateKey: new Ed25519PrivateKey(privateKeyEnv),
});

export const read = new DecibelReadDex(TESTNET_CONFIG, {
  nodeApiKey: process.env.APTOS_NODE_API_KEY,
});

export const write = new DecibelWriteDex(TESTNET_CONFIG, account, {
  nodeApiKey: process.env.APTOS_NODE_API_KEY,
  skipSimulate: true,
});

// La dirección con la que en verdad se opera (distinta de la wallet, ver
// Capítulo 5/6 de la guía). Es una derivación pura, no necesita red.
export const subaccountAddr = getPrimarySubaccountAddr(
  account.accountAddress,
  TESTNET_CONFIG.compatVersion,
  TESTNET_CONFIG.deployment.package,
);
