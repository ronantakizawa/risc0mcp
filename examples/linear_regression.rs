// Simple linear regression with zero-knowledge proof
// This performs linear regression (y = mx + b) on a dataset without revealing the data
use risc0_zkvm::guest::env;

fn main() {
    // Read input from the host - expects:
    // {
    //   "x_values": [1, 2, 3, 4, 5],
    //   "y_values": [2, 4, 6, 8, 10],
    //   "predict_x": 6
    // }
    let inputs_json: String = env::read();
    
    let result = if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&inputs_json) {
        if let (
            Some(x_values),
            Some(y_values),
            Some(predict_x)
        ) = (
            parsed.get("x_values").and_then(|v| v.as_array()),
            parsed.get("y_values").and_then(|v| v.as_array()),
            parsed.get("predict_x").and_then(|v| v.as_f64())
        ) {
            // Convert arrays to Vec<f64>
            let x_data: Result<Vec<f64>, _> = x_values
                .iter()
                .map(|v| v.as_f64().ok_or("Invalid x value"))
                .collect();
            
            let y_data: Result<Vec<f64>, _> = y_values
                .iter()
                .map(|v| v.as_f64().ok_or("Invalid y value"))
                .collect();
            
            match (x_data, y_data) {
                (Ok(x), Ok(y)) => {
                    if x.len() == y.len() && x.len() > 1 {
                        let prediction = linear_regression_predict(&x, &y, predict_x);
                        // Scale to integer for commitment (multiply by 1000 for precision)
                        (prediction * 1000.0) as i64
                    } else {
                        -1 // Mismatched or insufficient data
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
    
    // Commit the prediction result (scaled by 1000)
    // Note: The training data remains private!
    env::commit(&result);
}

// Perform linear regression and make a prediction
fn linear_regression_predict(x_data: &[f64], y_data: &[f64], predict_x: f64) -> f64 {
    let n = x_data.len() as f64;
    
    // Calculate means
    let x_mean = x_data.iter().sum::<f64>() / n;
    let y_mean = y_data.iter().sum::<f64>() / n;
    
    // Calculate slope (m) and intercept (b)
    let mut numerator = 0.0;
    let mut denominator = 0.0;
    
    for i in 0..x_data.len() {
        let x_diff = x_data[i] - x_mean;
        let y_diff = y_data[i] - y_mean;
        numerator += x_diff * y_diff;
        denominator += x_diff * x_diff;
    }
    
    let slope = if denominator != 0.0 { numerator / denominator } else { 0.0 };
    let intercept = y_mean - slope * x_mean;
    
    // Make prediction: y = mx + b
    slope * predict_x + intercept
}