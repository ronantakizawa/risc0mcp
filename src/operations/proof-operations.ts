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

      // Extract result from output (all supported formats)
      // Format 1: "➡️  Computation result: sqrt(N) = X" (math operations)
      // Format 2: "➡️  Computation result: A^B mod C = X" (modexp)
      // Format 3: "➡️  Computation result: secret ∈ [min, max] = X" (range proof)
      // Format 4: "➡️  Computation result: A + B = X" (addition/multiply)
      // Format 5: "➡️  K-means clustering result: cluster X" (k-means)
      // Format 6: "➡️  Linear regression prediction: X" (linear regression)
      // Format 7: "➡️  Neural network output: X" (neural network)  
      // Format 8: "➡️  Logistic regression probability: X.XXXX (classification)" (logistic)
      // Format 9: "➡️  Computation result: X" (generic/dynamic)
      const resultMatch = output.match(/➡️\s*(?:Computation result:.*?=\s*|K-means clustering result: cluster\s*|Linear regression prediction:\s*|Neural network output:\s*|Logistic regression probability:\s*|Computation result:\s*)([-+]?\d*\.?\d+)/);
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

  async verifyProofData(args: any): Promise<ToolResponse> {
    const { proofData, proofSize } = args;

    if (typeof proofData !== 'string' && !Buffer.isBuffer(proofData) && 
        !(typeof proofData === 'object' && proofData && (proofData as any).type === 'Buffer')) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'proofData must be a base64 encoded string, Buffer, or serialized Buffer'
      );
    }

    try {
      console.error(`[VerifyData] Starting proof verification from data (${proofSize || 'unknown'} bytes)`);
      
      // Handle Buffer, serialized Buffer, and base64 string data
      let proofBuffer: Buffer;
      if (Buffer.isBuffer(proofData)) {
        console.error(`[VerifyData] Received Buffer data: ${proofData.length} bytes`);
        proofBuffer = proofData;
      } else if (typeof proofData === 'object' && proofData && (proofData as any).type === 'Buffer' && Array.isArray((proofData as any).data)) {
        console.error(`[VerifyData] Received serialized Buffer: ${(proofData as any).data.length} bytes`);
        proofBuffer = Buffer.from((proofData as any).data);
        console.error(`[VerifyData] Reconstructed Buffer: ${proofBuffer.length} bytes`);
      } else {
        console.error(`[VerifyData] Received base64 data: ${proofData.length} characters`);
        proofBuffer = Buffer.from(proofData, 'base64');
        console.error(`[VerifyData] Decoded proof data: ${proofBuffer.length} bytes`);
      }
      
      console.error(`[VerifyData] Final buffer size: ${proofBuffer.length} bytes`);
      console.error(`[VerifyData] Expected size: ${proofSize} bytes`);
      
      // Verify the decoded size matches expected size
      if (proofSize && proofBuffer.length !== proofSize) {
        console.error(`[VerifyData] WARNING: Size mismatch! Expected ${proofSize}, got ${proofBuffer.length}`);
      }
      
      // Create a temporary file for verification
      const tempDir = path.join(this.projectPath, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempProofFile = path.join(tempDir, `temp_proof_${Date.now()}.bin`);
      fs.writeFileSync(tempProofFile, proofBuffer);
      
      // Verify the file was written correctly
      const writtenSize = fs.statSync(tempProofFile).size;
      console.error(`[VerifyData] Created temporary proof file: ${tempProofFile}`);
      console.error(`[VerifyData] Written file size: ${writtenSize} bytes`);
      
      try {
        // Use the existing verifyProof method with the temporary file
        const result = await this.verifyProof({ proofFilePath: tempProofFile });
        
        // Clean up temporary file
        fs.unlinkSync(tempProofFile);
        console.error(`[VerifyData] Cleaned up temporary file`);
        
        // Add note about data-based verification
        const resultData = JSON.parse(result.content[0].text as string);
        resultData.verificationMethod = 'data-based';
        resultData.originalProofSize = proofSize;
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(resultData, null, 2),
            },
          ],
        };
        
      } catch (verifyError) {
        // Clean up temporary file even if verification fails
        if (fs.existsSync(tempProofFile)) {
          fs.unlinkSync(tempProofFile);
        }
        throw verifyError;
      }

    } catch (error) {
      console.error(`[VerifyData] Verification failed:`, error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to verify proof data: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}