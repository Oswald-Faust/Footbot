// Script to update settings with correct packages
import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { Settings } from '../database/models/Settings.js';

async function updatePackages() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(config.MONGODB_URI);
  console.log('Connected!');

  // List existing settings
  const existing = await Settings.findOne({ key: 'global' });
  console.log('Existing settings:', existing ? 'Found' : 'Not found');
  if (existing) {
    console.log('Current packages:', JSON.stringify(existing.creditPackages, null, 2));
  }

  // New packages: 1 credit = 1 message
  const newPackages = [
    { id: 'pack_10', name: '10 Messages', credits: 10, price: 100, popular: false },
    { id: 'pack_50', name: '50 Messages', credits: 50, price: 400, popular: true },
    { id: 'pack_100', name: '100 Messages', credits: 100, price: 700, popular: false },
    { id: 'pack_500', name: '500 Messages', credits: 500, price: 2500, popular: false },
  ];

  // Update or create settings
  const settings = await Settings.findOneAndUpdate(
    { key: 'global' },
    { 
      $set: { 
        creditPackages: newPackages,
        costPerMessage: 1, // 1 credit = 1 message
      } 
    },
    { new: true, upsert: true }
  );

  console.log('Updated packages:', JSON.stringify(settings.creditPackages, null, 2));
  console.log('costPerMessage:', settings.costPerMessage);

  await mongoose.disconnect();
  console.log('Done!');
  process.exit(0);
}

updatePackages().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
