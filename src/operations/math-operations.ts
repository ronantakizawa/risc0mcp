import * as fs from 'fs';
import * as path from 'path';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { execAsync, ProjectUtils } from '../utils.js';
import { ZkVmResult, ToolResponse } from '../types.js';

export class MathOperations {
  constructor(private projectPath: string) {}

  async performZkVmSqrt(args: any): Promise<ToolResponse> {
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
      await ProjectUtils.ensureProjectExists(this.projectPath, forceRebuild);
      
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

  async performZkVmModexp(args: any): Promise<ToolResponse> {
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
      await ProjectUtils.ensureProjectExists(this.projectPath, forceRebuild);
      
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

  async performZkVmRange(args: any): Promise<ToolResponse> {
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
      await ProjectUtils.ensureProjectExists(this.projectPath, forceRebuild);
      
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
}