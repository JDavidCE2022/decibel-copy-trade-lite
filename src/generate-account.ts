import { Ed25519Account } from "@aptos-labs/ts-sdk";

const account = Ed25519Account.generate();

console.log("Address (public, you can share it):");
console.log(" ", account.accountAddress.toString());
console.log();
console.log("Private key (SECRET — only goes in .env, never share it):");
console.log(" ", account.privateKey.toString());
