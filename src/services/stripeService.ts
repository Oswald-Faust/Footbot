import Stripe from 'stripe';
import { config } from '../config/index.js';
import { User, Payment, getSettings, IUser } from '../database/index.js';
import { logger } from '../utils/logger.js';
import { quotaService } from './quotaService.js';

const stripe = new Stripe(config.STRIPE_SECRET_KEY);

export interface CreatePaymentResult {
  success: boolean;
  paymentUrl?: string;
  error?: string;
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  messages: number;
  popular?: boolean;
}

class StripeService {
  /**
   * Get available credit packages
   * 1 crédit = 1 message
   */
  async getCreditPackages(): Promise<CreditPackage[]> {
    const settings = await getSettings();
    
    // Default packages in case database has invalid data
    const defaultPackages: CreditPackage[] = [
      { id: 'pack_10', name: '10 Messages', credits: 10, price: 100, messages: 10, popular: false },
      { id: 'pack_50', name: '50 Messages', credits: 50, price: 400, messages: 50, popular: true },
      { id: 'pack_100', name: '100 Messages', credits: 100, price: 700, messages: 100, popular: false },
      { id: 'pack_500', name: '500 Messages', credits: 500, price: 2500, messages: 500, popular: false },
    ];
    
    // Check if settings has valid packages
    if (!settings.creditPackages || settings.creditPackages.length === 0) {
      return defaultPackages;
    }
    
    // Validate each package has required fields
    const hasInvalidPackage = settings.creditPackages.some(pkg => 
      !pkg.id || !pkg.name || pkg.credits === undefined || pkg.price === undefined
    );
    
    if (hasInvalidPackage) {
      return defaultPackages;
    }
    
    return settings.creditPackages.map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      credits: pkg.credits,
      price: pkg.price,
      messages: pkg.credits, // 1 crédit = 1 message
      popular: pkg.popular || false,
    }));
  }
  
  /**
   * Create a Stripe customer for a user
   */
  async getOrCreateStripeCustomer(user: IUser): Promise<string> {
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }
    
    const customer = await stripe.customers.create({
      metadata: {
        telegramId: user.telegramId.toString(),
        username: user.username || '',
      },
    });
    
    user.stripeCustomerId = customer.id;
    await user.save();
    
    return customer.id;
  }
  
  /**
   * Create a checkout session for credits
   */
  async createCreditsCheckout(
    telegramId: number,
    packageId: string
  ): Promise<CreatePaymentResult> {
    try {
      const user = await quotaService.getOrCreateUser(telegramId);
      const settings = await getSettings();
      
      const pkg = settings.creditPackages.find(p => p.id === packageId);
      if (!pkg) {
        return { success: false, error: 'Package introuvable' };
      }
      
      const customerId = await this.getOrCreateStripeCustomer(user);
      const messages = pkg.credits; // 1 crédit = 1 message
      
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Cotybet - ${pkg.name}`,
              description: `${messages} analyses de match`,
            },
            unit_amount: pkg.price, // Already in centimes
          },
          quantity: 1,
        }],
        mode: 'payment',
        payment_intent_data: {
          setup_future_usage: 'on_session',
        },
        success_url: `${config.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.FRONTEND_URL}/cancel`,
        metadata: {
          telegramId: telegramId.toString(),
          packageId,
          credits: pkg.credits.toString(),
          type: 'credits',
        },
      });
      
      // Create pending payment record
      await Payment.create({
        userId: user._id,
        telegramId,
        stripePaymentIntentId: session.id,
        stripeCustomerId: customerId,
        amount: pkg.price,
        type: 'credits',
        status: 'pending',
        creditsAdded: pkg.credits,
        description: pkg.name,
      });
      
      return { success: true, paymentUrl: session.url! };
      
    } catch (error) {
      logger.error('Failed to create checkout session', { error, telegramId, packageId });
      return { success: false, error: 'Erreur lors de la création du paiement' };
    }
  }
  
  /**
   * Create a checkout session for premium subscription
   */
  async createPremiumCheckout(
    telegramId: number,
    plan: 'monthly' | 'yearly'
  ): Promise<CreatePaymentResult> {
    try {
      const user = await quotaService.getOrCreateUser(telegramId);
      const settings = await getSettings();
      
      if (!settings.premiumEnabled) {
        return { success: false, error: 'Les abonnements premium sont désactivés' };
      }
      
      const customerId = await this.getOrCreateStripeCustomer(user);
      const price = plan === 'monthly' ? settings.premiumMonthlyPrice : settings.premiumYearlyPrice;
      const periodLabel = plan === 'monthly' ? 'mensuel' : 'annuel';
      
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'eur',
            product_data: {
              name: `FootBot Premium ${periodLabel}`,
              description: 'Analyses illimitées',
            },
            unit_amount: price,
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${config.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.FRONTEND_URL}/cancel`,
        metadata: {
          telegramId: telegramId.toString(),
          plan,
          type: 'premium',
        },
      });
      
      // Create pending payment record
      await Payment.create({
        userId: user._id,
        telegramId,
        stripePaymentIntentId: session.id,
        stripeCustomerId: customerId,
        amount: price,
        type: 'premium',
        status: 'pending',
        description: `Premium ${plan === 'monthly' ? 'Mensuel' : 'Annuel'}`,
      });
      
      return { success: true, paymentUrl: session.url! };
      
    } catch (error) {
      logger.error('Failed to create premium checkout', { error, telegramId, plan });
      return { success: false, error: 'Erreur lors de la création du paiement' };
    }
  }
  
  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    let event: Stripe.Event;
    
    try {
      if (config.STRIPE_WEBHOOK_SECRET) {
        event = stripe.webhooks.constructEvent(payload, signature, config.STRIPE_WEBHOOK_SECRET);
      } else {
        event = JSON.parse(payload.toString()) as Stripe.Event;
      }
    } catch (error) {
      logger.error('Webhook signature verification failed', { error });
      throw error;
    }
    
    logger.info('Stripe webhook received', { type: event.type });
    
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
        
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
        
      default:
        logger.info('Unhandled webhook event', { type: event.type });
    }
  }
  
  /**
   * Handle completed checkout
   */
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const telegramId = parseInt(session.metadata?.telegramId || '0');
    const type = session.metadata?.type;
    
    if (!telegramId) {
      logger.error('No telegramId in session metadata', { sessionId: session.id });
      return;
    }
    
    const payment = await Payment.findOne({ stripePaymentIntentId: session.id });
    if (!payment) {
      logger.error('Payment not found', { sessionId: session.id });
      return;
    }
    
    const user = await User.findOne({ telegramId });
    if (!user) {
      logger.error('User not found', { telegramId });
      return;
    }
    
    if (type === 'credits') {
      // Add credits to user (1 crédit = 1 message)
      const credits = parseInt(session.metadata?.credits || '0');
      user.credits += credits;
      await user.save();
      
      payment.status = 'completed';
      await payment.save();
      
      logger.info('Credits added', { telegramId, credits });
      
    } else if (type === 'premium') {
      // Activate premium
      const plan = session.metadata?.plan as 'monthly' | 'yearly';
      const durationDays = plan === 'monthly' ? 30 : 365;
      const now = new Date();
      
      user.isPremium = true;
      user.premiumUntil = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
      await user.save();
      
      payment.status = 'completed';
      await payment.save();
      
      logger.info('Premium activated', { telegramId, plan, until: user.premiumUntil });
    }
  }
  
  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await Payment.findOne({ 
      stripePaymentIntentId: { $regex: paymentIntent.id } 
    });
    
    if (payment) {
      payment.status = 'failed';
      await payment.save();
      logger.info('Payment marked as failed', { paymentIntentId: paymentIntent.id });
    }
  }
}

export const stripeService = new StripeService();
