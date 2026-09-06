// Builds the app's searchable ingredient catalog from data/ingredients.csv and
// splices it into foodfeed-app/index.html between the GENERATED:ingredients
// markers. Run with `node tools/build-ingredients.mjs` after editing the CSV.
//
// The CSV ships the names, categories and dietary tags. Emoji and synonyms are
// editorial, so they live here: EMOJI_RULES paints a whole category in one line,
// SYNONYMS covers the words people actually type that the CSV doesn't know.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSV = join(root, 'foodfeed-app/data/ingredients.csv');
const HTML = join(root, 'foodfeed-app/index.html');

// One emoji per category, used for anything EMOJI_RULES doesn't claim.
const CAT_EMOJI = {
  'Meat & Poultry': '\u{1F969}', 'Seafood': '\u{1F41F}', 'Vegetables': '\u{1F96C}',
  'Aromatics': '\u{1F9C4}', 'Grains & Rice': '\u{1F33E}', 'Pasta & Noodles': '\u{1F35D}',
  'Beans & Legumes': '\u{1FAD8}', 'Dairy': '\u{1F9C0}', 'Eggs': '\u{1F95A}',
  'Bread & Bakery': '\u{1F35E}', 'Flours & Baking': '\u{1F9C1}', 'Oils & Fats': '\u{1FAD2}',
  'Herbs & Spices': '\u{1F33F}', 'Sauces & Condiments': '\u{1F963}', 'Canned & Jarred': '\u{1F96B}',
  'Fruits': '\u{1F34E}', 'Nuts & Seeds': '\u{1F95C}', 'Nut & Seed Butters': '\u{1F95C}',
  'Breakfast': '\u{1F963}', 'Cooking Liquids & Vinegars': '\u{1F9C3}',
  'International & Specialty': '\u{1F371}', 'Sweets & Desserts': '\u{1F36C}',
};

// First matching pattern wins, so put the specific ones above the general ones.
const EMOJI_RULES = [
  [/^(whole )?chicken|chicken (breast|thigh|wing|drumstick|tender)|ground chicken/, '\u{1F357}'],
  [/turkey/, '\u{1F983}'], [/duck/, '\u{1F986}'], [/lamb|venison|veal/, '\u{1F411}'],
  [/bacon|pork belly|ham$/, '\u{1F953}'], [/sausage|chorizo|hot dog/, '\u{1F32D}'],
  [/beef|steak|brisket|ground pork|pork (chop|loin|shoulder|tenderloin)/, '\u{1F969}'],
  [/shrimp|prawn/, '\u{1F364}'], [/crab|crawfish/, '\u{1F980}'], [/lobster/, '\u{1F99E}'],
  [/oyster|mussel|clam|scallop/, '\u{1F99A}'], [/octopus|calamari/, '\u{1F419}'],
  [/mushroom/, '\u{1F344}'], [/tomato/, '\u{1F345}'], [/corn(?!starch|meal| flour)|hominy/, '\u{1F33D}'],
  [/potato(?!\s*starch)/, '\u{1F954}'], [/sweet potato|yam/, '\u{1F360}'],
  [/pumpkin|squash/, '\u{1F383}'], [/carrot|parsnip|radish|turnip|beet|rutabaga/, '\u{1F955}'],
  [/broccoli|cauliflower|brussels/, '\u{1F966}'], [/cucumber|zucchini/, '\u{1F952}'],
  [/eggplant/, '\u{1F346}'], [/jalape|serrano|habanero|poblano|cayenne|chili|harissa|sriracha|gochu|sambal/, '\u{1F336}️'],
  [/pepper$|bell pepper|banana pepper|roasted red/, '\u{1FAD1}'],
  [/pea(s|$)|edamame|snow pea|snap pea/, '\u{1FAD8}'], [/bean|lentil|chickpea|soybean/, '\u{1FAD8}'],
  [/onion|shallot|scallion|leek|chive/, '\u{1F9C5}'], [/garlic/, '\u{1F9C4}'], [/ginger|turmeric/, '\u{1FADA}'],
  [/rice$|rice(?! (noodle|paper|vinegar))/, '\u{1F35A}'], [/oats|granola|cereal|bran|cheerio|flake/, '\u{1F963}'],
  [/noodle|ramen|udon|soba|glass noodle|chow mein/, '\u{1F35C}'],
  [/spaghetti|linguine|fettuccine|penne|rigatoni|ziti|rotini|fusilli|farfalle|macaroni|shells|lasagna|ravioli|tortellini|orzo|angel hair|pasta/, '\u{1F35D}'],
  [/cheese|parmesan|mozzarella|cheddar|gouda|brie|feta|ricotta|provolone|gruy|camembert|mascarpone|velveeta|queso|jack$/, '\u{1F9C0}'],
  [/milk|cream|yogurt|buttermilk/, '\u{1F95B}'], [/egg/, '\u{1F95A}'],
  [/tortilla|pita|naan|flatbread/, '\u{1FAD3}'], [/croissant/, '\u{1F950}'], [/bagel/, '\u{1F96F}'],
  [/bread|baguette|ciabatta|sourdough|brioche|bun|roll|biscuit|breadcrumb|muffin/, '\u{1F35E}'],
  [/chocolate|cocoa|nutella|oreo/, '\u{1F36B}'], [/sugar|sprinkle|marshmallow|caramel|candy/, '\u{1F36C}'],
  [/honey|agave|molasses|syrup/, '\u{1F36F}'], [/jam|jelly|preserve|curd|marmalade/, '\u{1F353}'],
  [/olive oil|olives/, '\u{1FAD2}'], [/butter$|salted butter|ghee/, '\u{1F9C8}'],
  [/oil$|lard|shortening|grease/, '\u{1F9F4}'],
  [/salt/, '\u{1F9C2}'], [/basil|parsley|cilantro|mint|thyme|rosemary|sage|dill|oregano|tarragon|marjoram|bay lea/, '\u{1F33F}'],
  [/apple(?!\s*cider)/, '\u{1F34E}'], [/banana$|bananas/, '\u{1F34C}'], [/orange|tangerine/, '\u{1F34A}'],
  [/lemon/, '\u{1F34B}'], [/lime/, '\u{1F34B}‍\u{1F7E9}'], [/grapefruit/, '\u{1F34A}'],
  [/strawberr/, '\u{1F353}'], [/blueberr|blackberr|raspberr|cranberr/, '\u{1FAD0}'],
  [/cherr/, '\u{1F352}'], [/peach|nectarine|apricot/, '\u{1F351}'], [/plum|fig|date/, '\u{1F7E3}'],
  [/pear/, '\u{1F350}'], [/mango/, '\u{1F96D}'], [/pineapple/, '\u{1F34D}'], [/papaya|guava|passion/, '\u{1F96D}'],
  [/kiwi/, '\u{1F95D}'], [/watermelon/, '\u{1F349}'], [/cantaloupe|honeydew|melon/, '\u{1F348}'],
  [/grape|raisin/, '\u{1F347}'], [/pomegranate/, '\u{1F345}'], [/coconut/, '\u{1F965}'],
  [/peanut/, '\u{1F95C}'], [/nut(s|$)|almond|walnut|pecan|cashew|pistachio|hazelnut|macadamia/, '\u{1F330}'],
  [/seed/, '\u{1F331}'], [/broth|stock/, '\u{1F372}'], [/juice/, '\u{1F964}'], [/vinegar|cider/, '\u{1F9C3}'],
  [/wine/, '\u{1F377}'], [/miso|kimchi|nori|furikake|wonton|spring roll|rice paper/, '\u{1F371}'],
  [/curry|masala|tikka|tamarind/, '\u{1F35B}'], [/sauce|ketchup|mustard|mayo|aioli|pesto|marinara|salsa|hummus|tahini|tzatziki|chimichurri|glaze|dressing/, '\u{1F963}'],
  [/canned|pickle|caper|artichoke heart/, '\u{1F96B}'],
];

// Words people type that aren't the catalog name. Keyed by exact CSV name.
const SYNONYMS = {
  'Chicken breast': ['chicken'], 'Chicken tenders': ['chicken tenderloins', 'goujons'],
  'Ground chicken': ['minced chicken'], 'Ground turkey': ['minced turkey'],
  'Ground beef': ['mince', 'minced beef', 'hamburger meat', 'hamburger'],
  'Beef chuck': ['chuck roast', 'chuck'], 'Beef brisket': ['brisket'],
  'Beef sirloin': ['sirloin'], 'Beef tenderloin': ['filet mignon', 'tenderloin'],
  'Ribeye steak': ['rib eye', 'ribeye', 'delmonico'], 'Strip steak': ['new york strip', 'ny strip'],
  'Flank steak': ['flank', 'skirt steak'], 'Pork shoulder': ['boston butt', 'pork butt'],
  'Ground pork': ['minced pork'], 'Ground lamb': ['minced lamb'],
  'Italian sausage': ['sweet sausage', 'hot sausage'], 'Venison': ['deer meat'],
  'Mahi-mahi': ['mahi mahi', 'dorado', 'dolphinfish'], 'Sea bass': ['branzino'],
  'Crawfish': ['crayfish', 'crawdads'], 'Calamari': ['squid'],
  'Shrimp': ['prawns'], 'Jumbo shrimp': ['large shrimp', 'king prawns'],
  'Smoked salmon': ['lox', 'gravlax'], 'Canned tuna': ['tinned tuna'],
  'Anchovies': ['anchovy fillets'],
  'Arugula': ['rocket'], 'Zucchini': ['courgette'], 'Eggplant': ['aubergine'],
  'Bell pepper': ['capsicum', 'sweet pepper', 'peppers'],
  'Jalapeño': ['jalapeno', 'jalapenos'], 'Habanero': ['scotch bonnet'],
  'Romaine lettuce': ['cos lettuce', 'romaine', 'lettuce'],
  'Iceberg lettuce': ['iceberg', 'lettuce'], 'Napa cabbage': ['chinese cabbage', 'wombok'],
  'Bok choy': ['pak choi', 'pak choy'], 'Swiss chard': ['chard', 'silverbeet'],
  'Collard greens': ['collards'], 'Broccolini': ['baby broccoli', 'tenderstem'],
  'Snow peas': ['mangetout'], 'Sugar snap peas': ['snap peas'],
  'Green beans': ['string beans', 'haricots verts'], 'Okra': ['ladies fingers'],
  'Beets': ['beetroot'], 'Rutabaga': ['swede'], 'Radishes': ['radish'],
  'Sweet potato': ['yam', 'kumara'], 'Russet potato': ['baking potato', 'idaho potato', 'potatoes'],
  'Yukon Gold potato': ['yellow potato', 'potatoes'], 'Red potato': ['potatoes'],
  'Butternut squash': ['butternut pumpkin'], 'Cremini mushrooms': ['baby bella', 'chestnut mushrooms'],
  'Portobello mushrooms': ['portabella', 'portobello'],
  'Sun-dried tomatoes': ['sundried tomatoes'], 'Cherry tomatoes': ['grape tomatoes'],
  'Green onions': ['scallions', 'spring onions'], 'Scallions': ['green onions', 'spring onions'],
  'Yellow onion': ['onion', 'onions', 'brown onion'], 'White onion': ['onion', 'onions'],
  'Red onion': ['onion', 'onions'], 'Sweet onion': ['vidalia', 'onion'],
  'Lemongrass': ['lemon grass'], 'Fresh turmeric': ['turmeric root'],
  'Arborio rice': ['risotto rice'], 'Sticky rice': ['glutinous rice', 'sweet rice'],
  'Sushi rice': ['short grain rice'], 'White rice': ['rice'], 'Brown rice': ['rice'],
  'Rolled oats': ['old fashioned oats', 'porridge oats'], 'Steel-cut oats': ['irish oats', 'pinhead oats'],
  'Bulgur': ['cracked wheat'], 'Farro': ['emmer'], 'Barley': ['pearl barley'],
  'Buckwheat': ['kasha'], 'Grits': ['hominy grits'], 'Cornmeal': ['corn meal'],
  'Pearl couscous': ['israeli couscous', 'ptitim'],
  'Angel hair': ['capellini'], 'Farfalle': ['bow tie pasta', 'bowties'],
  'Fusilli': ['spiral pasta'], 'Rotini': ['spirals'], 'Macaroni': ['elbow macaroni', 'elbows'],
  'Shells': ['conchiglie', 'pasta shells'], 'Orzo': ['risoni'],
  'Rice noodles': ['rice sticks', 'pho noodles', 'vermicelli'],
  'Glass noodles': ['cellophane noodles', 'bean thread noodles'],
  'Soba noodles': ['buckwheat noodles'], 'Chow mein noodles': ['lo mein noodles'],
  'Lasagna noodles': ['lasagne sheets'],
  'Chickpeas': ['garbanzo beans', 'garbanzos'], 'Cannellini beans': ['white kidney beans', 'white beans'],
  'Navy beans': ['haricot beans'], 'Lima beans': ['butter beans'],
  'Black-eyed peas': ['cowpeas', 'black eyed peas'], 'Lentils': ['dal', 'dahl'],
  'Red lentils': ['masoor dal'], 'Split peas': ['dried peas'],
  'Whole milk': ['milk', 'full fat milk'], '2% milk': ['milk', 'reduced fat milk', 'two percent milk'],
  'Skim milk': ['milk', 'nonfat milk', 'fat free milk'],
  'Heavy cream': ['whipping cream', 'double cream', 'cream'],
  'Half-and-half': ['half and half'], 'Sour cream': ['crema'],
  'Cream cheese': ['philadelphia'], 'Greek yogurt': ['greek yoghurt', 'yogurt'],
  'Plain yogurt': ['yoghurt', 'natural yogurt', 'yogurt'],
  'Parmesan': ['parmigiano', 'parmigiano reggiano', 'parm'],
  'Mozzarella': ['mozzarella cheese'], 'Cheddar': ['cheddar cheese'],
  'Monterey Jack': ['jack cheese'], 'Swiss cheese': ['emmental', 'emmentaler'],
  'Gruyère': ['gruyere'], 'Goat cheese': ['chevre', 'chèvre'],
  'Blue cheese': ['gorgonzola', 'roquefort', 'stilton'],
  'Queso fresco': ['fresh cheese'], 'Velveeta': ['processed cheese'],
  'Ricotta': ['ricotta cheese'], 'Feta': ['feta cheese'],
  'Large eggs': ['eggs', 'egg'], 'Medium eggs': ['eggs', 'egg'],
  'Egg whites': ['egg white'], 'Egg yolks': ['egg yolk'],
  'Sourdough': ['sourdough bread'], 'Naan': ['naan bread'],
  'Flour tortillas': ['tortillas'], 'Corn tortillas': ['tortillas'],
  'Panko breadcrumbs': ['panko'], 'English muffins': ['english muffin'],
  'Hamburger buns': ['burger buns'], 'Graham crackers': ['digestive biscuits'],
  'All-purpose flour': ['plain flour', 'ap flour', 'flour'],
  'Whole wheat flour': ['wholemeal flour'], 'Bread flour': ['strong flour'],
  'Cornstarch': ['corn starch'], 'Baking soda': ['bicarbonate of soda', 'bicarb'],
  'Powdered sugar': ['confectioners sugar', 'icing sugar'],
  'Granulated sugar': ['white sugar', 'caster sugar', 'sugar'],
  'Brown sugar': ['light brown sugar', 'dark brown sugar'],
  'Cocoa powder': ['cacao powder'], 'Vanilla extract': ['vanilla'],
  'Chocolate chips': ['choc chips'],
  'Extra virgin olive oil': ['evoo', 'olive oil'], 'Vegetable oil': ['neutral oil'],
  'Canola oil': ['rapeseed oil', 'neutral oil'], 'Sesame oil': ['toasted sesame oil'],
  'Ghee': ['clarified butter'], 'Shortening': ['crisco'],
  'Unsalted butter': ['butter'], 'Salted butter': ['butter'],
  'Cayenne': ['cayenne pepper'], 'Crushed red pepper': ['red pepper flakes', 'chili flakes', 'chilli flakes'],
  'Smoked paprika': ['pimenton'], 'Coriander': ['coriander seed', 'ground coriander'],
  'Cilantro': ['coriander leaf', 'chinese parsley', 'fresh coriander'],
  'Ginger powder': ['ground ginger'], 'Mustard powder': ['dry mustard', 'ground mustard'],
  'Bay leaves': ['bay leaf'], 'Old Bay': ['old bay seasoning'],
  'Italian seasoning': ['italian herbs'], 'Garam masala': ['garam masalla'],
  'Mayonnaise': ['mayo'], 'Dijon mustard': ['dijon'], 'Hot sauce': ['tabasco', 'chili sauce'],
  'BBQ sauce': ['barbecue sauce'], 'Worcestershire sauce': ['worcester sauce'],
  'Hoisin sauce': ['hoisin'], 'Fish sauce': ['nam pla', 'nuoc mam'],
  'Soy sauce': ['shoyu'], 'Tamari': ['gluten free soy sauce'],
  'Marinara': ['marinara sauce', 'red sauce'], 'Pico de gallo': ['salsa fresca'],
  'Tahini': ['sesame paste'], 'Hummus': ['houmous'], 'Ranch dressing': ['ranch'],
  'Canned tomatoes': ['tinned tomatoes'], 'Tomato paste': ['tomato puree'],
  'Canned coconut milk': ['coconut milk'], 'Canned chickpeas': ['tinned chickpeas'],
  'Jalapeño slices': ['pickled jalapenos', 'jalapeno slices'],
  'Artichoke hearts': ['artichokes'],
  'Lemons': ['lemon'], 'Limes': ['lime'], 'Apples': ['apple'], 'Bananas': ['banana'],
  'Oranges': ['orange'], 'Grapes': ['grape'], 'Dates': ['medjool dates'],
  'Dried cranberries': ['craisins'], 'Dried apricots': ['apricots'],
  'Peanuts': ['groundnuts'], 'Flax seeds': ['flaxseed', 'linseed'],
  'Pumpkin seeds': ['pepitas'], 'Peanut butter': ['pb'],
  'Sunflower seed butter': ['sunbutter'],
  'Corn flakes': ['cornflakes'], 'Cream of wheat': ['farina'], 'Hash browns': ['hashbrowns'],
  'Chicken broth': ['chicken stock'], 'Beef broth': ['beef stock'],
  'Vegetable broth': ['vegetable stock', 'veggie stock'], 'Bone broth': ['bone stock'],
  'Apple cider vinegar': ['acv'], 'Rice vinegar': ['rice wine vinegar'],
  'Miso paste': ['miso'], 'Gochujang': ['korean chili paste'],
  'Gochugaru': ['korean chili flakes'], 'Nori': ['seaweed sheets', 'seaweed'],
  'Sambal oelek': ['chili paste'], "Za'atar": ['zaatar', 'zatar'],
  'Masa harina': ['corn masa', 'masa'], 'Thai curry paste': ['curry paste'],
  'Tikka masala sauce': ['tikka masala'],
  'Nutella': ['chocolate hazelnut spread'], 'Oreo cookies': ['oreos'],
  'Vanilla wafers': ['nilla wafers'], 'Condensed milk': ['sweetened condensed milk'],
  'Coconut flakes': ['shredded coconut', 'desiccated coconut'],
};

// --- CSV -------------------------------------------------------------------
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift().map(h => h.trim());
  return rows.filter(r => r.some(v => v.trim())).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}

const emojiFor = (name) => {
  const n = name.toLowerCase();
  for (const [re, e] of EMOJI_RULES) if (re.test(n)) return e;
  return '';
};

// The CSV's dietary_tags/storage_type columns collapse to single letters so the
// packed catalog stays small: P high-protein, F fresh, S shelf-stable pantry.
const tagsFor = (row) => {
  const t = new Set();
  const d = (row.dietary_tags || '').toLowerCase();
  if (d.includes('high-protein')) t.add('P');
  const store = (row.storage_type || '').toLowerCase() || (d.includes('fresh') ? 'fresh' : d.includes('pantry') ? 'pantry' : '');
  if (store === 'fresh') t.add('F');
  if (store === 'pantry') t.add('S');
  return [...t].join('');
};

const rows = parseCsv(readFileSync(CSV, 'utf8'));
const cats = [...new Set(rows.map(r => r.category))];
const unknown = cats.filter(c => !CAT_EMOJI[c]);
if (unknown.length) throw new Error('No CAT_EMOJI for: ' + unknown.join(', '));

const usedSyn = new Set();
const pack = cats.map(cat => rows.filter(r => r.category === cat).map(r => {
  const name = r.ingredient_name;
  if (/[|~=#;]/.test(name)) throw new Error('Name breaks the packing format: ' + name);
  const syn = [...new Set((SYNONYMS[name] || []).concat(
    (r.synonyms || '').split(';').map(s => s.trim()).filter(Boolean)))];
  if (SYNONYMS[name]) usedSyn.add(name);
  const emoji = emojiFor(name);
  const tags = tagsFor(r);
  return name
    + (emoji && emoji !== CAT_EMOJI[cat] ? '=' + emoji : '')
    + (syn.length ? '~' + syn.join(';') : '')
    + (tags ? '#' + tags : '');
}).join('|'));

const stale = Object.keys(SYNONYMS).filter(k => !usedSyn.has(k));
if (stale.length) throw new Error('SYNONYMS keys not in the CSV: ' + stale.join(', '));

const q = s => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
const block = [
  '  // Categories the catalog is grouped under, each with the emoji anything in it',
  '  // falls back to.',
  '  ingredientCats = [',
  ...cats.map(c => `    [${q(c)}, ${q(CAT_EMOJI[c])}],`),
  '  ];',
  '  // One packed string per category, entries split on "|":',
  '  //   Name[=emoji][~synonym;synonym][#tags]   tags: P high-protein, F fresh, S pantry',
  '  ingredientPack = [',
  ...pack.map((p, i) => `    /* ${cats[i]} */ ${q(p)},`),
  '  ];',
].join('\n');

const html = readFileSync(HTML, 'utf8');
const start = '  /* GENERATED:ingredients — build with `node tools/build-ingredients.mjs`; edit data/ingredients.csv, not this. */';
const end = '  /* END GENERATED:ingredients */';
const si = html.indexOf(start), ei = html.indexOf(end);
if (si < 0 || ei < 0) throw new Error('Markers not found in index.html');
writeFileSync(HTML, html.slice(0, si) + start + '\n' + block + '\n' + end + html.slice(ei + end.length));

console.log(`${rows.length} ingredients, ${cats.length} categories, ` +
  `${Object.values(SYNONYMS).reduce((n, a) => n + a.length, 0)} synonyms → index.html`);
