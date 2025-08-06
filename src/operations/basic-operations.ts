import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { execAsync, ProjectUtils } from '../utils.js';
import { ZkVmResult, ComputationResult, ZkProofInfo, ToolResponse } from '../types.js';
import * as ed25519 from '@noble/ed25519';
import { KeyManager } from '../crypto/key-manager.js';

// Configure the hash function for ed25519
ed25519.etc.sha512Sync = (...m) => crypto.createHash('sha512').update(Buffer.concat(m)).digest();

export class BasicOperations {
  constructor(private projectPath: string) {}

  async performZkVmOperation(operation: string, args: any): Promise<ToolResponse> {
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
      await ProjectUtils.ensureProjectExists(this.projectPath, forceRebuild);
      
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
      
      let result: ZkVmResult;
      
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
          result = ProjectUtils.parseJsonFromOutput(execResult.stdout);
          console.error(`[API] JSON parsed successfully:`, result);
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

  async performAuthenticatedOperation(operation: string, args: any): Promise<ToolResponse> {
    const { keyId = 'default', forceRebuild = false } = args;

    if (typeof keyId !== 'string' || keyId.length === 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'keyId must be a non-empty string'
      );
    }

    // Validate inputs based on operation
    switch (operation) {
      case 'add':
      case 'multiply':
        if (typeof args.a !== 'number' || typeof args.b !== 'number') {
          throw new McpError(ErrorCode.InvalidParams, 'Both a and b must be numbers');
        }
        break;
      case 'sqrt':
        if (typeof args.n !== 'number' || args.n < 0) {
          throw new McpError(ErrorCode.InvalidParams, 'n must be a non-negative number');
        }
        break;
      case 'modexp':
        if (typeof args.base !== 'number' || typeof args.exponent !== 'number' || typeof args.modulus !== 'number') {
          throw new McpError(ErrorCode.InvalidParams, 'base, exponent, and modulus must be numbers');
        }
        break;
      case 'range':
        if (typeof args.secretNumber !== 'number' || typeof args.minValue !== 'number' || typeof args.maxValue !== 'number') {
          throw new McpError(ErrorCode.InvalidParams, 'secretNumber, minValue, and maxValue must be numbers');
        }
        break;
      default:
        throw new McpError(ErrorCode.InvalidParams, `Unsupported authenticated operation: ${operation}`);
    }

    try {
      console.error(`[API] Starting authenticated zkVM ${operation}${this.getOperationInputsLog(operation, args)} (key: ${keyId})`);
      
      // Ensure the RISC Zero project exists and is built
      await ProjectUtils.ensureProjectExists(this.projectPath, forceRebuild);
      
      console.error(`[API] Project ready, executing authenticated computation...`);
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

      console.error(`[API] Starting authenticated binary execution...`);
      const startTime = Date.now();

      // Build command based on operation
      const command = this.buildAuthenticatedCommand(hostBinary, operation, args, keyId);
      
      let result: ZkVmResult;
      
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
          result = ProjectUtils.parseJsonFromOutput(execResult.stdout);
          console.error(`[API] JSON parsed successfully:`, result);
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

      // Now perform signature verification on the server side
      console.error(`[API] Performing server-side signature verification...`);
      let authenticationResult: any = {
        verified: false,
        publicKey: 'N/A',
        signature: 'N/A',
        message: 'N/A'
      };

      try {
        // Get password for key decryption
        const password = KeyManager.getPassword();
        
        // Load and decrypt private key from encrypted storage
        const projectRoot = path.dirname(this.projectPath); // Go up from risc0code to project root
        const keyPath = path.join(projectRoot, 'keys', `${keyId}.key`);
        const privateKeyHex = KeyManager.getDecryptedKey(keyPath, password);
        const privateKeyFull = Buffer.from(privateKeyHex, 'hex');
        
        // Ed25519 private key should be 32 bytes (seed). The 64-byte format includes the public key.
        // Use only the first 32 bytes (the seed part)
        const privateKeyBytes = privateKeyFull.slice(0, 32);
        
        // Load and decrypt public key
        const publicKeyPath = path.join(projectRoot, 'keys', 'public', `${keyId}.pub`);
        const publicKeyHex = KeyManager.getDecryptedKey(publicKeyPath, password);
        const publicKeyBytes = Buffer.from(publicKeyHex, 'hex');
        
        // Create message to sign (matching the format used in the original guest code)
        const message = this.buildAuthenticationMessage(operation, args, result, publicKeyHex);
        const messageBytes = Buffer.from(message, 'utf8');
        
        // Sign the message
        const signature = await ed25519.sign(messageBytes, privateKeyBytes);
        
        // Verify the signature
        const isValid = await ed25519.verify(signature, messageBytes, publicKeyBytes);
        
        authenticationResult = {
          verified: isValid,
          publicKey: publicKeyHex,
          signature: Buffer.from(signature).toString('hex'),
          message: message,
          taskId: result.task_id,
          timestamp: result.timestamp
        };
        
        console.error(`[API] Signature verification: ${isValid ? 'VALID' : 'INVALID'}`);
      } catch (authError) {
        console.error(`[API] Authentication error:`, authError);
        authenticationResult.error = authError instanceof Error ? authError.message : String(authError);
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              computation: {
                operation: `authenticated_${operation}`,
                inputs: this.getOperationInputs(operation, args, keyId),
                result: result.result,
                expected: this.getExpectedResult(operation, args),
                correct: result.result === this.getExpectedResult(operation, args)
              },
              zkProof: {
                mode: 'Authenticated Production Proof',
                imageId: result.image_id,
                verificationStatus: result.verification_status,
                proofFilePath: result.proof_file_path ? path.resolve(this.projectPath, result.proof_file_path) : null
              },
              authentication: authenticationResult
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to perform authenticated zkVM ${operation}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private getOperationInputsLog(operation: string, args: any): string {
    switch (operation) {
      case 'add':
      case 'multiply':
        return ` ${args.a} ${operation === 'add' ? '+' : '*'} ${args.b}`;
      case 'sqrt':
        return ` sqrt(${args.n})`;
      case 'modexp':
        return ` ${args.base}^${args.exponent} mod ${args.modulus}`;
      case 'range':
        return ` secret ∈ [${args.minValue}, ${args.maxValue}]`;
      default:
        return '';
    }
  }

  private buildAuthenticatedCommand(hostBinary: string, operation: string, args: any, keyId: string): string {
    switch (operation) {
      case 'add':
      case 'multiply':
        return `${hostBinary} authenticated_${operation} ${args.a} ${args.b} ${keyId}`;
      case 'sqrt':
        return `${hostBinary} authenticated_${operation} ${args.n} ${keyId}`;
      case 'modexp':
        return `${hostBinary} authenticated_${operation} ${args.base} ${args.exponent} ${args.modulus} ${keyId}`;
      case 'range':
        return `${hostBinary} authenticated_${operation} ${args.secretNumber} ${args.minValue} ${args.maxValue} ${keyId}`;
      default:
        throw new Error(`Unknown authenticated operation: ${operation}`);
    }
  }

  private getOperationInputs(operation: string, args: any, keyId: string): any {
    const base = { keyId };
    switch (operation) {
      case 'add':
      case 'multiply':
        return { ...base, a: args.a, b: args.b };
      case 'sqrt':
        return { ...base, n: args.n };
      case 'modexp':
        return { ...base, base: args.base, exponent: args.exponent, modulus: args.modulus };
      case 'range':
        return { ...base, secretNumber: '***HIDDEN***', minValue: args.minValue, maxValue: args.maxValue };
      default:
        return base;
    }
  }

  private getExpectedResult(operation: string, args: any): number {
    switch (operation) {
      case 'add':
        return args.a + args.b;
      case 'multiply':
        return args.a * args.b;
      case 'sqrt':
        return Math.sqrt(args.n);
      case 'modexp':
        return Math.pow(args.base, args.exponent) % args.modulus;
      case 'range':
        return (args.secretNumber >= args.minValue && args.secretNumber <= args.maxValue) ? 1 : 0;
      default:
        return 0;
    }
  }

  private buildAuthenticationMessage(operation: string, args: any, result: any, publicKeyHex: string): string {
    const baseInfo = `OPERATION:${operation}|RESULT:${result.result}|TASK:${result.task_id}|TIME:${result.timestamp}|PUBKEY:${publicKeyHex}`;
    
    switch (operation) {
      case 'add':
      case 'multiply':
        return `COMPUTATION:${args.a}${operation === 'add' ? '+' : '*'}${args.b}=${result.result}|${baseInfo}`;
      case 'sqrt':
        return `COMPUTATION:sqrt(${args.n})=${result.result}|${baseInfo}`;
      case 'modexp':
        return `COMPUTATION:${args.base}^${args.exponent} mod ${args.modulus}=${result.result}|${baseInfo}`;
      case 'range':
        return `COMPUTATION:secret ∈ [${args.minValue}, ${args.maxValue}]=${result.result}|${baseInfo}`;
      default:
        return baseInfo;
    }
  }

  // Keep the original method for backward compatibility
  async performAuthenticatedAdd(args: any): Promise<ToolResponse> {
    return this.performAuthenticatedOperation('add', args);
  }

  // New authenticated operation methods
  async performAuthenticatedMultiply(args: any): Promise<ToolResponse> {
    return this.performAuthenticatedOperation('multiply', args);
  }

  async performAuthenticatedSqrt(args: any): Promise<ToolResponse> {
    return this.performAuthenticatedOperation('sqrt', args);
  }

  async performAuthenticatedModexp(args: any): Promise<ToolResponse> {
    return this.performAuthenticatedOperation('modexp', args);
  }

  async performAuthenticatedRange(args: any): Promise<ToolResponse> {
    return this.performAuthenticatedOperation('range', args);
  }

  async performKMeans(args: any): Promise<ToolResponse> {
    const { dataPoints, k, maxIterations = 10, queryPoint } = args;

    if (!Array.isArray(dataPoints) || dataPoints.length === 0) {
      throw new McpError(ErrorCode.InvalidParams, 'dataPoints must be a non-empty array');
    }
    if (typeof k !== 'number' || k < 1) {
      throw new McpError(ErrorCode.InvalidParams, 'k must be a positive integer');
    }
    if (!Array.isArray(queryPoint) || queryPoint.length !== 2) {
      throw new McpError(ErrorCode.InvalidParams, 'queryPoint must be an array of 2 numbers [x, y]');
    }

    try {
      console.error(`[API] Starting zkVM K-means clustering: ${dataPoints.length} points, k=${k}, query=[${queryPoint}]`);
      
      await ProjectUtils.ensureProjectExists(this.projectPath, false);
      
      const hostBinary = path.join(this.projectPath, 'target', 'release', 'host');
      
      const env = {
        ...process.env,
        RISC0_DEV_MODE: '0',
        RUST_LOG: 'info'
      };

      if (!fs.existsSync(hostBinary)) {
        throw new Error(`Host binary not found. Please run 'cargo build --release' in ${this.projectPath}`);
      }

      const inputData = JSON.stringify({
        data_points: dataPoints,
        k: k,
        max_iterations: maxIterations,
        query_point: queryPoint
      });

      const command = `${hostBinary} k_means '${inputData}'`;
      
      const execResult = await execAsync(command, { 
        cwd: this.projectPath, 
        env,
        timeout: 90000
      });

      const result = ProjectUtils.parseJsonFromOutput(execResult.stdout);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              computation: {
                operation: 'k_means_clustering',
                inputs: {
                  dataPoints: dataPoints,
                  k: k,
                  maxIterations: maxIterations,
                  queryPoint: queryPoint
                },
                result: result.result,
                clusteredDataPoints: result.clustered_data_points || 'N/A'
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
        `Failed to perform zkVM K-means clustering: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async performLinearRegression(args: any): Promise<ToolResponse> {
    const { xValues, yValues, predictX } = args;

    if (!Array.isArray(xValues) || !Array.isArray(yValues)) {
      throw new McpError(ErrorCode.InvalidParams, 'xValues and yValues must be arrays');
    }
    if (xValues.length !== yValues.length || xValues.length < 2) {
      throw new McpError(ErrorCode.InvalidParams, 'xValues and yValues must have same length and at least 2 elements');
    }
    if (typeof predictX !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'predictX must be a number');
    }

    try {
      console.error(`[API] Starting zkVM linear regression: ${xValues.length} data points, predict x=${predictX}`);
      
      await ProjectUtils.ensureProjectExists(this.projectPath, false);
      
      const hostBinary = path.join(this.projectPath, 'target', 'release', 'host');
      
      const env = {
        ...process.env,
        RISC0_DEV_MODE: '0',
        RUST_LOG: 'info'
      };

      if (!fs.existsSync(hostBinary)) {
        throw new Error(`Host binary not found. Please run 'cargo build --release' in ${this.projectPath}`);
      }

      const inputData = JSON.stringify({
        x_values: xValues,
        y_values: yValues,
        predict_x: predictX
      });

      const command = `${hostBinary} linear_regression '${inputData}'`;
      
      const execResult = await execAsync(command, { 
        cwd: this.projectPath, 
        env,
        timeout: 90000
      });

      const result = ProjectUtils.parseJsonFromOutput(execResult.stdout);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              computation: {
                operation: 'linear_regression',
                inputs: {
                  xValues: xValues,
                  yValues: yValues,
                  predictX: predictX
                },
                result: result.result,
                slope: result.slope || 'N/A',
                intercept: result.intercept || 'N/A'
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
        `Failed to perform zkVM linear regression: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async performNeuralNetwork(args: any): Promise<ToolResponse> {
    const { inputs, learningRate = 0.1, epochs = 100 } = args;

    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw new McpError(ErrorCode.InvalidParams, 'inputs must be a non-empty array');
    }
    if (typeof learningRate !== 'number' || learningRate <= 0) {
      throw new McpError(ErrorCode.InvalidParams, 'learningRate must be a positive number');
    }
    if (typeof epochs !== 'number' || epochs < 1) {
      throw new McpError(ErrorCode.InvalidParams, 'epochs must be a positive integer');
    }

    try {
      console.error(`[API] Starting zkVM neural network: inputs=[${inputs}], lr=${learningRate}, epochs=${epochs}`);
      
      await ProjectUtils.ensureProjectExists(this.projectPath, false);
      
      const hostBinary = path.join(this.projectPath, 'target', 'release', 'host');
      
      const env = {
        ...process.env,
        RISC0_DEV_MODE: '0',
        RUST_LOG: 'info'
      };

      if (!fs.existsSync(hostBinary)) {
        throw new Error(`Host binary not found. Please run 'cargo build --release' in ${this.projectPath}`);
      }

      const inputData = JSON.stringify({
        inputs: inputs,
        learning_rate: learningRate,
        epochs: epochs
      });

      const command = `${hostBinary} neural_network '${inputData}'`;
      
      const execResult = await execAsync(command, { 
        cwd: this.projectPath, 
        env,
        timeout: 90000
      });

      const result = ProjectUtils.parseJsonFromOutput(execResult.stdout);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              computation: {
                operation: 'neural_network',
                inputs: {
                  inputs: inputs,
                  learningRate: learningRate,
                  epochs: epochs
                },
                result: result.result,
                finalWeights: result.final_weights || 'N/A',
                finalOutput: result.final_output || 'N/A'
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
        `Failed to perform zkVM neural network: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}