const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { config } = require('./config');
const { logger } = require('./logger');

function wrapDb(rawDb) {
  return {
    run(sql, params = []) {
      return new Promise((resolve, reject) => {
        rawDb.run(sql, params, function onRun(err) {
          if (err) return reject(err);
          resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    },
    get(sql, params = []) {
      return new Promise((resolve, reject) => {
        rawDb.get(sql, params, (err, row) => {
          if (err) return reject(err);
          resolve(row || null);
        });
      });
    },
    all(sql, params = []) {
      return new Promise((resolve, reject) => {
        rawDb.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      });
    },
    exec(sql) {
      return new Promise((resolve, reject) => {
        rawDb.exec(sql, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        rawDb.close((err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    },
    raw: rawDb,
  };
}

async function initDatabase() {
  const absPath = path.resolve(config.dbPath);
  const dir = path.dirname(absPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const rawDb = await new Promise((resolve, reject) => {
    const db = new sqlite3.Database(absPath, (err) => {
      if (err) return reject(err);
      resolve(db);
    });
  });

  const db = wrapDb(rawDb);
  await db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  logger.info(`Database ready at ${absPath}`);
  return db;
}

module.exports = { initDatabase };
