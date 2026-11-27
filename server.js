const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8000;

const MIME = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.webp': 'image/webp'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/landing.html';
  }

  let filePath = path.join(__dirname, reqPath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const fallbackPath = path.join(__dirname, 'index.html');
      fs.stat(fallbackPath, (fbErr, fbStats) => {
        if (!fbErr && fbStats.isFile()) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
          fs.createReadStream(fallbackPath).pipe(res);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
        }
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  Eventora & AI-ATHLON Server is running!`);
  console.log(`  - Landing Page:     http://localhost:${PORT}/`);
  console.log(`  - Eventora Home:    http://localhost:${PORT}/eventora/index.html`);
  console.log(`  - Organizer Dash:   http://localhost:${PORT}/eventora/organizer-dashboard.html`);
  console.log(`  - Participant Dash: http://localhost:${PORT}/eventora/participant-dashboard.html`);
  console.log(`======================================================\n`);
});
