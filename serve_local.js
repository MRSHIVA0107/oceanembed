const http = require('http');
const fs = require('fs');
const path = require('path');

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.geojson': 'application/geo+json; charset=utf-8'
};

const distDir = path.join(__dirname, 'dist');
const PORT = 8080;

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  let cleanUrl = req.url.split('?')[0].split('#')[0];
  if (cleanUrl === '/') cleanUrl = '/index.html';

  let filePath = path.join(distDir, cleanUrl);

  // If path doesn't exist, check without leading /static if present or fallback
  if (!fs.existsSync(filePath)) {
    if (cleanUrl.startsWith('/static/')) {
      const altPath = path.join(distDir, cleanUrl.replace('/static/', '/'));
      if (fs.existsSync(altPath)) filePath = altPath;
    }
  }

  // Handle directory requests by serving index.html within that directory
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // Fallback to index.html for SPA routes
  if (!fs.existsSync(filePath)) {
    filePath = path.join(distDir, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = mime[ext] || 'application/octet-stream';

  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`OceanEmbed Production Localhost running at: http://localhost:${PORT}`);
});
