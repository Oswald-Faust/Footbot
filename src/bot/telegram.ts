import { Telegraf, Context, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { matchAnalyzer } from '../analysis/analyzer.js';
import axios from 'axios';
import { MatchReport } from '../models/types.js';

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

// ═══════════════════════════════════════════════════════════════
// Commands
// ═══════════════════════════════════════════════════════════════

bot.command('start', async (ctx) => {
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

**Compétitions supportées :**
🇫🇷 Ligue 1 | 🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League | 🇪🇸 La Liga
🇩🇪 Bundesliga | 🇮🇹 Serie A | 🏆 Champions League

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

**💡 Conseils :**
• Utilise des screenshots clairs et lisibles
• Les matchs pré-match donnent de meilleurs résultats
• Les grandes compétitions ont plus de données

**⚠️ Rappel :** 
Les paris comportent des risques. Joue de manière responsable.
  `;
  
  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
});

bot.command('analyze', async (ctx) => {
  const text = ctx.message.text.replace('/analyze', '').trim();
  
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
  
  const homeTeam = vsMatch[1].trim();
  const awayTeam = vsMatch[2].trim();
  
  // Send processing message
  const processingMsg = await ctx.reply(
    `⏳ Analyse en cours...\n\n🏠 **${homeTeam}**\n✈️ **${awayTeam}**\n\n🔍 Récupération des données...`,
    { parse_mode: 'Markdown' }
  );
  
  try {
    const { report, telegramMessage } = await matchAnalyzer.analyzeMatch(homeTeam, awayTeam);
    
    // Delete processing message
    await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});
    
    // Send analysis result
    await ctx.reply(telegramMessage, {
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
  logger.info('Photo received', { userId: ctx.from?.id, chatId: ctx.chat.id });
  
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
    await ctx.reply(message, {
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
  
  await ctx.answerCbQuery('🔄 Relance de l\'analyse...');
  
  await ctx.reply('⏳ Nouvelle analyse en cours...');
  
  try {
    const { report, telegramMessage } = await matchAnalyzer.analyzeMatch(homeTeam, awayTeam);
    await ctx.reply(telegramMessage, { parse_mode: 'Markdown' });

    // Update session with new report
    if (ctx.session) {
        ctx.session.lastReport = report;
    }

  } catch (error) {
    logger.error('Re-analysis failed', { error, homeTeam, awayTeam });
    await ctx.reply('❌ Erreur lors de la relance de l\'analyse.');
  }
});

// Details button
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

// Bets only button
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
  
  // Skip if it's a command
  if (text.startsWith('/')) return;
  
  // Check if awaiting correction
  if (ctx.session?.awaitingCorrection) {
    const vsMatch = text.match(/(.+?)\s+(?:vs\.?|contre|-)\s+(.+)/i);
    
    if (vsMatch) {
      ctx.session.awaitingCorrection = false;
      
      const homeTeam = vsMatch[1].trim();
      const awayTeam = vsMatch[2].trim();
      
      const processingMsg = await ctx.reply('⏳ Analyse du match corrigé...');
      
      try {
        const { report, telegramMessage } = await matchAnalyzer.analyzeMatch(homeTeam, awayTeam);
        
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});
        await ctx.reply(telegramMessage, { parse_mode: 'Markdown' });
        
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
  ]);
  
  // Start polling
  await bot.launch();
  
  logger.info('✅ FootBot is running!');
  
  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

export { bot };
