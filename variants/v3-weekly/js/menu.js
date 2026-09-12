/* ============================================================
   ГЕНЕРАТОР МЕНЮ
   Фильтры по стилю питания, аллергенам, кухне, «детским» блюдам.
   Подбор блюд по слотам с учётом целевых калорий каждого приёма.
   ============================================================ */

const ALLERGENS_LIST = [
  { id: 'лактоза',     label: 'Лактоза / молочное' },
  { id: 'молочное',    label: 'Молочный белок' },
  { id: 'глютен',      label: 'Глютен' },
  { id: 'яйца',        label: 'Яйца' },
  { id: 'орехи',       label: 'Орехи' },
  { id: 'арахис',      label: 'Арахис' },
  { id: 'рыба',        label: 'Рыба' },
  { id: 'морепродукты',label: 'Морепродукты' },
];

const DIET_STYLES = [
  { id: 'any',        label: 'Любое' },
  { id: 'vegetarian', label: 'Вегетарианское' },
  { id: 'vegan',      label: 'Веганское' },
  { id: 'meatfree',   label: 'Без мяса (рыба можно)' },
];

const CUISINES = ['Русская', 'Итальянская', 'Азиатская', 'Средиземноморская', 'Универсальная'];

const includeAllergen = { лактоза: true, молочное: true }; // эти не выносим в «детские» исключения примитивы

function recipeMatchesFilters(recipe, filters) {
  if (filters.kidOnly && !recipe.kid) return false;
  if (filters.cuisines.length && !filters.cuisines.includes(recipe.cuisine) && recipe.cuisine !== 'Универсальная') {
    // универсальная подходит для любой выбранной кухни
    if (!filters.cuisines.includes('Универсальная')) return false;
  }
  if (filters.diet === 'vegetarian' && !recipe.vegetarian) return false;
  if (filters.diet === 'vegan' && !recipe.vegan) return false;
  if (filters.diet === 'meatfree') {
    // без мяса: не-вегетарианские рецепты разрешены только если их ингредиенты — рыба/морепродукты/яйца/молочка
  }
  for (const alerg of filters.excludeAllergens) {
    if (recipe.allergens.includes(alerg)) return false;
  }
  return true;
}

/* Итоговый список допустимых рецептов под фильтры */
function filterRecipes(filters) {
  return RECIPES
    .map((r) => getRecipeNutrition(r.id))
    .filter((r) => recipeMatchesFilters(r, filters));
}

/* Доля рецепта, реально приходящаяся на «без мяса» при diet=meatfree */
function pickCandidates(recipes, mealType, slotKcal, filters, rng) {
  let candidates = recipes.filter((r) => r.meal === mealType);
  if (filters.diet === 'meatfree') {
    candidates = candidates.filter((r) => r.vegetarian || hasNoMeat(r));
  }
  if (!candidates.length) return [];

  // предпочтительные — те, чьи ккал близки к цели слота, чтобы масштаб был разумным
  const preferred = candidates.filter((r) => {
    const ratio = r.kcal / slotKcal;
    return ratio >= 0.5 && ratio <= 1.8;
  });
  const pool = preferred.length ? preferred : candidates;

  // перемешиваем с фиксированным зерном (можно менять через rng)
  const shuffled = shuffle(pool.slice(), rng);
  return shuffled;
}

function hasNoMeat(recipe) {
  return recipe.ingredients.every((pid) => {
    const p = PRODUCT_BY_ID[pid];
    return !(!p.veg && !p.alerg?.includes('рыба') && !p.alerg?.includes('морепродукты'));
  });
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor((rng ? rng() : Math.random()) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* Генерация меню на день.
   Возвращает { slots: [...], totals, balance }
*/
function generateMenu(filters, familyTargetKcal, rng) {
  const recipes = filterRecipes(filters);
  const usedIds = new Set();
  const slots = [];
  const totals = { kcal: 0, protein: 0, fat: 0, carb: 0 };
  let balance = 0;
  let emptySlots = 0;

  const slotDefs = ['breakfast', 'lunch', 'dinner', 'snack1', 'snack2'];

  for (const def of slotDefs) {
    const target = familyTargetKcal * SLOT_SHARES[def];
    let candidates = pickCandidates(recipes, def === 'snack1' || def === 'snack2' ? 'snack' : def, target, filters, rng);
    candidates = candidates.filter((r) => !usedIds.has(r.id));
    if (!candidates.length) {
      // если все уникальные закончились — разрешаем повтор, лишь бы не пропадал слот
      candidates = pickCandidates(recipes, def === 'snack1' || def === 'snack2' ? 'snack' : def, target, filters, rng);
    }

    if (!candidates.length) {
      emptySlots++;
      slots.push({ slot: def, recipe: null, scale: 0, kcal: 0, protein: 0, fat: 0, carb: 0 });
      continue;
    }

    const recipe = candidates[0];
    usedIds.add(recipe.id);
    const scale = target / recipe.kcal;
    const n = {
      kcal: Math.round(recipe.kcal * scale),
      protein: Math.round(recipe.protein * scale),
      fat: Math.round(recipe.fat * scale),
      carb: Math.round(recipe.carb * scale),
    };
    const slotBal = target > 0 ? Math.abs(n.kcal - target) / target : 0;
    balance += slotBal;
    totals.kcal += n.kcal;
    totals.protein += n.protein;
    totals.fat += n.fat;
    totals.carb += n.carb;
    slots.push({ slot: def, recipe, scale, kcal: n.kcal, protein: n.protein, fat: n.fat, carb: n.carb, balance: slotBal });
  }

  balance = slots.length ? balance / slots.length : 0;
  const completeness = slotDefs.length ? (slotDefs.length - emptySlots) / slotDefs.length : 0;
  return { slots, totals, balance, completeness };
}

/* Перегенерировать один слот в уже сгенерированном меню */
function regenerateSlot(menu, slotDef, filters, familyTargetKcal, rng) {
  const recipes = filterRecipes(filters);
  const keptIds = new Set(
    menu.slots.filter((s) => s.slot !== slotDef && s.recipe).map((s) => s.recipe.id)
  );
  const target = familyTargetKcal * SLOT_SHARES[slotDef];
  let candidates = pickCandidates(
    recipes,
    slotDef === 'snack1' || slotDef === 'snack2' ? 'snack' : slotDef,
    target, filters, rng
  );
  const prevId = menu.slots.find((s) => s.slot === slotDef).recipe?.id;
  candidates = candidates.filter((r) => r.id !== prevId);
  if (!candidates.length) return menu;

  const unseen = candidates.filter((r) => !keptIds.has(r.id));
  const recipe = (unseen.length ? unseen : candidates)[0];
  const scale = target / recipe.kcal;

  const newSlots = menu.slots.map((s) => {
    if (s.slot !== slotDef) return s;
    const n = {
      kcal: Math.round(recipe.kcal * scale),
      protein: Math.round(recipe.protein * scale),
      fat: Math.round(recipe.fat * scale),
      carb: Math.round(recipe.carb * scale),
    };
    return { slot: slotDef, recipe, scale, ...n, balance: Math.abs(n.kcal - target) / target };
  });

  return recomputeMenuTotals({ slots: newSlots }, familyTargetKcal);
}

function recomputeMenuTotals(menu, familyTargetKcal) {
  const totals = { kcal: 0, protein: 0, fat: 0, carb: 0 };
  let balance = 0;
  menu.slots.forEach((s) => {
    totals.kcal += s.kcal;
    totals.protein += s.protein;
    totals.fat += s.fat;
    totals.carb += s.carb;
    balance += s.balance || 0;
  });
  menu.totals = totals;
  menu.balance = menu.slots.length ? balance / menu.slots.length : 0;
  menu.completeness = menu.slots.filter((s) => s.recipe).length / menu.slots.length;
  return menu;
}