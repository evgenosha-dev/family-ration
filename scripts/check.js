/* Проверка целостности данных и логики приложения (для Node). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const files = ['js/data.js', 'js/nutrition.js', 'js/menu.js', 'js/shopping.js'];

const sandbox = { console, Math, JSON };
vm.createContext(sandbox);

let combined = files.map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
combined += `
globalThis.API = { STORES, PRODUCTS, RECIPES, PRODUCT_BY_ID, getRecipeNutrition, SLOT_SHARES,
  calcFamilyTargets, generateMenu, filterRecipes, buildShoppingList,
  storeTotals, bestStore, mixedCart };`;
vm.runInContext(combined, sandbox, { filename: 'bundle.js' });

const { STORES, PRODUCTS, RECIPES, PRODUCT_BY_ID, getRecipeNutrition, SLOT_SHARES,
        calcFamilyTargets, generateMenu, filterRecipes, buildShoppingList,
        storeTotals, bestStore, mixedCart } = sandbox.API;

let errors = 0;
const err = (msg) => { console.error('  ✗ ' + msg); errors++; };
const ok = (msg) => console.log('  ✓ ' + msg);

console.log('База данных:');
const ids = PRODUCTS.map(p => p.id);
if (new Set(ids).size !== ids.length) err('дубликаты id продуктов');
const recipeIds = RECIPES.map(r => r.id);
if (new Set(recipeIds).size !== recipeIds.length) err('дубликаты id рецептов');
const storeIds = STORES.map(s => s.id);
if (new Set(storeIds).size !== storeIds.length) err('дубликаты id магазинов');
if (!storeIds.includes('pyat')) err('нет магазина pyat');

RECIPES.forEach(r => {
  Object.keys(r.ing).forEach(pid => {
    if (!PRODUCT_BY_ID[pid]) err(`рецепт ${r.id}: продукт ${pid} не найден`);
  });
});

PRODUCTS.forEach(p => {
  if (!(p.base > 0)) err(`цена продукта ${p.id} не положительная`);
  if (typeof p.p !== 'number' || typeof p.f !== 'number' || typeof p.c !== 'number' || typeof p.kcal !== 'number')
    err(`БЖУ продукта ${p.id} некорректно`);
  if (p.cat && !['Овощи и фрукты','Мясо и рыба','Молочные продукты','Крупы и бакалея','Орехи и перекусы'].includes(p.cat))
    err(`неизвестная категория у ${p.id}`);
});

ok(`магазинов: ${STORES.length}`);
ok(`продуктов: ${PRODUCTS.length}`);
ok(`рецептов: ${RECIPES.length}`);
ok('все ингредиенты найдены');

console.log('\nПитательность рецептов:');
const badKcal = RECIPES.filter(r => getRecipeNutrition(r.id).kcal <= 0);
if (badKcal.length) badKcal.forEach(r => err(`рецепт ${r.id} имеет 0 ккал`));
ok(`рецептов с положительными ккал: ${RECIPES.length - badKcal.length}/${RECIPES.length}`);

const vegetarian = RECIPES.filter(r => getRecipeNutrition(r.id).vegetarian);
const kid = RECIPES.filter(r => getRecipeNutrition(r.id).kid);
ok(`вегетарианских рецептов: ${vegetarian.length}`);
ok(`детских рецептов: ${kid.length}`);

console.log('\nНормы питания:');
const family = [
  { id: 'woman', age: 26, sex: 'f', weight: 58, height: 165, activityMult: 1.375 },
  { id: 'man',   age: 26, sex: 'm', weight: 78, height: 180, activityMult: 1.375 },
  { id: 'kid',   age: 2,  sex: 'm', weight: 12.5, height: 88, activityMult: 1.5, isChild: true },
];
const t = calcFamilyTargets(family);
console.log('  женщина:', JSON.stringify(t.perPerson.woman));
console.log('  мужчина:', JSON.stringify(t.perPerson.man));
console.log('  ребёнок:', JSON.stringify(t.perPerson.kid));
console.log('  итого  :', JSON.stringify(t.totals));
if (t.totals.kcal < 3500 || t.totals.kcal > 7000) err('суммарная норма калорий вне ожидаемого диапазона 3500–7000');

console.log('\nГенерация меню (без фильтров):');
const baseFilters = { diet: 'any', kidOnly: false, cuisines: [], excludeAllergens: [] };
let menu = generateMenu(baseFilters, t.totals.kcal);
const slots = menu.slots;
const slotCount = slots.filter(s => s.recipe).length;
console.log('  слотов заполнено:', slotCount + '/5');
console.log('  итоги дня:', JSON.stringify(menu.totals));
console.log('  баланс:  ', menu.balance.toFixed(3), 'полнота:', menu.completeness);
if (slotCount < 5) err('часть слотов пуста без фильтров');
if (menu.totals.protein <= 0) err('нет белка в меню');

console.log('\nГенерация (веган + детское):');
const kidFilters = { diet: 'vegan', kidOnly: true, cuisines: [], excludeAllergens: [] };
const vegRecipes = filterRecipes(kidFilters);
console.log('  подходящих рецептов:', vegRecipes.length);
if (vegRecipes.length < 5) err('мало веган+детских рецептов');
let menu2 = generateMenu(kidFilters, family.reduce((s, p) => s + calcFamilyTargets(family).perPerson[p.id].kcal, 0));
console.log('  заполнено слотов:', menu2.slots.filter(s => s.recipe).length + '/5');

console.log('\nГенерация (без глютена и лактозы):');
const gfFilters = { diet: 'any', kidOnly: false, cuisines: [], excludeAllergens: ['глютен', 'лактоза'] };
const gfRecipes = filterRecipes(gfFilters);
console.log('  подходящих рецептов:', gfRecipes.length);
gfRecipes.forEach(r => {
  if (r.allergens.includes('глютен') || r.allergens.includes('лактоза'))
    err(`рецепт ${r.id} прошёл фильтр, но содержит глютен/лактозу: ${r.allergens}`);
});

const menu3 = generateMenu(gfFilters, t.totals.kcal);
console.log('  заполнено слотов:', menu3.slots.filter(s => s.recipe).length + '/5');
if (menu3.slots.filter(s => s.recipe).length < 3) err('слишком мало слотов при безглют./безлактозной диете (вариант "vegan" включает): возможно стоит расширить рецепты');

console.log('\nСписок покупок и магазины:');
const allStores = STORES.map(s => s.id);
const shopping = buildShoppingList(menu, allStores);
console.log('  позиций в списке:', shopping.length);
if (!shopping.length) err('пустой список покупок');
const totals = storeTotals(shopping, allStores);
totals.forEach(x => console.log(`  ${x.name}: ${x.cost} ₽ (доступно ${x.available}/${shopping.length}, ★${x.avgRating})`));
const best = bestStore(totals, shopping);
console.log('  дешевле всего:', best.cheapest && best.cheapest.name, '· лучшие отзывы:', best.bestRated && best.bestRated.name);
if (!best.cheapest) err('не найден магазин со 100% наличием');

const cheapestLine = shopping[0];
const minStore = cheapestLine.stores.reduce((a, b) => (b.cost < a.cost ? b : a));
const choices = {};
shopping.forEach(l => choices[l.productId] = l.stores.reduce((a, b) => (b.cost < a.cost ? b : a)).storeId);
const mixed = mixedCart(shopping, choices);
console.log('  смешанная корзина:', mixed.cost, '₽ (лучший одиночный:', best.cheapest ? best.cheapest.cost : '-', '₽)');
if (mixed.cost > (best.cheapest ? best.cheapest.cost : Infinity) + 0.01 && mixed.items.some(i => i.chosen))
  console.log('  ⚠ заметка: смешанная корзина не дешевле одиночного магазина (такое бывает)');

let missingStore = false;
shopping.forEach(l => {
  if (!l.stores.length) missingStore = true; // продукт недоступен ни в одном выбранном магазине
});
if (shopping.some(l => l.stores.length === 0)) err('есть продукты без ни одного магазина в наличии');

console.log('\nИтог: ' + (errors ? errors + ' ошибок' : 'все проверки пройдены'));
process.exit(errors ? 1 : 0);