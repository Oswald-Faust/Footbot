import { Telegraf, Context, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { matchAnalyzer } from '../analysis/analyzer.js';
import axios from 'axios';
import { MatchReport } from '../models/types.js';
import { quotaService } from '../services/quotaService.js';
import { stripeService } from '../services/stripeService.js';
import { User, getSettings, updateSettings, InviteCode } from '../database/index.js';

// Custom context with session data
interface BotContext extends Context {
  session?: {
    lastMatch?: {
      home: string;
      away: string;
      competition?: string;
    };
    lastReport?: MatchReport;
    awaitingCorrection?: boolean;
  };
}

// Create bot instance
const bot = new Telegraf<BotContext>(config.TELEGRAM_BOT_TOKEN);

// Simple in-memory session storage
const sessions: Map<number, BotContext['session']> = new Map();

// Middleware to add session
bot.use((ctx, next) => {
  const userId = ctx.from?.id;
  if (userId) {
    if (!sessions.has(userId)) {
      sessions.set(userId, {});
    }
    ctx.session = sessions.get(userId)!;
  }
  return next();
});

// Error handling middleware
bot.catch((err, ctx) => {
  logger.error('Bot error', { error: err, update: ctx.update });
  ctx.reply('❌ Une erreur est survenue. Veuillez réessayer.').catch(() => {});
});

// Access Control Middleware
bot.use(async (ctx, next) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return next();

  const settings = await getSettings();
  if (!settings.privateMode) return next();

  // Allow admins to bypass
  const user = await User.findOne({ telegramId });
  if (user?.isAdmin || user?.isAuthorized) return next();

  // Allow /start with code
  if (ctx.message && 'text' in ctx.message && ctx.message.text.startsWith('/start ')) {
    return next();
  }

  // Allow /start without code ONLY to show the "enter code" message (handled in command)
  if (ctx.message && 'text' in ctx.message && ctx.message.text === '/start') {
    return next();
  }

  // Allow /code command
  if (ctx.message && 'text' in ctx.message && ctx.message.text.startsWith('/code')) {
    return next();
  }
  
  // Block everything else
  await ctx.reply('🔒 Ce bot est privé.\n\n🔑 Pour entrer, tapez `/code VOTRE_CODE`\n\nOu utilisez le lien d\'invitation reçu.', { parse_mode: 'Markdown' });
});

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

async function checkUserQuota(ctx: Context): Promise<boolean> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return false;
  
  const result = await quotaService.checkQuota(telegramId);
  
  if (!result.allowed) {
    await ctx.reply(result.reason || '❌ Quota épuisé', { parse_mode: 'Markdown' });
    return false;
  }
  
  return true;
}

async function deductUserMessage(
  ctx: Context,
  type: 'image' | 'text' | 'command',
  matchInfo?: { homeTeam?: string; awayTeam?: string; competition?: string }
) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  
  await quotaService.deductMessage(telegramId, {
    type,
    homeTeam: matchInfo?.homeTeam,
    awayTeam: matchInfo?.awayTeam,
    competition: matchInfo?.competition,
  });
}

function getQuotaStatusMessage(remainingFree: number, credits: number, costPerMessage: number): string {
  const messagesWithCredits = Math.floor(credits / costPerMessage);
  
  if (remainingFree > 0) {
    return `\n\n📊 _Messages gratuits restants: ${remainingFree}_`;
  } else if (messagesWithCredits > 0) {
    return `\n\n💰 _Crédits restants: ${messagesWithCredits} analyses_`;
  }
  return '';
}

// ═══════════════════════════════════════════════════════════════
// Commands
// ═══════════════════════════════════════════════════════════════

bot.command('code', async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const args = ctx.message.text.split(' ');
  const code = args[1]; // /code <code>

  if (!code) {
    await ctx.reply('❌ Usage: `/code VOTRE_CODE`', { parse_mode: 'Markdown' });
    return;
  }

  const settings = await getSettings();
  
  if (!settings.privateMode) {
    await ctx.reply('🔓 Le bot est public, vous n\'avez pas besoin de code.');
    return;
  }

  const user = await quotaService.getOrCreateUser(telegramId);
  
  if (user.isAuthorized) {
    await ctx.reply('✅ Vous avez déjà accès au bot.');
    return;
  }

  // Check InviteCode model
  const invite = await InviteCode.findOne({ code });

  if (invite) {
    // Check if used
    if (invite.type === 'one_time' && invite.isUsed) {
      await ctx.reply('❌ Ce code d\'invitation a déjà été utilisé.');
      return;
    }

    // Mark as used if one-time
    if (invite.type === 'one_time') {
      invite.isUsed = true;
      invite.usedBy = telegramId;
      invite.usedAt = new Date();
      await invite.save();
    }

    // Authorize user
    user.isAuthorized = true;
    await user.save();
    await ctx.reply('✅ Accès autorisé ! Bienvenue sur Cotybet ⚽\n\nTapez /start pour commencer ou envoyez directement une photo de match !');
  } else {
    // Fallback to old settings method (for backward compatibility during migration) or fail
    if (settings.accessCodes.includes(code)) {
       // Authorize user (legacy)
      user.isAuthorized = true;
      await user.save();
      await ctx.reply('✅ Accès autorisé ! Bienvenue sur FootBot ⚽');
    } else {
      await ctx.reply('❌ Code invalide.');
    }
  }
});

bot.command('start', async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  
  const args = ctx.message.text.split(' ');
  const inviteCode = args[1]; // /start <code>
  
  const settings = await getSettings();
  
  // Register user
  const user = await quotaService.getOrCreateUser(telegramId, {
    username: ctx.from?.username,
    firstName: ctx.from?.first_name,
    lastName: ctx.from?.last_name,
  });
  
  // Handle Private Mode
  if (settings.privateMode && !user.isAuthorized && !user.isAdmin) {
    if (inviteCode) {
      // Check InviteCode model
      const invite = await InviteCode.findOne({ code: inviteCode });
      
      if (invite) {
        if (invite.type === 'one_time' && invite.isUsed) {
          await ctx.reply('🔒 Ce code d\'invitation a déjà été utilisé.');
          return;
        }

        if (invite.type === 'one_time') {
          invite.isUsed = true;
          invite.usedBy = telegramId;
          invite.usedAt = new Date();
          await invite.save();
        }

        user.isAuthorized = true;
        await user.save();
        await ctx.reply('✅ Accès autorisé ! Bienvenue.');
      } else if (settings.accessCodes.includes(inviteCode)) {
        // Legacy check
        user.isAuthorized = true;
        await user.save();
        await ctx.reply('✅ Accès autorisé ! Bienvenue.');
      } else {
        await ctx.reply('🔒 Ce bot est privé. Le code d\'invitation est invalide.');
        return;
      }
    } else {
      await ctx.reply('🔒 Ce bot est privé. Le code d\'invitation est invalide ou manquant.');
      return;
    }
  }
  
  const stats = await quotaService.getUserStats(telegramId);
  
  const welcomeMessage = `
⚽ **Bienvenue sur FootBot !** 🤖

Je suis ton assistant IA pour l'analyse de matchs de football.

**Comment m'utiliser :**
1️⃣ Envoie-moi un **screenshot** d'un match (pré-match de préférence)
2️⃣ J'analyse automatiquement les équipes, la compétition, les cotes
3️⃣ Je te fournis une analyse complète avec probabilités et suggestions de paris

**Commandes disponibles :**
• /help - Afficher l'aide
• /analyze \\[équipe1\\] vs \\[équipe2\\] - Analyse manuelle
• /compte - Voir ton compte et crédits
• /acheter - Acheter des crédits
• /premium - Passer Premium

**Compétitions supportées :**
🇫🇷 Ligue 1 | 🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League | 🇪🇸 La Liga
🇩🇪 Bundesliga | 🇮🇹 Serie A | 🏆 Champions League

🎁 **Tu as ${stats.remainingFreeMessages} analyses gratuites !**

📸 **Envoie-moi un screenshot pour commencer !**
  `;
  
  await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
});

bot.command('help', async (ctx) => {
  const helpMessage = `
📖 **Guide d'utilisation FootBot**

**🖼️ Analyse par screenshot :**
Envoie simplement une image d'un match depuis ton application de paris.
Je détecte automatiquement :
• Les équipes
• La compétition
• La date/heure
• Les cotes (si visibles)

**✍️ Analyse manuelle :**
\`/analyze PSG vs Marseille\`
\`/analyze Barcelona vs Real Madrid\`

**📊 Ce que j'analyse :**
• Forme récente (5-10 derniers matchs)
• Avantage domicile
• Blessures et suspensions
• Conditions météo
• Fatigue/calendrier chargé
• Confrontations directes
• Enjeux du match

**💳 Commandes compte :**
• /compte - Voir tes crédits
• /acheter - Acheter des analyses
• /premium - Abonnement illimité

**💡 Conseils :**
• Utilise des screenshots clairs et lisibles
• Les matchs pré-match donnent de meilleurs résultats
• Les grandes compétitions ont plus de données

**⚠️ Rappel :** 
Les paris comportent des risques. Joue de manière responsable.
  `;
  
  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
});

// ═══════════════════════════════════════════════════════════════
// Account & Payment Commands
// ═══════════════════════════════════════════════════════════════

bot.command('compte', async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  
  const stats = await quotaService.getUserStats(telegramId);
  const settings = await getSettings();
  
  let premiumStatus = '❌ Non abonné';
  if (stats.isPremium && stats.premiumUntil) {
    const daysLeft = Math.ceil((stats.premiumUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    premiumStatus = `👑 Premium (${daysLeft} jours restants)`;
  }
  
  const message = `
👤 **Mon Compte FootBot**

📊 **Statistiques :**
• Analyses effectuées : ${stats.totalMessages}
• Dépenses totales : ${(stats.totalSpent / 100).toFixed(2)}€

🎁 **Messages gratuits :**
• Restants : ${stats.remainingFreeMessages}/${stats.user.freeMessagesLimit}

💰 **Crédits :**
• Solde : ${stats.remainingCredits} centimes
• Équivalent : ${stats.messagesWithCredits} analyses
• Coût par analyse : ${settings.costPerMessage} centimes

👑 **Premium :**
• Statut : ${premiumStatus}

📦 Utilise /acheter pour recharger ton compte !
  `;
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
});

bot.command('acheter', async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const loadingMsg = await ctx.reply('🔄 Chargement des offres personnalisées...', { parse_mode: 'Markdown' });

  try {
    const packages = await stripeService.getCreditPackages();
    
    // Pre-generate payment links for all packages in parallel
    const packagesWithLinks = await Promise.all(packages.map(async (pkg) => {
      const result = await stripeService.createCreditsCheckout(telegramId, pkg.id);
      return { ...pkg, paymentUrl: result.paymentUrl };
    }));
    
    let message = `
💳 **Acheter des analyses**

Choisis un pack de crédits :

`;
    
    packages.forEach(pkg => {
      const popularBadge = pkg.popular ? ' ⭐ Populaire' : '';
      message += `**+${pkg.credits} Analyses** - ${(pkg.price / 100).toFixed(2)}€${popularBadge}\n\n`;
    });
    
    
    const buttons = packagesWithLinks.map(pkg => {
      const label = `+${pkg.credits} Analyses - ${(pkg.price / 100).toFixed(2)}€`;
      // Must use standard URL button because Stripe blocks embedding in Web Apps
      return pkg.paymentUrl 
        ? [Markup.button.url(label, pkg.paymentUrl)]
        : [Markup.button.callback(label, `buy:${pkg.id}`)];
    });
    
    buttons.push([Markup.button.callback('👑 Passer Premium', 'premium_info')]);
    
    // Delete loading message and send offers
    if (ctx.chat) {
      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
    }
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons),
    });

  } catch (error) {
    if (ctx.chat) {
      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
    }
    await ctx.reply('❌ Erreur lors du chargement des offres. Réessaie plus tard.');
  }
});

bot.command('premium', async (ctx) => {
  const settings = await getSettings();
  
  if (!settings.premiumEnabled) {
    await ctx.reply('❌ Les abonnements Premium sont actuellement désactivés.');
    return;
  }
  
  const monthlyPrice = (settings.premiumMonthlyPrice / 100).toFixed(2);
  const yearlyPrice = (settings.premiumYearlyPrice / 100).toFixed(2);
  const yearlySavings = ((settings.premiumMonthlyPrice * 12 - settings.premiumYearlyPrice) / 100).toFixed(2);
  
  const message = `
👑 **FootBot Premium**

Analyses illimitées, sans compter tes crédits !

**📅 Mensuel : ${monthlyPrice}€/mois**
• Analyses illimitées
• Support prioritaire
• Accès aux nouvelles fonctionnalités

**📅 Annuel : ${yearlyPrice}€/an**
• Tout le mensuel
• Économise ${yearlySavings}€

_Clique sur un bouton pour t'abonner :_
  `;
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback(`📅 Mensuel - ${monthlyPrice}€`, 'premium:monthly')],
      [Markup.button.callback(`📅 Annuel - ${yearlyPrice}€ (-${yearlySavings}€)`, 'premium:yearly')],
    ]),
  });
});

// ═══════════════════════════════════════════════════════════════
// Payment Callbacks
// ═══════════════════════════════════════════════════════════════

bot.action(/^buy:(.+)$/, async (ctx) => {
  const packageId = ctx.match[1];
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  
  await ctx.answerCbQuery('💳 Création du paiement...');
  
  const result = await stripeService.createCreditsCheckout(telegramId, packageId);
  
  if (result.success && result.paymentUrl) {
    // Muse use standard URL button
    await ctx.reply(
      `💳 **Paiement**\n\nClique sur le bouton ci-dessous pour finaliser ton achat :`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.url('💳 Payer maintenant', result.paymentUrl)],
        ]),
      }
    );
  } else {
    await ctx.reply(`❌ ${result.error || 'Erreur lors de la création du paiement'}`);
  }
});

bot.action(/^premium:(.+)$/, async (ctx) => {
  const plan = ctx.match[1] as 'monthly' | 'yearly';
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  
  await ctx.answerCbQuery('💳 Création du paiement...');
  
  const result = await stripeService.createPremiumCheckout(telegramId, plan);
  
  if (result.success && result.paymentUrl) {
    await ctx.reply(
      `👑 **Premium ${plan === 'monthly' ? 'Mensuel' : 'Annuel'}**\n\nClique sur le bouton ci-dessous pour finaliser ton abonnement :`,
      { 
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.url('👑 S\'abonner maintenant', result.paymentUrl)],
        ]),
      }
    );
  } else {
    await ctx.reply(`❌ ${result.error || 'Erreur lors de la création du paiement'}`);
  }
});

bot.action('premium_info', async (ctx) => {
  await ctx.answerCbQuery();
  
  // Just trigger the premium info message directly
  const settings = await getSettings();
  
  if (!settings.premiumEnabled) {
    await ctx.reply('❌ Les abonnements Premium sont actuellement désactivés.');
    return;
  }
  
  const monthlyPrice = (settings.premiumMonthlyPrice / 100).toFixed(2);
  const yearlyPrice = (settings.premiumYearlyPrice / 100).toFixed(2);
  const yearlySavings = ((settings.premiumMonthlyPrice * 12 - settings.premiumYearlyPrice) / 100).toFixed(2);
  
  const message = `
👑 **FootBot Premium**

Analyses illimitées, sans compter tes crédits !

**📅 Mensuel : ${monthlyPrice}€/mois**
• Analyses illimitées
• Support prioritaire
• Accès aux nouvelles fonctionnalités

**📅 Annuel : ${yearlyPrice}€/an**
• Tout le mensuel
• Économise ${yearlySavings}€

_Clique sur un bouton pour t'abonner :_
  `;
  
  // Pre-generate checkout sessions
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  
  // Show loading while generating links
  const loadingMsg = await ctx.reply('🔄 Chargement des offres Premium...', { parse_mode: 'Markdown' });

  try {
    const [monthlyLink, yearlyLink] = await Promise.all([
      stripeService.createPremiumCheckout(telegramId, 'monthly'),
      stripeService.createPremiumCheckout(telegramId, 'yearly')
    ]);

    // Delete loading message
    if (ctx.chat) {
      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
    }
    
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          monthlyLink.success && monthlyLink.paymentUrl 
            ? Markup.button.url(`📅 Mensuel - ${monthlyPrice}€`, monthlyLink.paymentUrl)
            : Markup.button.callback(`📅 Mensuel - ${monthlyPrice}€`, 'premium:monthly')
        ],
        [
          yearlyLink.success && yearlyLink.paymentUrl
            ? Markup.button.url(`📅 Annuel - ${yearlyPrice}€ (-${yearlySavings}€)`, yearlyLink.paymentUrl)
            : Markup.button.callback(`📅 Annuel - ${yearlyPrice}€ (-${yearlySavings}€)`, 'premium:yearly')
        ],
      ]),
    });
  } catch (error) {
    if (ctx.chat) {
      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
    }
    await ctx.reply('❌ Erreur lors du chargement des offres Premium.');
  }
});

// ═══════════════════════════════════════════════════════════════
// Admin Commands (Telegram)
// ═══════════════════════════════════════════════════════════════

bot.command('admin', async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  
  const user = await User.findOne({ telegramId });
  if (!user?.isAdmin) {
    await ctx.reply('❌ Accès refusé');
    return;
  }
  
  const message = `
🔧 **Panneau Admin FootBot**

**Commandes disponibles :**
• /admin\\_stats - Statistiques globales
• /admin\\_user \\[telegramId\\] - Infos utilisateur
• /admin\\_credits \\[telegramId\\] \\[amount\\] - Ajouter crédits
• /admin\\_ban \\[telegramId\\] - Bannir utilisateur
• /admin\\_unban \\[telegramId\\] - Débannir
• /admin\\_maintenance - Toggle maintenance
• /admin\\_setfree \\[nombre\\] - Changer limite gratuite

🖥️ Dashboard web : ${config.FRONTEND_URL}/admin
  `;
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
});

bot.command('admin_stats', async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  
  const user = await User.findOne({ telegramId });
  if (!user?.isAdmin) {
    await ctx.reply('❌ Accès refusé');
    return;
  }
  
  const [totalUsers, totalMessages, revenueResult] = await Promise.all([
    User.countDocuments(),
    (await import('../database/models/Message.js')).Message.countDocuments(),
    (await import('../database/models/Payment.js')).Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);
  
  const revenue = revenueResult[0]?.total || 0;
  
  const message = `
📊 **Statistiques FootBot**

👥 Utilisateurs : ${totalUsers}
📨 Messages : ${totalMessages}
💰 Revenus : ${(revenue / 100).toFixed(2)}€
  `;
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
});

bot.command('admin_user', async (ctx) => {
  const adminId = ctx.from?.id;
  if (!adminId) return;
  
  const admin = await User.findOne({ telegramId: adminId });
  if (!admin?.isAdmin) {
    await ctx.reply('❌ Accès refusé');
    return;
  }
  
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    await ctx.reply('Usage: /admin\\_user [telegramId]', { parse_mode: 'Markdown' });
    return;
  }
  
  const targetId = parseInt(args[1]);
  const user = await User.findOne({ telegramId: targetId });
  
  if (!user) {
    await ctx.reply('❌ Utilisateur non trouvé');
    return;
  }
  
  const message = `
👤 **Utilisateur ${user.telegramId}**

📝 Username : @${user.username || 'N/A'}
👤 Nom : ${user.firstName || ''} ${user.lastName || ''}

📊 **Statistiques :**
• Messages : ${user.totalMessagesSent}
• Gratuits utilisés : ${user.freeMessagesUsed}/${user.freeMessagesLimit}
• Crédits : ${user.credits}
• Dépenses : ${(user.totalSpent / 100).toFixed(2)}€

👑 Premium : ${user.isPremium ? 'Oui' : 'Non'}
🚫 Banni : ${user.isBanned ? 'Oui' : 'Non'}
⚙️ Admin : ${user.isAdmin ? 'Oui' : 'Non'}

📅 Inscrit : ${user.createdAt.toLocaleDateString()}
🕐 Dernière activité : ${user.lastActiveAt.toLocaleDateString()}
  `;
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
});

bot.command('admin_credits', async (ctx) => {
  const adminId = ctx.from?.id;
  if (!adminId) return;
  
  const admin = await User.findOne({ telegramId: adminId });
  if (!admin?.isAdmin) {
    await ctx.reply('❌ Accès refusé');
    return;
  }
  
  const args = ctx.message.text.split(' ');
  if (args.length < 3) {
    await ctx.reply('Usage: /admin\\_credits [telegramId] [amount]', { parse_mode: 'Markdown' });
    return;
  }
  
  const targetId = parseInt(args[1]);
  const amount = parseFloat(args[2]);
  
  const user = await User.findOne({ telegramId: targetId });
  if (!user) {
    await ctx.reply('❌ Utilisateur non trouvé');
    return;
  }
  
  user.credits += amount;
  await user.save();
  
  await ctx.reply(`✅ ${amount} crédits ajoutés à l'utilisateur ${targetId}. Nouveau solde : ${user.credits}`);
});

bot.command('admin_ban', async (ctx) => {
  const adminId = ctx.from?.id;
  if (!adminId) return;
  
  const admin = await User.findOne({ telegramId: adminId });
  if (!admin?.isAdmin) {
    await ctx.reply('❌ Accès refusé');
    return;
  }
  
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    await ctx.reply('Usage: /admin\\_ban [telegramId]', { parse_mode: 'Markdown' });
    return;
  }
  
  const targetId = parseInt(args[1]);
  const reason = args.slice(2).join(' ') || 'Aucune raison spécifiée';
  
  const user = await User.findOneAndUpdate(
    { telegramId: targetId },
    { isBanned: true, banReason: reason },
    { new: true }
  );
  
  if (!user) {
    await ctx.reply('❌ Utilisateur non trouvé');
    return;
  }
  
  await ctx.reply(`🚫 Utilisateur ${targetId} banni. Raison : ${reason}`);
});

bot.command('admin_unban', async (ctx) => {
  const adminId = ctx.from?.id;
  if (!adminId) return;
  
  const admin = await User.findOne({ telegramId: adminId });
  if (!admin?.isAdmin) {
    await ctx.reply('❌ Accès refusé');
    return;
  }
  
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    await ctx.reply('Usage: /admin\\_unban [telegramId]', { parse_mode: 'Markdown' });
    return;
  }
  
  const targetId = parseInt(args[1]);
  
  const user = await User.findOneAndUpdate(
    { telegramId: targetId },
    { isBanned: false, banReason: undefined },
    { new: true }
  );
  
  if (!user) {
    await ctx.reply('❌ Utilisateur non trouvé');
    return;
  }
  
  await ctx.reply(`✅ Utilisateur ${targetId} débanni`);
});

bot.command('admin_maintenance', async (ctx) => {
  const adminId = ctx.from?.id;
  if (!adminId) return;
  
  const admin = await User.findOne({ telegramId: adminId });
  if (!admin?.isAdmin) {
    await ctx.reply('❌ Accès refusé');
    return;
  }
  
  const settings = await getSettings();
  const newMode = !settings.maintenanceMode;
  await updateSettings({ maintenanceMode: newMode });
  
  await ctx.reply(`🔧 Mode maintenance : ${newMode ? '✅ Activé' : '❌ Désactivé'}`);
});

bot.command('admin_setfree', async (ctx) => {
  const adminId = ctx.from?.id;
  if (!adminId) return;
  
  const admin = await User.findOne({ telegramId: adminId });
  if (!admin?.isAdmin) {
    await ctx.reply('❌ Accès refusé');
    return;
  }
  
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    await ctx.reply('Usage: /admin\\_setfree [nombre]', { parse_mode: 'Markdown' });
    return;
  }
  
  const limit = parseInt(args[1]);
  await updateSettings({ freeMessagesLimit: limit });
  
  await ctx.reply(`✅ Limite de messages gratuits changée à ${limit}`);
});

bot.command('admin_private', async (ctx) => {
  const adminId = ctx.from?.id;
  if (!adminId) return;
  
  const admin = await User.findOne({ telegramId: adminId });
  if (!admin?.isAdmin) {
    await ctx.reply('❌ Accès refusé');
    return;
  }
  
  const settings = await getSettings();
  const newMode = !settings.privateMode;
  await updateSettings({ privateMode: newMode });
  
  await ctx.reply(`🔒 Mode privé : ${newMode ? '✅ Activé' : '❌ Désactivé'}`);
});

bot.command('admin_invite', async (ctx) => {
  const adminId = ctx.from?.id;
  if (!adminId) return;
  
  const admin = await User.findOne({ telegramId: adminId });
  if (!admin?.isAdmin) {
    await ctx.reply('❌ Accès refusé');
    return;
  }
  
  const args = ctx.message.text.split(' ');
  const action = args[1]; // add, list, remove
  const code = args[2];
  
  const settings = await getSettings();
  const codes = settings.accessCodes || [];
  
  if (action === 'add' && code) {
    if (!codes.includes(code)) {
      codes.push(code);
      await updateSettings({ accessCodes: codes });
      await ctx.reply(`✅ Code d'invitation ajouté : \`${code}\``, { parse_mode: 'Markdown' });
    } else {
      await ctx.reply('❌ Ce code existe déjà');
    }
  } else if (action === 'remove' && code) {
    const newCodes = codes.filter(c => c !== code);
    await updateSettings({ accessCodes: newCodes });
    await ctx.reply(`🗑️ Code supprimé : ${code}`);
  } else if (action === 'list') {
    const list = codes.length > 0 ? codes.map(c => `• \`${c}\``).join('\n') : 'Aucun code';
    await ctx.reply(`📝 **Codes d'invitation :**\n\n${list}`, { parse_mode: 'Markdown' });
  } else {
    await ctx.reply(
      'Usage:\n/admin\\_invite add [code]\n/admin\\_invite remove [code]\n/admin\\_invite list',
      { parse_mode: 'Markdown' }
    );
  }
});

// ═══════════════════════════════════════════════════════════════
// Analyze Command
// ═══════════════════════════════════════════════════════════════

bot.command('analyze', async (ctx) => {
  const text = ctx.message.text.replace('/analyze', '').trim();
  const telegramId = ctx.from?.id;
  
  if (!telegramId) return;
  
  if (!text) {
    await ctx.reply(
      '❌ Utilisation: `/analyze Équipe1 vs Équipe2`\n\nExemple: `/analyze PSG vs Marseille`',
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  // Parse teams
  const vsMatch = text.match(/(.+?)\s+(?:vs\.?|contre|-)\s+(.+)/i);
  if (!vsMatch) {
    await ctx.reply(
      '❌ Format invalide. Utilise: `/analyze Équipe1 vs Équipe2`',
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  // Check quota
  if (!(await checkUserQuota(ctx))) return;
  
  const homeTeam = vsMatch[1].trim();
  const awayTeam = vsMatch[2].trim();
  
  // Send processing message
  const processingMsg = await ctx.reply(
    `⏳ Analyse en cours...\n\n🏠 **${homeTeam}**\n✈️ **${awayTeam}**\n\n🔍 Récupération des données...`,
    { parse_mode: 'Markdown' }
  );
  
  try {
    const { report, telegramMessage } = await matchAnalyzer.analyzeMatch(homeTeam, awayTeam);
    
    // Deduct message
    await deductUserMessage(ctx, 'command', { homeTeam, awayTeam });
    const stats = await quotaService.getUserStats(telegramId);
    const settings = await getSettings();
    const quotaStatus = getQuotaStatusMessage(stats.remainingFreeMessages, stats.remainingCredits, settings.costPerMessage);
    
    // Delete processing message
    await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});
    
    // Send analysis result
    await ctx.reply(telegramMessage + quotaStatus, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('🔄 Relancer', `reanalyze:${homeTeam}:${awayTeam}`),
          Markup.button.callback('📊 Plus de détails', `details:${homeTeam}:${awayTeam}`),
        ],
        [
          Markup.button.callback('💰 Paris uniquement', `bets:${homeTeam}:${awayTeam}`),
        ],
      ]),
    });
    
    // Save to session
    if (ctx.session) {
      ctx.session.lastMatch = { home: homeTeam, away: awayTeam };
      ctx.session.lastReport = report;
    }
  } catch (error) {
    logger.error('Manual analysis failed', { error, homeTeam, awayTeam });
    
    await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});
    
    await ctx.reply(
      `❌ Erreur lors de l'analyse.\n\nVérifie les noms des équipes et réessaie.\n\n💡 Conseil: Utilise les noms complets (ex: "Paris Saint-Germain" au lieu de "PSG")`,
      { parse_mode: 'Markdown' }
    );
  }
});

// ═══════════════════════════════════════════════════════════════
// Photo Handler - Main feature
// ═══════════════════════════════════════════════════════════════

bot.on(message('photo'), async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  
  logger.info('Photo received', { userId: telegramId, chatId: ctx.chat.id });
  
  // Check quota BEFORE processing
  if (!(await checkUserQuota(ctx))) return;
  
  // Get the highest resolution photo
  const photos = ctx.message.photo;
  const photo = photos[photos.length - 1];
  
  // Send processing message
  const processingMsg = await ctx.reply(
    '📸 Image reçue !\n\n⏳ Analyse en cours...\n\n🔍 Détection du match...',
    Markup.removeKeyboard()
  );
  
  try {
    // Get file from Telegram
    const file = await ctx.telegram.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${config.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    
    // Download image
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data);
    
    // Determine mime type
    const filePath = file.file_path || '';
    let mimeType = 'image/jpeg';
    if (filePath.endsWith('.png')) mimeType = 'image/png';
    else if (filePath.endsWith('.webp')) mimeType = 'image/webp';
    
    // Update processing message (ignore errors - message might have been deleted)
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      processingMsg.message_id,
      undefined,
      '📸 Image reçue !\n\n⏳ Analyse en cours...\n\n🤖 Extraction des informations...'
    ).catch(() => {});
    
    // Analyze the image
    const { report, telegramMessage, matchCandidate } = await matchAnalyzer.analyzeFromImage(imageBuffer, mimeType);
    
    // Deduct message AFTER successful analysis
    await deductUserMessage(ctx, 'image', {
      homeTeam: matchCandidate.teamHome,
      awayTeam: matchCandidate.teamAway,
      competition: matchCandidate.competition || undefined,
    });
    
    const stats = await quotaService.getUserStats(telegramId);
    const settings = await getSettings();
    const quotaStatus = getQuotaStatusMessage(stats.remainingFreeMessages, stats.remainingCredits, settings.costPerMessage);
    
    // Delete processing message
    await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});
    
    // Build confidence indicator
    const confidenceEmoji = matchCandidate.ocrConfidence >= 80 ? '🟢' : 
                            matchCandidate.ocrConfidence >= 50 ? '🟡' : '🔴';
    
    // Build inline keyboard
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('🔄 Relancer', `reanalyze:${matchCandidate.teamHome}:${matchCandidate.teamAway}`),
        Markup.button.callback('📊 Plus de détails', `details:${matchCandidate.teamHome}:${matchCandidate.teamAway}`),
      ],
      [
        Markup.button.callback('💰 Paris uniquement', `bets:${matchCandidate.teamHome}:${matchCandidate.teamAway}`),
        Markup.button.callback('✏️ Corriger équipes', `correct:${matchCandidate.teamHome}:${matchCandidate.teamAway}`),
      ],
    ]);
    
    // Add confidence notice if low
    let message = telegramMessage;
    if (matchCandidate.ocrConfidence < 70) {
      message = `${confidenceEmoji} **Confiance OCR: ${matchCandidate.ocrConfidence}%**\n_Si le match détecté est incorrect, utilise le bouton "Corriger équipes"_\n\n${telegramMessage}`;
    }
    
    // Send the analysis
    await ctx.reply(message + quotaStatus, {
      parse_mode: 'Markdown',
      ...keyboard,
    });
    
    // Save to session
    if (ctx.session) {
      ctx.session.lastMatch = {
        home: matchCandidate.teamHome,
        away: matchCandidate.teamAway,
        competition: matchCandidate.competition || undefined,
      };
      ctx.session.lastReport = report;
    }
    
    logger.info('Analysis sent successfully', {
      home: matchCandidate.teamHome,
      away: matchCandidate.teamAway,
      confidence: matchCandidate.ocrConfidence,
    });
    
  } catch (error) {
    logger.error('Photo analysis failed', { error });
    
    // Delete processing message
    await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});
    
    await ctx.reply(
      '❌ Erreur lors de l\'analyse de l\'image.\n\n' +
      '**Causes possibles :**\n' +
      '• Image trop floue ou illisible\n' +
      '• Format d\'image non supporté\n' +
      '• Erreur temporaire du service\n\n' +
      '💡 Essaie avec un screenshot plus clair ou utilise `/analyze Équipe1 vs Équipe2`',
      { parse_mode: 'Markdown' }
    );
  }
});

// ═══════════════════════════════════════════════════════════════
// Callback Query Handlers
// ═══════════════════════════════════════════════════════════════

// Re-analyze button
bot.action(/^reanalyze:(.+):(.+)$/, async (ctx) => {
  const match = ctx.match;
  const homeTeam = match[1];
  const awayTeam = match[2];
  const telegramId = ctx.from?.id;
  
  if (!telegramId) return;
  
  // Check quota
  const quotaCheck = await quotaService.checkQuota(telegramId);
  if (!quotaCheck.allowed) {
    await ctx.answerCbQuery('❌ Quota épuisé');
    await ctx.reply(quotaCheck.reason || '❌ Quota épuisé', { parse_mode: 'Markdown' });
    return;
  }
  
  await ctx.answerCbQuery('🔄 Relance de l\'analyse...');
  
  await ctx.reply('⏳ Nouvelle analyse en cours...');
  
  try {
    const { report, telegramMessage } = await matchAnalyzer.analyzeMatch(homeTeam, awayTeam);
    
    // Deduct message
    await deductUserMessage({ from: { id: telegramId } } as Context, 'command', { homeTeam, awayTeam });
    const stats = await quotaService.getUserStats(telegramId);
    const settings = await getSettings();
    const quotaStatus = getQuotaStatusMessage(stats.remainingFreeMessages, stats.remainingCredits, settings.costPerMessage);
    
    await ctx.reply(telegramMessage + quotaStatus, { parse_mode: 'Markdown' });

    // Update session with new report
    if (ctx.session) {
        ctx.session.lastReport = report;
    }

  } catch (error) {
    logger.error('Re-analysis failed', { error, homeTeam, awayTeam });
    await ctx.reply('❌ Erreur lors de la relance de l\'analyse.');
  }
});

// Details button (free, doesn't cost)
bot.action(/^details:(.+):(.+)$/, async (ctx) => {
  await ctx.answerCbQuery('📊 Voir les détails complets');
  
  // Check if session has the last match data
  const session = ctx.session;
  if (!session?.lastMatch) {
    await ctx.reply('❌ Aucune analyse récente trouvée. Veuillez relancer une analyse.');
    return;
  }

  const { home, away } = session.lastMatch;

  await ctx.reply(`⏳ Récupération des détails pour ${home} vs ${away}...`);

  try {
     const { telegramMessage } = await matchAnalyzer.analyzeMatchDocs(home, away);
     await ctx.reply(telegramMessage, { parse_mode: 'Markdown' });
  } catch (error) {
     logger.error('Details retrieval failed', { error });
     await ctx.reply('❌ Impossible de récupérer les détails supplémentaires.');
  }
});

// Bets only button (free, doesn't cost)
bot.action(/^bets:(.+):(.+)$/, async (ctx) => {
  await ctx.answerCbQuery('💰 Paris suggérés');
  
  const session = ctx.session;
  if (!session?.lastReport) {
    await ctx.reply('⚠️ Veuillez d\'abord analyser un match pour voir les paris.');
    return;
  }

  const report = session.lastReport;
  const suggestions = report.suggestions;
  const predictions = report.predictions;

  let message = `💰 **MODE PARIS RAPIDE**\n${report.analysis.match.teamHome} vs ${report.analysis.match.teamAway}\n\n`;

  // 1. Probabilities
  message += `📊 **Probabilités**\n`;
  message += `1️⃣ ${report.analysis.homeTeam.team.name}: **${predictions.homeWin}%**\n`;
  message += `✖️ Nul: **${predictions.draw}%**\n`;
  message += `2️⃣ ${report.analysis.awayTeam.team.name}: **${predictions.awayWin}%**\n\n`;

  // 2. Suggestions
  message += `🎯 **Meilleurs Paris**\n`;
  
  if (suggestions.length === 0) {
      message += "Aucun pari suggéré pour ce match.\n\n";
  } else {
      suggestions.slice(0, 5).forEach((bet) => { // Top 5 bets
        const riskEmoji = bet.riskLevel === 'low' ? '🟢' : bet.riskLevel === 'medium' ? '🟡' : '🔴';
        message += `${riskEmoji} **${bet.selection}** (@${bet.odds || 'N/A'})\n`;
        message += `   _${bet.explanation}_\n   Confiance: ${bet.confidence}%\n\n`;
      });
  }

  // 3. Verdict
  message += `🏆 **Verdict IA**: ${predictions.mostLikelyOutcome || 'Pas de verdict spécifique'}`;

  await ctx.reply(message, { parse_mode: 'Markdown' });
});

// Correct teams button
bot.action(/^correct:(.+):(.+)$/, async (ctx) => {
  await ctx.answerCbQuery('✏️ Correction des équipes');
  
  if (ctx.session) {
    ctx.session.awaitingCorrection = true;
  }
  
  await ctx.reply(
    '✏️ **Correction des équipes**\n\n' +
    'Envoie-moi le match corrigé au format :\n' +
    '`Équipe1 vs Équipe2`\n\n' +
    'Exemple : `PSG vs Marseille`',
    { parse_mode: 'Markdown' }
  );
});

// ═══════════════════════════════════════════════════════════════
// Text Handler - For corrections
// ═══════════════════════════════════════════════════════════════

bot.on(message('text'), async (ctx) => {
  const text = ctx.message.text;
  const telegramId = ctx.from?.id;
  
  if (!telegramId) return;
  
  // Skip if it's a command
  if (text.startsWith('/')) return;
  
  // Check if awaiting correction
  if (ctx.session?.awaitingCorrection) {
    const vsMatch = text.match(/(.+?)\s+(?:vs\.?|contre|-)\s+(.+)/i);
    
    if (vsMatch) {
      ctx.session.awaitingCorrection = false;
      
      // Check quota
      if (!(await checkUserQuota(ctx))) return;
      
      const homeTeam = vsMatch[1].trim();
      const awayTeam = vsMatch[2].trim();
      
      const processingMsg = await ctx.reply('⏳ Analyse du match corrigé...');
      
      try {
        const { report, telegramMessage } = await matchAnalyzer.analyzeMatch(homeTeam, awayTeam);
        
        // Deduct message
        await deductUserMessage(ctx, 'text', { homeTeam, awayTeam });
        const stats = await quotaService.getUserStats(telegramId);
        const settings = await getSettings();
        const quotaStatus = getQuotaStatusMessage(stats.remainingFreeMessages, stats.remainingCredits, settings.costPerMessage);
        
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});
        await ctx.reply(telegramMessage + quotaStatus, { parse_mode: 'Markdown' });
        
        ctx.session.lastMatch = { home: homeTeam, away: awayTeam };
        ctx.session.lastReport = report;

      } catch (error) {
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});
        await ctx.reply('❌ Erreur lors de l\'analyse. Vérifie les noms des équipes.');
      }
    } else {
      await ctx.reply(
        '❌ Format invalide.\n\nUtilise : `Équipe1 vs Équipe2`',
        { parse_mode: 'Markdown' }
      );
    }
    return;
  }
  
  // Default response for text
  await ctx.reply(
    '📸 Envoie-moi un **screenshot** d\'un match pour l\'analyser !\n\n' +
    'Ou utilise `/analyze Équipe1 vs Équipe2` pour une analyse manuelle.',
    { parse_mode: 'Markdown' }
  );
});

// ═══════════════════════════════════════════════════════════════
// Bot Lifecycle
// ═══════════════════════════════════════════════════════════════

export async function startBot() {
  logger.info('Starting FootBot...');
  
  // Set bot commands
  await bot.telegram.setMyCommands([
    { command: 'start', description: 'Démarrer le bot' },
    { command: 'help', description: 'Afficher l\'aide' },
    { command: 'analyze', description: 'Analyser un match manuellement' },
    { command: 'compte', description: 'Voir mon compte' },
    { command: 'acheter', description: 'Acheter des crédits' },
    { command: 'premium', description: 'Passer Premium' },
  ]);
  
  // Start polling
  await bot.launch();
  
  logger.info('✅ FootBot is running!');
  
  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

export { bot };
