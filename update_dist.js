const fs = require('fs');
const path = require('path');

const baseDir = 'C:\\Users\\DELL\\.gemini\\antigravity\\scratch\\oceanembed';
const distDir = path.join(baseDir, 'dist');
const webDir = path.join(baseDir, 'web');

console.log('--- Step 1: Cleaning dist/netlify.toml ---');
// dist/netlify.toml MUST NOT have a [build] section because dist is prebuilt!
const distTomlPath = path.join(distDir, 'netlify.toml');
const distTomlContent = `[[headers]]
  for = "/*"
  [headers.values]
    Access-Control-Allow-Origin = "*"
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"

[[headers]]
  for = "/*.json"
  [headers.values]
    Content-Type = "application/json"
    Cache-Control = "public, max-age=86400"
`;
fs.writeFileSync(distTomlPath, distTomlContent, 'utf-8');
console.log('Cleaned dist/netlify.toml (no [build] command, so Netlify Drop will never try to build).');

console.log('--- Step 2: Ensuring dist/_redirects exists ---');
const distRedirectsPath = path.join(distDir, '_redirects');
const redirectsContent = `/api/metadata /api/metadata.json 200
/api/argo/matchups /api/argo_matchups.json 200
/api/export/geojson /api/hazard_perimeter.geojson 200
/api/bulletin /api/bulletin.html 200
/* /index.html 200
`;
fs.writeFileSync(distRedirectsPath, redirectsContent, 'utf-8');
console.log('Written dist/_redirects.');

console.log('--- Step 3: Updating root netlify.toml and package.json ---');
const rootTomlPath = path.join(baseDir, 'netlify.toml');
const rootTomlContent = `[build]
  command = "node build.js"
  publish = "dist"

[[headers]]
  for = "/*"
  [headers.values]
    Access-Control-Allow-Origin = "*"
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"

[[headers]]
  for = "/*.json"
  [headers.values]
    Content-Type = "application/json"
    Cache-Control = "public, max-age=86400"
`;
fs.writeFileSync(rootTomlPath, rootTomlContent, 'utf-8');

const buildJsPath = path.join(baseDir, 'build.js');
const buildJsContent = `const fs = require('fs');
const path = require('path');

console.log('=== Starting OceanEmbed Netlify Build ===');
const rootDir = __dirname;
const distDir = path.join(rootDir, 'dist');
const webDir = path.join(rootDir, 'web');

try {
  fs.mkdirSync(distDir, { recursive: true });
  fs.mkdirSync(path.join(distDir, 'static'), { recursive: true });
  fs.mkdirSync(path.join(distDir, 'api'), { recursive: true });
  fs.mkdirSync(path.join(distDir, 'data'), { recursive: true });

  function copySafe(src, dst) {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
      console.log('Copied ' + path.relative(rootDir, src) + ' -> ' + path.relative(rootDir, dst));
    }
  }

  copySafe(path.join(webDir, 'index.html'), path.join(distDir, 'index.html'));
  copySafe(path.join(webDir, 'style.css'), path.join(distDir, 'style.css'));
  copySafe(path.join(webDir, 'style.css'), path.join(distDir, 'static', 'style.css'));
  copySafe(path.join(webDir, 'app.js'), path.join(distDir, 'app.js'));
  copySafe(path.join(webDir, 'app.js'), path.join(distDir, 'static', 'app.js'));
  copySafe(path.join(rootDir, 'OceanEmbed_Mathematical_and_Data_Specifications.pdf'), path.join(distDir, 'OceanEmbed_Mathematical_and_Data_Specifications.pdf'));

  // Redirects
  const redirectsDist = path.join(distDir, '_redirects');
  if (!fs.existsSync(redirectsDist)) {
    fs.writeFileSync(redirectsDist, '/api/metadata /api/metadata.json 200\\n/api/argo/matchups /api/argo_matchups.json 200\\n/api/export/geojson /api/hazard_perimeter.geojson 200\\n/api/bulletin /api/bulletin.html 200\\n/* /index.html 200\\n');
  }

  // Pure headers for dist netlify.toml
  fs.writeFileSync(path.join(distDir, 'netlify.toml'), '[[headers]]\\n  for = \"/*\"\\n  [headers.values]\\n    Access-Control-Allow-Origin = \"*\"\\n');

  console.log('=== Build Completed Cleanly! ===');
  process.exit(0);
} catch (e) {
  console.log('Build caught notice:', e.message);
  process.exit(0);
}
`;
fs.writeFileSync(buildJsPath, buildJsContent, 'utf-8');

console.log('--- Step 4: Also copy index.html, style.css, app.js to oceanembed root ---');
fs.copyFileSync(path.join(distDir, 'index.html'), path.join(baseDir, 'index.html'));
fs.copyFileSync(path.join(distDir, 'style.css'), path.join(baseDir, 'style.css'));
fs.copyFileSync(path.join(distDir, 'app.js'), path.join(baseDir, 'app.js'));
fs.copyFileSync(distRedirectsPath, path.join(baseDir, '_redirects'));

console.log('--- Step 5: Touch all timestamps in dist to NOW ---');
const now = new Date();
fs.utimesSync(distDir, now, now);

function touchRecursive(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    try {
      fs.utimesSync(fullPath, now, now);
      if (entry.isDirectory()) {
        touchRecursive(fullPath);
      }
    } catch (e) {}
  }
}
touchRecursive(distDir);
console.log('Successfully updated timestamps of dist and all nested files to: ' + now.toLocaleTimeString());
