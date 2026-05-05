require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { initDatabase } = require('../core/db');
const { logger } = require('../core/logger');

async function migrate() {
  const db = await initDatabase();
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await db.exec(schemaSql);

    const columns = await db.all('PRAGMA table_info(servers)');
    const hasAuth = columns.some((c) => c && c.name === 'auth');
    if (!hasAuth) {
      await db.run('ALTER TABLE servers ADD COLUMN auth TEXT');
    }

    logger.info('Migration complete');
  } finally {
    await db.close();
  }
}

migrate().catch((err) => {
  logger.error(`Migration failed: ${err.message}`);
  process.exit(1);
});
