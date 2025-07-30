#![no_main]
#![no_std]

use risc0_zkvm::guest::env;

risc0_zkvm::guest::entry!(main);

// Fixed-point arithmetic scale factor (4 decimal places)
const SCALE: i64 = 10000;

fn main() {
    // Read two fixed-point numbers (scaled integers) from the host
    let a: i64 = env::read();
    let b: i64 = env::read();
    
    // Perform fixed-point multiplication
    // When multiplying two scaled numbers, we need to divide by the scale to maintain precision
    let result = (a * b) / SCALE;
    
    // Commit the original inputs and result to the journal for verification
    env::commit(&a);
    env::commit(&b);
    env::commit(&result);
}