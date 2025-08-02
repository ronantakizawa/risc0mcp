use risc0_zkvm::guest::env;

fn main() {
    // Read input JSON from the host
    let inputs_json: String = env::read();
    
    // Parse the inputs - try different JSON formats
    let result = if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&inputs_json) {
        if let Some(n) = parsed.get("n") {
            // Handle {"n": 10} format
            if let Some(num) = n.as_i64() {
                fibonacci(num)
            } else {
                -2 // n field not a number
            }
        } else if let Some(arr) = parsed.as_array() {
            // Handle [10] format
            if let Some(first) = arr.first() {
                if let Some(num) = first.as_i64() {
                    fibonacci(num)
                } else {
                    -3 // array element not a number
                }
            } else {
                -4 // empty array
            }
        } else if let Some(num) = parsed.as_i64() {
            // Handle direct number 10
            fibonacci(num)
        } else {
            -5 // unknown format
        }
    } else {
        -6 // JSON parse error
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