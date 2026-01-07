import { logger } from './utils/logger.js';
import { startBot } from './bot/index.js';
import { config } from './config/index.js';
import { connectDatabase } from './database/index.js';
import { startAPI } from './api/admin.js';

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
  
  if (!config.MONGODB_URI) {
    logger.error('❌ MONGODB_URI is required');
    process.exit(1);
  }
  
  if (!config.STRIPE_SECRET_KEY) {
    logger.error('❌ STRIPE_SECRET_KEY is required');
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
  
  // Connect to MongoDB
  try {
    await connectDatabase();
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error });
    process.exit(1);
  }
  
  // Start the API server (includes health check)
  try {
    startAPI();
  } catch (error) {
    logger.error('Failed to start API server', { error });
    process.exit(1);
  }

  // Start the bot
  try {
    await startBot();
  } catch (error) {
    logger.error('Failed to start bot', { error });
    process.exit(1);
  }
  
  logger.info('═══════════════════════════════════════════════════');
  logger.info('🚀 FootBot fully operational!');
  logger.info(`📊 Admin Dashboard: ${config.FRONTEND_URL}/admin`);
  logger.info(`💳 Stripe configured`);
  logger.info('═══════════════════════════════════════════════════');
}

main().catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});
