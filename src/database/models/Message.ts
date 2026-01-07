import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  userId: mongoose.Types.ObjectId;
  telegramId: number;
  
  // Message details
  type: 'image' | 'text' | 'command';
  content?: string;
  
  // Match analysis
  homeTeam?: string;
  awayTeam?: string;
  competition?: string;
  
  // Cost
  wasFree: boolean;
  cost: number; // In centimes
  
  // Timestamps
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>({
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
  
  type: {
    type: String,
    enum: ['image', 'text', 'command'],
    required: true,
  },
  content: String,
  
  homeTeam: String,
  awayTeam: String,
  competition: String,
  
  wasFree: {
    type: Boolean,
    default: false,
  },
  cost: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Indexes
MessageSchema.index({ createdAt: -1 });
MessageSchema.index({ userId: 1, createdAt: -1 });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
