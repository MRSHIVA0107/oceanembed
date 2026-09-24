const fs = require('fs');
const path = require('path');

const baseDir = 'C:\\Users\\DELL\\.gemini\\antigravity\\scratch\\oceanembed';
const extractedPath = path.join(baseDir, 'extracted_scrolly.js');
let code = fs.readFileSync(extractedPath, 'utf-8');

// Replace router push with depth scroll
code = code.replace(/t\s*&&\s*["']\/["']\s*!==\s*t\s*\?\s*e\.push\(t\)\s*:\s*Z\(\+n\.dataset\.depth\)/g, 'Z(+n.dataset.depth)');

const outJs = `// OceanEmbed Scrollytelling Interactive Engine
${code}

// View Toggling logic
window.openSampleDemo = function() {
  const landing = document.getElementById('landing-view');
  const demo = document.getElementById('demo-view');
  if (landing) landing.style.display = 'none';
  if (demo) demo.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'instant' });
  window.location.hash = 'demo';
  
  setTimeout(() => {
    if (typeof appState !== 'undefined' && appState.map) {
      appState.map.invalidateSize();
      if (typeof renderCanvasOverlay === 'function') {
        renderCanvasOverlay();
      }
    }
    if (typeof appState !== 'undefined') {
      if (appState.profileChart) appState.profileChart.resize();
      if (appState.soundChart) appState.soundChart.resize();
      if (appState.transectChart) appState.transectChart.resize();
      if (appState.argoProofChart) appState.argoProofChart.resize();
    }
  }, 120);
};

window.openStoryLanding = function() {
  const landing = document.getElementById('landing-view');
  const demo = document.getElementById('demo-view');
  if (demo) demo.style.display = 'none';
  if (landing) landing.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'instant' });
  try {
    history.replaceState(null, null, window.location.pathname);
  } catch (e) {
    window.location.hash = '';
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (window.location.hash === '#demo') {
    window.openSampleDemo();
  } else {
    try {
      if (typeof window.initScrollyAnimation === 'function') {
        window.initScrollyAnimation();
      }
    } catch (err) {
      console.warn('Scrolly animation initialization note:', err);
    }
  }
});
`;

fs.writeFileSync(path.join(baseDir, 'web', 'scrolly.js'), outJs, 'utf-8');
console.log('web/scrolly.js written successfully.');
