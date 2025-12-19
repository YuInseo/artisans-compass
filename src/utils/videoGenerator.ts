
export async function generateTimelapse(
    imagePaths: string[],
    fps: number = 10
): Promise<Blob | null> {
    if (!imagePaths.length) return null;

    const width = 1280; // Standardize for performance
    const height = 720;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Fill black background initially
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    // MediaRecorder
    // Chrome/Electron supports video/webm;codecs=vp9 or vp8
    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
    }

    const stream = canvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2500000 // 2.5 Mbps
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
    };

    const recordingPromise = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            resolve(blob);
        };
    });

    recorder.start();

    // Loop through images
    for (const path of imagePaths) {
        await new Promise<void>((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous"; // Helps with some protocol issues
            // Fix path separator for URL
            const cleanPath = path.replace(/\\/g, '/');
            const src = cleanPath.startsWith('media://') ? cleanPath : `media://${cleanPath}`;

            img.onload = () => {
                // Letterbox / Cover logic
                // For now: simple cover
                const scale = Math.max(width / img.width, height / img.height);
                const x = (width / 2) - (img.width / 2) * scale;
                const y = (height / 2) - (img.height / 2) * scale;

                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                resolve();
            };
            img.onerror = (e) => {
                console.warn("Skipping bad frame:", src, e);
                resolve(); // Continue even if frame fails
            };
            img.src = src;
        });

        // Frame pacing
        // We need to keep this frame on canvas for 1/fps seconds?
        // No, captureStream(fps) polls the canvas.
        // We just need to draw the next frame 'fps' times per second.
        // A simple timeout works reasonable well.
        await new Promise(r => setTimeout(r, 1000 / fps));
    }

    // Stop and create blob
    recorder.stop();
    return recordingPromise;
}
