import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.VITE_BASE_PORT || 3000;
const BASE_URL = process.env.VITE_BASE_URL || '/';
const basePath = BASE_URL === '/' ? '' : BASE_URL.replace(/\/$/, '');

const app = express();
app.use(express.static("dist"));

// 2. Serve static files
const staticPath = join(__dirname, 'dist');
if (basePath) {
  app.use(basePath, express.static(staticPath));
} else {
  app.use(express.static(staticPath));
}

// 3. SPA fallback - only serve index.html for non-file requests
app.get('*', (req, res) => {
  // Get the actual file path
  let filePath = req.path;
  if (basePath && filePath.startsWith(basePath)) {
    filePath = filePath.substring(basePath.length);
  }
  
  const fullPath = join(__dirname, 'dist', filePath);
  
  // If file exists in dist, let express.static handle it
  // Otherwise, serve index.html for SPA routing
  if (existsSync(fullPath) && !filePath.endsWith('/')) {
    // File exists, but express.static didn't catch it, send 404
    res.status(404).send('Not found');
  } else {
    // Not a file, serve index.html for SPA routing
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://127.0.0.1:${PORT}${BASE_URL}`);
});
