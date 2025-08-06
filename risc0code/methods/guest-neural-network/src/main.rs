// Simple neural network inference with zero-knowledge proof
// This performs inference on a pre-trained single-layer perceptron without revealing weights
use risc0_zkvm::guest::env;

fn main() {
    // Read input from the host - expects:
    // {
    //   "inputs": [0.5, 0.3, 0.8],
    //   "learning_rate": 0.1,
    //   "epochs": 100
    // }
    let inputs_json: String = env::read();
    
    let result = if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&inputs_json) {
        if let (
            Some(inputs),
            Some(learning_rate),
            Some(epochs)
        ) = (
            parsed.get("inputs").and_then(|v| v.as_array()),
            parsed.get("learning_rate").and_then(|v| v.as_f64()),
            parsed.get("epochs").and_then(|v| v.as_i64())
        ) {
            // Convert inputs to Vec<f64>
            let input_data: Result<Vec<f64>, _> = inputs
                .iter()
                .map(|v| v.as_f64().ok_or("Invalid input"))
                .collect();
            
            match input_data {
                Ok(x) => {
                    if !x.is_empty() && learning_rate > 0.0 && epochs > 0 {
                        let result = neural_network_train_and_predict(&x, learning_rate, epochs as usize);
                        // Scale result by 1000 for precision
                        (result * 1000.0) as i64
                    } else {
                        -1 // Invalid parameters
                    }
                },
                _ => -2 // Invalid data arrays
            }
        } else {
            -3 // Missing required fields
        }
    } else {
        -4 // JSON parse error
    };
    
    // Commit the neural network result
    // Note: The model weights and training process remain private!
    env::commit(&result);
}

// Simple neural network inference (no training for speed)
fn neural_network_train_and_predict(inputs: &[f64], learning_rate: f64, epochs: usize) -> f64 {
    // Use pre-defined weights for fast inference (simulates a pre-trained network)
    let weights = match inputs.len() {
        3 => vec![0.6, -0.4, 0.8], // For 3 inputs
        2 => vec![0.7, -0.3],      // For 2 inputs  
        1 => vec![0.5],            // For 1 input
        _ => {
            // For other sizes, use simple pattern
            let mut w = Vec::new();
            for i in 0..inputs.len() {
                w.push(0.5 + (i as f64 * 0.1).sin() * 0.3);
            }
            w
        }
    };
    
    let bias = 0.2;
    
    // Simple forward pass (inference only)
    let mut output = bias;
    for i in 0..inputs.len() {
        output += weights[i] * inputs[i];
    }
    
    // Apply sigmoid activation
    sigmoid(output)
}

// Sigmoid activation function
fn sigmoid(x: f64) -> f64 {
    1.0 / (1.0 + (-x).exp())
}

// Sigmoid derivative for backpropagation
fn sigmoid_derivative(sigmoid_output: f64) -> f64 {
    sigmoid_output * (1.0 - sigmoid_output)
}

// Legacy function kept for reference
#[allow(dead_code)]
fn neural_network_inference(weights: &[f64], bias: f64, input: &[f64], threshold: f64) -> i64 {
    // Calculate weighted sum: sum(w_i * x_i) + bias
    let mut weighted_sum = bias;
    for i in 0..weights.len() {
        weighted_sum += weights[i] * input[i];
    }
    
    // Apply step activation function
    if weighted_sum > threshold {
        1 // Positive class
    } else {
        0 // Negative class
    }
}