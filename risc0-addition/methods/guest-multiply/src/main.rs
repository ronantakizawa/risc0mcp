#![no_main]
#![no_std]

use risc0_zkvm::guest::env;

risc0_zkvm::guest::entry!(main);

fn main() {
    // Read two i32 numbers from the host
    let a: i32 = env::read();
    let b: i32 = env::read();
    
    // Perform multiplication
    let result = a * b;
    
    // Commit the result to the journal (public output)
    env::commit(&result);
}