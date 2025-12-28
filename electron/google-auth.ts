import { ipcMain, shell, BrowserWindow } from 'electron';
import http from 'node:http';
import url from 'node:url';
import { readJson, writeJson, getSettingsPath, DEFAULT_SETTINGS, AppSettings } from './storage';
import log from 'electron-log';

// These MUST be set via environment variables - do not hardcode secrets!
const CLIENT_ID = process.env.CLIENT_ID || "";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "";

export function setupGoogleAuth() {
    ipcMain.handle('start-google-auth', async () => {
        return new Promise((resolve, reject) => {
            const server = http.createServer(async (req, res) => {
                try {
                    if (req.url?.startsWith('/callback')) {
                        const parsedUrl = url.parse(req.url, true);
                        const code = parsedUrl.query.code as string;

                        if (code) {
                            try {
                                // Exchange code for tokens FIRST
                                const tokens = await exchangeCodeForTokens(code, (server.address() as any).port);

                                // Fetch User Info
                                let email = "Connected";
                                try {
                                    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                                        headers: { Authorization: `Bearer ${tokens.access_token}` }
                                    });
                                    if (userRes.ok) {
                                        const userData = await userRes.json();
                                        email = userData.email;
                                    }
                                } catch (userInfoError) {
                                    log.error("[GoogleAuth] Failed to fetch user email", userInfoError);
                                }

                                // Save tokens (Backend persistence)
                                const settingsPath = getSettingsPath();
                                const settings = readJson<AppSettings>(settingsPath, DEFAULT_SETTINGS);
                                const driveTokens = {
                                    accessToken: tokens.access_token,
                                    refreshToken: tokens.refresh_token,
                                    expiryDate: Date.now() + (tokens.expires_in * 1000),
                                    email: email
                                };
                                settings.googleDriveTokens = driveTokens;
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

                                resolve({ success: true, email, tokens: driveTokens });
                            } catch (exchangeError) {
                                log.error("[GoogleAuth] Token Exchange Failed", exchangeError);
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
                    log.error("[GoogleAuth] Auth Callback Error", e);
                    if (!res.writableEnded) {
                        res.end('Error occurred during authentication.');
                    }
                    server.close();
                    reject(e);
                }
            });

            server.on('error', (err) => {
                log.error('[GoogleAuth] Local Auth Server Error:', err);
                reject(err);
            });

            server.listen(0, 'localhost', () => {
                const port = (server.address() as any).port;
                const redirectUri = `http://localhost:${port}/callback`;

                const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                    `client_id=${CLIENT_ID}&` +
                    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                    `response_type=code&` +
                    `scope=https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email&` +
                    `access_type=offline&` +
                    `prompt=consent`; // Force consent to get refresh token

                log.info(`[GoogleAuth] Local server listening on port ${port}`);
                log.info(`[GoogleAuth] Opening auth URL`);
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

    ipcMain.handle('logout-google-drive', () => {
        const settingsPath = getSettingsPath();
        const settings = readJson<AppSettings>(settingsPath, DEFAULT_SETTINGS);
        settings.googleDriveTokens = undefined;
        writeJson(settingsPath, settings);
        return true;
    });
}

async function exchangeCodeForTokens(code: string, port: number) {
    const redirectUri = `http://localhost:${port}/callback`;
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Token exchange failed: ${text}`);
    }

    return response.json();
}
