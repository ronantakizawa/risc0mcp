// Simple neural network inference with zero-knowledge proof
// This performs inference on a pre-trained single-layer perceptron without revealing weights
use risc0_zkvm::guest::env;

fn main() {
    // Read input from the host - expects:
    // {
    //   "weights": [0.5, -0.3, 0.8, -0.1],
    //   "bias": 0.2,
    //   "input": [1.0, 2.0, 0.5, -1.0],
    //   "threshold": 0.0
    // }
    let inputs_json: String = env::read();
    
    let result = if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&inputs_json) {
        if let (
            Some(weights),
            Some(bias),
            Some(input),
            Some(threshold)
        ) = (
            parsed.get("weights").and_then(|v| v.as_array()),
            parsed.get("bias").and_then(|v| v.as_f64()),
            parsed.get("input").and_then(|v| v.as_array()),
            parsed.get("threshold").and_then(|v| v.as_f64())
        ) {
            // Convert arrays to Vec<f64>
            let weight_data: Result<Vec<f64>, _> = weights
                .iter()
                .map(|v| v.as_f64().ok_or("Invalid weight"))
                .collect();
            
            let input_data: Result<Vec<f64>, _> = input
                .iter()
                .map(|v| v.as_f64().ok_or("Invalid input"))
                .collect();
            
            match (weight_data, input_data) {
                (Ok(w), Ok(x)) => {
                    if w.len() == x.len() {
                        let prediction = neural_network_inference(&w, bias, &x, threshold);
                        prediction
                    } else {
                        -1 // Mismatched weight and input dimensions
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
    
    // Commit the classification result (1 = positive class, 0 = negative class)
    // Note: The model weights remain private!
    env::commit(&result);
}

// Perform neural network inference (single layer perceptron)
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

// Sigmoid activation function (alternative to step function)
#[allow(dead_code)]
fn sigmoid(x: f64) -> f64 {
    1.0 / (1.0 + (-x).exp())
}