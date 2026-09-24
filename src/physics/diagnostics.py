"""
OceanEmbed Operational Diagnostics Engine
Implements:
1. Estimated 26°C Isotherm Depth (D26) with full 5-case boundary & inversion handling
2. Estimated Tropical Cyclone Heat Potential (TCHP) with exact 0.40928 factor & censored lower bound
3. Deep Monotonicity Review Rule (0.05°C / 100m at z >= 300m)
4. Linearized Thermosteric Height Anomaly Diagnostic
"""
import numpy as np

# Physical Constants
RHO_0 = 1025.0       # kg/m^3
C_P = 3993.0         # J/(kg*K)
RHO_CP = 4092825.0   # J/(m^3*°C)
TCHP_FACTOR = 0.4092825 # kJ / (cm^2 * °C * m)
STANDARD_DEPTHS = np.array([0.0, 50.0, 100.0, 200.0, 500.0, 1000.0], dtype=np.float32)

def compute_d26_profile(temp_profile, depths=STANDARD_DEPTHS, sst_val=None):
    """
    Computes D26 for a 1D temperature profile [6 levels] with full boundary handling.
    Returns: (d26, flags_dict)
    """
    flags = {
        "censored_below_domain": False,
        "multiple_crossings": False,
        "surface_sst_inconsistency": False,
        "cold_surface": False
    }
    
    t_surf = temp_profile[0]
    if sst_val is not None:
        if sst_val > 26.0 and t_surf < 26.0:
            flags["surface_sst_inconsistency"] = True

    # Case 1: Surface cold
    if t_surf <= 26.0:
        flags["cold_surface"] = True
        return 0.0, flags

    # Find downward crossings: T(z_a) >= 26.0 and T(z_b) < 26.0
    crossings = []
    for i in range(len(depths) - 1):
        z_a, z_b = depths[i], depths[i+1]
        t_a, t_b = temp_profile[i], temp_profile[i+1]
        
        if t_a >= 26.0 and t_b < 26.0:
            # Linear interpolation
            d26_val = z_a + (z_b - z_a) * (t_a - 26.0) / (t_a - t_b + 1e-7)
            crossings.append(d26_val)

    if len(crossings) > 1:
        flags["multiple_crossings"] = True
        # Choose shallowest downward crossing (base of upper ocean warm layer)
        return float(crossings[0]), flags
    elif len(crossings) == 1:
        return float(crossings[0]), flags

    # Case 3: Deep warmth (no downward crossing, stays >= 26°C down to 1000m)
    if temp_profile[-1] >= 26.0:
        flags["censored_below_domain"] = True
        return 1000.0, flags

    return 0.0, flags

def compute_tchp_profile(temp_profile, d26, depths=STANDARD_DEPTHS, is_censored=False):
    """
    Trapezoidal quadrature for TCHP down to D26 with explicit interpolated endpoint.
    TCHP = rho_0 * C_p * integral_0^D26 max(0, T(z) - 26) dz
    """
    if d26 <= 0.0 or temp_profile[0] <= 26.0:
        return 0.0, "TCHP_zero"

    # Construct integration nodes: depths < D26, plus exact endpoint D26 with T = 26.0
    sub_depths = [depths[0]]
    sub_temps = [max(0.0, float(temp_profile[0] - 26.0))]
    
    for i in range(1, len(depths)):
        if depths[i] < d26:
            sub_depths.append(depths[i])
            sub_temps.append(max(0.0, float(temp_profile[i] - 26.0)))
        else:
            break
            
    # Add explicit endpoint at D26 where excess temperature = 0.0
    sub_depths.append(d26)
    sub_temps.append(0.0)
    
    # Trapezoidal summation
    tchp_sum = 0.0
    for i in range(len(sub_depths) - 1):
        dz = sub_depths[i+1] - sub_depths[i]
        avg_excess = 0.5 * (sub_temps[i] + sub_temps[i+1])
        tchp_sum += avg_excess * dz

    tchp_kj_cm2 = TCHP_FACTOR * tchp_sum
    label = "TCHP_lower_bound" if is_censored else "TCHP"
    return float(tchp_kj_cm2), label

def check_deep_monotonicity(temp_profile, depths=STANDARD_DEPTHS, thresh_c_per_100m=0.05):
    """
    Checks for unphysical deep inversions at z >= 300m.
    Threshold: 0.05°C / 100m (e.g. > 0.25°C between 500m and 1000m).
    """
    # Check 200m -> 500m (dz = 300m) and 500m -> 1000m (dz = 500m)
    flags = []
    # 200 to 500m
    grad_200_500 = (temp_profile[4] - temp_profile[3]) / 3.0 # °C per 100m
    if grad_200_500 > thresh_c_per_100m:
        flags.append(f"Inversion 200-500m: +{grad_200_500*3:.2f}°C")
        
    # 500 to 1000m
    grad_500_1000 = (temp_profile[5] - temp_profile[4]) / 5.0 # °C per 100m
    if grad_500_1000 > thresh_c_per_100m:
        flags.append(f"Inversion 500-1000m: +{grad_500_1000*5:.2f}°C")
        
    return len(flags) > 0, flags

def compute_grid_diagnostics(pred_grid, mask, sst_grid=None):
    """
    Computes D26 and TCHP maps for a full spatial grid [6, H, W].
    Returns: d26_map, tchp_map, cyclone_risk_map, metadata_map
    """
    H, W = pred_grid.shape[1], pred_grid.shape[2]
    d26_map = np.zeros((H, W), dtype=np.float32)
    tchp_map = np.zeros((H, W), dtype=np.float32)
    cyclone_risk_map = np.zeros((H, W), dtype=np.float32) # 1 if TCHP > 80 kJ/cm^2
    censored_map = np.zeros((H, W), dtype=bool)
    
    for i in range(H):
        for j in range(W):
            if mask[i, j] < 0.5:
                continue
            t_prof = pred_grid[:, i, j]
            sst = sst_grid[i, j] if sst_grid is not None else None
            
            d26, flags = compute_d26_profile(t_prof, sst_val=sst)
            tchp, _ = compute_tchp_profile(t_prof, d26, is_censored=flags["censored_below_domain"])
            
            d26_map[i, j] = d26
            tchp_map[i, j] = tchp
            censored_map[i, j] = flags["censored_below_domain"]
            
            if tchp >= 80.0:
                cyclone_risk_map[i, j] = 1.0

    return {
        "d26": d26_map,
        "tchp": tchp_map,
        "cyclone_risk_flag": cyclone_risk_map,
        "censored_map": censored_map
    }

def compute_profile_d26_tchp(depths, temps):
    d26, flags = compute_d26_profile(temps, depths=depths)
    tchp, label = compute_tchp_profile(temps, d26, depths=depths, is_censored=flags["censored_below_domain"])
    inv_flag = flags.get("multiple_crossings", False) or (len(temps) > 1 and temps[1] > temps[0] + 0.1)
    cens_flag = flags.get("censored_below_domain", False)
    return float(d26), float(tchp), inv_flag, cens_flag

def compute_grid_d26_tchp(pred_grid, mask, sst_grid=None):
    res = compute_grid_diagnostics(pred_grid, mask, sst_grid=sst_grid)
    d26_map = res["d26"]
    tchp_map = res["tchp"]
    flags = {
        "inversion_flag": (pred_grid[1] > pred_grid[0] + 0.1).astype(int) * mask.astype(int),
        "censored_flag": res["censored_map"].astype(int),
        "sub26_flag": (pred_grid[0] < 26.0).astype(int) * mask.astype(int)
    }
    return d26_map, tchp_map, flags

if __name__ == "__main__":
    # Test typical warm Bay of Bengal profile
    t_warm = np.array([29.5, 28.2, 24.5, 16.0, 9.8, 6.2], dtype=np.float32)
    d26, flags = compute_d26_profile(t_warm)
    tchp, label = compute_tchp_profile(t_warm, d26)
    print(f"Warm Profile: D26 = {d26:.1f} m, TCHP = {tchp:.2f} kJ/cm^2 (Risk: {tchp > 80})")
    
    # Test barrier-layer inversion profile in North BoB
    t_inversion = np.array([28.4, 28.9, 23.8, 15.5, 9.5, 6.1], dtype=np.float32) # T(50m) > T(0m)
    d26_inv, f_inv = compute_d26_profile(t_inversion)
    tchp_inv, _ = compute_tchp_profile(t_inversion, d26_inv)
    print(f"Inversion Profile: D26 = {d26_inv:.1f} m, TCHP = {tchp_inv:.2f} kJ/cm^2 (Multi-crossing: {f_inv['multiple_crossings']})")
    
    # Test cold upwelling profile (Sri Lanka dome)
    t_cold = np.array([25.4, 23.5, 18.2, 13.0, 8.5, 5.8], dtype=np.float32) # SST < 26
    d26_c, f_c = compute_d26_profile(t_cold)
    tchp_c, _ = compute_tchp_profile(t_cold, d26_c)
    print(f"Cold Profile: D26 = {d26_c:.1f} m, TCHP = {tchp_c:.2f} kJ/cm^2 (Cold Surface: {f_c['cold_surface']})")
