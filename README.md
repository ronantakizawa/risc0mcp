# RISC Zero MCP Server

A Model Context Protocol (MCP) server that provides zero-knowledge proof computation using RISC Zero zkVM. This server allows users to perform addition operations with cryptographic proof generation.

## Features

- **Zero-Knowledge Proofs**: Generate real ZK-STARK proofs for addition computations
- **Production Mode**: Always runs in production mode for authentic cryptographic proofs
- **MCP Integration**: Compatible with MCP clients and tools
- **Proof Persistence**: Saves proof data to files for verification and archival
- **Fast Execution**: Optimized for quick response times (~20ms after initial build)

## Architecture

The project consists of:
- **MCP Server** (`src/index.ts`): Node.js server implementing MCP protocol
- **RISC Zero Guest Program** (`risc0-addition/methods/guest/src/main.rs`): Addition computation in zkVM
- **RISC Zero Host Program** (`risc0-addition/host/src/main.rs`): Proof generation and verification

## Prerequisites

- Node.js 18+ 
- Rust toolchain
- RISC Zero toolkit

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd risc0mcp
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Build the TypeScript server:
```bash
npm run build
```

4. Build the RISC Zero project:
```bash
cd risc0-addition
cargo build --release
cd ..
```

## Usage

### Running the MCP Server

Start the server in stdio mode:
```bash
node dist/index.js
```

### Available Tools

#### `zkvm_add`
Performs addition of two numbers using RISC Zero zkVM and returns the result with ZK proof receipt.

**Parameters:**
- `a` (number): First number to add
- `b` (number): Second number to add  
- `forceRebuild` (boolean, optional): Whether to rebuild the project from scratch

**Response:**
```json
{
  "computation": {
    "operation": "addition",
    "inputs": { "a": 5, "b": 7 },
    "result": 12,
    "expected": 12,
    "correct": true
  },
  "zkProof": {
    "mode": "Production (real ZK proof)",
    "imageId": "...",
    "journalBytes": [...],
    "verificationStatus": "verified",
    "proofExists": true,
    "proofSizeBytes": 1234,
    "proofFilePath": "/path/to/proof_5_7.hex"
  },
  "note": "Real zero-knowledge proof generated and verified!"
}
```

## Testing

Test the server with the included test script:
```bash
node test-simple.js
```

## Proof Files

Generated proofs are saved as hex files in the project directory:
- Format: `proof_{a}_{b}.hex`
- Contains: Complete serialized receipt data
- Can be used for independent verification

## Development

### Building
```bash
npm run build
```

### Force Rebuild RISC Zero
```bash
cd risc0-addition
cargo clean
cargo build --release
```

## Performance

- **Initial build**: ~30-60 seconds (one-time setup)
- **Subsequent executions**: ~20ms
- **Proof generation**: ~5-15 seconds depending on hardware

## Zero-Knowledge Proof Details

This server generates authentic ZK-STARK proofs using RISC Zero's zkVM:

- **Proving System**: ZK-STARK (Zero-Knowledge Scalable Transparent ARgument of Knowledge)
- **Circuit**: Addition of two 32-bit unsigned integers
- **Verification**: Cryptographically verifiable proofs
- **Security**: Production-grade zero-knowledge proofs

The generated proofs can be independently verified and provide mathematical certainty that the computation was performed correctly without revealing the computation process.

## License

MIT License
