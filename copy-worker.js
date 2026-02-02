import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const src = path.join(__dirname, 'electron/tracking/gpu-worker.html');
const destDir = path.join(__dirname, 'dist-electron');
const dest = path.join(destDir, 'gpu-worker.html');

const splashSrc = path.join(__dirname, 'electron/splash.html');
const splashDest = path.join(destDir, 'splash.html');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

fs.copyFileSync(src, dest);
console.log('Successfully copied gpu-worker.html to dist-electron');

if (fs.existsSync(splashSrc)) {
    fs.copyFileSync(splashSrc, splashDest);
    console.log('Successfully copied splash.html to dist-electron');
} else {
    console.error('splash.html not found at:', splashSrc);
}
