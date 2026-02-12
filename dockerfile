# Base Image
# Use official lightweight Node.js image (Debian-based)
# "slim" = smaller size but still compatible with ffmpeg + yt-dlp binary
FROM node:20-slim


# Install System Dependencies
#
# ffmpeg           → required to merge video + audio streams
# curl             → used to download yt-dlp binary
# ca-certificates  → ensures HTTPS requests work inside container
#
# --no-install-recommends → prevents installing unnecessary extra packages
#
# Then:
# - Download latest standalone yt-dlp binary
# - Move it to /usr/local/bin so it's globally accessible
# - Make it executable
# - Clean apt cache to reduce image size
# - Verify installation

RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    ca-certificates \
    --no-install-recommends \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
     -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* \
  && yt-dlp --version \
  && ffmpeg -version | head -1


# Set Working Directory
#
# All future commands will run inside /app

WORKDIR /app


# Copy package.json First (Docker Layer Optimization)
#
# copy only package files first so Docker can cache npm install layer.
# If only app code changes, dependencies won’t reinstall every build.

COPY package*.json ./


# Install Node Dependencies
#
# --omit=dev → skips devDependencies (production build optimization)
# Makes image smaller and faster.

RUN npm install --omit=dev


# Copy Remaining Project Files
#
# Copies:
# - server.js
# - frontend files
# - cookies.txt (if present)
# - other project files

COPY . .


# Expose Port
#
# Tells Docker that container listens on port 3000.

EXPOSE 3000


# Create Volume for /tmp
#
# yt-dlp temporarily stores video chunks in /tmp.
# Using VOLUME allows:
# - safer temp storage
# - optional external mounting

VOLUME ["/tmp"]


# Healthcheck
#
# Docker periodically checks if your app is alive.
# If curl fails → container marked unhealthy.
#
# interval      → every 30 seconds
# timeout       → wait 10 seconds
# start-period  → wait 20 seconds before first check
# retries       → fail after 3 attempts

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1


# Default Command
#
# This runs when container starts.

CMD ["node", "server.js"]
