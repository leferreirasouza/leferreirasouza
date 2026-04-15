#!/usr/bin/env tsx
/**
 * DEV TOKEN GENERATOR
 *
 * Generates a JWT for local development.
 * DO NOT use in production — production auth should use a proper login flow.
 *
 * Usage:
 *   npx tsx scripts/dev-token.ts
 *   npx tsx scripts/dev-token.ts --role CFO
 *   npx tsx scripts/dev-token.ts --role LEGAL_COUNSEL --email legal@company.com
 */

import jwt from "jsonwebtoken";
import "dotenv/config";

const args = process.argv.slice(2);
const get = (flag: string) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : undefined; };

const role = get("--role") ?? "HEAD_OF_IR";
const email = get("--email") ?? `dev-${role.toLowerCase()}@ir-os.local`;
const userId = get("--userId") ?? `user-dev-${role.toLowerCase()}`;
const expiresIn = get("--expires") ?? "24h";

const secret = process.env.JWT_SECRET;
if (!secret) {
  console.error("JWT_SECRET not set in .env");
  process.exit(1);
}

const payload = { userId, role, email };
const token = jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);

console.log(`\n🔑 Dev JWT Token`);
console.log(`   Role:    ${role}`);
console.log(`   Email:   ${email}`);
console.log(`   Expires: ${expiresIn}`);
console.log(`\n   Token:\n`);
console.log(token);
console.log(`\n   Usage:\n   curl -H "Authorization: Bearer ${token.slice(0, 30)}..." ...\n`);
