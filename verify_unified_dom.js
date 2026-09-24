const fs = require('fs');

const html = fs.readFileSync('web/index.html', 'utf-8');
const appJs = fs.readFileSync('web/app.js', 'utf-8');
const scrollyJs = fs.readFileSync('web/scrolly.js', 'utf-8');

const idRegex = /id=["']([^"']+)["']/g;
const domIds = new Set();
let match;
while ((match = idRegex.exec(html)) !== null) {
  domIds.add(match[1]);
}

function getQueried(code) {
  const qRegex = /getElementById\(["']([^"']+)["']\)/g;
  const queried = new Set();
  let m;
  while ((m = qRegex.exec(code)) !== null) {
    queried.add(m[1]);
  }
  return queried;
}

const appQueried = getQueried(appJs);
const scrollyQueried = getQueried(scrollyJs);

const missingApp = [...appQueried].filter(id => !domIds.has(id));
const missingScrolly = [...scrollyQueried].filter(id => !domIds.has(id));

console.log('Total DOM IDs in index.html:', domIds.size);
console.log('Total app.js queried IDs:', appQueried.size, '| Missing:', missingApp);
console.log('Total scrolly.js queried IDs:', scrollyQueried.size, '| Missing:', missingScrolly);
