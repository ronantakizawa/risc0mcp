// Hash verification example for RISC Zero zkVM
// This verifies that a secret input produces a known hash without revealing the input
use risc0_zkvm::guest::env;

fn main() {
    // Read input from the host - expects {"secret": "hello", "expected_hash": 5994471}
    let inputs_json: String = env::read();
    
    let result = if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&inputs_json) {
        if let (Some(secret), Some(expected)) = (
            parsed.get("secret").and_then(|s| s.as_str()),
            parsed.get("expected_hash").and_then(|h| h.as_i64())
        ) {
            let computed_hash = simple_hash(secret);
            if computed_hash == expected {
                1 // Hash matches - secret is valid
            } else {
                0 // Hash doesn't match - secret is invalid
            }
        } else {
            -1 // Missing required fields
        }
    } else {
        -2 // JSON parse error
    };
    
    // Commit the result to the proof (1 = valid, 0 = invalid, negative = error)
    // Note: The secret input is NOT revealed in the proof!
    env::commit(&result);
}

// Simple hash function for demonstration (not cryptographically secure)
fn simple_hash(input: &str) -> i64 {
    let mut hash = 5381i64;
    for byte in input.bytes() {
        hash = hash.wrapping_mul(33).wrapping_add(byte as i64);
    }
    hash.abs() % 1000000 // Keep result manageable
}