# RISC Zero MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Model Context Protocol (MCP) server that provides zero-knowledge proof computation using RISC Zero zkVM. This server supports dynamic Rust code execution, pre-built mathematical operations, and cryptographic proof generation with real image ID verification.

## Features

- **🚀 Dynamic Rust Execution**: Compile and execute arbitrary Rust code in the zkVM
- **🔐 Zero-Knowledge Proofs**: Generate real ZK-STARK proofs with authentic image ID verification
- **📚 Pre-built Operations**: Addition, multiplication, square root, modular exponentiation, and range proofs
- **🏭 Production & Development Modes**: Full ZK-STARK proofs or fast development execution
- **🔗 MCP Integration**: Compatible with Claude and other MCP clients
- **💾 Proof Persistence**: Timestamped binary proof files for verification and archival
- **⚡ Optimized Performance**: ~3-5 seconds for proof generation after initial build
- **🔢 High-Precision Arithmetic**: Fixed-point decimal support for mathematical operations
- **🔒 Real Image ID Verification**: Cryptographically authentic image IDs computed from ELF data
- **🐳 Docker-based Compilation**: Consistent RISC-V cross-compilation environment

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

- **Node.js 18+** with npm
- **Rust toolchain** (1.70+) with cargo
- **RISC Zero toolkit** for zero-knowledge proof generation
- **Docker** (for dynamic Rust compilation)
- **Git** (for cloning the repository)

## Installation

### Step 1: Clone the Repository
```bash
git clone https://github.com/ronantakizawa/risc0mcp.git
cd risc0mcp
```

### Step 2: Install Rust and RISC Zero Toolkit
```bash
# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Install RISC Zero toolkit
cargo install cargo-risczero --version ^2.3.1
cargo risczero install
```

### Step 3: Install Node.js Dependencies
```bash
npm install
```

### Step 4: Build the Project
```bash
# Build TypeScript MCP server
npm run build

# Build RISC Zero host and verification binaries
cd risc0code
cargo build --release
cd ..
```

### Step 5: Start Docker (Required for Dynamic Compilation)
Make sure Docker is running on your system:
```bash
# On macOS/Linux
docker --version

# Start Docker if not running
# On macOS: Open Docker Desktop
# On Linux: sudo systemctl start docker
```

## Setup with Claude Desktop

### Step 1: Configure Claude Desktop
Add the RISC Zero MCP server to your Claude Desktop configuration file:

**On macOS:**
```bash
# Edit Claude Desktop config
code ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**On Windows:**
```bash
# Edit Claude Desktop config
notepad %APPDATA%\Claude\claude_desktop_config.json
```

**On Linux:**
```bash
# Edit Claude Desktop config
code ~/.config/Claude/claude_desktop_config.json
```

### Step 2: Add MCP Server Configuration
Add the following configuration to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "risc0-zkvm": {
      "command": "node",
      "args": ["/absolute/path/to/risc0mcp/dist/index.js"],
      "env": {
        "RISC0_DEV_MODE": "0"
      }
    }
  }
}
```

**Important:** Replace `/absolute/path/to/risc0mcp` with the full path to your cloned repository.

**Example paths:**
- macOS: `/Users/yourname/risc0mcp/dist/index.js`
- Windows: `C:\\Users\\yourname\\risc0mcp\\dist\\index.js`
- Linux: `/home/yourname/risc0mcp/dist/index.js`

### Step 3: Environment Configuration

**For Development Mode (Faster, No Real Proofs):**
```json
{
  "mcpServers": {
    "risc0-zkvm": {
      "command": "node",
      "args": ["/absolute/path/to/risc0mcp/dist/index.js"],
      "env": {
        "RISC0_DEV_MODE": "1"
      }
    }
  }
}
```

**For Production Mode (Real ZK-STARK Proofs):**
```json
{
  "mcpServers": {
    "risc0-zkvm": {
      "command": "node",
      "args": ["/absolute/path/to/risc0mcp/dist/index.js"],
      "env": {
        "RISC0_DEV_MODE": "0"
      }
    }
  }
}
```

### Step 4: Restart Claude Desktop
After updating the configuration:
1. **Quit Claude Desktop completely**
2. **Restart Claude Desktop**
3. **Wait for initialization** (may take 10-15 seconds)

### Step 5: Verify Installation
In Claude Desktop, try asking:
> "Can you add 3.5 and 2.1 using the RISC Zero zkVM?"

Claude should respond with a zero-knowledge proof of the computation!

## Usage

The MCP server runs automatically when Claude Desktop starts. You can interact with it through natural language in Claude Desktop.

### Example Prompts

**Mathematical Operations:**
- "Add 15.7 and 23.4 using zero-knowledge proofs"
- "Calculate the square root of 144 with cryptographic verification"
- "Multiply 2.5 by 8.3 and generate a ZK proof"

**Cryptographic Operations:**
- "Compute 2^10 mod 1000 using modular exponentiation"
- "Prove that my secret number is between 18 and 65 (range proof)"

**Dynamic Rust Execution:**
- "Execute this Rust code in the zkVM: [paste your Rust code]"
- "Compile and run a Fibonacci function for n=10"

### Environment Modes

**Development Mode** (`RISC0_DEV_MODE=1`):
- ⚡ Fast execution (~1-2 seconds)
- ❌ No real cryptographic proofs
- ✅ Great for testing and development

**Production Mode** (`RISC0_DEV_MODE=0`):
- 🐌 Slower execution (~3-5 seconds)
- ✅ Real ZK-STARK proofs
- 🔐 Cryptographically verifiable results

## Troubleshooting

### Common Issues

**"MCP server failed to start"**
```bash
# Check if Node.js can find the script
node /absolute/path/to/risc0mcp/dist/index.js

# Verify the path exists
ls -la /absolute/path/to/risc0mcp/dist/index.js
```

**"RISC Zero binary not found"**
```bash
# Rebuild the RISC Zero binaries
cd risc0code
cargo build --release

# Verify binaries exist
ls -la target/release/host
ls -la target/release/verify
```

**"Docker connection failed"**
```bash
# Check Docker is running
docker ps

# Test Docker access
docker run hello-world
```

**"Rust/Cargo not found"**
```bash
# Ensure Rust is in your PATH
which cargo
source $HOME/.cargo/env

# Verify RISC Zero installation
cargo risczero --version
```

**"TypeScript build errors"**
```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

### Getting Help

1. **Check the Claude Desktop logs** for detailed error messages
2. **Run the MCP server directly** to see console output:
   ```bash
   cd risc0mcp
   RISC0_DEV_MODE=1 node dist/index.js
   ```
3. **Verify all prerequisites** are installed and working
4. **Check file permissions** on the dist/index.js file

### Performance Tips

- Use **Development Mode** for testing and experimentation
- Use **Production Mode** only when you need verifiable proofs
- **Docker startup** can take 30-60 seconds for the first dynamic compilation
- **Proof files** are saved in the project directory for verification

### Available Tools

#### `zkvm_run_rust_file`
**NEW**: Compiles and executes a Rust file in RISC Zero zkVM with zero-knowledge proof generation.

**Parameters:**
- `filepath` (string): Path to the Rust source file to compile and execute
- `inputs` (object): JSON inputs to pass to the guest program

**Response:**
```json
{
  "computation": {
    "operation": "dynamic_rust",
    "codeHash": "5209888b6be4687c",
    "inputs": [2],
    "result": 1,
    "executionTimeMs": 3021
  },
  "zkProof": {
    "mode": "Production (real ZK proof)",
    "imageId": "4d48e6780c51ffda178cd619c09e6349e244ed9ec2bd7a95db4be498dec8b6d6",
    "verificationStatus": "verified",
    "proofFilePath": "/path/to/proof_precompiled_1754056003.bin"
  },
  "dynamicExecution": {
    "tempGuestName": "guest-dynamic-5209888b6be4687c",
    "codeLength": 1275,
    "successful": true
  }
}
```

#### `zkvm_run_rust_code`
**NEW**: Compiles and executes Rust code provided as text in RISC Zero zkVM with zero-knowledge proof generation.

**Parameters:**
- `code` (string): Rust source code to compile and execute
- `inputs` (object): JSON inputs to pass to the guest program

**Example Rust Code:**
```rust
use risc0_zkvm::guest::env;

fn main() {
    let inputs_json: String = env::read();
    let inputs: Vec<i64> = serde_json::from_str(&inputs_json).unwrap();
    let n = inputs[0];
    let result = fibonacci(n);
    env::commit(&result);
}

fn fibonacci(n: i64) -> i64 {
    if n <= 1 { n } else { fibonacci(n-1) + fibonacci(n-2) }
}
```

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

### Manual Testing
Test individual operations directly using the host program:
```bash
cd risc0code

# Test dynamic Rust execution
./target/release/host dynamic ./test_dynamic_rust.rs '{"n": 10}'

# Test precompiled binary
./target/release/host precompiled ./path/to/binary.bin '{"inputs": [1, 2, 3]}'

# Test pre-built operations
./target/release/host add 3.5 2.1
./target/release/host multiply 2.5 4.0
./target/release/host sqrt 9.0
./target/release/host modexp 2 10 1000
./target/release/host range 25 18 65
```

### Development Mode Testing
For faster testing without generating real proofs:
```bash
# Set development mode
export RISC0_DEV_MODE=1

# Run operations (much faster, no real proofs)
./target/release/host add 3.5 2.1
```

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

### Real Image ID Verification

The server implements **cryptographic image ID verification** to ensure proof authenticity:

- **Computed Image IDs**: Dynamic programs use `compute_image_id()` to generate real cryptographic image IDs from compiled ELF data
- **No Placeholder IDs**: Eliminates the use of dummy/placeholder image IDs that cause verification failures
- **Authentic Verification**: Every proof uses the actual cryptographic hash of the executed program
- **Tamper Detection**: Any modification to the guest program will result in a different image ID and failed verification

### Security Considerations

1. **Code Execution Security**: Dynamic Rust compilation is sandboxed within the RISC Zero zkVM environment
2. **Docker Isolation**: Build processes run in isolated Docker containers
3. **Proof Integrity**: Generated proofs are cryptographically bound to the exact code that was executed
4. **File System Security**: Temporary compilation artifacts are cleaned up after use
5. **Input Validation**: JSON inputs are validated before being passed to guest programs

### Security Recommendations

1. **Validate Inputs**: Always validate JSON inputs before execution
2. **Monitor Resources**: Set appropriate limits on proof generation time and memory usage
3. **Audit Code**: Review dynamic Rust code before execution in production environments
4. **Secure Storage**: Store proof files in secure locations with appropriate access controls
5. **Regular Updates**: Keep RISC Zero toolkit and dependencies updated for security patches

## License

MIT License
