import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

function loadEnv() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const dir = resolve(process.cwd(), "supabase/migrations");
const files = readdirSync(dir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const urls = [process.env.DATABASE_URL, process.env.DATABASE_POOLER_URL].filter(Boolean);

if (!urls.length) {
  console.error("Set DATABASE_URL in .env");
  process.exit(1);
}

let lastError;
for (const url of urls) {
  const sql = postgres(url, { ssl: "require", max: 1, connect_timeout: 20 });
  try {
    for (const file of files) {
      await sql.unsafe(readFileSync(resolve(dir, file), "utf8"));
      console.log(`Applied ${file}`);
    }
    await sql.end();
    process.exit(0);
  } catch (err) {
    lastError = err;
    await sql.end({ timeout: 1 }).catch(() => undefined);
  }
}

console.error(lastError instanceof Error ? lastError.message : lastError);
process.exit(1);
