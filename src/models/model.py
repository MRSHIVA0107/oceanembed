"""
OceanEmbed Core Neural Architecture
- Residual Encoder-Decoder with exact target-size bilinear interpolation (68 x 60)
- Depth-Conditioned 1x1 Projection Head (81 channels: 64 spatial features + 16 depth embedding + 1 spatial climatology prior)
- Monte Carlo Dropout Epistemic Uncertainty Engine
"""
import torch
import torch.nn as nn
import torch.nn.functional as F

class ResBlock(nn.Module):
    def __init__(self, channels):
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(channels)
        self.relu = nn.ReLU(inplace=True)
        self.conv2 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(channels)
        self.dropout = nn.Dropout2d(p=0.10)

    def forward(self, x):
        residual = x
        out = self.relu(self.bn1(self.conv1(x)))
        out = self.dropout(out)
        out = self.bn2(self.conv2(out))
        out += residual
        return self.relu(out)

class OceanEmbedEncoderDecoder(nn.Module):
    def __init__(self, in_channels=6, sigma_train=None):
        super().__init__()
        self.in_channels = in_channels
        
        # Default sigma_train if not provided
        if sigma_train is None:
            self.register_buffer("sigma_train", torch.tensor([0.2138, 0.3394, 0.2954, 0.1828, 0.0816, 0.0395], dtype=torch.float32))
        else:
            self.register_buffer("sigma_train", torch.tensor(sigma_train, dtype=torch.float32))

        # 1. Encoder (adapted input conv with variance scaling)
        self.in_conv = nn.Sequential(
            nn.Conv2d(in_channels, 32, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True)
        )
        self.res1 = ResBlock(32)
        self.down1 = nn.Sequential(
            nn.Conv2d(32, 64, kernel_size=3, stride=2, padding=1, bias=False),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True)
        ) # 34 x 30
        
        self.res2 = ResBlock(64)
        self.down2 = nn.Sequential(
            nn.Conv2d(64, 128, kernel_size=3, stride=2, padding=1, bias=False),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True)
        ) # 17 x 15
        
        self.res3 = ResBlock(128)
        self.down3 = nn.Sequential(
            nn.Conv2d(128, 128, kernel_size=3, stride=2, padding=1, bias=False),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True)
        ) # 9 x 8 (Bottleneck)
        
        self.bottleneck = ResBlock(128)

        # 2. Decoder with Target-Size Bilinear Alignment
        self.up1 = nn.Conv2d(128, 128, kernel_size=3, padding=1)
        self.dec_res1 = ResBlock(128) # Cat with skip res2 (128 + 128 -> 128)
        self.skip1_conv = nn.Conv2d(256, 128, kernel_size=1)

        self.up2 = nn.Conv2d(128, 64, kernel_size=3, padding=1)
        self.dec_res2 = ResBlock(64) # Cat with skip res1 (64 + 64 -> 64)
        self.skip2_conv = nn.Conv2d(128, 64, kernel_size=1)

        self.up3 = nn.Conv2d(64, 64, kernel_size=3, padding=1)
        self.dec_res3 = ResBlock(64)

        # 3. Depth Conditioned Projection Head
        # 6 Depth Embedding Vectors (16-d each)
        self.depth_embeddings = nn.Embedding(6, 16)
        
        # Per-depth MLP: 64 (spatial feature) + 16 (depth emb) + 1 (spatial climatology prior) + in_channels (surface forcings)
        head_in = 64 + 16 + 1 + in_channels
        self.head_mlp = nn.Sequential(
            nn.Conv2d(head_in, 64, kernel_size=1),
            nn.GELU(),
            nn.Dropout2d(p=0.10),
            nn.Conv2d(64, 32, kernel_size=1),
            nn.GELU(),
            nn.Conv2d(32, 1, kernel_size=1) # Dimensionless anomaly ΔT_norm
        )

    def forward(self, x, t_clim):
        """
        x:      [B, C_in, 68, 60] multi-source surface tensor
        t_clim: [B, 6, 68, 60] spatially varying monthly climatology prior
        Returns:
          t_pred: [B, 6, 68, 60] physical temperature predictions in Celsius
          anom_pred: [B, 6, 68, 60] dimensionless normalized anomalies
        """
        B, _, H, W = x.shape
        
        # --- Encoder ---
        e0 = self.in_conv(x)      # [B, 32, 68, 60]
        e0 = self.res1(e0)
        e1 = self.down1(e0)       # [B, 64, 34, 30]
        e1 = self.res2(e1)
        e2 = self.down2(e1)       # [B, 128, 17, 15]
        e2 = self.res3(e2)
        b = self.down3(e2)        # [B, 128, 9, 8]
        b = self.bottleneck(b)

        # --- Decoder with Target-Size Alignment ---
        # Stage 1: align to e2 shape (17 x 15)
        d1 = F.interpolate(b, size=e2.shape[-2:], mode="bilinear", align_corners=False)
        d1 = self.up1(d1)
        d1 = torch.cat([d1, e2], dim=1) # [B, 256, 17, 15]
        d1 = self.skip1_conv(d1)
        d1 = self.dec_res1(d1)

        # Stage 2: align to e1 shape (34 x 30)
        d2 = F.interpolate(d1, size=e1.shape[-2:], mode="bilinear", align_corners=False)
        d2 = self.up2(d2)
        d2 = torch.cat([d2, e1], dim=1) # [B, 128, 34, 30]
        d2 = self.skip2_conv(d2)
        d2 = self.dec_res2(d2)

        # Stage 3: align to input shape (68 x 60)
        d3 = F.interpolate(d2, size=(H, W), mode="bilinear", align_corners=False)
        d3 = self.up3(d3)
        F_spatial = self.dec_res3(d3) # [B, 64, 68, 60]

        # --- Depth Projection Head ---
        t_pred_levels = []
        anom_pred_levels = []
        
        for k in range(6):
            # 16-d depth vector broadcast to spatial grid
            d_vec = self.depth_embeddings(torch.tensor(k, device=x.device)) # [16]
            d_map = d_vec.view(1, 16, 1, 1).expand(B, 16, H, W)
            
            # 1-channel spatial climatology prior
            clim_k = t_clim[:, k:k+1, :, :] # [B, 1, H, W]
            
            # Concatenate [F_spatial (64) + d_map (16) + clim_k (1) + x (C_in)]
            phi_k = torch.cat([F_spatial, d_map, clim_k, x], dim=1)
            
            # 1x1 MLP outputs normalized anomaly
            delta_t_norm = self.head_mlp(phi_k) # [B, 1, H, W]
            anom_pred_levels.append(delta_t_norm)
            
            # Physical de-standardization into Celsius
            t_phys = clim_k + self.sigma_train[k] * delta_t_norm
            t_pred_levels.append(t_phys)

        t_pred = torch.cat(t_pred_levels, dim=1)       # [B, 6, 68, 60]
        anom_pred = torch.cat(anom_pred_levels, dim=1) # [B, 6, 68, 60]
        
        return t_pred, anom_pred

    def predict_with_uncertainty(self, x, t_clim, n_samples=10):
        """
        Monte Carlo Dropout Inference Protocol
        Freezes BatchNorm in eval() mode, enables ONLY Dropout layers.
        Returns:
          mean_pred: [B, 6, 68, 60] ensemble mean in Celsius
          epistemic_std: [B, 6, 68, 60] epistemic uncertainty standard deviation
        """
        self.eval()
        # Enable ONLY dropout
        for m in self.modules():
            if isinstance(m, (nn.Dropout, nn.Dropout2d)):
                m.train()
                
        samples = []
        with torch.no_grad():
            for s in range(n_samples):
                t_p, _ = self.forward(x, t_clim)
                samples.append(t_p)
                
        # Stack: [n_samples, B, 6, 68, 60]
        samples = torch.stack(samples, dim=0)
        mean_pred = torch.mean(samples, dim=0)
        epistemic_std = torch.std(samples, dim=0, unbiased=True)
        
        # Restore full eval mode
        self.eval()
        return mean_pred, epistemic_std

if __name__ == "__main__":
    # Smoke Test
    model = OceanEmbedEncoderDecoder(in_channels=6)
    dummy_x = torch.randn(2, 6, 68, 60)
    dummy_clim = torch.randn(2, 6, 68, 60)
    
    t_pred, anom = model(dummy_x, dummy_clim)
    print("Forward Smoke Test Passed:")
    print(f"  Input shape:  {dummy_x.shape}")
    print(f"  Output shape: {t_pred.shape} (Expected: [2, 6, 68, 60])")
    
    mean_p, std_p = model.predict_with_uncertainty(dummy_x, dummy_clim, n_samples=5)
    print(f"  MC Dropout Mean: {mean_p.shape}, Uncertainty: {std_p.shape}")
