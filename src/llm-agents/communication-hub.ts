import { ProverAgent } from './prover-agent.js';
import { VerifierAgent } from './verifier-agent.js';
import { Message } from './base-agent.js';

export class CommunicationHub {
  private prover: ProverAgent;
  private verifier: VerifierAgent;
  private messageHistory: Message[] = [];

  constructor(openaiApiKey: string) {
    this.prover = new ProverAgent(openaiApiKey);
    this.verifier = new VerifierAgent(openaiApiKey);
  }

  public async initialize(): Promise<void> {
    console.log('🚀 Starting LLM Communication Hub...');
    
    // Start both agents
    await Promise.all([
      this.prover.start(),
      this.verifier.start()
    ]);
    
    console.log('✅ Both agents initialized and ready');
  }

  public async runZkProofConversation(): Promise<void> {
    console.log('\n🎭 Starting ZK Proof Conversation Between LLMs...\n');

    try {
      // Stage 1: Verifier initiates the conversation
      console.log('=== STAGE 1: INITIAL CONVERSATION ===');
      const initialMessage: Message = {
        from: 'VerifierAgent',
        to: 'ProverAgent',
        type: 'chat',
        content: 'Hello! I\'ve heard you can do mathematical computations. Can you tell me what 1 + 1 equals?',
        timestamp: Date.now()
      };

      this.logMessage(initialMessage);
      const proverResponses = await this.prover.handleMessage(initialMessage);

      // Stage 2: Process prover's responses (claim + proof)
      console.log('\n=== STAGE 2: PROOF GENERATION ===');
      for (const proverResponse of proverResponses) {
        this.logMessage(proverResponse);
        
        // Send each prover response to verifier
        const verifierResponses = await this.verifier.handleMessage(proverResponse);
        
        for (const verifierResponse of verifierResponses) {
          this.logMessage(verifierResponse);
        }

        // Add small delay between messages for readability
        await this.sleep(1000);
      }

      // Stage 3: Final exchange
      console.log('\n=== STAGE 3: VERIFICATION COMPLETE ===');
      const finalMessage: Message = {
        from: 'VerifierAgent',
        to: 'ProverAgent',
        type: 'chat',
        content: 'Thank you for providing the zero-knowledge proof. This demonstrates how mathematical claims can be verified cryptographically without revealing the computation details. The RISC Zero zkVM proof provides strong guarantees about the correctness of your calculation.',
        timestamp: Date.now()
      };

      this.logMessage(finalMessage);
      const finalResponses = await this.prover.handleMessage(finalMessage);

      for (const response of finalResponses) {
        this.logMessage(response);
      }

    } catch (error) {
      console.error('❌ Error during conversation:', error);
      throw error;
    }
  }

  public async runCustomConversation(initialPrompt: string): Promise<void> {
    console.log(`\n🎭 Starting Custom Conversation: "${initialPrompt}"\n`);

    const message: Message = {
      from: 'Human',
      to: 'ProverAgent',
      type: 'chat',
      content: initialPrompt,
      timestamp: Date.now()
    };

    this.logMessage(message);
    const responses = await this.prover.handleMessage(message);

    for (const response of responses) {
      this.logMessage(response);
      
      if (response.zkProof) {
        // Send proof to verifier
        const verifierResponses = await this.verifier.handleMessage(response);
        for (const verifierResponse of verifierResponses) {
          this.logMessage(verifierResponse);
        }
      }
    }
  }

  private logMessage(message: Message): void {
    this.messageHistory.push(message);
    
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    const prefix = message.type === 'proof' ? '🔐' : 
                  message.type === 'verification' ? '🔍' : 
                  message.type === 'claim' ? '🗣️' : '💬';
    
    console.log(`\n${prefix} [${timestamp}] ${message.from} → ${message.to}`);
    console.log(`Type: ${message.type.toUpperCase()}`);
    
    if (message.zkProof) {
      console.log(`🔐 ZK Proof Attached:`);
      console.log(`   Operation: ${message.zkProof.operation}`);
      console.log(`   Inputs: ${JSON.stringify(message.zkProof.inputs)}`);
      console.log(`   Result: ${message.zkProof.result}`);
      console.log(`   Verification: ${message.zkProof.verificationStatus}`);
      console.log(`   Proof File: ${message.zkProof.proofFilePath}`);
    }
    
    // Format content with proper line breaks
    const formattedContent = message.content.replace(/\n/g, '\n   ');
    console.log(`Content:\n   ${formattedContent}`);
    console.log('─'.repeat(80));
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getMessageHistory(): Message[] {
    return [...this.messageHistory];
  }

  public async demonstrateProofVerificationFlow(): Promise<void> {
    console.log('\n🔬 DEMONSTRATING COMPLETE ZK PROOF FLOW\n');

    try {
      // Step 1: Generate proof
      console.log('Step 1: Generating ZK proof for 1 + 1...');
      const zkProof = await this.prover.generateProofForComputation(1, 1);
      console.log('✅ Proof generated');

      // Step 2: Verify proof
      console.log('Step 2: Verifying the proof...');
      const isValid = await this.verifier.verifyProof(zkProof);
      console.log(`✅ Proof verification result: ${isValid ? 'VALID' : 'INVALID'}`);

      // Step 3: Show detailed results
      console.log('\n📊 DETAILED RESULTS:');
      console.log(`Operation: ${zkProof.operation}`);
      console.log(`Inputs: ${JSON.stringify(zkProof.inputs)}`);
      console.log(`Result: ${zkProof.result}`);
      console.log(`Image ID: ${zkProof.imageId}`);
      console.log(`Verification Status: ${zkProof.verificationStatus}`);
      console.log(`Proof File: ${zkProof.proofFilePath}`);
      console.log(`Authentication Verified: ${zkProof.authentication?.verified}`);

    } catch (error) {
      console.error('❌ Demonstration failed:', error);
      throw error;
    }
  }

  public async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up agents...');
    await Promise.all([
      this.prover.cleanup(),
      this.verifier.cleanup()
    ]);
    console.log('✅ Cleanup complete');
  }
}