import OpenAI from 'openai';
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { MatchCandidate, MatchCandidateSchema } from '../models/types.js';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
});

// Initialize Gemini (only for Search/Grounding)
const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const MATCH_EXTRACTION_PROMPT = `Tu es un expert en extraction de données de matchs de football.

Analyse cette image d'un screenshot de match de football et extrais les informations suivantes au format JSON strict.

INSTRUCTIONS IMPORTANTES:
1. Identifie les deux équipes (home = domicile, away = extérieur)
2. Si les noms d'équipes sont partiellement visibles ou abrégés, déduis le nom complet
3. Extrais la compétition si visible (Ligue 1, Premier League, Champions League, etc.)
4. Extrais la date et l'heure si visibles
5. Extrais le lieu/stade si visible
6. Extrais les cotes si visibles (1/N/2, Over/Under, BTTS)
7. Détermine le statut : pre-match, live, finished, ou unknown
8. Donne un score de confiance OCR de 0 à 100

FORMAT DE SORTIE (JSON strict):
{
  "teamHome": "Nom équipe domicile",
  "teamAway": "Nom équipe extérieur", 
  "competition": "Nom de la compétition ou null",
  "date": "YYYY-MM-DD ou null",
  "time": "HH:MM ou null",
  "venue": "Nom du stade/ville ou null",
  "status": "pre-match|live|finished|unknown",
  "odds": {
    "home": 1.50,
    "draw": 4.00,
    "away": 6.50,
    "over25": 1.80,
    "under25": 2.00,
    "bttsYes": 1.75,
    "bttsNo": 2.10
  },
  "ocrConfidence": 85,
  "rawText": "Texte brut extrait de l'image"
}

Si une information n'est pas visible, mets null.
Si les cotes ne sont pas visibles, mets l'objet odds à null.
Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire.`;

/**
 * Extract match information from a screenshot using OpenAI GPT-4o Vision
 */
export async function extractMatchFromImage(imageBuffer: Buffer, mimeType: string): Promise<MatchCandidate> {
  try {
    logger.info('Starting image analysis with OpenAI GPT-4o');
    
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a football data extraction expert. You output only valid JSON."
        },
        {
          role: "user",
          content: [
            { type: "text", text: MATCH_EXTRACTION_PROMPT },
            {
              type: "image_url",
              image_url: {
                url: dataUrl,
                detail: "high"
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const text = response.choices[0].message.content;
    
    logger.debug('OpenAI raw response:', { text });
    
    if (!text) {
      throw new Error('Empty response from OpenAI');
    }

    const parsed = JSON.parse(text);
    
    // Validate with Zod
    const validated = MatchCandidateSchema.parse(parsed);
    
    logger.info('Match extracted successfully', {
      home: validated.teamHome,
      away: validated.teamAway,
      confidence: validated.ocrConfidence,
    });
    
    return validated;
  } catch (error) {
    logger.error('Failed to extract match from image', { error });
    throw error;
  }
}

/**
 * Fetch live context using Gemini (for Google Search capabilities)
 */
async function fetchLiveContextWithGemini(
  homeTeam: string,
  awayTeam: string,
  competition?: string | null
): Promise<string> {
  try {
    logger.info('Fetching live context with Gemini (Google Search)...');
    
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      safetySettings,
      tools: [{ googleSearch: {} } as any],
    });

    const now = new Date();
    const currentDate = now.toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const prompt = `Recherche les informations les plus récentes et complètes (Date actuelle: ${currentDate}) pour le match de football: ${homeTeam} vs ${awayTeam} ${competition ? `(${competition})` : ''}.

    Collecte des données précises sur les points suivants :
    1.  **Effectif & Santé** : Blessures actuelles, suspensions, retours, et *minutes jouées* récemment (fatigue).
    2.  **Compositions Probables** : Les 11 attendus ce jour.
    3.  **Contexte & Enjeux** : Classement, objectifs (titre/maintien), rivalité, prochains matchs importants (rotation ?).
    4.  **Voyage & Logistique** : Distance du déplacement pour l'équipe visiteuse, temps de repos depuis le dernier match.
    5.  **Météo** : Prévisions locales pour l'heure du match (Pluie, Vent, Température).
    6.  **Ambiance & Bruits de couloir** : Tensions internes, rumeurs de matchs truqués ou mouvements de cotes suspects.

    Fais un résumé dense, technique et factuel. Si une info est introuvable, mentionne-le.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    logger.info('Live context fetched', { length: text.length });
    return text;
  } catch (error) {
    logger.warn('Failed to fetch live context with Gemini', { error });
    return "Impossible de récupérer les informations en direct (Erreur de recherche).";
  }
}

/**
 * Analyze match context and provide detailed analysis using OpenAI GPT-4o
 * (Enriched with Gemini Search results)
 */
export async function analyzeMatchContext(
  matchData: any,
  homeTeamData: any,
  awayTeamData: any,
  headToHead: any | null,
  weather: any | null
): Promise<{
  analysis: any;
  predictions: any;
  suggestions: any[];
  confidence: number;
}> {
  try {
    logger.info('Starting match analysis with OpenAI GPT-4o');
    
    // Step 1: Get live context via Gemini
    const liveContext = await fetchLiveContextWithGemini(
      matchData.teamHome, 
      matchData.teamAway, 
      matchData.competition
    );
    
    // Step 2: Analyze with OpenAI
    const now = new Date();
    const currentDate = now.toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const systemPrompt = `Tu es un EXPERT MONDIAL en analyse de matchs de football et paris sportifs.
Tu as accès à des données précises et tu dois produire une analyse de niveau professionnel.
Tu reçois des données JSON structurées ET un résumé d'informations 'Live' récupérées sur internet.
Tu dois synthétiser tout cela pour produire une analyse JSON de haute qualité.`;

    const userPrompt = `
⏰ **DATE ACTUELLE: ${currentDate}**
📅 **NOUS SOMMES EN JANVIER 2026**

Voici les données à analyser:

1. **INFORMATIONS LIVE (Internet)**:
${liveContext}

2. **DONNÉES DU MATCH**:
${JSON.stringify(matchData, null, 2)}

3. **STATS DOMICILE**:
${JSON.stringify(homeTeamData, null, 2)}

4. **STATS EXTÉRIEUR**:
${JSON.stringify(awayTeamData, null, 2)}

5. **H2H**:
${headToHead ? JSON.stringify(headToHead, null, 2) : 'Non disponible'}

6. **MÉTÉO**:
${weather ? JSON.stringify(weather, null, 2) : 'Non disponible'}

---
---
TES TÂCHES (Analyse approfondie requise):

Tu dois impérativement couvrir ces 8 dimensions (A-H) :

A) **Contexte Match** : Lieu, domicile/extérieur, importance (coupe/championnat), affluence.
B) **Voyage & Fatigue** : Distance parcourue par l'extérieur, jours de repos, accumulation des matchs.
C) **Santé & Effectif** : Liste précise des absents (suspendus/blessés), impacts tactiques, retours.
D) **Conditions Météo** : Température, vent, pluie. Impact sur le jeu (terrain lourd ?).
E) **Forme & Charge** : Série actuelle (5-10 matchs), densité du calendrier.
F) **Style & Match-up** : Tactique (Possession vs Contre), xG/xGA récents, confrontation de styles.
G) **Enjeux & Motivation** : Classement, besoin de points, derby, match suivant (rotation ?).
H) **Risque / Match Suspect** : Signaux de match truqué, bizarreries de cotes, absence d'enjeu total.

Ensuite :
1.  **Calcul de Probabilités** : Estime les % pour 1X2, BTTS, Over/Under avec précision.
2.  **Scénario** : Imagine le déroulement du match (mi-temps, domination).
3.  **Paris** : Propose des paris value avec niveau de risque.

---
FORMAT DE SORTIE ATTENDU (JSON STRICT):
{
  "analysis": {
    "matchContext": { "venue": "...", "importance": "...", "atmosphere": "..." },
    "injuries": {
        "homeTeam": { "out": ["..."], "doubtful": ["..."], "impact": "low|medium|high|critical" },
        "awayTeam": { "out": ["..."], "doubtful": ["..."], "impact": "low|medium|high|critical" },
        "summary": "..."
    },
    "lineups": {
       "homeTeam": { "formation": "...", "probable11": ["..."], "keyPlayers": ["..."], "coach": "..." },
       "awayTeam": { "formation": "...", "probable11": ["..."], "keyPlayers": ["..."], "coach": "..." }
    },
    "form": {
       "homeTeam": { "description": "...", "trend": "..." },
       "awayTeam": { "description": "...", "trend": "..." },
       "advantage": "home|away|equal",
       "summary": "..."
    },
    "styles": {
       "matchupAnalysis": "..."
    },
    "stakes": {
       "summary": "..."
    },
    "h2h": { "trend": "..." },
    "weather": { "impact": "...", "affectedStyle": "..." },
    "suspiciousActivity": { "riskLevel": "low|medium|high", "description": "..." },
    "alerts": [ { "type": "info|warning|critical", "message": "..." } ]
  },
  "predictions": {
    "homeWin": 45, "draw": 28, "awayWin": 27,
    "over25": 55, "under25": 45,
    "bttsYes": 60, "bttsNo": 40,
    "exactScores": [ { "score": "2-1", "probability": 12 } ],
    "likelyScorers": [ { "player": "...", "team": "...", "probability": 40 } ],
    "mostLikelyOutcome": "..."
  },
  "suggestions": [
    {
      "type": "1X2|Over/Under|...",
      "selection": "...",
      "probability": 65,
      "recommendedOdds": 1.5,
      "riskLevel": "low|medium|high",
      "explanation": "...",
      "confidence": 80
    }
  ],
  "overallConfidence": 80,
  "dataQuality": "good"
}
`;

    const response = await openai.chat.completions.create({
      model: "o1", // Production Reasoning Model (High Tier)
      messages: [
        { 
          role: "user", 
          content: `${systemPrompt}\n\n${userPrompt}` 
        }
      ],
      // o1-preview specific: temperature must be 1 (or omitted), response_format not supported in preview
    });

    let content = response.choices[0].message.content || '{}';
    // Remove markdown code blocks if present (o1 tends to wrap in ```json ... ```)
    content = content.replace(/```json\n?|\n?```/g, '').trim();
    
    const parsed = JSON.parse(content);
    
    logger.info('OpenAI analysis completed', { 
      confidence: parsed.overallConfidence 
    });

    return {
      analysis: parsed.analysis || {},
      predictions: parsed.predictions || {},
      suggestions: parsed.suggestions || [],
      confidence: parsed.overallConfidence || 50,
    };
  } catch (error) {
    logger.error('Failed to analyze match context with OpenAI', { error });
    throw error;
  }
}

/**
 * Generate a human-readable summary for Telegram using OpenAI
 */
export async function generateTelegramReport(report: any): Promise<string> {
  try {
    const prompt = `Tu dois formater ce rapport d'analyse de match de football pour Telegram.

DONNÉES DU RAPPORT:
${JSON.stringify(report, null, 2)}

INSTRUCTIONS:
1. Utilise les emojis appropriés.
2. Structure claire avec séparateurs.
3. Max 4000 caractères.
4. Ton PRO: Énergique, Expert, Précis.
5. Mets en avant le VERDICT et les PARIS.

FORMAT REQUIS (Strictement comme ci-dessous) :

📍 **Bloc 1 — Résumé**
• ⚽ **Match** : [Équipe A] vs [Équipe B]
• 🏆 **Compétition** : [Nom]
• 📅 **Date/Heure** : [Date] à [Heure]
• 📍 **Lieu** : [Stade/Ville]
• 🌦️ **Météo** : [Info météo]
• 🧠 **Confiance IA** : [XX]/100

📍 **Bloc 2 — Analyse Q/R**
• ✈️ **Voyage/Fatigue** : [Analyse distance et repos]
• 🏥 **Santé Joueurs** : [Absents majeurs et impact]
• ⚡ **Forme & Charge** : [Dynamique récente]
• ⚔️ **Atouts / Match-up** : [Analyse tactique rapide]
• 🎯 **Enjeux** : [Classement, motivation, rotation]
• ⚠️ **Risque Suspect** : [Indice Faible/Moyen/Élevé + Raison]

📍 **Bloc 3 — Probabilités**
• 1️⃣ [Nom A] : **XX%**
• ✖️ Nul : **XX%**
• 2️⃣ [Nom B] : **XX%**

📍 **Bloc 4 — Paris Proposés**
[Liste des 3-5 meilleurs paris avec emojis]
• 💎 **[Sélection]** (@[Cote]) - [Niveau Risque]
  _Explication courte_

... (Autres paris : Score exact, Buteurs, etc.)

🏆 **Verdict** : [Phrase de conclusion]
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a professional sports betting analyst bot." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7, // Little more creativity for the text
    });

    let formattedText = response.choices[0].message.content?.trim() || "Erreur de génération du rapport.";
    
    if (formattedText.length > 4000) {
      formattedText = formattedText.substring(0, 3950) + '\n\n... [Rapport tronqué]';
    }
    
    return formattedText;
  } catch (error) {
    logger.error('Failed to generate Telegram report', { error });
    throw error;
  }
}

/**
 * Generate a DEEP STATISTICAL REPORT for the "More Details" button
 */
export async function generateDeepStatsReport(homeTeamStats: any, awayTeamStats: any): Promise<string> {
    try {
        const homeName = homeTeamStats.team.name;
        const awayName = awayTeamStats.team.name;
        
        logger.info(`Generating deep stats report for ${homeName} vs ${awayName}`);

        // 1. Fetch very specific deep stats via Live Search
        const deepContext = await fetchLiveContextWithGemini(homeName, awayName, "Deep Stats Search");
        
        const prompt = `Tu es un expert statisticien du football.
        
        TA MISSION : Générer un rapport statistique ultra-détaillé et "Geek" pour les parieurs professionnels qui cliquent sur "Plus de détails".
        
        Données :
        ${JSON.stringify(homeTeamStats, null, 2)}
        ${JSON.stringify(awayTeamStats, null, 2)}
        Contexte Live: ${deepContext}

        FORMAT SORTIE (Markdown Telegram), sois exhaustif :

        📊 **DÉTAILS & STATS AVANCÉES**
        ${homeName} vs ${awayName}

        📈 **Performances & xG**
        • ${homeName}: xG moy: [Valeur], Buts réels: [Valeur] (Sur/Sous-performance ?)
        • ${awayName}: xG moy: [Valeur], Buts réels: [Valeur]
        • Domination: [Qui garde le ballon ? % Possession moy]

        🧱 **Défense & Pressing**
        • ${homeName}: Clean Sheets [Nb], xGA [Valeur]
        • ${awayName}: Clean Sheets [Nb], xGA [Valeur]
        • Faiblesses: [Coups de pied arrêtés ? Contres ?]

        🕒 **Stats par Mi-Temps**
        • % Buts en 1ère MT : [Home] vs [Away]
        • % Buts en 2ème MT : [Home] vs [Away]
        • Moment clé : [Ex: Marque souvent entre 75-90']

        ⚔️ **Historique (H2H)**
        • 5 derniers : [V-N-D]
        • Moyenne de buts : [Valeur]
        • [Stat pertinente H2H, ex: "Toujours BTTS"]

        👥 **Joueurs Clés (Forme du moment)**
        • [Joueur Home] : [Nb] buts/assists récents, Note moy [X.X]
        • [Joueur Away] : [Nb] buts/assists récents, Note moy [X.X]

        💡 **Le Saviez-vous ?**
        [Une stat insolite ou une série en cours très précise]
        `;

        const response = await openai.chat.completions.create({
            model: "gpt-4o", // gpt-4o is sufficient for formatting stats nicely
            messages: [
                { role: "system", content: "You are a football stats expert." },
                { role: "user", content: prompt }
            ],
            temperature: 0.5,
        });

        return response.choices[0].message.content || "Détails indisponibles.";

    } catch (error) {
        logger.error('Failed to generate deep stats report', { error });
        return "❌ Erreur lors de la génération des statistiques détaillées.";
    }
}
