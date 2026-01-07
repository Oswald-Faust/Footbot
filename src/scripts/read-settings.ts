// Script to read settings
import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { Settings } from '../database/models/Settings.js';

async function readPackages() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(config.MONGODB_URI);
  console.log('Connected!');

  const settings = await Settings.findOne({ key: 'global' });
  if (settings) {
    console.log('Current packages:', JSON.stringify(settings.creditPackages, null, 2));
  } else {
    console.log('No settings found');
  }

  await mongoose.disconnect();
  console.log('Done!');
  process.exit(0);
}

readPackages().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
