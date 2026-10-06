/* 把本次新增数据（驾驶方案 / 城市景点库 / 店铺级美食 / AA 分摊）并入原有 guide.json
   原数据一律保留，只做增量。运行：node build-data.js  */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const g = JSON.parse(fs.readFileSync(path.join(__dirname, 'guide.json'), 'utf8'));

/* --- 载入本次新做的数据层 --- */
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'hainan-travel/data.js'), 'utf8'));
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'hainan-travel/food.js'), 'utf8'));
/* 高德坐标：spot:<id> / food:<id> -> {lng,lat,...} */
let COORDS = {};
try { eval('COORDS = ' + fs.readFileSync(path.join(ROOT, 'hainan-travel/coords.js'), 'utf8').replace(/^\s*const\s+COORDS\s*=/m, '')); }
catch (e) { COORDS = (typeof COORDS !== 'undefined') ? COORDS : {}; }
if (!COORDS || !Object.keys(COORDS).length) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'hainan-travel/coords.js'), 'utf8'));
}

/* ---------- 1) meta：3 人 → 4 人 ---------- */
g.meta.people = { total: 4, adults: 3, baby: 1, babyName: '谢知仁', babyBirth: '2025-11-23',
  note: '夫妻 + 儿子谢知仁（10-11 个月）+ 1 位朋友。婴儿景区/轮渡几乎全免票。' };
g.meta.priority = '万宁 / 陵水（主战场）> 海口 / 三亚（次之）> 文昌（最后，可略）';
g.meta.share = '路费（电/油费）+ 过路费 由 4 人（或按 3 个成人）AA 分摊；住宿/门票/餐饮按各自实际消费另算。';

/* ---------- 2) 驾驶方案（用户明确要求：3 人轮换、一口气到海口或万宁） ---------- */
const d = TRIP.drive;
g.drive = {
  route: d.route, routeAlt: d.routeAlt, distance: d.distance, pureDrive: d.pureDrive, planNote: d.planNote,
  plans: d.plans, shifts: d.shifts, shiftRule: d.shiftRule, stops: d.stops, charging: d.charging
};

/* ---------- 3) 城市景点库（点城市 → 推荐顺序 → 点景点看全量） ---------- */
const cityIdMap = { wanning: '万宁', lingshui: '陵水', haikou: '海口', sanya: '三亚', wenchang: '文昌' };
g.cities = TRIP.cities.map(c => ({
  id: c.id, name: c.name, badge: c.badge, priority: c.priority, intro: c.intro, stay: c.stay,
  spots: c.spots.map(s => {
    const cd = COORDS['spot:' + s.id];
    return {
      id: s.id, name: s.name, rating: s.rating, priceText: s.priceText,
      openTime: s.openTime, duration: s.duration, intro: s.intro, tags: s.tags || [],
      tickets: s.tickets || [], internal: s.internal || [], photos: s.photos || [],
      booking: s.booking, baby: s.baby, address: s.address, tips: s.tips || [],
      coord: cd ? [Number(cd.lng), Number(cd.lat)] : null,
      poi: cd ? { name: cd.poiName, addr: cd.addr, tel: cd.tel, open: cd.open, rating: cd.rating, cost: cd.cost } : null
    };
  })
}));

/* ---------- 4) 美食：保留原 6 条「必吃菜」，新增 56 家店铺级 ---------- */
const MEALS = ['早餐', '正餐', '夜宵', '小吃'];
g.foodShops = FOOD.cityOrder.map(cid => {
  const c = FOOD.cities[cid];
  return {
    id: cid, name: c.name, badge: c.badge, intro: c.intro,
    items: c.items.map(it => {
      const cd = COORDS['food:' + it.id];
      return {
        id: it.id, name: it.name, meal: it.meal, hours: it.hours, per: it.per,
        addr: it.addr, dishes: it.dishes, tips: it.tips || [],
        park: it.park, queue: it.queue, baby: it.baby,
        verify: it.verify, vnote: it.vnote,
        coord: cd ? [Number(cd.lng), Number(cd.lat)] : null,
        poi: cd ? { name: cd.poiName, addr: cd.addr, tel: cd.tel, open: cd.open, rating: cd.rating, cost: cd.cost } : null
      };
    })
  };
});
g.meals = MEALS;
g.seafoodRules = FOOD.seafoodRules || [];
g.babyFood = FOOD.babyFood || [];
g.foodMethod = FOOD.method || '';
g.foodRule = FOOD.rule || '';

/* ---------- 5) 预算：加 AA 与人均 ---------- */
g.aa = {
  note: '路费（电/油）+ 过路费 由同行人 AA；轮渡/住宿/门票/餐饮按实际消费另算。婴儿几乎不产生门票与餐饮成本。',
  base: TRIP.budget.aaBase,
  perPerson: TRIP.budget.perPerson,
  carCompare: TRIP.budget.carCompare
};
/* 原 budget 表格补一行 AA 提示 */
if (Array.isArray(g.budget) && !g.budget.some(b => /AA/.test(b.cat || ''))) {
  g.budget.push({
    cat: '路费+过路费 AA（往返）',
    eco: `¥${TRIP.budget.aaBase.toll + TRIP.budget.aaBase.fuel}`,
    note: `过路费 ¥${TRIP.budget.aaBase.toll} + 路费 ¥${TRIP.budget.aaBase.fuel}。4 人分摊人均约 ¥${Math.round((TRIP.budget.aaBase.toll + TRIP.budget.aaBase.fuel) / 4)}；按 3 个成人分摊人均约 ¥${Math.round((TRIP.budget.aaBase.toll + TRIP.budget.aaBase.fuel) / 3)}。${TRIP.budget.perPerson.note}`
  });
}

fs.writeFileSync(path.join(__dirname, 'guide.json'), JSON.stringify(g));
console.log('guide.json 已更新');
console.log('  cities:', g.cities.length, '| 景点总数:', g.cities.reduce((a, c) => a + c.spots.length, 0));
console.log('  foodShops:', g.foodShops.length, '城 | 店铺总数:', g.foodShops.reduce((a, c) => a + c.items.length, 0));
console.log('  drive: 方案', g.drive.plans.length, '| 排班', g.drive.shifts.length, '| 服务区', g.drive.stops.length);
console.log('  坐标命中: 景点', g.cities.reduce((a, c) => a + c.spots.filter(s => s.coord).length, 0),
  '| 店铺', g.foodShops.reduce((a, c) => a + c.items.filter(i => i.coord).length, 0));
