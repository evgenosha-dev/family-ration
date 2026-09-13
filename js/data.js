/* ============================================================
   БАЗА ДАННЫХ
   Магазины, продукты, рецепты
   Цены и отзывы — ориентировочные, легко редактируются.
   ============================================================ */

const STORES = [
  { id: 'pyat',   name: 'Пятёрочка',     color: '#e63329', rating: 3.9, url: 'https://perekrestok.ru/vprok',
    search: 'https://perekrestok.ru/vprok/catalog/search?text={q}' },
  { id: 'magnit', name: 'Магнит',        color: '#dc1f26', rating: 3.7, url: 'https://www.magnit.ru/',
    search: 'https://www.magnit.ru/catalog/?q={q}' },
  { id: 'vv',     name: 'ВкусВилл',      color: '#00a650', rating: 4.7, url: 'https://vkusvill.ru/',
    search: 'https://vkusvill.ru/goods/?q={q}' },
  { id: 'lenta',  name: 'Лента',         color: '#005ca9', rating: 4.1, url: 'https://lenta.com/',
    search: 'https://lenta.com/search?query={q}' },
  { id: 'ozon',   name: 'Ozon',          color: '#3b82f6', rating: 4.3, url: 'https://www.ozon.ru/',
    search: 'https://www.ozon.ru/search/?text={q}' },
  { id: 'lavka',  name: 'Яндекс Лавка',  color: '#fc3f1d', rating: 4.5, url: 'https://lavka.yandex.ru/',
    search: 'https://lavka.yandex.ru/?text={q}' },
];

/* Ссылка на товар в конкретном магазине (поиск по названию продукта).
   Шаблоны поиска правятся выше в STORES — под свой регион/доставку. */
function storeSearchUrl(storeId, productName) {
  const store = STORES.find((s) => s.id === storeId);
  if (!store) return '#';
  const tpl = store.search || store.url;
  return tpl.replace('{q}', encodeURIComponent(productName));
}

/* Множитель цены по магазину для «обычных» продуктов.
   Отдельные продукты могут иметь свою цену в поле multOverride. */
const DEFAULT_PRICE_MULT = {
  pyat: 0.97, magnit: 0.98, vv: 1.25, lenta: 1.0, ozon: 0.95, lavka: 1.35,
};

const CATEGORIES = [
  'Овощи и фрукты',
  'Мясо и рыба',
  'Молочные продукты',
  'Крупы и бакалея',
  'Орехи и перекусы',
];

/* Ценовые профили магазинов по категориям:
   у каждой сети свои «сильные» категории, поэтому выгоднее покупать
   разные продукты в разных магазинах (смешанная корзина). */
const CATEGORY_PRICE_MULT = {
  'Овощи и фрукты':    { pyat: 0.87, magnit: 0.92, vv: 1.18, lenta: 1.0,  ozon: 1.08, lavka: 1.42 },
  'Мясо и рыба':       { pyat: 0.90, magnit: 0.95, vv: 1.32, lenta: 0.90, ozon: 1.02, lavka: 1.38 },
  'Молочные продукты': { pyat: 0.96, magnit: 0.90, vv: 1.08, lenta: 0.98, ozon: 1.06, lavka: 1.30 },
  'Крупы и бакалея':   { pyat: 0.98, magnit: 1.00, vv: 1.30, lenta: 1.00, ozon: 0.86, lavka: 1.25 },
  'Орехи и перекусы':  { pyat: 1.00, magnit: 1.05, vv: 1.25, lenta: 1.05, ozon: 0.88, lavka: 1.30 },
};

/* Продукты.
   id   – короткий идентификатор
   name – название
   cat  – категория
   unit – 'кг' или 'шт'
   base – базовая цена за кг (или за штуку)
   p/f/c/kcal – БЖУ на 100 г
   veg  – подходит вегетарианцам (без мяса/рыбы)
   vegan– подходит веганам
   alerg– аллергены
   notAt– магазины, где продукта нет (null если есть везде)
   mult – индивидуальная цена по магазинам (опционально)
   rate – индивидуальная оценка отзывов по магазинам (опционально)
*/
const PRODUCTS = [
  // ---------- Овощи и фрукты ----------
  { id:'potato', name:'Картофель', cat:'Овощи и фрукты', unit:'кг', base:45,  p:1.9,  f:0.1,  c:17,    kcal:77, veg:true, vegan:true },
  { id:'carrot', name:'Морковь',   cat:'Овощи и фрукты', unit:'кг', base:38,  p:0.9,  f:0.2,  c:9.6,   kcal:41, veg:true, vegan:true },
  { id:'onion',  name:'Лук репчатый', cat:'Овощи и фрукты', unit:'кг', base:32, p:1.1, f:0.2, c:8.5,  kcal:40, veg:true, vegan:true },
  { id:'tomato', name:'Помидоры',  cat:'Овощи и фрукты', unit:'кг', base:120, p:0.9, f:0.2, c:4.0,   kcal:20, veg:true, vegan:true },
  { id:'cucum',  name:'Огурцы',    cat:'Овощи и фрукты', unit:'кг', base:95,  p:0.8, f:0.1, c:2.8,   kcal:15, veg:true, vegan:true },
  { id:'cabbage',name:'Капуста белокочанная', cat:'Овощи и фрукты', unit:'кг', base:30, p:1.8, f:0.1, c:5.4, kcal:27, veg:true, vegan:true },
  { id:'broccoli',name:'Брокколи', cat:'Овощи и фрукты', unit:'кг', base:180, p:2.8, f:0.4, c:6.6,  kcal:34, veg:true, vegan:true, mult:{pyat:null,magnit:null} },
  { id:'beet',   name:'Свёкла',    cat:'Овощи и фрукты', unit:'кг', base:42,  p:1.6, f:0.2, c:9.6,   kcal:43, veg:true, vegan:true },
  { id:'pepper', name:'Болгарский перец', cat:'Овощи и фрукты', unit:'кг', base:140, p:1.0, f:0.3, c:6.3, kcal:26, veg:true, vegan:true },
  { id:'zucchini',name:'Кабачок',  cat:'Овощи и фрукты', unit:'кг', base:70,  p:0.6, f:0.3, c:5.7,   kcal:24, veg:true, vegan:true },
  { id:'eggplant',name:'Баклажан', cat:'Овощи и фрукты', unit:'кг', base:110, p:1.0, f:0.1, c:4.5,   kcal:24, veg:true, vegan:true },
  { id:'pumpkin',name:'Тыква',     cat:'Овощи и фрукты', unit:'кг', base:60,  p:1.0, f:0.1, c:4.4,   kcal:22, veg:true, vegan:true },
  { id:'garlic', name:'Чеснок',    cat:'Овощи и фрукты', unit:'кг', base:160, p:6.4, f:0.5, c:33.1,  kcal:149, veg:true, vegan:true },
  { id:'greens', name:'Зелень (укроп/петрушка)', cat:'Овощи и фрукты', unit:'кг', base:250, p:3.0, f:0.6, c:7.0, kcal:36, veg:true, vegan:true },
  { id:'apple',  name:'Яблоки',    cat:'Овощи и фрукты', unit:'кг', base:85,  p:0.3, f:0.2, c:11.8,  kcal:52, veg:true, vegan:true },
  { id:'banana', name:'Бананы',    cat:'Овощи и фрукты', unit:'кг', base:90,  p:1.1, f:0.3, c:22.8,  kcal:89, veg:true, vegan:true },
  { id:'orange', name:'Апельсины', cat:'Овощи и фрукты', unit:'кг', base:100, p:0.9, f:0.1, c:11.8,  kcal:47, veg:true, vegan:true },
  { id:'pear',   name:'Груши',     cat:'Овощи и фрукты', unit:'кг', base:110, p:0.3, f:0.2, c:12.7,  kcal:52, veg:true, vegan:true },
  { id:'spinach',name:'Шпинат/листовой салат', cat:'Овощи и фрукты', unit:'кг', base:300, p:2.9, f:0.4, c:3.6, kcal:23, veg:true, vegan:true, mult:{pyat:null,magnit:null,ozon:null} },
  { id:'avocado',name:'Авокадо',   cat:'Овощи и фрукты', unit:'кг', base:320, p:2.0, f:15.0, c:9.0,  kcal:160, veg:true, vegan:true, notAt:['pyat','magnit'] },

  // ---------- Мясо и рыба ----------
  { id:'chicken',name:'Куриное филе', cat:'Мясо и рыба', unit:'кг', base:280, p:23, f:1.2, c:0,   kcal:110, notAt:[] },
  { id:'thighs', name:'Куриные бёдра', cat:'Мясо и рыба', unit:'кг', base:220, p:18, f:13, c:0,   kcal:190, notAt:[] },
  { id:'mince',  name:'Говяжий фарш', cat:'Мясо и рыба', unit:'кг', base:420, p:18, f:20, c:0,   kcal:254, notAt:[] },
  { id:'beef',   name:'Говядина',   cat:'Мясо и рыба', unit:'кг', base:520, p:19.7, f:12.4, c:0, kcal:187, notAt:[] },
  { id:'egg',    name:'Яйца',       cat:'Мясо и рыба', unit:'шт', base:9,   p:12.6, f:10.6, c:1.2, kcal:155, veg:true, alerg:['яйца'] },
  { id:'salmon', name:'Лосось (филе)', cat:'Мясо и рыба', unit:'кг', base:950, p:19.8, f:6.3, c:0, kcal:142, alerg:['рыба'], notAt:['pyat','magnit'] },
  { id:'cod',    name:'Треска',     cat:'Мясо и рыба', unit:'кг', base:450, p:17.7, f:0.5, c:0,   kcal:82, alerg:['рыба'], notAt:['pyat'] },
  { id:'shrimp', name:'Креветки',   cat:'Мясо и рыба', unit:'кг', base:900, p:18, f:0.8, c:0,     kcal:85, alerg:['морепродукты'], mult:{pyat:null,magnit:null} },

  // ---------- Молочные продукты ----------
  { id:'milk',   name:'Молоко 2,5%', cat:'Молочные продукты', unit:'кг', base:75, p:3.0, f:2.5, c:4.7, kcal:52, veg:true, alerg:['лактоза','молочное'] },
  { id:'milkLF', name:'Молоко безлактозное', cat:'Молочные продукты', unit:'кг', base:120, p:3.0, f:1.5, c:4.9, kcal:47, veg:true, notAt:['pyat','magnit','lenta'] },
  { id:'tvorog', name:'Творог 5%',  cat:'Молочные продукты', unit:'кг', base:260, p:17.2, f:5.0, c:1.8, kcal:121, veg:true, alerg:['лактоза','молочное'] },
  { id:'yogurt', name:'Йогурт натуральный', cat:'Молочные продукты', unit:'кг', base:150, p:3.2, f:2.5, c:4.5, kcal:60, veg:true, alerg:['лактоза','молочное'] },
  { id:'kefir',  name:'Кефир 2,5%', cat:'Молочные продукты', unit:'кг', base:75, p:3.0, f:2.5, c:4.0, kcal:53, veg:true, alerg:['лактоза','молочное'] },
  { id:'smetana',name:'Сметана 15%', cat:'Молочные продукты', unit:'кг', base:130, p:2.6, f:15.0, c:3.6, kcal:162, veg:true, alerg:['лактоза','молочное'] },
  { id:'cream',  name:'Сливки 10%', cat:'Молочные продукты', unit:'кг', base:140, p:3.0, f:10.0, c:4.0, kcal:118, veg:true, alerg:['лактоза','молочное'] },
  { id:'cheese', name:'Сыр Российский', cat:'Молочные продукты', unit:'кг', base:520, p:24.1, f:29.5, c:0.3, kcal:364, veg:true, alerg:['лактоза','молочное'] },
  { id:'butter', name:'Масло сливочное', cat:'Молочные продукты', unit:'кг', base:620, p:0.5, f:82.5, c:0.8, kcal:748, veg:true, alerg:['лактоза','молочное'] },

  // ---------- Крупы и бакалея ----------
  { id:'rice',   name:'Рис',        cat:'Крупы и бакалея', unit:'кг', base:95, p:6.7, f:0.7, c:78.9, kcal:344, veg:true, vegan:true },
  { id:'buckwheat',name:'Гречка',   cat:'Крупы и бакалея', unit:'кг', base:100, p:12.6, f:3.3, c:62.1, kcal:313, veg:true, vegan:true },
  { id:'oats',   name:'Овсяные хлопья', cat:'Крупы и бакалея', unit:'кг', base:110, p:12.3, f:6.1, c:59.5, kcal:342, veg:true, vegan:true, alerg:['глютен'] },
  { id:'pasta',  name:'Макароны',   cat:'Крупы и бакалея', unit:'кг', base:90, p:10.4, f:1.1, c:71.5, kcal:350, veg:true, vegan:true, alerg:['глютен'] },
  { id:'flour',  name:'Мука пшеничная', cat:'Крупы и бакалея', unit:'кг', base:70, p:10.8, f:1.1, c:69.9, kcal:331, veg:true, vegan:true, alerg:['глютен'] },
  { id:'bread',  name:'Хлеб',       cat:'Крупы и бакалея', unit:'кг', base:70, p:6.8, f:1.3, c:40.7, kcal:201, veg:true, vegan:true, alerg:['глютен'] },
  { id:'lentil', name:'Чечевица',   cat:'Крупы и бакалея', unit:'кг', base:120, p:24, f:1.5, c:46.3, kcal:295, veg:true, vegan:true, notAt:['pyat','magnit'] },
  { id:'beans',  name:'Фасоль красная', cat:'Крупы и бакалея', unit:'кг', base:130, p:21, f:1.1, c:64, kcal:337, veg:true, vegan:true },
  { id:'chickpea',name:'Нут',        cat:'Крупы и бакалея', unit:'кг', base:140, p:19, f:6, c:61,   kcal:364, veg:true, vegan:true, mult:{pyat:null} },
  { id:'sugar',  name:'Сахар',      cat:'Крупы и бакалея', unit:'кг', base:65, p:0, f:0, c:99.9,   kcal:387, veg:true, vegan:true },
  { id:'salt',   name:'Соль',       cat:'Крупы и бакалея', unit:'кг', base:30, p:0, f:0, c:0,      kcal:0, veg:true, vegan:true },
  { id:'oil',    name:'Масло подсолнечное', cat:'Крупы и бакалея', unit:'кг', base:140, p:0, f:99.9, c:0, kcal:899, veg:true, vegan:true },
  { id:'olive',  name:'Масло оливковое', cat:'Крупы и бакалея', unit:'кг', base:600, p:0, f:99.8, c:0, kcal:898, veg:true, vegan:true, mult:{pyat:null,magnit:null} },
  { id:'tom_paste',name:'Томатная паста', cat:'Крупы и бакалея', unit:'кг', base:180, p:4.4, f:0.5, c:14.1, kcal:82, veg:true, vegan:true },
  { id:'honey',  name:'Мёд',        cat:'Крупы и бакалея', unit:'кг', base:450, p:0.3, f:0, c:82.4,  kcal:304, veg:true, vegan:true },

  // ---------- Орехи и перекусы ----------
  { id:'walnut', name:'Грецкие орехи', cat:'Орехи и перекусы', unit:'кг', base:900, p:15.2, f:65.2, c:13.7, kcal:654, veg:true, vegan:true, alerg:['орехи'] },
  { id:'almond', name:'Миндаль',   cat:'Орехи и перекусы', unit:'кг', base:1100, p:21.2, f:50, c:21.6, kcal:579, veg:true, vegan:true, alerg:['орехи'], mult:{pyat:null,magnit:null} },
  { id:'darkchoc',name:'Шоколад тёмный', cat:'Орехи и перекусы', unit:'кг', base:700, p:4.9, f:31.3, c:61.5, kcal:546, veg:true, vegan:true, mult:{pyat:null} },
  { id:'apricot',name:'Курага',    cat:'Орехи и перекусы', unit:'кг', base:330, p:3.4, f:0.5, c:62.6, kcal:241, veg:true, vegan:true, notAt:['pyat','magnit'] },
];

/* Рецепты.
   meal – завтрак/обед/ужин/перекус
   cuisine – кухня
   kid  – подходит ребёнку 2 лет (щадящее, без орехов)
   ing  – { productId: граммы } на всю семью (базовый размер)
   Питательность и аллергены рецепта считаются автоматически из продуктов.
*/
const RECIPES = [
  // ================= ЗАВТРАК =================
  { id:'r1', name:'Овсяная каша с яблоком', meal:'breakfast', cuisine:'Русская', kid:true,
    ing:{ oats:150, milk:500, apple:200, sugar:20, butter:15 } },
  { id:'r2', name:'Гречка с молоком',        meal:'breakfast', cuisine:'Русская', kid:true,
    ing:{ buckwheat:180, milk:400, butter:30, sugar:20 } },
  { id:'r3', name:'Омлет с помидорами и сыром', meal:'breakfast', cuisine:'Русская',
    ing:{ egg:300, tomato:200, cheese:50, milk:100, oil:10 } },
  { id:'r4', name:'Творожная запеканка',     meal:'breakfast', cuisine:'Русская', kid:true,
    ing:{ tvorog:500, flour:30, egg:100, sugar:60, smetana:50 } },
  { id:'r5', name:'Рисовая каша с бананом',  meal:'breakfast', cuisine:'Русская', kid:true,
    ing:{ rice:150, milk:500, banana:150, butter:20 } },
  { id:'r6', name:'Йогурт с овсянкой и бананом', meal:'breakfast', cuisine:'Универсальная', kid:true,
    ing:{ yogurt:400, oats:100, banana:100, honey:20 } },
  { id:'r7', name:'Сырники со сметаной',     meal:'breakfast', cuisine:'Русская', kid:true,
    ing:{ tvorog:400, flour:60, egg:50, sugar:50, oil:20, smetana:80 } },
  { id:'r8', name:'Тосты с авокадо и яйцом', meal:'breakfast', cuisine:'Средиземноморская',
    ing:{ bread:200, avocado:200, egg:100 } },

  // ================= ОБЕД =================
  { id:'r9',  name:'Борщ со сметаной',      meal:'lunch', cuisine:'Русская',
    ing:{ cabbage:300, beet:250, potato:300, carrot:120, onion:120, beef:350, tom_paste:40, smetana:80, oil:20 } },
  { id:'r10', name:'Куриный суп с вермишелью', meal:'lunch', cuisine:'Русская', kid:true,
    ing:{ chicken:300, pasta:120, potato:300, carrot:120, onion:80 } },
  { id:'r11', name:'Гречка с курицей и овощами', meal:'lunch', cuisine:'Русская',
    ing:{ buckwheat:220, chicken:350, pepper:150, onion:100, carrot:100, oil:25 } },
  { id:'r12', name:'Куриные бёдра с рисом и овощами', meal:'lunch', cuisine:'Универсальная',
    ing:{ thighs:450, rice:200, broccoli:200, carrot:100, oil:15 } },
  { id:'r13', name:'Тушёная говядина с картофелем', meal:'lunch', cuisine:'Русская',
    ing:{ beef:400, potato:600, carrot:150, onion:120, oil:25 } },
  { id:'r14', name:'Лосось с рисом и брокколи', meal:'lunch', cuisine:'Средиземноморская',
    ing:{ salmon:350, rice:200, broccoli:200, olive:15 } },
  { id:'r15', name:'Куриный плов',           meal:'lunch', cuisine:'Азиатская',
    ing:{ rice:250, chicken:350, carrot:150, onion:150, oil:30, garlic:10 } },
  { id:'r16', name:'Чечевичный суп',         meal:'lunch', cuisine:'Русская', veg:true, kid:true,
    ing:{ lentil:250, carrot:150, onion:120, potato:300, tom_paste:40, oil:20 } },
  { id:'r17', name:'Тушёные овощи с нутом',  meal:'lunch', cuisine:'Азиатская', veg:true, kid:true,
    ing:{ chickpea:200, zucchini:300, eggplant:300, pepper:200, tom_paste:60, onion:100, oil:20 } },
  { id:'r18', name:'Паста болоньезе',        meal:'lunch', cuisine:'Итальянская',
    ing:{ pasta:300, mince:400, tom_paste:100, onion:120, garlic:10, oil:20 } },

  // ================= УЖИН =================
  { id:'r19', name:'Овощное рагу с говядиной', meal:'dinner', cuisine:'Русская',
    ing:{ beef:350, potato:400, zucchini:300, tomato:200, onion:100, carrot:100 } },
  { id:'r20', name:'Запечённая курица с картофелем', meal:'dinner', cuisine:'Русская', kid:true,
    ing:{ thighs:500, potato:500, carrot:150, oil:15, garlic:10 } },
  { id:'r21', name:'Рыбные котлеты с гречкой', meal:'dinner', cuisine:'Русская',
    ing:{ cod:400, egg:50, bread:60, onion:80, buckwheat:180, oil:15 } },
  { id:'r22', name:'Гречка с овощами',       meal:'dinner', cuisine:'Русская', veg:true, kid:true,
    ing:{ buckwheat:250, zucchini:250, pepper:150, onion:100, carrot:100, oil:25 } },
  { id:'r23', name:'Оладьи на кефире',       meal:'dinner', cuisine:'Русская', kid:true,
    ing:{ flour:250, kefir:250, egg:50, sugar:30, oil:30 } },
  { id:'r24', name:'Куриная запеканка с брокколи', meal:'dinner', cuisine:'Универсальная', kid:true,
    ing:{ chicken:400, broccoli:250, egg:50, smetana:100, cheese:50 } },
  { id:'r25', name:'Паста с овощами и сыром', meal:'dinner', cuisine:'Итальянская', veg:true,
    ing:{ pasta:300, tomato:300, cheese:100, garlic:10, olive:25 } },
  { id:'r26', name:'Треска в сметанном соусе с рисом', meal:'dinner', cuisine:'Русская',
    ing:{ cod:400, smetana:120, rice:200, onion:100, oil:15 } },
  { id:'r27', name:'Тыквенный суп-пюре',     meal:'dinner', cuisine:'Универсальная', veg:true, kid:true,
    ing:{ pumpkin:700, carrot:150, onion:100, garlic:10, cream:150, olive:25 } },
  { id:'r28', name:'Тефтели в томатном соусе с картофелем', meal:'dinner', cuisine:'Русская',
    ing:{ mince:400, rice:100, onion:100, tom_paste:80, potato:500, oil:20 } },

  // ================= ПЕРЕКУС =================
  { id:'r29', name:'Йогурт с бананом и мёдом', meal:'snack', cuisine:'Универсальная', kid:true,
    ing:{ yogurt:300, banana:150, honey:10 } },
  { id:'r30', name:'Творог с мёдом и яблоком', meal:'snack', cuisine:'Русская', kid:true,
    ing:{ tvorog:250, honey:30, apple:150 } },
  { id:'r31', name:'Бутерброд с сыром',       meal:'snack', cuisine:'Универсальная', kid:true,
    ing:{ bread:100, cheese:50, butter:20 } },
  { id:'r32', name:'Смесь орехов с курагой',  meal:'snack', cuisine:'Универсальная', veg:true,
    ing:{ walnut:30, almond:30, apricot:50 } },
  { id:'r33', name:'Фруктовая тарелка',       meal:'snack', cuisine:'Универсальная', veg:true, kid:true,
    ing:{ apple:200, banana:150, orange:200, pear:150 } },
  { id:'r34', name:'Морковные палочки с йогуртовым соусом', meal:'snack', cuisine:'Универсальная', kid:true,
    ing:{ carrot:200, yogurt:100 } },
  { id:'r35', name:'Творожный десерт с бананом', meal:'snack', cuisine:'Русская', kid:true,
    ing:{ tvorog:200, banana:150, sugar:15 } },
  { id:'r36', name:'Варёное яйцо с хлебом',   meal:'snack', cuisine:'Универсальная',
    ing:{ egg:100, bread:50 } },
  { id:'r37', name:'Банановый смузи',         meal:'snack', cuisine:'Универсальная', kid:true,
    ing:{ banana:200, milk:300, oats:50, honey:20 } },

  // ============ веганские и «больше вариантов для фильтров» ============
  { id:'r38', name:'Овсяная каша на воде с бананом', meal:'breakfast', cuisine:'Универсальная', veg:true, kid:true,
    ing:{ oats:120, banana:200, apple:150, oil:15, sugar:20 } },
  { id:'r39', name:'Рисовая каша на воде с бананом', meal:'breakfast', cuisine:'Универсальная', veg:true, kid:true,
    ing:{ rice:160, banana:150, apple:150, oil:15, sugar:15 } },
  { id:'r40', name:'Фруктовый смузи',         meal:'snack', cuisine:'Универсальная', veg:true, kid:true,
    ing:{ banana:200, apple:150, orange:200 } },
  { id:'r41', name:'Овощной суп с гречкой',   meal:'lunch', cuisine:'Русская', veg:true, kid:true,
    ing:{ buckwheat:150, potato:300, carrot:150, onion:100, tom_paste:40, oil:15 } },
  { id:'r42', name:'Запечённые овощи с рисом', meal:'dinner', cuisine:'Азиатская', veg:true, kid:true,
    ing:{ rice:200, zucchini:250, eggplant:250, pepper:200, tom_paste:60, olive:25 } },
  { id:'r43', name:'Овощное рагу со свеклой',  meal:'dinner', cuisine:'Русская', veg:true, kid:true,
    ing:{ beet:300, potato:300, carrot:150, tomato:200, onion:100, oil:20 } },
];

/* Количество порций в базовом рецепте на семью.
   Используется только для справочной информации в UI. */
const FAMILY_PORTIONS = 3;