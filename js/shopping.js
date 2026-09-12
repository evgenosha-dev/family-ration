/* ============================================================
   СПИСОК ПОКУПОК И СРАВНЕНИЕ МАГАЗИНОВ
   Стоимость корзины по каждому магазину, отзывы, бюджет,
   «смешанная корзина» — где каждый продукт покупать выгоднее.
   ============================================================ */

function storeListForProduct(prod, storeIds) {
  const out = [];
  const baseMult = prod.mult || CATEGORY_PRICE_MULT[prod.cat] || DEFAULT_PRICE_MULT;
  for (const sid of storeIds) {
    const store = STORES.find((s) => s.id === sid);
    if (!store) continue;
    const m = baseMult[sid];
    if (m === null) continue;               // в этом магазине продукта нет
    if (prod.notAt && prod.notAt.includes(sid)) continue;
    const price = Math.round(prod.base * (m !== undefined ? m : DEFAULT_PRICE_MULT[sid]));
    out.push({ storeId: sid, storeName: store.name, storeColor: store.color, price, rating: store.rating });
  }
  return out;
}

function unitInfo(prod) {
  if (prod.unit === 'шт' && prod.id === 'egg') return { factor: 60, unit: 'шт', perUnitLabel: 'шт' };
  return { factor: 1000, unit: 'кг', perUnitLabel: 'кг' };
}

/* Превращает меню в список покупок.
   returns: [ { productId, name, cat, grams, pieces, amount, stores: [ {storeId, price, cost, rating} ] } ]
*/
function buildShoppingList(menu, storeIds) {
  const acc = {}; // productId -> grams (сумма по всем блюдам с масштабом)
  for (const s of menu.slots) {
    if (!s.recipe) continue;
    for (const [pid, grams] of Object.entries(s.recipe.ing)) {
      acc[pid] = (acc[pid] || 0) + grams * s.scale;
    }
  }

  const lines = [];
  for (const [pid, grams] of Object.entries(acc)) {
    const prod = PRODUCT_BY_ID[pid];
    if (!prod) continue;
    const ui = unitInfo(prod);
    const pieces = Math.max(1, Math.ceil((grams / ui.factor) * (ui.unit === 'шт' ? 1 : 1)));
    const amount = ui.unit === 'шт' ? pieces : grams / 1000;
    const stores = storeListForProduct(prod, storeIds).map((st) => ({
      ...st,
      cost: Math.round(amount * st.price),
    }));
    lines.push({
      productId: pid,
      name: prod.name,
      cat: prod.cat,
      grams: Math.round(grams),
      amount,
      amountUnit: ui.unit,
      stores,
      availCount: stores.length,
    });
  }

  lines.sort((a, b) => (a.cat < b.cat ? -1 : a.cat > b.cat ? 1 : 0));
  return lines;
}

/* Итоги по каждому магазину для полной корзины */
function storeTotals(shoppingList, storeIds) {
  const totals = storeIds.map((sid) => {
    const store = STORES.find((s) => s.id === sid);
    let cost = 0, missing = 0;
    const ratings = [];
    for (const line of shoppingList) {
      const st = line.stores.find((x) => x.storeId === sid);
      if (!st) { missing++; continue; }
      cost += st.cost;
      ratings.push(st.rating);
    }
    const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    return {
      storeId: sid,
      name: store.name,
      color: store.color,
      baseRating: store.rating,
      avgRating: Math.round(avgRating * 10) / 10,
      cost: Math.round(cost),
      missing,
      available: shoppingList.length - missing,
    };
  });
  return totals;
}

/* Лучший магазин по цене и лучший — по отзывам */
function bestStore(totals, shoppingList) {
  let cheapest = null, bestRated = null;
  for (const t of totals) {
    if (t.missing === 0) {
      if (!cheapest || t.cost < cheapest.cost) cheapest = t;
    }
    if (!bestRated || t.avgRating > bestRated.avgRating) bestRated = t;
  }
  let cheapestPartial = totals.length ? totals.reduce((a, b) => (a.missing < b.missing || (a.missing === b.missing && a.cost < b.cost) ? a : b)) : null;
  return { cheapest, bestRated, cheapestPartial };
}

/* Смешанная корзина: для каждого продукта выбран магазин.
   choices: { productId: storeId }
   Если для продукта выбран магазин без прайса — пропускаем позицию.
*/
function mixedCart(shoppingList, choices) {
  let cost = 0;
  const items = [];
  for (const line of shoppingList) {
    const ch = choices[line.productId];
    const st = ch ? line.stores.find((x) => x.storeId === ch) : null;
    if (!st) { items.push({ ...line, chosen: null, cartCost: 0, source: 'нет в корзине' }); continue; }
    cost += st.cost;
    items.push({ ...line, chosen: st.storeId, cartCost: st.cost, source: st.storeName });
  }
  return { cost: Math.round(cost), items };
}

/* Недельный бюджет: множитель дней + предупреждение */
function weekEstimate(dayCost, weeklyBudget) {
  const weekCost = dayCost * 7;
  const over = weeklyBudget > 0 && weekCost > weeklyBudget;
  return { weekCost: Math.round(weekCost), over, deficit: weeklyBudget > 0 ? weekCost - weeklyBudget : 0 };
}