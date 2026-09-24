import json

metadata = {
    "system_name": "OceanEmbed",
    "version": "2.1-locked",
    "problem_statement_id": 26066,
    "organization": "Ministry of Earth Sciences (MoES) - INCOIS",
    "domain": {
        "region": "Bay of Bengal",
        "lat_min": 5.0,
        "lat_max": 22.0,
        "lon_min": 80.0,
        "lon_max": 95.0,
        "resolution_deg": 0.25,
        "registration": "cell-centered",
        "n_lat": 68,
        "n_lon": 60,
        "lat_coords": [round(5.125 + i * 0.25, 4) for i in range(68)],
        "lon_coords": [round(80.125 + j * 0.25, 4) for j in range(60)]
    },
    "standard_depths_m": [0, 50, 100, 200, 500, 1000],
    "time_window": {
        "start_date": "2023-06-01",
        "end_date": "2023-08-31",
        "total_days": 92,
        "training_period": ["2023-06-01", "2023-07-31"],
        "training_days": 61,
        "validation_period": ["2023-08-01", "2023-08-15"],
        "validation_days": 15,
        "test_period": ["2023-08-16", "2023-08-31"],
        "test_days": 16
    },
    "data_sources": {
        "SST": {
            "name": "Sea Surface Temperature",
            "product_id": "SST_GLO_SST_L4_NRT_OBSERVATIONS_010_001",
            "provider": "UK Met Office / CMEMS (OSTIA)",
            "native_res": "0.05 deg daily",
            "unit": "degC",
            "regrid_method": "5x5 area-weighted block average"
        },
        "SLA": {
            "name": "Sea Level Anomaly",
            "product_id": "SEALEVEL_GLO_PHY_L4_NRT_OBSERVATIONS_008_046",
            "provider": "CNES / CLS / CMEMS (DUACS)",
            "native_res": "0.25 deg daily",
            "unit": "m",
            "regrid_method": "regular grid alignment"
        },
        "U_cur": {
            "name": "Zonal Surface Current",
            "product_id": "OSCAR_L4_OC_FINAL_V2.0",
            "provider": "NASA PO.DAAC / ESR",
            "native_res": "0.25 deg daily",
            "unit": "m/s",
            "regrid_method": "regular grid alignment"
        },
        "V_cur": {
            "name": "Meridional Surface Current",
            "product_id": "OSCAR_L4_OC_FINAL_V2.0",
            "provider": "NASA PO.DAAC / ESR",
            "native_res": "0.25 deg daily",
            "unit": "m/s",
            "regrid_method": "regular grid alignment"
        },
        "U_wind": {
            "name": "Zonal 10m Wind",
            "product_id": "reanalysis-era5-single-levels",
            "provider": "ECMWF / C3S (ERA5)",
            "native_res": "0.25 deg hourly",
            "unit": "m/s",
            "regrid_method": "24h vector daily mean"
        },
        "V_wind": {
            "name": "Meridional 10m Wind",
            "product_id": "reanalysis-era5-single-levels",
            "provider": "ECMWF / C3S (ERA5)",
            "native_res": "0.25 deg hourly",
            "unit": "m/s",
            "regrid_method": "24h vector daily mean"
        },
        "SSS": {
            "name": "Sea Surface Salinity",
            "product_id": "MULTIOBS_GLO_PHY_SSS_L4_MYNRT_015_013",
            "provider": "NASA JPL / CMEMS Multi-Obs (SMAP L4)",
            "native_res": "0.125 deg daily",
            "unit": "PSU",
            "regrid_method": "area-weighted daily mean"
        },
        "GLORYS": {
            "name": "GLORYS Training Target",
            "product_id": "GLOBAL_MULTIYEAR_PHY_001_030",
            "provider": "Mercator Ocean / CMEMS (GLORYS12V1)",
            "native_res": "1/12 deg daily, 50 levels",
            "unit": "degC (thetao)",
            "target_levels": [0, 50, 100, 200, 500, 1000]
        },
        "ARGO": {
            "name": "In-Situ Validation CTD Profiles",
            "product_id": "INCOIS_ARGO_PROFILES_QC",
            "provider": "INCOIS Argo Data Center / Coriolis GDAC",
            "qc_flags": [1, 2],
            "evaluation_depth_range_m": [0, 1000],
            "collocation": "4-point geospatial bilinear, 12h time match"
        }
    },
    "constants": {
        "rho_0": 1025.0,
        "c_p": 3993.0,
        "rho_cp_si": 4092825.0,
        "tchp_factor_kj_cm2_c_m": 0.4092825,
        "z_scale_m": 100.0,
        "deep_monotonicity_thresh_c_per_100m": 0.05,
        "thermocline_weights": [1.0, 3.0, 3.0, 2.0, 1.0, 0.5],
        "normalized_weights": [0.5714, 1.7143, 1.7143, 1.1429, 0.5714, 0.2857]
    }
}

with open("C:/Users/DELL/.gemini/antigravity/scratch/oceanembed/src/data/metadata.json", "w", encoding="utf-8") as f:
    json.dump(metadata, f, indent=2)

print("metadata.json generated successfully")
