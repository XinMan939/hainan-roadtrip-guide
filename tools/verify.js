/* 验证 index.html：JS 语法 + DOM 引用 + 数据完整性 */
const fs = require('fs');
const { execFileSync } = require('child_process');
const NODE = process.execPath;
const html = fs.readFileSync('index.html', 'utf8');

/* 1) 提取内联 script 做语法检查 */
const blocks = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
console.log('内联 script 块:', blocks.length);
const vm = require('vm');
const js = blocks.join('\n;\n');
try {
  new vm.Script(js, { filename: 'inline.js' });
  console.log('✅ JS 语法: OK（', js.length, '字节）');
} catch (e) {
  console.error('❌ JS 语法错误:', e.message);
  const ln = (e.stack || '').match(/inline\.js:(\d+)/);
  if (ln) {
    const arr = js.split('\n');
    const n = +ln[1];
    console.error('   出错行附近:\n' + arr.slice(Math.max(0, n - 4), n + 3).map((l, i) => `   ${n - 3 + i}| ${l.slice(0, 160)}`).join('\n'));
  }
  process.exit(1);
}

/* 2) DOM id 引用检查 */
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const used = new Set([...js.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)].map(m => m[1]));
const missing = [...used].filter(u => !ids.has(u));
console.log('DOM id 引用:', used.size, '个 | 缺失:', missing.length ? missing.join(', ') : '无 ✅');

/* 3) 新区块 id 是否齐全 */
const need = ['driveRoute','drivePlans','driveShifts','shiftRules','driveStops','chargeVerdict',
  'superchargers','xuwenCharge','chargeRisks','cityTabs','cityIntro','spotSearch','spotList',
  'foodCityTabs','mealChips','foodShopList','seafoodRules','babyFood','foodMethod'];
const lack = need.filter(n => !ids.has(n));
console.log('新增区块 id:', lack.length ? '❌ 缺 ' + lack.join(', ') : '全部就位 ✅');

/* 4) 导航是否含新区块 */
['sec-drive', 'sec-spots'].forEach(s => {
  console.log('  导航含', s + ':', new RegExp("'" + s + "'").test(js) ? '✅' : '❌');
});

/* 5) 数据完整性 */
const m = html.match(/const GUIDE = \(function\(\)\{ try \{ return ([\s\S]*?); \} catch\(e\)\{ return SAMPLE; \} \}\)\(\);/);
if (!m) { console.error('❌ 未匹配到 GUIDE 数据'); process.exit(1); }
const g = JSON.parse(m[1]);
console.log('\n=== 数据 ===');
console.log('  meta.people:', JSON.stringify(g.meta.people));
console.log('  cities:', g.cities.length, '城 / 景点', g.cities.reduce((a, c) => a + c.spots.length, 0));
console.log('  foodShops:', g.foodShops.length, '城 / 店铺', g.foodShops.reduce((a, c) => a + c.items.length, 0));
console.log('  drive: 方案', g.drive.plans.length, '排班', g.drive.shifts.length, '服务区', g.drive.stops.length);
console.log('  aa.perPerson 4人:', g.aa.perPerson.by4.low + '~' + g.aa.perPerson.by4.high);
console.log('  原有字段保留: days', g.days.length, '| legs', g.legs.length, '| ferry', !!g.ferry, '| hotels', g.hotels.length, '| pitfalls', g.pitfalls.length, '| research', g.research.length);
const coordSpots = g.cities.reduce((a, c) => a + c.spots.filter(s => s.coord).length, 0);
const coordFoods = g.foodShops.reduce((a, c) => a + c.items.filter(i => i.coord).length, 0);
console.log('  坐标: 景点', coordSpots, '| 店铺', coordFoods);
fs.unlinkSync('_inline.js');
