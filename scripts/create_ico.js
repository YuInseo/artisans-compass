
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pngPath = path.join(__dirname, '..', 'public', 'appLOGO_256.png');
const icoPath = path.join(__dirname, '..', 'public', 'appLOGO.ico');

const png = fs.readFileSync(pngPath);

// ICO Header
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // Reserved
header.writeUInt16LE(1, 2); // Type 1 = Icon
header.writeUInt16LE(1, 4); // Count = 1

// Directory Entry
const entry = Buffer.alloc(16);
entry.writeUInt8(0, 0); // Width 0 = 256
entry.writeUInt8(0, 1); // Height 0 = 256
entry.writeUInt8(0, 2); // Color count (0 if >= 8bpp)
entry.writeUInt8(0, 3); // Reserved
entry.writeUInt16LE(1, 4); // Planes
entry.writeUInt16LE(32, 6); // BitCount
entry.writeUInt32LE(png.length, 8); // Size
entry.writeUInt32LE(22, 12); // Offset (6+16=22)

const buffer = Buffer.concat([header, entry, png]);

fs.writeFileSync(icoPath, buffer);
console.log('Created ICO:', icoPath);
