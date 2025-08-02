// K-means clustering with zero-knowledge proof
// This performs k-means clustering on data points without revealing the data
use risc0_zkvm::guest::env;

fn main() {
    // Read input from the host - expects:
    // {
    //   "data_points": [[1.0, 2.0], [2.0, 1.0], [8.0, 9.0], [9.0, 8.0]],
    //   "k": 2,
    //   "max_iterations": 10,
    //   "query_point": [1.5, 1.8]
    // }
    let inputs_json: String = env::read();
    
    let result = if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&inputs_json) {
        if let (
            Some(data_points),
            Some(k),
            Some(max_iterations),
            Some(query_point)
        ) = (
            parsed.get("data_points").and_then(|v| v.as_array()),
            parsed.get("k").and_then(|v| v.as_i64()),
            parsed.get("max_iterations").and_then(|v| v.as_i64()),
            parsed.get("query_point").and_then(|v| v.as_array())
        ) {
            // Convert data points to Vec<Vec<f64>>
            let points: Result<Vec<Vec<f64>>, _> = data_points
                .iter()
                .map(|point| {
                    if let Some(coords) = point.as_array() {
                        coords.iter()
                            .map(|coord| coord.as_f64().ok_or("Invalid coordinate"))
                            .collect()
                    } else {
                        Err("Invalid point format")
                    }
                })
                .collect();
            
            // Convert query point
            let query: Result<Vec<f64>, _> = query_point
                .iter()
                .map(|v| v.as_f64().ok_or("Invalid query coordinate"))
                .collect();
            
            match (points, query) {
                (Ok(data), Ok(q_point)) => {
                    if !data.is_empty() && k > 0 && k <= data.len() as i64 {
                        let cluster_assignment = k_means_classify(&data, k as usize, max_iterations as usize, &q_point);
                        cluster_assignment
                    } else {
                        -1 // Invalid parameters
                    }
                },
                _ => -2 // Invalid data format
            }
        } else {
            -3 // Missing required fields
        }
    } else {
        -4 // JSON parse error
    };
    
    // Commit the cluster assignment for the query point
    // Note: The training data and cluster centroids remain private!
    env::commit(&result);
}

// Perform K-means clustering and classify a query point
fn k_means_classify(data: &[Vec<f64>], k: usize, max_iterations: usize, query_point: &[f64]) -> i64 {
    if data.is_empty() || k == 0 || data[0].len() != query_point.len() {
        return -1;
    }
    
    let dimensions = data[0].len();
    let n_points = data.len();
    
    // Initialize centroids (use first k data points)
    let mut centroids: Vec<Vec<f64>> = Vec::new();
    for i in 0..k.min(n_points) {
        centroids.push(data[i].clone());
    }
    
    // K-means iterations
    for _iteration in 0..max_iterations {
        // Assign points to clusters
        let mut cluster_assignments = vec![0; n_points];
        let mut cluster_changed = false;
        
        for (point_idx, point) in data.iter().enumerate() {
            let mut best_cluster = 0;
            let mut best_distance = euclidean_distance(point, &centroids[0]);
            
            for (cluster_idx, centroid) in centroids.iter().enumerate().skip(1) {
                let distance = euclidean_distance(point, centroid);
                if distance < best_distance {
                    best_distance = distance;
                    best_cluster = cluster_idx;
                }
            }
            
            if cluster_assignments[point_idx] != best_cluster {
                cluster_changed = true;
            }
            cluster_assignments[point_idx] = best_cluster;
        }
        
        // Update centroids
        let mut new_centroids = vec![vec![0.0; dimensions]; k];
        let mut cluster_counts = vec![0; k];
        
        for (point_idx, point) in data.iter().enumerate() {
            let cluster = cluster_assignments[point_idx];
            cluster_counts[cluster] += 1;
            for dim in 0..dimensions {
                new_centroids[cluster][dim] += point[dim];
            }
        }
        
        for cluster in 0..k {
            if cluster_counts[cluster] > 0 {
                for dim in 0..dimensions {
                    new_centroids[cluster][dim] /= cluster_counts[cluster] as f64;
                }
            }
        }
        
        centroids = new_centroids;
        
        // Early termination if converged
        if !cluster_changed {
            break;
        }
    }
    
    // Classify the query point
    let mut best_cluster = 0;
    let mut best_distance = euclidean_distance(query_point, &centroids[0]);
    
    for (cluster_idx, centroid) in centroids.iter().enumerate().skip(1) {
        let distance = euclidean_distance(query_point, centroid);
        if distance < best_distance {
            best_distance = distance;
            best_cluster = cluster_idx;
        }
    }
    
    best_cluster as i64
}

// Calculate Euclidean distance between two points
fn euclidean_distance(point1: &[f64], point2: &[f64]) -> f64 {
    if point1.len() != point2.len() {
        return f64::INFINITY;
    }
    
    let mut sum_squares = 0.0;
    for i in 0..point1.len() {
        let diff = point1[i] - point2[i];
        sum_squares += diff * diff;
    }
    
    sum_squares.sqrt()
}