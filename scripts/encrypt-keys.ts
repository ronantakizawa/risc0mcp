#!/usr/bin/env node

import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { KeyManager } from '../src/crypto/key-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const keysDir = path.join(projectRoot, 'keys');
  
  console.log('🔐 RISC0 Key Encryption Utility');
  console.log('================================');
  
  // Check if keys directory exists
  if (!fs.existsSync(keysDir)) {
    console.error('❌ Keys directory not found:', keysDir);
    process.exit(1);
  }
  
  // Get password from environment
  let password: string;
  try {
    password = KeyManager.getPassword();
    console.log('✅ Password loaded from environment variable');
  } catch (error) {
    console.error('❌ Password required:', (error as Error).message);
    console.log('\n💡 Usage:');
    console.log('   export RISC0_KEY_PASSWORD="your-secure-password"');
    console.log('   npm run encrypt-keys');
    process.exit(1);
  }
  
  // Find all .key files
  const keyFiles: string[] = [];
  
  function findKeyFiles(dir: string) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        findKeyFiles(fullPath);
      } else if ((item.endsWith('.key') || item.endsWith('.pub')) && !item.endsWith('.encrypted')) {
        keyFiles.push(fullPath);
      }
    }
  }
  
  findKeyFiles(keysDir);
  
  if (keyFiles.length === 0) {
    console.log('ℹ️  No plaintext key files found to encrypt');
    
    // Check for existing encrypted keys
    const encryptedFiles: string[] = [];
    function findEncryptedFiles(dir: string) {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          findEncryptedFiles(fullPath);
        } else if (item.endsWith('.encrypted')) {
          encryptedFiles.push(fullPath);
        }
      }
    }
    
    findEncryptedFiles(keysDir);
    
    if (encryptedFiles.length > 0) {
      console.log('✅ Found encrypted key files:');
      for (const file of encryptedFiles) {
        console.log(`   - ${path.relative(projectRoot, file)}`);
      }
    }
    
    return;
  }
  
  console.log(`🔍 Found ${keyFiles.length} key file(s) to encrypt:`);
  for (const keyFile of keyFiles) {
    console.log(`   - ${path.relative(projectRoot, keyFile)}`);
  }
  
  console.log('');
  
  // Encrypt each key file
  for (const keyFile of keyFiles) {
    try {
      console.log(`🔒 Encrypting: ${path.relative(projectRoot, keyFile)}`);
      KeyManager.encryptExistingKey(keyFile, password);
    } catch (error) {
      console.error(`❌ Failed to encrypt ${keyFile}:`, (error as Error).message);
      process.exit(1);
    }
  }
  
  console.log('');
  console.log('✅ All keys encrypted successfully!');
  console.log('');
  console.log('🔥 IMPORTANT: Plaintext keys have been securely deleted');
  console.log('💾 Encrypted keys are stored with .key.encrypted extension');
  console.log('🔑 Keep your password safe - you cannot recover keys without it');
}

// Run if this is the main module
main().catch(console.error);