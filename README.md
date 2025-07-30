# RISC Zero Code MCP Server

A Model Context Protocol (MCP) server that provides zero-knowledge proof computation using RISC Zero zkVM. This server supports multiple mathematical operations with cryptographic proof generation, including addition, multiplication, square root, and modular exponentiation.

## Features

- **Zero-Knowledge Proofs**: Generate real ZK-STARK proofs for mathematical computations
- **Multiple Operations**: Support for addition, multiplication, square root, and modular exponentiation
- **Production Mode**: Always runs in production mode for authentic cryptographic proofs
- **MCP Integration**: Compatible with MCP clients and tools
- **Proof Persistence**: Saves proof data to timestamped files for verification and archival
- **Fast Execution**: Optimized for quick response times (~20ms after initial build)
- **Decimal Support**: High-precision decimal arithmetic for addition, multiplication, and square root
- **Cryptographic Applications**: Modular exponentiation for cryptographic use cases

## Architecture

The project consists of:
- **MCP Server** (`src/index.ts`): Node.js server implementing MCP protocol
- **RISC Zero Guest Programs**: 
  - Addition computation (`methods/guest/src/main.rs`)
  - Multiplication computation (`methods/guest-multiply/src/main.rs`)
  - Square root computation (`methods/guest-sqrt/src/main.rs`)
  - Modular exponentiation computation (`methods/guest-modexp/src/main.rs`)
- **RISC Zero Host Program** (`host/src/main.rs`): Proof generation and verification
- **Verification Tool** (`verify/src/main.rs`): Independent proof verification

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
cd risc0code
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
Performs addition of two decimal numbers using RISC Zero zkVM and returns the result with ZK proof receipt.

**Parameters:**
- `a` (number): First number to add (supports decimal values)
- `b` (number): Second number to add (supports decimal values)
- `forceRebuild` (boolean, optional): Whether to rebuild the project from scratch

**Response:**
```json
{
  "computation": {
    "operation": "add",
    "inputs": { "a": 3.5, "b": 2.1 },
    "result": 5.6,
    "expected": 5.6,
    "correct": true
  },
  "zkProof": {
    "mode": "Production (real ZK proof)",
    "imageId": "37137a8d60d066586835232557cd31839c77e6ce625534a8d717b93f039968d2",
    "verificationStatus": "verified",
    "proofFilePath": "/path/to/proof_add_1753873520.hex"
  }
}
```

#### `zkvm_multiply`
Performs multiplication of two decimal numbers using RISC Zero zkVM and returns the result with ZK proof receipt.

**Parameters:**
- `a` (number): First number to multiply (supports decimal values)
- `b` (number): Second number to multiply (supports decimal values)
- `forceRebuild` (boolean, optional): Whether to rebuild the project from scratch

#### `zkvm_sqrt`
Computes the square root of a decimal number using RISC Zero zkVM and returns the result with ZK proof receipt.

**Parameters:**
- `n` (number): Number to compute square root for (must be non-negative, supports decimal values)
- `forceRebuild` (boolean, optional): Whether to rebuild the project from scratch

#### `zkvm_modexp`
Performs modular exponentiation (a^b mod n) using RISC Zero zkVM and returns the result with ZK proof receipt. Ideal for cryptographic applications.

**Parameters:**
- `base` (number): Base number (a) - must be a non-negative integer
- `exponent` (number): Exponent (b) - must be a non-negative integer
- `modulus` (number): Modulus (n) - must be a positive integer
- `forceRebuild` (boolean, optional): Whether to rebuild the project from scratch

**Response:**
```json
{
  "computation": {
    "operation": "modexp",
    "inputs": { "base": 2, "exponent": 10, "modulus": 1000 },
    "result": 24,
    "expected": 24,
    "correct": true
  },
  "zkProof": {
    "mode": "Production (real ZK proof)",
    "imageId": "55dff028e6a06ea7c1d8c159cd63ce13966dc196543e1db411ee303640e21c4d",
    "verificationStatus": "verified",
    "proofFilePath": "/path/to/proof_modexp_1753873533.hex"
  }
}
```

#### `verify_proof`
Verifies a RISC Zero proof from a hex file and extracts the computation result. Automatically detects the operation type from the filename.

**Parameters:**
- `proofFilePath` (string): Path to the .hex proof file to verify

**Response:**
```json
{
  "verification": {
    "status": "verified",
    "extractedResult": 24,
    "verificationTimeMs": 13,
    "proofDetails": {
      "imageId": "55dff028e6a06ea7c1d8c159cd63ce13966dc196543e1db411ee303640e21c4d",
      "journalBytes": "[2, 0, 0, 0, 0, 0, 0, 0, 10, 0, 0, 0, 0, 0, 0, 0, 232, 3, 0, 0, 0, 0, 0, 0, 24, 0, 0, 0, 0, 0, 0, 0]",
      "proofSizeBytes": 419124,
      "verificationTime": "13.15ms"
    },
    "rawOutput": "🔍 RISC Zero Proof Verifier...",
    "rawStderr": ""
  },
  "note": "Proof verification successful - cryptographically authentic!"
}
```

## Testing

Test the server with the included test scripts:
```bash
# Test zkvm_add function
node test-simple.js

# Test verify_proof function
node test-verify.js
```

You can also test operations directly using the host program:
```bash
cd risc0code

# Test addition with decimals
./target/release/host add 3.5 2.1

# Test multiplication with decimals  
./target/release/host multiply 2.5 4.0

# Test square root with decimals
./target/release/host sqrt 9.0

# Test modular exponentiation with integers
./target/release/host modexp 2 10 1000
```

## Proof Files

Generated proofs are saved as timestamped hex files in the project directory:
- Format: `proof_{operation}_{timestamp}.hex`
- Examples: 
  - `proof_add_1753873520.hex`
  - `proof_multiply_1753873521.hex`
  - `proof_sqrt_1753873522.hex`
  - `proof_modexp_1753873523.hex`
- Contains: Complete serialized receipt data
- Can be used for independent verification

### Verifying Proofs

#### Using the Verification Tool Directly
```bash
# Build the verification tool (if not already built)
cd risc0code
cargo build --release --bin verify

# Verify proofs (operation auto-detected from filename)
./target/release/verify --file proof_add_1753873520.hex --verbose
./target/release/verify --file proof_multiply_1753873521.hex --verbose
./target/release/verify --file proof_sqrt_1753873522.hex --verbose
./target/release/verify --file proof_modexp_1753873523.hex --verbose

# Verify with expected result
./target/release/verify --file proof_modexp_1753873523.hex --expected 24
```

#### Verification Output
A successful verification will show:
- 🔍 RISC Zero Proof Verifier initialization
- 📁 Reading and decoding proof file
- 🔧 Detected operation type (auto-detected)
- ➡️ Extracted computation result
- 🔐 Cryptographic verification status
- 🎉 PROOF VERIFICATION SUCCESSFUL!
- 📊 Detailed proof information (with --verbose)

Example output:
```
🔍 RISC Zero Proof Verifier
══════════════════════════
📁 Reading proof file: proof_modexp_1753873523.hex
🔧 Detected operation: modular exponentiation
➡️  Computation result: 2^10 mod 1000 = 24
🔐 Verifying cryptographic proof...
🎉 PROOF VERIFICATION SUCCESSFUL! (13.15ms)
✨ This proof is cryptographically valid and authentic
```

## Development

### Building
```bash
npm run build
```

### Force Rebuild RISC Zero
```bash
cd risc0code
cargo clean
cargo build --release
```

## Performance

- **Initial build**: ~30-60 seconds (one-time setup)
- **Subsequent executions**: ~3-5 seconds for proof generation
- **Proof verification**: ~10-20ms
- **Proof file size**: ~400KB per proof

## Zero-Knowledge Proof Details

This server generates authentic ZK-STARK proofs using RISC Zero's zkVM:

- **Proving System**: ZK-STARK (Zero-Knowledge Scalable Transparent ARgument of Knowledge)
- **Supported Operations**: 
  - **Addition**: Decimal numbers with 4 decimal places precision
  - **Multiplication**: Decimal numbers with 4 decimal places precision
  - **Square Root**: Decimal numbers using binary search algorithm
  - **Modular Exponentiation**: Integer operations using binary exponentiation for cryptographic applications
- **Verification**: Cryptographically verifiable proofs
- **Security**: Production-grade zero-knowledge proofs
- **Fixed-Point Arithmetic**: Uses scale factor of 10,000 for decimal precision

The generated proofs can be independently verified and provide mathematical certainty that the computation was performed correctly without revealing the computation process. The modular exponentiation operation is particularly suitable for cryptographic applications requiring zero-knowledge proofs of discrete logarithm computations.

## License

MIT License
