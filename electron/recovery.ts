import fs from 'node:fs';
import path from 'node:path';
import { getUserDataPath, getDailyLogPath, readJson, writeJson, Session } from './storage';

export async function recoverFromScreenshots() {
    const userDataPath = getUserDataPath();
    const screenshotsDir = path.join(userDataPath, 'screenshots');
    console.log(`[Recovery] Scanning screenshots dir: ${screenshotsDir}`);

    if (!fs.existsSync(screenshotsDir)) {
        console.warn('[Recovery] Screenshots directory not found');
        return { success: false, error: 'Screenshots directory not found' };
    }

    const dateFolders = fs.readdirSync(screenshotsDir).filter(f => /^\d{4}-\d{2}-\d{2}$/.test(f));
    console.log(`[Recovery] Found date folders: ${dateFolders.join(', ')}`);
    let recoverCount = 0;

    let totalImages = 0;
    let totalSessions = 0;

    for (const dateStr of dateFolders) {
        const dayDir = path.join(screenshotsDir, dateStr);
        const files = fs.readdirSync(dayDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));

        console.log(`[Recovery] Processing ${dateStr}: found ${files.length} images`);

        if (files.length === 0) continue;
        totalImages += files.length;

        // Parse files: HH-mm-ss_AppName.jpg
        const entries = files.map(f => {
            const parts = f.split('_');
            if (parts.length < 2) return null;

            const timePart = parts[0]; // HH-mm-ss
            const appPart = f.substring(timePart.length + 1).replace(/\.(jpg|png)$/, '');

            const [h, m, s] = timePart.split('-').map(Number);
            const timeInSeconds = h * 3600 + m * 60 + s;

            return {
                filename: f,
                app: appPart,
                time: timeInSeconds,
                timestamp: timePart
            };
        }).filter(e => e !== null) as { filename: string, app: string, time: number, timestamp: string }[];

        entries.sort((a, b) => a.time - b.time);

        // Group into sessions
        const sessions: Session[] = [];
        if (entries.length > 0) {
            let currentSession: Session = {
                start: entries[0].time,
                end: entries[0].time,
                duration: 0,
                process: entries[0].app
            };

            for (let i = 1; i < entries.length; i++) {
                const entry = entries[i];
                const prevEntry = entries[i - 1];
                const diff = entry.time - prevEntry.time;

                // If same app and diff < 15min (900s), extend session
                if (entry.app === currentSession.process && diff < 900) {
                    currentSession.end = entry.time;
                    currentSession.duration = currentSession.end - currentSession.start;
                } else {
                    // Push current
                    if (currentSession.duration < 60) {
                        // Minimal duration fix (at least 1 min for visibility)
                        currentSession.duration = 60;
                        currentSession.end = currentSession.start + 60;
                    }
                    sessions.push(currentSession);

                    // Start new
                    currentSession = {
                        start: entry.time,
                        end: entry.time,
                        duration: 0,
                        process: entry.app
                    };
                }
            }
            // Push last
            if (currentSession.duration < 60) {
                currentSession.duration = 60;
                currentSession.end = currentSession.start + 60;
            }
            sessions.push(currentSession);
        }

        totalSessions += sessions.length;
        console.log(`[Recovery] Generated ${sessions.length} sessions for ${dateStr}`);

        // Save to daily_log
        if (sessions.length > 0) {
            try {
                // Read monthly file
                const yearMonth = dateStr.slice(0, 7);
                const filePath = getDailyLogPath(yearMonth);
                // console.log(`[Recovery] Writing to log file: ${filePath}`);

                const fileData = readJson(filePath, {}) as Record<string, any>;

                // We assume we are RECOVERING, so we might overwrite or merge.
                // Since user data is gone, we'll initialize or merge safely.
                const existingDay = fileData[dateStr] || { todos: [], screenshots: [] };

                // Keep existing todos if any, but REPLACE sessions with recovered ones
                existingDay.sessions = sessions;

                // Also link screenshots
                const newScreenshots = entries.map(e => `${dateStr}/${e.filename}`);
                existingDay.screenshots = newScreenshots;

                fileData[dateStr] = existingDay;
                writeJson(filePath, fileData);
                console.log(`[Recovery] Successfully saved data for ${dateStr}`);
                recoverCount++;
            } catch (e) {
                console.error(`[Recovery] Failed to recover ${dateStr}`, e);
            }
        }
    }

    return {
        success: true,
        count: recoverCount,
        stats: {
            days: recoverCount,
            images: totalImages,
            sessions: totalSessions
        }
    };
}
