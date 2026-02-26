import fs from 'fs';
import path from 'path';

const version = '0.4.3';
const timezoneOffset = new Date().getTimezoneOffset() * 60000;
const dateObj = new Date(Date.now() - timezoneOffset);
const date = dateObj.toISOString().split('T')[0];

const locales = ['ko', 'en', 'ja'];
let allContentMissing = true;

for (const locale of locales) {
    const historyDir = path.join('public', 'history', version, locale);
    if (!fs.existsSync(historyDir)) {
        console.log(`No history found for ${locale} at ${historyDir}`);
        continue;
    }

    const files = fs.readdirSync(historyDir)
        .filter(f => f.startsWith('step-') && f.endsWith('.md'))
        .sort((a, b) => {
            const numA = parseInt(a.replace('step-', '').replace('.md', ''), 10);
            const numB = parseInt(b.replace('step-', '').replace('.md', ''), 10);
            return numA - numB;
        });

    let content = '';
    if (locale === 'ko') content = `# 업데이트 알림 (v${version})\n- **날짜**: ${date}\n- **내용**:\n\n`;
    if (locale === 'ja') content = `# アップデートのお知らせ (v${version})\n- **日付**: ${date}\n- **内容**:\n\n`;
    if (locale === 'en') content = `# Update Notice (v${version})\n- **Date**: ${date}\n- **Description**:\n\n`;

    for (const file of files) {
        content += fs.readFileSync(path.join(historyDir, file), 'utf8') + '\n\n';
        allContentMissing = false;
    }

    const targetDir = path.join('public', 'updates', locale);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, `v${version}.md`), content.trim() + '\n', 'utf8');
}

if (!allContentMissing) {
    try {
        fs.rmSync(path.join('public', 'history', version), { recursive: true, force: true });
    } catch (e) {
        console.error("Could not remove history dir:", e);
    }
}

// Bump version in package.json
const pkgPath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');

// Update index.json
const indexPath = path.join('public', 'updates', 'index.json');
let index = [];
if (fs.existsSync(indexPath)) {
    index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
}
index.unshift({
    version: version,
    date: date,
    title: `Version ${version}`,
    file: `v${version}.md`
});
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');

console.log(`Merged history into new release notice for v${version}.`);
