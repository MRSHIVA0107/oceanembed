const fs = require('fs');
const path = require('path');

const baseDir = 'C:\\Users\\DELL\\.gemini\\antigravity\\scratch\\oceanembed';

// Read MVP body from web_backup or existing index.html
const existingIndex = fs.readFileSync(path.join(baseDir, 'web', 'index.html'), 'utf-8');

// Find existing MVP deck content
let mvpBodyHtml = '';
if (existingIndex.includes('<div id="demo-view"')) {
  const start = existingIndex.indexOf('<div id="demo-view"');
  const innerStart = existingIndex.indexOf('>', start) + 1;
  const end = existingIndex.indexOf('</div>\n\n  <!-- Scrollytelling Engine -->', innerStart);
  if (end !== -1) {
    mvpBodyHtml = existingIndex.slice(innerStart, end).trim();
  } else {
    const endAlt = existingIndex.indexOf('</div>\n\n  <!-- External Libraries -->', innerStart);
    mvpBodyHtml = existingIndex.slice(innerStart, endAlt !== -1 ? endAlt : existingIndex.indexOf('</div>\n\n  <script', innerStart)).trim();
  }
} else {
  const start = existingIndex.indexOf('<header class="app-header">');
  const end = existingIndex.indexOf('<!-- External Libraries -->');
  mvpBodyHtml = existingIndex.slice(start, end).trim();
}

// Ensure "Overview Story" button is in mvpBodyHtml
if (!mvpBodyHtml.includes('btn-back-story')) {
  const backBtnHtml = `
      <button class="btn-back-story" onclick="openStoryLanding()" style="display: inline-flex; align-items: center; gap: 7px; background: rgba(124, 224, 208, 0.12); border: 1px solid rgba(124, 224, 208, 0.4); color: #7ce0d0; padding: 6px 14px; border-radius: 6px; font-weight: 600; font-size: 0.75rem; cursor: pointer; margin-right: 12px; transition: all 0.2s ease;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        <span>Overview Story</span>
      </button>
  `;
  mvpBodyHtml = mvpBodyHtml.replace('<div class="header-left">', '<div class="header-left">' + backBtnHtml);
}

const landingHtml = `
  <!-- Noise Overlay -->
  <div class="noise"></div>

  <!-- Navigation -->
  <header class="nav">
    <div class="brand">
      <div class="brand-mark"><i></i><i></i><i></i></div>
      <span>OCEAN<span>EMBED</span></span>
    </div>
    <nav>
      <a href="#problem">PROBLEM</a>
      <a href="#depth">PROFILE</a>
      <a href="#process">PROCESS</a>
      <a href="#model">MODEL</a>
      <a href="#reconstruction">RECONSTRUCTION</a>
      <a href="#validation">VALIDATION</a>
      <a href="#intelligence">INTELLIGENCE</a>
    </nav>
    <button class="nav-cta" onclick="openSampleDemo()" style="cursor: pointer; background: transparent; color: var(--aqua); border: 1px solid var(--aqua);">✨ SAMPLE DEMO →</button>
  </header>

  <!-- Hero Section -->
  <section class="hero">
    <div class="hero-grid"></div>
    <div class="hero-copy">
      <div class="eyebrow">OCEAN DATA PLATFORM · SIH 2026</div>
      <h1>OCEAN<br><em>EMBED</em></h1>
      <p class="hero-text">Connecting satellite surface observations and physics-informed deep learning to reconstruct the hidden subsurface ocean temperature from surface signals alone.</p>
      <div class="hero-actions">
        <button class="button primary" onclick="openSampleDemo()" style="cursor: pointer; background: var(--aqua); color: #062027; font-weight: 700;">🚀 LAUNCH SAMPLE DEMO</button>
        <a href="#problem" class="button ghost">EXPLORE SCIENCE</a>
      </div>
    </div>
    <div class="ocean-orb">
      <div class="orb-glow"></div>
      <div class="orb">
        <div class="continent c1"></div>
        <div class="continent c2"></div>
        <div class="current cur1"></div>
        <div class="current cur2"></div>
        <div class="current cur3"></div>
        <div class="pin pin1"></div>
        <div class="pin pin2"></div>
        <div class="pin pin3"></div>
      </div>
      <div class="orb-label">
        <span>BAY OF BENGAL</span>
        <span>0.25° RESOLUTION</span>
      </div>
    </div>
    <div class="hero-bottom">
      <span>MoES · INCOIS PS 26066</span>
      <span>SUB-SURFACE 3D THERMAL RECONSTRUCTION</span>
      <span>DEPTH: 0 TO 1000M</span>
    </div>
  </section>

  <!-- 01 Statement Section -->
  <section class="statement dark" id="problem">
    <div class="section-tag">01 / THE PREMISE</div>
    <div class="statement-content reveal">
      <h2>THE OCEAN IS MORE THAN ITS <span>SURFACE.</span></h2>
      <p>Satellites continuously observe the ocean skin temperature and sea level anomalies with high spatial precision. But ocean heat content, acoustic waveguides, and internal waves reside hundreds of meters beneath the surface.</p>
    </div>
  </section>

  <!-- Split Section: Depth Profile Interactive Card -->
  <section class="split-section" id="depth">
    <div class="split-copy reveal">
      <div class="eyebrow">BENEATH THE SURFACE</div>
      <h2>WHAT LIES BELOW <em>REMAINS HIDDEN.</em></h2>
      <p>Subsurface temperature dictates tropical cyclone intensification, marine heatwaves, and acoustic propagation channels. Direct in-situ CTD measurements become increasingly sparse with depth.</p>
      <p>Interactive depth profile preview shows how thermal energy rapidly declines through the main thermocline into the deep ocean.</p>
    </div>
    <div class="depth-card reveal">
      <div class="depth-title">
        <span>VERTICAL SOUNDING</span>
        <b id="depthValue">100 m</b>
      </div>
      <div class="water-profile">
        <div class="profile-line"></div>
        <div class="profile-point" id="depthPoint"></div>
        <span class="d d0">0m</span>
        <span class="d d1">50m</span>
        <span class="d d2">100m</span>
        <span class="d d3">200m</span>
        <span class="d d4">500m</span>
        <span class="d d5">1000m</span>
      </div>
      <input type="range" id="depthSlider" min="0" max="1000" step="50" value="100">
      <div class="profile-readout">
        <span>TEMPERATURE: <strong id="tempValue">28.4°C</strong></span>
        <span>UNCERTAINTY: <strong id="consoleUncertainty">LOW</strong></span>
      </div>
    </div>
  </section>

  <!-- 02 Data Gap -->
  <section class="data-gap">
    <div class="big-number">02</div>
    <div class="data-gap-copy reveal">
      <h2>SURFACE DATA IS ABUNDANT.<br><em>DEPTH DATA IS NOT.</em></h2>
      <p>Satellites provide millions of daily surface pixels, while Argo robotic floats provide profiling points scattered tens to hundreds of kilometers apart across the vast Indian Ocean.</p>
    </div>
    <div class="signal-grid reveal">
      <span>SEA SURFACE TEMP (SST)</span>
      <span>SEA LEVEL ANOMALY (SLA)</span>
      <span>SURFACE WINDS (U/V)</span>
      <span>SEA SURFACE SALINITY (SSS)</span>
    </div>
  </section>

  <!-- Challenge -->
  <section class="challenge">
    <div class="challenge-title reveal">
      <h2>CAN SURFACE SIGNALS <em>REVEAL THE DEPTHS?</em></h2>
    </div>
    <div class="challenge-answer reveal">
      <div class="answer-mark">→</div>
      <h3>YES. THROUGH PHYSICS-INFORMED NEURAL EMBEDDINGS.</h3>
      <p>By mapping multi-satellite altimetry, thermal skin, and wind stress into deep 3D continuous fields validated against in-situ Argo observations.</p>
    </div>
  </section>

  <!-- Process -->
  <section class="process" id="process">
    <div class="section-heading reveal">
      <div class="eyebrow">METHODOLOGY</div>
      <h2>THREE-STAGE RECONSTRUCTION PIPELINE</h2>
    </div>
    <div class="process-grid">
      <div class="process-card reveal">
        <span class="card-no">STAGE 01</span>
        <h3>DATASET</h3>
        <p>Comprehensive assimilation of GLORYS12V1 ocean reanalysis, daily satellite observation grids, and bathymetric ocean masks.</p>
        <span class="card-meta">0.25° EQUIDISTANT GRID</span>
      </div>
      <div class="process-card reveal">
        <span class="card-no">STAGE 02</span>
        <h3>TRAINING</h3>
        <p>Core-6 and Core-7 deep neural architectures learning vertical baroclinic modes and non-linear surface-to-depth correlations.</p>
        <span class="card-meta">EPISTEMIC UNCERTAINTY</span>
      </div>
      <div class="process-card reveal">
        <span class="card-no">STAGE 03</span>
        <h3>INFERENCE</h3>
        <p>Continuous daily reconstruction of 6 vertical depth levels (0m to 1000m) with sub-second zero-latency client inference.</p>
        <span class="card-meta">OPERATIONAL DEPLOYMENT</span>
      </div>
    </div>
  </section>

  <!-- Model Architecture -->
  <section class="model-section" id="model">
    <div class="model-copy reveal">
      <div class="eyebrow">NEURAL ARCHITECTURE</div>
      <h2>CORE-6 &amp; CORE-7 <em>MODELS.</em></h2>
      <p>Deep convolutional residual encoder-decoders with multi-scale feature pyramids and physics loss constraints.</p>
      <div class="model-specs">
        <div><span>INPUT CHANNELS</span><strong>6 OR 7 SATELLITE BANDS</strong></div>
        <div><span>VERTICAL LEVELS</span><strong>0, 50, 100, 200, 500, 1000M</strong></div>
        <div><span>VALIDATION RMSE</span><strong>0.38°C TO 0.65°C</strong></div>
      </div>
    </div>
    <div class="network reveal">
      <div class="node enc">SATELLITE INPUTS<br><small>SST · SLA · Winds · SSS</small></div>
      <div class="wire"></div>
      <div class="node bottleneck">LATENT CORE<br><small>Embedding Space</small></div>
      <div class="wire"></div>
      <div class="node enc">3D SUBSURFACE OCEAN<br><small>T(z) &amp; Uncertainty</small></div>
    </div>
  </section>

  <!-- Reconstruction Heatmap Console -->
  <section class="reconstruction" id="reconstruction">
    <div class="reconstruction-head reveal">
      <div>
        <div class="eyebrow">INTERACTIVE MODEL EXPLORER</div>
        <h2>RECONSTRUCT <em>THE HIDDEN OCEAN.</em></h2>
      </div>
      <button class="button primary" onclick="openSampleDemo()" style="cursor: pointer; background: var(--aqua); color: #062027; font-weight: 700;">OPEN OPERATIONS DECK →</button>
    </div>
    <div class="layer-console reveal">
      <div class="console-top">
        <span>LAYER: <b id="layerLabel">100 M</b></span>
        <span>LIVE PREDICTIVE FIELD</span>
      </div>
      <div class="layer-tabs">
        <button data-depth="0">SURFACE 0M</button>
        <button data-depth="50">50 METRES</button>
        <button data-depth="100" class="active">100 METRES</button>
        <button data-depth="200">200 METRES</button>
        <button data-depth="500">500 METRES</button>
        <button data-depth="1000">1000 METRES</button>
      </div>
      <div class="heatmap" id="heatmap"></div>
      <div class="console-stats">
        <div><span>TEMPERATURE</span><b id="consoleTemp">28.4°C</b></div>
        <div><span>UNCERTAINTY</span><b id="consoleUncertainty" class="live">LOW</b></div>
        <div><span>HORIZONTAL RES</span><b>0.25° × 0.25°</b></div>
        <div><span>DOMAIN</span><b>BAY OF BENGAL</b></div>
      </div>
    </div>
  </section>

  <!-- In-situ Validation -->
  <section class="validation" id="validation">
    <div class="section-heading reveal">
      <div class="eyebrow">IN-SITU BENCHMARK</div>
      <h2>TESTED AGAINST <em>REAL ARGO FLOATS.</em></h2>
    </div>
    <div class="validation-layout">
      <div class="float-visual reveal">
        <div class="float-orbit"></div>
        <div class="argo-float">
          <div class="float-body"></div>
          <div class="float-line"></div>
          <div class="float-sensor"></div>
        </div>
        <div class="float-label">ARGO PROFILER #2903341</div>
      </div>
      <div class="validation-copy reveal">
        <p>Every reconstructed grid column is continuously collocated against real CTD sounding casts collected by autonomous robotic Argo floats traversing the Bay of Bengal.</p>
        <div class="metrics">
          <div><strong>0.42°C</strong><span>OVERALL TEST RMSE</span></div>
          <div><strong>0.981</strong><span>PEARSON CORRELATION (R)</span></div>
          <div><strong>-0.04°C</strong><span>SYSTEMIC MEAN BIAS</span></div>
        </div>
      </div>
    </div>
  </section>

  <!-- Error Section -->
  <section class="error-section">
    <div class="error-copy reveal">
      <div class="eyebrow">ACCURACY BREAKDOWN</div>
      <h2>MEASURE <em>THE ERROR.</em></h2>
      <p>Vertical distribution of mean absolute error across the water column compared against climatology baselines.</p>
    </div>
    <div class="metric-board reveal">
      <div class="metric-row"><span>0m – 50m (Mixed Layer)</span><strong>0.38°C</strong><b>98.4% CONF</b></div>
      <div class="metric-row"><span>100m – 200m (Thermocline)</span><strong>0.64°C</strong><b>96.1% CONF</b></div>
      <div class="metric-row"><span>500m (Intermediate)</span><strong>0.49°C</strong><b>97.8% CONF</b></div>
      <div class="metric-row"><span>1000m (Deep Ocean)</span><strong>0.28°C</strong><b>99.2% CONF</b></div>
    </div>
  </section>

  <!-- Physical Intelligence -->
  <section class="intelligence" id="intelligence">
    <div class="intel-copy reveal">
      <div class="eyebrow">OPERATIONAL IMPACT</div>
      <h2>PHYSICAL &amp; HAZARD <em>INTELLIGENCE.</em></h2>
      <p>Moving beyond raw temperature arrays to compute direct physical diagnostic indices for cyclone forecasting and naval acoustics.</p>
    </div>
    <div class="intel-cards">
      <div class="intel-card reveal">
        <span>CYCLONE HAZARD</span>
        <h3>TCHP &gt; 80 kJ/cm²</h3>
        <p>Tropical Cyclone Heat Potential integral tracking explosive storm intensification corridors.</p>
        <div class="heat-number">114</div>
        <b>MAX OBSERVED TCHP (kJ/cm²)</b>
      </div>
      <div class="intel-card caution reveal">
        <span>NAVAL ACOUSTICS</span>
        <h3>Surface Duct &amp; SLD</h3>
        <p>Mackenzie (1981) sound velocity profile identifying acoustic shadow zones and sonar trapping depths.</p>
        <div class="gauge"><i style="width: 78%;"></i></div>
        <b>SLD DEPTH: 50M (DUCT ACTIVE)</b>
      </div>
      <div class="intel-card reveal">
        <span>THERMAL STRUCTURE</span>
        <h3>D26 Isotherm Depth</h3>
        <p>Depth of the 26°C isotherm marking upper ocean heat reservoir boundaries.</p>
        <div class="confidence"><i></i><i></i><i></i><i></i><i></i></div>
        <b>98.4% CONFIDENCE INDEX</b>
      </div>
    </div>
  </section>

  <!-- Iteration Loop -->
  <section class="iteration">
    <div class="iteration-left reveal">
      <div class="eyebrow">CONTINUOUS LEARNING</div>
      <h2>LEARN. COMPARE. <em>IMPROVE.</em></h2>
      <p style="color: var(--muted); margin-top: 30px; max-width: 480px;">Closed-loop validation cycle constantly refining neural weights whenever new satellite passes or Argo float profiles are surfaced.</p>
    </div>
    <div class="loop reveal">
      <div class="loop-ring"></div>
      <div class="loop-center">↻</div>
      <span class="loop-node n1">PREDICT</span>
      <span class="loop-node n2">COMPARE</span>
      <span class="loop-node n3">EVALUATE</span>
      <span class="loop-node n4">OPTIMIZE</span>
    </div>
  </section>

  <!-- Applications -->
  <section class="application">
    <div class="app-head reveal">
      <div class="eyebrow">REAL-WORLD APPLICATIONS</div>
      <h2>FROM TRAINING TO <em>MISSION CRITICAL OPS.</em></h2>
    </div>
    <div class="app-grid">
      <div class="app-item reveal">
        <span>APPLICATION 01</span>
        <h3>Tropical Cyclone Forecasting</h3>
        <p>Supplying INCOIS with pre-cyclone TCHP reservoirs to accurately predict rapid intensification.</p>
      </div>
      <div class="app-item reveal">
        <span>APPLICATION 02</span>
        <h3>Naval Acoustic Warfare</h3>
        <p>Identifying Sonic Layer Depth (SLD) and underwater shadow zones for sonar detection and submarine stealth.</p>
      </div>
      <div class="app-item reveal">
        <span>APPLICATION 03</span>
        <h3>Marine Fisheries &amp; Heatwaves</h3>
        <p>Tracking subsurface marine heatwave displacement and upwelling zones affecting pelagic fisheries.</p>
      </div>
      <div class="app-item reveal">
        <span>APPLICATION 04</span>
        <h3>Monsoon Dynamics</h3>
        <p>Quantifying northern Bay freshwater barrier layer heat trapping that influences Indian summer monsoon rainfall.</p>
      </div>
    </div>
  </section>

  <!-- Vision CTA Section -->
  <section class="vision">
    <div class="vision-water">
      <div class="wave wv1"></div>
      <div class="wave wv2"></div>
      <div class="wave wv3"></div>
    </div>
    <div class="vision-copy reveal">
      <div class="eyebrow">THE VISION</div>
      <h2>CLEAR VIEW OF THE <em>HIDDEN OCEAN.</em></h2>
      <p>From sparse surface observations to continuous 3D subsurface intelligence. Ready to test the live models?</p>
      <button class="button primary" onclick="openSampleDemo()" style="cursor: pointer; padding: 18px 32px; font-size: 13px; font-weight: 700; background: var(--aqua); color: #062027;">🌊 LAUNCH INTERACTIVE OPERATIONS DECK →</button>
    </div>
  </section>

  <!-- Footer -->
  <footer>
    <div class="footer-brand">OCEAN<span>EMBED</span> · MoES INCOIS PS 26066</div>
    <div class="footer-links">
      <a href="#problem">PROBLEM</a>
      <a href="#depth">PROFILE</a>
      <a href="#process">PROCESS</a>
      <a href="#model">MODEL</a>
      <a href="#reconstruction">RECONSTRUCTION</a>
      <a href="#validation">VALIDATION</a>
      <a href="#intelligence">INTELLIGENCE</a>
      <a href="javascript:void(0)" onclick="openSampleDemo()" style="color: var(--aqua); font-weight: 700;">✨ SAMPLE DEMO</a>
    </div>
    <div class="footer-bottom">
      <span>© 2026 OceanEmbed · Ministry of Earth Sciences (MoES)</span>
      <span>Operational Evaluation Window: August 16–31, 2026</span>
    </div>
  </footer>
`;

const finalIndexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OceanEmbed – Deep Learning Reconstruction of Subsurface Ocean Temperature</title>
  <meta name="description" content="OceanEmbed reconstructs the full ocean temperature profile from satellite surface signals alone. MoES &bull; INCOIS PS-26066" />
  <link rel="icon" href="/oceanembed-logo-v2.png" />
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Manrope:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  
  <!-- Landing page stylesheet -->
  <link rel="stylesheet" href="/landing.css" />
  <link rel="stylesheet" href="/static/landing.css" />
  
  <!-- Leaflet CSS -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
  
  <!-- Operations Deck stylesheet -->
  <link rel="stylesheet" href="/style.css" />
  <link rel="stylesheet" href="/static/style.css" />
</head>
<body style="margin: 0; background: #07151d; color: #eaf7f8; overflow-x: hidden;">

  <!-- VIEW 1: Complete High-End Scientific Landing Page -->
  <div id="landing-view">
    ${landingHtml}
  </div>

  <!-- VIEW 2: Minimum Viable Product - Live Interactive Operations Deck -->
  <div id="demo-view" style="display: none; min-height: 100vh; background: #070d18;">
    ${mvpBodyHtml}
  </div>

  <!-- Landing Page Interactive Engine -->
  <script src="/landing.js"></script>
  <script src="/static/landing.js"></script>

  <!-- External Libraries -->
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  
  <!-- Marine Operations Deck Engine -->
  <script src="/acoustics.js"></script>
  <script src="/static/acoustics.js"></script>
  <script src="/app.js"></script>
  <script src="/static/app.js"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(baseDir, 'web', 'index.html'), finalIndexHtml, 'utf-8');
console.log('web/index.html rewritten with the exact user landing interface!');
