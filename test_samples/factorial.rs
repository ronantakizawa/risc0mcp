fn main() {
    let n = 5;
    let mut result = 1;
    
    for i in 1..=n {
        result *= i;
    }
    
    println!("{}! = {}", n, result);
}