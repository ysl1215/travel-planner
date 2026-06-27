# Single-stage image with Node 20 + Python 3.11
FROM node:20-slim

# build-essential needed to compile better-sqlite3 native module
# python3 needed both for better-sqlite3 build and fast-flights runtime
RUN apt-get update && apt-get install -y \
    python3 python3-pip build-essential \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node dependencies (better-sqlite3 compiles here)
COPY package*.json ./
RUN npm ci --omit=dev

# Install Python dependencies (fast-flights is pinned to 2.2 — see requirements.txt;
# 3.x is a breaking API change vs scripts/google_flights.py)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt --break-system-packages

# Copy application code and build
COPY . .
RUN npm run build

# Ensure data directory exists for SQLite DB
RUN mkdir -p data

EXPOSE 3000
CMD ["npm", "start"]
