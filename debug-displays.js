import { app, screen } from 'electron';
import screenshot from 'screenshot-desktop';

app.whenReady().then(async () => {
    console.log("--- Electron Displays ---");
    const eDisplays = screen.getAllDisplays();
    eDisplays.forEach(d => {
        console.log(`ID: ${d.id} (Type: ${typeof d.id})`);
        console.log(`Bounds: x=${d.bounds.x}, y=${d.bounds.y}, w=${d.bounds.width}, h=${d.bounds.height}`);
        console.log(JSON.stringify(d, null, 2));
        console.log('-------------------');
    });

    console.log("\n--- Screenshot-Desktop Displays ---");
    try {
        const sDisplays = await screenshot.listDisplays();
        sDisplays.forEach(d => {
            console.log(`ID: ${d.id} (Type: ${typeof d.id})`);
            console.log(`Name: ${d.name}`);
            console.log(`Top: ${d.top}, Left: ${d.left}, W: ${d.width}, H: ${d.height}`);
            console.log(JSON.stringify(d, null, 2));
            console.log('-------------------');
        });
    } catch (e) {
        console.error("Error listing screenshot displays:", e);
    }

    app.quit();
});
