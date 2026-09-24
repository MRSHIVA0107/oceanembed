"""
OceanEmbed Data & Vector Export Engine
Exports:
1. GeoJSON FeatureCollection of Cyclone Rapid Intensification (RI) Hazard Zones (TCHP >= 80 kJ/cm²).
2. GeoJSON Isotherm contour boundaries (D26 and D20).
3. CF-1.7 compliant CSV sounding extracts for scientific and maritime field operators.
"""
import os
import json
import numpy as np

def export_high_risk_geojson(tchp_grid, lats, lons, mask, threshold=80.0, date_str="2023-08-16", output_path=None):
    """
    Generates standard GeoJSON polygons of ocean regions where TCHP exceeds the critical threshold.
    """
    d_lat = float(lats[1] - lats[0]) / 2.0
    d_lon = float(lons[1] - lons[0]) / 2.0
    
    features = []
    H, W = tchp_grid.shape
    
    for i in range(H):
        for j in range(W):
            val = float(tchp_grid[i, j])
            if mask[i, j] == 1.0 and val >= threshold:
                lat = float(lats[i])
                lon = float(lons[j])
                
                # Bounding box polygon for pixel
                coords = [
                    [round(lon - d_lon, 4), round(lat - d_lat, 4)],
                    [round(lon + d_lon, 4), round(lat - d_lat, 4)],
                    [round(lon + d_lon, 4), round(lat + d_lat, 4)],
                    [round(lon - d_lon, 4), round(lat + d_lat, 4)],
                    [round(lon - d_lon, 4), round(lat - d_lat, 4)]
                ]
                
                feat = {
                    "type": "Feature",
                    "properties": {
                        "tchp_kj_cm2": round(val, 2),
                        "risk_level": "CRITICAL_RAPID_INTENSIFICATION",
                        "date": date_str,
                        "center_lat": round(lat, 4),
                        "center_lon": round(lon, 4)
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [coords]
                    }
                }
                features.append(feat)
                
    geojson = {
        "type": "FeatureCollection",
        "metadata": {
            "title": "OceanEmbed Cyclone Heat Potential Hazard Perimeter",
            "threshold_kj_cm2": threshold,
            "feature_count": len(features),
            "date": date_str,
            "datum": "WGS84 (EPSG:4326)"
        },
        "features": features
    }
    
    if output_path is not None:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(geojson, f, indent=2)
            
    return geojson

def export_sounding_csv(depths, temps, uncerts, sound_speeds, lat, lon, date_str, output_path=None):
    """
    Exports a CF-compliant CSV sounding for a specific column probe.
    """
    lines = [
        "# ====================================================================",
        "# OceanEmbed Column Sounding Profile Extract",
        f"# Latitude:  {lat:.4f} N",
        f"# Longitude: {lon:.4f} E",
        f"# Date:      {date_str}",
        "# Model:     OceanEmbed ResNet-18 Multi-Scale Subsurface Reconstructor",
        "# Units:     Depth (m), Temperature (degC), Uncertainty (degC), Sound Speed (m/s)",
        "# ====================================================================",
        "depth_m,temperature_c,epistemic_uncertainty_c,sound_velocity_mps"
    ]
    
    for k in range(len(depths)):
        lines.append(f"{depths[k]:.1f},{temps[k]:.2f},{uncerts[k]:.3f},{sound_speeds[k]:.2f}")
        
    content = "\n".join(lines)
    if output_path is not None:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)
            
    return content

if __name__ == "__main__":
    dummy_tchp = np.full((68, 60), 85.0, dtype=np.float32)
    lats = np.linspace(5.125, 21.875, 68)
    lons = np.linspace(80.125, 94.875, 60)
    mask = np.ones((68, 60), dtype=np.float32)
    
    gj = export_high_risk_geojson(dummy_tchp, lats, lons, mask, output_path="data/processed/hazard_perimeter.geojson")
    print(f"GeoJSON exported with {len(gj['features'])} hazard polygons.")
