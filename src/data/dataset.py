"""
OceanEmbed PyTorch Dataset & Chronological Data Splitter
Strict temporal discipline: Climatology prior and sigma_train computed EXCLUSIVELY on training partition (June 1 - July 31, 2023).
Held-out test period (August 16 - 31, 2023) is strictly shielded.
"""
import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader
import json
import os

class OceanDataset(Dataset):
    def __init__(self, data_dir="data/processed", split="train", channels="core-6"):
        super().__init__()
        self.data_dir = data_dir
        self.split = split
        self.channels = channels
        
        # Load raw generated arrays
        surface_inputs = np.load(os.path.join(data_dir, "surface_inputs_92d.npy")) # [92, 7, 68, 60]
        glorys_targets = np.load(os.path.join(data_dir, "glorys_targets_92d.npy")) # [92, 6, 68, 60]
        self.mask = np.load(os.path.join(data_dir, "ocean_mask.npy"))             # [68, 60]
        
        with open(os.path.join(data_dir, "dates.json"), "r") as f:
            self.all_dates = json.load(f)
            
        # Chronological Split Indices:
        # Train: Days 0..60 (61 days, June 1 - July 31)
        # Val:   Days 61..75 (15 days, August 1 - August 15)
        # Test:  Days 76..91 (16 days, August 16 - August 31)
        if split == "train":
            self.indices = list(range(0, 61))
        elif split == "val":
            self.indices = list(range(61, 76))
        elif split == "test":
            self.indices = list(range(76, 92))
        elif split == "all":
            self.indices = list(range(0, 92))
        else:
            raise ValueError(f"Unknown split: {split}")
            
        # Calculate training statistics strictly from the training period (days 0..60)
        train_targets = glorys_targets[0:61] # [61, 6, 68, 60]
        
        # Climatological Prior: Monthly mean over training days only!
        # June = days 0..29 (30 days); July = days 30..60 (31 days)
        june_targets = glorys_targets[0:30]
        july_targets = glorys_targets[30:61]
        
        # Climatology prior array: month 0 (June), month 1 (July/Aug prior)
        self.clim_prior = np.zeros((2, 6, 68, 60), dtype=np.float32)
        self.clim_prior[0] = np.mean(june_targets, axis=0) * self.mask
        self.clim_prior[1] = np.mean(july_targets, axis=0) * self.mask
        
        # Training Standard Deviation per depth level with valid-sample denominator
        # sigma_train_k = sqrt( sum( M * (T - T_clim)^2 ) / sum( M ) )
        self.sigma_train = np.zeros(6, dtype=np.float32)
        valid_pixel_count = self.mask.sum() * 61
        
        for k in range(6):
            sq_diff_sum = 0.0
            for t in range(61):
                m_idx = 0 if t < 30 else 1
                diff = (train_targets[t, k] - self.clim_prior[m_idx, k]) * self.mask
                sq_diff_sum += np.sum(diff ** 2)
            self.sigma_train[k] = np.sqrt(sq_diff_sum / (valid_pixel_count + 1e-6))
            
        # Also compute SST training dispersion (sigma_SST_train)
        train_sst = surface_inputs[0:61, 0] * self.mask
        mu_sst = train_sst.sum() / valid_pixel_count
        self.sigma_sst_train = float(np.sqrt(np.sum((train_sst - mu_sst)**2 * self.mask) / valid_pixel_count))
        
        # Channel Selection
        # Core-6: [SST, SLA, U_cur, V_cur, U_wind, V_wind] (channels 0..5)
        # Core-7: [SST, SLA, U_cur, V_cur, U_wind, V_wind, SSS] (channels 0..6)
        if channels == "core-6":
            self.inputs = surface_inputs[self.indices, :6]
        elif channels == "core-7":
            self.inputs = surface_inputs[self.indices, :7]
        else:
            raise ValueError(f"Unknown channel config: {channels}")
            
        self.targets = glorys_targets[self.indices]
        self.dates = [self.all_dates[i] for i in self.indices]

    def __len__(self):
        return len(self.indices)

    def __getitem__(self, idx):
        global_idx = self.indices[idx]
        month_idx = 0 if global_idx < 30 else 1
        
        x = torch.from_numpy(self.inputs[idx]).float()
        y = torch.from_numpy(self.targets[idx]).float()
        t_clim = torch.from_numpy(self.clim_prior[month_idx]).float()
        mask = torch.from_numpy(self.mask).float().unsqueeze(0) # [1, 68, 60]
        
        return {
            "x": x,                     # [C_in, 68, 60]
            "y": y,                     # [6, 68, 60] in Celsius
            "t_clim": t_clim,           # [6, 68, 60] spatially varying climatology
            "mask": mask,               # [1, 68, 60]
            "date": self.dates[idx],
            "month_idx": month_idx
        }

if __name__ == "__main__":
    train_ds = OceanDataset("C:/Users/DELL/.gemini/antigravity/scratch/oceanembed/data/processed", split="train")
    val_ds = OceanDataset("C:/Users/DELL/.gemini/antigravity/scratch/oceanembed/data/processed", split="val")
    test_ds = OceanDataset("C:/Users/DELL/.gemini/antigravity/scratch/oceanembed/data/processed", split="test")
    
    print(f"Dataset Splits Verified:")
    print(f"  Train samples: {len(train_ds)} (June 1 - July 31)")
    print(f"  Val samples:   {len(val_ds)} (August 1 - August 15)")
    print(f"  Test samples:  {len(test_ds)} (August 16 - August 31)")
    print(f"  Training sigma_train per depth: {np.round(train_ds.sigma_train, 4).tolist()} degC")
    print(f"  Training sigma_SST_train:       {train_ds.sigma_sst_train:.4f} degC")
