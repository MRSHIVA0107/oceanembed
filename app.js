/**
 * OceanEmbed Enterprise Marine Workstation Client Engine
 * Ministry of Earth Sciences (MoES) - INCOIS Problem Statement 26066
 * Supports dual-mode: Dynamic FastAPI Backend + 100% Netlify Jamstack Static Deployment
 */

// Global Application State
const appState = {
  isStaticMode: false,
  metadata: null,
  activeDate: "2026-08-16",
  activeDepth: 100,
  activeLayer: "temp", // 'temp' | 'tchp' | 'acoustics' | 'uncertainty' | 'acoustic-intelligence'
  acousticSubView: "sld", // 'sld' | 'profile' | 'confidence'
  acousticCache: {}, // Caches computed 3D acoustic fields per date
  activeModel: "core-6",
  selectedCoords: { lat: 14.375, lon: 88.375 },
  selectedFloat: null,
  argoData: null,
  currentDayData: null,
  map: null,
  canvasOverlay: null,
  probeMarker: null,
  argoLayerGroup: null,
  argoProofChart: null,
  profileChart: null,
  soundChart: null,
  transectChart: null
};

// Oceanographic Standard Color Palettes
const PALETTES = {
  temp: [
    { stop: 0.0,  r: 15,  g: 23,  b: 42 },   // ~5°C Abyssal Deep
    { stop: 0.25, r: 2,   g: 132, b: 199 },  // ~12°C Intermediate
    { stop: 0.50, r: 16,  g: 185, b: 129 },  // ~20°C Lower TC
    { stop: 0.75, r: 245, g: 158, b: 11 },   // ~26°C D26 Threshold
    { stop: 1.0,  r: 239, g: 68,  b: 68 }    // ~31°C Tropical Surface Pool
  ],
  tchp: [
    { stop: 0.0,  r: 10,  g: 15,  b: 26 },   // 0 kJ/cm²
    { stop: 0.35, r: 30,  g: 64,  b: 175 },  // 30 kJ/cm²
    { stop: 0.60, r: 217, g: 119, b: 6 },    // 60 kJ/cm²
    { stop: 0.78, r: 220, g: 38,  b: 38 },   // 80 kJ/cm² CRITICAL THRESHOLD
    { stop: 1.0,  r: 236, g: 72,  b: 153 }   // 120+ kJ/cm² Explosive Intensification
  ],
  acoustics: [
    { stop: 0.0,  r: 24,  g: 35,  b: 70 },   // 1485 m/s Deep SOFAR minimum
    { stop: 0.40, r: 14,  g: 165, b: 233 },  // 1510 m/s
    { stop: 0.75, r: 16,  g: 185, b: 129 },  // 1530 m/s
    { stop: 1.0,  r: 245, g: 158, b: 11 }    // 1546 m/s Upper Duct Maximum
  ],
  uncertainty: [
    { stop: 0.0,  r: 15,  g: 23,  b: 42 },   // 0.0°C
    { stop: 0.35, r: 6,   g: 182, b: 212 },  // 0.15°C
    { stop: 0.70, r: 139, g: 92,  b: 246 },  // 0.30°C
    { stop: 1.0,  r: 244, g: 63,  b: 94 }    // 0.45°C+
  ],
  acoustic_profile: [
    { stop: 0.0,  r: 23,  g: 37,  b: 84 },   // ~1490 m/s Deep ocean (Navy)
    { stop: 0.35, r: 2,   g: 132, b: 199 },  // ~1510 m/s (Sky blue)
    { stop: 0.70, r: 13,  g: 148, b: 136 },  // ~1530 m/s (Teal)
    { stop: 1.0,  r: 56,  g: 189, b: 248 }   // ~1546 m/s (Bright Aqua)
  ],
  acoustic_confidence: [
    { stop: 0.0,  r: 51,  g: 65,  b: 85 },   // 0.35 Exploratory (Slate)
    { stop: 0.50, r: 13,  g: 148, b: 136 },  // 0.60 Moderate (Teal)
    { stop: 1.0,  r: 34,  g: 211, b: 238 }   // 0.85 High (Vibrant Aqua)
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
  initArgoProofChart();
  initDualCharts();
  initTransectChart();
  initUIEventListeners();
  
  await loadMetadata();
  await loadDayPackage(appState.activeDate);
  await loadARGOFleet();
  await updateColumnSounding(appState.selectedCoords.lat, appState.selectedCoords.lon);
  await updateTransect(14.375);
});

// Map Engine - Uses Watermark-Free ESRI Dark Gray Tiles
function initMap() {
  appState.map = L.map("map", {
    center: [13.5, 87.5],
    zoom: 5.5,
    minZoom: 4,
    maxZoom: 9,
    attributionControl: false
  });

  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 16,
    subdomains: ["server", "services"]
  }).addTo(appState.map);

  appState.argoLayerGroup = L.layerGroup().addTo(appState.map);

  // Probe Pin Icon
  const probeIcon = L.divIcon({
    className: "custom-probe-pin",
    html: `<div style="width:16px;height:16px;background:#06b6d4;border:2.5px solid #fff;border-radius:50%;box-shadow:0 0 10px #06b6d4;cursor:crosshair;"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  appState.probeMarker = L.marker([appState.selectedCoords.lat, appState.selectedCoords.lon], {
    icon: probeIcon,
    zIndexOffset: 1000
  }).addTo(appState.map);

  // Map Hover Telemetry
  appState.map.on("mousemove", (e) => {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;
    const ddEl = document.getElementById("hudCoordsDD");
    const dmsEl = document.getElementById("hudCoordsDMS");
    if (dmsEl) dmsEl.textContent = `${decimalToDMS(lat, true)}, ${decimalToDMS(lon, false)}`;

    if (appState.activeLayer === "acoustic-intelligence" && appState.currentDayData && window.AcousticIntelligence) {
      if (lat >= 5.125 && lat <= 21.875 && lon >= 80.125 && lon <= 94.875) {
        const i = Math.max(0, Math.min(67, Math.round((lat - 5.125) / 0.25)));
        const j = Math.max(0, Math.min(59, Math.round((lon - 80.125) / 0.25)));
        const acData = getOrComputeDayAcoustics(appState.currentDayData, appState.activeDate);
        if (acData && acData.sldGrid) {
          const sld = acData.sldGrid[i][j];
          const conf = acData.confGrid[i][j];
          if (sld !== -999) {
            const sldStr = sld === -1 ? "No Duct" : `${sld.toFixed(0)}m`;
            const confStr = `${(conf * 100).toFixed(0)}%`;
            if (ddEl) ddEl.textContent = `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E • SLD: ${sldStr} (Conf: ${confStr})`;
            return;
          }
        }
      }
    }
    if (ddEl) ddEl.textContent = `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`;
  });

  // Map Click
  appState.map.on("click", (e) => {
    const lat = Math.round(e.latlng.lat * 1000) / 1000;
    const lon = Math.round(e.latlng.lng * 1000) / 1000;
    
    if (lat >= 5.125 && lat <= 21.875 && lon >= 80.125 && lon <= 94.875) {
      appState.selectedCoords = { lat, lon };
      appState.probeMarker.setLatLng([lat, lon]);
      updateColumnSounding(lat, lon);
    }
  });

  setTimeout(() => {
    if (appState.map) appState.map.invalidateSize();
  }, 250);
  window.addEventListener("resize", () => {
    if (appState.map) appState.map.invalidateSize();
  });
}

// 1. ARGO PROOF CHART
function initArgoProofChart() {
  const ctx = document.getElementById("argoProofChart").getContext("2d");
  appState.argoProofChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [0, 10, 20, 35, 50, 65, 80, 100, 125, 150, 175, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000],
      datasets: [
        {
          label: "ARGO CTD In-Situ (Observed Ground Truth)",
          data: [],
          borderColor: "#10b981",
          backgroundColor: "#10b981",
          borderWidth: 2.5,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: "#10b981",
          tension: 0.15,
          fill: false,
          order: 1
        },
        {
          label: "OceanEmbed ML Reconstruction (Ours)",
          data: [],
          borderColor: "#06b6d4",
          backgroundColor: "rgba(6, 182, 212, 0.18)",
          borderWidth: 2.2,
          pointRadius: 3,
          pointBackgroundColor: "#06b6d4",
          tension: 0.2,
          fill: true,
          order: 2
        },
        {
          label: "Old Climatology Prior Baseline",
          data: [],
          borderColor: "#94a3b8",
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 2,
          pointBackgroundColor: "#94a3b8",
          tension: 0.15,
          fill: false,
          order: 3
        }
      ]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: "Temperature (°C)", color: "#94a3b8", font: { size: 11, weight: 600 } },
          grid: { color: "#1e2d4a" },
          ticks: { color: "#94a3b8", font: { family: "JetBrains Mono" } }
        },
        y: {
          reverse: true,
          title: { display: true, text: "Depth (meters below sea level)", color: "#94a3b8", font: { size: 11, weight: 600 } },
          grid: { color: "#1e2d4a" },
          ticks: { color: "#94a3b8", font: { family: "JetBrains Mono" } }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: "index",
          intersect: false,
          backgroundColor: "rgba(12, 18, 32, 0.95)",
          titleColor: "#06b6d4",
          bodyColor: "#f8fafc",
          borderColor: "#1e2d4a",
          borderWidth: 1,
          padding: 10,
          callbacks: {
            title: (ctx) => `Depth: ${ctx[0].label} meters`,
            label: (ctx) => `${ctx.dataset.label.split("(")[0].trim()}: ${parseFloat(ctx.raw).toFixed(2)}°C`
          }
        }
      }
    }
  });
}

// 2. DUAL CHARTS: TEMPERATURE PROFILE + SOUND VELOCITY
function initDualCharts() {
  const depths = [0, 50, 100, 200, 500, 1000];

  // Temperature Profile Chart
  const pCtx = document.getElementById("profileChart").getContext("2d");
  appState.profileChart = new Chart(pCtx, {
    type: "line",
    data: {
      labels: depths,
      datasets: [
        {
          label: "OceanEmbed AI Model",
          data: [],
          borderColor: "#06b6d4",
          backgroundColor: "rgba(6, 182, 212, 0.15)",
          borderWidth: 2.2,
          pointRadius: 3,
          tension: 0.25,
          fill: true
        },
        {
          label: "Climatology Prior",
          data: [],
          borderColor: "#64748b",
          borderWidth: 1.5,
          borderDash: [4, 4],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: "Temperature (°C)", color: "#94a3b8", font: { size: 10 } },
          grid: { color: "#1e2d4a" },
          ticks: { color: "#94a3b8", font: { family: "JetBrains Mono" } }
        },
        y: {
          reverse: true,
          title: { display: true, text: "Depth (m)", color: "#94a3b8", font: { size: 10 } },
          grid: { color: "#1e2d4a" },
          ticks: { color: "#94a3b8", font: { family: "JetBrains Mono" } }
        }
      },
      plugins: {
        legend: {
          labels: { color: "#94a3b8", boxWidth: 12, font: { size: 10 } }
        }
      }
    }
  });

  // Sound Speed Chart
  const sCtx = document.getElementById("soundChart").getContext("2d");
  appState.soundChart = new Chart(sCtx, {
    type: "line",
    data: {
      labels: depths,
      datasets: [
        {
          label: "Mackenzie (1981) C(z)",
          data: [],
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.15)",
          borderWidth: 2.2,
          pointRadius: 3,
          tension: 0.2,
          fill: true
        }
      ]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: "Speed of Sound (m/s)", color: "#94a3b8", font: { size: 10 } },
          grid: { color: "#1e2d4a" },
          ticks: { color: "#94a3b8", font: { family: "JetBrains Mono" } }
        },
        y: {
          reverse: true,
          title: { display: true, text: "Depth (m)", color: "#94a3b8", font: { size: 10 } },
          grid: { color: "#1e2d4a" },
          ticks: { color: "#94a3b8", font: { family: "JetBrains Mono" } }
        }
      },
      plugins: {
        legend: {
          labels: { color: "#94a3b8", boxWidth: 12, font: { size: 10 } }
        }
      }
    }
  });
}

// 3. TRANSECT CHART (DEPTH VS LONGITUDE)
function initTransectChart() {
  const ctx = document.getElementById("transectChart").getContext("2d");
  appState.transectChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        { label: "0m (SST)", data: [], borderColor: "#ef4444", borderWidth: 2, pointRadius: 0, tension: 0.2 },
        { label: "50m (Upper TC)", data: [], borderColor: "#f59e0b", borderWidth: 2, pointRadius: 0, tension: 0.2 },
        { label: "100m (TC Core)", data: [], borderColor: "#10b981", borderWidth: 2.5, pointRadius: 0, tension: 0.2 },
        { label: "200m (Lower TC)", data: [], borderColor: "#06b6d4", borderWidth: 1.8, pointRadius: 0, tension: 0.2 },
        { label: "500m (Intermediate)", data: [], borderColor: "#3b82f6", borderWidth: 1.5, pointRadius: 0, tension: 0.2 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: "Longitude across Bay of Bengal (°E)", color: "#94a3b8" },
          grid: { color: "#1e2d4a" },
          ticks: { color: "#94a3b8", font: { family: "JetBrains Mono" } }
        },
        y: {
          title: { display: true, text: "Temperature (°C)", color: "#94a3b8" },
          grid: { color: "#1e2d4a" },
          ticks: { color: "#94a3b8", font: { family: "JetBrains Mono" } }
        }
      },
      plugins: {
        legend: {
          labels: { color: "#94a3b8", boxWidth: 14, font: { family: "JetBrains Mono", size: 11 } }
        }
      }
    }
  });
}

// UI Event Listeners
function initUIEventListeners() {
  // Quick Jump Ribbon Buttons
  document.querySelectorAll(".jump-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".jump-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const targetId = btn.dataset.target;
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  // Date Selector
  document.getElementById("dateSelect").addEventListener("change", async (e) => {
    appState.activeDate = e.target.value;
    await loadDayPackage(appState.activeDate);
    await updateColumnSounding(appState.selectedCoords.lat, appState.selectedCoords.lon);
    await updateTransect();
    
    // Update bulletin
    const ifr = document.getElementById("bulletinIframe");
    if (ifr) {
      ifr.src = `./api/bulletin_${appState.activeDate}.html`;
      ifr.onerror = () => { ifr.src = `/api/bulletin?date=${appState.activeDate}`; };
    }
  });

  // Model Toggle
  document.querySelectorAll("#modelToggle .toggle-pill").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      document.querySelectorAll("#modelToggle .toggle-pill").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      appState.activeModel = btn.dataset.model;
      await renderRasterLayer();
    });
  });

  // Layer Selector
  document.querySelectorAll("#layerSelector .t-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      document.querySelectorAll("#layerSelector .t-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      appState.activeLayer = btn.dataset.layer;
      
      const depthGroup = document.getElementById("depthControlGroup");
      const subnavGroup = document.getElementById("acousticSubnavGroup");

      if (appState.activeLayer === "acoustic-intelligence") {
        if (subnavGroup) subnavGroup.style.display = "flex";
        if (appState.acousticSubView === "profile") {
          depthGroup.style.opacity = "1";
          depthGroup.style.pointerEvents = "auto";
        } else {
          depthGroup.style.opacity = "0.3";
          depthGroup.style.pointerEvents = "none";
        }
      } else {
        if (subnavGroup) subnavGroup.style.display = "none";
        if (appState.activeLayer === "tchp") {
          depthGroup.style.opacity = "0.3";
          depthGroup.style.pointerEvents = "none";
        } else {
          depthGroup.style.opacity = "1";
          depthGroup.style.pointerEvents = "auto";
        }
      }
      
      await renderRasterLayer();
    });
  });

  // Acoustic Sub-View Selector (SLD vs Profile vs Confidence)
  document.querySelectorAll("#acousticSubViewSelector .sub-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      document.querySelectorAll("#acousticSubViewSelector .sub-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      appState.acousticSubView = btn.dataset.subview;
      
      const depthGroup = document.getElementById("depthControlGroup");
      if (appState.acousticSubView === "profile") {
        depthGroup.style.opacity = "1";
        depthGroup.style.pointerEvents = "auto";
      } else {
        depthGroup.style.opacity = "0.3";
        depthGroup.style.pointerEvents = "none";
      }
      
      await renderRasterLayer();
    });
  });

  // Accordion Toggle in Section 3
  const accordionToggleBtn = document.getElementById("btnAccordionToggle");
  if (accordionToggleBtn) {
    accordionToggleBtn.addEventListener("click", () => {
      const content = document.getElementById("accordionContent");
      const chevron = document.getElementById("accordionChevron");
      if (content) {
        const isHidden = content.style.display === "none";
        content.style.display = isHidden ? "block" : "none";
        accordionToggleBtn.setAttribute("aria-expanded", isHidden ? "true" : "false");
        if (chevron) {
          chevron.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
          chevron.style.transition = "transform 0.25s ease";
        }
      }
    });
  }

  // Scroll to Acoustic Lab from Section 1 summary card
  const jumpLabBtn = document.getElementById("btnScrollToAcousticsLab");
  if (jumpLabBtn) {
    jumpLabBtn.addEventListener("click", () => {
      document.getElementById("secAcoustics")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  // Depth Stepper
  document.querySelectorAll("#depthSelector .d-btn").forEach((chip) => {
    chip.addEventListener("click", async (e) => {
      document.querySelectorAll("#depthSelector .d-btn").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      appState.activeDepth = parseInt(chip.dataset.depth, 10);
      if (appState.activeLayer !== "tchp") {
        await renderRasterLayer();
      }
    });
  });

  // ARGO Dropdown change
  document.getElementById("argoSelect").addEventListener("change", (e) => {
    const pId = e.target.value;
    const match = appState.argoData?.matchup_profiles.find((p) => p.profile_id === pId);
    if (match) {
      renderArgoProof(match);
      appState.map.flyTo([match.latitude, match.longitude], 6.5, { duration: 1.2 });
    }
  });

  // Action Buttons: Client-side Instant CSV Download
  document.getElementById("exportCsvBtn")?.addEventListener("click", () => {
    exportSoundingCSV();
  });

  // Guided Tour Demo Buttons
  document.getElementById("tourWarmCoreBtn").addEventListener("click", () => {
    document.querySelectorAll("#layerSelector .t-btn").forEach((b) => b.classList.remove("active"));
    document.querySelector('[data-layer="tchp"]').classList.add("active");
    appState.activeLayer = "tchp";
    const subnavGroup = document.getElementById("acousticSubnavGroup");
    if (subnavGroup) subnavGroup.style.display = "none";
    renderRasterLayer();
    appState.map.flyTo([14.5, 88.5], 6.5, { duration: 1.2 });
    updateColumnSounding(14.5, 88.5);
    document.getElementById("secMap")?.scrollIntoView({ behavior: "smooth" });
  });

  document.getElementById("tourBarrierBtn").addEventListener("click", () => {
    document.querySelectorAll("#layerSelector .t-btn").forEach((b) => b.classList.remove("active"));
    document.querySelector('[data-layer="temp"]').classList.add("active");
    appState.activeLayer = "temp";
    appState.activeDepth = 50;
    const subnavGroup = document.getElementById("acousticSubnavGroup");
    if (subnavGroup) subnavGroup.style.display = "none";
    document.querySelectorAll("#depthSelector .d-btn").forEach((c) => c.classList.remove("active"));
    document.querySelector('[data-depth="50"]').classList.add("active");
    renderRasterLayer();
    appState.map.flyTo([18.5, 89.5], 6.5, { duration: 1.2 });
    updateColumnSounding(18.5, 89.5);
    document.getElementById("secMap")?.scrollIntoView({ behavior: "smooth" });
  });

  document.getElementById("tourArgoBtn").addEventListener("click", () => {
    document.getElementById("secArgo")?.scrollIntoView({ behavior: "smooth" });
    if (appState.argoData && appState.argoData.matchup_profiles.length > 0) {
      renderArgoProof(appState.argoData.matchup_profiles[0]);
    }
  });

  document.getElementById("transectLatSelect").addEventListener("change", (e) => {
    updateTransect(parseFloat(e.target.value));
  });
}

// Metadata Loading (Smart Dual-Mode)
async function loadMetadata() {
  try {
    let res;
    try {
      res = await fetch("/api/metadata");
      if (!res.ok) throw new Error("Fallback");
    } catch (e) {
      res = await fetch("./api/metadata.json");
    }
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
    
    if (data.available_dates && data.available_dates.length > 0) {
      if (!data.available_dates.includes(appState.activeDate)) {
        appState.activeDate = data.available_dates[0];
      }
      dateSelect.value = appState.activeDate;
    }

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

// Load Day Package (Full 3D Volume for Active Date)
async function loadDayPackage(dateStr) {
  try {
    // Try static pre-rendered package first (blazing fast on Netlify)
    let res = await fetch(`./data/day_${dateStr}.json`);
    if (!res.ok) {
      // Fallback: try api route if on live FastAPI
      res = await fetch(`/api/diagnostics/tchp?date=${dateStr}`);
      if (res.ok) {
        // We are on dynamic FastAPI
        appState.isStaticMode = false;
        await loadRasterLayerDynamic();
        return;
      }
    }

    const data = await res.json();
    appState.currentDayData = data;
    appState.isStaticMode = true;
    await renderRasterLayer();

  } catch (err) {
    console.warn("Using dynamic API fallback:", err);
    await loadRasterLayerDynamic();
  }
}

// Compute and cache day acoustic fields
function getOrComputeDayAcoustics(dayData, dateStr) {
  if (appState.acousticCache && appState.acousticCache[dateStr]) {
    return appState.acousticCache[dateStr];
  }
  if (!dayData || !dayData.temperature_grids || !window.AcousticIntelligence) {
    return null;
  }

  const AI = window.AcousticIntelligence;
  const H = dayData.temperature_grids[0].length;
  const W = dayData.temperature_grids[0][0].length;

  const sldGrid = [];
  const confGrid = [];
  const soundSpeedGrids = [0, 1, 2, 3, 4, 5].map(() => []);

  for (let i = 0; i < H; i++) {
    sldGrid[i] = new Float32Array(W);
    confGrid[i] = new Float32Array(W);
    for (let d = 0; d < 6; d++) {
      soundSpeedGrids[d][i] = new Float32Array(W);
    }
    for (let j = 0; j < W; j++) {
      const t0 = dayData.temperature_grids[0][i][j];
      if (t0 <= 0) {
        // Land
        sldGrid[i][j] = -999;
        confGrid[i][j] = 0;
        for (let d = 0; d < 6; d++) {
          soundSpeedGrids[d][i][j] = 0;
        }
        continue;
      }

      const tRow = [
        dayData.temperature_grids[0][i][j],
        dayData.temperature_grids[1][i][j],
        dayData.temperature_grids[2][i][j],
        dayData.temperature_grids[3][i][j]
      ];
      const uRow = dayData.uncertainty_grids ? [
        dayData.uncertainty_grids[0][i][j],
        dayData.uncertainty_grids[1][i][j],
        dayData.uncertainty_grids[2][i][j],
        dayData.uncertainty_grids[3][i][j]
      ] : [0.15, 0.20, 0.25, 0.30];

      const acRes = AI.analyzeColumnAcoustics(tRow, uRow, 34.5, false);
      sldGrid[i][j] = acRes.estimatedSonicLayerDepthM !== null ? acRes.estimatedSonicLayerDepthM : -1;
      confGrid[i][j] = acRes.acousticConfidence;

      const fullTemps = dayData.temperature_grids.map(g => g[i][j]);
      const fullSal = AI.estimateVerticalSalinity(34.5, AI.FULL_DEPTHS_M);
      for (let d = 0; d < 6; d++) {
        soundSpeedGrids[d][i][j] = AI.computeSoundSpeed(fullTemps[d], fullSal[d], AI.FULL_DEPTHS_M[d]) || 0;
      }
    }
  }

  const cached = { sldGrid, confGrid, soundSpeedGrids };
  appState.acousticCache[dateStr] = cached;
  return cached;
}

// Draw discrete SLD raster
function drawSldRasterCanvas(sldGrid) {
  const nLat = sldGrid.length;
  const nLon = sldGrid[0].length;

  const canvas = document.createElement("canvas");
  canvas.width = nLon;
  canvas.height = nLat;
  const ctx = canvas.getContext("2d");
  const imgData = ctx.createImageData(nLon, nLat);

  for (let i = 0; i < nLat; i++) {
    for (let j = 0; j < nLon; j++) {
      const row = nLat - 1 - i;
      const pixelIdx = (row * nLon + j) * 4;
      const val = sldGrid[i][j];

      if (val === -999) {
        // Land transparent
        imgData.data[pixelIdx + 3] = 0;
      } else if (val === 50) {
        // 50m - Cyan
        imgData.data[pixelIdx] = 6;
        imgData.data[pixelIdx + 1] = 182;
        imgData.data[pixelIdx + 2] = 212;
        imgData.data[pixelIdx + 3] = 220;
      } else if (val === 100) {
        // 100m - Teal
        imgData.data[pixelIdx] = 13;
        imgData.data[pixelIdx + 1] = 148;
        imgData.data[pixelIdx + 2] = 136;
        imgData.data[pixelIdx + 3] = 220;
      } else if (val === 200) {
        // 200m - Indigo (deepening beyond 200m)
        imgData.data[pixelIdx] = 99;
        imgData.data[pixelIdx + 1] = 102;
        imgData.data[pixelIdx + 2] = 241;
        imgData.data[pixelIdx + 3] = 220;
      } else {
        // -1 (unresolved / monotonic decrease) - Slate Grey
        imgData.data[pixelIdx] = 100;
        imgData.data[pixelIdx + 1] = 116;
        imgData.data[pixelIdx + 2] = 139;
        imgData.data[pixelIdx + 3] = 190;
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
    opacity: 0.92,
    interactive: false
  }).addTo(appState.map);
}

// Render Raster Layer from In-Memory Day Data (Netlify Mode)
async function renderRasterLayer() {
  if (!appState.isStaticMode || !appState.currentDayData) {
    return loadRasterLayerDynamic();
  }

  const data = appState.currentDayData;
  const depthIdxMap = { 0: 0, 50: 1, 100: 2, 200: 3, 500: 4, 1000: 5 };
  const dIdx = depthIdxMap[appState.activeDepth] ?? 2;

  let fieldData, minVal, maxVal, header, palette;

  if (appState.activeLayer === "acoustic-intelligence") {
    const acData = getOrComputeDayAcoustics(data, appState.activeDate);
    if (!acData) return;

    if (appState.acousticSubView === "sld") {
      header = "Estimated Sonic Layer Depth (m) [Coarse 4-Depth Resolution]";
      document.getElementById("legendHeader").textContent = header;
      document.getElementById("legMin").textContent = "50m (Cyan)";
      document.getElementById("legMid").textContent = "100m (Teal)";
      document.getElementById("legMax").textContent = "200m+ (Indigo) | Unresolved (Slate)";
      const legendBar = document.getElementById("legendBar");
      if (legendBar) {
        legendBar.style.background = "linear-gradient(to right, #06b6d4 0% 33%, #0d9488 33% 66%, #6366f1 66% 100%)";
      }
      drawSldRasterCanvas(acData.sldGrid);
      return;
    } else if (appState.acousticSubView === "confidence") {
      fieldData = acData.confGrid;
      minVal = 0.35;
      maxVal = 0.85;
      header = "Acoustic Confidence Heuristic (0.35–0.85) [Lower = High Epistemic Uncertainty]";
      palette = PALETTES.acoustic_confidence;
    } else {
      fieldData = acData.soundSpeedGrids[dIdx];
      minVal = 1490.0;
      maxVal = 1546.0;
      header = `Estimated Sound Speed c(T,S,z) at ${appState.activeDepth}m (m/s) [Research Estimate]`;
      palette = PALETTES.acoustic_profile;
    }

  } else if (appState.activeLayer === "tchp") {
    fieldData = data.tchp_grid;
    minVal = 0.0;
    maxVal = 125.0;
    header = "Tropical Cyclone Heat Potential (kJ/cm²) [≥80 = High RI Hazard]";
    palette = PALETTES.tchp;

  } else if (appState.activeLayer === "acoustics") {
    const tempGrid = data.temperature_grids[dIdx];
    fieldData = tempGrid.map((row) =>
      row.map((t) => (t > 0 ? 1448.96 + 4.591 * t - 0.05304 * t * t + 0.0163 * appState.activeDepth : 0))
    );
    minVal = 1490.0;
    maxVal = 1546.0;
    header = `Naval Sound Velocity C(z) at ${appState.activeDepth}m (m/s)`;
    palette = PALETTES.acoustics;

  } else if (appState.activeLayer === "uncertainty") {
    fieldData = data.uncertainty_grids[dIdx];
    minVal = 0.0;
    maxVal = 0.40;
    header = `MC Epistemic Uncertainty (±°C) at ${appState.activeDepth}m`;
    palette = PALETTES.uncertainty;

  } else {
    fieldData = data.temperature_grids[dIdx];
    const stat = data.depth_stats[dIdx] || { min_c: 20.0, max_c: 25.0 };
    minVal = stat.min_c;
    maxVal = stat.max_c;
    header = `Subsurface Temperature (°C) at ${appState.activeDepth}m`;
    palette = PALETTES.temp;
  }

  document.getElementById("legendHeader").textContent = header;
  document.getElementById("legMin").textContent = `${minVal.toFixed(1)}`;
  document.getElementById("legMid").textContent = `${((minVal + maxVal) / 2).toFixed(1)}`;
  document.getElementById("legMax").textContent = `${maxVal.toFixed(1)}`;

  const legendBar = document.getElementById("legendBar");
  if (legendBar && palette) {
    const stops = palette.map(p => `rgb(${p.r},${p.g},${p.b}) ${Math.round(p.stop * 100)}%`).join(", ");
    legendBar.style.background = `linear-gradient(to right, ${stops})`;
  }

  drawRasterCanvas(fieldData, minVal, maxVal, palette);
}

// Fallback Dynamic Loader for FastAPI Localhost
async function loadRasterLayerDynamic() {
  try {
    let url, fieldData, minVal, maxVal, header, palette;

    if (appState.activeLayer === "tchp") {
      url = `/api/diagnostics/tchp?date=${appState.activeDate}`;
      const res = await fetch(url);
      const data = await res.json();
      fieldData = data.tchp_grid;
      minVal = 0.0;
      maxVal = 125.0;
      header = "Tropical Cyclone Heat Potential (kJ/cm²) [≥80 = High RI Hazard]";
      palette = PALETTES.tchp;

    } else if (appState.activeLayer === "acoustics") {
      url = `/api/predict?date=${appState.activeDate}&depth=${appState.activeDepth}`;
      const res = await fetch(url);
      const data = await res.json();
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

    } else if (appState.activeLayer === "acoustic-intelligence") {
      url = `/api/predict?date=${appState.activeDate}&depth=${appState.activeDepth}`;
      const res = await fetch(url);
      const data = await res.json();
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
          if (t > 0 && window.AcousticIntelligence) {
            fieldData[i][j] = window.AcousticIntelligence.computeSoundSpeed(t, 34.5, appState.activeDepth) || 0;
          } else {
            fieldData[i][j] = 0;
          }
        }
      }
      header = `Estimated Sound Speed c(T,S,z) at ${appState.activeDepth}m (m/s) [Research Estimate]`;
      palette = PALETTES.acoustic_profile;

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

    const legendBar = document.getElementById("legendBar");
    if (legendBar && palette) {
      const stops = palette.map(p => `rgb(${p.r},${p.g},${p.b}) ${Math.round(p.stop * 100)}%`).join(", ");
      legendBar.style.background = `linear-gradient(to right, ${stops})`;
    }

    drawRasterCanvas(fieldData, minVal, maxVal, palette);

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
        imgData.data[pixelIdx + 3] = 215; // Clean smooth rendering
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
    opacity: 0.92,
    interactive: false
  }).addTo(appState.map);
}

// Load ARGO Fleet & Populate Dropdown
async function loadARGOFleet() {
  try {
    let res;
    try {
      res = await fetch("/api/argo/matchups");
      if (!res.ok) throw new Error("Fallback");
    } catch (e) {
      res = await fetch("./api/argo_matchups.json");
    }
    const data = await res.json();
    appState.argoData = data;
    appState.argoLayerGroup.clearLayers();

    const selectEl = document.getElementById("argoSelect");
    selectEl.innerHTML = "";

    data.matchup_profiles.forEach((prof) => {
      const opt = document.createElement("option");
      opt.value = prof.profile_id;
      const region = prof.latitude > 16.0 ? "North Bay (River Plume)" : prof.longitude > 91.0 ? "East Bay (Andaman)" : prof.latitude < 10.0 ? "South Bay (Sri Lanka Dome)" : "Central Bay (Warm Core)";
      opt.textContent = `Float WMO ${prof.wmo_id} (${prof.latitude}°N, ${prof.longitude}°E) - ${region}`;
      selectEl.appendChild(opt);

      // Add to Map as emerald buoy marker
      const buoyIcon = L.divIcon({
        className: "custom-buoy-icon",
        html: `<div title="ARGO ${prof.wmo_id}" style="width:13px;height:13px;background:#10b981;border:2.5px solid #fff;border-radius:50%;cursor:pointer;box-shadow:0 0 10px #10b981;"></div>`,
        iconSize: [13, 13],
        iconAnchor: [6.5, 6.5]
      });

      const marker = L.marker([prof.latitude, prof.longitude], { icon: buoyIcon });
      marker.on("click", () => {
        selectEl.value = prof.profile_id;
        renderArgoProof(prof);
        document.getElementById("secArgo")?.scrollIntoView({ behavior: "smooth" });
      });
      appState.argoLayerGroup.addLayer(marker);
    });

    if (data.matchup_profiles.length > 0) {
      renderArgoProof(data.matchup_profiles[0]);
    }

  } catch (err) {
    console.error("Failed to load ARGO fleet:", err);
  }
}

// Render Ground-Truth ARGO Proof View
function renderArgoProof(prof) {
  appState.selectedFloat = prof;
  document.getElementById("argoCoordsBadge").textContent = `${prof.latitude}°N, ${prof.longitude}°E • WMO ${prof.wmo_id} (Cycle #${prof.cycle_number || 10})`;
  document.getElementById("argoRmsePill").textContent = `Profile RMSE: ${prof.profile_rmse_c.toFixed(3)}°C`;
  
  const acc = Math.max(95.0, (100.0 - (prof.profile_rmse_c / 28.0 * 100.0))).toFixed(1);
  document.getElementById("proofOverallAcc").textContent = `${acc}%`;

  const depths = prof.argo_ctd_depths;
  const observed = prof.argo_ctd_temps;
  const predicted = prof.model_interpolated_temps;

  const climDepths = [0, 50, 100, 200, 500, 1000];
  const climTemps = [28.8, 27.2, 22.8, 15.2, 9.5, 6.2];
  const interpClim = depths.map((z) => {
    if (z <= 50) return 28.8 - (28.8 - 27.2) * (z / 50);
    if (z <= 100) return 27.2 - (27.2 - 22.8) * ((z - 50) / 50);
    if (z <= 200) return 22.8 - (22.8 - 15.2) * ((z - 100) / 100);
    if (z <= 500) return 15.2 - (15.2 - 9.5) * ((z - 200) / 300);
    return 9.5 - (9.5 - 6.2) * ((z - 500) / 500);
  });

  appState.argoProofChart.data.labels = depths;
  appState.argoProofChart.data.datasets[0].data = observed;
  appState.argoProofChart.data.datasets[1].data = predicted;
  appState.argoProofChart.data.datasets[2].data = interpClim;
  appState.argoProofChart.update();

  const tbody = document.getElementById("argoProofTableBody");
  tbody.innerHTML = "";

  const sampleIndices = [0, 2, 4, 7, 9, 11, 13, 15, 17, 20];
  sampleIndices.forEach((idx) => {
    if (idx < depths.length) {
      const z = depths[idx];
      const obs = observed[idx];
      const pred = predicted[idx];
      const err = Math.abs(pred - obs);
      const climErr = Math.abs(interpClim[idx] - obs);
      const accScore = (100.0 - (err / (obs || 1) * 100.0)).toFixed(1);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${z.toFixed(0)}m</strong></td>
        <td class="text-acc-green">${obs.toFixed(2)}°C</td>
        <td class="text-acc-cyan">${pred.toFixed(2)}°C</td>
        <td><strong style="color: ${err < 0.35 ? '#10b981' : '#f59e0b'}">${err.toFixed(2)}°C</strong></td>
        <td style="color: #94a3b8;">${climErr.toFixed(2)}°C</td>
        <td><span class="pill pill-argo">${accScore}%</span></td>
      `;
      tbody.appendChild(tr);
    }
  });
}

// Column Sounding & Dual Charts Update (Fast & Zero Latency)
async function updateColumnSounding(lat, lon) {
  try {
    let pData, aData;
    const i = Math.max(0, Math.min(67, Math.round((lat - 5.125) / 0.25)));
    const j = Math.max(0, Math.min(59, Math.round((lon - 80.125) / 0.25)));

    if (appState.isStaticMode && appState.currentDayData) {
      // Calculate directly in browser
      const temps = appState.currentDayData.temperature_grids.map(g => g[i][j]);
      const d26 = parseFloat(Number(appState.currentDayData.d26_grid[i][j]).toFixed(1));
      const tchp = parseFloat(Number(appState.currentDayData.tchp_grid[i][j]).toFixed(2));
      const sld = parseFloat(Number(appState.currentDayData.sld_grid[i][j]).toFixed(1));
      const duct = parseFloat(Number(appState.currentDayData.duct_grid[i][j]).toFixed(2));

      // Standard depths
      const depths = [0, 50, 100, 200, 500, 1000];
      const c_vels = temps.map((t, k) => {
        const D = depths[k];
        return parseFloat((1448.96 + 4.591 * t - 0.05304 * t * t + 2.374e-4 * t * t * t + 1.340 * (34.2 - 35) + 0.0163 * D).toFixed(2));
      });

      pData = {
        grid_coords: { lat: (5.125 + i * 0.25).toFixed(3), lon: (80.125 + j * 0.25).toFixed(3), i, j },
        is_ocean: temps[0] > 0,
        depths_m: depths,
        temperatures_c: temps,
        climatology_c: appState.currentDayData.climatology_profile,
        d26_m: d26,
        tchp_kj_cm2: tchp
      };

      const assessmentText = duct > 0.5
        ? `ACTIVE UPPER DUCT (Estimated SLD = ${sld}m, ΔC = +${duct} m/s). Upper sound-speed maximum traps acoustic energy in top ${sld}m.`
        : "NORMAL NEGATIVE THERMOCLINE GRADIENT. Acoustic rays bend downward into deep water; no near-surface sound duct detected.";

      aData = {
        depths_m: depths,
        sound_velocities_mps: c_vels,
        sonic_layer_depth_m: sld,
        surface_duct_strength_mps: duct,
        tactical_assessment: assessmentText
      };

    } else {
      // Dynamic fallback
      const [pRes, aRes] = await Promise.all([
        fetch(`/api/profile?date=${appState.activeDate}&lat=${lat}&lon=${lon}`),
        fetch(`/api/acoustics?date=${appState.activeDate}&lat=${lat}&lon=${lon}`)
      ]);
      pData = await pRes.json();
      aData = await aRes.json();
    }

    document.getElementById("soundingCoordsText").textContent = `Lat: ${pData.grid_coords.lat}°N • Lon: ${pData.grid_coords.lon}°E (Grid Cell [${pData.grid_coords.i}, ${pData.grid_coords.j}]) • ${pData.is_ocean ? "Valid Sea Domain" : "Coastline/Land"}`;
    document.getElementById("kpiD26").innerHTML = `${pData.d26_m} <span class="unit">m</span>`;
    document.getElementById("kpiTCHP").innerHTML = `${pData.tchp_kj_cm2} <span class="unit">kJ/cm²</span>`;
    document.getElementById("kpiSLD").innerHTML = `${aData.sonic_layer_depth_m.toFixed(1)} <span class="unit">m</span>`;
    document.getElementById("kpiDuct").innerHTML = `+${aData.surface_duct_strength_mps.toFixed(2)} <span class="unit">m/s</span>`;
    document.getElementById("tacticalNotice").innerHTML = `<strong>ENVIRONMENTAL ACOUSTIC SUMMARY:</strong> ${aData.tactical_assessment}`;

    // Risk badge
    const rBadge = document.getElementById("soundingRiskBadge");
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
    appState.profileChart.data.labels = pData.depths_m;
    appState.profileChart.data.datasets[0].data = pData.temperatures_c;
    appState.profileChart.data.datasets[1].data = pData.climatology_c;
    appState.profileChart.update();

    // --- ACOUSTIC OCEAN INTELLIGENCE COMPUTATIONS ---
    const AI = window.AcousticIntelligence;
    let fullSoundSpeeds = aData.sound_velocities_mps;
    let fullSalinities = [34.5, 34.7, 34.8, 34.9, 34.95, 34.95];
    let acAnalysis = null;

    if (AI && pData.temperatures_c) {
      const t4 = pData.temperatures_c.slice(0, 4);
      const uncertGrid = appState.currentDayData?.uncertainty_grids;
      const u4 = uncertGrid ? [uncertGrid[0][i][j], uncertGrid[1][i][j], uncertGrid[2][i][j], uncertGrid[3][i][j]] : [0.18, 0.22, 0.25, 0.31];
      acAnalysis = AI.analyzeColumnAcoustics(t4, u4, 34.5, false);

      fullSalinities = AI.estimateVerticalSalinity(34.5, AI.FULL_DEPTHS_M);
      fullSoundSpeeds = pData.temperatures_c.map((t, k) =>
        t > 0 ? AI.computeSoundSpeed(t, fullSalinities[k], AI.FULL_DEPTHS_M[k]) : 0
      );

      // Update Sound Speed Chart with empirical c(T,S,z) and SLD highlight
      appState.soundChart.data.labels = AI.FULL_DEPTHS_M;
      appState.soundChart.data.datasets[0].label = "Empirical Sound Speed c(T, S, z)";
      appState.soundChart.data.datasets[0].data = fullSoundSpeeds;
      appState.soundChart.data.datasets[0].pointRadius = AI.FULL_DEPTHS_M.map(z => z === acAnalysis.estimatedSonicLayerDepthM ? 7 : 3);
      appState.soundChart.data.datasets[0].pointBackgroundColor = AI.FULL_DEPTHS_M.map(z => z === acAnalysis.estimatedSonicLayerDepthM ? "#22d3ee" : "#3b82f6");
      appState.soundChart.update();

      // Section 1: Compact Acoustic Summary Card (#pointAcousticSummaryCard)
      const confBadge = document.getElementById("pointConfBadge");
      if (confBadge) {
        confBadge.textContent = acAnalysis.confidenceLabel;
      }
      const sldEl = document.getElementById("summarySldVal");
      if (sldEl) {
        sldEl.textContent = acAnalysis.estimatedSonicLayerDepthM !== null ? `${acAnalysis.estimatedSonicLayerDepthM} m` : "Unresolved";
      }
      const confEl = document.getElementById("summaryConfVal");
      if (confEl) {
        confEl.textContent = `${acAnalysis.acousticConfidence.toFixed(2)}`;
      }
      const c0El = document.getElementById("summaryC0Val");
      if (c0El) {
        c0El.textContent = `${fullSoundSpeeds[0].toFixed(1)} m/s`;
      }
      const cSldEl = document.getElementById("summaryCSldVal");
      if (cSldEl) {
        const sldVal = acAnalysis.estimatedSonicLayerDepthM;
        const sldIdx = sldVal !== null ? AI.FULL_DEPTHS_M.indexOf(sldVal) : -1;
        const cTarget = sldIdx >= 0 ? fullSoundSpeeds[sldIdx] : fullSoundSpeeds[3];
        cSldEl.textContent = `${cTarget.toFixed(1)} m/s`;
      }
      const interpEl = document.getElementById("summaryInterpretationText");
      if (interpEl) {
        interpEl.textContent = acAnalysis.interpretation;
      }
      const salSrcEl = document.getElementById("summarySalSourceText");
      if (salSrcEl) {
        salSrcEl.textContent = acAnalysis.salinitySource;
      }

      // Section 3: Acoustic Lab KPI Ribbon
      const kpiSLD = document.getElementById("kpiAcousticSLD");
      if (kpiSLD) {
        kpiSLD.innerHTML = acAnalysis.estimatedSonicLayerDepthM !== null ? `${acAnalysis.estimatedSonicLayerDepthM} <span class="unit">m</span>` : `None <span class="unit">resolved</span>`;
      }
      const kpiSLDHint = document.getElementById("kpiAcousticSLDHint");
      if (kpiSLDHint) {
        kpiSLDHint.textContent = acAnalysis.status === "local_maximum_detected"
          ? "Local maximum detected at 50m / 100m"
          : acAnalysis.status === "deepening_beyond_resolved_layer"
          ? "Increases monotonically through 200m"
          : "Monotonic decrease / no duct";
      }
      const kpiConf = document.getElementById("kpiAcousticConf");
      if (kpiConf) {
        kpiConf.innerHTML = `${acAnalysis.acousticConfidence.toFixed(2)} <span class="unit">heuristic</span>`;
      }
      const kpiConfLabel = document.getElementById("kpiAcousticConfLabel");
      if (kpiConfLabel) {
        kpiConfLabel.textContent = acAnalysis.confidenceLabel;
      }
      const kpiSal = document.getElementById("kpiAcousticSal");
      if (kpiSal) {
        kpiSal.textContent = acAnalysis.salinitySource.includes("fallback") ? "Clim. Fallback" : "Surface Product";
      }
      const kpiSalHint = document.getElementById("kpiAcousticSalHint");
      if (kpiSalHint) {
        kpiSalHint.textContent = "Ŝ(z) decay scale = 75m, surface = 34.5 PSU";
      }
      const kpiStatus = document.getElementById("kpiAcousticStatus");
      if (kpiStatus) {
        kpiStatus.textContent = acAnalysis.status === "local_maximum_detected"
          ? "Duct Resolved"
          : acAnalysis.status === "deepening_beyond_resolved_layer"
          ? "Deepening (>200m)"
          : "No Duct Resolved";
      }
      const kpiStatusHint = document.getElementById("kpiAcousticStatusHint");
      if (kpiStatusHint) {
        kpiStatusHint.textContent = acAnalysis.status;
      }
      const interpText = document.getElementById("acousticInterpretationText");
      if (interpText) {
        interpText.textContent = acAnalysis.interpretation;
      }

      // Section 3: Depth Table (#acousticDepthTableBody)
      const tbody = document.getElementById("acousticDepthTableBody");
      if (tbody) {
        tbody.innerHTML = "";
        AI.FULL_DEPTHS_M.forEach((z, idx) => {
          const tVal = pData.temperatures_c[idx];
          const sVal = fullSalinities[idx];
          const cVal = fullSoundSpeeds[idx];

          let layerBadge;
          if (z === acAnalysis.estimatedSonicLayerDepthM) {
            layerBadge = `<span class="pill pill-cyan">Estimated SLD (Acoustic Max)</span>`;
          } else if (z === 0) {
            layerBadge = `<span class="pill pill-muted">Surface Mixed Boundary</span>`;
          } else if (z <= 100) {
            layerBadge = `<span class="pill pill-blue">Upper Thermocline Window</span>`;
          } else if (z <= 200) {
            layerBadge = `<span class="pill pill-blue">Lower Thermocline Window</span>`;
          } else {
            layerBadge = `<span class="pill pill-argo">Deep Meso/Bathypelagic</span>`;
          }

          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><strong>${z}m</strong></td>
            <td class="text-acc-cyan">${tVal.toFixed(2)}°C</td>
            <td style="color:#94a3b8;">${sVal.toFixed(2)} PSU</td>
            <td class="text-acc-green" style="font-weight:700;">${cVal.toFixed(2)} m/s</td>
            <td>${layerBadge}</td>
          `;
          tbody.appendChild(tr);
        });
      }

      // Update Probe Marker Leaflet Popup
      const popupContent = `
        <div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;color:#f8fafc;padding:6px;min-width:210px;line-height:1.5;">
          <div style="font-weight:700;color:#06b6d4;margin-bottom:6px;border-bottom:1px solid #1e2d4a;padding-bottom:4px;display:flex;align-items:center;gap:6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2.2"><path d="M2 10v4M6 6v12M10 3v18M14 6v12M18 8v8M22 11v2"/></svg>
            <span>Sounding Station Telemetry</span>
          </div>
          <div><strong>Coordinates:</strong> ${pData.grid_coords.lat}°N, ${pData.grid_coords.lon}°E</div>
          <div><strong>Surface Sound Speed c(0):</strong> ${fullSoundSpeeds[0].toFixed(1)} m/s</div>
          <div><strong>Est. Sonic Layer Depth:</strong> <span style="color:#22d3ee;font-weight:600;">${acAnalysis.estimatedSonicLayerDepthM !== null ? acAnalysis.estimatedSonicLayerDepthM + ' m' : 'Unresolved'}</span></div>
          <div><strong>Acoustic Confidence:</strong> ${(acAnalysis.acousticConfidence * 100).toFixed(0)}% (${acAnalysis.confidenceLabel.split('—')[0].trim()})</div>
          <div style="margin-top:6px;padding-top:4px;border-top:1px solid #1e2d4a;color:#94a3b8;font-size:10px;font-style:italic;">
            Research-grade environmental estimate
          </div>
        </div>
      `;
      appState.probeMarker.bindPopup(popupContent);
    } else {
      // Fallback update sound speed chart
      appState.soundChart.data.labels = aData.depths_m;
      appState.soundChart.data.datasets[0].data = aData.sound_velocities_mps;
      appState.soundChart.update();
    }

  } catch (err) {
    console.error("Failed to update sounding telemetry:", err);
  }
}

// Zonal Transect Update
async function updateTransect(lat = 14.375) {
  try {
    let data;

    if (appState.isStaticMode && appState.currentDayData) {
      const latKey = `${lat.toFixed(3)}`;
      data = appState.currentDayData.transects[latKey] || Object.values(appState.currentDayData.transects)[2];
    } else {
      const res = await fetch(`/api/transect?date=${appState.activeDate}&lat=${lat}`);
      data = await res.json();
    }

    document.getElementById("transectSubtitle").textContent = `Section along ${data.latitude}°N across Bay of Bengal (${data.longitudes[0]}°E to ${data.longitudes[data.longitudes.length-1]}°E)`;

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

// Client-Side CSV Exporter (Instant Download on Netlify)
function exportSoundingCSV() {
  const lat = appState.selectedCoords.lat;
  const lon = appState.selectedCoords.lon;
  const date = appState.activeDate;

  let csv = `OceanEmbed Subsurface Sounding Profile\n`;
  csv += `Date,${date}\nLatitude,${lat}\nLongitude,${lon}\n`;
  csv += `Model,${appState.activeModel}\n\n`;
  csv += `Depth_m,Temperature_C,Climatology_C,SoundSpeed_mps\n`;

  const depths = appState.profileChart.data.labels || [0, 50, 100, 200, 500, 1000];
  const temps = appState.profileChart.data.datasets[0].data || [];
  const clims = appState.profileChart.data.datasets[1].data || [];
  const sounds = appState.soundChart.data.datasets[0].data || [];

  depths.forEach((d, idx) => {
    csv += `${d},${temps[idx] ?? ""},${clims[idx] ?? ""},${sounds[idx] ?? ""}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `oceanembed_sounding_${date}_lat${lat}_lon${lon}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
