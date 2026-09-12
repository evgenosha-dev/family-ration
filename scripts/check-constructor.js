/* Проверка варианта v4 (конструктор). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'variants', 'v4-constructor');
const files = ['js/data.js', 'js/nutrition.js', 'js/menu.js', 'js/shopping.js', 'js/builder.js'];

const sandbox = { console, Math, JSON };
vm.createContext(sandbox);
let combined = files.map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
combined += `
globalThis.API = { buildDayFromSelection, fillEmptySlots, getRecipeNutrition,
  calcFamilyTargets, buildShoppingList, storeTotals, bestStore, mixedCart };`;
vm.runInContext(combined, sandbox, { filename: 'bundle-constructor.js' });
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

console.log('Пустой день:');
let day = A.buildDayFromSelection({}, t.totals.kcal);
ok('слотов: ' + day.slots.filter((s) => s.recipe).length + '/5, ккал ' + Math.round(day.totals.kcal));

console.log('Автозаполнение:');
const selection = A.fillEmptySlots({}, filters, t.totals.kcal);
day = A.buildDayFromSelection(selection, t.totals.kcal);
const filled = day.slots.filter((s) => s.recipe).length;
ok('после автозаполнения: ' + filled + '/5 слотов');
ok('итог: ' + Math.round(day.totals.kcal) + ' ккал (норма ' + t.totals.kcal + ')');
if (filled < 5) err('не заполнились все слоты');
if (Math.abs(day.totals.kcal - t.totals.kcal) > 1) err('ккал не совпали с нормой (проверьте масштаб)');

console.log('Пользовательская замена:');
const example = { breakfast: 'r3', lunch: 'r18', dinner: 'r25', snack1: 'r33', snack2: 'r32' };
day = A.buildDayFromSelection(example, t.totals.kcal);
ok('выбранные блюда: ' + day.slots.map((s) => s.recipe ? s.recipe.id : '-').join(', '));
ok('итог: ' + Math.round(day.totals.kcal) + ' ккал, Б ' + day.totals.protein + ', Ж ' + day.totals.fat + ', У ' + day.totals.carb);
if (Math.abs(day.totals.kcal - t.totals.kcal) > 1) err('ккал не совпали по выбранным блюдам');

console.log('Корзина:');
const allStores = ['pyat', 'magnit', 'vv', 'lenta', 'ozon', 'lavka'];
const shopping = A.buildShoppingList(day, allStores);
ok('позиций: ' + shopping.length);
const totals = A.storeTotals(shopping, allStores);
const best = A.bestStore(totals, shopping);
ok('дешевле: ' + best.cheapest.name + ' (' + best.cheapest.cost + ' ₽) · отзывы: ' + best.bestRated.name);
const choices = {};
shopping.forEach((l) => choices[l.productId] = l.stores.reduce((a, b) => (b.cost < a.cost ? b : a)).storeId);
const mixed = A.mixedCart(shopping, choices);
ok('смешанная корзина: ' + mixed.cost + ' ₽ (экономия ' + (best.cheapest.cost - mixed.cost) + ' ₽)');
if (shopping.some((l) => !l.stores.length)) err('есть продукт без магазинов');

console.log('\nИтог: ' + (errors ? errors + ' ошибок' : 'все проверки пройдены'));
process.exit(errors ? 1 : 0);