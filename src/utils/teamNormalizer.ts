/**
 * Normalizes team names for consistent matching
 * Handles variations, abbreviations, and common misspellings
 */

// Common team name mappings (French clubs)
const TEAM_NAME_MAPPINGS: Record<string, string> = {
  // France - Ligue 1
  'psg': 'Paris Saint-Germain',
  'paris sg': 'Paris Saint-Germain', 
  'paris saint germain': 'Paris Saint-Germain',
  'om': 'Olympique de Marseille',
  'marseille': 'Olympique de Marseille',
  'olympique marseille': 'Olympique de Marseille',
  'ol': 'Olympique Lyonnais',
  'lyon': 'Olympique Lyonnais',
  'olympique lyon': 'Olympique Lyonnais',
  'asse': 'AS Saint-Étienne',
  'saint etienne': 'AS Saint-Étienne',
  'as monaco': 'AS Monaco',
  'monaco': 'AS Monaco',
  'losc': 'LOSC Lille',
  'lille': 'LOSC Lille',
  'ogc nice': 'OGC Nice',
  'nice': 'OGC Nice',
  'stade rennais': 'Stade Rennais',
  'rennes': 'Stade Rennais',
  'rc lens': 'RC Lens',
  'lens': 'RC Lens',
  'fc nantes': 'FC Nantes',
  'nantes': 'FC Nantes',
  'montpellier hsc': 'Montpellier HSC',
  'montpellier': 'Montpellier HSC',
  'stade brestois': 'Stade Brestois 29',
  'brest': 'Stade Brestois 29',
  'rc strasbourg': 'RC Strasbourg',
  'strasbourg': 'RC Strasbourg',
  'toulouse fc': 'Toulouse FC',
  'toulouse': 'Toulouse FC',
  'stade de reims': 'Stade de Reims',
  'reims': 'Stade de Reims',
  'fc lorient': 'FC Lorient',
  'lorient': 'FC Lorient',
  'clermont foot': 'Clermont Foot',
  'clermont': 'Clermont Foot',
  'le havre ac': 'Le Havre AC',
  'le havre': 'Le Havre AC',
  'fc metz': 'FC Metz',
  'metz': 'FC Metz',
  
  // England - Premier League
  'man city': 'Manchester City',
  'mancity': 'Manchester City',
  'manchester city fc': 'Manchester City',
  'man utd': 'Manchester United',
  'man united': 'Manchester United',
  'manutd': 'Manchester United',
  'manchester united fc': 'Manchester United',
  'liverpool fc': 'Liverpool',
  'chelsea fc': 'Chelsea',
  'arsenal fc': 'Arsenal',
  'spurs': 'Tottenham Hotspur',
  'tottenham': 'Tottenham Hotspur',
  'newcastle': 'Newcastle United',
  'newcastle utd': 'Newcastle United',
  'aston villa fc': 'Aston Villa',
  'brighton': 'Brighton & Hove Albion',
  'brighton hove': 'Brighton & Hove Albion',
  'west ham': 'West Ham United',
  'west ham utd': 'West Ham United',
  'wolves': 'Wolverhampton Wanderers',
  'wolverhampton': 'Wolverhampton Wanderers',
  'crystal palace fc': 'Crystal Palace',
  'fulham fc': 'Fulham',
  'brentford fc': 'Brentford',
  'bournemouth': 'AFC Bournemouth',
  'afc bournemouth': 'AFC Bournemouth',
  'nottm forest': 'Nottingham Forest',
  'nottingham': 'Nottingham Forest',
  'everton fc': 'Everton',
  'luton': 'Luton Town',
  'burnley fc': 'Burnley',
  'sheffield utd': 'Sheffield United',
  'sheffield united fc': 'Sheffield United',
  
  // Spain - La Liga
  'real': 'Real Madrid',
  'real madrid cf': 'Real Madrid',
  'barca': 'FC Barcelona',
  'barcelona': 'FC Barcelona',
  'fc barcelona': 'FC Barcelona',
  'atletico': 'Atlético Madrid',
  'atletico madrid': 'Atlético Madrid',
  'atleti': 'Atlético Madrid',
  'sevilla fc': 'Sevilla',
  'real sociedad': 'Real Sociedad',
  'la real': 'Real Sociedad',
  'villarreal cf': 'Villarreal',
  'real betis': 'Real Betis',
  'betis': 'Real Betis',
  'athletic': 'Athletic Bilbao',
  'athletic bilbao': 'Athletic Bilbao',
  'athletic club': 'Athletic Bilbao',
  'valencia cf': 'Valencia',
  'celta vigo': 'Celta Vigo',
  'celta': 'Celta Vigo',
  'getafe cf': 'Getafe',
  'osasuna': 'CA Osasuna',
  'ca osasuna': 'CA Osasuna',
  'rayo vallecano': 'Rayo Vallecano',
  'rayo': 'Rayo Vallecano',
  'girona fc': 'Girona',
  'mallorca': 'RCD Mallorca',
  'rcd mallorca': 'RCD Mallorca',
  'cadiz cf': 'Cádiz',
  'cadiz': 'Cádiz',
  'alaves': 'Deportivo Alavés',
  'deportivo alaves': 'Deportivo Alavés',
  'granada cf': 'Granada',
  'las palmas': 'UD Las Palmas',
  'ud las palmas': 'UD Las Palmas',
  'almeria': 'UD Almería',
  'ud almeria': 'UD Almería',
  
  // Germany - Bundesliga
  'bayern': 'Bayern München',
  'bayern munich': 'Bayern München',
  'fc bayern': 'Bayern München',
  'bvb': 'Borussia Dortmund',
  'dortmund': 'Borussia Dortmund',
  'rb leipzig': 'RB Leipzig',
  'leipzig': 'RB Leipzig',
  'leverkusen': 'Bayer 04 Leverkusen',
  'bayer leverkusen': 'Bayer 04 Leverkusen',
  'gladbach': 'Borussia Mönchengladbach',
  'monchengladbach': 'Borussia Mönchengladbach',
  'frankfurt': 'Eintracht Frankfurt',
  'eintracht': 'Eintracht Frankfurt',
  'wolfsburg': 'VfL Wolfsburg',
  'vfl wolfsburg': 'VfL Wolfsburg',
  'freiburg': 'SC Freiburg',
  'sc freiburg': 'SC Freiburg',
  'hoffenheim': 'TSG Hoffenheim',
  'tsg hoffenheim': 'TSG Hoffenheim',
  'mainz': '1. FSV Mainz 05',
  'mainz 05': '1. FSV Mainz 05',
  'koln': '1. FC Köln',
  'cologne': '1. FC Köln',
  'fc koln': '1. FC Köln',
  'augsburg': 'FC Augsburg',
  'fc augsburg': 'FC Augsburg',
  'union berlin': '1. FC Union Berlin',
  'werder bremen': 'Werder Bremen',
  'bremen': 'Werder Bremen',
  'stuttgart': 'VfB Stuttgart',
  'vfb stuttgart': 'VfB Stuttgart',
  'bochum': 'VfL Bochum',
  'vfl bochum': 'VfL Bochum',
  'heidenheim': '1. FC Heidenheim',
  'darmstadt': 'SV Darmstadt 98',
  
  // Italy - Serie A
  'juve': 'Juventus',
  'juventus fc': 'Juventus',
  'inter': 'Inter Milan',
  'inter milan': 'Inter Milan',
  'internazionale': 'Inter Milan',
  'ac milan': 'AC Milan',
  'milan': 'AC Milan',
  'napoli': 'SSC Napoli',
  'ssc napoli': 'SSC Napoli',
  'roma': 'AS Roma',
  'as roma': 'AS Roma',
  'lazio': 'SS Lazio',
  'ss lazio': 'SS Lazio',
  'atalanta': 'Atalanta BC',
  'atalanta bc': 'Atalanta BC',
  'fiorentina': 'ACF Fiorentina',
  'acf fiorentina': 'ACF Fiorentina',
  'torino': 'Torino FC',
  'torino fc': 'Torino FC',
  'bologna': 'Bologna FC',
  'bologna fc': 'Bologna FC',
  'udinese': 'Udinese Calcio',
  'sassuolo': 'US Sassuolo',
  'us sassuolo': 'US Sassuolo',
  'monza': 'AC Monza',
  'ac monza': 'AC Monza',
  'empoli': 'Empoli FC',
  'empoli fc': 'Empoli FC',
  'lecce': 'US Lecce',
  'us lecce': 'US Lecce',
  'verona': 'Hellas Verona',
  'hellas verona': 'Hellas Verona',
  'salernitana': 'US Salernitana',
  'us salernitana': 'US Salernitana',
  'frosinone': 'Frosinone Calcio',
  'cagliari': 'Cagliari Calcio',
  'genoa': 'Genoa CFC',
  'genoa cfc': 'Genoa CFC',
};

/**
 * Normalize a team name to a standard format
 */
export function normalizeTeamName(name: string): string {
  if (!name) return '';
  
  const cleaned = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ');
  
  // Check if we have a mapping
  const mapped = TEAM_NAME_MAPPINGS[cleaned];
  if (mapped) {
    return mapped;
  }
  
  // Return title case version
  return name
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Calculate similarity between two team names (Levenshtein-based)
 */
export function teamNameSimilarity(name1: string, name2: string): number {
  const n1 = normalizeTeamName(name1).toLowerCase();
  const n2 = normalizeTeamName(name2).toLowerCase();
  
  if (n1 === n2) return 1;
  
  const longer = n1.length > n2.length ? n1 : n2;
  const shorter = n1.length > n2.length ? n2 : n1;
  
  if (longer.length === 0) return 1;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Levenshtein distance calculation
 */
function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) {
      costs[s2.length] = lastValue;
    }
  }
  
  return costs[s2.length];
}

/**
 * Find best matching team from a list
 */
export function findBestMatch(
  teamName: string,
  candidates: string[],
  threshold = 0.6
): { name: string; score: number } | null {
  let bestMatch: { name: string; score: number } | null = null;
  
  for (const candidate of candidates) {
    const score = teamNameSimilarity(teamName, candidate);
    if (score >= threshold && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { name: candidate, score };
    }
  }
  
  return bestMatch;
}
