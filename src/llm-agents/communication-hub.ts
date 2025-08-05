import { ProverAgent } from './prover-agent.js';
import { VerifierAgent } from './verifier-agent.js';
import { Message } from './proper-mcp-agent.js';

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
      // Stage 1: Initial conversation
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

      // Stage 2: Process prover's responses
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

      console.log('\n=== CONVERSATION COMPLETE ===');

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
    }
  }

  private logMessage(message: Message): void {
    this.messageHistory.push(message);
    
    // Format the message for display
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    const typeEmoji = this.getTypeEmoji(message.type);
    
    console.log(`\n[${timestamp}] ${typeEmoji} ${message.from} → ${message.to}:`);
    console.log(`${message.content}`);
    
    if (message.toolResults && message.toolResults.length > 0) {
      console.log(`🔧 Tools used: ${message.toolResults.length}`);
      message.toolResults.forEach((result, i) => {
        console.log(`   ${i+1}. ${result.toolName}`);
      });
    }
  }

  private getTypeEmoji(type: string): string {
    switch (type) {
      case 'claim': return '💬';
      case 'proof': return '🔐';
      case 'verification': return '✅';
      case 'chat': return '💭';
      default: return '📝';
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getMessageHistory(): Message[] {
    return [...this.messageHistory];
  }

  public async demonstrateProofVerificationFlow(): Promise<void> {
    console.log('\n🔬 DEMONSTRATING COMPLETE ZK PROOF FLOW\n');
    console.log('This is a simplified demonstration using the new LLM-driven approach.');
    console.log('For full functionality, use the prover-client and verifier-server workflow.');

    try {
      // Generate a proof using the LLM-driven approach
      const message: Message = {
        from: 'Demo',
        to: 'ProverAgent',
        type: 'chat',
        content: 'Can you prove that 1 + 1 = 2?',
        timestamp: Date.now()
      };

      console.log('Step 1: Asking ProverAgent to generate proof...');
      const responses = await this.prover.handleMessage(message);
      
      console.log('✅ ProverAgent completed processing');
      
      for (const response of responses) {
        this.logMessage(response);
      }

    } catch (error) {
      console.error('❌ Demonstration failed:', error);
      throw error;
    }
  }

  public async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up resources...');
    await Promise.all([
      this.prover.cleanup(),
      this.verifier.cleanup()
    ]);
    console.log('✅ Cleanup completed');
  }
}