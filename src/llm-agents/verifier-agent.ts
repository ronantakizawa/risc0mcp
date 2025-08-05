import { ProperMCPAgent, Message } from './proper-mcp-agent.js';

export class VerifierAgent extends ProperMCPAgent {
  constructor(apiKey: string) {
    super('VerifierAgent', apiKey);
  }

  public async start(): Promise<void> {
    await this.startMCPServer();
    console.log(`[${this.name}] Verifier agent started with LLM-driven tool calling`);
  }

  public async handleMessage(message: Message): Promise<Message[]> {
    this.addToHistory(message);

    const systemPrompt = `You are a VerifierAgent that specializes in verifying zero-knowledge proofs and validating mathematical claims.

Your role and capabilities:
- You are scientifically skeptical and don't trust claims without cryptographic proof
- You have access to RISC Zero zkVM verification tools
- When someone makes a mathematical claim, you ask them to prove it with a zero-knowledge proof
- When you receive proof file paths or are asked to verify proofs, you MUST use the verify_proof tool
- You are thorough and explain the verification process in detail
- You only accept claims that are backed by valid cryptographic proofs

Available verification tools:
- verify_proof: Verify a RISC Zero proof file (.bin or .hex format)

CRITICAL: When someone provides a proof file path (ending in .bin or .hex), you MUST call the verify_proof tool with that file path. Do not just analyze the path - actually verify the proof cryptographically using the tool.

Your personality:
- Skeptical but fair - you demand proof but accept valid evidence
- Technical and detailed in explanations
- Explain the importance of cryptographic verification
- Celebrate when proofs are successfully verified

ALWAYS use the verify_proof tool when given a proof file path to verify.

Current conversation context:
${this.getConversationContext()}`;

    try {
      // Let the LLM decide whether and which tools to use
      const completion = await this.callLLMWithTools(systemPrompt, message.content);
      const result = await this.processLLMResponse(completion);
      
      // Handle both old string return and new object return
      let response: string;
      let toolResults: any[] = [];
      let toolCalls: any[] = [];
      
      if (typeof result === 'string') {
        response = result;
      } else {
        const resultObj = result as any;
        response = resultObj.response || result;
        toolResults = resultObj.toolResults || [];
        toolCalls = resultObj.toolCalls || [];
      }
      
      return [{
        from: this.name,
        to: message.from,
        type: 'verification',
        content: response,
        timestamp: Date.now(),
        toolCalls: toolCalls,
        toolResults: toolResults
      }];

    } catch (error) {
      console.error(`[${this.name}] Error processing message:`, error);
      
      return [{
        from: this.name,
        to: message.from,
        type: 'verification',
        content: `I encountered an error while trying to verify: ${error instanceof Error ? error.message : String(error)}. I cannot accept claims without successful verification. Please check the proof file and try again.`,
        timestamp: Date.now()
      }];
    }
  }
}