import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { toolDefinitions } from './tool-definitions.js';
import { BasicOperations } from './operations/basic-operations.js';
import { MathOperations } from './operations/math-operations.js';
import { ProofOperations } from './operations/proof-operations.js';
import { DynamicOperations } from './operations/dynamic-operations.js';

export class RiscZeroCodeServer {
  private server: Server;
  private projectPath: string;
  private basicOps: BasicOperations;
  private mathOps: MathOperations;
  private proofOps: ProofOperations;
  private dynamicOps: DynamicOperations;

  constructor() {
    console.error('[Setup] Initializing RISC Zero Code MCP server...');
    
    this.server = new Server(
      {
        name: 'risc0code-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Path where we'll create our RISC Zero code project
    // Use absolute path resolution for reliability
    const scriptDir = path.dirname(new URL(import.meta.url).pathname);
    const projectRoot = path.resolve(scriptDir, '..');
    this.projectPath = path.join(projectRoot, 'risc0code');
    
    console.error(`[Setup] Looking for RISC Zero project at: ${this.projectPath}`);
    console.error(`[Setup] Script running from: ${scriptDir}`);
    console.error(`[Setup] Current working directory: ${process.cwd()}`);
    
    // Verify the project and binaries exist
    if (!fs.existsSync(this.projectPath)) {
      throw new Error(`RISC Zero project not found at ${this.projectPath}. Please ensure the risc0code project exists.`);
    }
    
    const hostBinary = path.join(this.projectPath, 'target', 'release', 'host');
    if (!fs.existsSync(hostBinary)) {
      throw new Error(`RISC Zero host binary not found at ${hostBinary}. Please run: cd risc0code && cargo build --release`);
    }
    
    console.error(`[Setup] ✅ RISC Zero project found at: ${this.projectPath}`);
    console.error(`[Setup] ✅ Host binary found at: ${hostBinary}`);

    // Initialize operation handlers
    this.basicOps = new BasicOperations(this.projectPath);
    this.mathOps = new MathOperations(this.projectPath);
    this.proofOps = new ProofOperations(this.projectPath);
    this.dynamicOps = new DynamicOperations(this.projectPath);

    this.setupToolHandlers();
    
    this.server.onerror = (error) => console.error('[Error]', error);
    
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: toolDefinitions,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'zkvm_add':
            return await this.basicOps.performZkVmOperation('add', request.params.arguments);
          case 'zkvm_multiply':
            return await this.basicOps.performZkVmOperation('multiply', request.params.arguments);
          case 'zkvm_sqrt':
            return await this.mathOps.performZkVmSqrt(request.params.arguments);
          case 'zkvm_modexp':
            return await this.mathOps.performZkVmModexp(request.params.arguments);
          case 'zkvm_range':
            return await this.mathOps.performZkVmRange(request.params.arguments);
          case 'verify_proof':
            return await this.proofOps.verifyProof(request.params.arguments);
          case 'verify_proof_data':
            return await this.proofOps.verifyProofData(request.params.arguments);
          case 'zkvm_run_rust_file':
            return await this.dynamicOps.runRustFile(request.params.arguments);
          case 'zkvm_run_rust_code':
            return await this.dynamicOps.runRustCode(request.params.arguments);
          case 'zkvm_authenticated_add':
            return await this.basicOps.performAuthenticatedAdd(request.params.arguments);
          case 'zkvm_authenticated_multiply':
            return await this.basicOps.performAuthenticatedMultiply(request.params.arguments);
          case 'zkvm_authenticated_sqrt':
            return await this.basicOps.performAuthenticatedSqrt(request.params.arguments);
          case 'zkvm_authenticated_modexp':
            return await this.basicOps.performAuthenticatedModexp(request.params.arguments);
          case 'zkvm_authenticated_range':
            return await this.basicOps.performAuthenticatedRange(request.params.arguments);
          case 'zkvm_k_means':
            return await this.basicOps.performKMeans(request.params.arguments);
          case 'zkvm_linear_regression':
            return await this.basicOps.performLinearRegression(request.params.arguments);
          case 'zkvm_neural_network':
            return await this.basicOps.performNeuralNetwork(request.params.arguments);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error('[Error] Failed to perform requested operation:', error);
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to perform requested operation: ${error.message}`
          );
        }
        throw error;
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('RISC Zero Code MCP server running on stdio');
  }
}