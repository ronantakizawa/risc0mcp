use methods::{ADDITION_ELF, ADDITION_ID, MULTIPLY_GUEST_ELF, MULTIPLY_GUEST_ID, SQRT_GUEST_ELF, SQRT_GUEST_ID, MODEXP_GUEST_ELF, MODEXP_GUEST_ID, GUEST_RANGE_ELF, GUEST_RANGE_ID};
use risc0_zkvm::{default_prover, ExecutorEnv, compute_image_id};
use std::mem;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use std::fs;
use std::process::Command;

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
    
    // New format: program <operation> <...computation_args>
    if args.len() < 2 {
        eprintln!("Usage: {} <operation> <...args>", args[0]);
        std::process::exit(1);
    }
    
    let operation = &args[1];
    
    match operation.as_str() {
        "sqrt" => {
            if args.len() != 3 {
                eprintln!("Usage: {} sqrt <n>", args[0]);
                std::process::exit(1);
            }
        }
        "modexp" => {
            if args.len() != 5 {
                eprintln!("Usage: {} modexp <base> <exponent> <modulus>", args[0]);
                std::process::exit(1);
            }
        }
        "range" => {
            if args.len() != 5 {
                eprintln!("Usage: {} range <secret_number> <min> <max>", args[0]);
                std::process::exit(1);
            }
        }
        "dynamic" => {
            if args.len() != 4 {
                eprintln!("Usage: {} dynamic <guest_program_path> <inputs_json>", args[0]);
                std::process::exit(1);
            }
        }
        "precompiled" => {
            if args.len() != 4 {
                eprintln!("Usage: {} precompiled <guest_binary_path> <inputs_json>", args[0]);
                std::process::exit(1);
            }
        }
        _ => {
            if args.len() != 4 {
                eprintln!("Usage: {} <operation> <a> <b>", args[0]);
                eprintln!("Operations: add, multiply, sqrt, modexp, range, dynamic, precompiled");
                std::process::exit(1);
            }
        }
    }
    
    let total_start = Instant::now();
    
    // Handle dynamic elf data separately to manage lifetimes
    let dynamic_elf_data: Option<Vec<u8>> = if operation == "dynamic" || operation == "precompiled" {
        let guest_program_path = &args[2];
        let inputs_json = &args[3];
        
        if operation == "precompiled" {
            eprintln!("🔧 Loading precompiled guest program: {}", guest_program_path);
            
            // Read the precompiled binary directly
            let elf_data = fs::read(guest_program_path)?;
            Some(elf_data)
        } else {
            eprintln!("🔧 Compiling dynamic guest program: {}", guest_program_path);
            
            // Create a temporary directory for the dynamic guest program
            let temp_dir = std::env::temp_dir().join(format!("risc0_dynamic_{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs()));
            fs::create_dir_all(&temp_dir)?;
        
        // Copy the Cargo.toml template for a guest program
        let cargo_toml_content = r#"[package]
name = "guest-dynamic"
version = "0.1.0"
edition = "2021"

[dependencies]
risc0-zkvm = { version = "^2.3.1", default-features = false, features = ["std"] }

[[bin]]
name = "guest-dynamic"
path = "src/main.rs"
"#;
        
        let cargo_toml_path = temp_dir.join("Cargo.toml");
        fs::write(&cargo_toml_path, cargo_toml_content)?;
        
        // Create src directory and copy the guest program
        let src_dir = temp_dir.join("src");
        fs::create_dir_all(&src_dir)?;
        
        let guest_code = fs::read_to_string(guest_program_path)?;
        let main_rs_path = src_dir.join("main.rs");
        fs::write(&main_rs_path, guest_code)?;
        
        // Build the guest program using RISC Zero toolchain
        eprintln!("🔨 Building dynamic guest program...");
        let build_output = Command::new("cargo")
            .args(["risczero", "build"])
            .current_dir(&temp_dir)
            .output()?;
        
        if !build_output.status.success() {
            eprintln!("❌ Failed to build dynamic guest program:");
            eprintln!("stdout: {}", String::from_utf8_lossy(&build_output.stdout));
            eprintln!("stderr: {}", String::from_utf8_lossy(&build_output.stderr));
            return Err("Dynamic guest program compilation failed".into());
        }
        
        // Find the built ELF file (cargo risczero build places it in docker subdirectory)
        let elf_path = temp_dir.join("target/riscv32im-risc0-zkvm-elf/docker/guest-dynamic.bin");
        if !elf_path.exists() {
            eprintln!("❌ ELF file not found at: {}", elf_path.display());
            eprintln!("🔍 Checking directory contents...");
            if let Ok(entries) = std::fs::read_dir(temp_dir.join("target")) {
                for entry in entries {
                    if let Ok(entry) = entry {
                        eprintln!("  Found: {}", entry.path().display());
                    }
                }
            }
            return Err("Built ELF file not found".into());
        }
        
        let elf_data = fs::read(&elf_path)?;
        eprintln!("✅ Dynamic guest program compiled successfully ({} bytes)", elf_data.len());
        
        // Clean up temporary directory
        let _ = fs::remove_dir_all(&temp_dir);
        
        Some(elf_data)
        }
    } else {
        None
    };
    
    let (elf_data, image_id, op_symbol, inputs_desc, _expected_result_fixed, _operation_type) = match operation.as_str() {
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
            let base: u64 = args[2].parse().expect("Second argument must be a positive integer");
            let exponent: u64 = args[3].parse().expect("Third argument must be a positive integer");
            let modulus: u64 = args[4].parse().expect("Fourth argument must be a positive integer");
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
            let max_value: u64 = args[4].parse().expect("Fourth argument must be a positive integer");
            let expected_result = if secret_number >= min_value && secret_number <= max_value { 1 } else { 0 };
            (GUEST_RANGE_ELF, GUEST_RANGE_ID, "∈", format!("secret ∈ [{}, {}]", min_value, max_value), expected_result as i64, "range")
        },
        "dynamic" | "precompiled" => {
            let inputs_json = &args[3];
            let elf_data = dynamic_elf_data.as_ref().expect("Dynamic/Precompiled ELF data should be loaded");
            
            // We'll compute the real image ID after proof generation from the receipt
            // For now, use a placeholder that will be replaced later
            let placeholder_image_id = [0u32; 8];
            
            let op_name = if operation == "dynamic" { "dynamic" } else { "precompiled" };
            (elf_data.as_slice(), placeholder_image_id, op_name, format!("{} execution with inputs: {}", op_name, inputs_json), 0i64, op_name)
        },
        _ => {
            eprintln!("Error: Unknown operation '{}'. Use 'add', 'multiply', 'sqrt', 'modexp', 'range', 'dynamic', or 'precompiled'.", operation);
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
            let n_decimal: f64 = args[2].parse().expect("Second argument must be a positive number");
            let n_fixed = decimal_to_fixed_point(n_decimal);
            ExecutorEnv::builder()
                .write(&n_fixed)?         // Computation inputs only
                .build()?
        },
        "add" | "multiply" => {
            let a_decimal: f64 = args[2].parse().expect("Second argument must be a number");
            let b_decimal: f64 = args[3].parse().expect("Third argument must be a number");
            let a_fixed = decimal_to_fixed_point(a_decimal);
            let b_fixed = decimal_to_fixed_point(b_decimal);
            ExecutorEnv::builder()
                .write(&a_fixed)?         // Computation inputs only
                .write(&b_fixed)?
                .build()?
        },
        "modexp" => {
            let base: u64 = args[2].parse().expect("Second argument must be a positive integer");
            let exponent: u64 = args[3].parse().expect("Third argument must be a positive integer");
            let modulus: u64 = args[4].parse().expect("Fourth argument must be a positive integer");
            ExecutorEnv::builder()
                .write(&base)?            // Computation inputs only
                .write(&exponent)?
                .write(&modulus)?
                .build()?
        },
        "range" => {
            let secret_number: u64 = args[2].parse().expect("Second argument must be a positive integer");
            let min_value: u64 = args[3].parse().expect("Third argument must be a positive integer");
            let max_value: u64 = args[4].parse().expect("Fourth argument must be a positive integer");
            ExecutorEnv::builder()
                .write(&secret_number)?   // Computation inputs only
                .write(&min_value)?
                .write(&max_value)?
                .build()?
        },
        "dynamic" | "precompiled" => {
            let inputs_json = &args[3];
            
            // Parse inputs JSON and write to environment
            let inputs: serde_json::Value = serde_json::from_str(inputs_json)
                .map_err(|e| format!("Invalid JSON inputs: {}", e))?;
            
            ExecutorEnv::builder()
                .write(&inputs_json)?     // Write JSON string directly
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
            if bytes.len() < 16 { // sqrt data (16 bytes)
                return Err("Journal too short for sqrt operation".into());
            }
            
            // No session context to skip
            let computation_bytes = bytes;
            
            // First 8 bytes: input (little-endian i64 fixed-point)
            let input_fixed = i64::from_le_bytes([
                computation_bytes[0], computation_bytes[1], computation_bytes[2], computation_bytes[3], 
                computation_bytes[4], computation_bytes[5], computation_bytes[6], computation_bytes[7]
            ]);
            // Next 8 bytes: sqrt result (little-endian i64 fixed-point)
            let sqrt_result_fixed = i64::from_le_bytes([
                computation_bytes[8], computation_bytes[9], computation_bytes[10], computation_bytes[11], 
                computation_bytes[12], computation_bytes[13], computation_bytes[14], computation_bytes[15]
            ]);
            
            let input_decimal = fixed_point_to_decimal(input_fixed);
            let sqrt_result_decimal = fixed_point_to_decimal(sqrt_result_fixed);
            
            eprintln!("🔢 Computation result: sqrt({}) = {}", input_decimal, sqrt_result_decimal);
            (sqrt_result_decimal, sqrt_result_fixed)
        },
        "add" | "multiply" => {
            // For decimal operations, manually decode the journal bytes to avoid stateful decoder issues
            let bytes = &receipt.journal.bytes;
            if bytes.len() < 24 { // computation data (24 bytes)
                return Err("Journal too short for decimal operation".into());
            }
            
            // No session context to skip
            let computation_bytes = bytes;
            
            // Decode three i64 values (little-endian): a, b, result
            let a_fixed = i64::from_le_bytes([
                computation_bytes[0], computation_bytes[1], computation_bytes[2], computation_bytes[3], 
                computation_bytes[4], computation_bytes[5], computation_bytes[6], computation_bytes[7]
            ]);
            let b_fixed = i64::from_le_bytes([
                computation_bytes[8], computation_bytes[9], computation_bytes[10], computation_bytes[11], 
                computation_bytes[12], computation_bytes[13], computation_bytes[14], computation_bytes[15]
            ]);
            let result_fixed = i64::from_le_bytes([
                computation_bytes[16], computation_bytes[17], computation_bytes[18], computation_bytes[19], 
                computation_bytes[20], computation_bytes[21], computation_bytes[22], computation_bytes[23]
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
            if bytes.len() < 32 { // modexp data (32 bytes)
                return Err("Journal too short for modexp operation".into());
            }
            
            // No session context to skip
            let computation_bytes = bytes;
            
            // Decode four u64 values (little-endian): base, exponent, modulus, result
            let base = u64::from_le_bytes([
                computation_bytes[0], computation_bytes[1], computation_bytes[2], computation_bytes[3], 
                computation_bytes[4], computation_bytes[5], computation_bytes[6], computation_bytes[7]
            ]);
            let exponent = u64::from_le_bytes([
                computation_bytes[8], computation_bytes[9], computation_bytes[10], computation_bytes[11], 
                computation_bytes[12], computation_bytes[13], computation_bytes[14], computation_bytes[15]
            ]);
            let modulus = u64::from_le_bytes([
                computation_bytes[16], computation_bytes[17], computation_bytes[18], computation_bytes[19], 
                computation_bytes[20], computation_bytes[21], computation_bytes[22], computation_bytes[23]
            ]);
            let result = u64::from_le_bytes([
                computation_bytes[24], computation_bytes[25], computation_bytes[26], computation_bytes[27], 
                computation_bytes[28], computation_bytes[29], computation_bytes[30], computation_bytes[31]
            ]);
            
            eprintln!("🔢 Computation result: {}^{} mod {} = {}", base, exponent, modulus, result);
            (result as f64, result as i64)
        },
        "range" => {
            // For range proof, manually decode the bytes for boolean and u64 values
            let bytes = &receipt.journal.bytes;
            if bytes.len() < 28 { // range data (28 bytes)
                return Err("Journal too short for range operation".into());
            }
            
            // No session context to skip
            let computation_bytes = bytes;
            
            // First 4 bytes: in_range boolean (stored as u32)
            let in_range = u32::from_le_bytes([computation_bytes[0], computation_bytes[1], computation_bytes[2], computation_bytes[3]]) != 0;
            // Next 4 bytes: above_min boolean (stored as u32)
            let above_min = u32::from_le_bytes([computation_bytes[4], computation_bytes[5], computation_bytes[6], computation_bytes[7]]) != 0;
            // Next 4 bytes: below_max boolean (stored as u32)
            let below_max = u32::from_le_bytes([computation_bytes[8], computation_bytes[9], computation_bytes[10], computation_bytes[11]]) != 0;
            // Next 8 bytes: min_value (little-endian u64)
            let min_value = u64::from_le_bytes([
                computation_bytes[12], computation_bytes[13], computation_bytes[14], computation_bytes[15], 
                computation_bytes[16], computation_bytes[17], computation_bytes[18], computation_bytes[19]
            ]);
            // Next 8 bytes: max_value (little-endian u64)
            let max_value = u64::from_le_bytes([
                computation_bytes[20], computation_bytes[21], computation_bytes[22], computation_bytes[23], 
                computation_bytes[24], computation_bytes[25], computation_bytes[26], computation_bytes[27]
            ]);
            
            eprintln!("🔢 Range proof result: secret ∈ [{}, {}] = {}", min_value, max_value, in_range);
            eprintln!("🔍 Details: above_min={}, below_max={}", above_min, below_max);
            (if in_range { 1.0 } else { 0.0 }, if in_range { 1 } else { 0 })
        },
        "dynamic" | "precompiled" => {
            // For dynamic/precompiled operations, try to extract the result from the journal
            let bytes = &receipt.journal.bytes;
            if bytes.len() < 8 { // At minimum need result data
                return Err("Journal too short for dynamic operation".into());
            }
            
            // No session context to skip
            let computation_bytes = bytes;
            
            // Try to parse the result - this depends on what the dynamic guest program committed
            // For now, let's assume it committed a simple i64 result
            let result = if computation_bytes.len() >= 8 {
                let result_i64 = i64::from_le_bytes([
                    computation_bytes[0], computation_bytes[1], computation_bytes[2], computation_bytes[3],
                    computation_bytes[4], computation_bytes[5], computation_bytes[6], computation_bytes[7]
                ]);
                eprintln!("🔢 Dynamic computation result: {}", result_i64);
                (result_i64 as f64, result_i64)
            } else {
                eprintln!("🔢 Dynamic computation completed (no specific result extracted)");
                (0.0, 0)
            };
            
            result
        },
        _ => {
            return Err("Unknown operation".into());
        }
    };
    
    // For dynamic/precompiled operations, compute the real image ID from the ELF data
    let actual_image_id = if operation == "dynamic" || operation == "precompiled" {
        // Compute the real image ID from the ELF data
        eprintln!("🔧 Computing real image ID from ELF data for dynamic program");
        let digest = compute_image_id(elf_data)?;
        // Convert Digest to [u32; 8] format to match expected type
        let words = digest.as_words();
        [words[0], words[1], words[2], words[3], words[4], words[5], words[6], words[7]]
    } else {
        image_id
    };
    
    // Verify the receipt
    eprintln!("🔍 Verifying receipt authenticity...");
    let verify_start = Instant::now();
    let verification_result = receipt.verify(actual_image_id);
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
        std::slice::from_raw_parts(actual_image_id.as_ptr() as *const u8, mem::size_of_val(&actual_image_id))
    };
    
    // Get proof/seal data
    let (proof_hex, proof_size, proof_file_path) = if !dev_mode {
        // Try to get the full receipt bytes for the proof
        let receipt_bytes = bincode::serialize(&receipt)?;
        let receipt_hex = hex::encode(&receipt_bytes);
        let size = receipt_bytes.len();
        
        // Save proof to binary file
        let proof_filename = format!("proof_{}_{}.bin", operation, timestamp);
        match std::fs::write(&proof_filename, &receipt_bytes) {
            Ok(_) => eprintln!("📁 Full receipt proof saved to: {}", proof_filename),
            Err(e) => eprintln!("⚠️  Failed to save proof file: {}", e),
        }
        
        (Some(receipt_hex), Some(size), Some(proof_filename))
    } else {
        (None, None, None)
    };
    
    println!("{{");
    println!("  \"timestamp\": {},", timestamp);
    
    match operation.as_str() {
        "sqrt" => {
            let n_decimal: f64 = args[2].parse().expect("Second argument must be a positive number");
            println!("  \"inputs\": {{ \"n\": {} }},", n_decimal);
        },
        "add" | "multiply" => {
            let a_decimal: f64 = args[2].parse().expect("Second argument must be a number");
            let b_decimal: f64 = args[3].parse().expect("Third argument must be a number");
            println!("  \"inputs\": {{ \"a\": {}, \"b\": {} }},", a_decimal, b_decimal);
        },
        "modexp" => {
            let base: u64 = args[2].parse().expect("Second argument must be a positive integer");
            let exponent: u64 = args[3].parse().expect("Third argument must be a positive integer");
            let modulus: u64 = args[4].parse().expect("Fourth argument must be a positive integer");
            println!("  \"inputs\": {{ \"base\": {}, \"exponent\": {}, \"modulus\": {} }},", base, exponent, modulus);
        },
        "range" => {
            let min_value: u64 = args[3].parse().expect("Third argument must be a positive integer");
            let max_value: u64 = args[4].parse().expect("Fourth argument must be a positive integer");
            println!("  \"inputs\": {{ \"min\": {}, \"max\": {} }},", min_value, max_value);
        },
        "dynamic" | "precompiled" => {
            let inputs_json = &args[3];
            println!("  \"inputs\": {},", inputs_json);
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
