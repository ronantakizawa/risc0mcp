// Merkle tree membership proof example for RISC Zero zkVM
// This proves that a value is included in a Merkle tree without revealing the tree structure
use risc0_zkvm::guest::env;

fn main() {
    // Read input from the host - expects:
    // {
    //   "leaf_value": 42,
    //   "merkle_path": [hash1, hash2, hash3],
    //   "directions": [0, 1, 0],  // 0 = left, 1 = right
    //   "expected_root": 123456789
    // }
    let inputs_json: String = env::read();
    
    let result = if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&inputs_json) {
        if let (
            Some(leaf_value),
            Some(merkle_path),
            Some(directions),
            Some(expected_root)
        ) = (
            parsed.get("leaf_value").and_then(|v| v.as_i64()),
            parsed.get("merkle_path").and_then(|v| v.as_array()),
            parsed.get("directions").and_then(|v| v.as_array()),
            parsed.get("expected_root").and_then(|v| v.as_i64())
        ) {
            // Convert arrays to Vec<i64>
            let path_hashes: Result<Vec<i64>, _> = merkle_path
                .iter()
                .map(|v| v.as_i64().ok_or("Invalid hash"))
                .collect();
            
            let path_directions: Result<Vec<i64>, _> = directions
                .iter()
                .map(|v| v.as_i64().ok_or("Invalid direction"))
                .collect();
            
            match (path_hashes, path_directions) {
                (Ok(hashes), Ok(dirs)) => {
                    if verify_merkle_proof(leaf_value, &hashes, &dirs, expected_root) {
                        1 // Proof valid - leaf is in tree
                    } else {
                        0 // Proof invalid - leaf not in tree
                    }
                },
                _ => -1 // Invalid hash/direction arrays
            }
        } else {
            -2 // Missing required fields
        }
    } else {
        -3 // JSON parse error
    };
    
    // Commit the result to the proof (1 = valid membership, 0 = invalid, negative = error)
    // Note: The leaf value and tree structure remain private!
    env::commit(&result);
}

// Verify a Merkle proof by reconstructing the path to the root
fn verify_merkle_proof(leaf_value: i64, path_hashes: &[i64], directions: &[i64], expected_root: i64) -> bool {
    if path_hashes.len() != directions.len() {
        return false; // Path and directions must have same length
    }
    
    // Start with the leaf hash
    let mut current_hash = simple_hash_i64(leaf_value);
    
    // Walk up the tree using the provided path
    for (i, &sibling_hash) in path_hashes.iter().enumerate() {
        let direction = directions[i];
        
        // Combine current hash with sibling hash
        current_hash = if direction == 0 {
            // Current hash is left child
            simple_hash_pair(current_hash, sibling_hash)
        } else {
            // Current hash is right child  
            simple_hash_pair(sibling_hash, current_hash)
        };
    }
    
    // Check if we reached the expected root
    current_hash == expected_root
}

// Simple hash function for i64 values
fn simple_hash_i64(value: i64) -> i64 {
    // Simple hash: multiply by prime and add offset
    (value.wrapping_mul(31).wrapping_add(17)).abs() % 1_000_000_000
}

// Hash two values together (order matters for Merkle trees)
fn simple_hash_pair(left: i64, right: i64) -> i64 {
    // Combine two hashes: hash(left || right)
    let combined = left.wrapping_mul(1009).wrapping_add(right.wrapping_mul(1013));
    combined.abs() % 1_000_000_000
}