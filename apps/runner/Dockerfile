FROM mcr.microsoft.com/playwright:v1.49.0-jammy

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies to save space/memory
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 4001

# Production environment
ENV NODE_ENV=production
# This tells Playwright to use the browsers already built into the image
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Start the server
CMD ["npm", "start"]
