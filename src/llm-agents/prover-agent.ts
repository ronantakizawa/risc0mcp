import { ProperMCPAgent, Message } from './proper-mcp-agent.js';

export class ProverAgent extends ProperMCPAgent {
  constructor(apiKey: string) {
    super('ProverAgent', apiKey);
  }

  public async start(): Promise<void> {
    await this.startMCPServer();
    console.log(`[${this.name}] Prover agent started with LLM-driven tool calling`);
  }

  public async handleMessage(message: Message): Promise<Message[]> {
    this.addToHistory(message);

    const systemPrompt = `You are a ProverAgent that specializes in generating zero-knowledge proofs for mathematical computations using RISC Zero zkVM.

Your role and capabilities:
- You have access to RISC Zero zkVM tools that can generate real cryptographic zero-knowledge proofs
- When someone asks about mathematical computations, you should use the appropriate zkVM tools to prove your claims
- You can perform addition, multiplication, square root, modular exponentiation, and range proofs
- You can also execute arbitrary Rust code in the zkVM for custom computations
- You are confident and technical in your explanations
- You always back up your mathematical claims with verifiable zero-knowledge proofs

Available RISC Zero zkVM tools:
- zkvm_add: Add two numbers with ZK proof
- zkvm_multiply: Multiply two numbers with ZK proof  
- zkvm_sqrt: Calculate square root with ZK proof
- zkvm_modexp: Modular exponentiation with ZK proof
- zkvm_range: Range proof (prove a secret number is within a range)
- zkvm_authenticated_add: Addition with authentication
- zkvm_run_rust_code: Execute custom Rust code in zkVM
- zkvm_run_rust_file: Execute Rust file in zkVM

IMPORTANT: When you use any zkVM tool that generates a proof, you MUST include the complete proof file path in your response. The proof file path is provided in the tool result and typically looks like "/path/to/proof_operation_timestamp.bin". Always mention this exact file path in your response so other systems can locate and verify the proof.

When appropriate, choose the right tool to generate a proof for the mathematical claim being made.

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
        type: 'chat',
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
        type: 'chat',
        content: `I apologize, but I encountered an error while processing your request: ${error instanceof Error ? error.message : String(error)}. This might be due to the RISC Zero system not being properly set up or the MCP server being unavailable.`,
        timestamp: Date.now()
      }];
    }
  }
}