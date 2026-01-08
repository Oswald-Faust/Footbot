import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  
  // Quotas & Credits
  freeMessagesUsed: number;
  freeMessagesLimit: number;
  credits: number; // 1 credit = 1 message
  totalMessagesSent: number;
  
  // Subscription
  isPremium: boolean;
  premiumUntil?: Date;
  
  // Stripe
  stripeCustomerId?: string;
  
  // Admin
  isAdmin: boolean;
  isBanned: boolean;
  banReason?: string;
  isAuthorized: boolean;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
  
  // Stats
  totalSpent: number; // Total spent in centimes
  
  // Methods
  canSendMessage(): boolean;
  deductMessage(): Promise<void>;
  addCredits(amount: number): Promise<void>;
}

const UserSchema = new Schema<IUser>({
  telegramId: {
    type: Number,
    required: true,
    unique: true,
    index: true,
  },
  username: String,
  firstName: String,
  lastName: String,
  
  // Quotas & Credits
  freeMessagesUsed: {
    type: Number,
    default: 0,
  },
  freeMessagesLimit: {
    type: Number,
    default: 5, // 5 messages gratuits par défaut
  },
  credits: {
    type: Number,
    default: 0, // 1 crédit = 1 message
  },
  totalMessagesSent: {
    type: Number,
    default: 0,
  },
  
  // Subscription
  isPremium: {
    type: Boolean,
    default: false,
  },
  premiumUntil: Date,
  
  // Stripe
  stripeCustomerId: String,
  
  // Admin
  isAdmin: {
    type: Boolean,
    default: false,
  },
  isBanned: {
    type: Boolean,
    default: false,
  },
  banReason: String,
  
  // Access Control
  isAuthorized: {
    type: Boolean,
    default: false,
  },
  
  // Stats
  totalSpent: {
    type: Number,
    default: 0,
  },
  
  lastActiveAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Check if user can send a message
UserSchema.methods.canSendMessage = function(): boolean {
  // Admins can always send
  if (this.isAdmin) return true;
  
  // Banned users cannot send
  if (this.isBanned) return false;
  
  // Premium users can always send (if subscription is active)
  if (this.isPremium && this.premiumUntil && this.premiumUntil > new Date()) {
    return true;
  }
  
  // Check free messages
  if (this.freeMessagesUsed < this.freeMessagesLimit) {
    return true;
  }
  
  // Check credits (1 credit = 1 message)
  if (this.credits >= 1) {
    return true;
  }
  
  return false;
};

// Deduct a message from quotas/credits
UserSchema.methods.deductMessage = async function(): Promise<void> {
  // Admins don't pay
  if (this.isAdmin) {
    this.totalMessagesSent += 1;
    this.lastActiveAt = new Date();
    await this.save();
    return;
  }
  
  // Premium users don't pay per message
  if (this.isPremium && this.premiumUntil && this.premiumUntil > new Date()) {
    this.totalMessagesSent += 1;
    this.lastActiveAt = new Date();
    await this.save();
    return;
  }
  
  // Use free messages first
  if (this.freeMessagesUsed < this.freeMessagesLimit) {
    this.freeMessagesUsed += 1;
    this.totalMessagesSent += 1;
    this.lastActiveAt = new Date();
    await this.save();
    return;
  }
  
  // Deduct from credits (1 credit = 1 message)
  if (this.credits >= 1) {
    this.credits -= 1;
    this.totalSpent += 1;
    this.totalMessagesSent += 1;
    this.lastActiveAt = new Date();
    await this.save();
    return;
  }
  
  throw new Error('Insufficient credits');
};

// Add credits
UserSchema.methods.addCredits = async function(amount: number): Promise<void> {
  this.credits += amount;
  await this.save();
};

// Indexes
UserSchema.index({ createdAt: -1 });
UserSchema.index({ lastActiveAt: -1 });
UserSchema.index({ totalSpent: -1 });

export const User = mongoose.model<IUser>('User', UserSchema);
