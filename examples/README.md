# RISC Zero zkVM Examples

This directory contains example Rust programs that can be executed with zero-knowledge proofs using the RISC Zero zkVM through the MCP server. The examples focus on **privacy-preserving machine learning** and cryptographic applications.

## Available Examples

### 1. **fibonacci.rs** - Fibonacci Sequence
Computes the nth Fibonacci number.

**Input formats:**
- `[10]` - Compute 10th Fibonacci number
- `{"n": 10}` - Alternative format
- `10` - Direct number

**Example usage:**
```typescript
// Using MCP tool
await use_mcp_tool({
  server_name: "risc0-zkvm",
  tool_name: "zkvm_run_rust_file", 
  arguments: {
    rustFilePath: "/path/to/examples/fibonacci.rs",
    inputs: [10]
  }
});
```

### 2. **linear_regression.rs** - Linear Regression ML Model
Performs linear regression on a dataset and makes predictions without revealing the training data.

**Input format:**
```json
{
  "x_values": [1, 2, 3, 4, 5],
  "y_values": [2, 4, 6, 8, 10], 
  "predict_x": 6
}
```

**Use case:** Privacy-preserving ML inference - prove model predictions without revealing training data.

### 3. **neural_network.rs** - Neural Network Inference  
Performs inference on a pre-trained single-layer perceptron without revealing model weights.

**Input format:**
```json
{
  "weights": [0.5, -0.3, 0.8, -0.1],
  "bias": 0.2,
  "input": [1.0, 2.0, 0.5, -1.0],
  "threshold": 0.0
}
```

**Output:**
- `1` = Positive class
- `0` = Negative class

### 4. **k_means_clustering.rs** - K-Means Clustering
Performs k-means clustering and classifies a query point without revealing the dataset.

**Input format:**
```json
{
  "data_points": [[1.0, 2.0], [2.0, 1.0], [8.0, 9.0], [9.0, 8.0]],
  "k": 2,
  "max_iterations": 10,
  "query_point": [1.5, 1.8]
}
```

**Output:** Cluster assignment (0, 1, 2, etc.)

### 5. **sum_array.rs** - Array Sum
Computes the sum of an array of numbers.

**Input formats:**
- `[1, 2, 3, 4, 5]` - Sum array elements = 15

### 6. **hash_verify.rs** - Secret Hash Verification
Verifies that a secret input produces a known hash without revealing the secret.

**Input format:**
```json
{
  "secret": "hello",
  "expected_hash": 210714
}
```

**Use case:** Prove you know a secret that hashes to a specific value without revealing the secret.

### 7. **merkle_proof.rs** - Merkle Tree Membership Proof
Proves that a value is included in a Merkle tree without revealing the tree structure.

**Input format:**
```json
{
  "leaf_value": 42,
  "merkle_path": [123, 456, 789],
  "directions": [0, 1, 0],
  "expected_root": 987654321
}
```

**Use case:** Privacy-preserving membership proofs - prove you're on a whitelist without revealing the full list.

## Usage Instructions

### Method 1: Using MCP Tool (Recommended)

```typescript
// Execute any example with zero-knowledge proof
const result = await use_mcp_tool({
  server_name: "risc0-zkvm",
  tool_name: "zkvm_run_rust_file",
  arguments: {
    rustFilePath: "/Users/ronantakizawa/Documents/projects/risc0mcp/examples/fibonacci.rs",
    inputs: [10],
    forceRebuild: false
  }
});
```

### Method 2: Using Rust Code Directly

```typescript
// Execute Rust code directly
const rustCode = `
use risc0_zkvm::guest::env;

fn main() {
    let inputs_json: String = env::read();
    let n: i64 = 42; // Your computation here
    env::commit(&n);
}
`;

const result = await use_mcp_tool({
  server_name: "risc0-zkvm", 
  tool_name: "zkvm_run_rust_code",
  arguments: {
    rustCode: rustCode,
    inputs: []
  }
});
```

## Understanding the Output

Each execution returns a JSON structure containing:

```json
{
  "computation": {
    "operation": "dynamic_rust",
    "codeHash": "abc123...",
    "inputs": [10],
    "result": 55,
    "executionTimeMs": 3000
  },
  "zkProof": {
    "mode": "Production (real ZK proof)",
    "imageId": "def456...",
    "verificationStatus": "verified", 
    "proofFilePath": "/path/to/proof_precompiled_xyz.bin"
  },
  "dynamicExecution": {
    "tempGuestName": "guest-dynamic-abc123",
    "codeLength": 1200,
    "successful": true
  }
}
```

## Proof Verification

Verify any generated proof using the verification tool:

```bash
cd /Users/ronantakizawa/Documents/projects/risc0mcp/risc0code
./target/release/verify --file "proof_precompiled_xyz.bin" --verbose
```

## Writing Custom Examples

When writing your own Rust code for zkVM execution:

1. **Always use these imports:**
   ```rust
   use risc0_zkvm::guest::env;
   ```

2. **Read inputs from host:**
   ```rust
   let inputs_json: String = env::read();
   ```

3. **Parse inputs (handle errors):**
   ```rust
   let result = if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&inputs_json) {
       // Your parsing logic
   } else {
       -1 // Error code
   };
   ```

4. **Commit result:**
   ```rust
   env::commit(&result);
   ```

5. **Keep computations reasonable:** zkVM has resource constraints, so avoid:
   - Infinite loops
   - Excessive memory allocation
   - Very deep recursion
   - Operations that would take too long

## Production Mode

All examples run in **production mode** with real zero-knowledge proofs:
- ✅ Cryptographically secure
- ✅ Verifiable by anyone
- ✅ Privacy-preserving (inputs can remain private)
- ⏱️ Takes 3-10 seconds to generate proofs

## Security Notes

- The zkVM environment is sandboxed and secure
- Input data is processed privately within the proof
- Only the committed result is revealed in the proof
- All proofs are cryptographically verifiable

## Error Codes

Most examples use negative numbers for error conditions:
- `-1`: Invalid input type/format
- `-2`: Missing required data
- `-3`: JSON parse error
- `-4`: Other errors

Check the specific example code for detailed error handling.