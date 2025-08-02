// Array sum computation example for RISC Zero zkVM
// This computes the sum of an array of numbers with zero-knowledge proof
use risc0_zkvm::guest::env;

fn main() {
    // Read input from the host - expects array of numbers [1, 2, 3, 4, 5]
    let inputs_json: String = env::read();
    
    let result = if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&inputs_json) {
        if let Some(arr) = parsed.as_array() {
            let mut sum = 0i64;
            let mut valid = true;
            
            for item in arr {
                if let Some(num) = item.as_i64() {
                    sum += num;
                } else {
                    valid = false;
                    break;
                }
            }
            
            if valid {
                sum
            } else {
                -1 // Invalid array element
            }
        } else {
            -2 // Not an array
        }
    } else {
        -3 // JSON parse error
    };
    
    // Commit the result to the proof
    env::commit(&result);
}