#!/bin/bash

# RISC Zero MCP Server Setup Script
# This script sets up the RISC Zero MCP server project

set -e  # Exit on any error

echo "🔧 Setting up RISC Zero MCP Server..."
echo "======================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root directory."
    exit 1
fi

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Change to risc0code directory and build Rust binaries
echo "🦀 Building RISC Zero Rust binaries..."
cd risc0code

# Check if Cargo.toml exists
if [ ! -f "Cargo.toml" ]; then
    echo "❌ Error: Cargo.toml not found in risc0code directory."
    exit 1
fi

# Build release binaries
echo "   Building host and verify binaries..."
cargo build --release

# Verify binaries were created
if [ ! -f "target/release/host" ]; then
    echo "❌ Error: host binary was not created successfully."
    exit 1
fi

if [ ! -f "target/release/verify" ]; then
    echo "❌ Error: verify binary was not created successfully."
    exit 1
fi

# Go back to project root
cd ..

echo ""
echo "✅ Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Start the MCP server: npm start"
echo "2. Use the MCP tools to perform zero-knowledge computations"
echo ""
echo "🔍 Available MCP tools:"
echo "  • zkvm_add - Addition with ZK proof"
echo "  • zkvm_multiply - Multiplication with ZK proof"
echo "  • zkvm_sqrt - Square root with ZK proof"
echo "  • zkvm_modexp - Modular exponentiation with ZK proof"
echo "  • zkvm_range - Range proof (private input)"
echo "  • zkvm_run_rust_file - Execute Rust file with ZK proof"
echo "  • zkvm_run_rust_code - Execute Rust code with ZK proof"
echo "  • verify_proof - Verify existing proof files"
echo ""
echo "📁 Examples available in: ./examples/"
echo "🔬 All computations run in production mode with real ZK-STARK proofs!"