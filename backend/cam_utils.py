import os
import torch
import torch.nn.functional as F
import numpy as np
from model_utils import IMG_SIZE, stitch_predictions, IMAGENET_MEAN, IMAGENET_STD

def generate_gradcam_with_preds(model, clin_tensor, derm_tensor, target_class_idx=None):
    """
    Generate Grad-CAM heatmap AND return predictions.
    Strategy: If on MPS, do prediction on MPS (fast), then Grad-CAM on CPU (to avoid OOM).
    Returns: (probs tensor, cam numpy array)
    """
    # Original device
    original_device = next(model.parameters()).device
    use_cpu_for_gradcam = (original_device.type == 'mps')
    
    model.eval()
    
    # Step 1: Fast prediction on original device (MPS or CUDA)
    with torch.no_grad():
        l_grp, l_mel, l_oth = model(clin_tensor, derm_tensor)
        probs = stitch_predictions(l_grp, l_mel, l_oth)
    
    if target_class_idx is None:
        target_class_idx = probs.argmax().item()
    
    # Step 2: Grad-CAM on CPU if MPS (to avoid OOM)
    if use_cpu_for_gradcam:
        print("⚠️ Running Grad-CAM on CPU to avoid MPS OOM...")
        model.to('cpu')
        clin_cpu = clin_tensor.to('cpu')
        derm_cpu = derm_tensor.to('cpu')
        if original_device.type == 'mps':
            torch.mps.empty_cache()
    else:
        clin_cpu = clin_tensor
        derm_cpu = derm_tensor
    
    # Enable gradients
    derm_cpu.requires_grad_(True)
    
    # Hooks
    gradients = []
    activations = []
    
    def backward_hook(module, grad_input, grad_output):
        gradients.append(grad_output[0])
    
    def forward_hook(module, input, output):
        activations.append(output)
    
    target_layer = model.derm.blocks[-1]
    h1 = target_layer.register_forward_hook(forward_hook)
    h2 = target_layer.register_full_backward_hook(backward_hook)
    
    try:
        # Forward for Grad-CAM
        l_grp, l_mel, l_oth = model(clin_cpu, derm_cpu)
        probs_gradcam = stitch_predictions(l_grp, l_mel, l_oth)
        
        # Backward
        model.zero_grad()
        score = probs_gradcam[0, target_class_idx]
        score.backward()
        
        # Compute CAM
        grads = gradients[0]
        acts = activations[0]
        weights = torch.mean(grads, dim=[2, 3], keepdim=True)
        cam = torch.sum(weights * acts, dim=1, keepdim=True)
        cam = F.relu(cam)
        cam = cam - cam.min()
        cam = cam / (cam.max() + 1e-7)
        cam = F.interpolate(cam, size=(IMG_SIZE, IMG_SIZE), mode='bilinear', align_corners=False)
        
        cam_array = cam[0, 0].detach().cpu().numpy()
        
        # Move model back to original device if needed
        if use_cpu_for_gradcam:
            model.to(original_device)
            del clin_cpu, derm_cpu
        
        return probs.detach(), cam_array
        
    finally:
        h1.remove()
        h2.remove()
        derm_cpu.requires_grad_(False)
        gradients.clear()
        activations.clear()
        if original_device.type == 'mps':
            torch.mps.empty_cache()

def save_heatmap_overlay(original_tensor, cam_array, heatmap_dir, filename):
    """
    Overlay heatmap on original image and save to disk.
    """
    import matplotlib
    matplotlib.use('Agg')  # Non-interactive backend
    import matplotlib.pyplot as plt
    import matplotlib.cm as cm
    
    # Denormalize original image
    mean = torch.tensor(IMAGENET_MEAN).view(3, 1, 1)
    std = torch.tensor(IMAGENET_STD).view(3, 1, 1)
    img = original_tensor[0].cpu() * std + mean
    img = img.clamp(0, 1).permute(1, 2, 0).numpy()
    
    # Create heatmap overlay
    heatmap = cm.jet(cam_array)[:, :, :3]  # RGB only
    
    # Blend
    overlay = 0.5 * img + 0.5 * heatmap
    overlay = np.clip(overlay, 0, 1)
    
    # Save
    filepath = os.path.join(heatmap_dir, filename)
    plt.imsave(filepath, overlay)
    
    return filename
