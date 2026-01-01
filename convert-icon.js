
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const JimpPkg = require('jimp');
const Jimp = JimpPkg.default || JimpPkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const input = path.join(__dirname, 'public', 'appLOGO.ico');
const output = path.join(__dirname, 'public', 'linux-icon.png');

async function convert() {
    try {
        console.log('Jimp type:', typeof Jimp);
        console.log('Jimp keys:', Object.keys(Jimp));

        let image;
        if (typeof Jimp.read === 'function') {
            image = await Jimp.read(input);
        } else {
            // Try constructor style if read is missing (rare for jimp main export)
            // or maybe it's the constructor itself?
            image = await Jimp.read(input);
        }

        await image.writeAsync(output);
        console.log('Icon converted successfully to:', output);
    } catch (err) {
        console.error('Error converting icon:', err);
        process.exit(1);
    }
}

convert();
