import mongoose, { Schema, Document } from 'mongoose';

export interface ISettings extends Document {
  key: string;
  
  // Free messages
  freeMessagesLimit: number;
  
  // Pricing
  costPerMessage: number; // In centimes (0.5 by default)
  
  // Credit packages
  creditPackages: Array<{
    id: string;
    name: string;
    credits: number; // In centimes
    price: number; // In centimes
    popular?: boolean;
  }>;
  
  // Premium subscription
  premiumEnabled: boolean;
  premiumMonthlyPrice: number; // In centimes
  premiumYearlyPrice: number; // In centimes
  
  // Bot settings
  maintenanceMode: boolean;
  privateMode: boolean;
  accessCodes: string[];
  welcomeMessage?: string;
  
  // Timestamps
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>({
  key: {
    type: String,
    default: 'global',
    unique: true,
  },
  
  freeMessagesLimit: {
    type: Number,
    default: 5,
  },
  
  costPerMessage: {
    type: Number,
    default: 1, // 1 crédit par message
  },
  
  creditPackages: {
    type: [{
      id: String,
      name: String,
      credits: Number, // Nombre de messages
      price: Number, // Prix en centimes
      popular: Boolean,
    }],
    default: [
      { id: 'pack_10', name: '10 Messages', credits: 10, price: 100, popular: false }, // 1€ pour 10 messages
      { id: 'pack_50', name: '50 Messages', credits: 50, price: 400, popular: true }, // 4€ pour 50 messages
      { id: 'pack_100', name: '100 Messages', credits: 100, price: 700, popular: false }, // 7€ pour 100 messages
      { id: 'pack_500', name: '500 Messages', credits: 500, price: 2500, popular: false }, // 25€ pour 500 messages
    ],
  },
  
  premiumEnabled: {
    type: Boolean,
    default: true,
  },
  premiumMonthlyPrice: {
    type: Number,
    default: 999, // 9.99€ par mois
  },
  premiumYearlyPrice: {
    type: Number,
    default: 7999, // 79.99€ par an
  },
  
  maintenanceMode: {
    type: Boolean,
    default: false,
  },
  privateMode: {
    type: Boolean,
    default: false,
  },
  accessCodes: {
    type: [String],
    default: [],
  },
  welcomeMessage: String,
}, {
  timestamps: true,
});

export const Settings = mongoose.model<ISettings>('Settings', SettingsSchema);

// Helper to get global settings
export async function getSettings(): Promise<ISettings> {
  let settings = await Settings.findOne({ key: 'global' });
  
  if (!settings) {
    settings = await Settings.create({ key: 'global' });
  }
  
  return settings;
}

// Helper to update settings
export async function updateSettings(updates: Partial<ISettings>): Promise<ISettings> {
  const settings = await Settings.findOneAndUpdate(
    { key: 'global' },
    { $set: updates },
    { new: true, upsert: true }
  );
  
  return settings!;
}
