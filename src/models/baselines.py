"""
OceanEmbed Baseline Models Suite
1. Climatology Prior Baseline (Reference SS = 0.00)
2. SST-Only Linear Regression Baseline
3. Multi-Source Tabular Regressor Baseline (Ridge / Tree Regression)
"""
import numpy as np
from sklearn.linear_model import Ridge, LinearRegression
from sklearn.ensemble import HistGradientBoostingRegressor
import os

class ClimatologyBaseline:
    """Predicts purely using the training-derived monthly climatological prior."""
    def __init__(self, dataset):
        self.clim_prior = dataset.clim_prior # [2, 6, 68, 60]
        self.mask = dataset.mask
        
    def predict(self, month_idx):
        return self.clim_prior[month_idx] * self.mask

class SSTLinearRegressionBaseline:
    """Fits depth-wise linear regression from surface SST to each standard depth level."""
    def __init__(self):
        self.models = [LinearRegression() for _ in range(6)]
        
    def fit(self, train_ds):
        # Extract training ocean pixels
        mask = train_ds.mask.astype(bool)
        sst_train = train_ds.inputs[:, 0][:, mask].reshape(-1, 1) # [61 * N_ocean, 1]
        
        for k in range(6):
            y_k = train_ds.targets[:, k][:, mask].reshape(-1)
            self.models[k].fit(sst_train, y_k)
            
    def predict(self, sst_map, mask):
        # sst_map: [68, 60]
        out = np.zeros((6, sst_map.shape[0], sst_map.shape[1]), dtype=np.float32)
        valid = mask.astype(bool)
        sst_flat = sst_map[valid].reshape(-1, 1)
        for k in range(6):
            preds = self.models[k].predict(sst_flat)
            layer = np.zeros_like(sst_map)
            layer[valid] = preds
            out[k] = layer
        return out

class MultiSourceTabularBaseline:
    """Fits Ridge regression per depth from all multi-source surface features."""
    def __init__(self, alpha=1.0):
        self.models = [Ridge(alpha=alpha) for _ in range(6)]
        
    def fit(self, train_ds):
        mask = train_ds.mask.astype(bool)
        # Features: [Time, C, H, W] -> [Time * N_ocean, C]
        x_train = []
        for c in range(train_ds.inputs.shape[1]):
            x_train.append(train_ds.inputs[:, c][:, mask].reshape(-1))
        x_train = np.stack(x_train, axis=1) # [61 * N_ocean, C]
        
        for k in range(6):
            y_k = train_ds.targets[:, k][:, mask].reshape(-1)
            self.models[k].fit(x_train, y_k)
            
    def predict(self, surface_tensor, mask):
        # surface_tensor: [C, 68, 60]
        out = np.zeros((6, surface_tensor.shape[1], surface_tensor.shape[2]), dtype=np.float32)
        valid = mask.astype(bool)
        x_feats = np.stack([surface_tensor[c][valid] for c in range(surface_tensor.shape[0])], axis=1)
        for k in range(6):
            preds = self.models[k].predict(x_feats)
            layer = np.zeros((surface_tensor.shape[1], surface_tensor.shape[2]), dtype=np.float32)
            layer[valid] = preds
            out[k] = layer
        return out

def evaluate_baselines(data_dir="data/processed"):
    from src.data.dataset import OceanDataset
    train_ds = OceanDataset(data_dir, split="train", channels="core-6")
    test_ds = OceanDataset(data_dir, split="test", channels="core-6")
    mask = test_ds.mask
    
    # 1. Climatology
    clim_model = ClimatologyBaseline(train_ds)
    # 2. SST Linear
    sst_model = SSTLinearRegressionBaseline()
    sst_model.fit(train_ds)
    # 3. Multi-Source Ridge
    multi_model = MultiSourceTabularBaseline()
    multi_model.fit(train_ds)
    
    # Compute test errors
    clim_errors = []
    sst_errors = []
    multi_errors = []
    
    depth_names = ["0m (SST)", "50m (Upper TC)", "100m (TC Core)", "200m (Lower TC)", "500m (Intermediate)", "1000m (Deep)"]
    
    for idx in range(len(test_ds)):
        item = test_ds[idx]
        y_true = item["y"].numpy()
        month_idx = item["month_idx"]
        sst_map = item["x"][0].numpy()
        x_surf = item["x"].numpy()
        
        # Predictions
        p_clim = clim_model.predict(month_idx)
        p_sst = sst_model.predict(sst_map, mask)
        p_multi = multi_model.predict(x_surf, mask)
        
        clim_errors.append((p_clim - y_true)**2)
        sst_errors.append((p_sst - y_true)**2)
        multi_errors.append((p_multi - y_true)**2)
        
    clim_mse = np.mean(clim_errors, axis=0) # [6, 68, 60]
    sst_mse = np.mean(sst_errors, axis=0)
    multi_mse = np.mean(multi_errors, axis=0)
    
    print("\n================ HELD-OUT TEST EVALUATION (AUG 16-31) ================")
    print(f"{'Depth':<22} | {'Clim RMSE':<10} | {'SST Lin RMSE':<12} | {'Multi-Src RMSE':<14} | {'Multi SS':<8}")
    print("-" * 75)
    
    valid_count = mask.sum()
    for k in range(6):
        c_rmse = np.sqrt(np.sum(clim_mse[k] * mask) / valid_count)
        s_rmse = np.sqrt(np.sum(sst_mse[k] * mask) / valid_count)
        m_rmse = np.sqrt(np.sum(multi_mse[k] * mask) / valid_count)
        c_val = np.sum(clim_mse[k] * mask)
        m_val = np.sum(multi_mse[k] * mask)
        ss = 1.0 - (m_val / (c_val + 1e-6))
        print(f"{depth_names[k]:<22} | {c_rmse:.4f}°C   | {s_rmse:.4f}°C     | {m_rmse:.4f}°C       | {ss:.4f}")
    print("======================================================================\n")

if __name__ == "__main__":
    evaluate_baselines("C:/Users/DELL/.gemini/antigravity/scratch/oceanembed/data/processed")
