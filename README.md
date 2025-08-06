# RISC Zero MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Model Context Protocol (MCP) server that allows trustless and verifiable agentic workflows using ZK proofs from Risc Zero. 

https://github.com/user-attachments/assets/9a970034-442c-4ff9-972d-ad7c6d1a5079


## Features
- **K-Means Clustering**: Classify data points without revealing training data
- **Linear Regression**: Make predictions while keeping datasets private  
- **Neural Networks**: Basic neural network runs while hiding model weights
- - **Mathematical Operations**: Addition, multiplication, square root, modular exponentiation

## Architecture

The project consists of:
- **MCP Server** (`src/index.ts`): Node.js server implementing MCP protocol
- **LLM Agent System**: AI-driven proof generation and verification
  - ProverAgent: Generates ZK proofs for mathematical claims
  - VerifierAgent: Independently verifies received proofs
  - HTTP File Upload System: Distributed proof transmission
- **RISC Zero Guest Programs**: 
  - **Mathematical Operations**: Addition, multiplication, square root, modular exponentiation, range proofs
  - **Machine Learning**: K-means clustering, linear regression, neural networks
  - **Authenticated Operations**: Ed25519-signed computations
  - **Dynamic Execution**: Runtime Rust code compilation and execution
- **RISC Zero Host Program** (`host/src/main.rs`): Proof generation and verification
- **Verification Tool** (`verify/src/main.rs`): Independent proof verification with ML support

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

### Step 4: Environment Configuration

Set your OpenAI API key for LLM agent communication:

```bash
# In your environment or directly in code
export OPENAI_API_KEY="your-openai-api-key-here"

# Or update src/llm-agents/main.ts with your key
const OPENAI_API_KEY = 'your-openai-api-key-here';
```

## LLM Agent Workflow

### Running LLM Agent Demonstrations

#### Build the LLM agent system
```bash
npm run build
```
#### Run MCP server on Terminal 1
```bash
npm run mcp-server
```

#### Run a Verifying AI Agent on Terminal 2
```bash
npm run verifier-server 
```
#### Run a Proving AI Agent on Terminal 3
```bash
# Example functions
npm run comprehensive-test # Run all proofs
npm run test:k-means
npm run test:linear-regression
npm run test:logistic-regression
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
      "args": ["/Users/ronantakizawa/Documents/projects/risc0mcp/dist/index.js"],
      "env": {
        "RISC0_DEV_MODE": "0",
        "PATH": "/Users/ronantakizawa/.cargo/bin:/Users/ronantakizawa/.risc0/bin:/usr/local/bin:/usr/bin:/bin",
        "CARGO_HOME": "/Users/ronantakizawa/.cargo",
        "RUSTUP_HOME": "/Users/ronantakizawa/.rustup"
      },
      "toolCallTimeoutMillis": 600000
    }
  }
}
```

**Important:** Replace `/absolute/path/to/risc0mcp` with the full path to your cloned repository.

**Example paths:**
- macOS: `/Users/yourname/risc0mcp/dist/index.js`
- Windows: `C:\\Users\\yourname\\risc0mcp\\dist\\index.js`
- Linux: `/home/yourname/risc0mcp/dist/index.js`

### Step 3: Restart Claude Desktop
After updating the configuration:
1. **Quit Claude Desktop completely**
2. **Restart Claude Desktop**
3. **Wait for initialization** (may take 10-15 seconds)

### Step 4: Verify Installation
In Claude Desktop, try asking:
> "Can you add 3.5 and 2.1 using the RISC Zero zkVM?"

Claude should respond with a zero-knowledge proof of the computation!

## Usage

The MCP server runs automatically when Claude Desktop starts. You can interact with it through natural language in Claude Desktop.

### Example Prompts

**Private Machine Learning Computations:**
- "Create a Perform K-means clustering on these data points: [[1,2], [2,1], [8,9], [9,8]] with k=2"
- "Do linear regression on x=[1,2,3,4,5] and y=[2,4,6,8,10], predict y for x=6"  
- "Run a neural network with inputs [0.5, 0.3, 0.8] for private AI computation"

**Mathematical Operations:**
- "Add 15.7 and 23.4 using zero-knowledge proofs"
- "Calculate the square root of 144 with cryptographic verification"
- "Multiply 2.5 by 8.3 and generate a ZK proof"

**Cryptographic Operations:**
- "Compute 2^10 mod 1000 using modular exponentiation"
- "Prove that my secret number is between 18 and 65 (range proof)"
- "Generate an authenticated addition proof using my private key"

**Dynamic Rust Execution:**
- "Execute this Rust code in the zkVM: [paste your Rust code]"
- "Compile and run a Fibonacci function for n=10"


### Available Tools

#### `zkvm_run_rust_file`
**NEW**: Compiles and executes a Rust file in RISC Zero zkVM with zero-knowledge proof generation.

**Parameters:**
- `filepath` (string): Path to the Rust source file to compile and execute
- `inputs` (object): JSON inputs to pass to the guest program

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

#### `zkvm_multiply`
Performs multiplication of two decimal numbers using RISC Zero zkVM and returns the result with ZK proof receipt.

**Parameters:**
- `a` (number): First number to multiply (supports decimal values)
- `b` (number): Second number to multiply (supports decimal values)

#### `zkvm_sqrt`
Computes the square root of a decimal number using RISC Zero zkVM and returns the result with ZK proof receipt.

**Parameters:**
- `n` (number): Number to compute square root for (must be non-negative, supports decimal values)

#### `zkvm_modexp`
Performs modular exponentiation (a^b mod n) using RISC Zero zkVM and returns the result with ZK proof receipt. Ideal for cryptographic applications.

**Parameters:**
- `base` (number): Base number (a) - must be a non-negative integer
- `exponent` (number): Exponent (b) - must be a non-negative integer
- `modulus` (number): Modulus (n) - must be a positive integer

#### `zkvm_range`
Proves that a secret number is within a specified range using RISC Zero zkVM without revealing the secret number. This is a zero-knowledge range proof ideal for privacy-preserving applications.

**Parameters:**
- `secretNumber` (number): Secret number to prove is in range (will remain private) - must be a non-negative integer
- `minValue` (number): Minimum value of the range (inclusive) - must be a non-negative integer
- `maxValue` (number): Maximum value of the range (inclusive) - must be a non-negative integer

#### `zkvm_k_means`
Performs K-means clustering algorithm with zero-knowledge proof for private machine learning. Clusters data points without revealing the training data.

**Parameters:**
- `dataPoints` (array): Array of data points, each as [x, y] coordinates
- `k` (integer): Number of clusters (minimum 1)
- `maxIterations` (integer, optional): Maximum iterations for convergence (default: 10)
- `queryPoint` (array): Query point to classify as [x, y] coordinates


#### `zkvm_linear_regression`
Performs linear regression analysis with zero-knowledge proof for private statistical modeling. Computes predictions while keeping datasets private.

**Parameters:**
- `xValues` (array): Array of x (independent) values
- `yValues` (array): Array of y (dependent) values  
- `predictX` (number): X value to predict Y for

#### `zkvm_neural_network`
Executes neural network computation with zero-knowledge proof for private AI inference. Performs inference without revealing model weights.

**Parameters:**
- `inputs` (array): Input values for the neural network
- `learningRate` (number, optional): Learning rate for training (default: 0.1)
- `epochs` (integer, optional): Number of training epochs (default: 100)


#### `verify_proof`
Verifies a RISC Zero proof from a .bin or .hex file and extracts the computation result. Automatically detects the operation type from the filename.

**Parameters:**
- `proofFilePath` (string): Path to the .bin or .hex proof file to verify

## License

MIT License
