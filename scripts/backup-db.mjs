import fs from "node:fs";
import path from "node:path";

const source = process.env.DATABASE_URL ?? "./data/funding-ops.db";
const sourcePath = path.resolve(process.cwd(), source);

if (!fs.existsSync(sourcePath)) {
  console.error(`Database not found at ${sourcePath}`);
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.resolve(process.cwd(), "data", "backups");
fs.mkdirSync(backupDir, { recursive: true });

const destination = path.join(backupDir, `funding-ops-${stamp}.db`);
fs.copyFileSync(sourcePath, destination);

console.log(destination);
