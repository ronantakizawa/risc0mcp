// Logistic regression classification with zero-knowledge proof
// This performs binary classification without revealing the model weights or training data
use risc0_zkvm::guest::env;

fn main() {
    // Read input from the host - expects:
    // {
    //   "features": [35.0, 50000.0, 720.0],  // [age, income, credit_score]
    //   "feature_names": ["age", "income", "credit_score"],
    //   "task": "loan_approval"
    // }
    let inputs_json: String = env::read();
    
    let result = if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&inputs_json) {
        if let (
            Some(features),
            Some(task)
        ) = (
            parsed.get("features").and_then(|v| v.as_array()),
            parsed.get("task").and_then(|v| v.as_str())
        ) {
            // Convert features to Vec<f64>
            let feature_data: Result<Vec<f64>, _> = features
                .iter()
                .map(|v| v.as_f64().ok_or("Invalid feature value"))
                .collect();
            
            match feature_data {
                Ok(x) => {
                    if x.len() >= 2 && !task.is_empty() {
                        let prediction = logistic_regression_predict(&x, task);
                        // Return probability scaled by 10000 for precision
                        (prediction * 10000.0) as i64
                    } else {
                        -1 // Invalid features or task
                    }
                },
                _ => -2 // Invalid feature data
            }
        } else {
            -3 // Missing required fields
        }
    } else {
        -4 // JSON parse error
    };
    
    // Commit the prediction probability (scaled by 10000)
    // Note: The model weights and training process remain private!
    env::commit(&result);
}

// Perform logistic regression prediction using pre-trained weights
fn logistic_regression_predict(features: &[f64], task: &str) -> f64 {
    // Use different pre-trained models based on task
    let (weights, bias) = match task {
        "logistic_regression" => {
            // Generic logistic regression weights
            let mut w = Vec::new();
            for i in 0..features.len() {
                w.push(0.1 + (i as f64 * 0.05).sin() * 0.2);
            }
            (w, 0.0)
        },
        "loan_approval" => {
            // Pre-trained weights for loan approval: [age, income, credit_score]
            // Positive weights mean higher values increase approval probability
            (vec![0.01, 0.00001, 0.005], -2.5) // age, income, credit_score coefficients
        },
        "spam_detection" => {
            // Pre-trained weights for spam detection: [word_count, spam_words, sender_reputation]
            (vec![-0.005, 0.8, -2.0], 0.5)
        },
        "customer_churn" => {
            // Pre-trained weights for customer churn: [tenure, usage, complaints]
            (vec![-0.1, -0.02, 0.5], 1.0)
        },
        _ => {
            // Default generic binary classifier
            let mut w = Vec::new();
            for i in 0..features.len() {
                w.push(0.1 + (i as f64 * 0.05).sin() * 0.2);
            }
            (w, 0.0)
        }
    };
    
    // Calculate linear combination: w₁x₁ + w₂x₂ + ... + b
    let mut linear_output = bias;
    for i in 0..features.len().min(weights.len()) {
        linear_output += weights[i] * features[i];
    }
    
    // Apply sigmoid function: σ(z) = 1 / (1 + e^(-z))
    sigmoid(linear_output)
}

// Sigmoid activation function for logistic regression
fn sigmoid(x: f64) -> f64 {
    if x > 20.0 {
        1.0 // Prevent overflow
    } else if x < -20.0 {
        0.0 // Prevent underflow
    } else {
        1.0 / (1.0 + (-x).exp())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sigmoid() {
        assert!((sigmoid(0.0) - 0.5).abs() < 1e-10);
        assert!(sigmoid(1.0) > 0.5);
        assert!(sigmoid(-1.0) < 0.5);
        assert!((sigmoid(20.0) - 1.0).abs() < 1e-10);
        assert!(sigmoid(-20.0).abs() < 1e-10);
    }

    #[test]
    fn test_logistic_regression() {
        let features = vec![35.0, 50000.0, 720.0]; // Good loan candidate
        let prob = logistic_regression_predict(&features, "loan_approval");
        assert!(prob > 0.0 && prob < 1.0);
        
        let bad_features = vec![18.0, 15000.0, 500.0]; // Risky loan candidate
        let bad_prob = logistic_regression_predict(&bad_features, "loan_approval");
        assert!(bad_prob < prob); // Should have lower probability
    }
}