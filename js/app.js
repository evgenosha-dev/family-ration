/* ============================================================
   ПРИЛОЖЕНИЕ: состояние, рендер, обработчики
   ============================================================ */

const DEFAULT_STATE = {
  family: [
    { id: 'woman', role: 'Девушка', age: 26, sex: 'f', weight: 58, height: 165, activityMult: 1.375 },
    { id: 'man',   role: 'Парень',  age: 26, sex: 'm', weight: 78, height: 180, activityMult: 1.375 },
    { id: 'kid',   role: 'Сын (2 года)', age: 2, sex: 'm', weight: 12.5, height: 88, activityMult: 1.5, isChild: true },
  ],
  filters: {
    diet: 'any',
    kidOnly: false,
    cuisines: [],
    excludeAllergens: [],
    weeklyBudget: 6000,
    stores: ['pyat', 'magnit', 'vv', 'lenta', 'ozon', 'lavka'],
  },
};

const LS_KEY = 'semeinyi-racion-v1';
let state = loadState() || deepClone(DEFAULT_STATE);
let menu = null;
let choices = {};          // productId -> storeId (смешанная корзина)
let familyTargets = calcFamilyTargets(state.family);

/* ---------- утилиты ---------- */
function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return { ...deepClone(DEFAULT_STATE), ...s, family: s.family || deepClone(DEFAULT_STATE.family), filters: { ...DEFAULT_STATE.filters, ...(s.filters || {}) } };
  } catch (e) { return null; }
}
function saveState() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
}
const fmt = (n) => Math.round(n).toLocaleString('ru-RU');
const rub = (n) => fmt(n) + ' ₽';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

/* ---------- вкладки ---------- */
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'shopping') renderShopping();
    });
  });
}

/* ---------- семья ---------- */
function renderFamily() {
  const wrap = document.getElementById('family-cards');
  wrap.innerHTML = '';
  state.family.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'person-card';
    card.innerHTML = `
      <div class="person-head">
        <strong>${esc(p.role)}</strong><span class="head-right">
          ${p.isChild ? '<span class="badge kid">ребёнок</span>' : ''}
          <button class="icon-btn person-remove" data-remove="${p.id}" title="Удалить">✕</button>
        </span>
      </div>
      <label>Пол
        <select data-field="sex" ${p.isChild ? 'disabled' : ''}>
          <option value="f" ${p.sex === 'f' ? 'selected' : ''}>Женский</option>
          <option value="m" ${p.sex === 'm' ? 'selected' : ''}>Мужской</option>
        </select>
      </label>
      <div class="grid2">
        <label>Возраст
          <input type="number" data-field="age" min="1" max="99" value="${p.age}">
        </label>
        <label>Вес, кг
          <input type="number" data-field="weight" min="1" max="250" step="0.5" value="${p.weight}">
        </label>
      </div>
      <div class="grid2">
        <label>Рост, см
          <input type="number" data-field="height" min="50" max="230" value="${p.height}">
        </label>
        <label>Активность
          <select data-field="activityMult">
            ${Object.entries(ACTIVITY_PRESETS).map(([k, v]) =>
              `<option value="${v.mult}" ${Number(p.activityMult) === v.mult ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="person-target" data-target="${p.id}"></div>
    `;
    card.querySelectorAll('[data-field]').forEach((el) => {
      el.addEventListener('change', () => {
        const field = el.dataset.field;
        const val = el.value;
        if (field === 'age' || field === 'weight' || field === 'height') p[field] = parseFloat(val) || 0;
        else if (field === 'activityMult') p[field] = parseFloat(val);
        else p[field] = val;
        familyTargets = calcFamilyTargets(state.family);
        saveState();
        renderFamilyTargets();
        menu = generateMenu(state.filters, familyTargets.totals.kcal);
        choices = {};
        renderMenu();
        renderShopping();
      });
    });
    wrap.appendChild(card);
  });

  wrap.querySelectorAll('.person-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.remove;
      if (state.family.length <= 1) return;
      if (!confirm('Удалить «' + state.family.find((p) => p.id === id)?.role + '» из рациона?')) return;
      const idx = state.family.findIndex((p) => p.id === id);
      if (idx >= 0) state.family.splice(idx, 1);
      familyTargets = calcFamilyTargets(state.family);
      saveState();
      renderFamily();
      menu = generateMenu(state.filters, familyTargets.totals.kcal);
      choices = {};
      renderMenu();
      renderShopping();
    });
  });

  setupAddPersonForm();
  renderFamilyTargets();
}

function setupAddPersonForm() {
  const form = document.getElementById('add-person-form');
  const btnAdd = document.getElementById('btn-add-person');
  const btnCancel = document.getElementById('btn-cancel-add');
  if (!form || !btnAdd) return;
  btnAdd.addEventListener('click', () => {
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) document.getElementById('np-role').focus();
  });
  btnCancel.addEventListener('click', () => form.classList.add('hidden'));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const role = document.getElementById('np-role').value.trim();
    if (!role) return;
    const person = {
      id: 'p' + Date.now(),
      role,
      sex: document.getElementById('np-sex').value,
      age: parseInt(document.getElementById('np-age').value, 10) || 30,
      weight: parseFloat(document.getElementById('np-weight').value) || 65,
      height: parseFloat(document.getElementById('np-height').value) || 170,
      activityMult: parseFloat(document.getElementById('np-activity').value) || 1.375,
      isChild: document.getElementById('np-child').checked,
    };
    state.family.push(person);
    familyTargets = calcFamilyTargets(state.family);
    saveState();
    form.classList.add('hidden');
    document.getElementById('np-role').value = '';
    renderFamily();
    menu = generateMenu(state.filters, familyTargets.totals.kcal);
    choices = {};
    renderMenu();
    renderShopping();
  });
}

function renderFamilyTargets() {
  state.family.forEach((p) => {
    const t = familyTargets.perPerson[p.id];
    const el = document.querySelector(`[data-target="${p.id}"]`);
    if (el && t) {
      el.innerHTML = `≈ <b>${fmt(t.kcal)}</b> ккал · Б ${fmt(t.protein)} г · Ж ${fmt(t.fat)} г · У ${fmt(t.carb)} г`;
    }
  });
  const tot = familyTargets.totals;
  document.getElementById('family-totals').innerHTML =
    `На семью в день: <b>${fmt(tot.kcal)}</b> ккал · белки <b>${fmt(tot.protein)} г</b> · жиры <b>${fmt(tot.fat)} г</b> · углеводы <b>${fmt(tot.carb)} г</b>`;
}

/* ---------- фильтры ---------- */
function renderFilters() {
  const f = state.filters;
  const dietWrap = document.getElementById('filter-diet');
  dietWrap.innerHTML = DIET_STYLES.map((d) =>
    `<label class="radio"><input type="radio" name="diet" value="${d.id}" ${f.diet === d.id ? 'checked' : ''}> ${d.label}</label>`).join('');

  const kidWrap = document.getElementById('filter-kid');
  kidWrap.innerHTML = `<label class="checkbox"><input type="checkbox" id="kid-only" ${f.kidOnly ? 'checked' : ''}> Только блюда, подходящие ребёнку 2 лет</label>`;

  const cuisineWrap = document.getElementById('filter-cuisine');
  cuisineWrap.innerHTML = `<label class="checkbox"><input type="checkbox" class="cuisine-cb" value="all" ${!f.cuisines.length ? 'checked' : ''}> Любая кухня</label>` +
    CUISINES.map((c) =>
      `<label class="checkbox"><input type="checkbox" class="cuisine-cb" value="${c}" ${f.cuisines.includes(c) ? 'checked' : ''}> ${c}</label>`).join('');

  const alergWrap = document.getElementById('filter-allergens');
  alergWrap.innerHTML = ALLERGENS_LIST.map((a) =>
    `<label class="checkbox"><input type="checkbox" class="alerg-cb" value="${a.id}" ${f.excludeAllergens.includes(a.id) ? 'checked' : ''}> ${a.label}</label>`).join('');

  const storeWrap = document.getElementById('filter-stores');
  storeWrap.innerHTML = STORES.map((s) =>
    `<label class="checkbox" style="--sc:${s.color}"><input type="checkbox" class="store-cb" value="${s.id}" ${f.stores.includes(s.id) ? 'checked' : ''}> ${s.name}</label>`).join('');

  const budgetRange = document.getElementById('budget-range');
  const budgetVal = document.getElementById('budget-value');
  budgetRange.value = f.weeklyBudget;
  budgetVal.textContent = rub(f.weeklyBudget);

  document.querySelectorAll('input[name="diet"]').forEach((el) => el.addEventListener('change', onFilterChange));
  document.getElementById('kid-only').addEventListener('change', onFilterChange);
  document.querySelectorAll('.cuisine-cb').forEach((el) => el.addEventListener('change', (e) => {
    if (e.target.value === 'all' && e.target.checked) {
      document.querySelectorAll('.cuisine-cb:not([value="all"])').forEach((x) => (x.checked = false));
      f.cuisines = [];
    } else {
      document.querySelector('.cuisine-cb[value="all"]').checked = false;
      f.cuisines = [...document.querySelectorAll('.cuisine-cb:checked')].map((x) => x.value).filter((v) => v !== 'all');
    }
    onFilterChange();
  }));
  document.querySelectorAll('.alerg-cb').forEach((el) => el.addEventListener('change', onFilterChange));
  document.querySelectorAll('.store-cb').forEach((el) => el.addEventListener('change', (e) => {
    const v = e.target.value;
    if (e.target.checked) { if (!f.stores.includes(v)) f.stores.push(v); }
    else f.stores = f.stores.filter((x) => x !== v);
    saveState();
    pruneChoices();
    renderShopping();
  }));
  budgetRange.addEventListener('input', () => { budgetVal.textContent = rub(parseInt(budgetRange.value, 10)); });
  budgetRange.addEventListener('change', () => {
    f.weeklyBudget = parseInt(budgetRange.value, 10);
    saveState();
    renderShopping();
  });

  document.getElementById('btn-generate').onclick = () => { menu = generateMenu(state.filters, familyTargets.totals.kcal); renderMenu(); renderShopping(); };

  const presetSel = document.getElementById('preset-select');
  if (presetSel) {
    presetSel.onchange = () => {
      if (!presetSel.value) return;
      applyPreset(presetSel.value);
      presetSel.value = '';
    };
  }
}

/* Быстрые шаблоны рациона на день */
function applyPreset(id) {
  const f = state.filters;
  if (id === 'normal') {
    f.diet = 'any'; f.kidOnly = false; f.excludeAllergens = [];
  } else if (id === 'vegetarian') {
    f.diet = 'vegetarian'; f.kidOnly = false; f.excludeAllergens = [];
  } else if (id === 'vegan') {
    f.diet = 'vegan'; f.kidOnly = false; f.excludeAllergens = [];
  } else if (id === 'kid') {
    f.diet = 'any'; f.kidOnly = true; f.excludeAllergens = [];
  } else if (id === 'gf-lf') {
    f.diet = 'any'; f.kidOnly = false; f.excludeAllergens = ['глютен', 'лактоза'];
  }
  saveState();
  renderFilters();          // перерисовать галочки фильтров под шаблон
  menu = generateMenu(state.filters, familyTargets.totals.kcal);
  choices = {};
  renderMenu();
  renderShopping();
}

function onFilterChange() {
  const f = state.filters;
  f.diet = document.querySelector('input[name="diet"]:checked')?.value || 'any';
  f.kidOnly = document.getElementById('kid-only').checked;
  f.excludeAllergens = [...document.querySelectorAll('.alerg-cb:checked')].map((x) => x.value);
  saveState();
  pruneChoices();
  menu = generateMenu(f, familyTargets.totals.kcal);
  renderMenu();
  renderShopping();
}

/* Убрать из смешанной корзины магазины, которые отключили в фильтре */
function pruneChoices() {
  const f = state.filters;
  for (const pid of Object.keys(choices)) {
    if (!f.stores.includes(choices[pid])) delete choices[pid];
  }
}

/* ---------- меню ---------- */
function renderMenu() {
  if (!menu) { menu = generateMenu(state.filters, familyTargets.totals.kcal); }
  renderMenuSummary();
  const wrap = document.getElementById('menu-slots');
  wrap.innerHTML = '';
  const order = ['breakfast', 'lunch', 'dinner', 'snack1', 'snack2'];
  order.forEach((slotDef) => {
    const s = menu.slots.find((x) => x.slot === slotDef);
    const card = document.createElement('div');
    card.className = 'meal-card';
    if (!s || !s.recipe) {
      card.innerHTML = `
        <div class="meal-head">
          <strong>${SLOT_LABELS[slotDef]}</strong>
          <span class="meal-head-actions">
            <select class="meal-pick-btn" data-pick="${slotDef}" title="Выбрать блюдо для ${SLOT_LABELS[slotDef]} из списка">${mealOptions(slotDef, '')}</select>
            <button class="icon-btn" data-reg="${slotDef}" title="Перегенерировать">⟳</button>
          </span>
        </div>
        <div class="meal-empty">Нет подходящих блюд по фильтрам — выберите вручную</div>`;
      wrap.appendChild(card);
      return;
    }
    const r = s.recipe;
    const tags = [];
    if (r.kid) tags.push('детское');
    if (r.vegetarian) tags.push('без мяса');
    if (r.vegan) tags.push('веган');
    const options = mealOptions(slotDef, r.id);
    card.innerHTML = `
      <div class="meal-head">
        <strong>${SLOT_LABELS[slotDef]}</strong>
        <span class="meal-head-actions">
          <select class="meal-pick-btn" data-pick="${slotDef}" title="Выбрать блюдо для ${SLOT_LABELS[slotDef]} из списка">${options}</select>
          <button class="icon-btn" data-reg="${slotDef}" title="Перегенерировать">⟳</button>
        </span>
      </div>
      <div class="meal-name">${esc(r.name)}</div>
      <div class="meal-meta">${esc(r.cuisine)}${tags.length ? ' · ' + tags.map((t) => `<span class="tag">${t}</span>`).join(' ') : ''}</div>
      <div class="meal-nutrients">
        <span><b>${fmt(s.kcal)}</b> ккал</span>
        <span>Б ${fmt(s.protein)} г</span>
        <span>Ж ${fmt(s.fat)} г</span>
        <span>У ${fmt(s.carb)} г</span>
      </div>
      <div class="meal-scale">порция × ${Math.round(s.scale * 10) / 10}</div>`;
    wrap.appendChild(card);
  });

  wrap.querySelectorAll('[data-reg]').forEach((btn) => {
    btn.addEventListener('click', () => {
      menu = regenerateSlot(menu, btn.dataset.reg, state.filters, familyTargets.totals.kcal);
      renderMenu();
      renderShopping();
    });
  });

  wrap.querySelectorAll('[data-pick]').forEach((sel) => {
    sel.addEventListener('change', () => {
      const v = sel.value;
      sel.value = '';
      if (v) setSlotRecipe(sel.dataset.pick, v);
    });
  });
}

/* Список блюд для выпадающего выбора в слоте (с учётом фильтров) */
function mealOptions(slotDef, currentId) {
  const mealType = slotDef === 'snack1' || slotDef === 'snack2' ? 'snack' : slotDef;
  const list = filterRecipes(state.filters).filter((r) => r.meal === mealType);
  const hasCurrent = list.some((r) => r.id === currentId);
  const cur = getRecipeNutrition(currentId);
  let html = `<option value="">▾ выбрать</option>`;
  if (!hasCurrent && cur) {
    html += `<option value="${cur.id}" selected>${esc(cur.name)} (${fmt(cur.kcal)} ккал)</option>`;
  }
  list.forEach((r) => {
    const selected = r.id === currentId ? 'selected' : '';
    html += `<option value="${r.id}" ${selected}>${esc(r.name)} (${fmt(r.kcal)} ккал${r.kid ? ', детское' : ''})</option>`;
  });
  return html;
}

/* Поставить конкретное блюдо в слот (масштаб под целевую калорийность слота) */
function setSlotRecipe(slotDef, recipeId) {
  const recipe = getRecipeNutrition(recipeId);
  const target = familyTargets.totals.kcal * SLOT_SHARES[slotDef];
  const scale = target / recipe.kcal;
  menu.slots = menu.slots.map((s) =>
    s.slot === slotDef ? {
      slot: slotDef, recipe, scale,
      kcal: Math.round(recipe.kcal * scale),
      protein: Math.round(recipe.protein * scale),
      fat: Math.round(recipe.fat * scale),
      carb: Math.round(recipe.carb * scale),
      balance: 0,
    } : s);
  menu = recomputeMenuTotals(menu, familyTargets.totals.kcal);
  renderMenu();
  renderShopping();
}

function renderMenuSummary() {
  const targetKcal = familyTargets.totals.kcal;
  const t = menu.totals;
  const pctKcal = Math.min(100, Math.round((t.kcal / targetKcal) * 100));
  const bar = (cur, target) => `<div class="bar"><div class="bar-fill" style="width:${Math.min(100, Math.round(cur / target * 100))}%"></div></div>`;
  document.getElementById('menu-nutrition-summary').innerHTML = `
    <div class="summary-grid">
      <div class="sum-item"><div class="sum-num">${fmt(t.kcal)} / ${fmt(targetKcal)} <span class="unit">ккал</span></div>${bar(t.kcal, targetKcal)}<span class="sum-cap">${pctKcal}% от нормы</span></div>
      <div class="sum-item"><div class="sum-num">${fmt(t.protein)} / ${fmt(familyTargets.totals.protein)} <span class="unit">г белка</span></div>${bar(t.protein, familyTargets.totals.protein)}</div>
      <div class="sum-item"><div class="sum-num">${fmt(t.fat)} / ${fmt(familyTargets.totals.fat)} <span class="unit">г жиров</span></div>${bar(t.fat, familyTargets.totals.fat)}</div>
      <div class="sum-item"><div class="sum-num">${fmt(t.carb)} / ${fmt(familyTargets.totals.carb)} <span class="unit">г углеводов</span></div>${bar(t.carb, familyTargets.totals.carb)}</div>
    </div>
    <div class="balance-line">Сбалансированность меню: ${Math.round((1 - menu.balance) * 100)}%</div>`;
}

/* ---------- магазины и цены ---------- */
function renderShopping() {
  if (!menu) return;
  const storeIds = state.filters.stores;
  const shoppingList = buildShoppingList(menu, storeIds);
  const totals = storeTotals(shoppingList, storeIds);
  const best = bestStore(totals, shoppingList);

  // смешанная корзина
  if (!Object.keys(choices).length) { applyChoicesCheapest(shoppingList, totals); }
  const mixed = mixedCart(shoppingList, choices);

  const week = weekEstimate(mixed.cost, state.filters.weeklyBudget);

  // сводка по магазинам
  const sumWrap = document.getElementById('store-summary');
  sumWrap.innerHTML = totals.map((t) => {
    const isCheapest = best.cheapest && best.cheapest.storeId === t.storeId;
    const isBestReview = best.bestRated && best.bestRated.storeId === t.storeId;
    const badges = [];
    if (isCheapest) badges.push('<span class="badge good">дешевле всего</span>');
    if (isBestReview) badges.push('<span class="badge review">лучшие отзывы</span>');
    if (t.missing) badges.push(`<span class="badge warn">нет ${t.missing} поз.</span>`);
    const tStore = STORES.find((s) => s.id === t.storeId);
    return `<div class="store-card">
      <div class="store-name" style="--sc:${t.color}"><a href="${tStore?.url || '#'}" target="_blank" rel="noopener" title="Открыть сайт ${esc(t.name)}">${esc(t.name)}</a> ↗</div>
      <div class="store-cost">${rub(t.cost)}</div>
      <div class="store-sub">★ ${t.avgRating} / 5 · ${t.available} поз.</div>
      <div class="store-badges">${badges.join('')}</div>
    </div>`;
  }).join('');

  // бюджет
  const budgetBox = document.getElementById('budget-box');
  budgetBox.innerHTML = `
    <div class="budget-line">День: <b>${rub(mixed.cost)}</b> · Неделя: <b>${rub(week.weekCost)}</b> из бюджета <b>${rub(state.filters.weeklyBudget)}</b>
      ${week.over ? `<span class="warn-text">⚠ превышает бюджет на ${rub(week.deficit)} — попробуйте самый дешёвый магазин или смягчите блюда</span>` : '<span class="ok-text">✓ укладываетесь в бюджет</span>'}
    </div>`;

  // смешанная корзина
  const cheapRef = best.cheapest ? best.cheapest.cost : totals.reduce((a, b) => a.cost + b.cost, 0);
  const savings = cheapRef > mixed.cost ? cheapRef - mixed.cost : 0;
  document.getElementById('mixed-total').innerHTML = `
    <div class="mixed-line">
      <b>Оптимальная корзина «каждый продукт там, где дешевле»: ${rub(mixed.cost)}</b>
      ${savings ? `<span class="ok-text">экономия ${rub(savings)} по сравнению с лучшим одиночным магазином</span>` : ''}
      ${savings ? '' : `<span class="detail">(лучше одиночного магазина не набралось — возите из одного места)</span>`}
    </div>`;

  // таблица продуктов
  const wrap = document.getElementById('shopping-table');
  let html = `<table class="shop-table"><thead><tr>
    <th>Продукт</th><th>Кол-во</th>`;
  storeIds.forEach((sid) => {
    const st = totals.find((x) => x.storeId === sid);
    const stUrl = STORES.find((s) => s.id === sid)?.url;
    html += `<th style="--sc:${st.color}"><a href="${stUrl || '#'}" target="_blank" rel="noopener" title="Открыть сайт ${esc(st.name)}">${esc(st.name)}</a><span class="th-sub">★${st.avgRating}</span></th>`;
  });
  html += `<th class="col-pick">Выбор</th></tr></thead><tbody>`;

  let currentCat = '';
  shoppingList.forEach((line) => {
    if (line.cat !== currentCat) {
      currentCat = line.cat;
      html += `<tr class="cat-row"><td colspan="${storeIds.length + 3}">${esc(line.cat)}</td></tr>`;
    }
    const prices = line.stores.map((s) => s.cost);
    const minCost = prices.length ? Math.min(...prices) : null;
    html += `<tr data-rop="${line.productId}">
      <td>${esc(line.name)}</td>
      <td class="amount">${line.amountUnit === 'шт' ? fmt(line.amount) + ' шт' : fmt(line.amount) + ' кг'}</td>`;
    storeIds.forEach((sid) => {
      const st = line.stores.find((x) => x.storeId === sid);
      html += st
        ? `<td class="${st.cost === minCost ? 'min-price' : ''}"><a class="price-link" href="${storeSearchUrl(sid, line.name)}" target="_blank" rel="noopener" title="Найти «${esc(line.name)}» на сайте ${line.stores.find((x) => x.storeId === sid)?.storeName}">${rub(st.cost)}</a></td>`
        : `<td class="na">—</td>`;
    });
    const chosen = choices[line.productId] || '';
    html += `<td class="col-pick"><select data-pick="${line.productId}">
        ${line.stores.map((s) => `<option value="${s.storeId}" ${chosen === s.storeId ? 'selected' : ''}>${esc(s.storeName)}</option>`).join('')}
      </select></td></tr>`;
  });
  html += `</tbody></table>`;
  wrap.innerHTML = html;

  // заголовок «всего» по магазинам внизу таблицы (для полноты)
  wrap.querySelectorAll('[data-pick]').forEach((sel) => {
    sel.addEventListener('change', () => {
      choices[sel.dataset.pick] = sel.value;
      renderShopping();
    });
  });

  document.getElementById('btn-choose-cheapest').onclick = () => {
    applyChoicesCheapest(shoppingList, totals);
    renderShopping();
  };
  document.getElementById('btn-copy').onclick = () => copyShoppingList(shoppingList, choices, mixed, week, totals);
  document.getElementById('btn-print').onclick = () => window.print();
}

function applyChoicesCheapest(shoppingList, totals) {
  choices = {};
  shoppingList.forEach((line) => {
    if (!line.stores.length) return;
    const min = line.stores.reduce((a, b) => (b.cost < a.cost ? b : a));
    choices[line.productId] = min.storeId;
  });
}

function copyShoppingList(shoppingList, choices, mixed, week, totals) {
  const lines = [];
  lines.push('Список покупок на день · ' + new Date().toLocaleDateString('ru-RU'));
  lines.push('Оптимальная корзина: ' + rub(mixed.cost) + ' (неделя ~ ' + rub(week.weekCost) + ')');
  lines.push('');
  let cat = '';
  shoppingList.forEach((line) => {
    if (line.cat !== cat) { cat = line.cat; lines.push('— ' + cat + ' —'); }
    const st = line.stores.find((x) => x.storeId === choices[line.productId]);
    const amount = line.amountUnit === 'шт' ? fmt(line.amount) + ' шт' : fmt(line.amount) + ' кг';
    lines.push(`${line.name}: ${amount} · ${st ? st.storeName + ' ' + rub(st.cost) : 'нет в выбранных магазинах'}`);
  });
  lines.push('');
  totals.forEach((t) => lines.push(`${t.name}: ${rub(t.cost)} (★${t.avgRating})`));
  copyText(lines.join('\n'));
}

function copyText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
}

/* ---------- init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  renderFamily();
  renderFilters();
  renderMenu();
  renderShopping();
});