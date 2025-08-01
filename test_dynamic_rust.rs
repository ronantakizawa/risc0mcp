use risc0_zkvm::guest::env;

fn main() {
    // Read input JSON from the host
    let inputs_json: String = env::read();
    
    // Parse the inputs - expecting a JSON array with a single number
    let result = if let Ok(input_str) = serde_json::from_str::<String>(&inputs_json) {
        // If it's a string containing a number, parse it
        if let Ok(num) = input_str.parse::<i64>() {
            fibonacci(num)
        } else {
            -1 // Error case
        }
    } else if let Ok(inputs) = serde_json::from_str::<Vec<i64>>(&inputs_json) {
        // If it's an array of numbers, use the first one
        if let Some(&first) = inputs.first() {
            fibonacci(first)
        } else {
            -1 // Error case
        }
    } else {
        -1 // Error case
    };
    
    // Commit the computed result
    env::commit(&result);
}

// Compute Fibonacci number (recursive implementation for demonstration)
fn fibonacci(n: i64) -> i64 {
    if n <= 0 {
        0
    } else if n == 1 {
        1
    } else {
        // Use iterative approach to avoid deep recursion in zkVM
        let mut a = 0i64;
        let mut b = 1i64;
        for _ in 2..=n {
            let temp = a + b;
            a = b;
            b = temp;
        }
        b
    }
}