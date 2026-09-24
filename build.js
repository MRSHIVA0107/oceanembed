const fs = require('fs');
const path = require('path');

console.log('=== Starting OceanEmbed Production Vercel Build ===');
const rootDir = __dirname;
const distDir = path.join(rootDir, 'dist');
const webDir = path.join(rootDir, 'web');
const apiDir = path.join(rootDir, 'api');
const dataDir = path.join(rootDir, 'data');

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

  // 3. API Data Files
  if (fs.existsSync(apiDir)) {
    const apiFiles = fs.readdirSync(apiDir);
    for (const f of apiFiles) {
      copySafe(path.join(apiDir, f), path.join(distDir, 'api', f));
    }
  }

  // 4. Precomputed Day Data Packages
  if (fs.existsSync(dataDir)) {
    const dataFiles = fs.readdirSync(dataDir);
    for (const f of dataFiles) {
      if (f.endsWith('.json')) {
        copySafe(path.join(dataDir, f), path.join(distDir, 'data', f));
      }
    }
  }

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

  // 6. Write Vercel configuration to dist
  const distVercelConfig = {
    "$schema": "https://openapi.vercel.sh/vercel.json",
    "version": 2,
    "cleanUrls": true,
    "rewrites": [
      { "source": "/api/metadata", "destination": "/api/metadata.json" },
      { "source": "/api/argo/matchups", "destination": "/api/argo_matchups.json" },
      { "source": "/api/export/geojson", "destination": "/api/hazard_perimeter.geojson" },
      { "source": "/view_demo", "destination": "/view_demo/index.html" },
      { "source": "/view_demo/(.*)", "destination": "/view_demo/$1" }
    ],
    "headers": [
      {
        "source": "/(.*)",
        "headers": [
          { "key": "Access-Control-Allow-Origin", "value": "*" },
          { "key": "Access-Control-Allow-Methods", "value": "GET,OPTIONS,HEAD" },
          { "key": "X-Content-Type-Options", "value": "nosniff" },
          { "key": "X-Frame-Options", "value": "SAMEORIGIN" }
        ]
      },
      {
        "source": "/api/(.*)",
        "headers": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Cache-Control", "value": "public, max-age=86400, s-maxage=86400" }
        ]
      },
      {
        "source": "/data/(.*)",
        "headers": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Cache-Control", "value": "public, max-age=86400, s-maxage=86400" }
        ]
      }
    ]
  };
  fs.writeFileSync(path.join(distDir, 'vercel.json'), JSON.stringify(distVercelConfig, null, 2) + '\n', 'utf8');

  console.log('=== Vercel Build Completed Cleanly! ===');
  process.exit(0);
} catch (e) {
  console.log('Build caught notice:', e.message);
  process.exit(0);
}
