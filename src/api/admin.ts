import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { User, Message, Payment, getSettings, updateSettings } from '../database/index.js';
import { stripeService } from '../services/stripeService.js';

const app = express();

// Middleware - Enable CORS for all origins
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Raw body for Stripe webhooks
app.use('/api/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// ═══════════════════════════════════════════════════════════════
// Health Check
// ═══════════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════════════════
// Dashboard Stats
// ═══════════════════════════════════════════════════════════════

app.get('/api/stats', async (req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalMessages,
      totalRevenue,
      recentPayments,
      topUsers,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ lastActiveAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }),
      Message.countDocuments(),
      Payment.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Payment.find({ status: 'completed' })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('userId', 'telegramId username firstName lastName'),
      User.find()
        .sort({ totalSpent: -1 })
        .limit(10)
        .select('telegramId username firstName lastName totalSpent totalMessagesSent'),
    ]);

    // Messages per day (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const messagesPerDay = await Message.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Revenue per day (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const revenuePerDay = await Payment.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          amount: { $sum: '$amount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      totalUsers,
      activeUsers,
      totalMessages,
      totalRevenue: totalRevenue[0]?.total || 0,
      recentPayments,
      topUsers,
      messagesPerDay,
      revenuePerDay,
    });
  } catch (error) {
    logger.error('Failed to get stats', { error });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════════════════════════
// Users CRUD
// ═══════════════════════════════════════════════════════════════

app.get('/api/users', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const sortBy = req.query.sortBy as string || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const query: Record<string, unknown> = {};
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { telegramId: parseInt(search) || -1 },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(query),
    ]);

    res.json({
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error('Failed to get users', { error });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/api/users/:telegramId', async (req: Request, res: Response) => {
  try {
    const user = await User.findOne({ telegramId: parseInt(req.params.telegramId) });
    if (!user) {
      res.status(404).json({ error: 'Utilisateur non trouvé' });
      return;
    }

    const messages = await Message.find({ telegramId: user.telegramId })
      .sort({ createdAt: -1 })
      .limit(50);

    const payments = await Payment.find({ telegramId: user.telegramId })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ user, messages, payments });
  } catch (error) {
    logger.error('Failed to get user', { error, telegramId: req.params.telegramId });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.patch('/api/users/:telegramId', async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    const allowedUpdates = [
      'freeMessagesLimit',
      'freeMessagesUsed',
      'credits',
      'isPremium',
      'premiumUntil',
      'isAdmin',
      'isBanned',
      'banReason',
    ];

    const filteredUpdates: Record<string, unknown> = {};
    for (const key of Object.keys(updates)) {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    }

    const user = await User.findOneAndUpdate(
      { telegramId: parseInt(req.params.telegramId) },
      { $set: filteredUpdates },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ error: 'Utilisateur non trouvé' });
      return;
    }

    logger.info('User updated', { telegramId: req.params.telegramId, updates: filteredUpdates });
    res.json(user);
  } catch (error) {
    logger.error('Failed to update user', { error, telegramId: req.params.telegramId });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/users/:telegramId/add-credits', async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;
    const user = await User.findOne({ telegramId: parseInt(req.params.telegramId) });

    if (!user) {
      res.status(404).json({ error: 'Utilisateur non trouvé' });
      return;
    }

    user.credits += amount;
    await user.save();

    logger.info('Credits added manually', { telegramId: req.params.telegramId, amount });
    res.json(user);
  } catch (error) {
    logger.error('Failed to add credits', { error, telegramId: req.params.telegramId });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════════════════════════
// Settings
// ═══════════════════════════════════════════════════════════════

app.get('/api/settings', async (req: Request, res: Response) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (error) {
    logger.error('Failed to get settings', { error });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.patch('/api/settings', async (req: Request, res: Response) => {
  try {
    const settings = await updateSettings(req.body);
    logger.info('Settings updated', { updates: req.body });
    res.json(settings);
  } catch (error) {
    logger.error('Failed to update settings', { error });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════════════════════════
// Payments
// ═══════════════════════════════════════════════════════════════

app.get('/api/payments', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;

    const query: Record<string, unknown> = {};
    if (status) {
      query.status = status;
    }

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'telegramId username firstName lastName'),
      Payment.countDocuments(query),
    ]);

    res.json({
      payments,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error('Failed to get payments', { error });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════════════════════════
// Stripe Webhook
// ═══════════════════════════════════════════════════════════════

app.post('/api/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  try {
    await stripeService.handleWebhook(req.body, sig);
    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook error', { error });
    res.status(400).json({ error: 'Webhook error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// Public Routes (for Telegram bot payment links)
// ═══════════════════════════════════════════════════════════════

app.get('/api/packages', async (req: Request, res: Response) => {
  try {
    const packages = await stripeService.getCreditPackages();
    res.json(packages);
  } catch (error) {
    logger.error('Failed to get packages', { error });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/checkout/credits', async (req: Request, res: Response) => {
  try {
    const { telegramId, packageId } = req.body;
    const result = await stripeService.createCreditsCheckout(telegramId, packageId);
    res.json(result);
  } catch (error) {
    logger.error('Failed to create checkout', { error });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/checkout/premium', async (req: Request, res: Response) => {
  try {
    const { telegramId, plan } = req.body;
    const result = await stripeService.createPremiumCheckout(telegramId, plan);
    res.json(result);
  } catch (error) {
    logger.error('Failed to create premium checkout', { error });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════════

export function startAPI(): void {
  app.listen(config.PORT, () => {
    logger.info(`🚀 API Server running on port ${config.PORT}`);
  });
}

export { app };
