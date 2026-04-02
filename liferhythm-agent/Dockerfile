FROM node:22-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# The bot is the long-running entrypoint.
# Override CMD to run the CLI or tests instead:
#   docker run liferhythm node index.js "your message"
#   docker run liferhythm npm test
CMD ["node", "bot.js"]
