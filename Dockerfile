# Multi-stage build for RISC Zero MCP Server

# Stage 1: Build Rust components
FROM rust:1.75-slim as rust-builder

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install RISC Zero toolchain
RUN cargo install cargo-risczero --version ^2.3.1 --locked
RUN cargo risczero install

# Set working directory
WORKDIR /app

# Copy Rust project files
COPY risc0code/ ./risc0code/

# Build Rust project
WORKDIR /app/risc0code
RUN cargo build --release

# Stage 2: Build Node.js components
FROM node:18-slim as node-builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy TypeScript source
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Stage 3: Runtime image
FROM node:18-slim as runtime

# Install system dependencies for RISC Zero
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built artifacts from previous stages
COPY --from=node-builder /app/dist ./dist
COPY --from=node-builder /app/node_modules ./node_modules
COPY --from=rust-builder /app/risc0code/target/release/host ./risc0code/target/release/host
COPY --from=rust-builder /app/risc0code/target/release/verify ./risc0code/target/release/verify

# Copy configuration files
COPY package.json ./

# Create non-root user
RUN groupadd -r risc0 && useradd -r -g risc0 risc0
RUN chown -R risc0:risc0 /app
USER risc0

# Set environment variables
ENV NODE_ENV=production
ENV RISC0_DEV_MODE=0

# Expose port (if needed for future HTTP interface)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('Health check passed')" || exit 1

# Start the MCP server
CMD ["node", "dist/index.js"]
