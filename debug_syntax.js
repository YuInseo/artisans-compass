
const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/DailyPanel.tsx', 'utf8');

let balance = 0;
let lineNum = 1;
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Simple regex for tags - not perfect but good for catching unbalanced divs
    // We need to ignore self-closing <div /> which are rare but possible

    let tempLine = line;
    // Remove comments
    tempLine = tempLine.replace(/{\/\*.*?\*\/}/g, '');

    const opens = (tempLine.match(/<div\b[^>]*[^/]>/g) || []).length;
    // Check for self closing <div />
    const selfClosing = (tempLine.match(/<div\b[^>]*\/>/g) || []).length;
    // Real opens are opens - selfClosing because the first regex might catch <div /> as <div ... > if not careful
    // Actually <div ... > vs <div ... />
    // Regex /<div\b[^>]*[^/]>/ matches <div class="..."> but NOT <div class="..." /> if /> is at the end? 
    // No, [^/] means the last char before > is not /.

    // Better approach: find all tags and process them
    const regex = /<\/?div\b[^>]*>/g;
    let match;
    while ((match = regex.exec(tempLine)) !== null) {
        const tag = match[0];
        if (tag.startsWith('</')) {
            balance--;
        } else if (tag.endsWith('/>')) {
            // self closing, no change
        } else {
            balance++;
        }
    }

    if (balance !== 0) {
        // console.log(`Line ${i+1}: Balance ${balance} | ${line.trim()}`);
    }
}

console.log('Final Div Balance:', balance);

// Check braces balance
let braceBalance = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Remove strings to avoid counting braces in strings
    const cleanLine = line.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''").replace(/`[^`]*`/g, "``");

    for (const char of cleanLine) {
        if (char === '{') braceBalance++;
        if (char === '}') braceBalance--;
    }
}
console.log('Final Brace Balance:', braceBalance);

// Check parens balance
let parenBalance = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cleanLine = line.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''").replace(/`[^`]*`/g, "``");
    for (const char of cleanLine) {
        if (char === '(') parenBalance++;
        if (char === ')') parenBalance--;
    }
}
console.log('Final Paren Balance:', parenBalance);
