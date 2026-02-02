
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
let Jimp;

try {
    const JimpPkg = require('jimp');
    // Log keys for debugging if it fails again
    // console.log('JimpPkg keys:', Object.keys(JimpPkg));

    if (JimpPkg.Jimp && typeof JimpPkg.Jimp.read === 'function') {
        Jimp = JimpPkg.Jimp;
    } else if (typeof JimpPkg.read === 'function') {
        Jimp = JimpPkg;
    } else if (JimpPkg.default && typeof JimpPkg.default.read === 'function') {
        Jimp = JimpPkg.default;
    } else {
        // Fallback: search for any property that looks like the main class
        console.log('Searching for Jimp class in package export...');
        Jimp = JimpPkg.Jimp || JimpPkg.default || JimpPkg;
    }
} catch (e) {
    console.error('Failed to load jimp:', e);
    process.exit(1);
}


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const input = path.join(__dirname, 'public', 'appLOGO.png'); // Use the new PNG
const outputPng = path.join(__dirname, 'public', 'linux-icon.png');
// const outputIco = path.join(__dirname, 'public', 'appLOGO.ico'); // Jimp can't write ICO natively usually

async function convert() {
    try {
        console.log('Reading icon from:', input);
        if (!Jimp || typeof Jimp.read !== 'function') {
            throw new Error('Jimp.read is not available.');
        }
        const image = await Jimp.read(input);
        image.resize(256, 256); // Standardize size
        await image.writeAsync(outputPng);
        console.log('Icon normalized and saved to:', outputPng);

        // NOTE: We are NOT writing .ico here because Jimp doesn't support it.
        // We will rely on Electron Builder to handle the PNG or user to convert if strict ICO is needed.
        // However, for immediate satisfaction, we ensure the PNG is good.
    } catch (err) {
        console.error('Error converting icon:', err);
        process.exit(1);
    }
}

convert();
