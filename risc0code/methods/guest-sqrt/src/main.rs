#![no_main]
#![no_std]

use risc0_zkvm::guest::env;

risc0_zkvm::guest::entry!(main);

// Fixed-point arithmetic scale factor (4 decimal places)
const SCALE: i64 = 10000;

fn main() {
    // Read the fixed-point input number from the host
    let n_fixed: i64 = env::read();
    
    // Compute fixed-point square root using binary search
    let sqrt_result = fixed_point_sqrt(n_fixed);
    
    // Commit both the input and result to prove the computation
    env::commit(&n_fixed);
    env::commit(&sqrt_result);
}

// Fixed-point square root using binary search
// Input and output are both scaled by SCALE (10000)
fn fixed_point_sqrt(n_fixed: i64) -> i64 {
    if n_fixed <= 0 {
        return 0;
    }
    
    // For very small numbers, return early
    if n_fixed < SCALE {
        // sqrt(x) where x < 1, we need to be more precise
        // Use Newton's method for small values
        return newton_sqrt(n_fixed);
    }
    
    // Binary search for the square root
    // We search in the range [0, n_fixed] for the largest x such that x² ≤ n_fixed
    let mut left = 0i64;
    let mut right = n_fixed;
    let mut result = 0i64;
    
    while left <= right {
        let mid = left + (right - left) / 2;
        
        // Calculate mid² in fixed-point arithmetic
        // When multiplying two fixed-point numbers, we need to divide by SCALE
        let mid_squared = (mid * mid) / SCALE;
        
        if mid_squared == n_fixed {
            return mid;
        } else if mid_squared < n_fixed {
            result = mid;
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }
    
    result
}

// Newton's method for computing square root of small fixed-point numbers
// More accurate for values less than 1.0
fn newton_sqrt(n_fixed: i64) -> i64 {
    if n_fixed <= 0 {
        return 0;
    }
    
    // Initial guess: start with n/2, but ensure it's at least 1 in fixed-point
    let mut x = if n_fixed > SCALE { n_fixed / 2 } else { SCALE };
    
    // Newton's method: x_{n+1} = (x_n + n/x_n) / 2
    // In fixed-point arithmetic: x_{n+1} = (x_n + (n * SCALE) / x_n) / 2
    for _ in 0..10 { // 10 iterations should be sufficient for convergence
        let x_new = (x + (n_fixed * SCALE) / x) / 2;
        
        // Check for convergence (difference less than 1 in fixed-point)
        if (x - x_new).abs() < 1 {
            break;
        }
        x = x_new;
    }
    
    x
}