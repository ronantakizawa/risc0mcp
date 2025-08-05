import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface EncryptedKey {
  algorithm: string;
  iv: string;
  salt: string;
  encrypted: string;
  keyDerivation: {
    algorithm: string;
    iterations: number;
    keyLength: number;
  };
}

export class KeyManager {
  private static readonly ALGORITHM = 'aes-256-cbc';
  private static readonly KEY_DERIVATION_ALGORITHM = 'pbkdf2';
  private static readonly ITERATIONS = 100000;
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;
  private static readonly SALT_LENGTH = 32;

  /**
   * Derives an encryption key from a password using PBKDF2
   */
  private static deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(
      password,
      salt,
      KeyManager.ITERATIONS,
      KeyManager.KEY_LENGTH,
      'sha256'
    );
  }

  /**
   * Encrypts a key with a password
   */
  static encryptKey(keyData: string, password: string): EncryptedKey {
    // Generate random salt and IV
    const salt = crypto.randomBytes(KeyManager.SALT_LENGTH);
    const iv = crypto.randomBytes(KeyManager.IV_LENGTH);
    
    // Derive encryption key from password
    const derivedKey = KeyManager.deriveKey(password, salt);
    
    // Create cipher
    const cipher = crypto.createCipheriv(KeyManager.ALGORITHM, derivedKey, iv);
    
    // Encrypt the key
    let encrypted = cipher.update(keyData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      algorithm: KeyManager.ALGORITHM,
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      encrypted: encrypted,
      keyDerivation: {
        algorithm: KeyManager.KEY_DERIVATION_ALGORITHM,
        iterations: KeyManager.ITERATIONS,
        keyLength: KeyManager.KEY_LENGTH
      }
    };
  }

  /**
   * Decrypts a key with a password
   */
  static decryptKey(encryptedKey: EncryptedKey, password: string): string {
    // Parse components
    const salt = Buffer.from(encryptedKey.salt, 'hex');
    const iv = Buffer.from(encryptedKey.iv, 'hex');
    
    // Derive encryption key from password
    const derivedKey = KeyManager.deriveKey(password, salt);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(encryptedKey.algorithm, derivedKey, iv);
    
    // Decrypt the key
    let decrypted = decipher.update(encryptedKey.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Saves an encrypted key to a file
   */
  static saveEncryptedKey(keyPath: string, encryptedKey: EncryptedKey): void {
    const keyDir = path.dirname(keyPath);
    if (!fs.existsSync(keyDir)) {
      fs.mkdirSync(keyDir, { recursive: true });
    }
    
    const encryptedPath = keyPath + '.encrypted';
    fs.writeFileSync(
      encryptedPath,
      JSON.stringify(encryptedKey, null, 2),
      { mode: 0o600 } // Read/write for owner only
    );
  }

  /**
   * Loads an encrypted key from a file
   */
  static loadEncryptedKey(keyPath: string): EncryptedKey {
    const encryptedPath = keyPath + '.encrypted';
    if (!fs.existsSync(encryptedPath)) {
      throw new Error(`Encrypted key file not found: ${encryptedPath}`);
    }
    
    const keyData = fs.readFileSync(encryptedPath, 'utf8');
    return JSON.parse(keyData) as EncryptedKey;
  }

  /**
   * Encrypts an existing plaintext key file
   */
  static encryptExistingKey(keyPath: string, password: string): void {
    if (!fs.existsSync(keyPath)) {
      throw new Error(`Key file not found: ${keyPath}`);
    }
    
    // Read the plaintext key
    const keyData = fs.readFileSync(keyPath, 'utf8').trim();
    
    // Encrypt the key
    const encryptedKey = KeyManager.encryptKey(keyData, password);
    
    // Save encrypted version
    KeyManager.saveEncryptedKey(keyPath, encryptedKey);
    
    // Securely delete the plaintext key
    fs.unlinkSync(keyPath);
    
    console.log(`✅ Key encrypted and saved to: ${keyPath}.encrypted`);
    console.log(`🗑️  Plaintext key deleted: ${keyPath}`);
  }

  /**
   * Decrypts a key file and returns the key data
   */
  static getDecryptedKey(keyPath: string, password: string): string {
    const encryptedKey = KeyManager.loadEncryptedKey(keyPath);
    return KeyManager.decryptKey(encryptedKey, password);
  }

  /**
   * Gets password securely from environment or prompts user
   */
  static getPassword(): string {
    // Try environment variable first
    const envPassword = process.env.RISC0_KEY_PASSWORD;
    if (envPassword) {
      return envPassword;
    }
    
    // For production, you'd want to prompt securely
    // For now, throw an error requiring environment variable
    throw new Error(
      'Key password not found. Set RISC0_KEY_PASSWORD environment variable or implement secure password prompt.'
    );
  }
}