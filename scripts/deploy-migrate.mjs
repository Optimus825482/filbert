import pg from "pg";
import { execSync } from "node:child_process";

const { Client } = pg;
const dbUrl = process.env.DATABASE_URL;

async function main() {
  if (dbUrl) {
    let client;
    try {
      console.log("Checking database for any previously failed migration records...");
      client = new Client({ connectionString: dbUrl });
      await client.connect();

      // Yarım kalmış veya başarısız duruma düşmüş migration kayıtlarını temizle
      const res = await client.query(`
        DELETE FROM "_prisma_migrations"
        WHERE "finished_at" IS NULL OR "rolled_back_at" IS NOT NULL;
      `);
      if (res.rowCount && res.rowCount > 0) {
        console.log(`Cleaned up ${res.rowCount} failed/incomplete migration record(s).`);
      } else {
        console.log("No failed migrations found in _prisma_migrations.");
      }
    } catch (err) {
      console.warn("Pre-migration check warning (will proceed to migrate deploy):", err.message);
    } finally {
      if (client) {
        try {
          await client.end();
        } catch {}
      }
    }
  }

  console.log("Applying Prisma migrations via prisma migrate deploy...");
  execSync("pnpm prisma migrate deploy", { stdio: "inherit" });
  console.log("Migrations applied successfully.");
}

main().catch((err) => {
  console.error("Migration execution failed:", err);
  process.exit(1);
});
