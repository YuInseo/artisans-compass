import { ipcMain } from 'electron';
import { readJson, writeJson, getSettingsPath, getUserDataPath, getProjectsPath, DEFAULT_SETTINGS, AppSettings } from './storage';

import log from 'electron-log';

import fs from 'node:fs';
import path from 'node:path';

let isHistorySyncCancelled = false;

// Helper for Rate-Limited Fetch
async function fetchWithRetry(url: string, options: any, retries = 3, backoff = 1000): Promise<Response> {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, options);
            if (res.status === 429) {
                const retryAfter = res.headers.get('Retry-After');
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : backoff * Math.pow(2, i);
                log.warn(`[NotionOps] Rate limited. Retrying in ${waitTime}ms...`);
                await new Promise(r => setTimeout(r, waitTime));
                continue;
            }
            if (!res.ok && res.status >= 500) {
                await new Promise(r => setTimeout(r, backoff * Math.pow(2, i)));
                continue;
            }
            return res;
        } catch (e) {
            if (i === retries - 1) throw e;
            await new Promise(r => setTimeout(r, backoff * Math.pow(2, i)));
        }
    }
    throw new Error(`Failed to fetch ${url} after ${retries} retries`);
}

// Helper functions (Module Scope)
const findAccessiblePage = async (token: string): Promise<string | null> => {
    try {
        const response = await fetchWithRetry('https://api.notion.com/v1/search', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filter: { value: 'page', property: 'object' },
                sort: { direction: 'descending', timestamp: 'last_edited_time' },
                page_size: 1
            })
        });

        if (!response.ok) return null;
        const data = await response.json();
        if (data.results && data.results.length > 0) {
            return data.results[0].id;
        }
    } catch (e) {
        log.error("[NotionOps] Failed to find accessible page", e);
    }
    return null;
};

const createCompassDatabase = async (token: string, pageId: string) => {
    try {
        const response = await fetchWithRetry('https://api.notion.com/v1/databases', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                parent: { type: "page_id", page_id: pageId },
                title: [{ type: "text", text: { content: "Artisans Compass Backup" } }],
                is_inline: true,
                properties: {
                    "Name": { title: {} },
                    "Type": {
                        select: {
                            options: [
                                { name: "Goal", color: "blue" },
                                { name: "Quest", color: "green" },
                                { name: "Todo", color: "yellow" }
                            ]
                        }
                    },
                    "Date": { date: {} },
                    "Status": {
                        select: {
                            options: [
                                { name: "Pending", color: "gray" },
                                { name: "In Progress", color: "blue" },
                                { name: "Completed", color: "green" }
                            ]
                        }
                    },
                    "Projects": { multi_select: {} },
                    "Project Types": { multi_select: {} }
                }
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Create Database failed: ${text}`);
        }

        const db = await response.json();

        // Save DB ID
        const settingsPath = getSettingsPath();
        const settings = readJson<AppSettings>(settingsPath, DEFAULT_SETTINGS);

        if (settings.notionTokens) {
            settings.notionTokens.databaseId = db.id;
            writeJson(settingsPath, settings);
            log.info(`[NotionOps] Saved databaseId ${db.id} to settings.`);
        }

        return { success: true, databaseId: db.id, url: db.url };

    } catch (error) {
        log.error("[NotionOps] Create DB Failed", error);
        throw error;
    }
};

const updateCompassDatabaseSchema = async (token: string, databaseId: string) => {
    try {
        log.info("[NotionOps] Updating database schema...");
        const response = await fetchWithRetry(`https://api.notion.com/v1/databases/${databaseId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                properties: {
                    "Start Date": { date: {} },
                    "End Date": { date: {} }
                }
            })
        });

        if (!response.ok) {
            const err = await response.text();
            log.error(`[NotionOps] Failed to update schema: ${response.status} ${err}`);
        } else {
            log.info("[NotionOps] Schema updated successfully.");
            // Wait a bit for propagation
            await new Promise(r => setTimeout(r, 2000));
        }

    } catch (e) {
        log.error("[NotionOps] Failed to update schema exception", e);
    }
};

export function setupNotionOps() {
    ipcMain.handle('cancel-history-sync', async () => {
        isHistorySyncCancelled = true;
        log.info("[NotionOps] Received cancellation signal for history sync.");
        return true;
    });

    // Search for accessible pages
    ipcMain.handle('get-notion-pages', async (_, token: string) => {
        try {
            const response = await fetchWithRetry('https://api.notion.com/v1/search', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Notion-Version': '2022-06-28',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filter: {
                        value: 'page',
                        property: 'object'
                    },
                    sort: {
                        direction: 'descending',
                        timestamp: 'last_edited_time'
                    }
                })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Search failed: ${text}`);
            }

            const data = await response.json();

            // Map to simple format
            return data.results.map((page: any) => {
                let title = "Untitled";
                if (page.properties) {
                    // Try to find title property (it varies)
                    const titleProp = Object.values(page.properties).find((p: any) => p.id === 'title');
                    if (titleProp && (titleProp as any).title && (titleProp as any).title.length > 0) {
                        title = (titleProp as any).title[0].plain_text;
                    }
                }
                return {
                    id: page.id,
                    title: title,
                    url: page.url
                };
            });

        } catch (error) {
            log.error("[NotionOps] Get Pages Failed", error);
            throw error;
        }
    });

    const createCompassDatabase = async (token: string, pageId: string) => {
        try {
            const response = await fetch('https://api.notion.com/v1/databases', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Notion-Version': '2022-06-28',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    parent: {
                        type: "page_id",
                        page_id: pageId
                    },
                    title: [
                        {
                            type: "text",
                            text: {
                                content: "Artisans Compass Backup"
                            }
                        }
                    ],
                    is_inline: true,
                    properties: {
                        "Name": { title: {} },
                        "Type": {
                            select: {
                                options: [
                                    { name: "Goal", color: "blue" },
                                    { name: "Quest", color: "green" },
                                    { name: "Todo", color: "yellow" }
                                ]
                            }
                        },
                        "Date": { date: {} },
                        "Status": {
                            select: {
                                options: [
                                    { name: "Pending", color: "gray" },
                                    { name: "In Progress", color: "blue" },
                                    { name: "Completed", color: "green" }
                                ]
                            }
                        },
                        "Projects": { multi_select: {} },
                        "Project Types": { multi_select: {} },
                        "Start Date": { date: {} },
                        "End Date": { date: {} },
                        "Sync ID": { rich_text: {} }
                    }
                })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Create Database failed: ${text}`);
            }

            const db = await response.json();

            // Wait for propagation
            await new Promise(r => setTimeout(r, 2000));


            // Save DB ID
            const settingsPath = getSettingsPath();
            const settings = readJson<AppSettings>(settingsPath, DEFAULT_SETTINGS);

            if (settings.notionTokens) {
                settings.notionTokens.databaseId = db.id;
                writeJson(settingsPath, settings); // PERSIST TO DISK
                log.info(`[NotionOps] Saved databaseId ${db.id} to settings.`);
            } else {
                log.warn("[NotionOps] No notionTokens found to save databaseId to.");
            }

            return { success: true, databaseId: db.id, url: db.url };

        } catch (error) {
            log.error("[NotionOps] Create DB Failed", error);
            throw error;
        }
    };

    // Create Database
    ipcMain.handle('create-notion-database', async (_, { token, pageId }: { token: string, pageId: string }) => {
        return createCompassDatabase(token, pageId);
    });

    // Check for existing database
    ipcMain.handle('check-existing-db', async (_, { token, pageId }: { token: string, pageId: string }) => {
        try {
            const response = await fetch('https://api.notion.com/v1/search', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Notion-Version': '2022-06-28',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: "Artisans Compass Backup",
                    filter: {
                        value: 'database',
                        property: 'object'
                    }
                })
            });

            if (!response.ok) return null;
            const data = await response.json();

            // Find one that is child of pageId
            const found = data.results.find((db: any) => {
                return (db.parent.type === 'page_id' && db.parent.page_id.replace(/-/g, '') === pageId.replace(/-/g, '')) ||
                    (pageId.replace(/-/g, '') === db.parent.page_id.replace(/-/g, '')); // Robust comparison
            });

            if (found) {
                return { id: found.id, url: found.url };
            }
            return null;

        } catch (error) {
            log.error("[NotionOps] Check Existing DB Failed", error);
            return null;
        }
    });

    // Manual Sync Trigger
    ipcMain.handle('manual-sync-notion', async (_, { token, databaseId, dateStr, data }) => {
        try {
            await syncDailyLog(token, databaseId, dateStr, data);
            return { success: true };
        } catch (e) {
            log.error("[NotionOps] Manual sync failed", e);
            return { success: false, error: (e as any).message };
        }
    });



    ipcMain.handle('sync-all-history', async (event, { token, databaseId }: { token: string, databaseId: string }) => {
        let totalSynced = 0;
        let totalSkipped = 0;
        let currentProgress = 0;
        const details: any[] = [];

        try {
            const userDataPath = getUserDataPath();
            const files = fs.readdirSync(userDataPath);
            const logFiles = files.filter(f => f.startsWith('daily_log_') && f.endsWith('.json'));

            log.info(`[NotionOps] Found ${logFiles.length} log files to sync.`);

            // Reset cancellation flag
            isHistorySyncCancelled = false;

            // Pre-calculate total items for progress bar
            // We want to count:
            // 1. Each Day (1 unit)
            // 2. Each Screenshot (1 unit)
            let totalItemsToSync = 0;
            // Map to store loaded data so we don't read files twice
            const loadedFiles = new Map<string, any>();

            for (const file of logFiles) {
                try {
                    const filePath = path.join(userDataPath, file);
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    loadedFiles.set(file, data);

                    // Count days
                    const days = Object.keys(data);
                    totalItemsToSync += days.length;

                    // Count screenshots inside days
                    for (const dateStr of days) {
                        const dayData = data[dateStr];
                        if (dayData.screenshots && Array.isArray(dayData.screenshots)) {
                            totalItemsToSync += dayData.screenshots.length;
                        }
                    }

                } catch (e) {
                    log.error(`[NotionOps] Error pre-reading ${file}`, e);
                }
            }

            log.info(`[NotionOps] Total items calculate: ${totalItemsToSync}`);

            // Immediately emit initial progress (0/Total) to show UI activity
            event.sender.send('notion-sync-progress', { processed: 0, total: totalItemsToSync, message: "Initializing..." });

            // Try to update schema first (adds new columns if missing)
            await updateCompassDatabaseSchema(token, databaseId);

            // Use loadedFiles to iterate
            for (const file of logFiles) {
                if (isHistorySyncCancelled) break;

                const data = loadedFiles.get(file);
                if (!data) continue;

                try {
                    // Iterate over days in the file
                    const dates = Object.keys(data);
                    const batchSize = 2; // Safe: 2 days parallel to avoid Rate Limits
                    for (let i = 0; i < dates.length; i += batchSize) {
                        if (isHistorySyncCancelled) throw new Error("Sync Cancelled");
                        const batch = dates.slice(i, i + batchSize);

                        // Batch Start Message
                        const start = batch[0];
                        const end = batch[batch.length - 1];
                        const dateRange = batch.length > 1 ? `${start} ~ ${end}` : start;

                        event.sender.send('notion-sync-progress', {
                            processed: currentProgress,
                            total: totalItemsToSync,
                            message: `Syncing ${batch.length} days (${dateRange})...`
                        });

                        await Promise.all(batch.map(async (dateStr) => {
                            if (isHistorySyncCancelled) return; // Early exit in map

                            const dayData = data[dateStr];
                            // Progress for starting the day
                            currentProgress++;

                            // Just update progress bar, keep the batch message
                            event.sender.send('notion-sync-progress', {
                                processed: currentProgress,
                                total: totalItemsToSync
                                // No message, so UI keeps previous
                            });

                            const result = await syncDailyLog(token, databaseId, dateStr, dayData, (msg) => {
                                // Sub-progress callback (mainly for screenshots)
                                // If it's a screenshot upload, increment progress
                                if (msg.startsWith("Uploading")) {
                                    currentProgress++;
                                    event.sender.send('notion-sync-progress', {
                                        processed: currentProgress,
                                        total: totalItemsToSync,
                                        message: msg
                                    });
                                }
                            });

                            const isSuccess = result?.success ?? false;
                            if (isSuccess) totalSynced++;

                            details.push({
                                date: dateStr,
                                status: isSuccess ? 'success' : 'error',
                                blocks: result?.blockCount || 0,
                                error: result?.error
                            });
                        }));

                        // Check cancellation after batch
                        if (isHistorySyncCancelled) throw new Error("Sync Cancelled");

                        // Rate limit: Pause between batches to let bucket refill
                        await new Promise(r => setTimeout(r, 1000));
                    }

                } catch (err: any) {
                    if (isHistorySyncCancelled || err.message === "Sync Cancelled") throw new Error("Sync Cancelled");
                    log.error(`[NotionOps] Error processing ${file}:`, err);
                    totalSkipped++;
                    details.push({ file, status: 'error', error: String(err) });
                }
            }

            if (isHistorySyncCancelled) {
                return { success: false, cancelled: true, count: totalSynced, details };
            }

            return { success: true, count: totalSynced, details };

        } catch (error: any) {
            if (isHistorySyncCancelled || error.message === "Sync Cancelled" || error === "Sync Cancelled") {
                log.info("[NotionOps] Sync Cleanly Cancelled (Caught in Outer Block)");
                return { success: false, cancelled: true, count: totalSynced, details };
            }
            log.error("[NotionOps] Sync All History Failed", error);
            return { success: false, error: error.message };
        }
    });

    // Import Daily Log
    ipcMain.handle('import-notion-log', async (_, { token, databaseId, dateStr }) => {
        try {
            return await importDailyLog(token, databaseId, dateStr);
        } catch (e: any) {
            log.error("[NotionOps] Import Failed", e);
            return { success: false, error: e.message };
        }
    });

}

// Standalone function/Export to be used by storage.ts
// Helper function to recursively upload blocks layer-by-layer
const uploadBlockTree = async (token: string, parentId: string, blocks: any[], onProgress?: (msg: string) => void) => {
    // Notion limit: 100 blocks per batch
    const BATCH_SIZE = 100;

    for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
        if (isHistorySyncCancelled) throw new Error("Sync Cancelled");

        const chunk = blocks.slice(i, i + BATCH_SIZE);

        // Prepare payload: Strip children from current layer to get IDs first
        const payload = chunk.map(b => {
            const clone = JSON.parse(JSON.stringify(b));
            if (clone.type && clone[clone.type] && clone[clone.type].children) {
                delete clone[clone.type].children;
            }
            return clone;
        });

        try {
            const response = await fetchWithRetry(`https://api.notion.com/v1/blocks/${parentId}/children`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Notion-Version': '2022-06-28',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ children: payload })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Append failed: ${text}`);
            }

            const data = await response.json();
            const createdBlocks = data.results;

            // Recurse for children
            const promises = [];
            for (let j = 0; j < chunk.length; j++) {
                if (isHistorySyncCancelled) throw new Error("Sync Cancelled");

                const original = chunk[j];
                const created = createdBlocks[j];

                const type = original.type;
                if (original[type] && original[type].children && original[type].children.length > 0) {
                    promises.push(uploadBlockTree(token, created.id, original[type].children, onProgress));
                }
            }
            // Wait for all sub-trees to upload
            await Promise.all(promises);

        } catch (e) {
            if ((e as any).message === "Sync Cancelled") throw e;
            log.error("[NotionOps] Upload Tree Batch Failed", e);
            throw e;
        }
    }
};

const uploadFileToNotion = async (token: string, filePath: string, onProgress?: (msg: string) => void) => {
    try {
        const stats = fs.statSync(filePath);
        const fileSize = stats.size;
        const fileName = path.basename(filePath);
        const ext = path.extname(filePath).toLowerCase();
        let contentType = 'application/octet-stream';
        if (ext === '.png') contentType = 'image/png';
        if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';

        if (onProgress) onProgress(`Uploading ${fileName}...`);
        log.info(`[NotionOps] Uploading ${fileName} (${fileSize} bytes) to Notion...`);

        // 1. Get Upload URL
        const uploadRes = await fetchWithRetry('https://api.notion.com/v1/file_uploads', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: fileName,
                content_type: contentType,
                file_size: fileSize // Some docs suggest this, safer to include
            })
        });

        if (!uploadRes.ok) {
            throw new Error(`Get Upload URL Failed: ${await uploadRes.text()}`);
        }

        const uploadData = await uploadRes.json();
        const fileId = uploadData.id;

        // 2. Upload Content
        // Notion File Upload API requires POST to /send with multipart/form-data
        const fileContent = fs.readFileSync(filePath);
        const sendUrl = `https://api.notion.com/v1/file_uploads/${fileId}/send`;

        let putRes: Response | undefined;
        for (let i = 0; i < 3; i++) {
            // Recreate form data to avoid stream consumption issues on retry
            const formRetry = new FormData();
            formRetry.append('file', new Blob([fileContent], { type: contentType }), fileName);

            putRes = await fetchWithRetry(sendUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Notion-Version': '2022-06-28'
                    // Content-Type is automatically set by fetch when using FormData
                },
                body: formRetry
            });

            if (putRes.ok) break;

            if (putRes.status === 400 && i < 2) {
                log.warn(`[NotionOps] Upload 400 Bad Request. Retrying... (${i + 1}/3)`);
                await new Promise(r => setTimeout(r, 1000));
                continue;
            }
            break;
        }

        if (!putRes || !putRes.ok) {
            const errorText = putRes ? await putRes.text() : "No Response";
            throw new Error(`Upload Content Failed: ${putRes?.status} ${putRes?.statusText} - ${errorText}`);
        }

        log.info(`[NotionOps] File uploaded successfully. ID: ${fileId}`);

        // 3. Return Block Structure
        return {
            object: 'block',
            type: 'image',
            image: {
                type: 'file_upload',
                file_upload: {
                    id: fileId
                },
                caption: [{ type: "text", text: { content: fileName } }] // Optional caption
            }
        };

    } catch (e) {
        log.error("[NotionOps] Upload File Failed", e);
        return null;
    }
};

export async function syncDailyLog(token: string, databaseId: string, dateStr: string, data: any, onProgress?: (msg: string) => void) {

    if (isHistorySyncCancelled) return { success: false, error: "Sync Cancelled" };

    try {
        const msg = `Syncing Daily Log for ${dateStr}`;
        if (onProgress) onProgress(msg);
        log.info(`[NotionOps] ${msg}`);
        // ... (logging)

        // ... (Find Page Logic - omitted for brevity in replace, asserting match context)
        // We will target the mapTodosToBlocks function specifically next


        // 1. Find the page for this date
        const searchRes = await fetchWithRetry(`https://api.notion.com/v1/databases/${databaseId}/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filter: {
                    property: "Date",
                    date: {
                        equals: dateStr
                    }
                }
            })
        });

        if (!searchRes.ok) {
            const errText = await searchRes.text();
            // Auto-recovery 404
            if (searchRes.status === 404) {
                log.warn("[NotionOps] Database not found (404). Attempting auto-recovery...");
                const pageId = await findAccessiblePage(token);
                if (pageId) {
                    log.info(`[NotionOps] Found parent page ${pageId}. Creating new database...`);
                    const newDb = await createCompassDatabase(token, pageId);
                    if (newDb.success && newDb.databaseId) {
                        log.info(`[NotionOps] Database recreated! ID: ${newDb.databaseId}. Ensuring schema and retrying sync...`);

                        // Force schema update to ensure properties exist
                        await updateCompassDatabaseSchema(token, newDb.databaseId);

                        // Recursive retry with NEW ID
                        return syncDailyLog(token, newDb.databaseId, dateStr, data, onProgress);
                    }
                } else {
                    log.error("[NotionOps] No accessible parent page found for recovery.");
                }
            }

            log.error("[NotionOps] Query Failed", errText);
            return { success: false, error: `Query Failed: ${errText}`, blockCount: 0 };
        }

        const serachData = await searchRes.json();
        let pageId = serachData.results.length > 0 ? serachData.results[0].id : null;




        // FIXED: Check data.quest_cleared (snake_case from storage) OR data.stats?.questAchieved
        const isCompleted = data.quest_cleared || data.stats?.questAchieved || false;

        const projectNames = new Set<string>();
        const projectTypes = new Set<string>();


        // Collect project info
        let firstProjectStart: string | null = null;
        let firstProjectEnd: string | null = null;

        if (data.projectTodos) {
            try {
                const projectsPath = getProjectsPath();
                const projects = readJson<any[]>(projectsPath, []);
                for (const projectId of Object.keys(data.projectTodos)) {
                    const project = projects.find(p => p.id === projectId);
                    if (project) {
                        projectNames.add(project.name);
                        projectTypes.add(project.type);
                        // Take the first available date for the metadata columns
                        if (project.startDate && !firstProjectStart) firstProjectStart = project.startDate;
                        if (project.endDate && !firstProjectEnd) firstProjectEnd = project.endDate;
                    }
                }
            } catch (e) {
                // Ignore
            }
        }

        const projectSelects = Array.from(projectNames).map(name => ({ name }));
        const typeSelects = Array.from(projectTypes).map(name => ({ name }));

        const properties: any = {
            "Name": {
                title: [
                    {
                        text: {
                            content: `Daily Log ${dateStr}`
                        }
                    }
                ]
            },
            "Date": {
                date: {
                    start: dateStr
                }
            },
            "Status": {
                select: {
                    name: isCompleted ? "Completed" : "In Progress"
                }
            },
            "Projects": { multi_select: projectSelects },
            "Project Types": { multi_select: typeSelects }
        };

        if (firstProjectStart) {
            properties["Start Date"] = { date: { start: firstProjectStart } };
        }
        if (firstProjectEnd) {
            properties["End Date"] = { date: { start: firstProjectEnd } };
        }

        if (!pageId) {
            // Create
            const createRes = await fetchWithRetry('https://api.notion.com/v1/pages', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Notion-Version': '2022-06-28',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    parent: { database_id: databaseId },
                    properties: properties
                })
            });

            if (!createRes.ok) {
                log.error("[NotionOps] Create Page Failed", await createRes.text());
                return;
            }
            const createData = await createRes.json();
            pageId = createData.id;
        } else {
            // Update Properties
            await fetchWithRetry(`https://api.notion.com/v1/pages/${pageId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Notion-Version': '2022-06-28',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    properties: properties
                })
            });
        }

        // 2. Update Content (Todos)
        // This is destructive: Delete all children, re-add.
        // Get children
        const childrenRes = await fetchWithRetry(`https://api.notion.com/v1/blocks/${pageId}/children`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Notion-Version': '2022-06-28' }
        });

        if (childrenRes.ok) {
            const childrenData = await childrenRes.json();
            // Batch delete ? Notion API doesn't support batch delete well, have to delete one by one or blocks.
            // Actually, deleting blocks is slow.
            // Optimzation: Only update if changed? Too complex.
            // For now: Just append if empty, or try to update. 
            // To ensure "Sync", replacing is safest but slow.
            // Let's iterate and delete existing blocks.
            if (childrenData.results.length > 0) {
                const results = childrenData.results;
                const batchSize = 5; // Reduced Batch
                for (let i = 0; i < results.length; i += batchSize) {
                    const batch = results.slice(i, i + batchSize);
                    await Promise.all(batch.map((block: any) =>
                        fetchWithRetry(`https://api.notion.com/v1/blocks/${block.id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}`, 'Notion-Version': '2022-06-28' }
                        }).catch(e => log.error(`[NotionOps] Failed to delete block ${block.id}`, e))
                    ));
                    // Pause between batches
                    if (i + batchSize < results.length) {
                        await new Promise(r => setTimeout(r, 200));
                    }
                }
            }
        }

        // Add blocks
        let blocks: any[] = [];

        // Helper function for recursive todos
        // Helper function for recursive todos
        // Now returns full deep tree, no flattening.
        // uploadBlockTree will handle the slicing.
        const mapTodosToBlocks = (todos: any[]): any[] => {
            return todos.map((todo: any) => {
                const block: any = {
                    object: "block",
                    type: "to_do",
                    to_do: {
                        rich_text: [{ type: "text", text: { content: todo.text || "" } }],
                        checked: !!todo.completed
                    }
                };

                if (todo.children && todo.children.length > 0) {
                    block.to_do.children = mapTodosToBlocks(todo.children);
                }

                return block;
            });
        };

        // 1. CLOSING NOTE (Markdown)
        if (data.closingNote) {
            log.info("[NotionOps] Parsing markdown note...");
            const lines = data.closingNote.split('\n');
            const noteBlocks = lines.map((line: string) => {
                const trimmed = line.trim();

                // Headings
                if (trimmed.startsWith('### ')) {
                    return {
                        object: 'block', type: 'heading_3',
                        heading_3: { rich_text: [{ type: 'text', text: { content: trimmed.substring(4) } }] }
                    };
                }
                if (trimmed.startsWith('## ')) {
                    return {
                        object: 'block', type: 'heading_2',
                        heading_2: { rich_text: [{ type: 'text', text: { content: trimmed.substring(3) } }] }
                    };
                }
                if (trimmed.startsWith('# ')) {
                    return {
                        object: 'block', type: 'heading_1',
                        heading_1: { rich_text: [{ type: 'text', text: { content: trimmed.substring(2) } }] }
                    };
                }

                // Checkboxes (in markdown text)
                if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('- [x] ')) {
                    const checked = trimmed.startsWith('- [x] ');
                    const content = trimmed.substring(6);
                    return {
                        object: 'block', type: 'to_do',
                        to_do: {
                            rich_text: [{ type: 'text', text: { content: content } }],
                            checked: checked
                        }
                    };
                }

                // Banner or Bullet
                if (trimmed.startsWith('- ')) {
                    return {
                        object: 'block', type: 'bulleted_list_item',
                        bulleted_list_item: { rich_text: [{ type: 'text', text: { content: trimmed.substring(2) } }] }
                    };
                }

                // Empty line
                if (trimmed === '') return null;

                // Paragraph
                return {
                    object: 'block', type: 'paragraph',
                    paragraph: { rich_text: [{ type: 'text', text: { content: trimmed } }] }
                };

            }).filter((b: any) => b !== null);

            blocks.push(...noteBlocks);
        }

        // 2. TODOS (From App State/Disk)
        // Always append real todos if they exist, separate from the note.
        if (data.todos && data.todos.length > 0) {
            if (blocks.length > 0) {
                blocks.push({ object: 'block', type: 'divider', divider: {} });
            }

            blocks.push({
                object: 'block', type: 'heading_3',
                heading_3: { rich_text: [{ type: 'text', text: { content: "Quest Log" } }] }
            });

            blocks.push(...mapTodosToBlocks(data.todos));
        }

        // 3. PROJECT TODOS
        if (data.projectTodos && Object.keys(data.projectTodos).length > 0) {
            try {
                const projectsPath = getProjectsPath();
                const projects = readJson<any[]>(projectsPath, []);

                for (const [projectId, todos] of Object.entries(data.projectTodos)) {
                    if (Array.isArray(todos) && todos.length > 0) {
                        const project = projects.find(p => p.id === projectId);
                        let projectName = project ? project.name : "Unknown Project";
                        if (project && project.startDate && project.endDate) {
                            projectName += ` (${project.startDate} ~ ${project.endDate})`;
                        } else if (project && project.startDate) {
                            projectName += ` (Started: ${project.startDate})`;
                        }

                        // Divider between sections if not first
                        if (blocks.length > 0) {
                            blocks.push({ object: 'block', type: 'divider', divider: {} });
                        }

                        blocks.push({
                            object: 'block', type: 'heading_3',
                            heading_3: { rich_text: [{ type: 'text', text: { content: `Project: ${projectName}` } }] }
                        });

                        blocks.push(...mapTodosToBlocks(todos as any[]));
                    }
                }

            } catch (err) {
                log.error("[NotionOps] Error processing project todos", err);
            }
        }

        // 4. SCREENSHOTS (Optimized: Parallel + Toggle)
        const settings = readJson(getSettingsPath(), DEFAULT_SETTINGS);
        const includeScreenshots = settings.notionConfig?.includeScreenshots !== false; // Default true

        if (includeScreenshots && data.screenshots && data.screenshots.length > 0) {
            log.info(`[NotionOps] Processing ${data.screenshots.length} screenshots for backup...`);

            const screenshotBlocks: any[] = [];
            const concurrency = 3; // Safe: 3 images parallel
            const screenshots = data.screenshots;

            for (let i = 0; i < screenshots.length; i += concurrency) {
                const batch = screenshots.slice(i, i + concurrency);
                const results = await Promise.all(batch.map(async (path: string) => {
                    try {
                        if (fs.existsSync(path)) {
                            return await uploadFileToNotion(token, path, onProgress);
                        }
                    } catch (imgErr) {
                        log.error(`[NotionOps] Failed to upload screenshot ${path}`, imgErr);
                    }
                    return null;
                }));

                results.forEach(block => {
                    if (block) screenshotBlocks.push(block);
                });
            }

            if (screenshotBlocks.length > 0) {
                if (blocks.length > 0) {
                    blocks.push({ object: 'block', type: 'divider', divider: {} });
                }
                // Create Toggle Block
                blocks.push({
                    object: 'block',
                    type: 'toggle',
                    toggle: {
                        rich_text: [{ type: 'text', text: { content: `Screenshots (${screenshotBlocks.length})` } }],
                        children: screenshotBlocks // Nested children
                    }
                });
            }
        }

        log.info(`[NotionOps] Generated ${blocks.length} blocks to sync.`);
        if (blocks.length > 0) {
            log.info(`[NotionOps] First block sample: ${JSON.stringify(blocks[0])}`);
        }

        if (blocks.length > 0) {
            // Use recursive uploader
            await uploadBlockTree(token, pageId, blocks, onProgress);
        } else {
            log.warn("[NotionOps] No blocks generated to sync. closingNote: " + (data.closingNote ? "YES" : "NO") + ", todos: " + (data.todos ? "YES" : "NO"));
        }

        return { success: true, blockCount: blocks.length };

    } catch (error: any) {
        if (isHistorySyncCancelled || error.message === "Sync Cancelled" || error === "Sync Cancelled") throw new Error("Sync Cancelled");
        log.error("[NotionOps] Sync failed", error);
        return { success: false, error: (error as any).message, blockCount: 0 };
    }
}

export async function importDailyLog(token: string, databaseId: string, dateStr: string) {
    log.info(`[NotionOps] Importing Daily Log for ${dateStr}`);

    try {
        // 1. Find Page
        const searchRes = await fetchWithRetry(`https://api.notion.com/v1/databases/${databaseId}/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filter: {
                    property: "Date",
                    date: { equals: dateStr }
                }
            })
        });

        if (!searchRes.ok) throw new Error(`Query Failed: ${await searchRes.text()}`);
        const searchData = await searchRes.json();

        if (searchData.results.length === 0) {
            return { success: false, error: "No page found for this date" };
        }

        const page = searchData.results[0];
        const pageId = page.id;

        // 2. Parse Properties (Status, etc.)
        // This is minimal; we mainly want the content.
        // But let's check status just in case.
        // const status = page.properties["Status"]?.select?.name;
        // const isCompleted = status === "Completed";

        // 3. Fetch Blocks
        const blocksRes = await fetchWithRetry(`https://api.notion.com/v1/blocks/${pageId}/children`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Notion-Version': '2022-06-28' }
        });

        if (!blocksRes.ok) throw new Error(`Fetch Blocks Failed: ${await blocksRes.text()}`);
        const blocksData = await blocksRes.json();

        // 4. Parse Blocks -> DailyLogData
        // We need to reconstruct 'todos', 'closingNote', etc.
        // This is tricky because we flattened everything into blocks.
        // Heuristic: 
        // - "Quest Log" header starts the Todos section.
        // - "Project: ..." header starts project todos.
        // - "Screenshots" header starts screenshots.
        // - Everything before "Quest Log" is Closing Note.

        const todos: any[] = [];
        let closingNote = "";

        let mode: 'note' | 'todos' | 'project' | 'screenshots' = 'note';
        // If we didn't use a header for note, start in note mode.

        // If we didn't use a header for note, start in note mode.

        for (const block of blocksData.results) {
            // Check headers to switch mode
            if (block.type === 'heading_3' || block.type === 'heading_2' || block.type === 'heading_1') {
                const text = block[block.type].rich_text.map((t: any) => t.plain_text).join("");

                if (text === "Quest Log") {
                    mode = 'todos';
                    continue;
                }
                if (text.startsWith("Project: ")) {
                    mode = 'project';
                    // We don't really support importing project todos back into specific projects easily yet
                    // without parsing the project name accurately.
                    // For now, let's treat them as general todos or ignore if complex.
                    // Let's dump them into 'todos' for safety so they aren't lost.
                    continue;
                }
                if (text === "Screenshots") {
                    mode = 'screenshots';
                    continue;
                }

                // If it's a random header, it's part of the note
                mode = 'note';
            }

            if (block.type === 'divider') continue;

            if (mode === 'note') {
                // Reconstruct Markdown
                if (block.type === 'paragraph') {
                    closingNote += block.paragraph.rich_text.map((t: any) => t.plain_text).join("") + "\n\n";
                } else if (block.type === 'heading_1') {
                    closingNote += "# " + block.heading_1.rich_text.map((t: any) => t.plain_text).join("") + "\n";
                } else if (block.type === 'heading_2') {
                    closingNote += "## " + block.heading_2.rich_text.map((t: any) => t.plain_text).join("") + "\n";
                } else if (block.type === 'heading_3') {
                    closingNote += "### " + block.heading_3.rich_text.map((t: any) => t.plain_text).join("") + "\n";
                } else if (block.type === 'bulleted_list_item') {
                    closingNote += "- " + block.bulleted_list_item.rich_text.map((t: any) => t.plain_text).join("") + "\n";
                } else if (block.type === 'to_do') { // Checklist in note
                    const checked = block.to_do.checked ? "[x]" : "[ ]";
                    closingNote += `- ${checked} ` + block.to_do.rich_text.map((t: any) => t.plain_text).join("") + "\n";
                }
            } else if (mode === 'todos' || mode === 'project') {
                if (block.type === 'to_do') {
                    todos.push({
                        id: block.id, // Use block ID as temporary ID
                        text: block.to_do.rich_text.map((t: any) => t.plain_text).join(""),
                        completed: block.to_do.checked,
                        children: []
                    });
                }
            }
        }

        return {
            success: true,
            data: {
                closingNote: closingNote.trim(),
                todos: todos
                // We don't import screenshots back to local disk yet
                // We don't import specific project mappings yet
            }
        };

    } catch (e: any) {
        log.error("[NotionOps] Import Failed", e);
        throw e;
    }
}
