/* ============================================================
   UI КОНСТРУКТОРА МЕНЮ (вариант v4)
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
    stores: ['pyat', 'magnit', 'vv', 'lenta', 'ozon', 'lavka'],
  },
};

const LS_KEY = 'semeinyi-racion-constructor-v1';
let state = loadState() || deepClone(DEFAULT_STATE);
let selection = {};          // slot -> recipeId
let currentSlot = 'breakfast';
let choices = {};
let familyTargets = calcFamilyTargets(state.family);

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return { ...deepClone(DEFAULT_STATE), ...s, family: s.family || deepClone(DEFAULT_STATE.family), filters: { ...DEFAULT_STATE.filters, ...(s.filters || {}) } };
  } catch (e) { return null; }
}
function saveState() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {} }
const fmt = (n) => Math.round(n).toLocaleString('ru-RU');
const rub = (n) => fmt(n) + ' ₽';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

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

/* ---------- семья (компактно, раскрывается в details) ---------- */
function renderFamily() {
  const wrap = document.getElementById('family-cards');
  wrap.innerHTML = '';
  state.family.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'person-card';
    card.innerHTML = `
      <div class="person-head"><strong>${esc(p.role)}</strong>${p.isChild ? '<span class="badge kid">ребёнок</span>' : ''}</div>
      <div class="grid2">
        <label>Возраст<input type="number" data-field="age" min="1" max="99" value="${p.age}"></label>
        <label>Вес, кг<input type="number" data-field="weight" min="1" max="250" step="0.5" value="${p.weight}"></label>
      </div>
      <div class="grid2">
        <label>Рост, см<input type="number" data-field="height" min="50" max="230" value="${p.height}"></label>
        <label>Активность<select data-field="activityMult">
          ${Object.entries(ACTIVITY_PRESETS).map(([k, v]) => `<option value="${v.mult}" ${Number(p.activityMult) === v.mult ? 'selected' : ''}>${v.label}</option>`).join('')}
        </select></label>
      </div>
      <div class="person-target" data-target="${p.id}"></div>`;
    card.querySelectorAll('[data-field]').forEach((el) => el.addEventListener('change', () => {
      const field = el.dataset.field;
      if (field === 'age' || field === 'weight' || field === 'height') p[field] = parseFloat(el.value) || 0;
      else if (field === 'activityMult') p[field] = parseFloat(el.value);
      else p[field] = el.value;
      familyTargets = calcFamilyTargets(state.family);
      saveState();
      renderFamilyTargets();
      renderBuilder();
      renderShopping();
    }));
    wrap.appendChild(card);
  });
  renderFamilyTargets();
}

function renderFamilyTargets() {
  state.family.forEach((p) => {
    const t = familyTargets.perPerson[p.id];
    const el = document.querySelector(`[data-target="${p.id}"]`);
    if (el && t) el.innerHTML = `≈ <b>${fmt(t.kcal)}</b> ккал`;
  });
  const tot = familyTargets.totals;
  document.getElementById('family-totals').innerHTML =
    `На семью в день: <b>${fmt(tot.kcal)}</b> ккал · Б <b>${fmt(tot.protein)} г</b> · Ж <b>${fmt(tot.fat)} г</b> · У <b>${fmt(tot.carb)} г</b>`;
}

/* ---------- фильтры каталога ---------- */
function renderFilters() {
  const f = state.filters;
  document.getElementById('filter-diet').innerHTML = DIET_STYLES.map((d) =>
    `<label class="radio"><input type="radio" name="diet" value="${d.id}" ${f.diet === d.id ? 'checked' : ''}> ${d.label}</label>`).join('');
  document.getElementById('filter-kid').innerHTML =
    `<label class="checkbox"><input type="checkbox" id="kid-only" ${f.kidOnly ? 'checked' : ''}> Только детские (2 года)</label>`;
  document.getElementById('filter-cuisine').innerHTML =
    CUISINES.map((c) => `<label class="checkbox"><input type="checkbox" class="cuisine-cb" value="${c}" ${f.cuisines.includes(c) ? 'checked' : ''}> ${c}</label>`).join('');
  document.getElementById('filter-allergens').innerHTML = ALLERGENS_LIST.map((a) =>
    `<label class="checkbox"><input type="checkbox" class="alerg-cb" value="${a.id}" ${f.excludeAllergens.includes(a.id) ? 'checked' : ''}> ${a.label}</label>`).join('');
  document.getElementById('filter-stores').innerHTML = STORES.map((s) =>
    `<label class="checkbox" style="--sc:${s.color}"><input type="checkbox" class="store-cb" value="${s.id}" ${f.stores.includes(s.id) ? 'checked' : ''}> ${s.name}</label>`).join('');

  document.querySelectorAll('input[name="diet"]').forEach((el) => el.addEventListener('change', onFilterChange));
  document.getElementById('kid-only').addEventListener('change', onFilterChange);
  document.querySelectorAll('.cuisine-cb').forEach((el) => el.addEventListener('change', onFilterChange));
  document.querySelectorAll('.alerg-cb').forEach((el) => el.addEventListener('change', onFilterChange));
  document.querySelectorAll('.store-cb').forEach((el) => el.addEventListener('change', (e) => {
    const v = e.target.value;
    if (e.target.checked) { if (!f.stores.includes(v)) f.stores.push(v); }
    else f.stores = f.stores.filter((x) => x !== v);
    saveState();
    pruneChoices();
    renderShopping();
  }));
}

function onFilterChange() {
  const f = state.filters;
  const diet = document.querySelector('input[name="diet"]:checked');
  if (diet) f.diet = diet.value;
  document.getElementById('kid-only');
  f.kidOnly = document.getElementById('kid-only').checked;
  const cuisines = [...document.querySelectorAll('.cuisine-cb:checked')].map((x) => x.value);
  f.cuisines = cuisines;
  f.excludeAllergens = [...document.querySelectorAll('.alerg-cb:checked')].map((x) => x.value);
  saveState();
  renderCatalog();
  renderBuilder();
  renderShopping();
}

function pruneChoices() {
  for (const pid of Object.keys(choices)) {
    if (!state.filters.stores.includes(choices[pid])) delete choices[pid];
  }
}

/* ---------- конструктор ---------- */
function renderSlotTabs() {
  const wrap = document.getElementById('slot-tabs');
  wrap.innerHTML = '';
  SLOT_DEFS.forEach((def) => {
    const btn = document.createElement('button');
    btn.className = 'slot-btn ' + (currentSlot === def ? 'active' : '');
    const r = selection[def] ? getRecipeNutrition(selection[def]) : null;
    btn.innerHTML = `${SLOT_LABELS[def]}<span class="slot-sub">${r ? esc(r.name) : '— пусто —'}</span>`;
    btn.addEventListener('click', () => { currentSlot = def; renderSlotTabs(); renderCatalog(); });
    wrap.appendChild(btn);
  });
}

function renderBuilder() {
  renderSlotTabs();
  const day = buildDayFromSelection(selection, familyTargets.totals.kcal);
  const tgt = familyTargets.totals;
  const bar = (cur, target) => `<div class="bar"><div class="bar-fill" style="width:${Math.min(100, Math.round(cur / target * 100))}%"></div></div>`;
  const pct = tgt.kcal ? Math.round((day.totals.kcal / tgt.kcal) * 100) : 0;
  document.getElementById('day-totals').innerHTML = `
    <div class="summary-grid">
      <div class="sum-item"><div class="sum-num">${fmt(day.totals.kcal)} / ${fmt(tgt.kcal)} <span class="unit">ккал</span></div>${bar(day.totals.kcal, tgt.kcal)}
        <span class="sum-cap">${pct}% нормы ${pct > 105 ? '· <span class="warn-text">многовато</span>' : pct < 85 ? '· <span class="warn-text">маловато</span>' : '· <span class="ok-text">в норме</span>'}</span></div>
      <div class="sum-item"><div class="sum-num">${fmt(day.totals.protein)} / ${fmt(tgt.protein)} <span class="unit">г белка</span></div>${bar(day.totals.protein, tgt.protein)}</div>
      <div class="sum-item"><div class="sum-num">${fmt(day.totals.fat)} / ${fmt(tgt.fat)} <span class="unit">г жиров</span></div>${bar(day.totals.fat, tgt.fat)}</div>
      <div class="sum-item"><div class="sum-num">${fmt(day.totals.carb)} / ${fmt(tgt.carb)} <span class="unit">г углеводов</span></div>${bar(day.totals.carb, tgt.carb)}</div>
    </div>
    <p class="hint">Сейчас выбирается слот: <b>${SLOT_LABELS[currentSlot]}</b>. Нажимайте «+» на блюде, чтобы поставить его в этот слот. Каждое блюдо масштабируется под целевые калории слота.</p>`;

  document.getElementById('btn-fill-random').onclick = () => {
    selection = fillEmptySlots(selection, state.filters, familyTargets.totals.kcal);
    saveState();
    renderBuilder();
    renderShopping();
  };
  document.getElementById('btn-clear').onclick = () => {
    selection = {};
    saveState();
    renderBuilder();
    renderShopping();
  };

  renderCatalog();
  renderShopping();
}

function renderCatalog() {
  const wrap = document.getElementById('recipe-catalog');
  wrap.innerHTML = '';
  const list = filterRecipes(state.filters);
  const order = ['breakfast', 'lunch', 'dinner', 'snack'];
  order.forEach((meal) => {
    const recipes = list.filter((r) => r.meal === meal);
    if (!recipes.length) return;
    const section = document.createElement('div');
    section.className = 'catalog-section';
    const head = document.createElement('h3');
    head.textContent = SLOT_LABELS[meal];
    section.appendChild(head);
    const grid = document.createElement('div');
    grid.className = 'catalog-grid';
    recipes.forEach((r) => {
      const slotForMeal = meal === 'snack' ? (currentSlot.startsWith('snack') ? currentSlot : 'snack1') : meal;
      const isCurrent = slotForMeal === currentSlot;
      const card = document.createElement('div');
      card.className = 'recipe-card' + (isCurrent ? ' highlighted' : '');
      const tags = [];
      if (r.kid) tags.push('детское');
      if (r.vegan) tags.push('веган');
      else if (r.vegetarian) tags.push('без мяса');
      card.innerHTML = `
        <div class="recipe-card-head">
          <span class="recipe-card-name">${esc(r.name)}</span>
          <button class="add-btn" data-add="${r.id}" title="Поставить в слот ${SLOT_LABELS[slotForMeal]}">+</button>
        </div>
        <div class="meal-meta">${esc(r.cuisine)}${tags.length ? ' · ' + tags.map((t) => `<span class="tag">${t}</span>`).join(' ') : ''}</div>
        <div class="recipe-card-nut">${fmt(r.kcal)} ккал · Б${r.protein} · Ж${r.fat} · У${r.carb}</div>`;
      section.appendChild(card);
    });
    wrap.appendChild(section);
  });
  wrap.querySelectorAll('[data-add]').forEach((btn) => btn.addEventListener('click', () => {
    const rid = btn.dataset.add;
    const r = getRecipeNutrition(rid);
    const slotForMeal = r.meal === 'snack' ? (currentSlot.startsWith('snack') ? currentSlot : 'snack1') : r.meal;
    selection[slotForMeal] = rid;
    saveState();
    renderBuilder();
  }));
}

/* ---------- магазины ---------- */
function renderShopping() {
  const day = buildDayFromSelection(selection, familyTargets.totals.kcal);
  const storeIds = state.filters.stores;
  const shopping = buildShoppingList(day, storeIds);
  const totals = storeTotals(shopping, storeIds);
  const best = bestStore(totals, shopping);
  if (!Object.keys(choices).length) {
    shopping.forEach((l) => { if (l.stores.length) choices[l.productId] = l.stores.reduce((a, b) => (b.cost < a.cost ? b : a)).storeId; });
  }
  const mixed = mixedCart(shopping, choices);

  document.getElementById('store-summary').innerHTML = totals.map((t) => {
    const badges = [];
    if (best.cheapest && best.cheapest.storeId === t.storeId) badges.push('<span class="badge good">дешевле всего</span>');
    if (best.bestRated && best.bestRated.storeId === t.storeId) badges.push('<span class="badge review">лучшие отзывы</span>');
    if (t.missing) badges.push(`<span class="badge warn">нет ${t.missing} поз.</span>`);
    return `<div class="store-card"><div class="store-name" style="--sc:${t.color}">${esc(t.name)}</div>
      <div class="store-cost">${rub(t.cost)}</div><div class="store-sub">★ ${t.avgRating} · ${t.available} поз.</div>
      <div class="store-badges">${badges.join('')}</div></div>`;
  }).join('');

  const cheapRef = best.cheapest ? best.cheapest.cost : 0;
  const savings = cheapRef > mixed.cost ? cheapRef - mixed.cost : 0;
  document.getElementById('mixed-total').innerHTML = `
    <div class="mixed-line"><b>Оптимальная корзина: ${rub(mixed.cost)}</b>
      ${savings ? `<span class="ok-text">экономия ${rub(savings)} против лучшего одиночного магазина</span>` : ''}
    </div>`;

  const wrap = document.getElementById('shopping-table');
  let html = `<table class="shop-table"><thead><tr><th>Продукт</th><th>Кол-во</th>`;
  storeIds.forEach((sid) => {
    const st = totals.find((x) => x.storeId === sid);
    html += `<th style="--sc:${st.color}">${esc(st.name)}<span class="th-sub">★${st.avgRating}</span></th>`;
  });
  html += `<th class="col-pick">Выбор</th></tr></thead><tbody>`;
  let cat = '';
  shopping.forEach((line) => {
    if (line.cat !== cat) { cat = line.cat; html += `<tr class="cat-row"><td colspan="${storeIds.length + 3}">${esc(line.cat)}</td></tr>`; }
    const prices = line.stores.map((s) => s.cost);
    const min = prices.length ? Math.min(...prices) : null;
    html += `<tr><td>${esc(line.name)}</td><td class="amount">${line.amountUnit === 'шт' ? fmt(line.amount) + ' шт' : fmt(line.amount) + ' кг'}</td>`;
    storeIds.forEach((sid) => {
      const st = line.stores.find((x) => x.storeId === sid);
      html += st ? `<td class="${st.cost === min ? 'min-price' : ''}">${rub(st.cost)}</td>` : `<td class="na">—</td>`;
    });
    const chosen = choices[line.productId] || '';
    html += `<td class="col-pick"><select data-pick="${line.productId}">
      ${line.stores.map((s) => `<option value="${s.storeId}" ${chosen === s.storeId ? 'selected' : ''}>${esc(s.storeName)}</option>`).join('')}
    </select></td></tr>`;
  });
  html += `</tbody></table>`;
  wrap.innerHTML = html;
  wrap.querySelectorAll('[data-pick]').forEach((sel) => sel.addEventListener('change', () => {
    choices[sel.dataset.pick] = sel.value;
    renderShopping();
  }));

  document.getElementById('btn-copy').onclick = () => {
    const lines = ['Собранное меню на день · ' + new Date().toLocaleDateString('ru-RU'), ''];
    day.slots.forEach((s) => {
      if (!s.recipe) return;
      lines.push(`${SLOT_LABELS[s.slot]}: ${s.recipe.name} (${fmt(s.kcal)} ккал)`);
    });
    lines.push('');
    cat = '';
    shopping.forEach((l) => {
      if (l.cat !== cat) { cat = l.cat; lines.push('— ' + cat + ' —'); }
      const st = l.stores.find((x) => x.storeId === choices[l.productId]);
      lines.push(`${l.name}: ${l.amountUnit === 'шт' ? fmt(l.amount) + ' шт' : fmt(l.amount) + ' кг'} · ${st ? st.storeName + ' ' + rub(st.cost) : 'нет в наличии'}`);
    });
    lines.push('', 'Оптимальная корзина: ' + rub(mixed.cost));
    copyText(lines.join('\n'));
  };
  document.getElementById('btn-print').onclick = () => window.print();
}

function copyText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
}

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  renderFamily();
  renderFilters();
  renderBuilder();
});