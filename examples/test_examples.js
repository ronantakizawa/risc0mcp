#!/usr/bin/env node

/**
 * Test script to demonstrate RISC Zero zkVM examples
 * This script shows how to use the MCP server to execute example Rust code with ZK proofs
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Example test cases for each Rust program
const examples = [
  {
    name: "Fibonacci",
    file: "fibonacci.rs",
    inputs: [10],
    description: "Compute 10th Fibonacci number (should be 55)"
  },
  {
    name: "Linear Regression",
    file: "linear_regression.rs",
    inputs: [{"x_values": [1, 2, 3, 4, 5], "y_values": [2, 4, 6, 8, 10], "predict_x": 6}],
    description: "ML: Predict y value for x=6 using linear regression (should be ~12000)"
  },
  {
    name: "Neural Network",
    file: "neural_network.rs",
    inputs: [{"weights": [0.5, -0.3, 0.8, -0.1], "bias": 0.2, "input": [1.0, 2.0, 0.5, -1.0], "threshold": 0.0}],
    description: "ML: Binary classification using perceptron (should be 1 or 0)"
  },
  {
    name: "K-Means Clustering",
    file: "k_means_clustering.rs",
    inputs: [{"data_points": [[1.0, 2.0], [2.0, 1.0], [8.0, 9.0], [9.0, 8.0]], "k": 2, "max_iterations": 10, "query_point": [1.5, 1.8]}],
    description: "ML: Classify query point using k-means clustering (should be 0 or 1)"
  },
  {
    name: "Array Sum",
    file: "sum_array.rs",
    inputs: [1, 2, 3, 4, 5],
    description: "Sum array [1,2,3,4,5] (should be 15)"
  },
  {
    name: "Hash Verify",
    file: "hash_verify.rs", 
    inputs: [{"secret": "hello", "expected_hash": 210714}],
    description: "Verify secret 'hello' matches hash 210714"
  },
  {
    name: "Merkle Proof",
    file: "merkle_proof.rs",
    inputs: [{"leaf_value": 42, "merkle_path": [123, 456, 789], "directions": [0, 1, 0], "expected_root": 987654321}],
    description: "Privacy: Prove membership in Merkle tree"
  }
];

console.log("🔐 RISC Zero zkVM Examples Test");
console.log("================================");
console.log();

console.log("📋 Available examples:");
examples.forEach((example, i) => {
  console.log(`${i + 1}. ${example.name}`);
  console.log(`   File: ${example.file}`);
  console.log(`   Input: ${JSON.stringify(example.inputs)}`);
  console.log(`   ${example.description}`);
  console.log();
});

console.log("🚀 To run these examples, use the MCP tool:");
console.log();
console.log("Example TypeScript/JavaScript code:");
console.log("```");
console.log("const result = await use_mcp_tool({");
console.log("  server_name: 'risc0-zkvm',");
console.log("  tool_name: 'zkvm_run_rust_file',");
console.log("  arguments: {");
console.log(`    rustFilePath: '${path.resolve(__dirname, 'fibonacci.rs')}',`);
console.log("    inputs: [10]");
console.log("  }");
console.log("});");
console.log("```");
console.log();

console.log("🔍 To verify proofs:");
console.log("```bash");
console.log("cd risc0code");
console.log("./target/release/verify --file 'proof_precompiled_xyz.bin' --verbose");
console.log("```");
console.log();

console.log("✨ All examples generate real zero-knowledge proofs!");
console.log("🔒 Proofs are cryptographically verifiable and secure.");