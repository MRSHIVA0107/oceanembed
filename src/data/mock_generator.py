"""
OceanEmbed Realistic Geophysical Synthesizer (Bay of Bengal Domain)
Domain: 5°N - 22°N, 80°E - 95°E (0.25° cell-centered, 68 x 60)
Dates: 2023-06-01 to 2023-08-31 (92 daily steps)
"""
import numpy as np
import json
import os
from datetime import datetime, timedelta

def generate_bay_of_bengal_dataset(output_dir="data/processed"):
    os.makedirs(output_dir, exist_ok=True)
    np.random.seed(42)
    
    n_lat, n_lon = 68, 60
    lats = np.linspace(5.125, 21.875, n_lat)
    lons = np.linspace(80.125, 94.875, n_lon)
    lon_grid, lat_grid = np.meshgrid(lons, lats)
    
    # Realistic Land Mask (1 = ocean, 0 = land)
    # India to West/Northwest, Myanmar to East, Bangladesh to North, Sri Lanka to SW
    mask = np.ones((n_lat, n_lon), dtype=np.float32)
    for i in range(n_lat):
        for j in range(n_lon):
            lat, lon = lats[i], lons[j]
            # Indian subcontinent coastline (simplified realistic polygon bounds)
            if lat > 15.0 and lon < 84.5 and (lat - 15.0) > 1.8 * (lon - 80.0):
                mask[i, j] = 0.0
            if lat > 19.5 and lon < 88.0: # Odisha / West Bengal coast
                mask[i, j] = 0.0
            if lat > 21.0 and lon < 91.5: # Bangladesh delta coast
                mask[i, j] = 0.0
            if lon > 92.5 and lat > 15.5: # Myanmar coast / Arakan
                mask[i, j] = 0.0
            if lon > 94.0 and lat > 11.0: # Andaman / Myanmar boundary
                mask[i, j] = 0.0
            if lat < 9.5 and lon < 82.0:  # Sri Lanka
                mask[i, j] = 0.0

    print(f"Ocean mask created: {int(mask.sum())} valid ocean cells out of {n_lat * n_lon} total ({mask.sum()/(n_lat*n_lon)*100:.1f}%)")
    
    dates = [datetime(2023, 6, 1) + timedelta(days=d) for d in range(92)]
    n_times = len(dates)
    depths = np.array([0, 50, 100, 200, 500, 1000], dtype=np.float32)
    
    # 1. Base Climatology Fields (June and July/August)
    # Background temperature decreases with latitude slightly, and strongly with depth
    climatology = np.zeros((2, 6, n_lat, n_lon), dtype=np.float32) # month 0 = June, month 1 = July/Aug
    base_t_depth = np.array([29.0, 27.5, 23.0, 15.5, 9.5, 6.2], dtype=np.float32)
    
    for m in range(2):
        for k in range(6):
            # North-South gradient and slight East-West gradient
            spatial_grad = -0.05 * (lat_grid - 13.5) + 0.03 * (lon_grid - 87.5)
            # Monsoon heating in July/August slightly warms subsurface
            monsoon_offset = 0.3 * m if k < 3 else 0.0
            climatology[m, k] = (base_t_depth[k] + spatial_grad + monsoon_offset) * mask
            
    # Save Climatology
    np.save(os.path.join(output_dir, "climatology_monthly.npy"), climatology)
    
    # 2. Daily Surface Inputs: [Time, 7, 68, 60]
    # Channels: 0: SST, 1: SLA, 2: U_cur, 3: V_cur, 4: U_wind, 5: V_wind, 6: SSS
    surface_inputs = np.zeros((n_times, 7, n_lat, n_lon), dtype=np.float32)
    
    # 3. Daily Subsurface GLORYS Targets: [Time, 6, 68, 60]
    glorys_targets = np.zeros((n_times, 6, n_lat, n_lon), dtype=np.float32)
    
    # Synthetic eddy tracking parameters
    eddy_x = 88.0 + 3.0 * np.sin(np.linspace(0, 3*np.pi, n_times))
    eddy_y = 14.0 + 2.0 * np.cos(np.linspace(0, 2*np.pi, n_times))
    
    for t in range(n_times):
        month_idx = 0 if dates[t].month == 6 else 1
        day_frac = t / 92.0
        
        # Mesoscale Eddy Signature (Anticyclonic warm eddy in central Bay)
        dist_sq = (lon_grid - eddy_x[t])**2 + (lat_grid - eddy_y[t])**2
        eddy_amp = np.exp(-dist_sq / 8.0) # ~250 km radius
        
        # Sri Lanka Dome Upwelling (Cooler SST, negative SLA in Southwest)
        sl_dist_sq = (lon_grid - 83.5)**2 + (lat_grid - 8.5)**2
        upwelling_amp = np.exp(-sl_dist_sq / 6.0)
        
        # Northern River Plume (Low SSS in North)
        river_plume = np.clip((lat_grid - 16.0) / 6.0, 0, 1) * (1.0 + 0.2 * np.sin(2 * np.pi * t / 30.0))
        
        # --- Surface Channels ---
        # SST: Base ~29°C + seasonal drift - upwelling + eddy warmth
        sst = (28.8 + 0.8 * np.sin(np.pi * day_frac) + 0.6 * eddy_amp - 1.8 * upwelling_amp + 0.15 * np.random.randn(n_lat, n_lon)) * mask
        # SLA: Mesoscale eddies (+0.15m anticyclonic, -0.12m cyclonic upwelling)
        sla = (0.18 * eddy_amp - 0.14 * upwelling_amp + 0.04 * np.sin(lon_grid * 0.5) + 0.02 * np.random.randn(n_lat, n_lon)) * mask
        # Winds: Southwest monsoon (strong positive U and positive V)
        u_wind = (7.5 + 2.5 * np.sin(np.pi * day_frac) + 0.5 * np.random.randn(n_lat, n_lon)) * mask
        v_wind = (5.5 + 2.0 * np.cos(np.pi * day_frac) + 0.5 * np.random.randn(n_lat, n_lon)) * mask
        # Surface Currents: Geostrophic swirl around eddy + drift
        u_cur = (-0.4 * (lat_grid - eddy_y[t]) / 3.0 * eddy_amp + 0.15 * np.random.randn(n_lat, n_lon)) * mask
        v_cur = (0.4 * (lon_grid - eddy_x[t]) / 3.0 * eddy_amp + 0.15 * np.random.randn(n_lat, n_lon)) * mask
        # SSS: Lower in north (down to ~29 PSU), higher in south (~34 PSU)
        sss = (33.8 - 4.2 * river_plume - 0.3 * np.random.randn(n_lat, n_lon)) * mask
        
        surface_inputs[t, 0] = sst
        surface_inputs[t, 1] = sla
        surface_inputs[t, 2] = u_cur
        surface_inputs[t, 3] = v_cur
        surface_inputs[t, 4] = u_wind
        surface_inputs[t, 5] = v_wind
        surface_inputs[t, 6] = sss
        
        # --- Subsurface GLORYS Targets ---
        # Depth 0m: very close to SST
        glorys_targets[t, 0] = sst
        # Depth 50m: Upper TC, barrier layer inversion in North!
        # In North where river_plume is strong, T(50m) can exceed T(0m) by ~0.4°C!
        barrier_inversion = 0.6 * river_plume
        glorys_targets[t, 1] = (climatology[month_idx, 1] + 1.2 * sst - 34.0 + barrier_inversion + 1.2 * eddy_amp - 1.5 * upwelling_amp + 0.15 * np.random.randn(n_lat, n_lon)) * mask
        # Depth 100m: Thermocline core, strongly coupled to SLA (deepening in eddy)
        glorys_targets[t, 2] = (climatology[month_idx, 2] + 8.5 * sla + 0.2 * np.random.randn(n_lat, n_lon)) * mask
        # Depth 200m: Lower thermocline, moderate SLA coupling
        glorys_targets[t, 3] = (climatology[month_idx, 3] + 4.2 * sla + 0.15 * np.random.randn(n_lat, n_lon)) * mask
        # Depth 500m: Intermediate water, weak coupling
        glorys_targets[t, 4] = (climatology[month_idx, 4] + 0.8 * sla + 0.08 * np.random.randn(n_lat, n_lon)) * mask
        # Depth 1000m: Deep ocean, nearly stable
        glorys_targets[t, 5] = (climatology[month_idx, 5] + 0.15 * sla + 0.04 * np.random.randn(n_lat, n_lon)) * mask

    # Save Arrays
    np.save(os.path.join(output_dir, "surface_inputs_92d.npy"), surface_inputs)
    np.save(os.path.join(output_dir, "glorys_targets_92d.npy"), glorys_targets)
    np.save(os.path.join(output_dir, "ocean_mask.npy"), mask)
    np.save(os.path.join(output_dir, "lats.npy"), lats)
    np.save(os.path.join(output_dir, "lons.npy"), lons)
    
    # Save Dates Metadata
    date_strings = [d.strftime("%Y-%m-%d") for d in dates]
    with open(os.path.join(output_dir, "dates.json"), "w") as f:
        json.dump(date_strings, f)
        
    print(f"Dataset successfully generated:")
    print(f"  Inputs shape:  {surface_inputs.shape} (Time x 7 x Lat x Lon)")
    print(f"  Targets shape: {glorys_targets.shape} (Time x 6 x Lat x Lon)")
    print(f"  Depths:        {depths.tolist()} meters")
    print(f"  Files saved to: {output_dir}")

if __name__ == "__main__":
    generate_bay_of_bengal_dataset("C:/Users/DELL/.gemini/antigravity/scratch/oceanembed/data/processed")
