import mongoose, { Schema, Document } from 'mongoose';

export interface IPayment extends Document {
  userId: mongoose.Types.ObjectId;
  telegramId: number;
  
  // Stripe
  stripePaymentIntentId: string;
  stripeCustomerId?: string;
  
  // Amount
  amount: number; // In centimes
  currency: string;
  
  // Type
  type: 'credits' | 'premium' | 'refund';
  
  // Status
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  
  // Credits or Premium
  creditsAdded?: number;
  premiumDays?: number;
  
  // Metadata
  description?: string;
  
  // Timestamps
  createdAt: Date;
  completedAt?: Date;
}

const PaymentSchema = new Schema<IPayment>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  telegramId: {
    type: Number,
    required: true,
    index: true,
  },
  
  stripePaymentIntentId: {
    type: String,
    required: true,
    unique: true,
  },
  stripeCustomerId: String,
  
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'eur',
  },
  
  type: {
    type: String,
    enum: ['credits', 'premium', 'refund'],
    required: true,
  },
  
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
  },
  
  creditsAdded: Number,
  premiumDays: Number,
  description: String,
  completedAt: Date,
}, {
  timestamps: true,
});

// Indexes
PaymentSchema.index({ createdAt: -1 });
PaymentSchema.index({ status: 1 });

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);
