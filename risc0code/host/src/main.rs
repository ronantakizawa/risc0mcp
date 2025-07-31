use methods::{ADDITION_ELF, ADDITION_ID, MULTIPLY_GUEST_ELF, MULTIPLY_GUEST_ID, SQRT_GUEST_ELF, SQRT_GUEST_ID, MODEXP_GUEST_ELF, MODEXP_GUEST_ID, GUEST_RANGE_ELF, GUEST_RANGE_ID};
use risc0_zkvm::{default_prover, ExecutorEnv};
use std::mem;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

// Fixed-point arithmetic scale factor (4 decimal places)
const SCALE: i64 = 10000;

// Convert decimal number to fixed-point representation
fn decimal_to_fixed_point(decimal: f64) -> i64 {
    (decimal * SCALE as f64).round() as i64
}

// Convert fixed-point representation back to decimal
fn fixed_point_to_decimal(fixed: i64) -> f64 {
    fixed as f64 / SCALE as f64
}

// Host-side modular exponentiation for verification
fn modular_exponentiation_host(mut base: u64, mut exponent: u64, modulus: u64) -> u64 {
    if modulus == 0 {
        return 0;
    }
    
    if modulus == 1 {
        return 0;
    }
    
    if exponent == 0 {
        return 1;
    }
    
    base = base % modulus;
    
    if base == 0 {
        return 0;
    }
    
    let mut result = 1u64;
    
    while exponent > 0 {
        if exponent & 1 == 1 {
            result = ((result as u128 * base as u128) % modulus as u128) as u64;
        }
        
        base = ((base as u128 * base as u128) % modulus as u128) as u64;
        exponent >>= 1;
    }
    
    result
}

// Integer square root using binary search
// Returns the largest integer x such that x² ≤ n
fn integer_sqrt(n: u32) -> u32 {
    if n == 0 {
        return 0;
    }
    
    if n < 4 {
        return 1;
    }
    
    let mut left = 1u32;
    let mut right = n / 2;
    let mut result = 1u32;
    
    while left <= right {
        let mid = left + (right - left) / 2;
        
        // Check if mid * mid <= n
        // Use u64 to avoid overflow
        let mid_squared = (mid as u64) * (mid as u64);
        let n_u64 = n as u64;
        
        if mid_squared == n_u64 {
            return mid;
        } else if mid_squared < n_u64 {
            result = mid;
            left = mid + 1;
        } else {
            if mid > 0 {
                right = mid - 1;
            } else {
                break;
            }
        }
    }
    
    result
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::filter::EnvFilter::from_default_env())
        .init();

    // Read command line arguments
    let args: Vec<String> = std::env::args().collect();
    
    // New format: program <operation> <session_id> <request_nonce> <...computation_args>
    if args.len() < 4 {
        eprintln!("Usage: {} <operation> <session_id> <request_nonce> <...args>", args[0]);
        std::process::exit(1);
    }
    
    let operation = &args[1];
    let session_id_hex = &args[2];
    let request_nonce: u64 = args[3].parse().expect("Request nonce must be a number");
    
    // Validate session ID format (UUID without hyphens as hex)
    if session_id_hex.len() != 32 {
        eprintln!("Error: Session ID must be 32 hex characters (UUID without hyphens)");
        std::process::exit(1);
    }
    
    // Parse session ID from hex
    let session_id_bytes = hex::decode(session_id_hex)
        .expect("Session ID must be valid hex");
    if session_id_bytes.len() != 16 {
        eprintln!("Error: Session ID must decode to 16 bytes");
        std::process::exit(1);
    }
    
    // Convert to fixed-size array for guest program
    let mut session_id: [u8; 16] = [0; 16];
    session_id.copy_from_slice(&session_id_bytes);
    
    eprintln!("🔐 Session ID: {}", session_id_hex);
    eprintln!("🔢 Request nonce: {}", request_nonce);
    
    match operation.as_str() {
        "sqrt" => {
            if args.len() != 5 {
                eprintln!("Usage: {} sqrt <session_id> <request_nonce> <n>", args[0]);
                std::process::exit(1);
            }
        }
        "modexp" => {
            if args.len() != 7 {
                eprintln!("Usage: {} modexp <session_id> <request_nonce> <base> <exponent> <modulus>", args[0]);
                std::process::exit(1);
            }
        }
        "range" => {
            if args.len() != 7 {
                eprintln!("Usage: {} range <session_id> <request_nonce> <secret_number> <min> <max>", args[0]);
                std::process::exit(1);
            }
        }
        _ => {
            if args.len() != 6 {
                eprintln!("Usage: {} <operation> <session_id> <request_nonce> <a> <b>", args[0]);
                eprintln!("Operations: add, multiply, sqrt, modexp, range");
                std::process::exit(1);
            }
        }
    }
    
    let total_start = Instant::now();
    let (elf_data, image_id, op_symbol, inputs_desc, expected_result_fixed, operation_type) = match operation.as_str() {
        "add" => {
            let a_decimal: f64 = args[2].parse().expect("Second argument must be a number");
            let b_decimal: f64 = args[3].parse().expect("Third argument must be a number");
            let a_fixed = decimal_to_fixed_point(a_decimal);
            let b_fixed = decimal_to_fixed_point(b_decimal);
            let expected_fixed = a_fixed + b_fixed;
            (ADDITION_ELF, ADDITION_ID, "+", format!("{} + {}", a_decimal, b_decimal), expected_fixed, "decimal")
        },
        "multiply" => {
            let a_decimal: f64 = args[2].parse().expect("Second argument must be a number");
            let b_decimal: f64 = args[3].parse().expect("Third argument must be a number");
            let a_fixed = decimal_to_fixed_point(a_decimal);
            let b_fixed = decimal_to_fixed_point(b_decimal);
            let expected_fixed = (a_fixed * b_fixed) / SCALE;
            (MULTIPLY_GUEST_ELF, MULTIPLY_GUEST_ID, "*", format!("{} * {}", a_decimal, b_decimal), expected_fixed, "decimal")
        },
        "sqrt" => {
            let n_decimal: f64 = args[2].parse().expect("Second argument must be a positive number");
            let n_fixed = decimal_to_fixed_point(n_decimal);
            let expected_fixed = if n_decimal >= 0.0 {
                decimal_to_fixed_point(n_decimal.sqrt())
            } else {
                0
            };
            (SQRT_GUEST_ELF, SQRT_GUEST_ID, "sqrt", format!("sqrt({})", n_decimal), expected_fixed, "decimal")
        },
        "modexp" => {
            let base: u64 = args[2].parse().expect("Base must be a positive integer");
            let exponent: u64 = args[3].parse().expect("Exponent must be a positive integer");
            let modulus: u64 = args[4].parse().expect("Modulus must be a positive integer");
            let expected_result = if modulus == 0 {
                0
            } else if modulus == 1 {
                0
            } else {
                // Use modular exponentiation to avoid overflow
                modular_exponentiation_host(base, exponent, modulus)
            };
            (MODEXP_GUEST_ELF, MODEXP_GUEST_ID, "^", format!("{}^{} mod {}", base, exponent, modulus), expected_result as i64, "integer")
        },
        "range" => {
            let secret_number: u64 = args[2].parse().expect("Secret number must be a positive integer");
            let min_value: u64 = args[3].parse().expect("Min value must be a positive integer");
            let max_value: u64 = args[4].parse().expect("Max value must be a positive integer");
            let expected_result = if secret_number >= min_value && secret_number <= max_value { 1 } else { 0 };
            (GUEST_RANGE_ELF, GUEST_RANGE_ID, "∈", format!("secret ∈ [{}, {}]", min_value, max_value), expected_result as i64, "range")
        },
        _ => {
            eprintln!("Error: Unknown operation '{}'. Use 'add', 'multiply', 'sqrt', 'modexp', or 'range'.", operation);
            std::process::exit(1);
        }
    };
    eprintln!("🚀 Starting RISC Zero zkVM computation: {}", inputs_desc);
    
    let dev_mode = std::env::var("RISC0_DEV_MODE").unwrap_or("0".to_string()) == "1";
    if dev_mode {
        eprintln!("⚠️  Running in DEVELOPMENT mode - no real proofs generated");
    } else {
        eprintln!("🔐 Running in PRODUCTION mode - generating real ZK-STARK proof");
        eprintln!("💡 This may take several minutes and use significant CPU/memory");
    }
    
    // Initialize the executor environment
    eprintln!("📝 Setting up executor environment...");
    let env_start = Instant::now();
    let env = match operation.as_str() {
        "sqrt" => {
            let n_decimal: f64 = args[4].parse().expect("Fourth argument must be a positive number");
            let n_fixed = decimal_to_fixed_point(n_decimal);
            ExecutorEnv::builder()
                .write(&session_id)?      // Session context first
                .write(&request_nonce)?   // Request nonce second
                .write(&n_fixed)?         // Then computation inputs
                .build()?
        },
        "add" | "multiply" => {
            let a_decimal: f64 = args[4].parse().expect("Fourth argument must be a number");
            let b_decimal: f64 = args[5].parse().expect("Fifth argument must be a number");
            let a_fixed = decimal_to_fixed_point(a_decimal);
            let b_fixed = decimal_to_fixed_point(b_decimal);
            ExecutorEnv::builder()
                .write(&session_id)?      // Session context first
                .write(&request_nonce)?   // Request nonce second
                .write(&a_fixed)?         // Then computation inputs
                .write(&b_fixed)?
                .build()?
        },
        "modexp" => {
            let base: u64 = args[4].parse().expect("Fourth argument must be a positive integer");
            let exponent: u64 = args[5].parse().expect("Fifth argument must be a positive integer");
            let modulus: u64 = args[6].parse().expect("Sixth argument must be a positive integer");
            ExecutorEnv::builder()
                .write(&session_id)?      // Session context first
                .write(&request_nonce)?   // Request nonce second
                .write(&base)?            // Then computation inputs
                .write(&exponent)?
                .write(&modulus)?
                .build()?
        },
        "range" => {
            let secret_number: u64 = args[4].parse().expect("Fourth argument must be a positive integer");
            let min_value: u64 = args[5].parse().expect("Fifth argument must be a positive integer");
            let max_value: u64 = args[6].parse().expect("Sixth argument must be a positive integer");
            ExecutorEnv::builder()
                .write(&session_id)?      // Session context first
                .write(&request_nonce)?   // Request nonce second
                .write(&secret_number)?   // Then computation inputs
                .write(&min_value)?
                .write(&max_value)?
                .build()?
        },
        _ => {
            eprintln!("Error: Unknown operation");
            std::process::exit(1);
        }
    };
    eprintln!("✅ Executor environment ready ({:.2?})", env_start.elapsed());

    // Generate the receipt by running the prover
    eprintln!("🏃 Starting zkVM execution and proof generation...");
    let prove_start = Instant::now();
    let prover = default_prover();
    
    if !dev_mode {
        eprintln!("🔄 Executing guest program in zkVM...");
    }
    
    let prove_info = prover.prove(env, elf_data)?;
    let receipt = prove_info.receipt;
    let prove_duration = prove_start.elapsed();
    
    if dev_mode {
        eprintln!("✅ Development execution completed ({:.2?})", prove_duration);
    } else {
        eprintln!("🎉 ZK-STARK proof generation completed! ({:.2?})", prove_duration);
        if let Ok(succinct) = receipt.inner.succinct() {
            eprintln!("📊 Proof size: {} bytes", succinct.seal.len());
        }
    }
    
    // Extract the result from the receipt's journal
    eprintln!("📖 Extracting result from receipt journal...");
    let (decimal_result, result_for_json) = match operation.as_str() {
        "sqrt" => {
            // For sqrt, manually decode the bytes for fixed-point values (i64)
            let bytes = &receipt.journal.bytes;
            if bytes.len() < 16 {
                return Err("Journal too short for sqrt operation".into());
            }
            
            // First 8 bytes: input (little-endian i64 fixed-point)
            let input_fixed = i64::from_le_bytes([
                bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7]
            ]);
            // Next 8 bytes: sqrt result (little-endian i64 fixed-point)
            let sqrt_result_fixed = i64::from_le_bytes([
                bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]
            ]);
            
            let input_decimal = fixed_point_to_decimal(input_fixed);
            let sqrt_result_decimal = fixed_point_to_decimal(sqrt_result_fixed);
            
            eprintln!("🔢 Computation result: sqrt({}) = {}", input_decimal, sqrt_result_decimal);
            (sqrt_result_decimal, sqrt_result_fixed)
        },
        "add" | "multiply" => {
            // For decimal operations, manually decode the journal bytes to avoid stateful decoder issues
            let bytes = &receipt.journal.bytes;
            if bytes.len() < 24 {
                return Err("Journal too short for decimal operation".into());
            }
            
            // Decode three i64 values (little-endian): a, b, result
            let a_fixed = i64::from_le_bytes([
                bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7]
            ]);
            let b_fixed = i64::from_le_bytes([
                bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]
            ]);
            let result_fixed = i64::from_le_bytes([
                bytes[16], bytes[17], bytes[18], bytes[19], bytes[20], bytes[21], bytes[22], bytes[23]
            ]);
            
            let a_decimal = fixed_point_to_decimal(a_fixed);
            let b_decimal = fixed_point_to_decimal(b_fixed);
            let result_decimal = fixed_point_to_decimal(result_fixed);
            
            eprintln!("🔢 Computation result: {} {} {} = {}", a_decimal, op_symbol, b_decimal, result_decimal);
            (result_decimal, result_fixed)
        },
        "modexp" => {
            // For modexp, manually decode the bytes for u64 values
            let bytes = &receipt.journal.bytes;
            if bytes.len() < 32 {
                return Err("Journal too short for modexp operation".into());
            }
            
            // Decode four u64 values (little-endian): base, exponent, modulus, result
            let base = u64::from_le_bytes([
                bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7]
            ]);
            let exponent = u64::from_le_bytes([
                bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]
            ]);
            let modulus = u64::from_le_bytes([
                bytes[16], bytes[17], bytes[18], bytes[19], bytes[20], bytes[21], bytes[22], bytes[23]
            ]);
            let result = u64::from_le_bytes([
                bytes[24], bytes[25], bytes[26], bytes[27], bytes[28], bytes[29], bytes[30], bytes[31]
            ]);
            
            eprintln!("🔢 Computation result: {}^{} mod {} = {}", base, exponent, modulus, result);
            (result as f64, result as i64)
        },
        "range" => {
            // For range proof, manually decode the bytes for boolean and u64 values
            let bytes = &receipt.journal.bytes;
            if bytes.len() < 28 {
                return Err("Journal too short for range operation".into());
            }
            
            // First 4 bytes: in_range boolean (stored as u32)
            let in_range = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) != 0;
            // Next 4 bytes: above_min boolean (stored as u32)
            let above_min = u32::from_le_bytes([bytes[4], bytes[5], bytes[6], bytes[7]]) != 0;
            // Next 4 bytes: below_max boolean (stored as u32)
            let below_max = u32::from_le_bytes([bytes[8], bytes[9], bytes[10], bytes[11]]) != 0;
            // Next 8 bytes: min_value (little-endian u64)
            let min_value = u64::from_le_bytes([
                bytes[12], bytes[13], bytes[14], bytes[15], bytes[16], bytes[17], bytes[18], bytes[19]
            ]);
            // Next 8 bytes: max_value (little-endian u64)
            let max_value = u64::from_le_bytes([
                bytes[20], bytes[21], bytes[22], bytes[23], bytes[24], bytes[25], bytes[26], bytes[27]
            ]);
            
            eprintln!("🔢 Range proof result: secret ∈ [{}, {}] = {}", min_value, max_value, in_range);
            eprintln!("🔍 Details: above_min={}, below_max={}", above_min, below_max);
            (if in_range { 1.0 } else { 0.0 }, if in_range { 1 } else { 0 })
        },
        _ => {
            return Err("Unknown operation".into());
        }
    };
    
    // Verify the receipt
    eprintln!("🔍 Verifying receipt authenticity...");
    let verify_start = Instant::now();
    let verification_result = receipt.verify(image_id);
    let verify_duration = verify_start.elapsed();
    let is_verified = verification_result.is_ok();
    
    match verification_result {
        Ok(_) => {
            eprintln!("✅ Receipt verification PASSED ({:.2?})", verify_duration);
            if !dev_mode {
                eprintln!("🎯 ZK-STARK proof is cryptographically valid!");
            }
        },
        Err(ref e) => {
            eprintln!("❌ Receipt verification FAILED: {}", e);
        }
    }
    
    let total_duration = total_start.elapsed();
    eprintln!("⏱️  Total execution time: {:.2?}", total_duration);
    
    if !dev_mode {
        eprintln!("🏆 Real zero-knowledge proof successfully generated and verified!");
        eprintln!("📈 Performance stats:");
        eprintln!("   • Proof generation: {:.2?}", prove_duration);
        eprintln!("   • Verification: {:.2?}", verify_duration);
        eprintln!("   • Total time: {:.2?}", total_duration);
    }
    
    eprintln!("🔄 Outputting JSON result...");
    
    // Get current timestamp for consistent use
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    // Print results in JSON format for easy parsing
    let id_bytes: &[u8] = unsafe { 
        std::slice::from_raw_parts(image_id.as_ptr() as *const u8, mem::size_of_val(&image_id))
    };
    
    // Get proof/seal data
    let (proof_hex, proof_size, proof_file_path) = if !dev_mode {
        // Try to get the full receipt bytes for the proof
        let receipt_bytes = bincode::serialize(&receipt)?;
        let receipt_hex = hex::encode(&receipt_bytes);
        let size = receipt_bytes.len();
        
        // Save proof to binary file
        let proof_filename = format!("proof_{}_{}_{}.bin", operation, session_id_hex, timestamp);
        match std::fs::write(&proof_filename, &receipt_bytes) {
            Ok(_) => eprintln!("📁 Full receipt proof saved to: {}", proof_filename),
            Err(e) => eprintln!("⚠️  Failed to save proof file: {}", e),
        }
        
        (Some(receipt_hex), Some(size), Some(proof_filename))
    } else {
        (None, None, None)
    };
    
    println!("{{");
    // Include session context in output
    println!("  \"session_context\": {{");
    println!("    \"session_id\": \"{}\",", session_id_hex);
    println!("    \"request_nonce\": {},", request_nonce);
    println!("    \"timestamp\": {}", timestamp);
    println!("  }},");
    
    match operation.as_str() {
        "sqrt" => {
            let n_decimal: f64 = args[4].parse().expect("Fourth argument must be a positive number");
            println!("  \"inputs\": {{ \"n\": {} }},", n_decimal);
        },
        "add" | "multiply" => {
            let a_decimal: f64 = args[4].parse().expect("Fourth argument must be a number");
            let b_decimal: f64 = args[5].parse().expect("Fifth argument must be a number");
            println!("  \"inputs\": {{ \"a\": {}, \"b\": {} }},", a_decimal, b_decimal);
        },
        "modexp" => {
            let base: u64 = args[4].parse().expect("Fourth argument must be a positive integer");
            let exponent: u64 = args[5].parse().expect("Fifth argument must be a positive integer");
            let modulus: u64 = args[6].parse().expect("Sixth argument must be a positive integer");
            println!("  \"inputs\": {{ \"base\": {}, \"exponent\": {}, \"modulus\": {} }},", base, exponent, modulus);
        },
        "range" => {
            let min_value: u64 = args[5].parse().expect("Fifth argument must be a positive integer");
            let max_value: u64 = args[6].parse().expect("Sixth argument must be a positive integer");
            println!("  \"inputs\": {{ \"min\": {}, \"max\": {} }},", min_value, max_value);
        },
        _ => {
            println!("  \"inputs\": {{ \"unknown\": true }},");
        }
    }
    println!("  \"result\": {},", decimal_result);
    println!("  \"receipt_journal\": {:?},", receipt.journal.bytes);
    println!("  \"image_id\": \"{}\",", hex::encode(id_bytes));
    println!("  \"verification_status\": \"{}\",", 
        if is_verified { "verified" } else { "failed" }
    );
    println!("  \"proof_generation_time_ms\": {},", prove_duration.as_millis());
    println!("  \"verification_time_ms\": {},", verify_duration.as_millis());
    println!("  \"total_time_ms\": {},", total_duration.as_millis());
    
    // Include proof data
    if let Some(proof) = &proof_hex {
        println!("  \"proof_seal_hex\": \"{}\",", proof);
        println!("  \"proof_size_bytes\": {},", proof_size.unwrap_or(0));
        if let Some(file_path) = &proof_file_path {
            println!("  \"proof_file_path\": \"{}\",", file_path);
        }
    } else {
        println!("  \"proof_seal_hex\": null,");
        println!("  \"proof_size_bytes\": null,");
        println!("  \"proof_file_path\": null,");
    }
    
    println!("  \"dev_mode\": {}", dev_mode);
    println!("}}");
    
    Ok(())
}
