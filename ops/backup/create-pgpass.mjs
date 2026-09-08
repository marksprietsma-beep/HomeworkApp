#!/usr/bin/env node
import { readFile, rename, writeFile, chmod } from "node:fs/promises";

const [envPath = "/opt/clarion/.env.production", outputPath = "/etc/clarion/backup.pgpass"] = process.argv.slice(2);
const contents = await readFile(envPath, "utf8");
const line = contents.split(/\r?\n/).find((entry) => /^DATABASE_URL=/.test(entry));
if (!line) throw new Error("DATABASE_URL is not present in the production environment file");
let value = line.slice("DATABASE_URL=".length).trim();
if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
const url = new URL(value);
if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") throw new Error("DATABASE_URL is not PostgreSQL");
const database = decodeURIComponent(url.pathname.slice(1));
const username = decodeURIComponent(url.username);
const password = decodeURIComponent(url.password);
if (database !== "clarion" || username !== "clarion" || !password) throw new Error("DATABASE_URL must identify clarion as both database and user and include a password");
const escapePgpass = (part) => part.replaceAll("\\", "\\\\").replaceAll(":", "\\:");
// The service fixes the destination to local PostgreSQL; wildcards avoid a
// localhost-vs-127.0.0.1 mismatch while still restricting database and role.
const row = ["*", "*", database, username, password].map(escapePgpass).join(":") + "\n";
const temporary = `${outputPath}.new`;
await writeFile(temporary, row, { mode: 0o600, flag: "w" });
await chmod(temporary, 0o600);
await rename(temporary, outputPath);
console.log(`Installed protected PostgreSQL credentials at ${outputPath}`);
