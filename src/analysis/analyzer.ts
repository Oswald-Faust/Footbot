import { logger } from '../utils/logger.js';
import { normalizeTeamName } from '../utils/teamNormalizer.js';
import { searchTeam, buildTeamStats, getHeadToHead, getMatchesByDate } from '../api/footballData.js';
import { getWeather, getWeatherForecast } from '../api/weather.js';
import { extractMatchFromImage, analyzeMatchContext, generateTelegramReport } from '../ocr/hybridAnalysis.js';
import {
  MatchCandidate,
  MatchReport,
  TeamStats,
  HeadToHead,
  WeatherData,
  Predictions,
  BettingSuggestion,
} from '../models/types.js';

/**
 * Main analysis engine - orchestrates the entire analysis pipeline
 */
export class MatchAnalyzer {
  /**
   * Full analysis pipeline from image to report
   */
  async analyzeFromImage(imageBuffer: Buffer, mimeType: string): Promise<{
    report: MatchReport;
    telegramMessage: string;
    matchCandidate: MatchCandidate;
  }> {
    logger.info('Starting full analysis pipeline');
    
    // Step 1: Extract match info from image
    const matchCandidate = await extractMatchFromImage(imageBuffer, mimeType);
    logger.info('Match extracted', {
      home: matchCandidate.teamHome,
      away: matchCandidate.teamAway,
      confidence: matchCandidate.ocrConfidence,
    });
    
    // Step 2: Normalize team names
    const homeTeamName = normalizeTeamName(matchCandidate.teamHome);
    const awayTeamName = normalizeTeamName(matchCandidate.teamAway);
    
    // Step 3: Fetch team data in parallel
    const [homeTeamSearch, awayTeamSearch] = await Promise.all([
      searchTeam(homeTeamName),
      searchTeam(awayTeamName),
    ]);
    
    logger.info('Teams found', {
      home: homeTeamSearch?.name || 'Not found',
      away: awayTeamSearch?.name || 'Not found',
    });
    
    // Step 4: Build team statistics
    const [homeTeamStats, awayTeamStats] = await Promise.all([
      homeTeamSearch 
        ? buildTeamStats(homeTeamSearch.id!, homeTeamSearch.name)
        : this.createEmptyTeamStats(homeTeamName),
      awayTeamSearch
        ? buildTeamStats(awayTeamSearch.id!, awayTeamSearch.name)
        : this.createEmptyTeamStats(awayTeamName),
    ]);
    
    // Step 5: Get weather if venue is available
    let weather: WeatherData | null = null;
    const venue = matchCandidate.venue || homeTeamStats.team?.venue?.city;
    if (venue) {
      if (matchCandidate.date && matchCandidate.time) {
        const matchDateTime = new Date(`${matchCandidate.date}T${matchCandidate.time}`);
        weather = await getWeatherForecast(venue, matchDateTime);
      } else {
        weather = await getWeather(venue);
      }
    }
    
    // Step 6: Get head-to-head (if we have match IDs)
    let headToHead: HeadToHead | null = null;
    // Note: H2H requires match ID from API, skipping for now
    
    // Step 7: Analyze with Gemini
    const geminiAnalysis = await analyzeMatchContext(
      matchCandidate,
      homeTeamStats,
      awayTeamStats,
      headToHead,
      weather
    );
    
    // Step 8: Build the report
    const report = this.buildReport(
      matchCandidate,
      homeTeamStats as TeamStats,
      awayTeamStats as TeamStats,
      headToHead,
      weather,
      geminiAnalysis
    );
    
    // Step 9: Generate Telegram message
    const telegramMessage = await generateTelegramReport(report);
    
    logger.info('Analysis complete', {
      confidence: report.analysis.overallConfidence,
      suggestionsCount: report.suggestions.length,
    });
    
    return { report, telegramMessage, matchCandidate };
  }
  
  /**
   * Create empty team stats when team is not found
   */
  private createEmptyTeamStats(teamName: string): Partial<TeamStats> {
    return {
      team: { name: teamName },
      form: [],
      injuries: [],
      suspensions: [],
    };
  }
  
  /**
   * Build the final match report
   */
  private buildReport(
    match: MatchCandidate,
    homeTeam: TeamStats,
    awayTeam: TeamStats,
    headToHead: HeadToHead | null,
    weather: WeatherData | null,
    geminiAnalysis: {
      analysis: any;
      predictions: any;
      suggestions: any[];
      confidence: number;
    }
  ): MatchReport {
    const predictions: Predictions = {
      homeWin: geminiAnalysis.predictions.homeWin || 33,
      draw: geminiAnalysis.predictions.draw || 34,
      awayWin: geminiAnalysis.predictions.awayWin || 33,
      over15: geminiAnalysis.predictions.over15,
      over25: geminiAnalysis.predictions.over25,
      over35: geminiAnalysis.predictions.over35,
      under15: geminiAnalysis.predictions.under15,
      under25: geminiAnalysis.predictions.under25,
      under35: geminiAnalysis.predictions.under35,
      bttsYes: geminiAnalysis.predictions.bttsYes,
      bttsNo: geminiAnalysis.predictions.bttsNo,
      htHomeWin: geminiAnalysis.predictions.htHomeWin,
      htDraw: geminiAnalysis.predictions.htDraw,
      htAwayWin: geminiAnalysis.predictions.htAwayWin,
      exactScores: geminiAnalysis.predictions.exactScores,
      handicaps: geminiAnalysis.predictions.handicaps,
      likelyScorers: geminiAnalysis.predictions.likelyScorers,
    };
    
    const suggestions: BettingSuggestion[] = (geminiAnalysis.suggestions || []).map((s: any) => ({
      type: s.type || 'Unknown',
      selection: s.selection || 'N/A',
      probability: s.probability || 50,
      odds: s.odds,
      riskLevel: s.riskLevel || 'medium',
      explanation: s.explanation || '',
      confidence: s.confidence || 50,
    }));
    
    // Determine data quality
    let dataQuality: 'poor' | 'fair' | 'good' | 'excellent' = 'poor';
    const hasHomeForm = (homeTeam.form?.length || 0) >= 3;
    const hasAwayForm = (awayTeam.form?.length || 0) >= 3;
    const hasWeather = weather !== null;
    const hasOdds = match.odds !== null && match.odds !== undefined;
    
    const qualityScore = 
      (hasHomeForm ? 25 : 0) +
      (hasAwayForm ? 25 : 0) +
      (hasWeather ? 25 : 0) +
      (hasOdds ? 25 : 0);
    
    if (qualityScore >= 75) dataQuality = 'excellent';
    else if (qualityScore >= 50) dataQuality = 'good';
    else if (qualityScore >= 25) dataQuality = 'fair';
    
    // Build alerts
    const alerts: MatchReport['alerts'] = [];
    
    // Injury alerts
    if ((homeTeam.injuries?.length || 0) > 0) {
      alerts.push({
        type: 'injury',
        severity: (homeTeam.injuries?.length || 0) >= 3 ? 'critical' : 'warning',
        message: `${homeTeam.team?.name}: ${homeTeam.injuries?.length} blessé(s)`,
      });
    }
    if ((awayTeam.injuries?.length || 0) > 0) {
      alerts.push({
        type: 'injury',
        severity: (awayTeam.injuries?.length || 0) >= 3 ? 'critical' : 'warning',
        message: `${awayTeam.team?.name}: ${awayTeam.injuries?.length} blessé(s)`,
      });
    }
    
    // Weather alerts
    if (weather && weather.impact === 'high') {
      alerts.push({
        type: 'weather',
        severity: 'warning',
        message: `Météo difficile: ${weather.impactDescription}`,
      });
    }
    
    // Fatigue alerts
    if ((homeTeam.matchesLast7Days || 0) >= 3) {
      alerts.push({
        type: 'rotation',
        severity: 'warning',
        message: `${homeTeam.team?.name}: ${homeTeam.matchesLast7Days} matchs en 7 jours - fatigue possible`,
      });
    }
    if ((awayTeam.matchesLast7Days || 0) >= 3) {
      alerts.push({
        type: 'rotation',
        severity: 'warning',
        message: `${awayTeam.team?.name}: ${awayTeam.matchesLast7Days} matchs en 7 jours - fatigue possible`,
      });
    }
    
    // Add Gemini alerts
    if (geminiAnalysis.analysis?.alerts) {
      for (const alert of geminiAnalysis.analysis.alerts) {
        alerts.push({
          type: alert.type || 'info',
          severity: alert.severity || 'info',
          message: alert.message,
        });
      }
    }
    
    return {
      analysis: {
        match,
        homeTeam,
        awayTeam,
        headToHead: headToHead || undefined,
        weather: weather || undefined,
        factors: geminiAnalysis.analysis,
        overallConfidence: geminiAnalysis.confidence || match.ocrConfidence,
        dataQuality,
      },
      predictions,
      suggestions,
      alerts,
      generatedAt: new Date().toISOString(),
    };
  }
  
  /**
   * Quick analysis without image (manual team input)
   */
  async analyzeMatch(
    homeTeamName: string,
    awayTeamName: string,
    competition?: string,
    matchDate?: string,
    matchTime?: string
  ): Promise<{
    report: MatchReport;
    telegramMessage: string;
  }> {
    const matchCandidate: MatchCandidate = {
      teamHome: homeTeamName,
      teamAway: awayTeamName,
      competition,
      date: matchDate,
      time: matchTime,
      status: 'pre-match',
      ocrConfidence: 100, // Manual input
    };
    
    // Simulate image analysis flow
    const fakeImageBuffer = Buffer.from('');
    
    // Skip OCR step and go directly to data fetching
    const homeNormalized = normalizeTeamName(homeTeamName);
    const awayNormalized = normalizeTeamName(awayTeamName);
    
    const [homeTeamSearch, awayTeamSearch] = await Promise.all([
      searchTeam(homeNormalized),
      searchTeam(awayNormalized),
    ]);
    
    const [homeTeamStats, awayTeamStats] = await Promise.all([
      homeTeamSearch 
        ? buildTeamStats(homeTeamSearch.id!, homeTeamSearch.name)
        : this.createEmptyTeamStats(homeNormalized),
      awayTeamSearch
        ? buildTeamStats(awayTeamSearch.id!, awayTeamSearch.name)
        : this.createEmptyTeamStats(awayNormalized),
    ]);
    
    let weather: WeatherData | null = null;
    const venue = homeTeamStats.team?.venue?.city;
    if (venue) {
      weather = await getWeather(venue);
    }
    
    const geminiAnalysis = await analyzeMatchContext(
      matchCandidate,
      homeTeamStats,
      awayTeamStats,
      null,
      weather
    );
    
    const report = this.buildReport(
      matchCandidate,
      homeTeamStats as TeamStats,
      awayTeamStats as TeamStats,
      null,
      weather,
      geminiAnalysis
    );
    
    const telegramMessage = await generateTelegramReport(report);
    
    return { report, telegramMessage };
    return { report, telegramMessage };
  }

  /**
   * Generates a deep statistical dive for the "More Details" button
   */
  async analyzeMatchDocs(homeTeamName: string, awayTeamName: string): Promise<{ telegramMessage: string }> {
      // Re-fetch basic data (in a real app, this should be cached)
      const homeNormalized = normalizeTeamName(homeTeamName);
      const awayNormalized = normalizeTeamName(awayTeamName);
      
      const [homeTeamSearch, awayTeamSearch] = await Promise.all([
        searchTeam(homeNormalized),
        searchTeam(awayNormalized),
      ]);
      
      const [homeTeamStats, awayTeamStats] = await Promise.all([
        homeTeamSearch ? buildTeamStats(homeTeamSearch.id!, homeTeamSearch.name) : this.createEmptyTeamStats(homeNormalized),
        awayTeamSearch ? buildTeamStats(awayTeamSearch.id!, awayTeamSearch.name) : this.createEmptyTeamStats(awayNormalized),
      ]);

      // Use a specialized OpenAI call for "Deep Stats"
      const { generateDeepStatsReport } = await import('../ocr/hybridAnalysis.js');
      const telegramMessage = await generateDeepStatsReport(homeTeamStats, awayTeamStats);

      return { telegramMessage };
  }
}

// Export singleton instance
export const matchAnalyzer = new MatchAnalyzer();
