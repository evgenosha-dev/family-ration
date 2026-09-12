/* Проверка варианта v3 (неделя). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'variants', 'v3-weekly');
const files = ['js/data.js', 'js/nutrition.js', 'js/menu.js', 'js/shopping.js', 'js/weekly.js'];

const sandbox = { console, Math, JSON };
vm.createContext(sandbox);
let combined = files.map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
combined += `
globalThis.API = { generateWeek, buildWeeklyShoppingList, regenerateWeekSlot,
  calcFamilyTargets, storeTotals, bestStore, mixedCart, storeListForProduct, PRODUCT_BY_ID };`;
vm.runInContext(combined, sandbox, { filename: 'bundle-weekly.js' });
const A = sandbox.API;

let errors = 0;
const err = (m) => { console.error('  ✗ ' + m); errors++; };
const ok = (m) => console.log('  ✓ ' + m);

const family = [
  { id: 'woman', age: 26, sex: 'f', weight: 58, height: 165, activityMult: 1.375 },
  { id: 'man',   age: 26, sex: 'm', weight: 78, height: 180, activityMult: 1.375 },
  { id: 'kid',   age: 2,  sex: 'm', weight: 12.5, height: 88, activityMult: 1.5, isChild: true },
];
const t = A.calcFamilyTargets(family);
const filters = { diet: 'any', kidOnly: false, cuisines: [], excludeAllergens: [] };

console.log('Неделя (без фильтров):');
const week = A.generateWeek(7, filters, t.totals.kcal);
ok(`дней: ${week.days.length}`);
ok(`блюд всего: ${week.totalSlots}, уникальных: ${week.uniqueRecipes}`);
ok(`средний день: ${Math.round(week.avg.kcal)} ккал (норма ${t.totals.kcal})`);
ok(`за неделю: ${week.totals.kcal.toLocaleString('ru-RU')} ккал`);
const allSlotsFilled = week.days.every((d) => d.slots.every((s) => s.recipe));
if (!allSlotsFilled) err('есть пустые слоты');

console.log('\nРаспределение повторов (не чаще 2 повторов одного блюда за неделю):');
const usage = {};
week.days.forEach((d) => d.slots.forEach((s) => { if (s.recipe) usage[s.recipe.id] = (usage[s.recipe.id] || 0) + 1; }));
const maxRepeat = Math.max(...Object.values(usage), 0);
ok(`максимум повторов одного блюда: ${maxRepeat}`);
if (maxRepeat > 2) err('слишком много повторов одного блюда');

console.log('\nРегенерация слота:');
const before = week.days[0].slots.find((s) => s.slot === 'lunch').recipe.id;
const week2 = A.regenerateWeekSlot(week, 0, 'lunch', filters, t.totals.kcal, null);
if (!week2) err('regenerate вернул null');
const after = week2.days[0].slots.find((s) => s.slot === 'lunch').recipe.id;
if (before === after) err('слот не изменился после перегенерации');
ok(`слот заменён: ${before} → ${after}`);

console.log('\nКорзина на неделю:');
const allStores = ['pyat', 'magnit', 'vv', 'lenta', 'ozon', 'lavka'];
const shopping = A.buildWeeklyShoppingList(week, allStores);
ok(`позиций: ${shopping.length}`);
const totals = A.storeTotals(shopping, allStores);
totals.forEach((x) => console.log(`  ${x.name}: ${x.cost} ₽ (★${x.avgRating})`));
const best = A.bestStore(totals, shopping);
ok(`дешевле всего: ${best.cheapest.name}, лучшие отзывы: ${best.bestRated.name}`);
const choices = {};
shopping.forEach((l) => choices[l.productId] = l.stores.reduce((a, b) => (b.cost < a.cost ? b : a)).storeId);
const mixed = A.mixedCart(shopping, choices);
ok(`смешанная корзина: ${mixed.cost} ₽`);
if (shopping.some((l) => !l.stores.length)) err('есть продукт без доступных магазинов');

if (!allSlotsFilled || !week.avg.kcal) { /* особая сводка */ }
console.log('\nИтог: ' + (errors ? errors + ' ошибок' : 'все проверки пройдены'));
process.exit(errors ? 1 : 0);