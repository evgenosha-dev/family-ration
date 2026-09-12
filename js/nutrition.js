/* ============================================================
   РАСЧЁТ НОРМ ПИТАНИЯ
   Базовый обмен (Mifflin-St Jeor), активность, БЖУ на семью.
   ============================================================ */

const ACTIVITY_PRESETS = {
  low:    { label: 'Низкая',        mult: 1.2 },
  light:  { label: 'Средняя',       mult: 1.375 },
  moderate:{ label: 'Высокая',      mult: 1.55 },
  high:   { label: 'Очень высокая', mult: 1.725 },
};

const KID_FACTOR = 95; // ккал на кг веса для ребёнка 1-3 лет

function calcPersonTargets(person) {
  let kcal;
  if (person.isChild) {
    kcal = Math.round(person.weight * KID_FACTOR);
  } else {
    let bmr;
    if (person.sex === 'm') {
      bmr = 10 * person.weight + 6.25 * person.height - 5 * person.age + 5;
    } else {
      bmr = 10 * person.weight + 6.25 * person.height - 5 * person.age - 161;
    }
    kcal = Math.round(bmr * (person.activityMult || 1.375));
  }
  const protein = Math.round((kcal * 0.16) / 4);   // 16% ккал
  const fat     = Math.round((kcal * 0.28) / 9);   // 28% ккал
  const carb    = Math.round((kcal * 0.56) / 4);   // 56% ккал
  return { kcal, protein, fat, carb };
}

function calcFamilyTargets(family) {
  const totals = { kcal: 0, protein: 0, fat: 0, carb: 0 };
  const perPerson = {};
  family.forEach((p) => {
    const t = calcPersonTargets(p);
    perPerson[p.id] = t;
    totals.kcal += t.kcal;
    totals.protein += t.protein;
    totals.fat += t.fat;
    totals.carb += t.carb;
  });
  return { totals, perPerson };
}

/* Норма на один приём пищи (доля от суточной нормы) */
const SLOT_SHARES = {
  breakfast: 0.20,
  lunch:     0.35,
  dinner:    0.30,
  snack1:    0.08,
  snack2:    0.07,
};

const SLOT_LABELS = {
  breakfast: 'Завтрак',
  lunch:     'Обед',
  dinner:    'Ужин',
  snack1:    'Перекус 1',
  snack2:    'Перекус 2',
};

/* Питательность продукта на указанное количество граммов (или штук) */
function productNutrients(grams, prod) {
  return {
    kcal:    prod.kcal * grams / 100,
    protein: prod.p * grams / 100,
    fat:     prod.f * grams / 100,
    carb:    prod.c * grams / 100,
  };
}

const PRODUCT_BY_ID = {};
PRODUCTS.forEach((p) => { PRODUCT_BY_ID[p.id] = p; });

/* Автоподсчёт питательности рецепта из ингредиентов */
function computeRecipeNutrition(recipe) {
  let kcal = 0, protein = 0, fat = 0, carb = 0;
  const allergenSet = new Set();
  let vegetarian = true;
  let vegan = true;
  for (const [pid, grams] of Object.entries(recipe.ing)) {
    const prod = PRODUCT_BY_ID[pid];
    if (!prod) continue;
    const n = productNutrients(grams, prod);
    kcal += n.kcal; protein += n.protein; fat += n.fat; carb += n.carb;
    if (prod.alerg) prod.alerg.forEach((a) => allergenSet.add(a));
    if (!prod.veg) vegetarian = false;
    if (!prod.vegan) vegan = false;
  }
  return {
    ...recipe,
    kcal: Math.round(kcal),
    protein: Math.round(protein),
    fat: Math.round(fat),
    carb: Math.round(carb),
    ingredients: Object.keys(recipe.ing),
    vegetarian,
    vegan,
    allergens: [...allergenSet],
  };
}

const RECIPE_NUTRITION_CACHE = {};
function getRecipeNutrition(recipeId) {
  if (!RECIPE_NUTRITION_CACHE[recipeId]) {
    const recipe = RECIPES.find((r) => r.id === recipeId);
    RECIPE_NUTRITION_CACHE[recipeId] = computeRecipeNutrition(recipe);
  }
  return RECIPE_NUTRITION_CACHE[recipeId];
}

/* Граммы на этикетке «порция/семья» — для UI */
function formatPortions(recipe) {
  const totalGrams = Object.values(recipe.ing).reduce((s, g) => s + g, 0);
  return totalGrams;
}