use methods::{ADDITION_ELF, ADDITION_ID};
use risc0_zkvm::{default_prover, ExecutorEnv};
use std::mem;
use std::time::Instant;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::filter::EnvFilter::from_default_env())
        .init();

    // Read command line arguments
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 3 {
        eprintln!("Usage: {} <a> <b>", args[0]);
        std::process::exit(1);
    }
    
    let a: u32 = args[1].parse().expect("First argument must be a number");
    let b: u32 = args[2].parse().expect("Second argument must be a number");
    
    let total_start = Instant::now();
    eprintln!("🚀 Starting RISC Zero zkVM computation: {} + {}", a, b);
    
    let dev_mode = std::env::var("RISC0_DEV_MODE").unwrap_or("0".to_string()) == "1";
    if dev_mode {
        eprintln!("⚠️  Running in DEVELOPMENT mode - no real proofs generated");
    } else {
        eprintln!("🔐 Running in PRODUCTION mode - generating real ZK-STARK proof");
        eprintln!("💡 This may take several minutes and use significant CPU/memory");
    }
    
    // Initialize the executor environment with both numbers
    eprintln!("📝 Setting up executor environment...");
    let env_start = Instant::now();
    let env = ExecutorEnv::builder()
        .write(&a)?
        .write(&b)?
        .build()?;
    eprintln!("✅ Executor environment ready ({:.2?})", env_start.elapsed());

    // Generate the receipt by running the prover
    eprintln!("🏃 Starting zkVM execution and proof generation...");
    let prove_start = Instant::now();
    let prover = default_prover();
    
    if !dev_mode {
        eprintln!("🔄 Executing guest program in zkVM...");
    }
    
    let prove_info = prover.prove(env, ADDITION_ELF)?;
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
    let result: u32 = receipt.journal.decode()?;
    eprintln!("🔢 Computation result: {} + {} = {}", a, b, result);
    
    // Verify the receipt
    eprintln!("🔍 Verifying receipt authenticity...");
    let verify_start = Instant::now();
    let verification_result = receipt.verify(ADDITION_ID);
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
    
    // Print results in JSON format for easy parsing
    let id_bytes: &[u8] = unsafe { 
        std::slice::from_raw_parts(ADDITION_ID.as_ptr() as *const u8, mem::size_of_val(&ADDITION_ID))
    };
    
    // Get proof/seal data
    let (proof_hex, proof_size, proof_file_path) = if !dev_mode {
        // Try to get the full receipt bytes for the proof
        let receipt_bytes = bincode::serialize(&receipt)?;
        let receipt_hex = hex::encode(&receipt_bytes);
        let size = receipt_bytes.len();
        
        // Save proof to file
        let proof_filename = format!("proof_{}_{}.hex", a, b);
        match std::fs::write(&proof_filename, &receipt_hex) {
            Ok(_) => eprintln!("📁 Full receipt proof saved to: {}", proof_filename),
            Err(e) => eprintln!("⚠️  Failed to save proof file: {}", e),
        }
        
        (Some(receipt_hex), Some(size), Some(proof_filename))
    } else {
        (None, None, None)
    };
    
    println!("{{");
    println!("  \"inputs\": {{ \"a\": {}, \"b\": {} }},", a, b);
    println!("  \"result\": {},", result);
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
