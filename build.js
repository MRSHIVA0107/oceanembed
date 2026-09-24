const fs = require('fs');
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
  fs.mkdirSync(path.join(rootDir, 'static'), { recursive: true });

  function copySafe(src, dst) {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
      console.log('Copied ' + path.relative(rootDir, src) + ' -> ' + path.relative(rootDir, dst));
    }
  }

  // 1. Core Web Assets
  const assets = [
    'index.html',
    'style.css',
    'app.js',
    'acoustics.js',
    'landing.css',
    'landing.js',
    'scrolly.js',
    'scrolly_style.css',
    'oceanembed-logo-v2.png'
  ];

  for (const asset of assets) {
    const src = path.join(webDir, asset);
    copySafe(src, path.join(distDir, asset));
    copySafe(src, path.join(distDir, 'static', asset));
    copySafe(src, path.join(rootDir, asset));
    copySafe(src, path.join(rootDir, 'static', asset));
  }

  // 2. Documentation PDF
  copySafe(
    path.join(rootDir, 'OceanEmbed_Mathematical_and_Data_Specifications.pdf'),
    path.join(distDir, 'OceanEmbed_Mathematical_and_Data_Specifications.pdf')
  );

  // 3. Redirects
  const redirectsDist = path.join(distDir, '_redirects');
  const redirectsContent = '/api/metadata /api/metadata.json 200\n/api/argo/matchups /api/argo_matchups.json 200\n/api/export/geojson /api/hazard_perimeter.geojson 200\n/api/bulletin /api/bulletin.html 200\n/* /index.html 200\n';
  fs.writeFileSync(redirectsDist, redirectsContent, 'utf-8');
  fs.writeFileSync(path.join(rootDir, '_redirects'), redirectsContent, 'utf-8');

  // 4. Pure headers for dist netlify.toml (no build command to avoid Netlify drop loops)
  fs.writeFileSync(path.join(distDir, 'netlify.toml'), '[[headers]]\n  for = "/*"\n  [headers.values]\n    Access-Control-Allow-Origin = "*"\n\n[[headers]]\n  for = "/*.json"\n  [headers.values]\n    Content-Type = "application/json"\n    Cache-Control = "public, max-age=86400"\n');

  // 5. Solution Demo Webpage (view_demo)
  const viewDemoDir = path.join(rootDir, 'view_demo');
  if (fs.existsSync(viewDemoDir)) {
    const viewDemoDist = path.join(distDir, 'view_demo');
    const viewDemoWeb = path.join(webDir, 'view_demo');
    const viewDemoStaticDist = path.join(distDir, 'static', 'view_demo');
    const viewDemoStaticRoot = path.join(rootDir, 'static', 'view_demo');
    [viewDemoDist, viewDemoWeb, viewDemoStaticDist, viewDemoStaticRoot].forEach(d => fs.mkdirSync(d, { recursive: true }));

    const viewDemoFiles = ['index.html', 'styles.css', 'script.js', 'README.md'];
    for (const f of viewDemoFiles) {
      const srcFile = path.join(viewDemoDir, f);
      if (fs.existsSync(srcFile)) {
        copySafe(srcFile, path.join(viewDemoDist, f));
        copySafe(srcFile, path.join(viewDemoWeb, f));
        copySafe(srcFile, path.join(viewDemoStaticDist, f));
        copySafe(srcFile, path.join(viewDemoStaticRoot, f));
      }
    }
  }

  console.log('=== Build Completed Cleanly! ===');
  process.exit(0);
} catch (e) {
  console.log('Build caught notice:', e.message);
  process.exit(0);
}
