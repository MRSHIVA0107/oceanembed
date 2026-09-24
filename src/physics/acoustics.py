"""
OceanEmbed Naval Acoustics & Underwater Sound Velocity Engine
Implements:
1. Mackenzie (1981) 9-term equation for sound velocity C(T, S, z) in seawater.
2. Sonic Layer Depth (SLD) detection: depth of maximum sound speed in the upper ocean.
3. Deep Sound Channel (SOFAR axis) depth identification.
4. Acoustic Surface Duct strength and shadow-zone vulnerability flags.
5. Grid-wide 3D sound velocity mapping for naval maritime operations.
"""
import numpy as np

# Standard ocean depths
STANDARD_DEPTHS = np.array([0.0, 50.0, 100.0, 200.0, 500.0, 1000.0], dtype=np.float32)

def mackenzie_sound_velocity(temperature_c, salinity_psu=34.2, depth_m=0.0):
    """
    Mackenzie (1981) 9-term empirical equation for speed of sound in seawater (m/s).
    Valid ranges:
      Temperature: 2°C to 30°C
      Salinity:    25 to 40 PSU
      Depth:       0 to 8000 m
    """
    T = np.asarray(temperature_c, dtype=np.float64)
    S = np.asarray(salinity_psu, dtype=np.float64)
    D = np.asarray(depth_m, dtype=np.float64)
    
    # Mackenzie (1981) coefficients
    c = (
        1448.96 +
        4.591 * T -
        5.304e-2 * (T ** 2) +
        2.374e-4 * (T ** 3) +
        1.340 * (S - 35.0) +
        1.630e-2 * D +
        1.675e-7 * (D ** 2) -
        1.025e-2 * T * (S - 35.0) -
        7.139e-13 * T * (D ** 3)
    )
    return np.round(c, 2)

def compute_profile_acoustics(temperatures_c, depths_m=STANDARD_DEPTHS, surface_salinity=34.2):
    """
    Computes Sound Velocity Profile (SVP) and tactical acoustic parameters for a single column:
    - C(z) profile in m/s
    - Sonic Layer Depth (SLD) in meters
    - Surface duct strength in m/s
    - SOFAR channel minimum sound speed axis
    """
    temps = np.asarray(temperatures_c, dtype=np.float32)
    depths = np.asarray(depths_m, dtype=np.float32)
    
    # Salinity profile approximation in Bay of Bengal:
    # Surface SSS with fresh river plume, increasing to ~34.8 PSU in deep ocean
    salinities = np.zeros_like(depths)
    for idx, z in enumerate(depths):
        if z == 0.0:
            salinities[idx] = surface_salinity
        elif z <= 100.0:
            salinities[idx] = surface_salinity + (34.5 - surface_salinity) * (z / 100.0)
        else:
            salinities[idx] = 34.5 + (34.85 - 34.5) * min(1.0, (z - 100.0) / 900.0)
            
    c_profile = mackenzie_sound_velocity(temps, salinities, depths)
    
    # Sonic Layer Depth (SLD): Maximum sound speed in upper 200m
    upper_mask = depths <= 200.0
    upper_c = c_profile[upper_mask]
    upper_z = depths[upper_mask]
    
    max_idx = int(np.argmax(upper_c))
    sld_m = float(upper_z[max_idx])
    c_surface = float(c_profile[0])
    c_sld = float(upper_c[max_idx])
    
    # Surface duct strength: excess sound speed at SLD compared to surface
    duct_strength = max(0.0, float(c_sld - c_surface))
    has_surface_duct = bool(duct_strength >= 0.5 and sld_m > 0.0)
    
    # Deep sound channel minimum (SOFAR axis) across full column
    min_idx = int(np.argmin(c_profile))
    sofar_axis_m = float(depths[min_idx])
    c_min = float(c_profile[min_idx])
    
    # Tactical Naval Assessment
    if has_surface_duct:
        duct_status = f"ACTIVE SURFACE DUCT (SLD = {sld_m:.0f}m, ΔC = +{duct_strength:.1f} m/s). Sonar trapped in top {sld_m:.0f}m; Shadow zone below."
    else:
        duct_status = "NORMAL REFRACTIVE PROFILE (Negative gradient; downward refraction into thermocline)."
        
    return {
        "depths_m": depths.tolist(),
        "sound_velocities_mps": c_profile.tolist(),
        "c_surface_mps": c_surface,
        "sonic_layer_depth_m": sld_m,
        "c_sld_mps": c_sld,
        "surface_duct_strength_mps": round(duct_strength, 2),
        "has_surface_duct": has_surface_duct,
        "sofar_axis_depth_m": sofar_axis_m,
        "c_min_mps": c_min,
        "tactical_assessment": duct_status
    }

def compute_grid_acoustics(pred_grid, mask, sss_grid=None):
    """
    Computes 2D grids of acoustic parameters across the entire spatial domain [6, H, W]:
    - sld_map: [H, W] Sonic Layer Depth in meters
    - duct_strength_map: [H, W] Surface duct excess velocity in m/s
    - c_surface_map: [H, W] Surface sound speed in m/s
    """
    H, W = pred_grid.shape[1], pred_grid.shape[2]
    sld_map = np.zeros((H, W), dtype=np.float32)
    duct_map = np.zeros((H, W), dtype=np.float32)
    c_surf_map = np.zeros((H, W), dtype=np.float32)
    
    for i in range(H):
        for j in range(W):
            if mask[i, j] < 0.5:
                continue
            t_prof = pred_grid[:, i, j]
            s_val = float(sss_grid[i, j]) if sss_grid is not None else 34.2
            
            res = compute_profile_acoustics(t_prof, surface_salinity=s_val)
            sld_map[i, j] = res["sonic_layer_depth_m"]
            duct_map[i, j] = res["surface_duct_strength_mps"]
            c_surf_map[i, j] = res["c_surface_mps"]
            
    return {
        "sld_grid": sld_map,
        "duct_strength_grid": duct_map,
        "c_surface_grid": c_surf_map
    }

if __name__ == "__main__":
    # Reference test: T=0°C, S=35 PSU, D=0m -> Expected 1448.96 m/s
    c_ref = mackenzie_sound_velocity(0.0, 35.0, 0.0)
    print(f"Mackenzie Reference Test (0°C, 35 PSU, 0m): {c_ref:.2f} m/s (Expected: 1448.96 m/s)")
    assert abs(c_ref - 1448.96) < 0.01, "Mackenzie formulation mismatch"
    
    # Typical Bay of Bengal profile
    t_bob = [29.5, 29.8, 23.5, 15.5, 9.5, 6.2]
    res = compute_profile_acoustics(t_bob, surface_salinity=32.5)
    print(f"Bay of Bengal Acoustic Profile:")
    print(f"  Sound Velocities: {res['sound_velocities_mps']}")
    print(f"  Sonic Layer Depth: {res['sonic_layer_depth_m']} m")
    print(f"  Duct Strength:     +{res['surface_duct_strength_mps']} m/s")
    print(f"  Assessment:        {res['tactical_assessment']}")
