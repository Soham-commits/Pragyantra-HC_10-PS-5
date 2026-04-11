import onnx
import os

def inspect_model(model_path):
    print(f"\n{'='*80}")
    print(f"Inspecting Model: {os.path.basename(model_path)}")
    print(f"{'='*80}")
    
    try:
        model = onnx.load(model_path)
    except Exception as e:
        print(f"Error loading model: {e}")
        return

    graph = model.graph
    
    print(f"{'Node Name':<60} | {'Op Type':<15} | {'Output Tensor'}")
    print("-" * 100)
    
    last_conv_node = None
    
    for i, node in enumerate(graph.node):
        print(f"{node.name or f'node_{i}':<60} | {node.op_type:<15} | {', '.join(node.output)}")
        
        if node.op_type == 'Conv':
            last_conv_node = node
            
    print("-" * 100)
    if last_conv_node:
        print(f"\nPotential Last Conv Layer for Grad-CAM: {last_conv_node.name}")
        print(f"Op Type: {last_conv_node.op_type}")
        print(f"Outputs: {', '.join(last_conv_node.output)}")
    else:
        print("\nNo Conv layers found in the model.")

if __name__ == "__main__":
    models = [
        "backend/model/mediq_skin_screening_densenet121.onnx",
        "backend/model/chest_xray_screening_model.onnx"
    ]
    
    # Adjust paths if running from backend folder
    current_dir = os.getcwd()
    for model_path in models:
        # Check if we are in the root or backend folder
        full_path = os.path.join(current_dir, model_path)
        if not os.path.exists(full_path):
            # Try relative to backend
            alt_path = model_path.replace("backend/", "")
            full_path = os.path.join(current_dir, alt_path)
            
        inspect_model(full_path)
