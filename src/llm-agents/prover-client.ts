#!/usr/bin/env node

import 'dotenv/config';
import { ProverAgent } from './prover-agent.js';
import axios from 'axios';

/**
 * ProverAgent Client - Generates proofs and sends them to VerifierAgent server
 */

class ProverAgentClient {
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

  public async start(): Promise<void> {
    console.log('🤖 ProverAgent Client');
    console.log('='.repeat(60));
    console.log('🚀 Starting ProverAgent client...');
    
    try {
      await this.agent.start();
      console.log('✅ ProverAgent ready - LLM will intelligently choose tools');
      console.log(`🌐 Will send proofs to VerifierAgent at: ${this.verifierUrl}`);
      
      await this.runProofGenerationTask();
      
    } catch (error) {
      console.error('❌ Failed to start ProverAgent client:', error);
      process.exit(1);
    }
  }

  private async runProofGenerationTask(): Promise<void> {
    console.log('\n🎯 Task: Generate proof and send to VerifierAgent');
    console.log('─'.repeat(50));
    
    try {
      // Step 1: Generate proof using LLM
      console.log('📤 Step 1: Asking LLM to generate ZK proof for 1+1=2');
      console.log('🤔 LLM will decide which RISC Zero tools to use...');
      
      const message = {
        from: 'System',
        to: 'ProverAgent',
        type: 'chat' as const,
        content: 'Can you prove that 1 + 1 = 2?',
        timestamp: Date.now()
      };

      const responses = await this.agent.handleMessage(message);
      
      console.log(`\n📥 ProverAgent generated ${responses.length} response(s):`);
      responses.forEach((response, index) => {
        console.log(`\n[${index + 1}] ${response.type.toUpperCase()}:`);
        console.log(response.content.substring(0, 200) + (response.content.length > 200 ? '...' : ''));
        
        if (response.toolResults && response.toolResults.length > 0) {
          console.log(`🔧 Tools used: ${response.toolResults.length}`);
          response.toolResults.forEach((result, i) => {
            console.log(`   ${i+1}. ${result.toolName} completed`);
          });
        }
      });

      // Step 2: Extract proof file path from LLM response
      const proofFilePath = this.extractProofFilePath(responses);
      
      if (!proofFilePath) {
        console.log('❌ No proof file found in LLM response. Verification skipped.');
        return;
      }

      console.log(`🔍 Extracted proof file: ${proofFilePath}`);

      // Step 3: Send proof to VerifierAgent server
      await this.sendProofToVerifier(proofFilePath, {
        operation: '1+1=2',
        generatedBy: 'ProverAgent',
        llmModel: 'gpt-4',
        timestamp: new Date().toISOString()
      });
      
      console.log('\n✅ Complete workflow finished successfully!');
      console.log('🎉 ProverAgent → Generated proof → Sent to VerifierAgent → Verified');
      
    } catch (error) {
      console.error('❌ Error in proof generation task:', error);
    } finally {
      await this.agent.cleanup();
      console.log('\n👋 ProverAgent client finished');
    }
  }

  private extractProofFilePath(responses: any[]): string | null {
    // First check if tool results contain proof file path
    for (const response of responses) {
      if (response.toolResults && response.toolResults.length > 0) {
        for (const toolResult of response.toolResults) {
          if (toolResult.result && typeof toolResult.result === 'object') {
            const resultStr = JSON.stringify(toolResult.result);
            
            // Look for proof file paths in tool results
            const patterns = [
              /"proofFilePath":\s*"([^"]*\.bin)"/g,
              /"proofFilePath":\s*"([^"]*\.hex)"/g,
              /"proof_file_path":\s*"([^"]*\.bin)"/g,
              /"proof_file_path":\s*"([^"]*\.hex)"/g
            ];

            for (const pattern of patterns) {
              const match = pattern.exec(resultStr);
              if (match && match[1]) {
                return match[1];
              }
            }
          }
        }
      }
    }

    // Fallback: Look for proof file paths in response content
    for (const response of responses) {
      const content = response.content;
      
      // Look for proof file path patterns in content
      const patterns = [
        /\/[^\s"]*proof_[^\s"]*\.bin/g,
        /\/[^\s"]*proof_[^\s"]*\.hex/g,
        /"([^"]*proof_[^"]*\.bin)"/g,
        /"([^"]*proof_[^"]*\.hex)"/g,
        /`([^`]*proof_[^`]*\.bin)`/g,
        /`([^`]*proof_[^`]*\.hex)`/g
      ];

      for (const pattern of patterns) {
        const matches = content.match(pattern);
        if (matches && matches.length > 0) {
          // Clean up the match (remove quotes if present)
          let path = matches[0];
          if (path.startsWith('"') && path.endsWith('"')) {
            path = path.slice(1, -1);
          }
          if (path.startsWith('`') && path.endsWith('`')) {
            path = path.slice(1, -1);
          }
          return path;
        }
      }
    }
    
    console.log('🔍 Debug: Searching for proof file paths...');
    console.log('📝 Response content preview:');
    responses.forEach((response, i) => {
      console.log(`[${i+1}] ${response.content.substring(0, 200)}...`);
    });
    
    return null;
  }

  private async sendProofToVerifier(proofFilePath: string, metadata: any): Promise<void> {
    console.log('\n📡 Step 2: Sending proof to VerifierAgent server');
    console.log(`🌐 Target: ${this.verifierUrl}/verify-proof`);
    
    try {
      // First check if verifier server is running
      console.log('🔄 Checking VerifierAgent server health...');
      
      try {
        const healthResponse = await axios.get(`${this.verifierUrl}/health`, { timeout: 5000 });
        console.log(`✅ VerifierAgent server is healthy: ${healthResponse.data.status}`);
      } catch (healthError) {
        console.error('❌ VerifierAgent server is not responding');
        console.error('💡 Make sure to start the VerifierAgent server first with: npm run agent:verifier-server');
        return;
      }

      // Send verification request
      console.log('📤 Sending verification request...');
      const response = await axios.post(`${this.verifierUrl}/verify-proof`, {
        proofFilePath,
        metadata
      }, {
        timeout: 120000, // 2 minutes for ZK verification
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('\n📥 Verification response received:');
      console.log('─'.repeat(40));
      
      if (response.data.success) {
        console.log('✅ Verification Status: SUCCESS');
        console.log(`🔍 LLM Decision: ${response.data.metadata.llmDecision}`);
        console.log(`⏰ Verified At: ${response.data.metadata.verifiedAt}`);
        
        if (response.data.verificationResult.toolsUsed.length > 0) {
          console.log(`🔧 Tools Used: ${response.data.verificationResult.toolsUsed.length}`);
          response.data.verificationResult.toolsUsed.forEach((tool: any, i: number) => {
            console.log(`   ${i+1}. ${tool.toolName}`);
          });
        }
        
        console.log('\n📋 Verification Content:');
        console.log(response.data.verificationResult.content.substring(0, 300) + 
                   (response.data.verificationResult.content.length > 300 ? '...' : ''));
      } else {
        console.log('❌ Verification Status: FAILED');
        console.log(`❌ Error: ${response.data.error}`);
      }

    } catch (error) {
      if ((error as any).code === 'ECONNREFUSED') {
        console.error('❌ Connection refused - VerifierAgent server is not running');
        console.error('💡 Start the VerifierAgent server first with: npm run agent:verifier-server');
      } else if ((error as any).code === 'ETIMEDOUT') {
        console.error('❌ Request timeout - Verification took too long');
      } else {
        console.error('❌ Error sending proof to verifier:', error);
      }
    }
  }
}

// Handle graceful shutdown
const proverClient = new ProverAgentClient();

process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the client
proverClient.start().catch((error) => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});