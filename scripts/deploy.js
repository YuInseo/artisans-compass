import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import readline from 'readline';
import https from 'https';

// Replicate __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper for interactive input
const askQuestion = (query) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
};

async function main() {
    console.log('Starting deployment script...');

    // --- Interactive Input Removed by User Request ---
    const releaseTitle = '';
    const releaseNotes = '';

    // --- Version Logic ---
    const packagePath = path.resolve(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const newVersion = packageJson.version;
    console.log(`\x1b[32m[Info]\x1b[0m Deploying version: ${newVersion}`);


    // --- Env Loading ---
    const envPath = path.resolve(__dirname, '../.env');
    const envVars = { ...process.env };

    if (fs.existsSync(envPath)) {
        console.log('Loading .env file...');
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim();
                if (key && value && !key.startsWith('#')) {
                    envVars[key] = value;
                }
            }
        });
    } else {
        console.warn('.env file not found at:', envPath);
    }

    // Check for GH_TOKEN
    if (envVars.GH_TOKEN) {
        console.log('GH_TOKEN found in environment.');
    } else {
        console.error('Error: GH_TOKEN is missing!');
        process.exit(1);
    }

    // --- Run Build Steps ---
    console.log('Running build steps...');
    const runCommand = (cmd, args, shell = true) => {
        return new Promise((resolve, reject) => {
            const child = spawn(cmd, args, {
                env: envVars,
                stdio: 'inherit',
                shell
            });
            child.on('close', code => {
                if (code === 0) resolve();
                else reject(new Error(`Command failed with code ${code}`));
            });
        });
    };

    try {
        // Build
        await runCommand('node copy-worker.js && tsc && vite build', [], true);

        // Electron Builder
        console.log('Running electron-builder for x64...');
        await runCommand('npx', ['electron-builder', '--windows', 'nsis:x64', '--publish', 'always'], true);

        console.log('\x1b[32mBuild and Publish complete.\x1b[0m');

        // --- Update GitHub Release Metadata ---
        if (releaseTitle || releaseNotes) {
            console.log('Updating GitHub Release metadata...');
            await updateGithubRelease(envVars.GH_TOKEN, 'YuInseo', 'artisans-compass', `v${newVersion}`, releaseTitle, releaseNotes);
        }

        // --- Generate Local Update Log ---
        try {
            const updatesDir = path.resolve(__dirname, '../public/updates');
            if (!fs.existsSync(updatesDir)) {
                console.log('Creating public/updates directory...');
                fs.mkdirSync(updatesDir, { recursive: true });
            }

            // 1. Save Markdown File
            const mdFileName = `v${newVersion}.md`;
            const mdPath = path.join(updatesDir, mdFileName);
            const mdContent = `# ${releaseTitle || `v${newVersion}`}\n\n${releaseNotes || 'No release notes.'}`;
            fs.writeFileSync(mdPath, mdContent.trim());
            console.log(`Generated update log: ${mdFileName}`);

            // 2. Update index.json
            const indexPath = path.join(updatesDir, 'index.json');
            let indexData = [];
            if (fs.existsSync(indexPath)) {
                try {
                    indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
                } catch (e) {
                    console.warn('Failed to parse existing updates/index.json, starting fresh.');
                }
            }

            // Prepend new version
            const newEntry = {
                version: newVersion,
                date: new Date().toISOString().split('T')[0],
                title: releaseTitle || `Version ${newVersion}`,
                file: mdFileName
            };

            // Remove existing entry for same version if exists
            indexData = indexData.filter(item => item.version !== newVersion);
            indexData.unshift(newEntry);

            fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2));
            console.log('Updated updates/index.json');

        } catch (err) {
            console.error('\x1b[31mFailed to generate local update log:\x1b[0m', err.message);
            // Non-fatal
        }

    } catch (err) {
        console.error('\x1b[31mDeployment failed:\x1b[0m', err.message);
        process.exit(1);
    }
}

async function updateGithubRelease(token, owner, repo, tag, title, body) {
    const headers = {
        'Authorization': `token ${token}`,
        'User-Agent': 'node.js',
        'Accept': 'application/vnd.github.v3+json'
    };

    try {
        // 1. Get Release by Tag
        const release = await new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'api.github.com',
                path: `/repos/${owner}/${repo}/releases/tags/${tag}`,
                method: 'GET',
                headers
            }, res => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(JSON.parse(data));
                    } else {
                        reject(new Error(`Failed to get release: ${res.statusCode} ${data}`));
                    }
                });
            });
            req.on('error', reject);
            req.end();
        });

        if (!release || !release.id) {
            throw new Error('Release ID not found');
        }

        // 2. Update Release (PATCH)
        const updateData = {};
        if (title) updateData.name = title;
        if (body) updateData.body = body;

        await new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'api.github.com',
                path: `/repos/${owner}/${repo}/releases/${release.id}`,
                method: 'PATCH',
                headers
            }, res => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        console.log('\x1b[32mGitHub Release updated successfully!\x1b[0m');
                        resolve();
                    } else {
                        reject(new Error(`Failed to update release: ${res.statusCode} ${data}`));
                    }
                });
            });
            req.on('error', reject);
            req.write(JSON.stringify(updateData));
            req.end();
        });

    } catch (error) {
        console.warn('\x1b[33mWarning: Could not update GitHub release metadata.\x1b[0m', error.message);
        // Don't fail the whole script just because metadata update failed, as artifacts are likely valid
    }
}

main();
