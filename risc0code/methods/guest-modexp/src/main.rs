#![no_main]
#![no_std]

use risc0_zkvm::guest::env;

risc0_zkvm::guest::entry!(main);

fn main() {
    // Read the three input values: base (a), exponent (b), modulus (n)
    let base: u64 = env::read();
    let exponent: u64 = env::read();
    let modulus: u64 = env::read();
    
    // Compute modular exponentiation: a^b mod n
    let result = modular_exponentiation(base, exponent, modulus);
    
    // Commit all inputs and the result to prove the computation
    env::commit(&base);
    env::commit(&exponent);
    env::commit(&modulus);
    env::commit(&result);
}

// Efficient modular exponentiation using binary exponentiation (square-and-multiply)
// This prevents overflow by keeping intermediate results within the modulus
fn modular_exponentiation(mut base: u64, mut exponent: u64, modulus: u64) -> u64 {
    if modulus == 0 {
        return 0; // Invalid modulus
    }
    
    if modulus == 1 {
        return 0; // Any number mod 1 is 0
    }
    
    if exponent == 0 {
        return 1; // Any number to the power of 0 is 1
    }
    
    // Reduce base modulo n to handle large bases
    base = base % modulus;
    
    if base == 0 {
        return 0; // 0 to any positive power is 0
    }
    
    let mut result = 1u64;
    
    // Binary exponentiation algorithm
    while exponent > 0 {
        // If exponent is odd, multiply base with result
        if exponent & 1 == 1 {
            result = modular_multiply(result, base, modulus);
        }
        
        // Square the base and halve the exponent
        base = modular_multiply(base, base, modulus);
        exponent >>= 1;
    }
    
    result
}

// Safe modular multiplication to prevent overflow
// Computes (a * b) mod m without intermediate overflow
fn modular_multiply(a: u64, b: u64, modulus: u64) -> u64 {
    // Use u128 to prevent overflow during multiplication
    let result = (a as u128 * b as u128) % (modulus as u128);
    result as u64
}