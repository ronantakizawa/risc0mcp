#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';

const execAsync = promisify(exec);

class RiscZeroCodeServer {
  private server: Server;
  private projectPath: string;

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

    this.setupToolHandlers();
    
    this.server.onerror = (error) => console.error('[Error]', error);
    
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'zkvm_add',
          description: 'Perform addition of two numbers using RISC Zero zkVM and return the result with ZK proof receipt',
          inputSchema: {
            type: 'object',
            properties: {
              a: {
                type: 'number',
                description: 'First number to add',
              },
              b: {
                type: 'number',
                description: 'Second number to add',
              },
              forceRebuild: {
                type: 'boolean',
                description: 'Whether to rebuild the project from scratch (slower but ensures fresh build)',
                default: false
              }
            },
            required: ['a', 'b'],
          },
        },
        {
          name: 'zkvm_multiply',
          description: 'Perform multiplication of two numbers using RISC Zero zkVM and return the result with ZK proof receipt',
          inputSchema: {
            type: 'object',
            properties: {
              a: {
                type: 'number',
                description: 'First number to multiply',
              },
              b: {
                type: 'number',
                description: 'Second number to multiply',
              },
              forceRebuild: {
                type: 'boolean',
                description: 'Whether to rebuild the project from scratch (slower but ensures fresh build)',
                default: false
              }
            },
            required: ['a', 'b'],
          },
        },
        {
          name: 'zkvm_sqrt',
          description: 'Compute square root of a decimal number using RISC Zero zkVM and return the result with ZK proof receipt',
          inputSchema: {
            type: 'object',
            properties: {
              n: {
                type: 'number',
                description: 'Decimal number to compute square root for (must be non-negative)',
              },
              forceRebuild: {
                type: 'boolean',
                description: 'Whether to rebuild the project from scratch (slower but ensures fresh build)',
                default: false
              }
            },
            required: ['n'],
          },
        },
        {
          name: 'zkvm_modexp',
          description: 'Perform modular exponentiation (a^b mod n) using RISC Zero zkVM and return the result with ZK proof receipt',
          inputSchema: {
            type: 'object',
            properties: {
              base: {
                type: 'number',
                description: 'Base number (a)',
              },
              exponent: {
                type: 'number',
                description: 'Exponent (b)',
              },
              modulus: {
                type: 'number',
                description: 'Modulus (n)',
              },
              forceRebuild: {
                type: 'boolean',
                description: 'Whether to rebuild the project from scratch (slower but ensures fresh build)',
                default: false
              }
            },
            required: ['base', 'exponent', 'modulus'],
          },
        },
        {
          name: 'zkvm_range',
          description: 'Prove that a secret number is within a specified range using RISC Zero zkVM without revealing the secret number',
          inputSchema: {
            type: 'object',
            properties: {
              secretNumber: {
                type: 'number',
                description: 'Secret number to prove is in range (will remain private)',
              },
              minValue: {
                type: 'number',
                description: 'Minimum value of the range (inclusive)',
              },
              maxValue: {
                type: 'number',
                description: 'Maximum value of the range (inclusive)',
              },
              forceRebuild: {
                type: 'boolean',
                description: 'Whether to rebuild the project from scratch (slower but ensures fresh build)',
                default: false
              }
            },
            required: ['secretNumber', 'minValue', 'maxValue'],
          },
        },
        {
          name: 'verify_proof',
          description: 'Verify a RISC Zero proof from a .bin file and extract the computation result',
          inputSchema: {
            type: 'object',
            properties: {
              proofFilePath: {
                type: 'string',
                description: 'Path to the .bin proof file to verify',
              }
            },
            required: ['proofFilePath'],
          },
        },
        {
          name: 'zkvm_run_rust_file',
          description: 'Execute arbitrary Rust code from a file using RISC Zero zkVM and return the result with ZK proof',
          inputSchema: {
            type: 'object',
            properties: {
              rustFilePath: {
                type: 'string',
                description: 'Path to the Rust file (.rs) containing the guest program code',
              },
              inputs: {
                type: 'array',
                description: 'Array of inputs to pass to the Rust program (will be serialized as JSON)',
                items: {
                  type: 'any'
                },
                default: []
              },
              forceRebuild: {
                type: 'boolean',
                description: 'Whether to force recompilation of the Rust code',
                default: false
              }
            },
            required: ['rustFilePath'],
          },
        },
        {
          name: 'zkvm_run_rust_code',
          description: 'Execute arbitrary Rust code from text input using RISC Zero zkVM and return the result with ZK proof',
          inputSchema: {
            type: 'object',
            properties: {
              rustCode: {
                type: 'string',
                description: 'Rust source code for the guest program (must include main function)',
              },
              inputs: {
                type: 'array',
                description: 'Array of inputs to pass to the Rust program (will be serialized as JSON)',
                items: {
                  type: 'any'
                },
                default: []
              },
              forceRebuild: {
                type: 'boolean',
                description: 'Whether to force recompilation of the Rust code',
                default: false
              }
            },
            required: ['rustCode'],
          },
        }
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'zkvm_add':
            return await this.performZkVmOperation('add', request.params.arguments);
          case 'zkvm_multiply':
            return await this.performZkVmOperation('multiply', request.params.arguments);
          case 'zkvm_sqrt':
            return await this.performZkVmSqrt(request.params.arguments);
          case 'zkvm_modexp':
            return await this.performZkVmModexp(request.params.arguments);
          case 'zkvm_range':
            return await this.performZkVmRange(request.params.arguments);
          case 'verify_proof':
            return await this.verifyProof(request.params.arguments);
          case 'zkvm_run_rust_file':
            return await this.runRustFile(request.params.arguments);
          case 'zkvm_run_rust_code':
            return await this.runRustCode(request.params.arguments);
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

  private async ensureProjectExists(forceRebuild: boolean = false): Promise<void> {
    if (!fs.existsSync(this.projectPath)) {
      throw new Error(`RISC Zero project not found at ${this.projectPath}. Please ensure the risc0code project exists.`);
    }
    
    const targetPath = path.join(this.projectPath, 'target');
    const needsBuild = forceRebuild || !fs.existsSync(targetPath);
    
    if (needsBuild) {
      console.error('[Setup] Building RISC Zero project...');
      try {
        if (forceRebuild) {
          console.error('[Setup] Force rebuild requested, cleaning only target directory...');
          // Only clean the release target to speed up rebuild
          await execAsync('rm -rf target/release', { 
            cwd: this.projectPath,
            timeout: 30000 
          });
        }
        
        // Build only the host binary for faster rebuild
        console.error('[Setup] Building host binary only...');
        await execAsync('cargo build --release --bin host', { 
          cwd: this.projectPath,
          timeout: 120000, // 2 minutes timeout for host build only
          env: {
            ...process.env,
            RISC0_DEV_MODE: '0'
          }
        });
        
        console.error('[Setup] RISC Zero host binary built successfully');
      } catch (error) {
        throw new Error(`Failed to build RISC Zero project: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      console.error('[Setup] RISC Zero project already built, skipping build');
    }
  }

  async performZkVmOperation(operation: string, args: any) {
    const { a, b, forceRebuild = false } = args;

    if (typeof a !== 'number' || typeof b !== 'number') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Both a and b must be numbers'
      );
    }

    try {
      const opSymbol = operation === 'add' ? '+' : '*';
      console.error(`[API] Starting zkVM ${operation}: ${a} ${opSymbol} ${b} (production mode)`);
      
      // Ensure the RISC Zero project exists and is built
      await this.ensureProjectExists(forceRebuild);
      
      console.error(`[API] Project ready, executing computation...`);
      const hostBinary = path.join(this.projectPath, 'target', 'release', 'host');
      
      const env = {
        ...process.env,
        RISC0_DEV_MODE: '0', // Always production mode
        RUST_LOG: 'info'
      };

      // Check if host binary exists
      if (fs.existsSync(hostBinary)) {
        console.error(`[API] Host binary found at: ${hostBinary}`);
      } else {
        console.error(`[API] ERROR: Host binary not found at: ${hostBinary}`);
        throw new Error(`Host binary not found. Please run 'cargo build --release' in ${this.projectPath}`);
      }

      console.error(`[API] Starting binary execution...`);
      const startTime = Date.now();

      // Simple command without session parameters
      const command = `${hostBinary} ${operation} ${a} ${b}`;
      
      let result;
      
      try {
        const execResult = await execAsync(command, { 
          cwd: this.projectPath, 
          env,
          timeout: 90000 // 90 seconds timeout for operations
        });
        
        const endTime = Date.now();
        console.error(`[API] Binary execution completed in ${endTime - startTime}ms`);

        // Parse the JSON output from the host program
        try {
          // Extract JSON from stdout (skip log lines, find the { } block)
          const lines = execResult.stdout.split('\n');
          let jsonStart = -1;
          let jsonEnd = -1;
          
          // Find the line that starts with '{'
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('{')) {
              jsonStart = i;
              break;
            }
          }
          
          // Find the line that ends with '}'
          for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].trim().endsWith('}')) {
              jsonEnd = i;
              break;
            }
          }
          
          if (jsonStart >= 0 && jsonEnd >= 0) {
            const jsonLines = lines.slice(jsonStart, jsonEnd + 1);
            const jsonString = jsonLines.join('\n');
            
            result = JSON.parse(jsonString);
            console.error(`[API] JSON parsed successfully:`, result);
          } else {
            throw new Error('Could not find JSON block in output');
          }
        } catch (parseError) {
          console.error(`[API] JSON parse failed:`, parseError);
          // If JSON parsing fails, return raw output
          result = {
            error: 'Failed to parse program output',
            raw_output: execResult.stdout,
            raw_stderr: execResult.stderr
          };
        }
      } catch (execError) {
        console.error(`[API] Execution failed:`, execError);
        throw execError;
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              computation: {
                operation: operation,
                inputs: { a, b },
                result: result.result,
                expected: operation === 'add' ? a + b : a * b,
                correct: result.result === (operation === 'add' ? a + b : a * b)
              },
              zkProof: {
                mode: 'Production (real ZK proof)',
                imageId: result.image_id,
                verificationStatus: result.verification_status,
                proofFilePath: result.proof_file_path ? path.resolve(this.projectPath, result.proof_file_path) : null
              }
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to perform zkVM ${operation}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async performZkVmSqrt(args: any) {
    const { n, forceRebuild = false } = args;

    if (typeof n !== 'number' || n < 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'n must be a non-negative number'
      );
    }

    try {
      console.error(`[API] Starting zkVM sqrt: sqrt(${n}) (production mode)`);
      
      // Ensure the RISC Zero project exists and is built
      await this.ensureProjectExists(forceRebuild);
      
      console.error(`[API] Project ready, executing sqrt computation...`);
      const hostBinary = path.join(this.projectPath, 'target', 'release', 'host');
      
      const env = {
        ...process.env,
        RISC0_DEV_MODE: '0', // Always production mode
        RUST_LOG: 'info'
      };

      // Check if host binary exists
      if (fs.existsSync(hostBinary)) {
        console.error(`[API] Host binary found at: ${hostBinary}`);
      } else {
        console.error(`[API] ERROR: Host binary not found at: ${hostBinary}`);
        throw new Error(`Host binary not found. Please run 'cargo build --release' in ${this.projectPath}`);
      }

      console.error(`[API] Starting binary execution...`);
      const startTime = Date.now();

      // Simple command without session parameters
      const command = `${hostBinary} sqrt ${n}`;
      
      let result;
      
      try {
        const execResult = await execAsync(command, { 
          cwd: this.projectPath, 
          env,
          timeout: 90000 // 90 seconds timeout for operations
        });
        
        const endTime = Date.now();
        console.error(`[API] Binary execution completed in ${endTime - startTime}ms`);

        // Parse the JSON output from the host program
        try {
          // Extract JSON from stdout (skip log lines, find the { } block)
          const lines = execResult.stdout.split('\n');
          let jsonStart = -1;
          let jsonEnd = -1;
          
          // Find the line that starts with '{'
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('{')) {
              jsonStart = i;
              break;
            }
          }
          
          // Find the line that ends with '}'
          for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].trim().endsWith('}')) {
              jsonEnd = i;
              break;
            }
          }
          
          if (jsonStart >= 0 && jsonEnd >= 0) {
            const jsonLines = lines.slice(jsonStart, jsonEnd + 1);
            const jsonString = jsonLines.join('\n');
            
            result = JSON.parse(jsonString);
            console.error(`[API] JSON parsed successfully:`, result);
          } else {
            throw new Error('Could not find JSON block in output');
          }
        } catch (parseError) {
          console.error(`[API] JSON parse failed:`, parseError);
          // If JSON parsing fails, return raw output
          result = {
            error: 'Failed to parse program output',
            raw_output: execResult.stdout,
            raw_stderr: execResult.stderr
          };
        }
      } catch (execError) {
        console.error(`[API] Execution failed:`, execError);
        throw execError;
      }
      
      // Calculate expected result for validation (decimal)
      const expectedResult = Math.sqrt(n);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              computation: {
                operation: 'sqrt',
                inputs: { n },
                result: result.result,
                expected: expectedResult,
                correct: Math.abs(result.result - expectedResult) < 0.01
              },
              zkProof: {
                mode: 'Production (real ZK proof)',
                imageId: result.image_id,
                verificationStatus: result.verification_status,
                proofFilePath: result.proof_file_path ? path.resolve(this.projectPath, result.proof_file_path) : null
              }
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to perform zkVM sqrt: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async performZkVmModexp(args: any) {
    const { base, exponent, modulus, forceRebuild = false } = args;

    if (typeof base !== 'number' || typeof exponent !== 'number' || typeof modulus !== 'number' || 
        base < 0 || exponent < 0 || modulus <= 0 || 
        !Number.isInteger(base) || !Number.isInteger(exponent) || !Number.isInteger(modulus)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'base, exponent, and modulus must be non-negative integers, and modulus must be positive'
      );
    }

    try {
      console.error(`[API] Starting zkVM modexp: ${base}^${exponent} mod ${modulus} (production mode)`);
      
      // Ensure the RISC Zero project exists and is built
      await this.ensureProjectExists(forceRebuild);
      
      console.error(`[API] Project ready, executing modexp computation...`);
      const hostBinary = path.join(this.projectPath, 'target', 'release', 'host');
      
      const env = {
        ...process.env,
        RISC0_DEV_MODE: '0', // Always production mode
        RUST_LOG: 'info'
      };

      // Check if host binary exists
      if (fs.existsSync(hostBinary)) {
        console.error(`[API] Host binary found at: ${hostBinary}`);
      } else {
        console.error(`[API] ERROR: Host binary not found at: ${hostBinary}`);
        throw new Error(`Host binary not found. Please run 'cargo build --release' in ${this.projectPath}`);
      }

      console.error(`[API] Starting binary execution...`);
      const startTime = Date.now();

      // Simple command without session parameters: modexp base exponent modulus  
      const command = `${hostBinary} modexp ${base} ${exponent} ${modulus}`;
      
      let result;
      
      try {
        const execResult = await execAsync(command, { 
          cwd: this.projectPath, 
          env,
          timeout: 90000 // 90 seconds timeout for operations
        });
        
        const endTime = Date.now();
        console.error(`[API] Binary execution completed in ${endTime - startTime}ms`);

        // Parse the JSON output from the host program
        try {
          // Extract JSON from stdout (skip log lines, find the { } block)
          const lines = execResult.stdout.split('\n');
          let jsonStart = -1;
          let jsonEnd = -1;
          
          // Find the line that starts with '{'
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('{')) {
              jsonStart = i;
              break;
            }
          }
          
          // Find the line that ends with '}'
          for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].trim().endsWith('}')) {
              jsonEnd = i;
              break;
            }
          }
          
          if (jsonStart >= 0 && jsonEnd >= 0) {
            const jsonLines = lines.slice(jsonStart, jsonEnd + 1);
            const jsonString = jsonLines.join('\n');
            
            result = JSON.parse(jsonString);
            console.error(`[API] JSON parsed successfully:`, result);
          } else {
            throw new Error('Could not find JSON block in output');
          }
        } catch (parseError) {
          console.error(`[API] JSON parse failed:`, parseError);
          // If JSON parsing fails, return raw output
          result = {
            error: 'Failed to parse program output',
            raw_output: execResult.stdout,
            raw_stderr: execResult.stderr
          };
        }
      } catch (execError) {
        console.error(`[API] Execution failed:`, execError);
        throw execError;
      }
      
      // Calculate expected result for validation using JavaScript's modular exponentiation
      let expectedResult = 1;
      let baseTemp = base % modulus;
      let expTemp = exponent;
      
      while (expTemp > 0) {
        if (expTemp % 2 === 1) {
          expectedResult = (expectedResult * baseTemp) % modulus;
        }
        baseTemp = (baseTemp * baseTemp) % modulus;
        expTemp = Math.floor(expTemp / 2);
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              computation: {
                operation: 'modexp',
                inputs: { base, exponent, modulus },
                result: result.result,
                expected: expectedResult,
                correct: result.result === expectedResult
              },
              zkProof: {
                mode: 'Production (real ZK proof)',
                imageId: result.image_id,
                verificationStatus: result.verification_status,
                proofFilePath: result.proof_file_path ? path.resolve(this.projectPath, result.proof_file_path) : null
              }
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to perform zkVM modexp: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async performZkVmRange(args: any) {
    const { secretNumber, minValue, maxValue, forceRebuild = false } = args;

    if (typeof secretNumber !== 'number' || typeof minValue !== 'number' || typeof maxValue !== 'number' || 
        secretNumber < 0 || minValue < 0 || maxValue < 0 || 
        !Number.isInteger(secretNumber) || !Number.isInteger(minValue) || !Number.isInteger(maxValue) ||
        minValue > maxValue) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'secretNumber, minValue, and maxValue must be non-negative integers, and minValue <= maxValue'
      );
    }

    try {
      console.error(`[API] Starting zkVM range proof: secret ∈ [${minValue}, ${maxValue}] (production mode)`);
      
      // Ensure the RISC Zero project exists and is built
      await this.ensureProjectExists(forceRebuild);
      
      console.error(`[API] Project ready, executing range proof computation...`);
      const hostBinary = path.join(this.projectPath, 'target', 'release', 'host');
      
      const env = {
        ...process.env,
        RISC0_DEV_MODE: '0', // Always production mode
        RUST_LOG: 'info'
      };

      // Check if host binary exists
      if (fs.existsSync(hostBinary)) {
        console.error(`[API] Host binary found at: ${hostBinary}`);
      } else {
        console.error(`[API] ERROR: Host binary not found at: ${hostBinary}`);
        throw new Error(`Host binary not found. Please run 'cargo build --release' in ${this.projectPath}`);
      }

      console.error(`[API] Starting binary execution...`);
      const startTime = Date.now();

      // Simple command without session parameters: range secretNumber minValue maxValue
      const command = `${hostBinary} range ${secretNumber} ${minValue} ${maxValue}`;
      
      let result;
      
      try {
        const execResult = await execAsync(command, { 
          cwd: this.projectPath, 
          env,
          timeout: 90000 // 90 seconds timeout for operations
        });
        
        const endTime = Date.now();
        console.error(`[API] Binary execution completed in ${endTime - startTime}ms`);

        // Parse the JSON output from the host program
        try {
          // Extract JSON from stdout (skip log lines, find the { } block)
          const lines = execResult.stdout.split('\n');
          let jsonStart = -1;
          let jsonEnd = -1;
          
          // Find the line that starts with '{'
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('{')) {
              jsonStart = i;
              break;
            }
          }
          
          // Find the line that ends with '}'
          for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].trim().endsWith('}')) {
              jsonEnd = i;
              break;
            }
          }
          
          if (jsonStart >= 0 && jsonEnd >= 0) {
            const jsonLines = lines.slice(jsonStart, jsonEnd + 1);
            const jsonString = jsonLines.join('\n');
            
            result = JSON.parse(jsonString);
            console.error(`[API] JSON parsed successfully:`, result);
          } else {
            throw new Error('Could not find JSON block in output');
          }
        } catch (parseError) {
          console.error(`[API] JSON parse failed:`, parseError);
          // If JSON parsing fails, return raw output
          result = {
            error: 'Failed to parse program output',
            raw_output: execResult.stdout,
            raw_stderr: execResult.stderr
          };
        }
      } catch (execError) {
        console.error(`[API] Execution failed:`, execError);
        throw execError;
      }
      
      // Calculate expected result for validation
      const expectedResult = secretNumber >= minValue && secretNumber <= maxValue;
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              computation: {
                operation: 'range',
                inputs: { minValue, maxValue },
                result: result.result === 1,
                expected: expectedResult,
                correct: (result.result === 1) === expectedResult
              },
              zkProof: {
                mode: 'Production (real ZK proof)',
                imageId: result.image_id,
                verificationStatus: result.verification_status,
                proofFilePath: result.proof_file_path ? path.resolve(this.projectPath, result.proof_file_path) : null
              },
              note: 'The secret number remains private - only the range membership result is revealed'
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to perform zkVM range proof: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async verifyProof(args: any) {
    const { proofFilePath } = args;

    if (typeof proofFilePath !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'proofFilePath must be a string'
      );
    }

    try {
      console.error(`[Verify] Starting proof verification: ${proofFilePath}`);
      
      // Check if proof file exists
      if (!fs.existsSync(proofFilePath)) {
        throw new Error(`Proof file not found: ${proofFilePath}`);
      }

      console.error(`[Verify] Proof file found, calling verification tool...`);
      
      // Ensure verification tool is built
      const verifyBinary = path.join(this.projectPath, 'target', 'release', 'verify');
      console.error(`[Verify] Looking for verify binary at: ${verifyBinary}`);
      console.error(`[Verify] Binary exists: ${fs.existsSync(verifyBinary)}`);
      if (!fs.existsSync(verifyBinary)) {
        console.error('[Verify] Building verification tool...');
        await execAsync('cargo build --release --bin verify', { 
          cwd: this.projectPath,
          timeout: 180000 // 3 minutes timeout for build
        });
      }

      console.error(`[Verify] Starting verification process...`);
      const startTime = Date.now();

      // Run the verification tool with verbose output
      const command = `${verifyBinary} --file "${proofFilePath}" --verbose`;
      
      const execResult = await execAsync(command, { 
        cwd: this.projectPath,
        timeout: 60000 // 1 minute timeout for verification
      });

      const endTime = Date.now();
      console.error(`[Verify] Verification completed in ${endTime - startTime}ms`);

      // Parse the verification output
      const output = execResult.stdout;
      const stderr = execResult.stderr;

      // Extract result from output (look for "➡️  Computation result: ... = X")
      const resultMatch = output.match(/➡️\s*Computation result:.*?=\s*([-+]?\d*\.?\d+)/);
      const extractedResult = resultMatch ? parseFloat(resultMatch[1]) : null;

      // Check if verification was successful
      const isSuccessful = output.includes('PROOF VERIFICATION SUCCESSFUL');
      const verificationTimeMatch = output.match(/PROOF VERIFICATION SUCCESSFUL! \(([^)]+)\)/);
      const verificationTime = verificationTimeMatch ? verificationTimeMatch[1] : null;

      // Extract additional details if available
      const imageIdMatch = output.match(/Image ID:\s*([a-f0-9]+)/);
      const journalBytesMatch = output.match(/Journal bytes:\s*(\[[^\]]+\])/);
      const proofSizeMatch = output.match(/Estimated binary size:\s*(\d+) bytes/);

      // Session binding removed - proofs are verified without session context

      const verificationDetails = {
        status: isSuccessful ? 'verified' : 'failed',
        extractedResult,
        verificationTimeMs: endTime - startTime,
        proofDetails: {
          imageId: imageIdMatch ? imageIdMatch[1] : null,
          journalBytes: journalBytesMatch ? journalBytesMatch[1] : null,
          proofSizeBytes: proofSizeMatch ? parseInt(proofSizeMatch[1], 10) : null,
          verificationTime
        }
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              verification: verificationDetails,
              note: isSuccessful ? 
                'Proof verification successful - cryptographically authentic!' :
                'Proof verification failed'
            }, null, 2),
          },
        ],
      };

    } catch (error) {
      console.error(`[Verify] Verification failed:`, error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to verify proof: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async runRustFile(args: any) {
    const { rustFilePath, inputs = [], forceRebuild = false } = args;

    if (typeof rustFilePath !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'rustFilePath must be a string'
      );
    }

    if (!Array.isArray(inputs)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'inputs must be an array'
      );
    }

    try {
      console.error(`[Dynamic] Running Rust file: ${rustFilePath}`);
      
      // Check if file exists
      if (!fs.existsSync(rustFilePath)) {
        throw new Error(`Rust file not found: ${rustFilePath}`);
      }

      // Read the Rust code from file
      const rustCode = fs.readFileSync(rustFilePath, 'utf8');
      
      // Delegate to runRustCode with the file contents
      return await this.runRustCode({ rustCode, inputs, forceRebuild });

    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to run Rust file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async runRustCode(args: any) {
    const { rustCode, inputs = [], forceRebuild = false } = args;

    if (typeof rustCode !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'rustCode must be a string'
      );
    }

    if (!Array.isArray(inputs)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'inputs must be an array'
      );
    }

    try {
      console.error(`[Dynamic] Executing dynamic Rust code (production mode)`);
      console.error(`[Dynamic] Code length: ${rustCode.length} characters`);
      console.error(`[Dynamic] Inputs: ${JSON.stringify(inputs)}`);
      
      // Create a unique temporary guest program using methods build system (no Docker required)
      const codeHash = crypto.createHash('sha256').update(rustCode).digest('hex').substring(0, 16);
      const tempGuestName = `guest-dynamic-${codeHash}`;
      const tempGuestPath = path.join(this.projectPath, 'methods', tempGuestName);
      
      console.error(`[Dynamic] Creating temporary guest program: ${tempGuestName}`);
      
      // Create temporary guest program directory
      if (fs.existsSync(tempGuestPath)) {
        if (forceRebuild) {
          console.error(`[Dynamic] Removing existing temporary guest for rebuild`);
          fs.rmSync(tempGuestPath, { recursive: true, force: true });
        } else {
          console.error(`[Dynamic] Using existing temporary guest program`);
        }
      }
      
      if (!fs.existsSync(tempGuestPath)) {
        await this.createDynamicGuestProgram(tempGuestPath, rustCode);
      }
      
      // Ensure the RISC Zero project is built
      await this.ensureProjectExists(forceRebuild);
      
      // Build the temporary guest program using methods build system to create precompiled binary
      console.error(`[Dynamic] Building temporary guest program...`);
      await this.buildDynamicGuest(tempGuestName, forceRebuild);
      
      console.error(`[Dynamic] Executing dynamic computation...`);
      const hostBinary = path.join(this.projectPath, 'target', 'release', 'host');
      
      const env = {
        ...process.env,
        RISC0_DEV_MODE: '0', // Always production mode
        RUST_LOG: 'info'
      };

      const startTime = Date.now();

      // Execute the precompiled operation with the binary path
      const inputsJson = JSON.stringify(inputs);
      const guestBinaryPath = path.join(this.projectPath, 'target', 'riscv-guest', 'methods', tempGuestName, 'riscv32im-risc0-zkvm-elf', 'release', `${tempGuestName}.bin`);
      
      console.error(`[Dynamic] Using guest binary: ${guestBinaryPath}`);
      console.error(`[Dynamic] Inputs JSON: ${inputsJson}`);
      
      // Check if guest binary exists
      if (!fs.existsSync(guestBinaryPath)) {
        throw new Error(`Guest binary not found: ${guestBinaryPath}`);
      }
      
      const command = `${hostBinary} precompiled "${guestBinaryPath}" '${inputsJson}'`;
      
      let result;
      
      try {
        const execResult = await execAsync(command, { 
          cwd: this.projectPath, 
          env,
          timeout: 240000 // 4 minutes timeout for dynamic code
        });
        
        const endTime = Date.now();
        console.error(`[Dynamic] Execution completed in ${endTime - startTime}ms`);

        // Parse the JSON output from the host program
        try {
          const lines = execResult.stdout.split('\n');
          let jsonStart = -1;
          let jsonEnd = -1;
          
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('{')) {
              jsonStart = i;
              break;
            }
          }
          
          for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].trim().endsWith('}')) {
              jsonEnd = i;
              break;
            }
          }
          
          if (jsonStart >= 0 && jsonEnd >= 0) {
            const jsonLines = lines.slice(jsonStart, jsonEnd + 1);
            const jsonString = jsonLines.join('\n');
            
            result = JSON.parse(jsonString);
            console.error(`[Dynamic] JSON parsed successfully:`, result);
          } else {
            throw new Error('Could not find JSON block in output');
          }
        } catch (parseError) {
          console.error(`[Dynamic] JSON parse failed:`, parseError);
          result = {
            error: 'Failed to parse program output',
            raw_output: execResult.stdout,
            raw_stderr: execResult.stderr
          };
        }
      } catch (execError) {
        console.error(`[Dynamic] Execution failed:`, execError);
        throw execError;
      } finally {
        // Clean up temporary guest directory and remove from methods build
        try {
          await this.removeGuestFromMethodsCargoToml(tempGuestName);
          if (fs.existsSync(tempGuestPath)) {
            fs.rmSync(tempGuestPath, { recursive: true, force: true });
            console.error(`[Dynamic] Cleaned up temporary guest directory: ${tempGuestPath}`);
          }
        } catch (cleanupError) {
          console.error(`[Dynamic] Failed to cleanup temporary guest: ${cleanupError}`);
        }
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              computation: {
                operation: 'dynamic_rust',
                codeHash,
                inputs,
                result: result.result || result,
                executionTimeMs: result.total_time_ms || 0
              },
              zkProof: {
                mode: 'Production (real ZK proof)',
                imageId: result.image_id,
                verificationStatus: result.verification_status,
                proofFilePath: result.proof_file_path ? path.resolve(this.projectPath, result.proof_file_path) : null
              },
              dynamicExecution: {
                tempGuestName: tempGuestName,
                codeLength: rustCode.length,
                successful: !result.error
              }
            }, null, 2),
          },
        ],
      };
      
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to execute dynamic Rust code: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async createDynamicGuestProgram(guestPath: string, rustCode: string): Promise<void> {
    console.error(`[Dynamic] Creating guest program at: ${guestPath}`);
    
    // Create directory structure
    fs.mkdirSync(guestPath, { recursive: true });
    fs.mkdirSync(path.join(guestPath, 'src'), { recursive: true });
    
    // Create Cargo.toml with empty workspace to prevent workspace conflicts
    const cargoToml = `[package]
name = "${path.basename(guestPath)}"
version = "0.1.0"
edition = "2021"

[dependencies]
risc0-zkvm = { version = "^2.3.1", default-features = false, features = ["std"] }
serde = { version = "1.0", default-features = false, features = ["derive", "alloc"] }
serde_json = { version = "1.0", default-features = false, features = ["alloc"] }

[[bin]]
name = "${path.basename(guestPath)}"
path = "src/main.rs"

[workspace]
# Empty workspace to prevent conflicts with parent workspace
`;
    
    fs.writeFileSync(path.join(guestPath, 'Cargo.toml'), cargoToml);
    
    // Validate and wrap the user's Rust code
    const wrappedCode = this.wrapUserRustCode(rustCode);
    
    fs.writeFileSync(path.join(guestPath, 'src', 'main.rs'), wrappedCode);
    
    console.error(`[Dynamic] Guest program created successfully`);
  }

  private wrapUserRustCode(userCode: string): string {
    // Security validation
    if (this.containsUnsafeOperations(userCode)) {
      throw new Error('Rust code contains unsafe operations that are not allowed');
    }
    
    // Check if user code already has proper zkVM structure
    if (userCode.includes('#![no_main]') && userCode.includes('risc0_zkvm::guest::entry!')) {
      // User provided complete zkVM guest code
      return userCode;
    }
    
    // If user code defines its own main function, wrap it appropriately
    if (userCode.includes('fn main()')) {
      // User provided a main function, wrap it in zkVM structure
      return `#![no_main]
#![no_std]

extern crate alloc;
use alloc::string::String;
use alloc::vec::Vec;

risc0_zkvm::guest::entry!(main);

${userCode}
`;
    }
    
    // Default: wrap user code in a computation function
    return `#![no_main]
#![no_std]

extern crate alloc;
use alloc::vec::Vec;
use alloc::string::String;
use risc0_zkvm::guest::env;
use serde_json::{Value, from_str, Number};

risc0_zkvm::guest::entry!(main);

fn main() {
    // Read inputs from host
    let inputs_json: String = env::read();
    let inputs: Value = from_str(&inputs_json).unwrap_or(Value::Null);
    
    // Execute user code
    let result_value = user_computation(&inputs, &inputs_json);
    
    // Convert result to i64 for commitment
    let result_i64: i64 = match result_value {
        Value::Number(n) => n.as_i64().unwrap_or(0),
        _ => 0
    };
    
    // Commit result
    env::commit(&result_i64);
}

// User's computation function - receives both parsed Value and raw JSON string
fn user_computation(inputs: &Value, inputs_json: &str) -> Value {
    // Allow user code to work with either parsed inputs or raw JSON
    ${this.indentCode(userCode, 4)}
    
    // If user code doesn't return a Value, default to 0
    Value::Number(Number::from(0))
}
`;
  }

  private containsUnsafeOperations(code: string): boolean {
    const unsafePatterns = [
      /std::fs/,
      /std::net/,
      /std::thread/,
      /std::process/,
      /unsafe\s*{/,
      /extern\s+"C"/,
      /libc::/,
      /__/,  // Double underscore functions (often internal/unsafe)
    ];
    
    return unsafePatterns.some(pattern => pattern.test(code));
  }

  private indentCode(code: string, spaces: number): string {
    const indent = ' '.repeat(spaces);
    return code.split('\n').map(line => indent + line).join('\n');
  }

  private async buildDynamicGuest(guestName: string, forceRebuild: boolean): Promise<void> {
    console.error(`[Dynamic] Building guest program: ${guestName}`);
    
    // Check if the guest program binary already exists
    const methodsTargetPath = path.join(this.projectPath, 'target', 'riscv-guest', 'methods', guestName, 'riscv32im-risc0-zkvm-elf', 'release', `${guestName}.bin`);
    if (fs.existsSync(methodsTargetPath) && !forceRebuild) {
      console.error(`[Dynamic] Guest program binary already exists, skipping build`);
      return;
    }
    
    // Add the temporary guest to the methods Cargo.toml temporarily
    await this.addGuestToMethodsCargoToml(guestName);
    
    try {
      if (forceRebuild) {
        console.error(`[Dynamic] Force rebuild requested, cleaning first...`);
        await execAsync('cargo clean', { cwd: this.projectPath, timeout: 60000 });
      }
      
      // Build using the methods build system with shorter timeout to fit MCP limits
      console.error(`[Dynamic] Building with RISC Zero methods build system...`);
      console.error(`[Dynamic] Building`);
      
      // For production use, we need to build through the methods system
      // Try an incremental build approach to reduce build time
      console.error(`[Dynamic] Attempting incremental build...`);
      
      try {
        // Use cargo check first to validate without full compilation
        await execAsync('cargo check --release', {
          cwd: this.projectPath,
          timeout: 60000, // 1 minute for check
          env: {
            ...process.env,
            RISC0_DEV_MODE: '0'
          }
        });
        
        // Then do the actual build with limited timeout
        await execAsync('cargo build --release --bin host', {
          cwd: this.projectPath,
          timeout: 180000, // 3 minutes for host build
          env: {
            ...process.env,
            RISC0_DEV_MODE: '0'
          }
        });
        
      } catch (buildError) {
        console.error(`[Dynamic] Incremental build failed, trying minimal approach...`);
        // If that fails, provide a helpful error message
        throw new Error(`Build timed out. The dynamic code compilation is taking too long for the MCP timeout. Please pre-build the project with: cd ${this.projectPath} && cargo build --release`);
      }
      
      console.error(`[Dynamic] Guest program built successfully`);
    } catch (error) {
      console.error(`[Dynamic] Build failed: ${error}`);
      // If build times out, suggest pre-building
      if (error instanceof Error && error.message.includes('timeout')) {
        throw new Error(`Build timed out. Try pre-building with: cd ${this.projectPath} && cargo build --release`);
      }
      throw error;
    } finally {
      // Always remove the guest from methods Cargo.toml
      await this.removeGuestFromMethodsCargoToml(guestName);
    }
  }

  private async addGuestToMethodsCargoToml(guestName: string): Promise<void> {
    const methodsCargoTomlPath = path.join(this.projectPath, 'methods', 'Cargo.toml');
    const cargoTomlContent = fs.readFileSync(methodsCargoTomlPath, 'utf8');
    
    // Add the guest to the methods array
    const updatedContent = cargoTomlContent.replace(
      /methods = \[(.*?)\]/s,
      (match, methods) => {
        const methodsList = methods.split(',').map((m: string) => m.trim().replace(/"/g, '')).filter((m: string) => m);
        if (!methodsList.includes(guestName)) {
          methodsList.push(guestName);
        }
        const newMethods = methodsList.map((m: string) => `"${m}"`).join(', ');
        return `methods = [${newMethods}]`;
      }
    );
    
    fs.writeFileSync(methodsCargoTomlPath, updatedContent);
    console.error(`[Dynamic] Added ${guestName} to methods build`);
  }

  private async removeGuestFromMethodsCargoToml(guestName: string): Promise<void> {
    const methodsCargoTomlPath = path.join(this.projectPath, 'methods', 'Cargo.toml');
    const cargoTomlContent = fs.readFileSync(methodsCargoTomlPath, 'utf8');
    
    // Remove the guest from the methods array
    const updatedContent = cargoTomlContent.replace(
      /methods = \[(.*?)\]/s,
      (match, methods) => {
        const methodsList = methods.split(',').map((m: string) => m.trim().replace(/"/g, '')).filter((m: string) => m && m !== guestName);
        const newMethods = methodsList.map((m: string) => `"${m}"`).join(', ');
        return `methods = [${newMethods}]`;
      }
    );
    
    fs.writeFileSync(methodsCargoTomlPath, updatedContent);
    console.error(`[Dynamic] Removed ${guestName} from methods build`);
    
    // Also clean up the temporary guest directory
    const guestPath = path.join(this.projectPath, 'methods', guestName);
    if (fs.existsSync(guestPath)) {
      fs.rmSync(guestPath, { recursive: true, force: true });
      console.error(`[Dynamic] Cleaned up temporary guest directory`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('RISC Zero Code MCP server running on stdio');
  }
}

const server = new RiscZeroCodeServer();
server.run().catch(console.error);