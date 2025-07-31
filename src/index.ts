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
    this.projectPath = path.join(process.cwd(), 'risc0code');

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
          console.error('[Setup] Force rebuild requested, cleaning first...');
          await execAsync('cargo clean', { cwd: this.projectPath });
        }
        
        // Build the project with extended timeout
        await execAsync('cargo build --release', { 
          cwd: this.projectPath,
          timeout: 600000 // 10 minutes timeout for build
        });
        
        console.error('[Setup] RISC Zero project built successfully');
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

      // Use the pre-built binary directly to avoid build time
      const command = `${hostBinary} ${operation} ${a} ${b}`;
      
      let result;
      
      try {
        const execResult = await execAsync(command, { 
          cwd: this.projectPath, 
          env,
          timeout: 60000 // Should complete within MCP inspector timeout now
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

      // Use the pre-built binary directly to avoid build time
      const command = `${hostBinary} sqrt ${n}`;
      
      let result;
      
      try {
        const execResult = await execAsync(command, { 
          cwd: this.projectPath, 
          env,
          timeout: 60000 // Should complete within MCP inspector timeout now
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

      // Use the pre-built binary directly to avoid build time
      const command = `${hostBinary} modexp ${base} ${exponent} ${modulus}`;
      
      let result;
      
      try {
        const execResult = await execAsync(command, { 
          cwd: this.projectPath, 
          env,
          timeout: 60000 // Should complete within MCP inspector timeout now
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

      // Use the pre-built binary directly to avoid build time
      const command = `${hostBinary} range ${secretNumber} ${minValue} ${maxValue}`;
      
      let result;
      
      try {
        const execResult = await execAsync(command, { 
          cwd: this.projectPath, 
          env,
          timeout: 60000 // Should complete within MCP inspector timeout now
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
      if (!fs.existsSync(verifyBinary)) {
        console.error('[Verify] Building verification tool...');
        await execAsync('cargo build --release --bin verify', { 
          cwd: this.projectPath,
          timeout: 300000 // 5 minutes timeout for build
        });
      }

      console.error(`[Verify] Starting verification process...`);
      const startTime = Date.now();

      // Run the verification tool with verbose output
      const command = `${verifyBinary} --file "${proofFilePath}" --verbose`;
      
      const execResult = await execAsync(command, { 
        cwd: this.projectPath,
        timeout: 30000 // 30 seconds should be plenty for verification
      });

      const endTime = Date.now();
      console.error(`[Verify] Verification completed in ${endTime - startTime}ms`);

      // Parse the verification output
      const output = execResult.stdout;
      const stderr = execResult.stderr;

      // Extract result from output (look for "➡️  Computation result: X")
      const resultMatch = output.match(/➡️\s*Computation result:\s*(\d+)/);
      const extractedResult = resultMatch ? parseInt(resultMatch[1], 10) : null;

      // Check if verification was successful
      const isSuccessful = output.includes('PROOF VERIFICATION SUCCESSFUL');
      const verificationTimeMatch = output.match(/PROOF VERIFICATION SUCCESSFUL! \(([^)]+)\)/);
      const verificationTime = verificationTimeMatch ? verificationTimeMatch[1] : null;

      // Extract additional details if available
      const imageIdMatch = output.match(/Image ID:\s*([a-f0-9]+)/);
      const journalBytesMatch = output.match(/Journal bytes:\s*(\[[^\]]+\])/);
      const proofSizeMatch = output.match(/Estimated binary size:\s*(\d+) bytes/);

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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('RISC Zero Code MCP server running on stdio');
  }
}

const server = new RiscZeroCodeServer();
server.run().catch(console.error);