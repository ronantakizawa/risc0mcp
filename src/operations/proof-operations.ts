import * as fs from 'fs';
import * as path from 'path';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { execAsync } from '../utils.js';
import { ToolResponse } from '../types.js';

export class ProofOperations {
  constructor(private projectPath: string) {}

  async verifyProof(args: any): Promise<ToolResponse> {
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
}