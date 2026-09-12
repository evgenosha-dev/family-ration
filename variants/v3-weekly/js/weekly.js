/* ============================================================
   НЕДЕЛЬНЫЙ ПЛАНИРОВЩИК
   Генерирует меню на 7 дней с распределением блюд (не больше
   повторов, чем возможно), сводкой по неделе и корзиной.
   ============================================================ */

const WEEKDAY_NAMES = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/* Блюдо для слота дня d: используем рейтинг использования, чтобы
   распределять блюда по неделе равномерно. */
function pickForWeekSlot(candidates, usage) {
  if (!candidates.length) return null;
  const byUsage = candidates.slice().sort((a, b) => (usage[a.id] || 0) - (usage[b.id] || 0) || (a.id < b.id ? -1 : 1));
  return byUsage[0];
}

function generateDay(recipes, filters, targetKcal, usage, rng) {
  const slots = [];
  const totals = { kcal: 0, protein: 0, fat: 0, carb: 0 };
  const slotDefs = ['breakfast', 'lunch', 'dinner', 'snack1', 'snack2'];

  for (const def of slotDefs) {
    const target = targetKcal * SLOT_SHARES[def];
    const mealType = def === 'snack1' || def === 'snack2' ? 'snack' : def;
    let candidates = pickCandidates(recipes, mealType, target, filters, rng);
    const recipe = pickForWeekSlot(candidates, usage);

    if (!recipe) {
      slots.push({ slot: def, recipe: null, scale: 0, kcal: 0, protein: 0, fat: 0, carb: 0 });
      continue;
    }
    usage[recipe.id] = (usage[recipe.id] || 0) + 1;
    const scale = target / recipe.kcal;
    const n = {
      kcal: Math.round(recipe.kcal * scale),
      protein: Math.round(recipe.protein * scale),
      fat: Math.round(recipe.fat * scale),
      carb: Math.round(recipe.carb * scale),
    };
    totals.kcal += n.kcal; totals.protein += n.protein; totals.fat += n.fat; totals.carb += n.carb;
    slots.push({ slot: def, recipe, scale, ...n });
  }
  return { slots, totals };
}

/* Неделя: n дней */
function generateWeek(numDays, filters, targetKcal, rng) {
  const recipes = filterRecipes(filters);
  const usage = {};
  const days = [];
  for (let d = 0; d < numDays; d++) {
    days.push(generateDay(recipes, filters, targetKcal, usage, rng));
  }

  const totals = { kcal: 0, protein: 0, fat: 0, carb: 0 };
  days.forEach((day) => {
    totals.kcal += day.totals.kcal;
    totals.protein += day.totals.protein;
    totals.fat += day.totals.fat;
    totals.carb += day.totals.carb;
  });

  const uniqueRecipes = new Set();
  days.forEach((d) => d.slots.forEach((s) => s.recipe && uniqueRecipes.add(s.recipe.id)));

  return { days, totals, avg: {
    kcal: totals.kcal / numDays,
    protein: totals.protein / numDays,
    fat: totals.fat / numDays,
    carb: totals.carb / numDays,
  }, uniqueRecipes: uniqueRecipes.size, totalSlots: numDays * 5 };
}

/* Перегенерировать слот конкретного дня */
function regenerateWeekSlot(week, dayIdx, slotDef, filters, targetKcal, rng) {
  const recipes = filterRecipes(filters);
  const usage = {};
  week.days.forEach((d, di) => d.slots.forEach((s) => {
    if ((di !== dayIdx || s.slot !== slotDef) && s.recipe) usage[s.recipe.id] = (usage[s.recipe.id] || 0) + 1;
  }));

  const target = targetKcal * SLOT_SHARES[slotDef];
  const mealType = slotDef === 'snack1' || slotDef === 'snack2' ? 'snack' : slotDef;
  const prevId = week.days[dayIdx].slots.find((s) => s.slot === slotDef).recipe?.id;
  let candidates = pickCandidates(recipes, mealType, target, filters, rng).filter((r) => r.id !== prevId);
  if (!candidates.length) return week;
  const recipe = pickForWeekSlot(candidates, usage);
  if (!recipe) return week;
  const scale = target / recipe.kcal;
  const n = {
    kcal: Math.round(recipe.kcal * scale),
    protein: Math.round(recipe.protein * scale),
    fat: Math.round(recipe.fat * scale),
    carb: Math.round(recipe.carb * scale),
  };
  week.days[dayIdx].slots = week.days[dayIdx].slots.map((s) => (s.slot === slotDef ? { slot: slotDef, recipe, scale, ...n } : s));
  week.days[dayIdx].totals = { kcal: 0, protein: 0, fat: 0, carb: 0 };
  week.days.forEach((d) => {
    d.slots.forEach((s) => {
      d.totals.kcal += s.kcal; d.totals.protein += s.protein; d.totals.fat += s.fat; d.totals.carb += s.carb;
    });
  });
  return week;
}

/* Недельный список покупок с учётом масштаба каждого дня */
function buildWeeklyShoppingList(week, storeIds) {
  const acc = {};
  week.days.forEach((day) => day.slots.forEach((s) => {
    if (!s.recipe) return;
    for (const [pid, grams] of Object.entries(s.recipe.ing)) {
      acc[pid] = (acc[pid] || 0) + grams * s.scale;
    }
  }));

  const lines = [];
  for (const [pid, grams] of Object.entries(acc)) {
    const prod = PRODUCT_BY_ID[pid];
    if (!prod) continue;
    const ui = prod.unit === 'шт' ? { factor: 60, unit: 'шт' } : { factor: 1000, unit: 'кг' };
    const amount = ui.unit === 'шт' ? Math.max(1, Math.ceil(grams / ui.factor)) : grams / 1000;
    const stores = storeListForProduct(prod, storeIds).map((st) => ({ ...st, cost: Math.round(amount * st.price) }));
    lines.push({ productId: pid, name: prod.name, cat: prod.cat, grams: Math.round(grams), amount, amountUnit: ui.unit, stores });
  }
  lines.sort((a, b) => (a.cat < b.cat ? -1 : a.cat > b.cat ? 1 : 0));
  return lines;
}