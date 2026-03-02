const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const packagePath = path.join(projectRoot, 'package.json');
const indexPath = path.join(projectRoot, 'public', 'updates', 'index.json');
const todayStr = '2026-02-28';
const historyDir = path.join(projectRoot, 'public', 'history', todayStr);

// 1. Bump version
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const parts = pkg.version.split('.');
let patch = parseInt(parts[2]);
let minor = parseInt(parts[1]);
if (patch >= 99) {
    patch = 0;
    minor += 1;
} else {
    patch += 1;
}
const newVersion = `${parts[0]}.${minor}.${patch}`;
pkg.version = newVersion;
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
console.log('Bumped package.json to', newVersion);

// 2. Update index.json
const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
indexData.unshift({
    version: newVersion,
    date: todayStr,
    title: `Version ${newVersion}`,
    file: `v${newVersion}.md`
});
fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2));
console.log('Updated index.json');

// 3. Process each locale
const locales = {
    ko: { hdr: '업데이트 알림', dt: '날짜', desc: '내용' },
    en: { hdr: 'Update Notice', dt: 'Date', desc: 'Description' },
    ja: { hdr: 'アップデートのお知らせ', dt: '日付', desc: '内容' }
};

for (const [loc, texts] of Object.entries(locales)) {
    const locDir = path.join(historyDir, loc);
    let content = '';
    if (fs.existsSync(locDir)) {
        const files = fs.readdirSync(locDir)
            .filter(f => f.startsWith('step-') && f.endsWith('.md'))
            .sort((a, b) => parseInt(a.replace('step-', '')) - parseInt(b.replace('step-', '')));

        const steps = files.map(f => fs.readFileSync(path.join(locDir, f), 'utf8'));
        content = steps.join('\n\n');
    }

    const mdContent = `# ${texts.hdr} (v${newVersion})\n- **${texts.dt}**: ${todayStr}\n- **${texts.desc}**:\n\n${content}`;

    const outDir = path.join(projectRoot, 'public', 'updates', loc);
    if (!fs.existsSync(outDir)) { fs.mkdirSync(outDir, { recursive: true }); }
    fs.writeFileSync(path.join(outDir, `v${newVersion}.md`), mdContent);
    console.log(`Created v${newVersion}.md for ${loc}`);
}

// 4. Cleanup history
try {
    fs.rmSync(historyDir, { recursive: true, force: true });
    console.log('Cleaned up history dir');
} catch (e) { console.error('Error cleaning history', e); }
