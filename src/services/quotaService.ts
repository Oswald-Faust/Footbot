import { User, IUser, Message, getSettings } from '../database/index.js';
import { logger } from '../utils/logger.js';

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  user: IUser;
  remainingFreeMessages: number;
  credits: number;
  totalMessages: number;
}

export interface QuotaDeductResult {
  success: boolean;
  wasFree: boolean;
  cost: number;
  remainingFreeMessages: number;
  remainingCredits: number;
}

class QuotaService {
  /**
   * Get or create a user by Telegram ID
   */
  async getOrCreateUser(
    telegramId: number,
    userData?: {
      username?: string;
      firstName?: string;
      lastName?: string;
    }
  ): Promise<IUser> {
    let user = await User.findOne({ telegramId });
    
    if (!user) {
      const settings = await getSettings();
      
      user = await User.create({
        telegramId,
        username: userData?.username,
        firstName: userData?.firstName,
        lastName: userData?.lastName,
        freeMessagesLimit: settings.freeMessagesLimit,
      });
      
      logger.info('New user created', { telegramId, username: userData?.username });
    } else {
      // Update user info if provided
      if (userData) {
        user.username = userData.username || user.username;
        user.firstName = userData.firstName || user.firstName;
        user.lastName = userData.lastName || user.lastName;
        user.lastActiveAt = new Date();
        await user.save();
      }
    }
    
    return user;
  }
  
  /**
   * Check if a user can send a message
   */
  async checkQuota(telegramId: number): Promise<QuotaCheckResult> {
    const user = await this.getOrCreateUser(telegramId);
    
    if (user.isBanned) {
      return {
        allowed: false,
        reason: user.banReason || 'Votre compte a été suspendu.',
        user,
        remainingFreeMessages: 0,
        credits: user.credits,
        totalMessages: user.totalMessagesSent,
      };
    }
    
    const settings = await getSettings();
    
    if (settings.maintenanceMode && !user.isAdmin) {
      return {
        allowed: false,
        reason: '🔧 Le bot est en maintenance. Veuillez réessayer plus tard.',
        user,
        remainingFreeMessages: Math.max(0, user.freeMessagesLimit - user.freeMessagesUsed),
        credits: user.credits,
        totalMessages: user.totalMessagesSent,
      };
    }
    
    const canSend = user.canSendMessage();
    const remainingFree = Math.max(0, user.freeMessagesLimit - user.freeMessagesUsed);
    
    if (!canSend) {
      return {
        allowed: false,
        reason: this.getNoCreditsMessage(user),
        user,
        remainingFreeMessages: remainingFree,
        credits: user.credits,
        totalMessages: user.totalMessagesSent,
      };
    }
    
    return {
      allowed: true,
      user,
      remainingFreeMessages: remainingFree,
      credits: user.credits,
      totalMessages: user.totalMessagesSent,
    };
  }
  
  /**
   * Deduct a message from user's quota/credits
   */
  async deductMessage(
    telegramId: number,
    messageData?: {
      type: 'image' | 'text' | 'command';
      content?: string;
      homeTeam?: string;
      awayTeam?: string;
      competition?: string;
    }
  ): Promise<QuotaDeductResult> {
    const user = await this.getOrCreateUser(telegramId);
    
    if (!user.canSendMessage()) {
      return {
        success: false,
        wasFree: false,
        cost: 0,
        remainingFreeMessages: 0,
        remainingCredits: user.credits,
      };
    }
    
    const settings = await getSettings();
    const wasUsingFreeMessage = user.freeMessagesUsed < user.freeMessagesLimit;
    const cost = wasUsingFreeMessage ? 0 : settings.costPerMessage;
    
    // Deduct the message
    await user.deductMessage();
    
    // Log the message
    await Message.create({
      userId: user._id,
      telegramId,
      type: messageData?.type || 'text',
      content: messageData?.content,
      homeTeam: messageData?.homeTeam,
      awayTeam: messageData?.awayTeam,
      competition: messageData?.competition,
      wasFree: wasUsingFreeMessage,
      cost,
    });
    
    const remainingFree = Math.max(0, user.freeMessagesLimit - user.freeMessagesUsed);
    
    logger.info('Message deducted', {
      telegramId,
      wasFree: wasUsingFreeMessage,
      cost,
      remainingFree,
      remainingCredits: user.credits,
    });
    
    return {
      success: true,
      wasFree: wasUsingFreeMessage,
      cost,
      remainingFreeMessages: remainingFree,
      remainingCredits: user.credits,
    };
  }
  
  /**
   * Add credits to a user
   */
  async addCredits(telegramId: number, amount: number): Promise<IUser> {
    const user = await this.getOrCreateUser(telegramId);
    await user.addCredits(amount);
    
    logger.info('Credits added', { telegramId, amount, newBalance: user.credits });
    
    return user;
  }
  
  /**
   * Get user statistics
   */
  async getUserStats(telegramId: number) {
    const user = await this.getOrCreateUser(telegramId);
    const settings = await getSettings();
    
    const remainingFree = Math.max(0, user.freeMessagesLimit - user.freeMessagesUsed);
    const messagesWithCredits = user.credits; // 1 credit = 1 message
    
    return {
      user,
      remainingFreeMessages: remainingFree,
      remainingCredits: user.credits,
      messagesWithCredits,
      totalMessages: user.totalMessagesSent,
      totalSpent: user.totalSpent,
      isPremium: user.isPremium,
      premiumUntil: user.premiumUntil,
      costPerMessage: settings.costPerMessage,
    };
  }
  
  /**
   * Generate message when user has no credits
   */
  private getNoCreditsMessage(user: IUser): string {
    return `
❌ **Quota épuisé !**

Tu as utilisé tes ${user.freeMessagesLimit} analyses gratuites.

💳 **Pour continuer :**
• Achète des crédits avec /acheter
• 10 analyses = 1€
• 50 analyses = 4€ (Populaire ⭐)
• 100 analyses = 7€

Ou deviens Premium pour des analyses illimitées ! 👑
Tape /premium pour plus d'infos.
    `.trim();
  }
}

export const quotaService = new QuotaService();
