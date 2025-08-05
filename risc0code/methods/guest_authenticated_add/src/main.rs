#![no_main]
#![no_std]

extern crate alloc;
use alloc::string::String;
use risc0_zkvm::guest::env;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct ComputationResult {
    // Computation details
    a: i64,
    b: i64,
    result: i64,
    
    // Metadata
    timestamp: u64,
    task_id: String,
}

risc0_zkvm::guest::entry!(main);

fn main() {
    // Read computation inputs
    let a: i64 = env::read();
    let b: i64 = env::read();
    
    // Read metadata
    let timestamp: u64 = env::read();
    let task_id: String = env::read();
    
    // Perform computation
    let result = a + b;
    
    // Create computation result
    let computation_result = ComputationResult {
        a,
        b,
        result,
        timestamp,
        task_id,
    };
    
    // Commit the computation result to the proof
    env::commit(&computation_result);
}

