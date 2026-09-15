import { Ed25519Account } from "@aptos-labs/ts-sdk";

const account = Ed25519Account.generate();

console.log("Dirección (pública, puedes compartirla):");
console.log(" ", account.accountAddress.toString());
console.log();
console.log("Clave privada (SECRETA — va solo en .env, nunca se comparte):");
console.log(" ", account.privateKey.toString());
