import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { execAsync, ProjectUtils } from '../utils.js';
import { ZkVmResult, ToolResponse } from '../types.js';

export class DynamicOperations {
  constructor(private projectPath: string) {}

  async runRustFile(args: any): Promise<ToolResponse> {
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

  async runRustCode(args: any): Promise<ToolResponse> {
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
      console.error(`[Dynamic] Process start time: ${new Date().toISOString()}`);
      
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
      await ProjectUtils.ensureProjectExists(this.projectPath, forceRebuild);
      
      // Build the temporary guest program using methods build system to create precompiled binary
      console.error(`[Dynamic] Building temporary guest program...`);
      await this.buildDynamicGuest(tempGuestName, forceRebuild);
      
      console.error(`[Dynamic] Executing dynamic computation...`);
      const hostBinary = path.join(this.projectPath, 'target', 'release', 'host');
      
      const env = {
        ...process.env,
        RISC0_DEV_MODE: '0', // Production mode for real ZK proofs
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
      
      // Clean up temp file after use
      const cleanup = () => {
        try {
          if (fs.existsSync(tempGuestPath)) {
            fs.rmSync(tempGuestPath, { recursive: true, force: true });
          }
        } catch (e) {
          console.error(`[Dynamic] Failed to cleanup temp file: ${e}`);
        }
      };
      
      let result: ZkVmResult;
      
      try {
        const execResult = await execAsync(command, { 
          cwd: this.projectPath, 
          env,
          timeout: 1800000 // 30 minutes timeout for dynamic code execution
        });
        
        const endTime = Date.now();
        console.error(`[Dynamic] Execution completed in ${endTime - startTime}ms`);

        // Parse the JSON output from the host program
        try {
          result = ProjectUtils.parseJsonFromOutput(execResult.stdout);
          console.error(`[Dynamic] JSON parsed successfully:`, result);
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
          cleanup();
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
    if (ProjectUtils.containsUnsafeOperations(userCode)) {
      throw new Error('Rust code contains unsafe operations that are not allowed');
    }
    
    // Check if user code already has proper zkVM structure
    if (userCode.includes('#![no_main]') && userCode.includes('risc0_zkvm::guest::entry!')) {
      // User provided complete zkVM guest code
      return userCode;
    }
    
    // If user code defines its own main function, rename it and wrap appropriately
    if (userCode.includes('fn main()')) {
      // User provided a main function, rename it to avoid conflicts and wrap it in zkVM structure
      let renamedUserCode = userCode.replace(/fn main\(\)/g, 'fn user_main()');
      // Remove println! statements as they're not available in no_std environment
      renamedUserCode = renamedUserCode.replace(/println!\s*\([^)]*\)\s*;?/g, '// println! removed (not available in no_std)');
      
      return `#![no_main]
#![no_std]

extern crate alloc;
use alloc::string::String;
use alloc::vec::Vec;
use risc0_zkvm::guest::env;

risc0_zkvm::guest::entry!(main);

fn main() {
    // Execute user's main function
    let result = user_main();
    
    // Commit the result or default value
    env::commit(&result);
}

fn user_main() -> i64 {
    ${ProjectUtils.indentCode(renamedUserCode, 4)}
    
    // Return a default result if user code doesn't return anything
    42i64
}
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
    ${ProjectUtils.indentCode(userCode, 4)}
    
    // If user code doesn't return a Value, default to 0
    Value::Number(Number::from(0))
}
`;
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
        await execAsync('cargo clean', { cwd: this.projectPath, timeout: 300000 }); // 5 minutes for clean
      }
      
      // Build using the methods build system with shorter timeout to fit MCP limits
      console.error(`[Dynamic] Building with RISC Zero methods build system...`);
      console.error(`[Dynamic] Building`);
      
      // For production use, we need to build through the methods system
      // Try an incremental build approach to reduce build time
      console.error(`[Dynamic] Attempting incremental build...`);
      
      try {
        // Skip cargo check and go directly to build with maximum timeout
        console.error(`[Dynamic] Attempting full build with extended timeout...`);
        console.error(`[Dynamic] Build start time: ${new Date().toISOString()}`);
        console.error(`[Dynamic] Building guest: ${guestName}`);
        console.error(`[Dynamic] Build command: cargo build --release`);
        console.error(`[Dynamic] Working directory: ${this.projectPath}`);
        
        const buildStartTime = Date.now();
        
        // Build with maximum timeout - focus on methods which includes our dynamic guest
        const buildResult = await execAsync('cargo build --release', {
          cwd: this.projectPath,
          timeout: 2400000, // 40 minutes for full build including guest programs
          env: {
            ...process.env,
            RISC0_DEV_MODE: '0'  // Production mode for real ZK proofs
          }
        });
        
        const buildEndTime = Date.now();
        console.error(`[Dynamic] Build completed in ${(buildEndTime - buildStartTime) / 1000} seconds`);
        console.error(`[Dynamic] Build stdout length: ${buildResult.stdout?.length || 0}`);
        console.error(`[Dynamic] Build stderr length: ${buildResult.stderr?.length || 0}`);
        
      } catch (buildError) {
        console.error(`[Dynamic] Build failed after extended timeout:`, buildError);
        // If that fails, provide a helpful error message
        throw new Error(`Build timed out after 40 minutes. The dynamic code compilation is taking too long for the MCP timeout. Please pre-build the project with: cd ${this.projectPath} && cargo build --release`);
      }
      
      console.error(`[Dynamic] Guest program built successfully`);
    } catch (error) {
      console.error(`[Dynamic] Build failed: ${error}`);
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
}