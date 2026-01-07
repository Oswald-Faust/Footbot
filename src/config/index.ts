import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

dotenvConfig();

const envSchema = z.object({
  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),

  // Gemini
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  
  // OpenAI
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),

  // Football APIs
  FOOTBALL_DATA_API_KEY: z.string().optional(),
  API_FOOTBALL_KEY: z.string().optional(),

  // Weather
  OPENWEATHER_API_KEY: z.string().optional(),

  // MongoDB
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  
  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY is required'),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  
  // Admin Dashboard
  ADMIN_USERNAME: z.string().default('admin'),
  ADMIN_PASSWORD: z.string().default('footbot2024'),
  JWT_SECRET: z.string().default('footbot-secret-key-change-in-production'),
  
  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  CACHE_TTL_MINUTES: z.coerce.number().default(30),
  MAX_REQUESTS_PER_MINUTE: z.coerce.number().default(20),
  
  // Server
  PORT: z.coerce.number().default(3000),
  FRONTEND_URL: z.string().default('http://localhost:3001'),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }
  
  return result.data;
};

export const config = parseEnv();

export type Config = z.infer<typeof envSchema>;
