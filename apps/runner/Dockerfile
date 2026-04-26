FROM mcr.microsoft.com/playwright:v1.49.0-jammy

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Explicitly install Playwright browsers
RUN npx playwright install --with-deps chromium

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 4001

# Production environment
ENV NODE_ENV=production

# Start the server
CMD ["npm", "start"]
