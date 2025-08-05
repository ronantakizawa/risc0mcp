#!/usr/bin/env node

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { VerifierAgent } from './verifier-agent.js';

/**
 * VerifierAgent Server - HTTP server that receives proof verification requests
 * and processes them using the VerifierAgent LLM
 */

class VerifierAgentServer {
  private app: express.Application;
  private agent: VerifierAgent;
  private port: number;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('❌ OPENAI_API_KEY not found in environment variables');
      console.error('💡 Make sure you have a .env file with OPENAI_API_KEY=your_key_here');
      process.exit(1);
    }

    this.agent = new VerifierAgent(apiKey);
    this.port = parseInt(process.env.VERIFIER_PORT || '3002');
    this.app = express();
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    
    // Request logging
    this.app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        agent: 'VerifierAgent',
        llmReady: true
      });
    });

    // Single proof verification endpoint
    this.app.post('/verify-proof', async (req, res) => {
      try {
        const { proofFilePath, metadata } = req.body;
        
        if (!proofFilePath) {
          return res.status(400).json({
            success: false,
            error: 'proofFilePath is required'
          });
        }

        console.log(`🔍 Received verification request for: ${proofFilePath}`);
        console.log(`🤔 LLM will decide whether to verify this proof...`);

        // Create a message for the VerifierAgent LLM
        const message = {
          from: 'ProverAgent',
          to: 'VerifierAgent', 
          type: 'chat' as const,
          content: `Please verify this zero-knowledge proof file: ${proofFilePath}. This proof was generated to demonstrate a mathematical computation. Use your verification tools to check if this proof is cryptographically valid.`,
          timestamp: Date.now()
        };

        // Let the VerifierAgent LLM process the request
        const responses = await this.agent.handleMessage(message);
        
        const response = responses[0];
        const hasToolsUsed = response.toolResults && response.toolResults.length > 0;
        
        console.log(`✅ Verification completed. Tools used: ${hasToolsUsed ? 'Yes' : 'No'}`);

        res.json({
          success: true,
          verificationResult: {
            content: response.content,
            toolsUsed: response.toolResults || [],
            toolCalls: response.toolCalls || []
          },
          metadata: {
            verifiedAt: new Date().toISOString(),
            llmDecision: hasToolsUsed ? 'Chose to verify proof' : 'No verification performed',
            proofFilePath,
            originalMetadata: metadata
          }
        });

      } catch (error) {
        console.error('❌ Error processing verification request:', error);
        
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Batch proof verification endpoint
    this.app.post('/verify-proofs', async (req, res) => {
      try {
        const { proofFiles } = req.body;
        
        if (!Array.isArray(proofFiles) || proofFiles.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'proofFiles array is required and must not be empty'
          });
        }

        console.log(`🔍 Received batch verification request for ${proofFiles.length} proofs`);
        
        const results = [];
        for (const proofFile of proofFiles) {
          try {
            const message = {
              from: 'BatchClient',
              to: 'VerifierAgent',
              type: 'chat' as const,
              content: `Please verify this zero-knowledge proof file: ${proofFile}`,
              timestamp: Date.now()
            };

            const responses = await this.agent.handleMessage(message);
            results.push({
              proofFile,
              success: true,
              result: responses[0]
            });
          } catch (error) {
            results.push({
              proofFile,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        res.json({
          success: true,
          results,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('❌ Error processing batch verification:', error);
        
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    });
  }

  public async start(): Promise<void> {
    console.log('🔍 VerifierAgent Server');
    console.log('='.repeat(60));
    console.log('🚀 Starting VerifierAgent server...');
    
    try {
      await this.agent.start();
      console.log('✅ VerifierAgent LLM ready with tool selection capabilities');
      
      this.app.listen(this.port, () => {
        console.log(`🌐 VerifierAgent server running on port ${this.port}`);
        console.log('📋 Endpoints:');
        console.log('   • GET  /health - Health check');
        console.log('   • POST /verify-proof - Verify single proof');
        console.log('   • POST /verify-proofs - Verify multiple proofs');
        console.log('');
        console.log('💡 LLM will intelligently choose verification tools based on requests');
        console.log('🔄 Server ready to receive proof verification requests');
      });
      
    } catch (error) {
      console.error('❌ Failed to start VerifierAgent server:', error);
      process.exit(1);
    }
  }
}

// Handle graceful shutdown
const server = new VerifierAgentServer();

process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the server
server.start().catch((error) => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});