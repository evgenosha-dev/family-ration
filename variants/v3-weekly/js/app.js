/* ============================================================
   UI НЕДЕЛЬНОГО ПЛАНИРОВЩИКА (вариант v3)
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

const LS_KEY = 'semeinyi-racion-weekly-v1';
let state = loadState() || deepClone(DEFAULT_STATE);
let week = null;
let currentDay = 0;
let choices = {};
let familyTargets = calcFamilyTargets(state.family);

const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

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

/* ---------- семья ---------- */
function renderFamily() {
  const wrap = document.getElementById('family-cards');
  wrap.innerHTML = '';
  state.family.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'person-card';
    card.innerHTML = `
      <div class="person-head"><strong>${esc(p.role)}</strong>${p.isChild ? '<span class="badge kid">ребёнок</span>' : ''}</div>
      <label>Пол<select data-field="sex" ${p.isChild ? 'disabled' : ''}>
        <option value="f" ${p.sex === 'f' ? 'selected' : ''}>Женский</option>
        <option value="m" ${p.sex === 'm' ? 'selected' : ''}>Мужской</option>
      </select></label>
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
    card.querySelectorAll('[data-field]').forEach((el) => {
      el.addEventListener('change', () => {
        const field = el.dataset.field;
        if (field === 'age' || field === 'weight' || field === 'height') p[field] = parseFloat(el.value) || 0;
        else if (field === 'activityMult') p[field] = parseFloat(el.value);
        else p[field] = el.value;
        familyTargets = calcFamilyTargets(state.family);
        saveState();
        renderFamilyTargets();
        week = generateWeek(7, state.filters, familyTargets.totals.kcal);
        choices = {};
        renderWeek();
      });
    });
    wrap.appendChild(card);
  });
  renderFamilyTargets();
}

function renderFamilyTargets() {
  state.family.forEach((p) => {
    const t = familyTargets.perPerson[p.id];
    const el = document.querySelector(`[data-target="${p.id}"]`);
    if (el && t) el.innerHTML = `≈ <b>${fmt(t.kcal)}</b> ккал · Б ${fmt(t.protein)} г · Ж ${fmt(t.fat)} г · У ${fmt(t.carb)} г`;
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
    CUISINES.map((c) => `<label class="checkbox"><input type="checkbox" class="cuisine-cb" value="${c}" ${f.cuisines.includes(c) ? 'checked' : ''}> ${c}</label>`).join('');

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

  document.getElementById('btn-generate').addEventListener('click', () => {
    week = generateWeek(7, state.filters, familyTargets.totals.kcal);
    choices = {};
    currentDay = 0;
    renderWeek();
    renderShopping();
  });
}

function onFilterChange() {
  const f = state.filters;
  f.diet = document.querySelector('input[name="diet"]:checked')?.value || 'any';
  f.kidOnly = document.getElementById('kid-only').checked;
  f.excludeAllergens = [...document.querySelectorAll('.alerg-cb:checked')].map((x) => x.value);
  saveState();
  pruneChoices();
  week = generateWeek(7, f, familyTargets.totals.kcal);
  choices = {};
  renderWeek();
  renderShopping();
}

function pruneChoices() {
  for (const pid of Object.keys(choices)) {
    if (!state.filters.stores.includes(choices[pid])) delete choices[pid];
  }
}

/* ---------- неделя ---------- */
function renderWeek() {
  if (!week) { week = generateWeek(7, state.filters, familyTargets.totals.kcal); }
  const tgt = familyTargets.totals;
  const fill = Math.min(100, Math.round((week.avg.kcal / tgt.kcal) * 100));
  const b2 = (cur, target) => `<div class="bar"><div class="bar-fill" style="width:${Math.min(100, Math.round(cur / target * 100))}%"></div></div>`;

  document.getElementById('week-summary').innerHTML = `
    <div class="summary-grid">
      <div class="sum-item"><div class="sum-num">${fmt(week.avg.kcal)} / ${fmt(tgt.kcal)} <span class="unit">ккал в день</span></div>${b2(week.avg.kcal, tgt.kcal)}<span class="sum-cap">${fill}% от нормы</span></div>
      <div class="sum-item"><div class="sum-num">${fmt(week.totals.kcal)} <span class="unit">ккал за неделю</span></div></div>
      <div class="sum-item"><div class="sum-num">${week.uniqueRecipes} / ${week.totalSlots} <span class="unit">уникальных блюд</span></div></div>
      <div class="sum-item"><div class="sum-num">${fmt(week.avg.protein)} / ${fmt(tgt.protein)} <span class="unit">г белка в день</span></div>${b2(week.avg.protein, tgt.protein)}</div>
    </div>`;

  const dayTabs = document.getElementById('day-tabs');
  dayTabs.innerHTML = week.days.map((d, i) => `
    <button class="day-btn ${i === currentDay ? 'active' : ''}" data-day="${i}">${WEEKDAY_SHORT[i]}<span class="day-sub">${fmt(d.totals.kcal)}</span></button>`).join('');
  dayTabs.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => {
    currentDay = parseInt(b.dataset.day, 10);
    renderWeekDay();
  }));

  renderWeekDay();
}

function renderWeekDay() {
  const day = week.days[currentDay];
  const wrap = document.getElementById('day-slots');
  wrap.innerHTML = `<h3 class="day-title">${WEEKDAY_NAMES[currentDay]} · Блюда дня</h3>`;
  const grid = document.createElement('div');
  grid.className = 'menu-grid';
  wrap.appendChild(grid);

  const order = ['breakfast', 'lunch', 'dinner', 'snack1', 'snack2'];
  order.forEach((slotDef) => {
    const s = day.slots.find((x) => x.slot === slotDef);
    const card = document.createElement('div');
    card.className = 'meal-card';
    if (!s || !s.recipe) {
      card.innerHTML = `<div class="meal-head"><strong>${SLOT_LABELS[slotDef]}</strong></div><div class="meal-empty">Нет подходящих блюд — смягчите фильтры</div>`;
      grid.appendChild(card);
      return;
    }
    const r = s.recipe;
    const tags = [];
    if (r.kid) tags.push('детское');
    if (r.vegetarian) tags.push('без мяса');
    if (r.vegan) tags.push('веган');
    card.innerHTML = `
      <div class="meal-head"><strong>${SLOT_LABELS[slotDef]}</strong>
        <button class="icon-btn" data-reg="${slotDef}" title="Перегенерировать">⟳</button></div>
      <div class="meal-name">${esc(r.name)}</div>
      <div class="meal-meta">${esc(r.cuisine)}${tags.length ? ' · ' + tags.map((t) => `<span class="tag">${t}</span>`).join(' ') : ''}</div>
      <div class="meal-nutrients">
        <span><b>${fmt(s.kcal)}</b> ккал</span><span>Б ${fmt(s.protein)} г</span><span>Ж ${fmt(s.fat)} г</span><span>У ${fmt(s.carb)} г</span>
      </div>
      <div class="meal-scale">порция × ${Math.round(s.scale * 10) / 10}</div>`;
    grid.appendChild(card);
  });

  grid.querySelectorAll('[data-reg]').forEach((btn) => {
    btn.addEventListener('click', () => {
      week = regenerateWeekSlot(week, currentDay, btn.dataset.reg, state.filters, familyTargets.totals.kcal);
      renderWeek();
      renderShopping();
    });
  });
}

/* ---------- магазины ---------- */
function renderShopping() {
  if (!week) return;
  const storeIds = state.filters.stores;
  const shopping = buildWeeklyShoppingList(week, storeIds);
  const totals = storeTotals(shopping, storeIds);
  const best = bestStore(totals, shopping);

  if (!Object.keys(choices).length) {
    shopping.forEach((l) => { if (l.stores.length) choices[l.productId] = l.stores.reduce((a, b) => (b.cost < a.cost ? b : a)).storeId; });
  }
  const mixed = mixedCart(shopping, choices);
  const budget = state.filters.weeklyBudget;
  const over = mixed.cost > budget;

  document.getElementById('store-summary').innerHTML = totals.map((t) => {
    const badges = [];
    if (best.cheapest && best.cheapest.storeId === t.storeId) badges.push('<span class="badge good">дешевле всего</span>');
    if (best.bestRated && best.bestRated.storeId === t.storeId) badges.push('<span class="badge review">лучшие отзывы</span>');
    if (t.missing) badges.push(`<span class="badge warn">нет ${t.missing} поз.</span>`);
    return `<div class="store-card">
      <div class="store-name" style="--sc:${t.color}">${esc(t.name)}</div>
      <div class="store-cost">${rub(t.cost)}</div>
      <div class="store-sub">★ ${t.avgRating} / 5 · ${t.available} поз.</div>
      <div class="store-badges">${badges.join('')}</div>
    </div>`;
  }).join('');

  document.getElementById('budget-box').innerHTML = `
    <div class="budget-line">Корзина на неделю: <b>${rub(mixed.cost)}</b> из бюджета <b>${rub(budget)}</b>
      ${over ? `<span class="warn-text">⚠ перерасход ${rub(mixed.cost - budget)} — выберите самый дешёвый магазин или смягчите блюда</span>` : `<span class="ok-text">✓ укладываетесь в недельный бюджет</span>`}
    </div>`;

  const cheapRef = best.cheapest ? best.cheapest.cost : 0;
  const savings = cheapRef > mixed.cost ? cheapRef - mixed.cost : 0;
  document.getElementById('mixed-total').innerHTML = `
    <div class="mixed-line"><b>Оптимальная корзина на неделю: ${rub(mixed.cost)}</b>
      ${savings ? `<span class="ok-text">экономия ${rub(savings)} против лучшего одиночного магазина</span>` : `<span class="detail">(лучше одиночного магазина не набралось)</span>`}
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
    const lines = [];
    lines.push('Список покупок на неделю · ' + new Date().toLocaleDateString('ru-RU'));
    lines.push('Оптимальная корзина: ' + rub(mixed.cost) + ' · бюджет ' + rub(budget));
    lines.push('');
    let c = '';
    shopping.forEach((l) => {
      if (l.cat !== c) { c = l.cat; lines.push('— ' + c + ' —'); }
      const st = l.stores.find((x) => x.storeId === choices[l.productId]);
      lines.push(`${l.name}: ${l.amountUnit === 'шт' ? fmt(l.amount) + ' шт' : fmt(l.amount) + ' кг'} · ${st ? st.storeName + ' ' + rub(st.cost) : 'нет в наличии'}`);
    });
    lines.push('');
    totals.forEach((t) => lines.push(`${t.name}: ${rub(t.cost)} (★${t.avgRating})`));
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
  renderWeek();
  renderShopping();
});