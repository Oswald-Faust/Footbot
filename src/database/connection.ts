import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

let isConnected = false;

export async function connectDatabase(): Promise<void> {
  if (isConnected) {
    logger.info('Already connected to MongoDB');
    return;
  }

  if (!config.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined');
  }

  try {
    await mongoose.connect(config.MONGODB_URI, {
      dbName: 'footbot',
    });
    
    isConnected = true;
    logger.info('✅ Connected to MongoDB');
    
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', { error: err });
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
      isConnected = false;
    });
    
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error });
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) return;
  
  await mongoose.disconnect();
  isConnected = false;
  logger.info('Disconnected from MongoDB');
}

export { mongoose };
