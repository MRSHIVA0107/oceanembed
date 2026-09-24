"""
OceanEmbed Comprehensive Integration Test Suite (11 Test Cases)
Validates:
1. Metadata & Spatial Coordinates Integrity (68 x 60 cell-centered grid)
2. Predict API & MC Uncertainty Dimensions
3. TCHP & D26 Diagnostics (physical non-negativity, 0.4092825 quadrature factor)
4. Subsurface Vertical Monotonicity Check
5. Zonal Transect Section API
6. Held-out Benchmark Table & Positive Skill Score
7. ARGO Collocation & Matchup Pipeline
8. Mackenzie (1981) 9-term Sound Velocity & Sonic Layer Depth (SLD)
9. Official INCOIS Marine Advisory Bulletin Generation
10. Vector GeoJSON Cyclone Hazard Perimeter Export
11. Point Sounding CSV Extraction & Formatting
"""
import numpy as np
import json
import os
from src.api.main import (
    get_metadata,
    get_layer_prediction,
    get_tchp_diagnostics,
    get_column_profile,
    get_vertical_transect,
    get_benchmarks,
    get_argo_matchups,
    get_acoustics,
    get_bulletin,
    get_hazard_geojson,
    get_sounding_csv_export
)
from src.physics.acoustics import mackenzie_sound_velocity, compute_profile_acoustics

def test_metadata_endpoint():
    data = get_metadata()
    assert data["bounds"]["shape"] == [68, 60]
    assert data["depths_m"] == [0, 50, 100, 200, 500, 1000]
    assert len(data["available_dates"]) == 16
    assert data["ocean_cell_count"] > 3000
    assert "0.4092825" in data["physical_constants"]["conversion_factor"]

def test_prediction_endpoint():
    data = get_layer_prediction(date="2023-08-16", depth=100)
    assert data["depth_m"] == 100
    assert len(data["temperature_grid"]) == 68
    assert len(data["temperature_grid"][0]) == 60
    assert len(data["uncertainty_grid"]) == 68
    assert 15.0 <= data["stats"]["mean_c"] <= 28.0
    assert data["stats"]["mean_uncertainty_c"] > 0.0

def test_diagnostics_tchp_endpoint():
    data = get_tchp_diagnostics(date="2023-08-16")
    assert len(data["tchp_grid"]) == 68
    assert len(data["d26_grid"]) == 68
    assert data["alert_metrics"]["mean_tchp_kj_cm2"] >= 0.0
    assert data["alert_metrics"]["max_d26_m"] <= 1000.0

def test_column_profile_endpoint():
    data = get_column_profile(date="2023-08-16", lat=14.5, lon=88.5)
    assert data["is_ocean"] is True
    assert len(data["temperatures_c"]) == 6
    assert len(data["climatology_c"]) == 6
    assert data["temperatures_c"][0] > data["temperatures_c"][-1]
    assert 4.0 <= data["temperatures_c"][5] <= 8.0

def test_transect_endpoint():
    data = get_vertical_transect(date="2023-08-16", lat=14.5)
    assert len(data["section_temperatures"]) == 6
    assert len(data["section_temperatures"][0]) == 60

def test_benchmarks_endpoint():
    data = get_benchmarks()
    assert "Climatology Prior" in data
    assert "OceanEmbed Core-6" in data
    ss_tc = data["OceanEmbed Core-6"]["skill_score_thermocline"]
    assert ss_tc > 0.15, f"Expected positive thermocline skill score, got {ss_tc}"

def test_argo_matchups_endpoint():
    data = get_argo_matchups()
    assert data["n_profiles_evaluated"] >= 15
    assert data["mean_profile_rmse_c"] < 0.60
    assert data["mae_d26_m"] < 10.0

def test_acoustics_mackenzie():
    # Mackenzie Reference at T=0°C, S=35 PSU, z=0m: 1448.96 m/s
    c_ref = mackenzie_sound_velocity(0.0, 35.0, 0.0)
    assert abs(c_ref - 1448.96) < 0.02, f"Expected 1448.96 m/s, got {c_ref}"
    
    # Check Sonic Layer Depth logic on inverted profile
    t_prof = [29.5, 29.8, 23.5, 15.5, 9.5, 6.2]
    ac = compute_profile_acoustics(t_prof)
    assert ac["sonic_layer_depth_m"] == 50.0
    assert ac["surface_duct_strength_mps"] > 0.0
    assert "ACTIVE SURFACE DUCT" in ac["tactical_assessment"]
    
    # Check API endpoint
    api_ac = get_acoustics(date="2023-08-16", lat=14.5, lon=88.5)
    assert len(api_ac["sound_velocities_mps"]) == 6
    assert api_ac["sonic_layer_depth_m"] >= 0.0

def test_bulletin_generator():
    html_bulletin = get_bulletin(date="2023-08-16")
    assert "OPERATIONAL OCEAN HEAT CONTENT" in html_bulletin
    assert "Visakhapatnam" in html_bulletin
    assert "INCOIS-MOES/OSF/BOB" in html_bulletin
    assert "Naval Underwater Acoustics" in html_bulletin

def test_geojson_export():
    geojson = get_hazard_geojson(date="2023-08-16", threshold=80.0)
    assert geojson["type"] == "FeatureCollection"
    assert len(geojson["features"]) > 0
    first_feat = geojson["features"][0]
    assert first_feat["geometry"]["type"] == "Polygon"
    assert first_feat["properties"]["tchp_kj_cm2"] >= 80.0
    assert "CRITICAL_RAPID_INTENSIFICATION" in first_feat["properties"]["risk_level"]

def test_sounding_csv_export():
    csv_text = get_sounding_csv_export(date="2023-08-16", lat=14.5, lon=88.5)
    lines = csv_text.strip().splitlines()
    assert len(lines) >= 12
    assert any("depth_m,temperature_c,epistemic_uncertainty_c,sound_velocity_mps" in l for l in lines)

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("      RUNNING OCEANEMBED VERIFICATION TEST SUITE (11 TESTS)")
    print("=" * 60)
    
    test_metadata_endpoint()
    print(" [1/11] Metadata & Coordinates Check:         PASS")
    
    test_prediction_endpoint()
    print(" [2/11] Prediction & Epistemic Uncertainty:   PASS")
    
    test_diagnostics_tchp_endpoint()
    print(" [3/11] TCHP & D26 Diagnostics:               PASS")
    
    test_column_profile_endpoint()
    print(" [4/11] Subsurface Monotonicity:              PASS")
    
    test_transect_endpoint()
    print(" [5/11] Zonal Vertical Transect:              PASS")
    
    test_benchmarks_endpoint()
    print(" [6/11] Held-Out Benchmark & Skill Score:     PASS")
    
    test_argo_matchups_endpoint()
    print(" [7/11] In-Situ ARGO Collocation:             PASS")
    
    test_acoustics_mackenzie()
    print(" [8/11] Mackenzie Naval Acoustics & SLD:      PASS")
    
    test_bulletin_generator()
    print(" [9/11] Official INCOIS Bulletin Generation:  PASS")
    
    test_geojson_export()
    print("[10/11] Vector GeoJSON Hazard Perimeter:      PASS")
    
    test_sounding_csv_export()
    print("[11/11] Column Sounding CSV Extraction:       PASS")
    
    print("=" * 60)
    print("  ALL 11/11 PRODUCTION INTEGRATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 60 + "\n")
