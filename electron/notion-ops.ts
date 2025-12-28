import { ipcMain } from 'electron';
import { readJson, writeJson, getSettingsPath, getUserDataPath, getProjectsPath, DEFAULT_SETTINGS, AppSettings } from './storage';
import log from 'electron-log';
import fs from 'node:fs';
import path from 'node:path';

let isHistorySyncCancelled = false;

// Helper functions (Module Scope)
const findAccessiblePage = async (token: string): Promise<string | null> => {
    try {
        const response = await fetch('https://api.notion.com/v1/search', {
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
        const response = await fetch('https://api.notion.com/v1/databases', {
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
        const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
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
            const response = await fetch('https://api.notion.com/v1/search', {
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

    // Sync All History
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
            let totalItemsToSync = 0;
            // Map to store loaded data so we don't read files twice
            const loadedFiles = new Map<string, any>();

            for (const file of logFiles) {
                try {
                    const filePath = path.join(userDataPath, file);
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    loadedFiles.set(file, data);
                    totalItemsToSync += Object.keys(data).length;
                } catch (e) {
                    log.error(`[NotionOps] Error pre-reading ${file}`, e);
                }
            }

            // Immediately emit initial progress (0/Total) to show UI activity
            event.sender.send('notion-sync-progress', { processed: 0, total: totalItemsToSync });

            // Try to update schema first (adds new columns if missing)
            await updateCompassDatabaseSchema(token, databaseId);

            // Use loadedFiles to iterate
            for (const file of logFiles) {
                if (isHistorySyncCancelled) break;

                const data = loadedFiles.get(file);
                if (!data) continue;

                try {
                    // Iterate over days in the file
                    for (const dateStr of Object.keys(data)) {
                        if (isHistorySyncCancelled) throw new Error("Sync Cancelled");

                        const dayData = data[dateStr];
                        log.info(`[NotionOps] Syncing history for ${dateStr}...`);

                        const result = await syncDailyLog(token, databaseId, dateStr, dayData);

                        const isSuccess = result?.success ?? false;
                        if (isSuccess) totalSynced++;

                        details.push({
                            date: dateStr,
                            status: isSuccess ? 'success' : 'error',
                            blocks: result?.blockCount || 0,
                            error: result?.error
                        });

                        currentProgress++;
                        // Emit progress
                        event.sender.send('notion-sync-progress', { processed: currentProgress, total: totalItemsToSync });

                        // Check cancellation again
                        if (isHistorySyncCancelled) throw new Error("Sync Cancelled");

                        // Rate limit: 500ms delay between requests to avoid 429
                        await new Promise(r => setTimeout(r, 500));
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

}

// Standalone function/Export to be used by storage.ts
// Helper to recursively upload blocks layer-by-layer
const uploadBlockTree = async (token: string, parentId: string, blocks: any[]) => {
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
            const response = await fetch(`https://api.notion.com/v1/blocks/${parentId}/children`, {
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
                    promises.push(uploadBlockTree(token, created.id, original[type].children));
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

export async function syncDailyLog(token: string, databaseId: string, dateStr: string, data: any) {
    if (isHistorySyncCancelled) return { success: false, error: "Sync Cancelled" };

    try {
        log.info(`[NotionOps] Syncing Daily Log for ${dateStr}`);
        // ... (logging)

        // ... (Find Page Logic - omitted for brevity in replace, asserting match context)
        // We will target the mapTodosToBlocks function specifically next


        // 1. Find the page for this date
        const searchRes = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
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
                        return syncDailyLog(token, newDb.databaseId, dateStr, data);
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
        const projectStarts: string[] = [];
        const projectEnds: string[] = [];

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
            const createRes = await fetch('https://api.notion.com/v1/pages', {
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
            await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
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
        const childrenRes = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
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
            for (const block of childrenData.results) {
                // Deleting blocks one by one
                await fetch(`https://api.notion.com/v1/blocks/${block.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}`, 'Notion-Version': '2022-06-28' }
                });
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

        log.info(`[NotionOps] Generated ${blocks.length} blocks to sync.`);
        if (blocks.length > 0) {
            log.info(`[NotionOps] First block sample: ${JSON.stringify(blocks[0])}`);
        }

        if (blocks.length > 0) {
            // Use recursive uploader
            await uploadBlockTree(token, pageId, blocks);
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
