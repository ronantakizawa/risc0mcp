use methods::{ADDITION_ID, MULTIPLY_GUEST_ID};
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
        } else {
            "add".to_string() // default
        }
    };
    
    let (image_id, op_name) = match operation.as_str() {
        "multiply" => (MULTIPLY_GUEST_ID, "multiplication"),
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
    let result: i32 = receipt.journal.decode()?;
    println!("➡️  Computation result: {}", result);
    
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