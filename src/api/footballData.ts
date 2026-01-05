import axios, { AxiosInstance } from 'axios';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { getCachedOrFetch } from '../utils/cache.js';
import { TeamStats, HeadToHead, MatchResult, TeamData } from '../models/types.js';

/**
 * Football-Data.org API Client
 * Free tier: 10 requests/minute, covers top competitions
 * https://www.football-data.org/documentation/api
 */

const BASE_URL = 'https://api.football-data.org/v4';

const client: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'X-Auth-Token': config.FOOTBALL_DATA_API_KEY || '',
  },
  timeout: 10000,
});

// Competition codes
export const COMPETITIONS = {
  PREMIER_LEAGUE: 'PL',
  LA_LIGA: 'PD',
  BUNDESLIGA: 'BL1',
  SERIE_A: 'SA',
  LIGUE_1: 'FL1',
  CHAMPIONS_LEAGUE: 'CL',
  EUROPA_LEAGUE: 'EL',
  WORLD_CUP: 'WC',
  EURO: 'EC',
};

interface FootballDataTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
  venue?: string;
}

interface FootballDataMatch {
  id: number;
  competition: { name: string; code: string };
  homeTeam: FootballDataTeam;
  awayTeam: FootballDataTeam;
  utcDate: string;
  status: string;
  venue?: string;
  score: {
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
}

/**
 * Get all available competitions
 */
export async function getCompetitions() {
  const cacheKey = 'football-data:competitions';
  
  return getCachedOrFetch(cacheKey, async () => {
    try {
      const response = await client.get('/competitions');
      return response.data.competitions;
    } catch (error) {
      logger.error('Failed to fetch competitions', { error });
      throw error;
    }
  }, 86400); // Cache for 24 hours
}

/**
 * Search for a team by name
 */
export async function searchTeam(teamName: string): Promise<TeamData | null> {
  const cacheKey = `football-data:team:${teamName.toLowerCase()}`;
  
  return getCachedOrFetch(cacheKey, async () => {
    try {
      // Try to find team across major competitions
      for (const code of Object.values(COMPETITIONS)) {
        try {
          const response = await client.get(`/competitions/${code}/teams`);
          const teams = response.data.teams as FootballDataTeam[];
          
          const found = teams.find(t => 
            t.name.toLowerCase().includes(teamName.toLowerCase()) ||
            t.shortName?.toLowerCase().includes(teamName.toLowerCase()) ||
            t.tla?.toLowerCase() === teamName.toLowerCase()
          );
          
          if (found) {
            return {
              id: found.id,
              name: found.name,
              shortName: found.shortName,
              logo: found.crest,
              venue: found.venue ? { name: found.venue } : undefined,
            };
          }
        } catch {
          // Continue to next competition
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to search team', { teamName, error });
      return null;
    }
  }, 3600); // Cache for 1 hour
}

/**
 * Get team matches (recent and upcoming)
 */
export async function getTeamMatches(
  teamId: number,
  status?: 'SCHEDULED' | 'FINISHED' | 'IN_PLAY',
  limit = 10
): Promise<FootballDataMatch[]> {
  const cacheKey = `football-data:team-matches:${teamId}:${status || 'all'}:${limit}`;
  
  return getCachedOrFetch(cacheKey, async () => {
    try {
      const params: Record<string, string | number> = { limit };
      if (status) params.status = status;
      
      const response = await client.get(`/teams/${teamId}/matches`, { params });
      return response.data.matches;
    } catch (error) {
      logger.error('Failed to fetch team matches', { teamId, error });
      return [];
    }
  }, 1800); // Cache for 30 minutes
}

/**
 * Get team's recent form (last N matches)
 */
export async function getTeamForm(teamId: number, teamName: string, count = 5): Promise<MatchResult[]> {
  try {
    const matches = await getTeamMatches(teamId, 'FINISHED', count);
    
    return matches.map((match: FootballDataMatch) => {
      const isHome = match.homeTeam.id === teamId;
      const goalsFor = isHome 
        ? match.score.fullTime.home ?? 0 
        : match.score.fullTime.away ?? 0;
      const goalsAgainst = isHome 
        ? match.score.fullTime.away ?? 0 
        : match.score.fullTime.home ?? 0;
      
      let result: 'W' | 'D' | 'L';
      if (goalsFor > goalsAgainst) result = 'W';
      else if (goalsFor === goalsAgainst) result = 'D';
      else result = 'L';
      
      return {
        date: match.utcDate,
        opponent: isHome ? match.awayTeam.name : match.homeTeam.name,
        homeAway: isHome ? 'home' : 'away',
        goalsFor,
        goalsAgainst,
        result,
        competition: match.competition.name,
      };
    });
  } catch (error) {
    logger.error('Failed to get team form', { teamId, error });
    return [];
  }
}

/**
 * Get standings for a competition
 */
export async function getStandings(competitionCode: string) {
  const cacheKey = `football-data:standings:${competitionCode}`;
  
  return getCachedOrFetch(cacheKey, async () => {
    try {
      const response = await client.get(`/competitions/${competitionCode}/standings`);
      return response.data.standings;
    } catch (error) {
      logger.error('Failed to fetch standings', { competitionCode, error });
      return null;
    }
  }, 3600); // Cache for 1 hour
}

/**
 * Get head-to-head data between two teams
 */
export async function getHeadToHead(matchId: number): Promise<HeadToHead | null> {
  const cacheKey = `football-data:h2h:${matchId}`;
  
  return getCachedOrFetch(cacheKey, async () => {
    try {
      const response = await client.get(`/matches/${matchId}/head2head`, {
        params: { limit: 10 },
      });
      
      const h2h = response.data;
      
      return {
        matches: h2h.matches?.map((m: FootballDataMatch) => ({
          date: m.utcDate,
          competition: m.competition.name,
          homeTeam: m.homeTeam.name,
          awayTeam: m.awayTeam.name,
          homeGoals: m.score.fullTime.home ?? 0,
          awayGoals: m.score.fullTime.away ?? 0,
        })) ?? [],
        summary: h2h.aggregates ? {
          totalMatches: h2h.aggregates.numberOfMatches,
          team1Wins: h2h.aggregates.homeTeam.wins,
          team2Wins: h2h.aggregates.awayTeam.wins,
          draws: h2h.aggregates.homeTeam.draws,
          team1Goals: h2h.aggregates.homeTeam.goals,
          team2Goals: h2h.aggregates.awayTeam.goals,
        } : undefined,
      };
    } catch (error) {
      logger.error('Failed to fetch head-to-head', { matchId, error });
      return null;
    }
  }, 86400); // Cache for 24 hours
}

/**
 * Find matches scheduled for today or a specific date
 */
export async function getMatchesByDate(date?: string): Promise<FootballDataMatch[]> {
  const dateStr = date || new Date().toISOString().split('T')[0];
  const cacheKey = `football-data:matches:${dateStr}`;
  
  return getCachedOrFetch(cacheKey, async () => {
    try {
      const response = await client.get('/matches', {
        params: { dateFrom: dateStr, dateTo: dateStr },
      });
      return response.data.matches;
    } catch (error) {
      logger.error('Failed to fetch matches by date', { date: dateStr, error });
      return [];
    }
  }, 1800); // Cache for 30 minutes
}

/**
 * Build team statistics object
 */
export async function buildTeamStats(teamId: number, teamName: string): Promise<Partial<TeamStats>> {
  try {
    const [form, finishedMatches] = await Promise.all([
      getTeamForm(teamId, teamName, 10),
      getTeamMatches(teamId, 'FINISHED', 20),
    ]);
    
    // Calculate form string
    const formString = form.slice(0, 5).map(m => m.result).join('');
    
    // Calculate goals
    const totalGoalsFor = form.reduce((sum, m) => sum + m.goalsFor, 0);
    const totalGoalsAgainst = form.reduce((sum, m) => sum + m.goalsAgainst, 0);
    
    // Calculate home/away splits
    const homeMatches = form.filter(m => m.homeAway === 'home');
    const awayMatches = form.filter(m => m.homeAway === 'away');
    
    // Count recent matches for fatigue
    const now = new Date();
    const matches7Days = finishedMatches.filter((m: FootballDataMatch) => {
      const matchDate = new Date(m.utcDate);
      const daysDiff = (now.getTime() - matchDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7;
    }).length;
    
    const matches14Days = finishedMatches.filter((m: FootballDataMatch) => {
      const matchDate = new Date(m.utcDate);
      const daysDiff = (now.getTime() - matchDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 14;
    }).length;
    
    return {
      team: { id: teamId, name: teamName },
      form,
      played: form.length,
      won: form.filter(m => m.result === 'W').length,
      drawn: form.filter(m => m.result === 'D').length,
      lost: form.filter(m => m.result === 'L').length,
      goalsFor: totalGoalsFor,
      goalsAgainst: totalGoalsAgainst,
      avgGoalsScored: form.length > 0 ? totalGoalsFor / form.length : 0,
      avgGoalsConceded: form.length > 0 ? totalGoalsAgainst / form.length : 0,
      homeStats: {
        played: homeMatches.length,
        won: homeMatches.filter(m => m.result === 'W').length,
        drawn: homeMatches.filter(m => m.result === 'D').length,
        lost: homeMatches.filter(m => m.result === 'L').length,
        goalsFor: homeMatches.reduce((sum, m) => sum + m.goalsFor, 0),
        goalsAgainst: homeMatches.reduce((sum, m) => sum + m.goalsAgainst, 0),
      },
      awayStats: {
        played: awayMatches.length,
        won: awayMatches.filter(m => m.result === 'W').length,
        drawn: awayMatches.filter(m => m.result === 'D').length,
        lost: awayMatches.filter(m => m.result === 'L').length,
        goalsFor: awayMatches.reduce((sum, m) => sum + m.goalsFor, 0),
        goalsAgainst: awayMatches.reduce((sum, m) => sum + m.goalsAgainst, 0),
      },
      matchesLast7Days: matches7Days,
      matchesLast14Days: matches14Days,
      lastMatchDate: form[0]?.date,
    };
  } catch (error) {
    logger.error('Failed to build team stats', { teamId, error });
    return { team: { name: teamName } };
  }
}
