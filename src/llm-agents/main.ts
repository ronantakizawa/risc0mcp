#!/usr/bin/env node

import { CommunicationHub } from './communication-hub.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OPENAI_API_KEY = '';

async function main() {
  console.log('🤖 LLM Zero-Knowledge Proof Communication Demo');
  console.log('='.repeat(50));

  const hub = new CommunicationHub(OPENAI_API_KEY);

  try {
    // Initialize the communication hub
    await hub.initialize();

    // Get command line arguments
    const args = process.argv.slice(2);
    const mode = args[0] || 'conversation';

    switch (mode) {
      case 'conversation':
        console.log('\n🎭 Running full conversation demo...');
        await hub.runZkProofConversation();
        break;

      case 'proof-flow':
        console.log('\n🔬 Running proof verification flow demo...');
        await hub.demonstrateProofVerificationFlow();
        break;

      case 'custom':
        const prompt = args.slice(1).join(' ') || 'Can you prove that 1 + 1 = 2?';
        console.log(`\n💬 Running custom conversation: "${prompt}"`);
        await hub.runCustomConversation(prompt);
        break;

      default:
        console.log(`\n❓ Unknown mode: ${mode}`);
        console.log('Available modes:');
        console.log('  conversation  - Full LLM conversation with ZK proof exchange');
        console.log('  proof-flow    - Direct proof generation and verification');
        console.log('  custom "msg"  - Custom conversation starter');
        process.exit(1);
    }

    console.log('\n✅ Demo completed successfully!');
    
    // Show message history summary
    const history = hub.getMessageHistory();
    console.log(`\n📊 Conversation Summary:`);
    console.log(`   Total messages: ${history.length}`);
    console.log(`   Claims made: ${history.filter(m => m.type === 'claim').length}`);
    console.log(`   Proofs generated: ${history.filter(m => m.type === 'proof').length}`);
    console.log(`   Verifications performed: ${history.filter(m => m.type === 'verification').length}`);

  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  } finally {
    // Clean up resources
    await hub.cleanup();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the main function
main().catch((error) => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});