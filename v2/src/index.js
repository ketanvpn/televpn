require('dotenv').config();

const { initDatabase } = require('./core/db');
const { logger } = require('./core/logger');
const { createBot } = require('./bot/createBot');

async function bootstrap() {
  const db = await initDatabase();
  const bot = createBot({ db });

  await bot.launch();
  logger.info('BotVPN v2 started');

  const shutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down`);
    await bot.stop(signal);
    await db.close();
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.error(`Fatal bootstrap error: ${err.message}`);
  process.exit(1);
});
