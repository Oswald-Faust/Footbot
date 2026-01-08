import mongoose, { Schema, Document } from 'mongoose';

export interface IInviteCode extends Document {
  code: string;
  type: 'unlimited' | 'one_time';
  isUsed: boolean;
  usedBy?: number; // Telegram ID of the user who used it
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InviteCodeSchema = new Schema<IInviteCode>({
  code: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true
  },
  type: { 
    type: String, 
    enum: ['unlimited', 'one_time'], 
    default: 'one_time' 
  },
  isUsed: { 
    type: Boolean, 
    default: false 
  },
  usedBy: Number,
  usedAt: Date,
}, {
  timestamps: true,
});

// Index for fast lookups
InviteCodeSchema.index({ code: 1 });

export const InviteCode = mongoose.model<IInviteCode>('InviteCode', InviteCodeSchema);
