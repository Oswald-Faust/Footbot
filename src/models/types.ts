import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// Match Candidate - Extracted from screenshot
// ═══════════════════════════════════════════════════════════════
export const MatchCandidateSchema = z.object({
  teamHome: z.string(),
  teamAway: z.string(),
  competition: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  time: z.string().nullable().optional(),
  venue: z.string().nullable().optional(),
  status: z.enum(['pre-match', 'live', 'finished', 'unknown']).default('unknown'),
  odds: z.object({
    home: z.number().nullable().optional(),
    draw: z.number().nullable().optional(),
    away: z.number().nullable().optional(),
    over25: z.number().nullable().optional(),
    under25: z.number().nullable().optional(),
    bttsYes: z.number().nullable().optional(),
    bttsNo: z.number().nullable().optional(),
  }).nullable().optional(),
  ocrConfidence: z.number().min(0).max(100).default(0),
  rawText: z.string().nullable().optional(),
});

export type MatchCandidate = z.infer<typeof MatchCandidateSchema>;

// ═══════════════════════════════════════════════════════════════
// Team Data
// ═══════════════════════════════════════════════════════════════
export const TeamDataSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  shortName: z.string().optional(),
  logo: z.string().optional(),
  country: z.string().optional(),
  founded: z.number().optional(),
  venue: z.object({
    name: z.string().optional(),
    city: z.string().optional(),
    capacity: z.number().optional(),
  }).optional(),
});

export type TeamData = z.infer<typeof TeamDataSchema>;

// ═══════════════════════════════════════════════════════════════
// Player Data
// ═══════════════════════════════════════════════════════════════
export const PlayerDataSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  position: z.string().optional(),
  number: z.number().optional(),
  injured: z.boolean().default(false),
  suspended: z.boolean().default(false),
  injuryType: z.string().optional(),
  returnDate: z.string().optional(),
  goals: z.number().optional(),
  assists: z.number().optional(),
  minutesPlayed: z.number().optional(),
});

export type PlayerData = z.infer<typeof PlayerDataSchema>;

// ═══════════════════════════════════════════════════════════════
// Match Form
// ═══════════════════════════════════════════════════════════════
export const MatchResultSchema = z.object({
  date: z.string(),
  opponent: z.string(),
  homeAway: z.enum(['home', 'away']),
  goalsFor: z.number(),
  goalsAgainst: z.number(),
  result: z.enum(['W', 'D', 'L']),
  competition: z.string().optional(),
});

export type MatchResult = z.infer<typeof MatchResultSchema>;

// ═══════════════════════════════════════════════════════════════
// Team Statistics
// ═══════════════════════════════════════════════════════════════
export const TeamStatsSchema = z.object({
  team: TeamDataSchema,
  form: z.array(MatchResultSchema).default([]),
  position: z.number().optional(),
  points: z.number().optional(),
  played: z.number().optional(),
  won: z.number().optional(),
  drawn: z.number().optional(),
  lost: z.number().optional(),
  goalsFor: z.number().optional(),
  goalsAgainst: z.number().optional(),
  goalDifference: z.number().optional(),
  
  // Advanced stats
  xG: z.number().optional(),
  xGA: z.number().optional(),
  cleanSheets: z.number().optional(),
  failedToScore: z.number().optional(),
  avgGoalsScored: z.number().optional(),
  avgGoalsConceded: z.number().optional(),
  
  // Home/Away splits
  homeStats: z.object({
    played: z.number().optional(),
    won: z.number().optional(),
    drawn: z.number().optional(),
    lost: z.number().optional(),
    goalsFor: z.number().optional(),
    goalsAgainst: z.number().optional(),
  }).optional(),
  awayStats: z.object({
    played: z.number().optional(),
    won: z.number().optional(),
    drawn: z.number().optional(),
    lost: z.number().optional(),
    goalsFor: z.number().optional(),
    goalsAgainst: z.number().optional(),
  }).optional(),
  
  // Injuries/Suspensions
  injuries: z.array(PlayerDataSchema).default([]),
  suspensions: z.array(PlayerDataSchema).default([]),
  
  // Recent schedule
  lastMatchDate: z.string().optional(),
  nextMatchDate: z.string().optional(),
  matchesLast7Days: z.number().optional(),
  matchesLast14Days: z.number().optional(),
  matchesLast30Days: z.number().optional(),
});

export type TeamStats = z.infer<typeof TeamStatsSchema>;

// ═══════════════════════════════════════════════════════════════
// Head to Head
// ═══════════════════════════════════════════════════════════════
export const HeadToHeadSchema = z.object({
  matches: z.array(z.object({
    date: z.string(),
    competition: z.string().optional(),
    homeTeam: z.string(),
    awayTeam: z.string(),
    homeGoals: z.number(),
    awayGoals: z.number(),
    venue: z.string().optional(),
  })).default([]),
  summary: z.object({
    totalMatches: z.number(),
    team1Wins: z.number(),
    team2Wins: z.number(),
    draws: z.number(),
    team1Goals: z.number(),
    team2Goals: z.number(),
  }).optional(),
});

export type HeadToHead = z.infer<typeof HeadToHeadSchema>;

// ═══════════════════════════════════════════════════════════════
// Weather Data
// ═══════════════════════════════════════════════════════════════
export const WeatherDataSchema = z.object({
  temperature: z.number(),
  feelsLike: z.number().optional(),
  humidity: z.number().optional(),
  windSpeed: z.number().optional(),
  windDirection: z.string().optional(),
  precipitation: z.number().optional(),
  description: z.string(),
  icon: z.string().optional(),
  impact: z.enum(['none', 'low', 'medium', 'high']).default('none'),
  impactDescription: z.string().optional(),
});

export type WeatherData = z.infer<typeof WeatherDataSchema>;

// ═══════════════════════════════════════════════════════════════
// Match Analysis
// ═══════════════════════════════════════════════════════════════
export const MatchAnalysisSchema = z.object({
  match: MatchCandidateSchema,
  homeTeam: TeamStatsSchema,
  awayTeam: TeamStatsSchema,
  headToHead: HeadToHeadSchema.optional(),
  weather: WeatherDataSchema.optional(),
  
  // Analysis factors
  factors: z.object({
    venue: z.object({
      description: z.string(),
      impact: z.enum(['home', 'away', 'neutral']),
      confidence: z.number(),
    }).optional(),
    travel: z.object({
      description: z.string(),
      awayTravelTime: z.string().optional(),
      impact: z.enum(['none', 'low', 'medium', 'high']),
    }).optional(),
    injuries: z.object({
      description: z.string(),
      homeImpact: z.enum(['none', 'low', 'medium', 'high']),
      awayImpact: z.enum(['none', 'low', 'medium', 'high']),
    }).optional(),
    weather: z.object({
      description: z.string(),
      impact: z.enum(['none', 'low', 'medium', 'high']),
    }).optional(),
    form: z.object({
      description: z.string(),
      homeForm: z.string(),
      awayForm: z.string(),
      advantage: z.enum(['home', 'away', 'equal']),
    }).optional(),
    matchup: z.object({
      description: z.string(),
      keyBattles: z.array(z.string()).optional(),
    }).optional(),
    stakes: z.object({
      description: z.string(),
      homeMotivation: z.enum(['low', 'medium', 'high']),
      awayMotivation: z.enum(['low', 'medium', 'high']),
    }).optional(),
    suspiciousActivity: z.object({
      description: z.string(),
      riskLevel: z.enum(['low', 'medium', 'high']),
      signals: z.array(z.string()).optional(),
    }).optional(),
  }),
  
  // Confidence
  overallConfidence: z.number().min(0).max(100),
  dataQuality: z.enum(['poor', 'fair', 'good', 'excellent']),
});

export type MatchAnalysis = z.infer<typeof MatchAnalysisSchema>;

// ═══════════════════════════════════════════════════════════════
// Probability Predictions
// ═══════════════════════════════════════════════════════════════
export const PredictionsSchema = z.object({
  // 1X2
  homeWin: z.number().min(0).max(100),
  draw: z.number().min(0).max(100),
  awayWin: z.number().min(0).max(100),
  
  // Over/Under
  over15: z.number().min(0).max(100).optional(),
  over25: z.number().min(0).max(100).optional(),
  over35: z.number().min(0).max(100).optional(),
  under15: z.number().min(0).max(100).optional(),
  under25: z.number().min(0).max(100).optional(),
  under35: z.number().min(0).max(100).optional(),
  
  // BTTS
  bttsYes: z.number().min(0).max(100).optional(),
  bttsNo: z.number().min(0).max(100).optional(),
  
  // Half-time
  htHomeWin: z.number().min(0).max(100).optional(),
  htDraw: z.number().min(0).max(100).optional(),
  htAwayWin: z.number().min(0).max(100).optional(),
  
  // Exact scores (top 5)
  exactScores: z.array(z.object({
    score: z.string(),
    probability: z.number(),
  })).optional(),
  
  // Handicaps
  handicaps: z.array(z.object({
    type: z.string(),
    probability: z.number(),
  })).optional(),
  
  // Scorers
  likelyScorers: z.array(z.object({
    player: z.string(),
    team: z.string(),
    probability: z.number(),
  })).optional(),
  
  mostLikelyOutcome: z.string().optional(),
});

export type Predictions = z.infer<typeof PredictionsSchema>;

// ═══════════════════════════════════════════════════════════════
// Betting Suggestion
// ═══════════════════════════════════════════════════════════════
export const BettingSuggestionSchema = z.object({
  type: z.string(),
  selection: z.string(),
  probability: z.number(),
  odds: z.number().optional(),
  valueRating: z.enum(['poor', 'fair', 'good', 'excellent']).optional(),
  riskLevel: z.enum(['low', 'medium', 'high']),
  explanation: z.string(),
  confidence: z.number().min(0).max(100),
});

export type BettingSuggestion = z.infer<typeof BettingSuggestionSchema>;

// ═══════════════════════════════════════════════════════════════
// Complete Report
// ═══════════════════════════════════════════════════════════════
export const MatchReportSchema = z.object({
  analysis: MatchAnalysisSchema,
  predictions: PredictionsSchema,
  suggestions: z.array(BettingSuggestionSchema),
  alerts: z.array(z.object({
    type: z.enum(['injury', 'weather', 'suspension', 'rotation', 'suspicious', 'derby', 'cup']),
    severity: z.enum(['info', 'warning', 'critical']),
    message: z.string(),
  })).default([]),
  generatedAt: z.string(),
});

export type MatchReport = z.infer<typeof MatchReportSchema>;
