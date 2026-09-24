"""
OceanEmbed Physics-Informed Loss Suite
Implements:
1. Masked Normalized Depth-Weighted Reconstruction Loss (independent denominators per depth)
2. Masked Soft Surface SST Regularizer (zero-indexed surface z_0 = 0 m)
3. Masked Dimensionally Scaled Non-Uniform Vertical Curvature Loss (3-level stencil intersection)
"""
import torch
import torch.nn as nn

def weighted_mse_loss(t_pred, t_target, mask, weights=None):
    if weights is None:
        w = torch.tensor([0.5714, 1.7143, 1.7143, 1.1429, 0.5714, 0.2857], device=t_pred.device, dtype=t_pred.dtype)
    else:
        w = torch.tensor(weights, device=t_pred.device, dtype=t_pred.dtype)
        w = w / w.mean()

    if mask.dim() == 3:
        mask = mask.unsqueeze(1)
    if mask.shape[1] == 1:
        mask = mask.expand(-1, 6, -1, -1)

    diff_sq = (t_pred - t_target) ** 2
    
    total_loss = 0.0
    for k in range(6):
        k_valid = mask[:, k]
        k_num = (diff_sq[:, k] * k_valid).sum()
        k_denom = k_valid.sum() + 1e-6
        total_loss = total_loss + w[k] * (k_num / k_denom)
        
    return total_loss

def surface_sst_loss(t_pred_surface, sst_ostia, mask_surface):
    if t_pred_surface.dim() == 4:
        t_pred_surface = t_pred_surface[:, 0]
    if sst_ostia.dim() == 4:
        sst_ostia = sst_ostia[:, 0]
    if mask_surface.dim() == 4:
        mask_surface = mask_surface[:, 0]

    abs_diff = torch.abs(t_pred_surface - sst_ostia)
    valid_sum = mask_surface.sum() + 1e-6
    return (abs_diff * mask_surface).sum() / valid_sum

def nonuniform_vertical_curvature_loss(t_pred, depths_m=None, mask=None, z_scale=100.0):
    if depths_m is None:
        depths_m = torch.tensor([0.0, 50.0, 100.0, 200.0, 500.0, 1000.0], device=t_pred.device, dtype=t_pred.dtype)
    elif isinstance(depths_m, list):
        depths_m = torch.tensor(depths_m, device=t_pred.device, dtype=t_pred.dtype)

    z = depths_m / z_scale
    h_back = (z[1:-1] - z[:-2]).view(1, -1, 1, 1)
    h_forward = (z[2:] - z[1:-1]).view(1, -1, 1, 1)

    t_back = t_pred[:, :-2, :, :]
    t_mid = t_pred[:, 1:-1, :, :]
    t_forward = t_pred[:, 2:, :, :]

    grad_back = (t_mid - t_back) / h_back
    grad_forward = (t_forward - t_mid) / h_forward

    curvature = 2.0 * (grad_forward - grad_back) / (h_back + h_forward)
    curv_sq = curvature.square()

    if mask is not None:
        if mask.dim() == 3:
            mask = mask.unsqueeze(1).expand_as(t_pred)
        elif mask.shape[1] == 1:
            mask = mask.expand(-1, 6, -1, -1)
            
        curv_mask = mask[:, :-2] * mask[:, 1:-1] * mask[:, 2:]
        valid_sum = curv_mask.sum() + 1e-6
        return (curv_sq * curv_mask).sum() / valid_sum
        
    return curv_sq.mean()

class OceanEmbedCompositeLoss(nn.Module):
    def __init__(self, lambda_surf=1.0, lambda_smooth=0.001, z_scale=100.0):
        super().__init__()
        self.lambda_surf = lambda_surf
        self.lambda_smooth = lambda_smooth
        self.z_scale = z_scale
        
    def forward(self, t_pred, t_target, sst_ostia, mask):
        l_mse = weighted_mse_loss(t_pred, t_target, mask)
        l_surf = surface_sst_loss(t_pred[:, 0], sst_ostia, mask)
        l_curv = nonuniform_vertical_curvature_loss(t_pred, mask=mask, z_scale=self.z_scale)
        l_total = l_mse + self.lambda_surf * l_surf + self.lambda_smooth * l_curv
        return {
            "loss": l_total,
            "loss_mse": l_mse,
            "loss_surf": l_surf,
            "loss_curv": l_curv
        }
