# ⚽ FootBot - Bot Telegram d'Analyse Football IA

Bot Telegram intelligent qui analyse des screenshots de matchs de football et fournit des pronostics détaillés avec probabilités et suggestions de paris.

## ✨ Fonctionnalités

- 📸 **Analyse de screenshots** - Envoie une image, le bot extrait automatiquement le match
- 🤖 **IA Gemini Vision** - Utilise Google Gemini pour l'OCR et l'analyse
- 📊 **Statistiques complètes** - Forme récente, blessures, météo, enjeux
- 💰 **Suggestions de paris** - Probabilités calculées avec niveau de risque
- 🔄 **Corrections interactives** - Boutons Telegram pour corriger ou relancer

## 🚀 Installation

### Prérequis

- Node.js 18+
- Un bot Telegram (créé via [@BotFather](https://t.me/BotFather))
- Une clé API Google Gemini
- (Optionnel) Clé API Football-Data.org
- (Optionnel) Clé API OpenWeatherMap

### Installation

```bash
# Cloner le repo
cd FootBot

# Installer les dépendances
npm install

# Copier le fichier de configuration
cp .env.example .env

# Éditer .env avec vos clés API
nano .env
```

### Configuration (.env)

```env
# Telegram Bot (obligatoire)
TELEGRAM_BOT_TOKEN=votre_token_telegram

# Google Gemini (obligatoire)
GEMINI_API_KEY=votre_clé_gemini

# Football Data (optionnel mais recommandé)
FOOTBALL_DATA_API_KEY=votre_clé_football_data

# Weather (optionnel)
OPENWEATHER_API_KEY=votre_clé_openweather
```

### Obtenir les clés API

1. **Telegram Bot Token**

   - Parle à [@BotFather](https://t.me/BotFather) sur Telegram
   - Envoie `/newbot` et suis les instructions
   - Copie le token fourni

2. **Google Gemini API**

   - Va sur [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Crée une nouvelle clé API
   - Copie la clé

3. **Football-Data.org** (gratuit)

   - Inscris-toi sur [football-data.org](https://www.football-data.org/client/register)
   - La clé API sera dans ton email

4. **OpenWeatherMap** (gratuit)
   - Inscris-toi sur [openweathermap.org](https://home.openweathermap.org/users/sign_up)
   - Crée une clé API dans ton compte

## 🎮 Utilisation

### Démarrer le bot

```bash
# Mode développement (avec hot reload)
npm run dev

# Mode production
npm run build
npm start
```

### Commandes Telegram

| Commande                    | Description                     |
| --------------------------- | ------------------------------- |
| `/start`                    | Démarrer le bot et voir l'aide  |
| `/help`                     | Afficher le guide d'utilisation |
| `/analyze PSG vs Marseille` | Analyser un match manuellement  |

### Envoyer un screenshot

1. Ouvre ton application de paris sportifs
2. Fais un screenshot d'un match pré-match
3. Envoie l'image au bot sur Telegram
4. Le bot analyse et répond avec un rapport complet

## 📋 Structure du rapport

```
⚽ MATCH ANALYSIS
═══════════════════════

📋 Résumé
• Match: PSG vs Marseille
• Compétition: Ligue 1
• Date/Heure: 2024-01-15 21:00
• Confiance: 85/100

📊 Analyse
🏟️ Lieu: Avantage domicile modéré
✈️ Voyage: Faible impact (train Paris-Marseille)
🏥 Blessures: 2 blessés côté PSG
🌦️ Météo: Conditions normales
📈 Forme: PSG en meilleure forme (WWDWW vs LDWLW)
⚔️ Match-up: Attaque PSG vs défense OM
🎯 Enjeux: Match important pour le titre

📈 Probabilités
🏠 Victoire PSG: 55%
🤝 Match nul: 25%
✈️ Victoire OM: 20%
⚽ Over 2.5: 65%
✅ BTTS Oui: 55%

💰 Paris suggérés
• 1X2: Victoire PSG
  📊 55% | ⚠️ Risque: faible
• Over 2.5 buts
  📊 65% | ⚠️ Risque: faible
```

## 🏗️ Architecture

```
src/
├── index.ts           # Point d'entrée
├── config/            # Configuration & validation
├── bot/               # Handlers Telegram
├── ocr/               # Gemini Vision OCR
├── api/               # APIs externes (football, météo)
├── analysis/          # Moteur d'analyse
├── models/            # Types & schémas
└── utils/             # Utilitaires (cache, logs, normalisation)
```

## 🔧 APIs utilisées

| API               | Usage            | Plan gratuit |
| ----------------- | ---------------- | ------------ |
| Google Gemini     | OCR + Analyse IA | 60 req/min   |
| Football-Data.org | Stats football   | 10 req/min   |
| OpenWeatherMap    | Météo            | 60 req/min   |

## 🚀 Déploiement (Render)

1. Push ton code sur GitHub
2. Crée un nouveau Web Service sur [Render](https://render.com)
3. Connecte ton repo GitHub
4. Configure les variables d'environnement
5. Build command: `npm install && npm run build`
6. Start command: `npm start`

## 📝 TODO

- [ ] MongoDB pour persistence
- [ ] Plus d'APIs football (API-Football, etc.)
- [ ] Historique des analyses
- [ ] Notifications pour matchs suivis
- [ ] Dashboard web admin
- [ ] Support multi-langues

## ⚠️ Avertissement

Ce bot est fourni à titre informatif uniquement. Les paris sportifs comportent des risques financiers. Jouez de manière responsable.

## 📄 License

ISC
# Footbot
