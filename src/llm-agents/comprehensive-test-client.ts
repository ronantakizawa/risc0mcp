#!/usr/bin/env node

import 'dotenv/config';
import { ProverAgent } from './prover-agent.js';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Comprehensive Test Client - Tests all RISC Zero MCP server functions
 */

interface TestCase {
  name: string;
  description: string;
  message: string;
  expectedTools: string[];
}

class ComprehensiveTestClient {
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

  private getTestCases(): TestCase[] {
    return [
      {
        name: 'Basic Addition',
        description: 'Test zkvm_add function',
        message: 'Can you prove that 5 + 7 = 12?',
        expectedTools: ['zkvm_add']
      },
      {
        name: 'Multiplication',
        description: 'Test zkvm_multiply function',
        message: 'Can you prove that 6 × 9 = 54 using zero-knowledge cryptography?',
        expectedTools: ['zkvm_multiply']
      },
      {
        name: 'Square Root',
        description: 'Test zkvm_sqrt function',
        message: 'Can you prove the square root of 16 equals 4?',
        expectedTools: ['zkvm_sqrt']
      },
      {
        name: 'Modular Exponentiation',
        description: 'Test zkvm_modexp function',
        message: 'Can you prove that 3^5 mod 7 equals 5?',
        expectedTools: ['zkvm_modexp']
      },
      {
        name: 'Range Proof',
        description: 'Test zkvm_range function',
        message: 'Can you prove that the secret number 25 is between 20 and 30 without revealing 25?',
        expectedTools: ['zkvm_range']
      },
      {
        name: 'Authenticated Addition',
        description: 'Test zkvm_authenticated_add function',
        message: 'Can you prove that 10 + 15 = 25 with cryptographic authentication using your private key?',
        expectedTools: ['zkvm_authenticated_add']
      },
      {
        name: 'Custom Rust Code',
        description: 'Test zkvm_run_rust_code function',
        message: 'Can you run this Rust code using zero-knowledge: fn main() { let result = 2 * 3 * 4; println!("{}", result); }',
        expectedTools: ['zkvm_run_rust_code']
      },
      {
        name: 'Fibonacci Sequence',
        description: 'Test zkvm_run_rust_code with complex logic',
        message: 'Can you prove the 10th Fibonacci number using this Rust code: fn main() { let n = 10; let mut a = 0; let mut b = 1; for _ in 0..n { let temp = a + b; a = b; b = temp; } println!("{}", a); }',
        expectedTools: ['zkvm_run_rust_code']
      },
      {
        name: 'Rust File Execution',
        description: 'Test zkvm_run_rust_file function',
        message: 'Can you run the factorial calculation from the file test_samples/factorial.rs using zero-knowledge proofs?',
        expectedTools: ['zkvm_run_rust_file']
      }
    ];
  }

  public async start(): Promise<void> {
    console.log('🧪 Comprehensive RISC Zero MCP Test Client');
    console.log('='.repeat(80));
    console.log('🚀 Starting comprehensive test suite...');
    
    try {
      await this.agent.start();
      console.log('✅ ProverAgent ready with LLM-driven tool calling');
      console.log(`🌐 Will send proofs to VerifierAgent at: ${this.verifierUrl}`);
      
      // Check if verifier server is running
      try {
        const healthResponse = await axios.get(`${this.verifierUrl}/health`, { timeout: 5000 });
        console.log(`✅ VerifierAgent server is healthy: ${healthResponse.data.status}`);
      } catch (healthError) {
        console.log('⚠️  VerifierAgent server not running - will test proof generation only');
        console.log('💡 Start with: npm run agent:verifier-server');
      }

      await this.runAllTests();
      
    } catch (error) {
      console.error('❌ Failed to start test client:', error);
      process.exit(1);
    }
  }

  private async runAllTests(): Promise<void> {
    console.log('\\n🎯 Running Comprehensive Test Suite');
    console.log('─'.repeat(80));
    
    const testCases = this.getTestCases();
    const results = [];
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`\\n[${i + 1}/${testCases.length}] ${testCase.name}`);
      console.log(`📝 ${testCase.description}`);
      console.log(`💭 Query: "${testCase.message}"`);
      
      try {
        const result = await this.runSingleTest(testCase);
        results.push({ testCase, result, success: true });
        
        if (result.proofGenerated) {
          console.log('✅ Proof generated successfully');
          if (result.proofFilePath) {
            console.log(`📄 Proof file: ${result.proofFilePath}`);
            
            // Try to verify if verifier is available
            try {
              await this.verifyProof(result.proofFilePath, {
                testName: testCase.name,
                operation: testCase.expectedTools[0],
                timestamp: new Date().toISOString()
              });
            } catch (verifyError) {
              console.log('⚠️  Verification skipped (verifier not available)');
            }
          }
        } else {
          console.log('⚠️  No proof generated');
        }
        
      } catch (error) {
        console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
        results.push({ testCase, error, success: false });
      }
      
      console.log('─'.repeat(50));
    }
    
    // Summary
    this.printTestSummary(results);
    
    await this.agent.cleanup();
    console.log('\\n👋 Comprehensive test client finished');
  }

  private async runSingleTest(testCase: TestCase): Promise<any> {
    const message = {
      from: 'TestClient',
      to: 'ProverAgent',
      type: 'chat' as const,
      content: testCase.message,
      timestamp: Date.now()
    };

    const responses = await this.agent.handleMessage(message);
    
    // Check if expected tools were used
    let toolsUsed: string[] = [];
    let proofFilePath: string | null = null;
    
    for (const response of responses) {
      if (response.toolResults && response.toolResults.length > 0) {
        for (const toolResult of response.toolResults) {
          toolsUsed.push(toolResult.toolName);
          
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
    
    console.log(`🔧 Tools used: ${toolsUsed.join(', ') || 'None'}`);
    console.log(`🎯 Expected tools: ${testCase.expectedTools.join(', ')}`);
    
    const correctToolUsed = testCase.expectedTools.some(expectedTool => 
      toolsUsed.includes(expectedTool)
    );
    
    if (!correctToolUsed) {
      console.log('⚠️  Expected tool not used by LLM');
    } else {
      console.log('✅ Correct tool selected by LLM');
    }
    
    return {
      toolsUsed,
      correctToolUsed,
      proofGenerated: proofFilePath !== null,
      proofFilePath,
      responses
    };
  }

  private async verifyProof(proofFilePath: string, metadata: any): Promise<void> {
    try {
      // Read proof file
      if (!fs.existsSync(proofFilePath)) {
        throw new Error(`Proof file not found: ${proofFilePath}`);
      }
      
      const proofData = fs.readFileSync(proofFilePath);
      console.log(`📤 Sending proof (${proofData.length} bytes) for verification...`);
      
      const response = await axios.post(`${this.verifierUrl}/verify-proof`, {
        proofData: proofData,
        proofSize: proofData.length,
        metadata
      }, {
        timeout: 120000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.success) {
        console.log('✅ Proof verification successful');
        console.log(`🔍 LLM Decision: ${response.data.metadata.llmDecision}`);
      } else {
        console.log('❌ Proof verification failed');
        console.log(`❌ Error: ${response.data.error}`);
      }
      
    } catch (error) {
      console.log('⚠️  Verification error:', error instanceof Error ? error.message : String(error));
    }
  }

  private printTestSummary(results: any[]): void {
    console.log('\\n📊 Test Results Summary');
    console.log('='.repeat(80));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const proofsGenerated = results.filter(r => r.success && r.result.proofGenerated);
    const correctToolUsage = results.filter(r => r.success && r.result.correctToolUsed);
    
    console.log(`✅ Successful tests: ${successful.length}/${results.length}`);
    console.log(`❌ Failed tests: ${failed.length}/${results.length}`);
    console.log(`🔬 Proofs generated: ${proofsGenerated.length}/${results.length}`);
    console.log(`🎯 Correct tool usage: ${correctToolUsage.length}/${results.length}`);
    
    if (failed.length > 0) {
      console.log('\\n❌ Failed Tests:');
      failed.forEach(f => {
        console.log(`   • ${f.testCase.name}: ${f.error instanceof Error ? f.error.message : String(f.error)}`);
      });
    }
    
    if (correctToolUsage.length === results.length) {
      console.log('\\n🎉 All tests passed with correct LLM tool selection!');
    } else {
      console.log('\\n⚠️  Some tests had suboptimal tool selection by LLM');
    }
  }
}

// Handle graceful shutdown
const testClient = new ComprehensiveTestClient();

process.on('SIGINT', async () => {
  console.log('\\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the test client
testClient.start().catch((error) => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});