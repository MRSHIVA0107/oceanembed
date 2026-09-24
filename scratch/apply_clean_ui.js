const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const webDir = path.join(rootDir, 'web');
const viewDemoDir = path.join(rootDir, 'view_demo');

console.log('=== Step 1: Updating web/style.css ===');
let styleCss = fs.readFileSync(path.join(webDir, 'style.css'), 'utf-8');

// Replace the temporary buttons and add clean platform-switcher & header layout
const oldHeaderChunk = `
.btn-solution-demo {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: rgba(56, 189, 248, 0.14);
  border: 1px solid rgba(56, 189, 248, 0.45);
  color: #38bdf8;
  padding: 6px 14px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.75rem;
  text-decoration: none;
  cursor: pointer;
  margin-right: 8px;
  transition: all 0.2s ease;
}

.btn-solution-demo:hover {
  background: rgba(56, 189, 248, 0.28);
  border-color: #38bdf8;
  color: #ffffff;
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.35);
}

.jump-btn-demo {
  border-color: rgba(56, 189, 248, 0.45) !important;
  color: #38bdf8 !important;
}

.jump-btn-demo:hover {
  background: rgba(56, 189, 248, 0.2) !important;
  color: #ffffff !important;
}`;

const newHeaderChunk = `
.header-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Unified Platform Switcher */
.platform-switcher {
  display: inline-flex;
  align-items: center;
  background: rgba(3, 16, 27, 0.85);
  border: 1px solid rgba(56, 189, 248, 0.28);
  border-radius: 8px;
  padding: 3px;
  gap: 3px;
  backdrop-filter: blur(12px);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
}

.platform-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 6px;
  font-family: var(--font-display, "Plus Jakarta Sans", sans-serif);
  font-size: 0.74rem;
  font-weight: 600;
  color: #94a3b8;
  text-decoration: none;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
}

.platform-tab svg {
  width: 13px;
  height: 13px;
  opacity: 0.8;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.platform-tab:hover {
  color: #f8fafc;
  background: rgba(255, 255, 255, 0.08);
}

.platform-tab:hover svg {
  opacity: 1;
  transform: translateY(-1px);
}

.platform-tab.active {
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.22), rgba(14, 165, 233, 0.28));
  color: #38bdf8;
  border-color: rgba(56, 189, 248, 0.5);
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(6, 182, 212, 0.25);
}

.platform-tab.active svg {
  opacity: 1;
  color: #38bdf8;
}

.platform-tab.tab-redirect {
  color: #7ce0d0;
  border-color: rgba(124, 224, 208, 0.35);
}

.platform-tab.tab-redirect:hover {
  background: rgba(124, 224, 208, 0.14);
  border-color: #7ce0d0;
  color: #ffffff;
}`;

if (styleCss.includes(oldHeaderChunk)) {
  styleCss = styleCss.replace(oldHeaderChunk, newHeaderChunk);
} else {
  styleCss = styleCss.replace('.brand-icon {', newHeaderChunk + '\n\n.brand-icon {');
}

// Add responsive rules if not present
if (!styleCss.includes('@media (max-width: 1450px)')) {
  styleCss += `\n
@media (max-width: 1450px) {
  .brand-desc {
    display: none !important;
  }
}
@media (max-width: 1180px) {
  .widget-label {
    display: none !important;
  }
  .status-pill span:last-child {
    display: none !important;
  }
  .status-pill {
    padding: 6px !important;
    border-radius: 50% !important;
  }
}
@media (max-width: 960px) {
  .app-header {
    height: auto !important;
    min-height: 60px;
    flex-wrap: wrap;
    padding: 0.5rem 1rem !important;
    gap: 0.5rem;
  }
  .header-center {
    order: 3;
    width: 100%;
    justify-content: flex-start;
    overflow-x: auto;
    padding-bottom: 2px;
  }
}
`;
}
fs.writeFileSync(path.join(webDir, 'style.css'), styleCss, 'utf-8');
console.log('Updated web/style.css');

console.log('=== Step 2: Updating web/landing.css ===');
let landingCss = fs.readFileSync(path.join(webDir, 'landing.css'), 'utf-8');
if (!landingCss.includes('.platform-switcher')) {
  landingCss += `\n
.platform-switcher {
  display: inline-flex;
  align-items: center;
  background: rgba(3, 16, 27, 0.85);
  border: 1px solid rgba(56, 189, 248, 0.28);
  border-radius: 8px;
  padding: 3px;
  gap: 3px;
  backdrop-filter: blur(12px);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
}
.platform-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 6px;
  font-family: var(--font-display, "Plus Jakarta Sans", sans-serif);
  font-size: 0.74rem;
  font-weight: 600;
  color: #94a3b8;
  text-decoration: none;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
}
.platform-tab svg {
  width: 13px;
  height: 13px;
  opacity: 0.8;
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.platform-tab:hover {
  color: #f8fafc;
  background: rgba(255, 255, 255, 0.08);
}
.platform-tab.active {
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.22), rgba(14, 165, 233, 0.28));
  color: #38bdf8;
  border-color: rgba(56, 189, 248, 0.5);
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(6, 182, 212, 0.25);
}
.platform-tab.tab-redirect {
  color: #7ce0d0;
  border-color: rgba(124, 224, 208, 0.35);
}
.platform-tab.tab-redirect:hover {
  background: rgba(124, 224, 208, 0.14);
  border-color: #7ce0d0;
  color: #ffffff;
}
@media(max-width:1120px){
  .nav nav { display: none !important; }
}
`;
  // Adjust nav padding and gap for sleek spacing
  landingCss = landingCss.replace('padding:0 5vw', 'padding:0 3vw');
  landingCss = landingCss.replace('gap:32px', 'gap:20px');
  fs.writeFileSync(path.join(webDir, 'landing.css'), landingCss, 'utf-8');
}
console.log('Updated web/landing.css');

console.log('=== Step 3: Updating view_demo/styles.css ===');
let viewDemoCss = fs.readFileSync(path.join(viewDemoDir, 'styles.css'), 'utf-8');
if (!viewDemoCss.includes('.platform-switcher')) {
  viewDemoCss += `\n
.platform-switcher {
  display: inline-flex;
  align-items: center;
  background: rgba(3, 16, 27, 0.85);
  border: 1px solid rgba(56, 189, 248, 0.28);
  border-radius: 8px;
  padding: 3px;
  gap: 3px;
  backdrop-filter: blur(12px);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
}
.platform-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 6px;
  font-family: var(--font-display, "Plus Jakarta Sans", sans-serif);
  font-size: 0.74rem;
  font-weight: 600;
  color: #94a3b8;
  text-decoration: none;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
}
.platform-tab svg {
  width: 13px;
  height: 13px;
  opacity: 0.8;
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.platform-tab:hover {
  color: #f8fafc;
  background: rgba(255, 255, 255, 0.08);
}
.platform-tab.active {
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.22), rgba(14, 165, 233, 0.28));
  color: #38bdf8;
  border-color: rgba(56, 189, 248, 0.5);
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(6, 182, 212, 0.25);
}
.platform-tab.tab-redirect {
  color: #7ce0d0;
  border-color: rgba(124, 224, 208, 0.35);
}
.platform-tab.tab-redirect:hover {
  background: rgba(124, 224, 208, 0.14);
  border-color: #7ce0d0;
  color: #ffffff;
}
@media(max-width:1120px){
  .nav nav { display: none !important; }
}
`;
  viewDemoCss = viewDemoCss.replace('padding:0 5vw', 'padding:0 3vw');
  viewDemoCss = viewDemoCss.replace('gap:32px', 'gap:20px');
  fs.writeFileSync(path.join(viewDemoDir, 'styles.css'), viewDemoCss, 'utf-8');
}
console.log('Updated view_demo/styles.css');

console.log('=== Step 4: Updating web/index.html ===');
let indexHtml = fs.readFileSync(path.join(webDir, 'index.html'), 'utf-8');

// 4A: Replace Landing Header nav area with clean section links + platform-switcher
const oldLandingHeaderStart = indexHtml.indexOf('<header class="nav">');
const oldLandingHeaderEnd = indexHtml.indexOf('</header>', oldLandingHeaderStart) + 9;
const newLandingHeader = `<header class="nav">
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
    <div class="platform-switcher" role="navigation" aria-label="Demo Views">
      <button class="platform-tab tab-redirect" onclick="openSampleDemo()" title="Open Interactive Operations Deck">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        <span>Operations Deck →</span>
      </button>
      <button class="platform-tab active" title="Currently viewing Story Overview">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        <span>Story Overview</span>
      </button>
      <a href="view_demo/index.html" class="platform-tab tab-redirect" title="Redirect to Solution Showcase Presentation">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polygon points="12 8 8 12 12 16 12 8"/></svg>
        <span>Solution Showcase ↗</span>
      </a>
    </div>
  </header>`;
indexHtml = indexHtml.slice(0, oldLandingHeaderStart) + newLandingHeader + indexHtml.slice(oldLandingHeaderEnd);

// 4B: Clean Hero Actions in Landing
const oldHeroActionsStart = indexHtml.indexOf('<div class="hero-actions">');
const oldHeroActionsEnd = indexHtml.indexOf('</div>', oldHeroActionsStart) + 6;
const newHeroActions = `<div class="hero-actions">
        <button class="button primary" onclick="openSampleDemo()" style="cursor: pointer; background: var(--aqua); color: #062027; font-weight: 700;">🚀 LAUNCH OPERATIONS DECK</button>
        <a href="view_demo/index.html" class="button ghost" style="border-color: rgba(56, 189, 248, 0.6); color: #38bdf8; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">🎯 SOLUTION SHOWCASE ↗</a>
        <a href="#problem" class="button ghost">EXPLORE SCIENCE ↓</a>
      </div>`;
indexHtml = indexHtml.slice(0, oldHeroActionsStart) + newHeroActions + indexHtml.slice(oldHeroActionsEnd);

// 4C: Clean App Header in Operations Deck
const oldAppHeaderStart = indexHtml.indexOf('<header class="app-header">');
const oldAppHeaderEnd = indexHtml.indexOf('</header>', oldAppHeaderStart) + 9;
const newAppHeader = `<header class="app-header">
    <div class="header-left">
      <div class="brand-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
          <path d="M2 12h20"></path>
        </svg>
      </div>
      <div class="brand-titles">
        <div class="brand-main">
          <span class="brand-name">OceanEmbed</span>
          <span class="badge-ps">MoES &bull; INCOIS PS-26066</span>
        </div>
        <div class="brand-desc">
          Deep Learning Reconstruction of Subsurface Ocean Temperature
        </div>
      </div>
    </div>

    <div class="header-center">
      <div class="platform-switcher" role="navigation" aria-label="Demo Views">
        <button class="platform-tab active" onclick="openSampleDemo()" title="Currently in Operations Deck">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          <span>Operations Deck</span>
        </button>
        <button class="platform-tab" onclick="openStoryLanding()" title="Switch to Story Overview Landing">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          <span>Story Overview</span>
        </button>
        <a href="view_demo/index.html" class="platform-tab tab-redirect" title="Redirect to Solution Showcase Presentation">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polygon points="12 8 8 12 12 16 12 8"/></svg>
          <span>Solution Showcase ↗</span>
        </a>
      </div>
    </div>

    <div class="header-right">
      <div class="nav-widget">
        <label class="widget-label" for="dateSelect">DATE:</label>
        <select id="dateSelect" class="hud-select"></select>
      </div>

      <div class="nav-widget">
        <label class="widget-label">AI MODEL:</label>
        <div class="toggle-pill-group" id="modelToggle">
          <button class="toggle-pill active" data-model="core-6">Core-6</button>
          <button class="toggle-pill" data-model="core-7">Core-7 (+SSS)</button>
        </div>
      </div>

      <div class="status-pill">
        <span class="pulse-dot"></span>
        <span>LIVE</span>
      </div>
    </div>
  </header>`;
indexHtml = indexHtml.slice(0, oldAppHeaderStart) + newAppHeader + indexHtml.slice(oldAppHeaderEnd);

// 4D: Clean Quick Jump Ribbon (Remove duplicate solution demo jump button)
const oldQuickJumpStart = indexHtml.indexOf('<nav class="quick-jump-ribbon">');
const oldQuickJumpEnd = indexHtml.indexOf('</nav>', oldQuickJumpStart) + 6;
const newQuickJump = `<nav class="quick-jump-ribbon">
    <span class="jump-label">OPERATIONS DECK:</span>
    <div class="jump-links">
      <button class="jump-btn active" data-target="secMap">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
        1. Geospatial &amp; Tactical Probe
      </button>
      <button class="jump-btn" data-target="secArgo">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
        2. ARGO Float Proof
      </button>
      <button class="jump-btn" data-target="secAcoustics">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 10v4M6 6v12M10 3v18M14 6v12M18 8v8M22 11v2"/></svg>
        3. Acoustic Ocean Intelligence
      </button>
      <button class="jump-btn" data-target="secTransect">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        4. Zonal Cross-Section
      </button>
      <button class="jump-btn" data-target="secBulletin">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
        5. INCOIS Advisory
      </button>
      <button class="jump-btn" data-target="secGuide">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        6. How It Works (Guide)
      </button>
    </div>
  </nav>`;
indexHtml = indexHtml.slice(0, oldQuickJumpStart) + newQuickJump + indexHtml.slice(oldQuickJumpEnd);

fs.writeFileSync(path.join(webDir, 'index.html'), indexHtml, 'utf-8');
console.log('Updated web/index.html');

console.log('=== Step 5: Updating view_demo/index.html ===');
let viewDemoHtml = fs.readFileSync(path.join(viewDemoDir, 'index.html'), 'utf-8');
const oldViewDemoHeaderStart = viewDemoHtml.indexOf('<header class="nav">');
const oldViewDemoHeaderEnd = viewDemoHtml.indexOf('</header>', oldViewDemoHeaderStart) + 9;
const newViewDemoHeader = `<header class="nav">
    <a class="brand" href="#top">
      <span class="brand-mark"><i></i><i></i><i></i></span>
      <span>OCEAN<span>EMBED</span></span>
    </a>
    <nav>
      <a href="#explorer">EXPLORER</a>
      <a href="#solution">SOLUTION</a>
      <a href="#intelligence">INTELLIGENCE</a>
      <a href="#models">MODELS</a>
      <a href="#data">DATA</a>
    </nav>
    <div class="platform-switcher" role="navigation" aria-label="Demo Views">
      <a href="../index.html#demo" class="platform-tab tab-redirect" title="Go to Interactive Operations Deck">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        <span>Operations Deck ↗</span>
      </a>
      <a href="../index.html" class="platform-tab" title="Go to Story Overview">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        <span>Story Overview ↗</span>
      </a>
      <button class="platform-tab active" title="Currently viewing Solution Showcase">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polygon points="12 8 8 12 12 16 12 8"/></svg>
        <span>Solution Showcase</span>
      </button>
    </div>
  </header>`;
viewDemoHtml = viewDemoHtml.slice(0, oldViewDemoHeaderStart) + newViewDemoHeader + viewDemoHtml.slice(oldViewDemoHeaderEnd);

// Footer links in view_demo
const oldFooterLinksStart = viewDemoHtml.indexOf('<div class="footer-links">');
const oldFooterLinksEnd = viewDemoHtml.indexOf('</div>', oldFooterLinksStart) + 6;
const newFooterLinks = `<div class="footer-links">
      <a href="#explorer">Explorer</a>
      <a href="#solution">Solution</a>
      <a href="#models">Models</a>
      <a href="#data">Argo Floats</a>
      <a href="#intelligence">Intelligence</a>
      <a href="../index.html#demo" style="color: var(--aqua); font-weight: 700;">🌊 Operations Deck ↗</a>
      <a href="../index.html" style="color: var(--aqua); font-weight: 700;">📖 Story Overview ↗</a>
    </div>`;
viewDemoHtml = viewDemoHtml.slice(0, oldFooterLinksStart) + newFooterLinks + viewDemoHtml.slice(oldFooterLinksEnd);

fs.writeFileSync(path.join(viewDemoDir, 'index.html'), viewDemoHtml, 'utf-8');
console.log('Updated view_demo/index.html');
