#![no_main]
#![no_std]

use risc0_zkvm::guest::env;

risc0_zkvm::guest::entry!(main);

// Fixed-point arithmetic scale factor (5 decimal places for better precision)
const SCALE: i64 = 100000;

fn main() {
    // Read two fixed-point numbers (scaled integers) from the host
    let a: i64 = env::read();
    let b: i64 = env::read();
    
    // Perform addition (fixed-point addition is just regular addition)
    let result = a + b;
    
    // Commit the original inputs and result to the journal for verification
    env::commit(&a);
    env::commit(&b);
    env::commit(&result);
}
