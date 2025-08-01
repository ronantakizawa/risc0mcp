#![no_main]
#![no_std]

use risc0_zkvm::guest::env;

risc0_zkvm::guest::entry!(main);

fn main() {
    // Read the secret number (kept private)
    let secret_number: u64 = env::read();
    
    // Read the range bounds (public parameters)
    let min_value: u64 = env::read();
    let max_value: u64 = env::read();
    
    // Perform the range check
    let in_range = secret_number >= min_value && secret_number <= max_value;
    
    // Also compute some derived values for additional verification
    let above_min = secret_number >= min_value;
    let below_max = secret_number <= max_value;
    
    // Commit the range check result to the journal
    // This proves the secret number is (or isn't) in the specified range
    // without revealing the actual secret number
    env::commit(&in_range);
    env::commit(&above_min);
    env::commit(&below_max);
    
    // Commit the range bounds for verification
    env::commit(&min_value);
    env::commit(&max_value);
}