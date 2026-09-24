const fs = require('fs');
const path = require('path');

const baseDir = 'C:\\Users\\DELL\\.gemini\\antigravity\\scratch\\oceanembed';
const contentMdPath = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\5c960195-f2cc-4155-9865-3cb662dbcfd4\\.system_generated\\steps\\1254\\content.md';
const contentMd = fs.readFileSync(contentMdPath, 'utf-8');

// Extract the <style>...</style> block from content.md
const styleStart = contentMd.indexOf('<style>');
const styleEnd = contentMd.indexOf('</style>') + 8;
const scrollyStyles = contentMd.slice(styleStart, styleEnd);

// Extract the track section: <section class="ocean-track" id="track"> ... </section>
const trackStart = contentMd.indexOf('<section class="ocean-track"');
const trackEnd = contentMd.indexOf('</section>') + 10;
let trackHtml = contentMd.slice(trackStart, trackEnd);

// Extract the footer: <footer class="ocean-footer"> ... </footer>
const footerStart = contentMd.indexOf('<footer class="ocean-footer">');
const footerEnd = contentMd.indexOf('</footer>') + 9;
let footerHtml = contentMd.slice(footerStart, footerEnd);

// Modify trackHtml:
// 1. Add "Sample Demo" button in ocean-nav
trackHtml = trackHtml.replace(
  '</nav>',
  '  <button id="navDemoBtn" onclick="openSampleDemo()" style="margin-left: 0.5rem; background: linear-gradient(135deg, #2ec4a6, #1c7eb0); color: #fff; border: 0; padding: 0.5rem 1.1rem; border-radius: 9999px; font-weight: 700; font-size: 0.72rem; letter-spacing: 0.08em; cursor: pointer; box-shadow: 0 0 16px rgba(46,196,166,0.45); pointer-events: auto; transition: transform 0.2s;">✨ SAMPLE DEMO</button>\n          </nav>'
);

// 2. Add hero CTA button
trackHtml = trackHtml.replace(
  '<div class="scroll-cue"><i></i> SCROLL TO EXPLORE</div>',
  `<div style="margin-top: 1.8rem; display: flex; gap: 1rem; align-items: center; pointer-events: auto;">
              <button onclick="openSampleDemo()" style="background: #2ec4a6; color: #02101f; border: 0; padding: 0.7rem 1.5rem; border-radius: 8px; font-family: 'Public Sans', sans-serif; font-weight: 700; font-size: 0.82rem; letter-spacing: 0.08em; cursor: pointer; box-shadow: 0 4px 18px rgba(46,196,166,0.45); pointer-events: auto; transition: transform 0.2s;">🚀 LAUNCH SAMPLE DEMO</button>
              <div class="scroll-cue" style="margin-top:0"><i></i> SCROLL TO EXPLORE</div>
            </div>`
);

// 3. Add final panel CTA button
trackHtml = trackHtml.replace(
  '</article>\n        </div>\n      </div>',
  `<div style="margin-top: 2rem; pointer-events: auto;">
              <button onclick="openSampleDemo()" style="background: linear-gradient(135deg, #7ce0d0, #38bdf8); color: #02101f; border: 0; padding: 0.85rem 2rem; border-radius: 8px; font-family: 'Public Sans', sans-serif; font-weight: 800; font-size: 0.92rem; letter-spacing: 0.08em; cursor: pointer; box-shadow: 0 6px 25px rgba(124,224,208,0.55); pointer-events: auto; transition: transform 0.2s;">🌊 OPEN INTERACTIVE OPERATIONS DECK</button>
            </div>
          </article>
        </div>
      </div>`
);

// 4. In footerHtml, add Sample Demo link
footerHtml = footerHtml.replace(
  '<a href="/technology">Models</a>',
  '<a href="/technology">Models</a><a href="javascript:void(0)" onclick="openSampleDemo()" style="color: #7ce0d0; font-weight: 600;">✨ Sample Demo</a>'
);

// Read existing MVP index.html
const mvpIndex = fs.readFileSync(path.join(baseDir, 'web', 'index.html'), 'utf-8');

// Extract the body content of MVP: from <header class="app-header"> to before <script src="https://unpkg.com/leaflet
const mvpBodyStart = mvpIndex.indexOf('<header class="app-header">');
const mvpBodyEnd = mvpIndex.indexOf('<!-- External Libraries -->');
let mvpBodyHtml = mvpIndex.slice(mvpBodyStart, mvpBodyEnd);

// In MVP header-left, add a back-to-story button
const backBtnHtml = `
      <button class="btn-back-story" onclick="openStoryLanding()" style="display: inline-flex; align-items: center; gap: 7px; background: rgba(124, 224, 208, 0.12); border: 1px solid rgba(124, 224, 208, 0.4); color: #7ce0d0; padding: 6px 14px; border-radius: 6px; font-weight: 600; font-size: 0.75rem; cursor: pointer; margin-right: 12px; transition: all 0.2s ease;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        <span>Overview Story</span>
      </button>
`;
mvpBodyHtml = mvpBodyHtml.replace('<div class="header-left">', '<div class="header-left">' + backBtnHtml);

// Build the unified page
const unifiedHtml = `<!DOCTYPE html>
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
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Public+Sans:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
  
  <!-- Scrollytelling stylesheet -->
  <link rel="stylesheet" href="/scrolly_style.css" />
  ${scrollyStyles}
  
  <!-- Leaflet CSS -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
  
  <!-- Operations Deck stylesheet -->
  <link rel="stylesheet" href="/style.css" />
  <link rel="stylesheet" href="/static/style.css" />
</head>
<body class="app-body" style="margin: 0; background: #02101f; overflow-x: hidden;">

  <!-- VIEW 1: Cinematic Ocean Scrollytelling Landing Page -->
  <div id="landing-view">
    <main>
      ${trackHtml}
      ${footerHtml}
    </main>
  </div>

  <!-- VIEW 2: Minimum Viable Product - Live Interactive Operations Deck -->
  <div id="demo-view" style="display: none; min-height: 100vh; background: #070d18;">
    ${mvpBodyHtml}
  </div>

  <!-- Scrollytelling Engine -->
  <script src="/scrolly.js"></script>

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

fs.writeFileSync(path.join(baseDir, 'web', 'index.html'), unifiedHtml, 'utf-8');
console.log('web/index.html updated successfully with unified Landing + Sample Demo view!');
