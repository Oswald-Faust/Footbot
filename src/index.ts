import { logger } from './utils/logger.js';
import { startBot } from './bot/index.js';
import { config } from './config/index.js';

async function main() {
  logger.info('═══════════════════════════════════════════════════');
  logger.info('⚽ FootBot - Football AI Analysis Bot');
  logger.info('═══════════════════════════════════════════════════');
  logger.info(`Environment: ${config.NODE_ENV}`);
  logger.info(`Log Level: ${config.LOG_LEVEL}`);
  
  // Validate required configs
  if (!config.TELEGRAM_BOT_TOKEN) {
    logger.error('❌ TELEGRAM_BOT_TOKEN is required');
    process.exit(1);
  }
  
  if (!config.GEMINI_API_KEY) {
    logger.error('❌ GEMINI_API_KEY is required');
    process.exit(1);
  }
  
  // Log optional features
  if (config.FOOTBALL_DATA_API_KEY) {
    logger.info('✅ Football-Data.org API configured');
  } else {
    logger.warn('⚠️ Football-Data.org API not configured - limited football data');
  }
  
  if (config.OPENWEATHER_API_KEY) {
    logger.info('✅ OpenWeatherMap API configured');
  } else {
    logger.warn('⚠️ OpenWeatherMap API not configured - no weather data');
  }
  
  // Start a simple HTTP server for Health Checks (Required for Render/Heroku Web Services)
  const PORT = process.env.PORT || 3000;
  if (process.env.NODE_ENV === 'production') {
    const http = await import('http');
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('FootBot is running');
    });
    server.listen(PORT, () => {
      logger.info(`🏥 Health Check Server listening on port ${PORT}`);
    });
  }

  // Start the bot
  try {
    await startBot();
  } catch (error) {
    logger.error('Failed to start bot', { error });
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});
