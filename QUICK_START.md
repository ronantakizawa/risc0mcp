# Quick Start Guide

## Setup (First Time Only)

1. **Start the MCP Server**
   ```bash
   npm run mcp-server
   ```
   Keep running in Terminal 1.

2. **Start the Verifier Server**
   ```bash
   npm run verifier-server  
   ```
   Keep running in Terminal 2.

## Test Individual Functions

### Basic Math Operations
```bash
npm run test:add          # Prove 5 + 7 = 12
npm run test:multiply     # Prove 6 × 9 = 54
npm run test:sqrt         # Prove √16 = 4
npm run test:modexp       # Prove 3^5 mod 7 = 5
```

### Privacy-Preserving
```bash
npm run test:range        # Prove secret 25 is in range [20,30]
```

### With Authentication
```bash
npm run test:auth-add     # Addition + cryptographic signature
npm run test:auth-multiply # Multiplication + signature
npm run test:auth-sqrt    # Square root + signature
npm run test:auth-modexp  # Modular exp + signature
npm run test:auth-range   # Range proof + signature
```

### Custom Code Execution
```bash
npm run test:rust-code    # Run inline Rust code with ZK
npm run test:rust-file    # Run external Rust file with ZK
npm run test:fibonacci    # Compute Fibonacci with ZK
npm run test:factorial    # Compute factorial with ZK
```

## What You'll See

Each test will:
1. 🤖 **LLM Tool Selection** - GPT-4 chooses the right RISC Zero function
2. 🔬 **Proof Generation** - Creates real zero-knowledge proof (~209KB)
3. 📡 **Binary Transmission** - Sends proof data to verifier
4. ✅ **Cryptographic Verification** - Validates the proof mathematically

## Example Output
```
🧪 Addition Test
============================================================
🎯 Testing: zkvm_add
💭 Query: "Can you prove that 5 + 7 = 12?"
✅ ProverAgent ready with LLM-driven tool calling
🔧 Tool used: zkvm_add
✅ Correct tool selected by LLM  
📄 Proof generated: proof_add_1754444123.bin
📊 Proof size: 209546 bytes
✅ Proof verification successful
🎉 Test execution completed!
```

## Common Issues

- **Rate Limit Error**: Wait a few minutes and try again
- **Verifier Not Running**: Tests will generate proofs but skip verification
- **Build Errors**: Run `npm run build` first

## All Available Commands

| Command | Function | Description |
|---------|----------|-------------|
| `test:add` | `zkvm_add` | Addition proof |
| `test:multiply` | `zkvm_multiply` | Multiplication proof |
| `test:sqrt` | `zkvm_sqrt` | Square root proof |
| `test:modexp` | `zkvm_modexp` | Modular exponentiation proof |
| `test:range` | `zkvm_range` | Range proof (privacy-preserving) |
| `test:auth-add` | `zkvm_authenticated_add` | Addition + signature |
| `test:auth-multiply` | `zkvm_authenticated_multiply` | Multiplication + signature |
| `test:auth-sqrt` | `zkvm_authenticated_sqrt` | Square root + signature |
| `test:auth-modexp` | `zkvm_authenticated_modexp` | Modular exp + signature |
| `test:auth-range` | `zkvm_authenticated_range` | Range proof + signature |
| `test:rust-code` | `zkvm_run_rust_code` | Custom Rust code execution |
| `test:rust-file` | `zkvm_run_rust_file` | External Rust file execution |
| `test:fibonacci` | `zkvm_run_rust_code` | Fibonacci computation |
| `test:factorial` | `zkvm_run_rust_code` | Factorial computation |

Each command tests LLM intelligence + ZK proof generation + binary transmission + verification!