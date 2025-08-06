#!/usr/bin/env node

import 'dotenv/config';
import { ProverAgent } from './prover-agent.js';
import axios from 'axios';
import * as fs from 'fs';

/**
 * Individual Test Client - Tests a single RISC Zero MCP server function
 */

interface TestDefinition {
  name: string;
  message: string;
  expectedTool: string;
}

const TEST_DEFINITIONS: Record<string, TestDefinition> = {
  add: {
    name: 'Addition Test',
    message: 'Can you prove that 5 + 7 = 12?',
    expectedTool: 'zkvm_add'
  },
  multiply: {
    name: 'Multiplication Test', 
    message: 'Can you prove that 6 × 9 = 54 using zero-knowledge cryptography?',
    expectedTool: 'zkvm_multiply'
  },
  sqrt: {
    name: 'Square Root Test',
    message: 'Can you prove the square root of 16 equals 4?',
    expectedTool: 'zkvm_sqrt'
  },
  modexp: {
    name: 'Modular Exponentiation Test',
    message: 'Can you prove that 3^5 mod 7 equals 5?',
    expectedTool: 'zkvm_modexp'
  },
  range: {
    name: 'Range Proof Test',
    message: 'Can you prove that the secret number 25 is between 20 and 30 without revealing 25?',
    expectedTool: 'zkvm_range'
  },
  'auth-add': {
    name: 'Authenticated Addition Test',
    message: 'Can you prove that 10 + 15 = 25 with cryptographic authentication using your private key?',
    expectedTool: 'zkvm_authenticated_add'
  },
  'auth-multiply': {
    name: 'Authenticated Multiplication Test',
    message: 'Can you prove that 8 × 7 = 56 with cryptographic authentication using your private key?',
    expectedTool: 'zkvm_authenticated_multiply'
  },
  'auth-sqrt': {
    name: 'Authenticated Square Root Test',
    message: 'Can you prove the square root of 25 equals 5 with cryptographic authentication using your private key?',
    expectedTool: 'zkvm_authenticated_sqrt'
  },
  'auth-modexp': {
    name: 'Authenticated Modular Exponentiation Test',
    message: 'Can you prove that 2^10 mod 13 equals 10 with cryptographic authentication using your private key?',
    expectedTool: 'zkvm_authenticated_modexp'
  },
  'auth-range': {
    name: 'Authenticated Range Proof Test',
    message: 'Can you prove that the secret number 15 is between 10 and 20 with cryptographic authentication using your private key?',
    expectedTool: 'zkvm_authenticated_range'
  },
  'rust-code': {
    name: 'Custom Rust Code Test',
    message: 'Can you run this Rust code using zero-knowledge: fn main() { let result = 2 * 3 * 4; println!("{}", result); }',
    expectedTool: 'zkvm_run_rust_code'
  },
  'rust-file': {
    name: 'Rust File Execution Test',
    message: 'Can you run the neural network example from the file examples/neural_network.rs using zero-knowledge proofs?',
    expectedTool: 'zkvm_run_rust_file'
  },
  'k-means': {
    name: 'K-Means Clustering Test',
    message: 'Use the zkvm_k_means tool to perform K-means clustering on these data points: [[1.0, 2.0], [2.0, 1.0], [8.0, 9.0], [9.0, 8.0]] with k=2 clusters and classify the query point [1.5, 1.8].',
    expectedTool: 'zkvm_k_means'
  },
  'linear-regression': {
    name: 'Linear Regression Test',
    message: 'Use the zkvm_linear_regression tool to perform linear regression on x values [1, 2, 3, 4, 5] and y values [2, 4, 6, 8, 10] then predict y for x=6.',
    expectedTool: 'zkvm_linear_regression'
  },
  'neural-network': {
    name: 'Neural Network Test',
    message: 'Use the zkvm_neural_network tool to run a neural network with inputs [0.5, 0.3, 0.8] for private AI computation.',
    expectedTool: 'zkvm_neural_network'
  }
};

class IndividualTestClient {
  private agent: ProverAgent;
  private verifierUrl: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('❌ OPENAI_API_KEY not found in environment variables');
      console.error('💡 Make sure you have a .env file with OPENAI_API_KEY=your_key_here');
      process.exit(1);
    }

    this.agent = new ProverAgent(apiKey);
    this.verifierUrl = process.env.VERIFIER_URL || 'http://localhost:3002';
  }

  public async runTest(testKey: string): Promise<void> {
    const testDef = TEST_DEFINITIONS[testKey];
    if (!testDef) {
      console.error(`❌ Unknown test: ${testKey}`);
      console.error(`Available tests: ${Object.keys(TEST_DEFINITIONS).join(', ')}`);
      process.exit(1);
    }

    console.log(`🧪 ${testDef.name}`);
    console.log('='.repeat(60));
    console.log(`🎯 Testing: ${testDef.expectedTool}`);
    console.log(`💭 Query: "${testDef.message}"`);
    
    try {
      await this.agent.start();
      console.log('✅ ProverAgent ready with LLM-driven tool calling');
      console.log(`🌐 Will send proofs to VerifierAgent at: ${this.verifierUrl}`);
      
      // Check if verifier server is running
      let verifierAvailable = false;
      try {
        const healthResponse = await axios.get(`${this.verifierUrl}/health`, { timeout: 5000 });
        console.log(`✅ VerifierAgent server is healthy: ${healthResponse.data.status}`);
        verifierAvailable = true;
      } catch (healthError) {
        console.log('⚠️  VerifierAgent server not running - will test proof generation only');
        console.log('💡 Start with: npm run verifier-server');
      }

      console.log('\\n🚀 Starting test execution...');
      console.log('─'.repeat(50));

      const result = await this.executeSingleTest(testDef);
      
      if (result.success) {
        console.log('✅ Test completed successfully');
        console.log(`🔧 Tool used: ${result.toolUsed || 'None'}`);
        console.log(`🎯 Expected tool: ${testDef.expectedTool}`);
        
        if (result.toolUsed === testDef.expectedTool) {
          console.log('✅ Correct tool selected by LLM');
        } else {
          console.log('⚠️  LLM selected different tool than expected');
        }
        
        if (result.proofFilePath) {
          console.log(`📄 Proof generated: ${result.proofFilePath}`);
          console.log(`📊 Proof size: ${result.proofSize} bytes`);
          
          if (verifierAvailable) {
            console.log('\\n🔍 Verifying proof...');
            await this.verifyProof(result.proofFilePath, {
              testName: testDef.name,
              operation: testDef.expectedTool,
              timestamp: new Date().toISOString()
            });
          }
        } else {
          console.log('⚠️  No proof file generated');
        }
        
        console.log('\\n🎉 Test execution completed!');
        
      } else {
        console.error('❌ Test failed:', result.error);
      }
      
    } catch (error) {
      console.error('❌ Test execution failed:', error instanceof Error ? error.message : String(error));
    } finally {
      await this.agent.cleanup();
      console.log('\\n👋 Test client finished');
    }
  }

  private async executeSingleTest(testDef: TestDefinition): Promise<any> {
    const message = {
      from: 'TestClient',
      to: 'ProverAgent',
      type: 'chat' as const,
      content: testDef.message,
      timestamp: Date.now()
    };

    try {
      const responses = await this.agent.handleMessage(message);
      
      // Extract tool usage and proof file path
      let toolUsed: string | null = null;
      let proofFilePath: string | null = null;
      
      for (const response of responses) {
        if (response.toolResults && response.toolResults.length > 0) {
          for (const toolResult of response.toolResults) {
            toolUsed = toolResult.toolName;
            
            // Extract proof file path
            if (toolResult.result && typeof toolResult.result === 'object') {
              if (toolResult.result.content && Array.isArray(toolResult.result.content)) {
                for (const contentItem of toolResult.result.content) {
                  if (contentItem.text) {
                    try {
                      const parsedContent = JSON.parse(contentItem.text);
                      if (parsedContent.zkProof && parsedContent.zkProof.proofFilePath) {
                        proofFilePath = parsedContent.zkProof.proofFilePath;
                      }
                    } catch (e) {
                      // Not JSON, continue
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      let proofSize = 0;
      if (proofFilePath && fs.existsSync(proofFilePath)) {
        proofSize = fs.statSync(proofFilePath).size;
      }
      
      return {
        success: true,
        toolUsed,
        proofFilePath,
        proofSize,
        responses
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async verifyProof(proofFilePath: string, metadata: any): Promise<void> {
    try {
      if (!fs.existsSync(proofFilePath)) {
        throw new Error(`Proof file not found: ${proofFilePath}`);
      }
      
      const fileStats = fs.statSync(proofFilePath);
      console.log(`📤 Uploading proof file for verification (${fileStats.size} bytes)...`);
      
      // Create form data for file upload
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      formData.append('proofFile', fs.createReadStream(proofFilePath));
      formData.append('metadata', JSON.stringify(metadata));
      
      const response = await axios.post(`${this.verifierUrl}/verify-proof-file`, formData, {
        timeout: 120000,
        headers: {
          ...formData.getHeaders(),
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.success) {
        console.log('✅ Proof verification successful');
        console.log(`🔍 LLM Decision: ${response.data.metadata.llmDecision}`);
        
        if (response.data.verificationResult.toolsUsed.length > 0) {
          console.log(`🔧 Verification tools used: ${response.data.verificationResult.toolsUsed.map((t: any) => t.toolName).join(', ')}`);
        }
        
        // Show verification content summary
        const content = response.data.verificationResult.content;
        if (content && content.length > 100) {
          console.log(`📋 Verification result: ${content.substring(0, 200)}...`);
        } else {
          console.log(`📋 Verification result: ${content}`);
        }
        
      } else {
        console.log('❌ Proof verification failed');
        console.log(`❌ Error: ${response.data.error}`);
      }
      
    } catch (error) {
      console.log('⚠️  Verification error:', error instanceof Error ? error.message : String(error));
    }
  }
}

// Get test key from command line arguments
const testKey = process.argv[2];
if (!testKey) {
  console.error('❌ Please specify a test to run');
  console.error(`Available tests: ${Object.keys(TEST_DEFINITIONS).join(', ')}`);
  console.error('Example: npm run test:add');
  process.exit(1);
}

// Handle graceful shutdown
const testClient = new IndividualTestClient();

process.on('SIGINT', async () => {
  console.log('\\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the test
testClient.runTest(testKey).catch((error) => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});