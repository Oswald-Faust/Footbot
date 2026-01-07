// Script to reset settings to new defaults
import mongoose from 'mongoose';
import { config } from '../config/index.js';

async function resetSettings() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(config.MONGODB_URI);
  console.log('Connected!');

  // List all collections
  const collections = await mongoose.connection.db?.listCollections().toArray();
  console.log('Collections:', collections?.map(c => c.name));

  // Try to delete from 'settings' collection
  try {
    const result = await mongoose.connection.db?.collection('settings').deleteMany({});
    console.log(`Deleted ${result?.deletedCount || 0} from 'settings'`);
  } catch (e) {
    console.log('No settings collection');
  }

  // Also try 'Settings' (capitalized, as Mongoose might use it)
  try {
    const result2 = await mongoose.connection.db?.collection('Settings').deleteMany({});
    console.log(`Deleted ${result2?.deletedCount || 0} from 'Settings'`);
  } catch (e) {
    console.log('No Settings collection');
  }

  console.log('Settings have been reset. The new defaults will be created automatically on next start.');
  
  await mongoose.disconnect();
  console.log('Done!');
  process.exit(0);
}

resetSettings().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
