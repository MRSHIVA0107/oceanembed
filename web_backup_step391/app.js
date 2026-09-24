/**
 * OceanEmbed Enterprise Marine Workstation Client Engine
 * Ministry of Earth Sciences (MoES) - INCOIS Problem Statement 26066
 */

// Global Application State
const appState = {
  metadata: null,
  activeDate: "2023-08-16",
  activeDepth: 100,
  activeLayer: "temp", // 'temp' | 'tchp' | 'acoustics' | 'uncertainty'
  activeModel: "core-6",
  selectedCoords: { lat: 14.375, lon: 88.375 },
  selectedFloat: null,
  argoData: null,
  benchData: null,
  map: null,
  canvasOverlay: null,
  hazardLayerGroup: null,
  probeMarker: null,
  argoLayerGroup: null,
  profileChart: null,
  soundChart: null,
  transectChart: null,
  isOcean: true
};

// Oceanographic Standard Color Palettes
const PALETTES = {
  // cmocean thermal
  temp: [
    { stop: 0.0,  r: 15,  g: 23,  b: 42 },   // ~5°C Abyssal Deep
    { stop: 0.25, r: 2,   g: 132, b: 199 },  // ~12°C Intermediate
    { stop: 0.50, r: 16,  g: 185, b: 129 },  // ~20°C Lower TC
    { stop: 0.75, r: 245, g: 158, b: 11 },   // ~26°C D26 Threshold
    { stop: 1.0,  r: 239, g: 68,  b: 68 }    // ~31°C Tropical Surface Pool
  ],
  // cmocean matter / cyclone hazard
  tchp: [
    { stop: 0.0,  r: 10,  g: 15,  b: 26 },   // 0 kJ/cm²
    { stop: 0.35, r: 30,  g: 64,  b: 175 },  // 30 kJ/cm²
    { stop: 0.65, r: 217, g: 119, b: 6 },    // 65 kJ/cm²
    { stop: 0.80, r: 220, g: 38,  b: 38 },   // 80 kJ/cm² CRITICAL THRESHOLD
    { stop: 1.0,  r: 236, g: 72,  b: 153 }   // 120+ kJ/cm² Explosive Intensification
  ],
  // cmocean speed (sound velocity 1485 to 1545 m/s)
  acoustics: [
    { stop: 0.0,  r: 24,  g: 35,  b: 70 },   // 1485 m/s Deep SOFAR minimum
    { stop: 0.40, r: 14,  g: 165, b: 233 },  // 1510 m/s
    { stop: 0.75, r: 16,  g: 185, b: 129 },  // 1530 m/s
    { stop: 1.0,  r: 245, g: 158, b: 11 }    // 1546 m/s Upper Duct Maximum
  ],
  // cmocean mld (epistemic uncertainty 0.0 to 0.45°C)
  uncertainty: [
    { stop: 0.0,  r: 15,  g: 23,  b: 42 },   // 0.0°C
    { stop: 0.35, r: 6,   g: 182, b: 212 },  // 0.15°C
    { stop: 0.70, r: 139, g: 92,  b: 246 },  // 0.30°C
    { stop: 1.0,  r: 244, g: 63,  b: 94 }    // 0.45°C+
  ]
};

function interpolateColor(valNorm, palette) {
  const norm = Math.max(0, Math.min(1, valNorm));
  let i = 0;
  while (i < palette.length - 1 && palette[i + 1].stop < norm) {
    i++;
  }
  const c1 = palette[i];
  const c2 = palette[i + 1] || palette[i];
  const range = c2.stop - c1.stop || 1e-6;
  const f = (norm - c1.stop) / range;
  
  const r = Math.round(c1.r + f * (c2.r - c1.r));
  const g = Math.round(c1.g + f * (c2.g - c1.g));
  const b = Math.round(c1.b + f * (c2.b - c1.b));
  return [r, g, b];
}

function decimalToDMS(coord, isLat) {
  const absolute = Math.abs(coord);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = Math.floor((minutesNotTruncated - minutes) * 60);
  const direction = isLat ? (coord >= 0 ? "N" : "S") : (coord >= 0 ? "E" : "W");
  return `${degrees}°${minutes}'${seconds}"${direction}`;
}

// Lifecycle Init
document.addEventListener("DOMContentLoaded", async () => {
  initMap();
  initDualCharts();
  initTransectChart();
  initUIEventListeners();
  
  await loadMetadata();
  await loadRasterLayer();
  await loadARGOFloats();
  await loadBenchmarks();
  await updateColumnSounding(appState.selectedCoords.lat, appState.selectedCoords.lon);
  await updateTransect(14.375);
});

// Map Engine
function initMap() {
  appState.map = L.map("map", {
    center: [13.5, 87.5],
    zoom: 5.5,
    minZoom: 4,
    maxZoom: 9,
    attributionControl: false
  });

  // High-Contrast Maritime Basemap
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd",
    maxZoom: 19
  }).addTo(appState.map);

  appState.hazardLayerGroup = L.layerGroup().addTo(appState.map);
  appState.argoLayerGroup = L.layerGroup().addTo(appState.map);

  // Crosshair Probe Pin
  const probeIcon = L.divIcon({
    className: "custom-probe-pin",
    html: `<div style="width:16px;height:16px;background:var(--color-cyan,#06b6d4);border:2.5px solid #fff;border-radius:50%;box-shadow:0 0 10px #06b6d4;cursor:crosshair;"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  appState.probeMarker = L.marker([appState.selectedCoords.lat, appState.selectedCoords.lon], {
    icon: probeIcon,
    zIndexOffset: 1000
  }).addTo(appState.map);

  // Map Click & Hover Trackers
  appState.map.on("mousemove", (e) => {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;
    document.getElementById("hudCoordsDD").textContent = `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`;
    document.getElementById("hudCoordsDMS").textContent = `${decimalToDMS(lat, true)}, ${decimalToDMS(lon, false)}`;
  });

  appState.map.on("click", (e) => {
    const lat = Math.round(e.latlng.lat * 1000) / 1000;
    const lon = Math.round(e.latlng.lng * 1000) / 1000;
    
    if (lat >= 5.125 && lat <= 21.875 && lon >= 80.125 && lon <= 94.875) {
      appState.selectedCoords = { lat, lon };
      appState.selectedFloat = null;
      appState.probeMarker.setLatLng([lat, lon]);
      updateColumnSounding(lat, lon);
    }
  });
}

// Dual Plot Initializer (Temperature + Sound Velocity)
function initDualCharts() {
  const commonScaleOptions = {
    x: {
      grid: { color: "#1e2a3f" },
      ticks: { color: "#94a3b8", font: { family: "JetBrains Mono", size: 10 } }
    },
    y: {
      reverse: true, // Inverted: 0m at surface, 1000m at abyssal bottom
      grid: { color: "#1e2a3f" },
      ticks: { color: "#94a3b8", font: { family: "JetBrains Mono", size: 10 } }
    }
  };

  // 1. Temperature Profile Chart
  const ctxP = document.getElementById("profileChart").getContext("2d");
  appState.profileChart = new Chart(ctxP, {
    type: "line",
    data: {
      labels: [0, 50, 100, 200, 500, 1000],
      datasets: [
        {
          label: "OceanEmbed Reconstruction",
          data: [],
          borderColor: "#06b6d4",
          backgroundColor: "rgba(6, 182, 212, 0.15)",
          borderWidth: 2.2,
          pointRadius: 4,
          pointBackgroundColor: "#06b6d4",
          tension: 0.15
        },
        {
          label: "Climatological Prior",
          data: [],
          borderColor: "#64748b",
          borderWidth: 1.6,
          borderDash: [4, 4],
          pointRadius: 2.5,
          tension: 0.15,
          fill: false
        },
        {
          label: "ARGO In-Situ Sounding",
          data: [],
          borderColor: "#10b981",
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: "#10b981",
          hidden: true,
          fill: false
        }
      ]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ...commonScaleOptions.x, title: { display: true, text: "Temperature (°C)", color: "#94a3b8", font: { size: 10, weight: "bold" } } },
        y: { ...commonScaleOptions.y, title: { display: true, text: "Depth (m)", color: "#94a3b8", font: { size: 10, weight: "bold" } } }
      },
      plugins: {
        legend: { labels: { color: "#f8fafc", font: { size: 10 } } }
      }
    }
  });

  // 2. Sound Velocity Chart
  const ctxS = document.getElementById("soundChart").getContext("2d");
  appState.soundChart = new Chart(ctxS, {
    type: "line",
    data: {
      labels: [0, 50, 100, 200, 500, 1000],
      datasets: [
        {
          label: "Sound Velocity C(z)",
          data: [],
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245, 158, 11, 0.12)",
          borderWidth: 2.2,
          pointRadius: 4,
          pointBackgroundColor: "#f59e0b",
          tension: 0.15
        }
      ]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ...commonScaleOptions.x, title: { display: true, text: "Sound Speed (m/s)", color: "#94a3b8", font: { size: 10, weight: "bold" } } },
        y: { ...commonScaleOptions.y, title: { display: true, text: "Depth (m)", color: "#94a3b8", font: { size: 10, weight: "bold" } } }
      },
      plugins: {
        legend: { labels: { color: "#f8fafc", font: { size: 10 } } }
      }
    }
  });
}

// Zonal Transect Chart
function initTransectChart() {
  const ctxT = document.getElementById("transectChart").getContext("2d");
  appState.transectChart = new Chart(ctxT, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        { label: "0m (SST)", data: [], borderColor: "#ef4444", borderWidth: 2, tension: 0.2 },
        { label: "50m (Upper TC)", data: [], borderColor: "#f59e0b", borderWidth: 2, tension: 0.2 },
        { label: "100m (TC Core)", data: [], borderColor: "#10b981", borderWidth: 2.5, tension: 0.2 },
        { label: "200m (Lower TC)", data: [], borderColor: "#0284c7", borderWidth: 2, tension: 0.2 },
        { label: "500m (Intermediate)", data: [], borderColor: "#8b5cf6", borderWidth: 1.5, tension: 0.2 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: "Longitude (°E)", color: "#94a3b8", font: { size: 10 } },
          grid: { color: "#1e2a3f" },
          ticks: { color: "#94a3b8", font: { family: "JetBrains Mono", size: 10 } }
        },
        y: {
          title: { display: true, text: "Temperature (°C)", color: "#94a3b8", font: { size: 10 } },
          grid: { color: "#1e2a3f" },
          ticks: { color: "#94a3b8", font: { family: "JetBrains Mono", size: 10 } }
        }
      },
      plugins: {
        legend: { labels: { color: "#f8fafc", font: { size: 10 } } }
      }
    }
  });
}

// UI Event Listeners
function initUIEventListeners() {
  document.getElementById("dateSelect").addEventListener("change", async (e) => {
    appState.activeDate = e.target.value;
    await loadRasterLayer();
    await updateColumnSounding(appState.selectedCoords.lat, appState.selectedCoords.lon);
    await updateTransect();
    document.getElementById("bulletinIframe").src = `/api/bulletin?date=${appState.activeDate}`;
  });

  document.querySelectorAll("#modelToggle .hud-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      document.querySelectorAll("#modelToggle .hud-toggle-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      appState.activeModel = btn.dataset.model;
      await loadRasterLayer();
    });
  });

  document.querySelectorAll("#layerSelector .btn-marine").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      document.querySelectorAll("#layerSelector .btn-marine").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      appState.activeLayer = btn.dataset.layer;
      
      const depthGroup = document.getElementById("depthControlGroup");
      if (appState.activeLayer === "tchp") {
        depthGroup.style.opacity = "0.3";
        depthGroup.style.pointerEvents = "none";
      } else {
        depthGroup.style.opacity = "1";
        depthGroup.style.pointerEvents = "auto";
      }
      
      await loadRasterLayer();
    });
  });

  document.querySelectorAll("#depthSelector .depth-chip").forEach((chip) => {
    chip.addEventListener("click", async (e) => {
      document.querySelectorAll("#depthSelector .depth-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      appState.activeDepth = parseInt(chip.dataset.depth, 10);
      if (appState.activeLayer !== "tchp") {
        await loadRasterLayer();
      }
    });
  });

  document.getElementById("hazardPerimeterToggle").addEventListener("change", (e) => {
    if (e.target.checked) {
      appState.hazardLayerGroup.addTo(appState.map);
    } else {
      appState.map.removeLayer(appState.hazardLayerGroup);
    }
  });

  document.getElementById("argoToggle").addEventListener("change", (e) => {
    if (e.target.checked) {
      appState.argoLayerGroup.addTo(appState.map);
    } else {
      appState.map.removeLayer(appState.argoLayerGroup);
    }
  });

  document.querySelectorAll(".drawer-tabs .drawer-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".drawer-tabs .drawer-tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      const pane = document.getElementById(btn.dataset.tab);
      if (pane) pane.classList.add("active");
    });
  });

  document.getElementById("transectLatSelect").addEventListener("change", (e) => {
    updateTransect(parseFloat(e.target.value));
  });

  document.getElementById("downloadCsvBtn").addEventListener("click", () => {
    const lat = appState.selectedCoords.lat;
    const lon = appState.selectedCoords.lon;
    window.open(`/api/export/csv?date=${appState.activeDate}&lat=${lat}&lon=${lon}`, "_blank");
  });

  document.getElementById("openBulletinBtn").addEventListener("click", () => {
    document.querySelectorAll(".drawer-tabs .drawer-tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));
    const bTab = document.querySelector('[data-tab="bulletinTab"]');
    if (bTab) bTab.classList.add("active");
    const bPane = document.getElementById("bulletinTab");
    if (bPane) bPane.classList.add("active");
  });

  document.getElementById("printBulletinBtn").addEventListener("click", () => {
    const ifr = document.getElementById("bulletinIframe");
    if (ifr && ifr.contentWindow) {
      ifr.contentWindow.print();
    }
  });
}

// Metadata Loading
async function loadMetadata() {
  try {
    const res = await fetch("/api/metadata");
    const data = await res.json();
    appState.metadata = data;

    const dateSelect = document.getElementById("dateSelect");
    dateSelect.innerHTML = "";
    data.available_dates.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      dateSelect.appendChild(opt);
    });
    dateSelect.value = appState.activeDate;

    const latSelect = document.getElementById("transectLatSelect");
    latSelect.innerHTML = "";
    [8.125, 11.125, 14.375, 17.125, 19.625].forEach((lat) => {
      const opt = document.createElement("option");
      opt.value = lat;
      opt.textContent = `${lat.toFixed(2)}°N`;
      if (Math.abs(lat - 14.375) < 0.1) opt.selected = true;
      latSelect.appendChild(opt);
    });

  } catch (err) {
    console.error("Failed to load metadata:", err);
  }
}

// Raster Layer Generator
async function loadRasterLayer() {
  try {
    let url, fieldData, minVal, maxVal, header, palette;

    if (appState.activeLayer === "tchp") {
      url = `/api/diagnostics/tchp?date=${appState.activeDate}`;
      const res = await fetch(url);
      const data = await res.json();
      fieldData = data.tchp_grid;
      minVal = 0.0;
      maxVal = 125.0;
      header = "Tropical Cyclone Heat Potential (kJ/cm²)";
      palette = PALETTES.tchp;

    } else if (appState.activeLayer === "acoustics") {
      url = `/api/predict?date=${appState.activeDate}&depth=${appState.activeDepth}`;
      const res = await fetch(url);
      const data = await res.json();
      // Calculate sound speeds across grid
      const tempGrid = data.temperature_grid;
      const H = tempGrid.length;
      const W = tempGrid[0].length;
      fieldData = [];
      minVal = 1490.0;
      maxVal = 1546.0;
      for (let i = 0; i < H; i++) {
        fieldData[i] = [];
        for (let j = 0; j < W; j++) {
          const t = tempGrid[i][j];
          fieldData[i][j] = (t > 0) ? (1448.96 + 4.591 * t - 0.05304 * t * t + 0.0163 * appState.activeDepth) : 0;
        }
      }
      header = `Naval Sound Velocity C(z) at ${appState.activeDepth}m (m/s)`;
      palette = PALETTES.acoustics;

    } else if (appState.activeLayer === "uncertainty") {
      url = `/api/predict?date=${appState.activeDate}&depth=${appState.activeDepth}`;
      const res = await fetch(url);
      const data = await res.json();
      fieldData = data.uncertainty_grid;
      minVal = 0.0;
      maxVal = 0.40;
      header = `MC Epistemic Uncertainty (±°C) at ${appState.activeDepth}m`;
      palette = PALETTES.uncertainty;

    } else {
      url = `/api/predict?date=${appState.activeDate}&depth=${appState.activeDepth}`;
      const res = await fetch(url);
      const data = await res.json();
      fieldData = data.temperature_grid;
      minVal = data.stats.min_c;
      maxVal = data.stats.max_c;
      header = `Subsurface Temperature (°C) at ${appState.activeDepth}m`;
      palette = PALETTES.temp;
    }

    document.getElementById("legendHeader").textContent = header;
    document.getElementById("legMin").textContent = `${minVal.toFixed(1)}`;
    document.getElementById("legMid").textContent = `${((minVal + maxVal) / 2).toFixed(1)}`;
    document.getElementById("legMax").textContent = `${maxVal.toFixed(1)}`;

    drawRasterCanvas(fieldData, minVal, maxVal, palette);
    await drawHazardPerimeter();

  } catch (err) {
    console.error("Failed to load raster layer:", err);
  }
}

function drawRasterCanvas(grid2d, minVal, maxVal, palette) {
  const nLat = grid2d.length;
  const nLon = grid2d[0].length;

  const canvas = document.createElement("canvas");
  canvas.width = nLon;
  canvas.height = nLat;
  const ctx = canvas.getContext("2d");
  const imgData = ctx.createImageData(nLon, nLat);

  const range = maxVal - minVal || 1e-6;

  for (let i = 0; i < nLat; i++) {
    for (let j = 0; j < nLon; j++) {
      const row = nLat - 1 - i;
      const pixelIdx = (row * nLon + j) * 4;
      const val = grid2d[i][j];

      if (val === 0.0) {
        imgData.data[pixelIdx + 3] = 0; // Transparent land
      } else {
        const norm = (val - minVal) / range;
        const [r, g, b] = interpolateColor(norm, palette);
        imgData.data[pixelIdx] = r;
        imgData.data[pixelIdx + 1] = g;
        imgData.data[pixelIdx + 2] = b;
        imgData.data[pixelIdx + 3] = 205;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const bounds = [
    [5.125, 80.125],
    [21.875, 94.875]
  ];

  if (appState.canvasOverlay) {
    appState.map.removeLayer(appState.canvasOverlay);
  }

  appState.canvasOverlay = L.imageOverlay(canvas.toDataURL(), bounds, {
    opacity: 0.88,
    interactive: false
  }).addTo(appState.map);
}

// Hazard Vector Perimeter Outline
async function drawHazardPerimeter() {
  try {
    const res = await fetch(`/api/export/geojson?date=${appState.activeDate}&threshold=80.0`);
    const geojson = await res.json();
    
    appState.hazardLayerGroup.clearLayers();
    
    // Render hazard boundary
    L.geoJSON(geojson, {
      style: {
        color: "#ef4444",
        weight: 0.8,
        fillColor: "#ef4444",
        fillOpacity: 0.18
      }
    }).addTo(appState.hazardLayerGroup);

  } catch (err) {
    console.error("Failed to draw hazard perimeter:", err);
  }
}

// ARGO Buoy Fleet
async function loadARGOFloats() {
  try {
    const res = await fetch("/api/argo/matchups");
    const data = await res.json();
    appState.argoData = data;
    appState.argoLayerGroup.clearLayers();

    data.matchup_profiles.forEach((prof) => {
      const buoyIcon = L.divIcon({
        className: "custom-buoy-icon",
        html: `<div title="WMO ${prof.wmo_id}" style="width:11px;height:11px;background:#10b981;border:2px solid #fff;border-radius:50%;cursor:pointer;"></div>`,
        iconSize: [11, 11],
        iconAnchor: [5, 5]
      });

      const marker = L.marker([prof.latitude, prof.longitude], { icon: buoyIcon });
      marker.on("click", () => {
        selectARGOStation(prof);
      });
      appState.argoLayerGroup.addLayer(marker);
    });

  } catch (err) {
    console.error("Failed to load ARGO fleet:", err);
  }
}

function selectARGOStation(prof) {
  appState.selectedFloat = prof;
  appState.selectedCoords = { lat: prof.latitude, lon: prof.longitude };
  appState.probeMarker.setLatLng([prof.latitude, prof.longitude]);

  document.getElementById("argoCard").style.display = "block";
  document.getElementById("argoWmoId").textContent = `WMO ${prof.wmo_id} (${prof.date})`;
  document.getElementById("argoRmseVal").textContent = `${prof.profile_rmse_c.toFixed(3)}°C`;
  document.getElementById("argoD26Val").textContent = `${Math.abs(prof.d26_diff_m).toFixed(1)} m`;
  document.getElementById("argoTchpVal").textContent = `${Math.abs(prof.tchp_diff_kj_cm2).toFixed(1)} kJ/cm²`;

  updateColumnSounding(prof.latitude, prof.longitude, prof);
}

// Column Sounding & Acoustics Update
async function updateColumnSounding(lat, lon, argoProf = null) {
  try {
    const [pRes, aRes] = await Promise.all([
      fetch(`/api/profile?date=${appState.activeDate}&lat=${lat}&lon=${lon}`),
      fetch(`/api/acoustics?date=${appState.activeDate}&lat=${lat}&lon=${lon}`)
    ]);
    const pData = await pRes.json();
    const aData = await aRes.json();

    document.getElementById("probeLocationText").textContent = `${pData.grid_coords.lat}°N, ${pData.grid_coords.lon}°E (Cell [${pData.grid_coords.i}, ${pData.grid_coords.j}]) &bull; ${pData.is_ocean ? "Valid Sea Domain" : "Coastline/Land"}`;
    document.getElementById("kpiD26").innerHTML = `${pData.d26_m} <span class="unit">m</span>`;
    document.getElementById("kpiTCHP").innerHTML = `${pData.tchp_kj_cm2} <span class="unit">kJ/cm²</span>`;
    document.getElementById("kpiSLD").innerHTML = `${aData.sonic_layer_depth_m.toFixed(1)} <span class="unit">m</span>`;
    document.getElementById("kpiDuct").innerHTML = `+${aData.surface_duct_strength_mps.toFixed(2)} <span class="unit">m/s</span>`;
    document.getElementById("tacticalAssessmentText").innerHTML = `<strong>TACTICAL NAVAL ASSESSMENT:</strong> ${aData.tactical_assessment}`;

    // Risk badge
    const rBadge = document.getElementById("probeRiskBadge");
    if (pData.tchp_kj_cm2 >= 80.0) {
      rBadge.className = "hazard-badge hazard-critical";
      rBadge.textContent = `TCHP: ${pData.tchp_kj_cm2} kJ/cm² (CRITICAL RI RISK)`;
    } else if (pData.tchp_kj_cm2 >= 50.0) {
      rBadge.className = "hazard-badge hazard-moderate";
      rBadge.textContent = `TCHP: ${pData.tchp_kj_cm2} kJ/cm² (MODERATE RISK)`;
    } else {
      rBadge.className = "hazard-badge hazard-low";
      rBadge.textContent = `TCHP: ${pData.tchp_kj_cm2} kJ/cm² (LOW RISK)`;
    }

    // Update Profile Chart
    appState.profileChart.data.datasets[0].data = pData.temperatures_c;
    appState.profileChart.data.datasets[1].data = pData.climatology_c;

    if (argoProf) {
      appState.profileChart.data.datasets[2].hidden = false;
      appState.profileChart.data.datasets[2].data = [
        argoProf.argo_ctd_temps[0],
        argoProf.argo_ctd_temps[4],
        argoProf.argo_ctd_temps[7],
        argoProf.argo_ctd_temps[11],
        argoProf.argo_ctd_temps[15],
        argoProf.argo_ctd_temps[20]
      ];
    } else {
      appState.profileChart.data.datasets[2].hidden = true;
      document.getElementById("argoCard").style.display = "none";
    }
    appState.profileChart.update();

    // Update Sound Chart
    appState.soundChart.data.datasets[0].data = aData.sound_velocities_mps;
    appState.soundChart.update();

  } catch (err) {
    console.error("Failed to update sounding telemetry:", err);
  }
}

// Zonal Transect Update
async function updateTransect(lat = 14.375) {
  try {
    const res = await fetch(`/api/transect?date=${appState.activeDate}&lat=${lat}`);
    const data = await res.json();

    document.getElementById("transectHeaderSub").textContent = `Cross-Section along ${data.latitude}°N across Bay of Bengal (${data.longitudes[0]}°E to ${data.longitudes[data.longitudes.length-1]}°E)`;

    const step = 2;
    const lonsSampled = [];
    const layerData = [[], [], [], [], []];

    for (let j = 0; j < data.longitudes.length; j += step) {
      if (data.longitude_mask[j] === 1) {
        lonsSampled.push(`${data.longitudes[j].toFixed(1)}°E`);
        for (let k = 0; k < 5; k++) {
          layerData[k].push(data.section_temperatures[k][j]);
        }
      }
    }

    appState.transectChart.data.labels = lonsSampled;
    for (let k = 0; k < 5; k++) {
      appState.transectChart.data.datasets[k].data = layerData[k];
    }
    appState.transectChart.update();

  } catch (err) {
    console.error("Failed to update transect:", err);
  }
}

// Scientific Validation Matrix
async function loadBenchmarks() {
  try {
    const res = await fetch("/api/benchmarks");
    const data = await res.json();
    appState.benchData = data;

    const tbody = document.getElementById("benchmarkTableBody");
    tbody.innerHTML = "";

    const depthLabels = ["0m (SST)", "50m (Upper TC)", "100m (TC Core)", "200m (Lower TC)", "500m (Intermediate)", "1000m (Deep)"];
    const clim = data["Climatology Prior"].depth_rmses_c;
    const sstLin = data["SST-Linear"].depth_rmses_c;
    const multi = data["Multi-Source Regressor"].depth_rmses_c;
    const core6 = data["OceanEmbed Core-6"].depth_rmses_c;
    const core7 = data["OceanEmbed Core-7 (+SSS)"] ? data["OceanEmbed Core-7 (+SSS)"].depth_rmses_c : core6;
    const ss = data["OceanEmbed Core-6"].depth_skill_scores;

    for (let k = 0; k < 6; k++) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${depthLabels[k]}</strong></td>
        <td>${clim[k].toFixed(4)}°C</td>
        <td>${sstLin[k].toFixed(4)}°C</td>
        <td>${multi[k].toFixed(4)}°C</td>
        <td style="color:#06b6d4;font-weight:bold;">${core6[k].toFixed(4)}°C</td>
        <td style="color:#10b981;font-weight:bold;">${core7[k].toFixed(4)}°C</td>
        <td style="color:${ss[k] >= 0 ? '#10b981' : '#f87171'};font-weight:bold;">${ss[k] >= 0 ? '+' : ''}${ss[k].toFixed(2)}</td>
      `;
      tbody.appendChild(tr);
    }

    document.getElementById("benchSsTc").textContent = `+${data["OceanEmbed Core-6"].skill_score_thermocline.toFixed(3)}`;
    document.getElementById("benchSsOverall").textContent = `+${data["OceanEmbed Core-7 (+SSS)"] ? data["OceanEmbed Core-7 (+SSS)"].skill_score_overall.toFixed(3) : data["OceanEmbed Core-6"].skill_score_overall.toFixed(3)}`;

  } catch (err) {
    console.error("Failed to load benchmarks:", err);
  }
}
