/* 冒烟测试：极简 DOM mock 下执行页面内联 JS，重点验证新增的三个渲染函数 */
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('index.html', 'utf8');
const js = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n;\n');

const store = {};
const mkEl = (id) => ({
  id: id || '', innerHTML: '', textContent: '', value: '', style: {}, dataset: {},
  children: [], classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
  appendChild(c) { this.children.push(c); return c; },
  append(...cs) { cs.forEach(c => this.children.push(c)); },
  removeChild() {}, setAttribute() {},
  getAttribute: () => '', addEventListener() {}, removeEventListener() {},
  querySelector: () => mkEl(), querySelectorAll: () => [],
  scrollIntoView() {}, focus() {}, closest: () => mkEl(), parentElement: null,
  onclick: null, oninput: null, href: '', offsetTop: 0
});
global.document = {
  querySelector: (s) => (store[s] || (store[s] = mkEl(s))),
  querySelectorAll: () => [],
  getElementById: (s) => (store['#' + s] || (store['#' + s] = mkEl(s))),
  createElement: () => mkEl(),
  addEventListener() {}, head: { appendChild() {} }, body: mkEl(), title: ''
};
global.window = { addEventListener() {}, scrollY: 0, scrollTo() {}, location: { href: '' }, L: null };
global.L = null;
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.navigator = { clipboard: { writeText: () => Promise.resolve() } };
global.location = { reload() {}, href: '' };
global.alert = () => {};
global.setTimeout = (f) => { try { f(); } catch (e) {} return 0; };
global.requestAnimationFrame = () => 0;

const errors = [];
const sandbox = { ...global, console };
vm.createContext(sandbox);
/* 在末尾 render() 之前暴露 GUIDE，并单独捕获 render 的错误（地图相关在 mock 下必然失败，不影响判定） */
const js2 = js.replace(/\nrender\(\);\s*$/,
  '\n;globalThis.__GUIDE=GUIDE;\ntry{render();}catch(e){globalThis.__renderErr=e.message;}\n');
try { vm.runInContext(js2, sandbox, { filename: 'page.js' }); }
catch (e) { errors.push('整体执行: ' + e.message); }
if (sandbox.__renderErr) errors.push('render(): ' + sandbox.__renderErr);

/* 单独调用新增渲染函数 */
const g = sandbox.__GUIDE;
if (!g) { console.error('❌ 拿不到 GUIDE'); process.exit(1); }
sandbox.GUIDE = g;
for (const fn of ['renderDrive', 'renderSpots', 'renderFoodShops']) {
  try { sandbox[fn](g); }
  catch (e) { errors.push(fn + '(): ' + e.message); }
}
/* 交互路径 */
try {
  sandbox.selectSpotCity(g.cities[1]);
  sandbox.selectFoodCity(g.foodShops[2]);
  sandbox.spotCard(g.cities[0].spots[0], 0);
  sandbox.foodShopCard(g.foodShops[0].items[0], 0);
} catch (e) { errors.push('交互: ' + e.message); }

/* 扫描输出中的 undefined / NaN */
const bad = [];
for (const [k, v] of Object.entries(store)) {
  const t = (v.innerHTML || '') + (v.textContent || '');
  if (/undefined|NaN|\[object Object\]/.test(t)) bad.push(k);
}

console.log('运行时错误:', errors.length ? errors.join(' | ') : '无 ✅');
console.log('含 undefined/NaN:', bad.length ? bad.join(', ') : '无 ✅');
console.log('渲染字节数:');
['#driveRoute','#drivePlans','#driveShifts','#driveStops','#chargeVerdict','#superchargers',
 '#cityTabs','#cityIntro','#spotList','#foodCityTabs','#mealChips','#foodShopList','#seafoodRules','#babyFood']
  .forEach(s => console.log('   ' + s.padEnd(16), (store[s] && store[s].innerHTML.length) || 0));
process.exit(errors.length || bad.length ? 1 : 0);
