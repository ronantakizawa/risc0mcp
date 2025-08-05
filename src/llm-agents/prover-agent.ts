import { BaseLLMAgent, Message, ZkProof } from './base-agent.js';

export class ProverAgent extends BaseLLMAgent {
  constructor(apiKey: string) {
    super('ProverAgent', apiKey);
  }

  public async start(): Promise<void> {
    await this.startMCPServer();
    console.log(`[${this.name}] Prover agent started and ready to generate ZK proofs`);
  }

  public async handleMessage(message: Message): Promise<Message[]> {
    this.addToHistory(message);

    if (message.type === 'chat' && (
      message.content.toLowerCase().includes('1+1') || 
      message.content.toLowerCase().includes('1 + 1') ||
      message.content.toLowerCase().includes('what 1 + 1 equals') ||
      message.content.toLowerCase().includes('1 plus 1')
    )) {
      return await this.handleComputationRequest(message);
    }

    // Default response for other messages
    const systemPrompt = `You are a Prover Agent that specializes in generating zero-knowledge proofs for mathematical computations.
    
Your role:
- When someone asks about mathematical computations, you generate ZK proofs to prove your claims
- You use RISC Zero zkVM to create cryptographically secure proofs
- You are confident and technical in your explanations
- You always back up your claims with verifiable proofs

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

  private async handleComputationRequest(message: Message): Promise<Message[]> {
    console.log(`[${this.name}] Handling computation request for 1+1`);

    try {
      // First, respond with the claim
      const claimResponse: Message = {
        from: this.name,
        to: message.from,
        type: 'claim',
        content: `I claim that 1 + 1 = 2. Let me prove this using a zero-knowledge proof with RISC Zero zkVM. This will generate cryptographic evidence that I performed this computation correctly without revealing the internal execution details.`,
        timestamp: Date.now()
      };

      // Generate the ZK proof
      console.log(`[${this.name}] Generating ZK proof for 1+1...`);
      const proofResult = await this.callMCPTool('zkvm_authenticated_add', {
        a: 1,
        b: 1,
        keyId: 'default'
      });

      console.log(`[${this.name}] ZK proof generated successfully`);

      // Parse the proof result
      const proofData = JSON.parse(proofResult.content[0].text);
      
      const zkProof: ZkProof = {
        operation: 'authenticated_add',
        inputs: { a: 1, b: 1 },
        result: proofData.computation.result,
        imageId: proofData.zkProof.imageId,
        verificationStatus: proofData.zkProof.verificationStatus,
        proofFilePath: proofData.zkProof.proofFilePath,
        authentication: proofData.authentication
      };

      // Create proof message with detailed explanation
      const proofMessage: Message = {
        from: this.name,
        to: message.from,
        type: 'proof',
        content: `Here is my zero-knowledge proof that 1 + 1 = 2:

🔍 **Computation Details:**
- Operation: Addition (1 + 1)
- Result: ${zkProof.result}
- Correct: ${proofData.computation.correct}

🔐 **ZK Proof Details:**
- Image ID: ${zkProof.imageId}
- Verification Status: ${zkProof.verificationStatus}
- Proof File: ${zkProof.proofFilePath}

✍️ **Authentication:**
- Digital Signature Verified: ${proofData.authentication.verified}
- Public Key: ${proofData.authentication.publicKey}
- Signature: ${proofData.authentication.signature?.substring(0, 32)}...

This proof demonstrates that:
1. I executed the computation 1 + 1 inside a RISC Zero zkVM
2. The computation was performed correctly and resulted in 2
3. The proof is cryptographically signed and authenticated
4. You can verify this proof independently without trusting me

The proof file contains a STARK proof that you can verify to confirm the computation was performed correctly.`,
        zkProof,
        timestamp: Date.now()
      };

      return [claimResponse, proofMessage];

    } catch (error) {
      console.error(`[${this.name}] Error generating proof:`, error);
      
      return [{
        from: this.name,
        to: message.from,
        type: 'chat',
        content: `I apologize, but I encountered an error while generating the zero-knowledge proof: ${error instanceof Error ? error.message : String(error)}. This might be due to the RISC Zero system not being properly set up or the MCP server being unavailable.`,
        timestamp: Date.now()
      }];
    }
  }

  public async generateProofForComputation(a: number, b: number): Promise<ZkProof> {
    console.log(`[${this.name}] Generating proof for ${a} + ${b}`);
    
    const result = await this.callMCPTool('zkvm_authenticated_add', {
      a,
      b,
      keyId: 'default'
    });

    const proofData = JSON.parse(result.content[0].text);
    
    return {
      operation: 'authenticated_add',
      inputs: { a, b },
      result: proofData.computation.result,
      imageId: proofData.zkProof.imageId,
      verificationStatus: proofData.zkProof.verificationStatus,
      proofFilePath: proofData.zkProof.proofFilePath,
      authentication: proofData.authentication
    };
  }
}