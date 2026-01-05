FROM node:20-alpine

WORKDIR /app

# Install dependencies strictly
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the project (TypeScript)
RUN npm run build

# Remove development dependencies
RUN npm prune --production

# Expose port (Render sets this env var automatically, but good for doc)
EXPOSE 3000

# Start command
CMD ["npm", "start"]
