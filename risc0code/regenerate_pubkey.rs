use ed25519_compact::{PublicKey as CompactPublicKey, SecretKey as CompactSecretKey};
use sha2::{Digest, Sha512};
use std::fs;

fn main() {
    // Read the private key
    let private_key_hex = fs::read_to_string("keys/default.key")
        .expect("Failed to read private key")
        .trim()
        .to_string();
    
    // Convert hex to bytes
    let private_key_bytes: [u8; 32] = hex::decode(&private_key_hex)
        .expect("Invalid hex")
        .try_into()
        .expect("Must be 32 bytes");
    
    println!("Private key: {:?}", private_key_bytes);
    
    // Use the same derivation method as in the guest program
    let mut hasher = Sha512::new();
    hasher.update(&private_key_bytes);
    let hash = hasher.finalize();
    
    let mut secret_key_bytes = [0u8; 64];
    secret_key_bytes.copy_from_slice(&hash[..64]);
    
    let secret_key = CompactSecretKey::new(secret_key_bytes);
    let public_key = secret_key.public_key();
    let public_key_bytes = public_key.as_ref();
    
    println!("Derived public key: {:?}", public_key_bytes);
    println!("Public key hex: {}", hex::encode(public_key_bytes));
    
    // Update the public key file
    fs::write("keys/public/default.pub", hex::encode(public_key_bytes))
        .expect("Failed to write public key");
    
    println!("Public key file updated!");
}