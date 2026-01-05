import axios from 'axios';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { getCachedOrFetch } from '../utils/cache.js';
import { WeatherData } from '../models/types.js';

/**
 * OpenWeatherMap API Client
 * https://openweathermap.org/api
 */

const BASE_URL = 'https://api.openweathermap.org/data/2.5';

interface OpenWeatherResponse {
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
  };
  weather: Array<{
    description: string;
    icon: string;
    main: string;
  }>;
  wind: {
    speed: number;
    deg: number;
  };
  rain?: {
    '1h'?: number;
    '3h'?: number;
  };
  snow?: {
    '1h'?: number;
    '3h'?: number;
  };
  name: string;
}

/**
 * Convert wind degrees to direction
 */
function getWindDirection(degrees: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

/**
 * Assess weather impact on match
 */
function assessWeatherImpact(weather: OpenWeatherResponse): {
  impact: 'none' | 'low' | 'medium' | 'high';
  description: string;
} {
  const temp = weather.main.temp;
  const windSpeed = weather.wind.speed;
  const rain = weather.rain?.['1h'] || weather.rain?.['3h'] || 0;
  const snow = weather.snow?.['1h'] || weather.snow?.['3h'] || 0;
  const weatherMain = weather.weather[0]?.main.toLowerCase();
  
  let impact: 'none' | 'low' | 'medium' | 'high' = 'none';
  const factors: string[] = [];
  
  // Temperature impact
  if (temp < 0) {
    impact = 'high';
    factors.push('température glaciale');
  } else if (temp < 5) {
    impact = impact === 'none' ? 'medium' : impact;
    factors.push('froid intense');
  } else if (temp > 35) {
    impact = 'high';
    factors.push('chaleur extrême');
  } else if (temp > 30) {
    impact = impact === 'none' ? 'medium' : impact;
    factors.push('forte chaleur');
  }
  
  // Wind impact
  if (windSpeed > 15) {
    impact = 'high';
    factors.push('vent très fort');
  } else if (windSpeed > 10) {
    impact = impact === 'none' ? 'medium' : impact;
    factors.push('vent fort');
  } else if (windSpeed > 6) {
    impact = impact === 'none' ? 'low' : impact;
    factors.push('vent modéré');
  }
  
  // Rain impact
  if (rain > 5 || weatherMain === 'thunderstorm') {
    impact = 'high';
    factors.push('fortes pluies');
  } else if (rain > 2) {
    impact = impact === 'none' ? 'medium' : impact;
    factors.push('pluie modérée');
  } else if (rain > 0 || weatherMain === 'rain' || weatherMain === 'drizzle') {
    impact = impact === 'none' ? 'low' : impact;
    factors.push('pluie légère');
  }
  
  // Snow impact
  if (snow > 0) {
    impact = 'high';
    factors.push('neige');
  }
  
  let description = 'Conditions normales pour jouer';
  if (factors.length > 0) {
    description = `Impact: ${factors.join(', ')}`;
  }
  
  return { impact, description };
}

/**
 * Get current weather for a city
 */
export async function getWeather(city: string, countryCode?: string): Promise<WeatherData | null> {
  if (!config.OPENWEATHER_API_KEY) {
    logger.warn('OpenWeather API key not configured');
    return null;
  }
  
  const location = countryCode ? `${city},${countryCode}` : city;
  const cacheKey = `weather:${location.toLowerCase()}`;
  
  return getCachedOrFetch(cacheKey, async () => {
    try {
      const response = await axios.get<OpenWeatherResponse>(`${BASE_URL}/weather`, {
        params: {
          q: location,
          appid: config.OPENWEATHER_API_KEY,
          units: 'metric',
          lang: 'fr',
        },
        timeout: 5000,
      });
      
      const data = response.data;
      const { impact, description: impactDescription } = assessWeatherImpact(data);
      
      return {
        temperature: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        humidity: data.main.humidity,
        windSpeed: Math.round(data.wind.speed * 3.6), // Convert m/s to km/h
        windDirection: getWindDirection(data.wind.deg),
        precipitation: data.rain?.['1h'] || data.rain?.['3h'] || 0,
        description: data.weather[0]?.description || 'N/A',
        icon: data.weather[0]?.icon,
        impact,
        impactDescription,
      };
    } catch (error) {
      logger.error('Failed to fetch weather', { city, error });
      return null;
    }
  }, 1800); // Cache for 30 minutes
}

/**
 * Get weather forecast for a specific date and time
 */
export async function getWeatherForecast(
  city: string,
  matchDateTime: Date,
  countryCode?: string
): Promise<WeatherData | null> {
  if (!config.OPENWEATHER_API_KEY) {
    logger.warn('OpenWeather API key not configured');
    return null;
  }
  
  const location = countryCode ? `${city},${countryCode}` : city;
  const cacheKey = `weather-forecast:${location.toLowerCase()}:${matchDateTime.toISOString()}`;
  
  return getCachedOrFetch(cacheKey, async () => {
    try {
      const response = await axios.get(`${BASE_URL}/forecast`, {
        params: {
          q: location,
          appid: config.OPENWEATHER_API_KEY,
          units: 'metric',
          lang: 'fr',
        },
        timeout: 5000,
      });
      
      // Find the closest forecast time to match time
      const forecasts = response.data.list;
      let closestForecast = forecasts[0];
      let minDiff = Infinity;
      
      for (const forecast of forecasts) {
        const forecastTime = new Date(forecast.dt * 1000);
        const diff = Math.abs(forecastTime.getTime() - matchDateTime.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          closestForecast = forecast;
        }
      }
      
      const data = closestForecast;
      const { impact, description: impactDescription } = assessWeatherImpact(data);
      
      return {
        temperature: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        humidity: data.main.humidity,
        windSpeed: Math.round(data.wind.speed * 3.6),
        windDirection: getWindDirection(data.wind.deg),
        precipitation: data.rain?.['3h'] || 0,
        description: data.weather[0]?.description || 'N/A',
        icon: data.weather[0]?.icon,
        impact,
        impactDescription,
      };
    } catch (error) {
      logger.error('Failed to fetch weather forecast', { city, matchDateTime, error });
      return null;
    }
  }, 3600); // Cache for 1 hour
}
