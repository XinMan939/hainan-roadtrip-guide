/* 把 guide.json 内联注入 index.html 的 const GUIDE 行 */
const fs = require('fs');
const P = (f) => require('path').join(__dirname, f);

let html = fs.readFileSync(P('index.html'), 'utf8');
let json = fs.readFileSync(P('guide.json'), 'utf8').trim();

/* 安全检查：JSON 里不能出现 </script>，否则会提前闭合脚本标签 */
if (/<\/script/i.test(json)) { console.error('❌ JSON 含 </script>，已终止'); process.exit(1); }

const lines = html.split('\n');
const idx = lines.findIndex(l => l.startsWith('const GUIDE ='));
if (idx < 0) { console.error('❌ 找不到 const GUIDE 行'); process.exit(1); }

lines[idx] = 'const GUIDE = (function(){ try { return ' + json + '; } catch(e){ return SAMPLE; } })();';
fs.writeFileSync(P('index.html'), lines.join('\n'));

console.log('✅ 已注入：第', idx + 1, '行');
console.log('   JSON 字节:', json.length);
console.log('   HTML 字节:', fs.statSync(P('index.html')).size);
/* 回读校验：能否被 JS 解析 */
try { JSON.parse(json); console.log('   JSON 语法: OK'); }
catch (e) { console.error('   JSON 语法错误:', e.message); process.exit(1); }
