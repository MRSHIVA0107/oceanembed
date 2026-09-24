"""
OceanEmbed Training Engine
Trains Core-6 and Core-7 models on chronological split:
- Train: June 1 - July 31, 2023 (61 daily timesteps)
- Val:   August 1 - August 15, 2023 (15 daily timesteps)
- Test:  August 16 - August 31, 2023 (16 daily timesteps)
"""
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
import numpy as np
import os
import json

from src.data.dataset import OceanDataset
from src.models.model import OceanEmbedEncoderDecoder
from src.physics.losses import OceanEmbedCompositeLoss, weighted_mse_loss

def train_model(data_dir="data/processed", channels="core-6", epochs=18, batch_size=4, lr=1e-3, device="cpu"):
    print(f"\n================ STARTING TRAINING: {channels.upper()} ================")
    
    # 1. Load Data
    train_ds = OceanDataset(data_dir, split="train", channels=channels)
    val_ds = OceanDataset(data_dir, split="val", channels=channels)
    test_ds = OceanDataset(data_dir, split="test", channels=channels)
    
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)
    test_loader = DataLoader(test_ds, batch_size=1, shuffle=False)
    
    in_channels = 6 if channels == "core-6" else 7
    model = OceanEmbedEncoderDecoder(in_channels=in_channels, sigma_train=train_ds.sigma_train).to(device)
    
    criterion = OceanEmbedCompositeLoss(lambda_surf=1.0, lambda_smooth=0.001).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-5)
    
    best_val_loss = float("inf")
    save_dir = "data/checkpoints"
    os.makedirs(save_dir, exist_ok=True)
    best_ckpt_path = os.path.join(save_dir, f"oceanembed_{channels}_best.pth")
    
    for epoch in range(1, epochs + 1):
        model.train()
        train_loss_accum = 0.0
        train_mse_accum = 0.0
        train_surf_accum = 0.0
        train_curv_accum = 0.0
        
        for batch in train_loader:
            x = batch["x"].to(device)
            y = batch["y"].to(device)
            t_clim = batch["t_clim"].to(device)
            mask = batch["mask"].to(device)
            sst = x[:, 0:1] # [B, 1, H, W]
            
            optimizer.zero_grad()
            t_pred, _ = model(x, t_clim)
            
            loss_dict = criterion(t_pred, y, sst, mask)
            loss = loss_dict["loss"]
            loss.backward()
            optimizer.step()
            
            train_loss_accum += loss.item()
            train_mse_accum += loss_dict["loss_mse"].item()
            train_surf_accum += loss_dict["loss_surf"].item()
            train_curv_accum += loss_dict["loss_curv"].item()
            
        scheduler.step()
        n_batches = len(train_loader)
        
        # Validation Pass
        model.eval()
        val_loss_accum = 0.0
        with torch.no_grad():
            for batch in val_loader:
                x = batch["x"].to(device)
                y = batch["y"].to(device)
                t_clim = batch["t_clim"].to(device)
                mask = batch["mask"].to(device)
                sst = x[:, 0:1]
                
                t_pred, _ = model(x, t_clim)
                loss_dict = criterion(t_pred, y, sst, mask)
                val_loss_accum += loss_dict["loss"].item()
                
        val_loss = val_loss_accum / len(val_loader)
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "val_loss": val_loss,
                "sigma_train": train_ds.sigma_train,
                "channels": channels
            }, best_ckpt_path)
            saved_str = "*"
        else:
            saved_str = " "
            
        if epoch % 3 == 0 or epoch == epochs or saved_str == "*":
            print(f"Epoch {epoch:02d}/{epochs:02d} | Train Loss: {train_loss_accum/n_batches:.4f} (MSE: {train_mse_accum/n_batches:.4f}, Surf: {train_surf_accum/n_batches:.4f}, Curv: {train_curv_accum/n_batches:.4f}) | Val Loss: {val_loss:.4f} {saved_str}")

    print(f"Training completed. Best model saved to: {best_ckpt_path}")
    
    # Evaluate on Held-Out Test Set (August 16-31)
    print(f"\nEvaluating Best Model on Held-Out Test Block (16 days)...")
    checkpoint = torch.load(best_ckpt_path, map_location=device, weights_only=False)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()
    
    test_preds = []
    test_uncertainties = []
    test_trues = []
    test_clims = []
    
    with torch.no_grad():
        for batch in test_loader:
            x = batch["x"].to(device)
            y = batch["y"].to(device)
            t_clim = batch["t_clim"].to(device)
            
            # Predict with MC Dropout
            mean_p, std_p = model.predict_with_uncertainty(x, t_clim, n_samples=10)
            
            test_preds.append(mean_p.cpu().numpy()[0])
            test_uncertainties.append(std_p.cpu().numpy()[0])
            test_trues.append(y.cpu().numpy()[0])
            test_clims.append(t_clim.cpu().numpy()[0])
            
    test_preds = np.array(test_preds)              # [16, 6, 68, 60]
    test_uncertainties = np.array(test_uncertainties) # [16, 6, 68, 60]
    test_trues = np.array(test_trues)              # [16, 6, 68, 60]
    test_clims = np.array(test_clims)              # [16, 6, 68, 60]
    mask = test_ds.mask                            # [68, 60]
    
    # Save test predictions for API / Dashboard
    pred_dir = "data/processed/predictions"
    os.makedirs(pred_dir, exist_ok=True)
    np.save(os.path.join(pred_dir, f"preds_{channels}_test.npy"), test_preds)
    np.save(os.path.join(pred_dir, f"uncertainties_{channels}_test.npy"), test_uncertainties)
    
    # Compute Held-Out Metrics
    print(f"\n================ TEST METRICS: {channels.upper()} ================")
    depth_names = ["0m (SST)", "50m (Upper TC)", "100m (TC Core)", "200m (Lower TC)", "500m (Intermediate)", "1000m (Deep)"]
    valid_count = mask.sum() * len(test_ds)
    
    depth_rmses = []
    depth_skill_scores = []
    
    tc_mse_model = 0.0
    tc_mse_clim = 0.0
    
    for k in range(6):
        sq_err_model = (test_preds[:, k] - test_trues[:, k])**2
        sq_err_clim = (test_clims[:, k] - test_trues[:, k])**2
        
        mse_m = np.sum(sq_err_model * mask) / (valid_count + 1e-6)
        mse_c = np.sum(sq_err_clim * mask) / (valid_count + 1e-6)
        
        rmse = np.sqrt(mse_m)
        ss = 1.0 - (mse_m / (mse_c + 1e-6))
        
        depth_rmses.append(rmse)
        depth_skill_scores.append(ss)
        
        if k in [1, 2, 3]: # Thermocline depths: 50, 100, 200m
            tc_mse_model += np.sum(sq_err_model * mask)
            tc_mse_clim += np.sum(sq_err_clim * mask)
            
        print(f"{depth_names[k]:<22} | RMSE: {rmse:.4f}°C | Skill Score: {ss:.4f}")
        
    ss_tc = 1.0 - (tc_mse_model / (tc_mse_clim + 1e-6))
    overall_mse_m = np.sum([(test_preds[:, k] - test_trues[:, k])**2 * mask for k in range(6)])
    overall_mse_c = np.sum([(test_clims[:, k] - test_trues[:, k])**2 * mask for k in range(6)])
    ss_overall = 1.0 - (overall_mse_m / (overall_mse_c + 1e-6))
    
    print("-" * 55)
    print(f"Mean Thermocline (50-200m) RMSE: {np.mean(depth_rmses[1:4]):.4f}°C")
    print(f"Thermocline Skill Score (SS_TC): {ss_tc:.4f}")
    print(f"Overall Skill Score (SS_overall): {ss_overall:.4f}")
    print("====================================================\n")
    
    return {
        "depth_rmses": depth_rmses,
        "depth_skill_scores": depth_skill_scores,
        "ss_tc": ss_tc,
        "ss_overall": ss_overall
    }

if __name__ == "__main__":
    train_model(channels="core-6", epochs=15)
