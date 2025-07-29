#![no_main]
#![no_std]

use risc0_zkvm::guest::env;

risc0_zkvm::guest::entry!(main);

fn main() {
    // Read two u32 numbers from the host
    let a: u32 = env::read();
    let b: u32 = env::read();
    
    // Perform addition
    let result = a + b;
    
    // Commit the result to the journal (public output)
    env::commit(&result);
}
