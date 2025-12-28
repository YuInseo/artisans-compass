import { ipcMain, shell, BrowserWindow } from 'electron';
import http from 'node:http';
import url from 'node:url';
import { readJson, writeJson, getSettingsPath, DEFAULT_SETTINGS, AppSettings } from './storage';
import log from 'electron-log';

// These MUST be set via environment variables

export function setupNotionAuth() {
    ipcMain.handle('start-notion-auth', async (_, { clientId, clientSecret }: { clientId?: string, clientSecret?: string } = {}) => {
        const effectiveClientId = clientId || process.env.NOTION_CLIENT_ID || "";
        const effectiveClientSecret = clientSecret || process.env.NOTION_CLIENT_SECRET || "";

        // Only enforce missing credentials if we are aiming for Public OAuth.
        // If this handler is called, we assume we want OAuth.
        // But for verify-notion-token we don't need these.
        if (!effectiveClientId || !effectiveClientSecret) {
            throw new Error("Missing Notion Client ID or Secret");
        }

        return new Promise((resolve, reject) => {
            const server = http.createServer(async (req, res) => {
                try {
                    if (req.url?.startsWith('/callback')) {
                        const parsedUrl = url.parse(req.url, true);
                        const code = parsedUrl.query.code as string;

                        if (code) {
                            try {
                                // Exchange code for tokens FIRST
                                const tokens = await exchangeCodeForTokens(code, (server.address() as any).port, effectiveClientId, effectiveClientSecret);

                                // Save tokens (Backend persistence)
                                const settingsPath = getSettingsPath();
                                const settings = readJson<AppSettings>(settingsPath, DEFAULT_SETTINGS);

                                // Notion returns: { access_token, bot_id, duplicate_template_id, owner, workspace_id, ... }
                                // We store relevant info.
                                const notionTokens = {
                                    accessToken: tokens.access_token,
                                    botId: tokens.bot_id,
                                    workspaceId: tokens.workspace_id,
                                    workspaceName: tokens.workspace_name, // Some integrations return this
                                    owner: tokens.owner, // User info often stuck here
                                };

                                settings.notionTokens = notionTokens;
                                writeJson(settingsPath, settings);

                                // Response to browser
                                res.end('Authentication successful! You can close this window.');

                                // Clean up
                                server.close();

                                // Focus App
                                const wins = BrowserWindow.getAllWindows();
                                if (wins.length > 0) {
                                    const win = wins[0];
                                    if (win.isMinimized()) win.restore();
                                    win.focus();
                                }

                                resolve({ success: true, tokens: notionTokens });
                            } catch (exchangeError) {
                                log.error("[NotionAuth] Token Exchange Failed", exchangeError);
                                res.end(`Authentication failed during token exchange: ${exchangeError}`);
                                server.close();
                                reject(exchangeError);
                            }
                        } else if (parsedUrl.query.error) {
                            const error = parsedUrl.query.error;
                            res.end(`Authentication failed: ${error}`);
                            server.close();
                            reject(new Error(`Auth error: ${error}`));
                        } else {
                            res.end('Authentication failed. No code received.');
                            server.close();
                            reject(new Error("No code received"));
                        }
                    }
                } catch (e) {
                    log.error("[NotionAuth] Auth Callback Error", e);
                    if (!res.writableEnded) {
                        res.end('Error occurred during authentication.');
                    }
                    server.close();
                    reject(e);
                }
            });

            server.on('error', (err) => {
                log.error('[NotionAuth] Local Auth Server Error:', err);
                reject(err);
            });

            server.listen(0, 'localhost', () => {
                const port = (server.address() as any).port;
                const redirectUri = `http://localhost:${port}/callback`;

                // Construct Notion Authorization URL
                // Note: Notion uses Basic Auth for token exchange usually, but standard OAuth2 flow structure here.
                const authUrl = `https://api.notion.com/v1/oauth/authorize?` +
                    `client_id=${effectiveClientId}&` +
                    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                    `response_type=code&` +
                    `owner=user&` + // Request user info
                    `force_login=true`;

                log.info(`[NotionAuth] Local server listening on port ${port}`);
                log.info(`[NotionAuth] Opening auth URL`);

                shell.openExternal(authUrl);
            });

            // Timeout safety
            setTimeout(() => {
                if (server.listening) {
                    server.close();
                    reject(new Error("Timeout waiting for authentication"));
                }
            }, 60000 * 2); // 2 minutes
        });
    });

    ipcMain.handle('logout-notion', () => {
        const settingsPath = getSettingsPath();
        const settings = readJson<AppSettings>(settingsPath, DEFAULT_SETTINGS);
        settings.notionTokens = undefined;
        writeJson(settingsPath, settings);
        return true;
    });

    ipcMain.handle('verify-notion-token', async (_, token: string) => {
        try {
            // Verify token by fetching query/users/me (Notion API)
            const response = await fetch('https://api.notion.com/v1/users/me', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Notion-Version': '2022-06-28'
                }
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Verification failed: ${text}`);
            }

            const userData = await response.json();

            // Extract workspace info if available (Internal integrations return bot info incl workspace name)
            const botInfo = userData.bot || {};
            const workspaceName = botInfo.workspace_name || "Internal Workspace";

            const notionTokens = {
                accessToken: token,
                botId: userData.id,
                workspaceName: workspaceName,
                owner: botInfo.owner || { type: 'workspace', workspace: true }
            };

            // Save
            const settingsPath = getSettingsPath();
            const settings = readJson<AppSettings>(settingsPath, DEFAULT_SETTINGS);
            settings.notionTokens = notionTokens;
            writeJson(settingsPath, settings);

            return { success: true, tokens: notionTokens };
        } catch (error: any) {
            log.error("[NotionAuth] Token Verification Failed", error);
            throw error;
        }
    });
}

async function exchangeCodeForTokens(code: string, port: number, clientId: string, clientSecret: string) {
    const redirectUri = `http://localhost:${port}/callback`;

    // Notion requires Basic Auth header with client_id:client_secret
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch('https://api.notion.com/v1/oauth/token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28' // Good practice to version
        },
        body: JSON.stringify({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirectUri,
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Token exchange failed: ${text}`);
    }

    return response.json();
}
