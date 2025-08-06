#!/usr/bin/env node

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { VerifierAgent } from './verifier-agent.js';

/**
 * VerifierAgent Server - HTTP server that receives proof verification requests
 * and processes them using the VerifierAgent LLM
 */

class VerifierAgentServer {
  private app: express.Application;
  private agent: VerifierAgent;
  private port: number;
  private upload!: multer.Multer;

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
    
    // Increase payload size limit for ZK proofs (can be several MB)
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ limit: '50mb', extended: true }));
    
    // Configure multer for file uploads
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        // Keep original filename with timestamp
        const timestamp = Date.now();
        const originalName = file.originalname || 'proof.bin';
        cb(null, `upload_${timestamp}_${originalName}`);
      }
    });
    
    this.upload = multer({ 
      storage: storage,
      limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
      }
    });
    
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

    // File upload proof verification endpoint
    this.app.post('/verify-proof-file', this.upload.single('proofFile'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            error: 'No proof file uploaded'
          });
        }

        const uploadedFilePath = req.file.path;
        const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};
        
        console.log(`📁 Received proof file upload: ${req.file.originalname}`);
        console.log(`📂 Saved to: ${uploadedFilePath}`);
        console.log(`📊 File size: ${req.file.size} bytes`);
        console.log(`🤔 LLM will decide whether to verify this uploaded proof file...`);

        // Create a message for the VerifierAgent LLM with uploaded file path
        const message = {
          from: 'ProverAgent',
          to: 'VerifierAgent', 
          type: 'chat' as const,
          content: `Please verify this uploaded zero-knowledge proof file: ${uploadedFilePath}. This proof was generated to demonstrate a mathematical computation. Use your verify_proof tool to check if this proof is cryptographically valid.`,
          timestamp: Date.now()
        };

        // Let the VerifierAgent LLM process the request
        const responses = await this.agent.handleMessage(message);
        
        const response = responses[0];
        const hasToolsUsed = response.toolResults && response.toolResults.length > 0;
        
        console.log(`✅ Verification completed. Tools used: ${hasToolsUsed ? 'Yes' : 'No'}`);

        // Clean up uploaded file after processing
        try {
          fs.unlinkSync(uploadedFilePath);
          console.log(`🗑️  Cleaned up uploaded file: ${uploadedFilePath}`);
        } catch (cleanupError) {
          console.warn(`⚠️  Could not clean up file ${uploadedFilePath}:`, cleanupError);
        }

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
            originalFileName: req.file.originalname,
            fileSize: req.file.size,
            originalMetadata: metadata
          }
        });

      } catch (error) {
        console.error('❌ Error processing file upload verification:', error);
        
        // Clean up file if error occurs
        if (req.file?.path) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (cleanupError) {
            console.warn('Could not clean up file after error:', cleanupError);
          }
        }
        
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Single proof verification endpoint (existing)
    this.app.post('/verify-proof', async (req, res) => {
      try {
        const { proofData, proofSize, proofFilePath, metadata } = req.body;
        
        // Support both new data-based and old file-based approaches
        if (!proofData && !proofFilePath) {
          return res.status(400).json({
            success: false,
            error: 'Either proofData or proofFilePath is required'
          });
        }

        let message;
        
        if (proofData) {
          // New data-based approach
          console.log(`🔍 Received verification request with proof data (${proofSize} bytes)`);
          console.log(`🤔 LLM will decide whether to verify this proof data...`);

          // Validate proof data before processing
          console.log(`📊 Proof data validation:`);
          console.log(`   - Proof data type: ${typeof proofData}`);
          console.log(`   - Is Buffer: ${Buffer.isBuffer(proofData)}`);
          console.log(`   - Is serialized Buffer: ${typeof proofData === 'object' && proofData && (proofData as any).type === 'Buffer'}`);
          console.log(`   - Data size: ${proofData?.length || (proofData as any)?.data?.length || 'unknown'} bytes`);
          console.log(`   - Expected size: ${proofSize} bytes`);
          
          // Store the raw binary data directly - no base64 conversion
          let originalProofData;
          if (Buffer.isBuffer(proofData)) {
            originalProofData = proofData;
          } else if (typeof proofData === 'object' && proofData && (proofData as any).type === 'Buffer' && Array.isArray((proofData as any).data)) {
            originalProofData = Buffer.from((proofData as any).data);
          } else {
            originalProofData = proofData; // Assume it's already binary data
          }

          // Create a message for the VerifierAgent LLM with proof data
          message = {
            from: 'ProverAgent',
            to: 'VerifierAgent', 
            type: 'chat' as const,
            content: `Please verify this zero-knowledge proof data. I have proof data that is ${proofSize} bytes in size of binary data. This proof was generated to demonstrate a mathematical computation. Use your verify_proof_data tool to check if this proof is cryptographically valid.`,
            timestamp: Date.now(),
            proofData: originalProofData, // Pass raw binary data directly
            proofSize: proofSize
          };
        } else {
          // File-based approach - preferred to avoid IMAGE_ID mismatch
          console.log(`🔍 Received verification request for file: ${proofFilePath}`);
          console.log(`🤔 LLM will decide whether to verify this proof file...`);

          // Create a message for the VerifierAgent LLM
          message = {
            from: 'ProverAgent',
            to: 'VerifierAgent', 
            type: 'chat' as const,
            content: `Please verify this zero-knowledge proof file: ${proofFilePath}. This proof was generated to demonstrate a mathematical computation. Use your verify_proof tool to check if this proof is cryptographically valid.`,
            timestamp: Date.now()
          };
        }

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
        console.log('   • POST /verify-proof - Verify single proof (JSON/binary data)');
        console.log('   • POST /verify-proof-file - Verify uploaded proof file');
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