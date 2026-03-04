import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = __dirname;
const packageJsonPath = path.join(root, 'package.json');
const updatesDir = path.join(root, 'public/updates');
const indexJsonPath = path.join(updatesDir, 'index.json');

// 1. Update package.json version
const pkgStr = fs.readFileSync(packageJsonPath, 'utf8');
const pkg = JSON.parse(pkgStr);
const oldVersion = pkg.version;
const parts = oldVersion.split('.');
let patch = parseInt(parts[2], 10) + 1;
let minor = parseInt(parts[1], 10);
let major = parseInt(parts[0], 10);

if (patch > 99) {
    patch = 0;
    minor += 1;
}
const newVersion = `${major}.${minor}.${patch}`;

pkg.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`Updated package.json: ${oldVersion} -> ${newVersion}`);

// 2. Prep next update records
const dateStr = new Date().toISOString().split('T')[0];
const indexStr = fs.readFileSync(indexJsonPath, 'utf8');
const indexArr = JSON.parse(indexStr);

indexArr.unshift({
    version: newVersion,
    date: dateStr,
    title: `Version ${newVersion}`,
    file: `v${newVersion}.md`
});
fs.writeFileSync(indexJsonPath, JSON.stringify(indexArr, null, 2) + '\n');
console.log(`Updated index.json -> v${newVersion}`);

// 3. Gather history
const historyDir = path.join(root, 'public/history', oldVersion);
const locales = ['ko', 'en', 'ja'];
const headers = {
    ko: `# 업데이트 알림 (v${newVersion})\n- **날짜**: ${dateStr}\n- **내용**:\n\n`,
    en: `# Update Notice (v${newVersion})\n- **Date**: ${dateStr}\n- **Description**:\n\n`,
    ja: `# アップデートのお知らせ (v${newVersion})\n- **日付**: ${dateStr}\n- **内容**:\n\n`
};

for (const locale of locales) {
    const locDir = path.join(historyDir, locale);
    let content = headers[locale];
    let filesFound = false;

    if (fs.existsSync(locDir)) {
        const files = fs.readdirSync(locDir)
            .filter(f => f.startsWith('step-') && f.endsWith('.md'))
            .sort((a, b) => {
                const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
                const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
                return numA - numB;
            });

        for (const file of files) {
            filesFound = true;
            const text = fs.readFileSync(path.join(locDir, file), 'utf8');
            content += text + '\n\n';
        }
    }

    if (!filesFound) {
        console.log(`Warning: No history files found for locale ${locale}`);
    }

    const outPath = path.join(updatesDir, locale, `v${newVersion}.md`);
    fs.mkdirSync(path.join(updatesDir, locale), { recursive: true });
    fs.writeFileSync(outPath, content);
    console.log(`Created release note: ${outPath}`);
}

if (fs.existsSync(historyDir)) {
    fs.rmSync(historyDir, { recursive: true, force: true });
    console.log(`Cleaned up history directory: ${historyDir}`);
}

console.log('Preparation done. Ready to deploy via npm run deploy');
