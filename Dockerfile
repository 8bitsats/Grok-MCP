FROM node:20-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json ./

# Temporarily modify package.json to remove prepare script
RUN npm pkg delete scripts.prepare

# Install dependencies with production flag
RUN npm ci --quiet

# Copy source code and config files
COPY tsconfig.json ./
COPY src/ ./src/

# Build the application
# Use explicit TypeScript compilation to avoid any issues
RUN npx tsc && chmod +x build/index.js

# Set environment variable placeholder (will be filled from .env)
ENV X_AI_API_KEY=""

# Command to run the server
CMD ["node", "./build/index.js"]
