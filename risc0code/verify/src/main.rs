use methods::{ADDITION_ID, MULTIPLY_GUEST_ID, SQRT_GUEST_ID, MODEXP_GUEST_ID};
use risc0_zkvm::Receipt;
use std::fs;
use clap::Parser;

#[derive(Parser)]
#[command(name = "verify")]
#[command(about = "Verify RISC Zero proofs from hex files")]
struct Args {
    /// Path to the hex proof file
    #[arg(short, long)]
    file: String,
    
    /// Expected result (optional, for validation)
    #[arg(short, long)]
    expected: Option<i32>,
    
    /// Operation type (add or multiply), auto-detected from filename if not specified
    #[arg(short, long)]
    operation: Option<String>,
    
    /// Show detailed information
    #[arg(short, long)]
    verbose: bool,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();
    
    println!("🔍 RISC Zero Proof Verifier");
    println!("══════════════════════════");
    
    // Determine operation from filename or argument
    let operation = if let Some(op) = args.operation {
        op
    } else {
        // Auto-detect from filename (e.g., proof_multiply_3_2.hex)
        let filename = std::path::Path::new(&args.file)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        
        if filename.contains("multiply") {
            "multiply".to_string()
        } else if filename.contains("sqrt") {
            "sqrt".to_string()
        } else if filename.contains("modexp") {
            "modexp".to_string()
        } else {
            "add".to_string() // default
        }
    };
    
    let (image_id, op_name) = match operation.as_str() {
        "multiply" => (MULTIPLY_GUEST_ID, "multiplication"),
        "sqrt" => (SQRT_GUEST_ID, "square root"),
        "modexp" => (MODEXP_GUEST_ID, "modular exponentiation"),
        _ => (ADDITION_ID, "addition"),
    };
    
    // Read the hex file
    println!("📁 Reading proof file: {}", args.file);
    println!("🔧 Detected operation: {}", op_name);
    let hex_content = fs::read_to_string(&args.file)?;
    let hex_content = hex_content.trim();
    
    if args.verbose {
        println!("📊 Hex file size: {} characters", hex_content.len());
        println!("📦 Estimated binary size: {} bytes", hex_content.len() / 2);
    }
    
    // Decode hex to bytes
    println!("🔄 Decoding hex data...");
    let receipt_bytes = hex::decode(hex_content)?;
    
    if args.verbose {
        println!("✅ Successfully decoded {} bytes", receipt_bytes.len());
    }
    
    // Deserialize the receipt
    println!("📖 Deserializing receipt...");
    let receipt: Receipt = bincode::deserialize(&receipt_bytes)?;
    
    if args.verbose {
        println!("✅ Receipt deserialized successfully");
        println!("📋 Receipt journal length: {} bytes", receipt.journal.bytes.len());
    }
    
    // Extract the result from the journal
    println!("🔢 Extracting computation result...");
    let result: i32 = match operation.as_str() {
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
            
            // Convert from fixed-point to decimal (scale factor 10000)
            let scale = 10000i64;
            let input_decimal = input_fixed as f64 / scale as f64;
            let sqrt_result_decimal = sqrt_result_fixed as f64 / scale as f64;
            
            println!("➡️  Computation result: sqrt({}) = {}", input_decimal, sqrt_result_decimal);
            sqrt_result_decimal as i32
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
            
            println!("➡️  Computation result: {}^{} mod {} = {}", base, exponent, modulus, result);
            result as i32
        },
        _ => {
            // For decimal operations (add/multiply), manually decode the journal bytes
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
            
            // Convert from fixed-point to decimal (scale factor 10000)
            let scale = 10000i64;
            let a_decimal = a_fixed as f64 / scale as f64;
            let b_decimal = b_fixed as f64 / scale as f64;
            let result_decimal = result_fixed as f64 / scale as f64;
            
            println!("➡️  Computation result: {} {} {} = {}", 
                a_decimal, 
                if operation == "multiply" { "*" } else { "+" }, 
                b_decimal, 
                result_decimal
            );
            result_decimal as i32
        }
    };
    
    if let Some(expected) = args.expected {
        if result == expected {
            println!("✅ Result matches expected value: {}", expected);
        } else {
            println!("❌ Result {} does not match expected value: {}", result, expected);
            return Err("Result mismatch".into());
        }
    }
    
    // Verify the receipt
    println!("🔐 Verifying cryptographic proof...");
    let verify_start = std::time::Instant::now();
    
    match receipt.verify(image_id) {
        Ok(_) => {
            let verify_duration = verify_start.elapsed();
            println!("🎉 PROOF VERIFICATION SUCCESSFUL! ({:.2?})", verify_duration);
            println!("✨ This proof is cryptographically valid and authentic");
            
            if args.verbose {
                println!("\n📊 Verification Details:");
                let id_bytes: &[u8] = unsafe { 
                    std::slice::from_raw_parts(image_id.as_ptr() as *const u8, std::mem::size_of_val(&image_id))
                };
                println!("   • Image ID: {}", hex::encode(id_bytes));
                println!("   • Journal bytes: {:?}", receipt.journal.bytes);
                println!("   • Verification time: {:.2?}", verify_duration);
                
                if let Ok(succinct) = receipt.inner.succinct() {
                    println!("   • Proof seal size: {} bytes", succinct.seal.len());
                }
            }
        }
        Err(e) => {
            println!("❌ PROOF VERIFICATION FAILED: {}", e);
            return Err(format!("Verification failed: {}", e).into());
        }
    }
    
    println!("\n🏆 Proof verification completed successfully!");
    println!("🔒 The computation was performed correctly and the proof is authentic.");
    
    Ok(())
}