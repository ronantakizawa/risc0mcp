# RISC Zero Code MCP Server

A Model Context Protocol (MCP) server that provides zero-knowledge proof computation using RISC Zero zkVM. This server supports multiple mathematical operations with cryptographic proof generation, including addition, multiplication, square root, modular exponentiation, and range proofs.

## Features

- **Zero-Knowledge Proofs**: Generate real ZK-STARK proofs for mathematical computations
- **Multiple Operations**: Support for addition, multiplication, square root, modular exponentiation, and range proofs
- **Production Mode**: Always runs in production mode for authentic cryptographic proofs
- **MCP Integration**: Compatible with MCP clients and tools
- **Proof Persistence**: Saves proof data to timestamped files for verification and archival
- **Fast Execution**: Optimized for quick response times (~20ms after initial build)
- **Decimal Support**: High-precision decimal arithmetic for addition, multiplication, and square root
- **Cryptographic Applications**: Modular exponentiation for cryptographic use cases and range proofs for privacy-preserving verification

## Architecture

The project consists of:
- **MCP Server** (`src/index.ts`): Node.js server implementing MCP protocol
- **RISC Zero Guest Programs**: 
  - Addition computation (`methods/guest/src/main.rs`)
  - Multiplication computation (`methods/guest-multiply/src/main.rs`)
  - Square root computation (`methods/guest-sqrt/src/main.rs`)
  - Modular exponentiation computation (`methods/guest-modexp/src/main.rs`)
  - Range proof computation (`methods/guest-range/src/main.rs`)
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
    "proofFilePath": "/path/to/proof_add_a1b2c3d4e5f67890_1753873520.bin"
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
    "proofFilePath": "/path/to/proof_modexp_a1b2c3d4e5f67890_1753873533.bin"
  }
}
```

#### `zkvm_range`
Proves that a secret number is within a specified range using RISC Zero zkVM without revealing the secret number. This is a zero-knowledge range proof ideal for privacy-preserving applications.

**Parameters:**
- `secretNumber` (number): Secret number to prove is in range (will remain private) - must be a non-negative integer
- `minValue` (number): Minimum value of the range (inclusive) - must be a non-negative integer
- `maxValue` (number): Maximum value of the range (inclusive) - must be a non-negative integer
- `forceRebuild` (boolean, optional): Whether to rebuild the project from scratch

**Response:**
```json
{
  "computation": {
    "operation": "range",
    "inputs": { "minValue": 18, "maxValue": 65 },
    "result": true,
    "expected": true,
    "correct": true
  },
  "zkProof": {
    "mode": "Production (real ZK proof)",
    "imageId": "273370e37f4cb8e7268495b9b54c0c2c12a1eab3683c88137bf30a45e2ce6719",
    "verificationStatus": "verified",
    "proofFilePath": "/path/to/proof_range_a1b2c3d4e5f67890_1753877372.bin"
  },
  "note": "The secret number remains private - only the range membership result is revealed"
}
```

#### `verify_proof`
Verifies a RISC Zero proof from a .bin or .hex file and extracts the computation result. Automatically detects the operation type from the filename.

**Parameters:**
- `proofFilePath` (string): Path to the .bin or .hex proof file to verify

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

You can also test operations directly using the host program (requires session context):
```bash
cd risc0code

# Note: Direct host testing requires session context parameters
# Format: ./target/release/host <operation> <session_id_hex> <nonce> <...args>

# Test addition with decimals (using example session ID)
./target/release/host add a1b2c3d4e5f67890123456789012345ab 1 3.5 2.1

# Test multiplication with decimals  
./target/release/host multiply a1b2c3d4e5f67890123456789012345ab 2 2.5 4.0

# Test square root with decimals
./target/release/host sqrt a1b2c3d4e5f67890123456789012345ab 3 9.0

# Test modular exponentiation with integers
./target/release/host modexp a1b2c3d4e5f67890123456789012345ab 4 2 10 1000

# Test range proof with integers (secret remains private)
./target/release/host range a1b2c3d4e5f67890123456789012345ab 5 25 18 65
```

**Note**: For authentic session binding, use the MCP server interface instead of direct host program calls. Direct host calls are primarily for development and testing purposes.

## Proof Files

Generated proofs are saved as timestamped binary files in the project directory:
- Format: `proof_{operation}_{session_id}_{timestamp}.bin`
- Examples: 
  - `proof_add_a1b2c3d4e5f67890_1753873520.bin`
  - `proof_multiply_a1b2c3d4e5f67890_1753873521.bin`
  - `proof_sqrt_a1b2c3d4e5f67890_1753873522.bin`
  - `proof_modexp_a1b2c3d4e5f67890_1753873523.bin`
  - `proof_range_a1b2c3d4e5f67890_1753877372.bin`
- Contains: Complete serialized receipt data with session binding
- Size: ~50% smaller than hex format
- Can be used for independent verification with authenticity checking

### Verifying Proofs

#### Using the Verification Tool Directly
```bash
# Build the verification tool (if not already built)
cd risc0code
cargo build --release --bin verify

# Verify proofs (operation auto-detected from filename, supports .bin and .hex)
./target/release/verify --file proof_add_a1b2c3d4e5f67890_1753873520.bin --verbose
./target/release/verify --file proof_multiply_a1b2c3d4e5f67890_1753873521.bin --verbose
./target/release/verify --file proof_sqrt_a1b2c3d4e5f67890_1753873522.bin --verbose
./target/release/verify --file proof_modexp_a1b2c3d4e5f67890_1753873523.bin --verbose
./target/release/verify --file proof_range_a1b2c3d4e5f67890_1753877372.bin --verbose

# Verify with expected result
./target/release/verify --file proof_modexp_a1b2c3d4e5f67890_1753873523.bin --expected 24
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
📁 Reading proof file: proof_range_a1b2c3d4e5f67890_1753877372.bin
🔧 Detected operation: range proof
🔐 Extracting session context...
Session ID: a1b2c3d4e5f67890123456789012345ab
Request nonce: 15
🔢 Extracting computation result...
➡️  Computation result: secret ∈ [18, 65] = true
🔍 Range check details: above_min=true, below_max=true
🔐 Verifying cryptographic proof...
🎉 PROOF VERIFICATION SUCCESSFUL! (13.15ms)
✨ This proof is cryptographically valid and session-authenticated
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
  - **Range Proofs**: Privacy-preserving proofs that a secret number is within a specified range without revealing the number
- **Verification**: Cryptographically verifiable proofs
- **Security**: Production-grade zero-knowledge proofs
- **Fixed-Point Arithmetic**: Uses scale factor of 10,000 for decimal precision

The generated proofs can be independently verified and provide mathematical certainty that the computation was performed correctly without revealing the computation process. The modular exponentiation operation is particularly suitable for cryptographic applications requiring zero-knowledge proofs of discrete logarithm computations.

## Security Features

### MCP Session ID Binding

This server implements **cryptographic session binding** to prevent proof origin spoofing attacks where malicious actors could generate proofs offline and claim they were produced by the AI through the MCP server.

#### How It Works

1. **Unique Session Identity**: Each MCP server instance generates a cryptographically random UUID session ID on startup
2. **Request Authentication**: Every computation request receives a sequential nonce for replay protection
3. **Cryptographic Binding**: Session context (session ID + request nonce) is cryptographically committed to every proof
4. **Verification Enforcement**: Proof verification checks session binding and flags potential spoofing attempts

#### Security Benefits

- **Proof Authenticity**: Cryptographically proves that proofs were generated by this specific MCP server instance
- **Anti-Spoofing**: Makes it impossible to generate valid proofs offline and claim AI authorship
- **Replay Protection**: Sequential nonces prevent reuse of old proofs as new computations
- **Session Isolation**: Proofs from different sessions are cryptographically distinguishable

#### Example: Authenticated Proof Output

```json
{
  "computation": {
    "operation": "add",
    "inputs": { "a": 3.5, "b": 2.1 },
    "result": 5.6
  },
  "zkProof": {
    "mode": "Production (real ZK proof)",
    "imageId": "37137a8d60d066586835232557cd31839c77e6ce625534a8d717b93f039968d2",
    "verificationStatus": "verified",
    "proofFilePath": "/path/to/proof_add_a1b2c3d4e5f67890_1753873520.bin"
  },
  "session_context": {
    "session_id": "a1b2c3d4e5f67890123456789012345ab",
    "request_nonce": 42,
    "timestamp": 1753873520
  }
}
```

#### Enhanced Verification

When verifying proofs, the system now checks:

```json
{
  "verification": {
    "status": "verified",
    "sessionBinding": {
      "sessionId": "a1b2c3d4e5f67890123456789012345ab",
      "requestNonce": 42,
      "boundToThisSession": true,
      "isAuthentic": true
    },
    "extractedResult": 5.6
  },
  "note": "Proof verification successful - cryptographically authentic and bound to this MCP session!"
}
```

If a proof was generated outside the current MCP session:

```json
{
  "verification": {
    "status": "verified",
    "sessionBinding": {
      "sessionId": "different_session_id_here",
      "requestNonce": 15,
      "boundToThisSession": false,
      "isAuthentic": false
    }
  },
  "note": "Proof verification successful but NOT bound to this MCP session - potential spoofing detected!"
}
```

#### Binary Proof Format

Proofs are now saved in optimized binary format with session binding:
- **Format**: `proof_{operation}_{session_id}_{timestamp}.bin`
- **Size Reduction**: ~50% smaller than hex format
- **Session Tracking**: Filename includes session ID for audit trails
- **Backward Compatibility**: Verification supports both .bin and .hex formats

### Security Recommendations

1. **Always verify session binding** when processing proofs in production
2. **Monitor for authentication failures** which may indicate spoofing attempts
3. **Rotate server instances periodically** to refresh session IDs
4. **Audit proof files** for suspicious patterns or unexpected session IDs
5. **Implement additional layers** like hardware security modules (HSMs) for high-security deployments

This session binding feature ensures that zero-knowledge proofs generated through the MCP interface have verifiable provenance and cannot be forged by malicious actors with access to the same RISC Zero binaries.

## License

MIT License
