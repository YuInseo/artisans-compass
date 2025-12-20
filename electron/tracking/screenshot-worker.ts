import { parentPort } from 'worker_threads';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Try to load screenshot-desktop
let screenshot: any;
try {
    screenshot = require('screenshot-desktop');
} catch (e) {
    console.error('[Worker] Failed to load screenshot-desktop:', e);
}

// Try to load jpeg-js (Pure JS, no heavy deps)
let jpeg: any;
try {
    jpeg = require('jpeg-js');
} catch (e) {
    console.error('[Worker] Failed to load jpeg-js:', e);
}

// Worker receives commands
if (parentPort) {
    parentPort.on('message', async (data: any) => {
        try {
            if (data.action === 'CAPTURE_SCREEN' || data.action === 'CAPTURE_WINDOW') {
                // OFF-THREAD CAPTURE (Best for 4K)
                if (!screenshot) throw new Error("screenshot-desktop not loaded");

                // 1. Capture Full Screen (Fastest) - Returns Buffer (JPEG/PNG usually JPEG from screenshot-desktop)
                const imgBuffer = await screenshot({ format: 'jpg' });

                if (data.action === 'CAPTURE_WINDOW' && data.bounds && jpeg) {
                    // 2. Crop to Window Bounds (Manual Pixel Manipulation via jpeg-js)
                    try {
                        const rawImageData = jpeg.decode(imgBuffer, { useTArray: true }); // { width, height, data: Uint8Array }

                        const imgW = rawImageData.width;
                        const imgH = rawImageData.height;
                        const { x, y, width, height } = data.bounds;

                        // Safe Bounds Calculation
                        const safeX = Math.max(0, x);
                        const safeY = Math.max(0, y);
                        const xOffset = safeX - x;
                        const safeW = Math.min(width - xOffset, imgW - safeX);
                        const yOffset = safeY - y;
                        const safeH = Math.min(height - yOffset, imgH - safeY);

                        if (safeW > 0 && safeH > 0) {
                            // Create new buffer for cropped image (RGBA = 4 bytes)
                            const croppedData = new Uint8Array(safeW * safeH * 4);

                            // Row-by-row Copy
                            for (let row = 0; row < safeH; row++) {
                                const srcRowStart = ((safeY + row) * imgW + safeX) * 4;
                                const destRowStart = (row * safeW) * 4;
                                // Copy row bytes
                                const rowBytes = rawImageData.data.subarray(srcRowStart, srcRowStart + (safeW * 4));
                                croppedData.set(rowBytes, destRowStart);
                            }

                            // Encode back to JPEG
                            const newJpeg = jpeg.encode({
                                data: croppedData,
                                width: safeW,
                                height: safeH
                            }, 80); // Quality 80

                            await fs.promises.writeFile(data.filePath, newJpeg.data);
                            parentPort?.postMessage({ success: true, filePath: data.filePath });
                            return;
                        } else {
                            console.warn(`[Worker] Crop bounds invalid/empty. Saving full screen.`);
                        }
                    } catch (decodeErr) {
                        console.error("[Worker] JPEG Decode/Crop failed:", decodeErr);
                        // Fallback to full screen
                    }
                }

                // Fallback / Screen Mode: Write full buffer
                await fs.promises.writeFile(data.filePath, imgBuffer);
                parentPort?.postMessage({ success: true, filePath: data.filePath });

            }
            // Removed Window/Buffer fallback to avoid 'electron' import dependency in worker.
            // Window mode encoding should happen on Main thread or via pure-js library if needed.
        } catch (error) {
            parentPort?.postMessage({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
} else {
    console.error('[Screenshot Worker] parentPort is null');
}
