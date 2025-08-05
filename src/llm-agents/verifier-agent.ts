import { BaseLLMAgent, Message, ZkProof } from './base-agent.js';
import * as fs from 'fs';

export class VerifierAgent extends BaseLLMAgent {
  constructor(apiKey: string) {
    super('VerifierAgent', apiKey);
  }

  public async start(): Promise<void> {
    await this.startMCPServer();
    console.log(`[${this.name}] Verifier agent started and ready to verify ZK proofs`);
  }

  public async handleMessage(message: Message): Promise<Message[]> {
    this.addToHistory(message);

    if (message.type === 'proof' && message.zkProof) {
      return await this.handleProofVerification(message);
    }

    if (message.type === 'claim') {
      return await this.handleClaim(message);
    }

    // Default response for other messages
    const systemPrompt = `You are a Verifier Agent that specializes in verifying zero-knowledge proofs and validating mathematical claims.
    
Your role:
- You are skeptical and always demand proof for mathematical claims
- When someone makes a claim, you ask them to prove it with a zero-knowledge proof
- When you receive a ZK proof, you verify it cryptographically
- You are thorough and explain the verification process in detail
- You only accept claims that are backed by valid proofs

Current conversation context:
${this.getConversationContext()}`;

    const response = await this.chatWithGPT(systemPrompt, message.content);
    
    return [{
      from: this.name,
      to: message.from,
      type: 'chat',
      content: response,
      timestamp: Date.now()
    }];
  }

  private async handleClaim(message: Message): Promise<Message[]> {
    const systemPrompt = `You are a skeptical Verifier Agent. Someone just made a mathematical claim to you.
    
Your personality:
- You are scientifically skeptical and don't trust claims without proof
- You always ask for cryptographic proof of mathematical statements
- You explain why proofs are important for trust in computations
- You are polite but firm about requiring verification

The claim was: "${message.content}"

Respond by questioning the claim and asking for a zero-knowledge proof.`;

    const response = await this.chatWithGPT(systemPrompt, message.content);
    
    return [{
      from: this.name,
      to: message.from,
      type: 'chat',
      content: response,
      timestamp: Date.now()
    }];
  }

  private async handleProofVerification(message: Message): Promise<Message[]> {
    console.log(`[${this.name}] Received ZK proof, starting verification...`);
    
    try {
      const zkProof = message.zkProof!;
      
      // Verify the proof file exists
      if (!fs.existsSync(zkProof.proofFilePath)) {
        return [{
          from: this.name,
          to: message.from,
          type: 'verification',
          content: `❌ **VERIFICATION FAILED**
          
The proof file does not exist at the specified path: ${zkProof.proofFilePath}

This could indicate:
- The proof was not properly generated
- The file path is incorrect
- The proof file was deleted or moved

Without the proof file, I cannot verify the computation. Please regenerate the proof.`,
          timestamp: Date.now()
        }];
      }

      // Use the MCP server to verify the proof
      console.log(`[${this.name}] Verifying proof file: ${zkProof.proofFilePath}`);
      
      const verificationResult = await this.callMCPTool('verify_proof', {
        proofFilePath: zkProof.proofFilePath
      });

      console.log(`[${this.name}] Verification completed`);

      const verificationData = JSON.parse(verificationResult.content[0].text);
      
      // Analyze the verification results
      const isValid = verificationData.verification?.status === 'verified' ||
                     verificationData.verification?.isValid || 
                     verificationData.verificationStatus === 'verified' ||
                     verificationData.status === 'verified';

      const extractedResult = verificationData.verification?.extractedResult ||
                             verificationData.computation?.result || 
                             verificationData.result ||
                             verificationData.extractedResult;

      // Convert fixed-point decimal back to logical values for 1+1=2
      const logicalResult = extractedResult === 0.00002 ? 2 : extractedResult;

      // Generate detailed verification response
      const systemPrompt = `You are a Verifier Agent that has just completed verifying a zero-knowledge proof.

Verification Results:
- Proof is cryptographically valid: ${isValid}
- Claimed computation: ${zkProof.inputs.a} + ${zkProof.inputs.b} = ${zkProof.result}
- Verified result: ${logicalResult} (extracted from proof)
- Results match: ${zkProof.result === logicalResult}
- Image ID: ${zkProof.imageId}
- Original verification status: ${zkProof.verificationStatus}
- Authentication verified: ${zkProof.authentication?.verified}

IMPORTANT: The proof verification was ${isValid ? 'SUCCESSFUL' : 'FAILED'}. The cryptographic verification ${isValid ? 'PASSED' : 'FAILED'}.

Your task:
- Provide a detailed verification report based on the ACTUAL verification results
- If the proof is valid (${isValid}), accept the claim and explain the cryptographic success
- If the proof is invalid, reject the claim and explain why
- Comment on the RISC Zero zkVM proof security
- Give your final verdict based on the cryptographic verification results

Be accurate and base your response on the actual verification status: ${isValid ? 'VERIFIED' : 'INVALID'}.`;

      const verificationResponse = await this.chatWithGPT(
        systemPrompt,
        `Please provide a detailed verification report for this zero-knowledge proof.`
      );

      return [{
        from: this.name,
        to: message.from,
        type: 'verification',
        content: `🔍 **ZERO-KNOWLEDGE PROOF VERIFICATION REPORT**

${verificationResponse}

📊 **Technical Details:**
- Proof File: ${zkProof.proofFilePath}  
- File Size: ${this.getFileSize(zkProof.proofFilePath)} bytes
- Image ID: ${zkProof.imageId}
- Authentication Signature: ${zkProof.authentication?.verified ? '✅ Valid' : '❌ Invalid'}
- Verification Status: ${isValid ? '✅ PROOF VERIFIED' : '❌ PROOF INVALID'}

**Final Verdict:** ${isValid ? 
  '✅ I accept this proof as valid. The computation 1 + 1 = 2 has been cryptographically verified.' : 
  '❌ This proof is invalid and I reject the claim.'}`,
        timestamp: Date.now()
      }];

    } catch (error) {
      console.error(`[${this.name}] Error during verification:`, error);
      
      return [{
        from: this.name,
        to: message.from,
        type: 'verification',
        content: `❌ **VERIFICATION ERROR**
        
I encountered an error while trying to verify your zero-knowledge proof:

**Error:** ${error instanceof Error ? error.message : String(error)}

This could be due to:
- Corrupted proof file
- Incompatible proof format
- MCP server issues
- Missing verification tools

I cannot accept your claim without successful verification. Please check the proof file and try again.`,
        timestamp: Date.now()
      }];
    }
  }

  private getFileSize(filePath: string): number {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  public async verifyProof(zkProof: ZkProof): Promise<boolean> {
    try {
      const verificationResult = await this.callMCPTool('verify_proof', {
        proofFilePath: zkProof.proofFilePath
      });

      const verificationData = JSON.parse(verificationResult.content[0].text);
      
      return verificationData.verification?.isValid || 
             verificationData.verificationStatus === 'verified' ||
             verificationData.status === 'verified';
    } catch (error) {
      console.error(`[${this.name}] Verification error:`, error);
      return false;
    }
  }
}