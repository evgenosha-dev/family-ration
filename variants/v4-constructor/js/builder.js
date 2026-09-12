/* ============================================================
   КОНСТРУКТОР МЕНЮ (вариант v4)
   Пользователь сам выбирает блюда в каждый слот; блюдо
   автоматически масштабируется под целевые калории слота.
   ============================================================ */

const SLOT_DEFS = ['breakfast', 'lunch', 'dinner', 'snack1', 'snack2'];

/* Из словаря «слот -> id рецепта» строим меню с масштабом под цель слота */
function buildDayFromSelection(selection, targetKcal) {
  const slots = [];
  const totals = { kcal: 0, protein: 0, fat: 0, carb: 0 };
  for (const def of SLOT_DEFS) {
    const recipe = selection[def] ? getRecipeNutrition(selection[def]) : null;
    const target = targetKcal * SLOT_SHARES[def];
    if (!recipe) {
      slots.push({ slot: def, recipe: null, scale: 0, kcal: 0, protein: 0, fat: 0, carb: 0 });
      continue;
    }
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

/* Случайное заполнение пустых слотов (через штатный генератор) */
function fillEmptySlots(selection, filters, targetKcal) {
  const auto = generateMenu(filters, targetKcal);
  auto.slots.forEach((s) => {
    if (!selection[s.slot] && s.recipe) selection[s.slot] = s.recipe.id;
  });
  return selection;
}