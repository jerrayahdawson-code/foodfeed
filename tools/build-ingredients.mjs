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

// Chips run on six colour families rather than one colour per category, so a
// long result list reads as a handful of food groups instead of 22 tints.
// Light = background fill, dark = text, icon and border.
//
// The darks were picked for hue separation first — after darkening enough for
// AAA, near hues collapse into the same brown — and the tints are pinned bright
// enough to still read as coloured chips on white. Both invariants are asserted
// below, so a hand-edit that breaks either one fails the build.
const PALETTE = {
  red:    { bg: '#FADCE0', fg: '#841829' }, // protein & fresh red
  orange: { bg: '#FCE3C8', fg: '#6A3A0B' }, // cooked / sauce orange
  olive:  { bg: '#ECEEBE', fg: '#404D0C' }, // earthy dry staples
  green:  { bg: '#DBEFDB', fg: '#1D5127' }, // fresh produce green
  blue:   { bg: '#DAE6F8', fg: '#19457D' }, // chilled blue
  purple: { bg: '#E8DFF7', fg: '#572D89' }, // dessert violet
};

// Every catalog category, with the emoji anything in it falls back to and the
// family its chip belongs to. Six categories aren't named in the mapping matrix
// and are placed by the family descriptions: Aromatics is fresh produce,
// Flours & Baking / Nut & Seed Butters / Breakfast are dry staples, and
// Cooking Liquids & Vinegars / International & Specialty are sauces and pastes.
const CAT_STYLE = {
  'Meat & Poultry':             { emoji: '\u{1F969}', palette: 'red' },
  'Fruits':                     { emoji: '\u{1F34E}', palette: 'red' },
  'Seafood':                    { emoji: '\u{1F41F}', palette: 'blue' },
  'Dairy':                      { emoji: '\u{1F9C0}', palette: 'blue' },
  'Eggs':                       { emoji: '\u{1F95A}', palette: 'blue' },
  'Vegetables':                 { emoji: '\u{1F96C}', palette: 'green' },
  'Aromatics':                  { emoji: '\u{1F9C4}', palette: 'green' },
  'Herbs & Spices':             { emoji: '\u{1F33F}', palette: 'green' },
  'Grains & Rice':              { emoji: '\u{1F33E}', palette: 'olive' },
  'Bread & Bakery':             { emoji: '\u{1F35E}', palette: 'olive' },
  'Flours & Baking':            { emoji: '\u{1F9C1}', palette: 'olive' },
  'Beans & Legumes':            { emoji: '\u{1FAD8}', palette: 'olive' },
  'Nuts & Seeds':               { emoji: '\u{1F95C}', palette: 'olive' },
  'Nut & Seed Butters':         { emoji: '\u{1F95C}', palette: 'olive' },
  'Breakfast':                  { emoji: '\u{1F963}', palette: 'olive' },
  'Pasta & Noodles':            { emoji: '\u{1F35D}', palette: 'orange' },
  'Oils & Fats':                { emoji: '\u{1FAD2}', palette: 'orange' },
  'Sauces & Condiments':        { emoji: '\u{1F963}', palette: 'orange' },
  'Canned & Jarred':            { emoji: '\u{1F96B}', palette: 'orange' },
  'Cooking Liquids & Vinegars': { emoji: '\u{1F9C3}', palette: 'orange' },
  'International & Specialty':  { emoji: '\u{1F371}', palette: 'orange' },
  'Sweets & Desserts':          { emoji: '\u{1F36C}', palette: 'purple' },
};

// WCAG relative luminance, and the contrast ratio between two hex colours.
const channel = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const rgbOf = (hex) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const luminance = (hex) => {
  const [r, g, b] = rgbOf(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const rgbDistance = (a, b) => Math.hypot(...rgbOf(a).map((v, i) => v - rgbOf(b)[i]));

const AAA = 7;          // WCAG AAA for small text
const MIN_TINT = 1.12;  // a chip has to read as tinted, not as white
const MIN_HUE_GAP = 35; // and the six families have to read as six

const fail = (msg, rows) => { throw new Error(msg + '\n  ' + rows.join('\n  ')); };

const dim = Object.entries(PALETTE)
  .map(([k, p]) => [k, contrast(p.fg, p.bg)])
  .filter(([, r]) => r < AAA);
if (dim.length) fail(`Chip colours below WCAG AAA (${AAA}:1):`, dim.map(([k, r]) => `${k} is ${r.toFixed(2)}:1`));

const washedOut = Object.entries(PALETTE)
  .map(([k, p]) => [k, contrast(p.bg, '#FFFFFF')])
  .filter(([, r]) => r < MIN_TINT);
if (washedOut.length) fail('Chip fills too close to white:', washedOut.map(([k, r]) => `${k} is ${r.toFixed(2)} vs white`));

const keys = Object.keys(PALETTE);
const tooClose = [];
for (let i = 0; i < keys.length; i++) {
  for (let j = i + 1; j < keys.length; j++) {
    const d = rgbDistance(PALETTE[keys[i]].fg, PALETTE[keys[j]].fg);
    if (d < MIN_HUE_GAP) tooClose.push(`${keys[i]}/${keys[j]} only ${d.toFixed(0)} apart`);
  }
}
if (tooClose.length) fail(`Families read as the same colour (need ${MIN_HUE_GAP}+ apart):`, tooClose);

// First matching pattern wins, so the specific ones go above the general ones.
// Patterns are tested against the name lowercased with punctuation flattened to
// spaces, so \b works and "Half-and-half" reads as "half and half".
const EMOJI_RULES = [
  // Pinned down first: names that a broader rule below would misread.
  [/\bmustard powder\b/, '\u{1F33F}'], [/\b(steak|oyster) sauce\b/, '\u{1F963}'],
  [/\b(wrappers?|rice paper|empanada dough|masa)\b/, '\u{1F371}'],
  [/\b(granola|cheerios|raisin bran|shredded wheat|corn flakes|cream of wheat|pancake mix|waffle mix|hash browns)\b/, '\u{1F963}'],
  [/\b(oats|grits)\b/, '\u{1F963}'],
  [/\bcoconut\b/, '\u{1F965}'],
  [/\b(chocolate|cocoa|nutella|oreo)\b/, '\u{1F36B}'],
  [/\bmushrooms?\b/, '\u{1F344}'],
  [/\b(broth|stock)\b/, '\u{1F372}'], [/\bjuice\b/, '\u{1F964}'],
  [/\b(tortillas?|pita|naan|flatbread)\b/, '\u{1FAD3}'],
  [/\bbagels?\b/, '\u{1F96F}'], [/\bcroissants?\b/, '\u{1F950}'],

  // Meat, poultry and fish.
  [/\bchickens?\b/, '\u{1F357}'], [/\bturkey\b/, '\u{1F983}'], [/\bduck\b/, '\u{1F986}'],
  [/\blamb\b/, '\u{1F411}'], [/\b(veal|venison)\b/, '\u{1F969}'],
  [/\b(bacon|pork belly|ham)\b/, '\u{1F953}'], [/\b(sausage|chorizo|hot dog)\b/, '\u{1F32D}'],
  [/\b(beef|steak|brisket|sirloin|ribeye|pork)\b/, '\u{1F969}'],
  [/\b(shrimp|prawns?)\b/, '\u{1F364}'], [/\b(crab|crawfish)\b/, '\u{1F980}'], [/\blobster\b/, '\u{1F99E}'],
  [/\b(oysters?|mussels|clams|scallops)\b/, '\u{1F9AA}'], [/\b(octopus|calamari)\b/, '\u{1F419}'],

  // Produce.
  [/\btomato(es)?\b/, '\u{1F345}'], [/\bcorn\b/, '\u{1F33D}'],
  [/\bsweet potato\b|\byams?\b/, '\u{1F360}'], [/\bpotato(es)?\b/, '\u{1F954}'],
  [/\b(pumpkin|squash)\b(?! seeds)/, '\u{1F383}'], [/\b(carrots|parsnips|radishes|turnips|beets|rutabaga)\b/, '\u{1F955}'],
  [/\b(broccoli|broccolini|cauliflower|brussels)\b/, '\u{1F966}'], [/\b(cucumber|zucchini)\b/, '\u{1F952}'],
  [/\beggplant\b/, '\u{1F346}'],
  [/\b(jalapeno|serrano|poblano|habanero|cayenne|chili|red pepper|harissa|sriracha|gochujang|gochugaru|sambal)\b/, '\u{1F336}️'],
  [/\b(black|white) pepper\b/, '\u{1F9C2}'], [/\bpeppers?\b(?! jack)/, '\u{1FAD1}'],
  [/\blemongrass\b|\bchives\b/, '\u{1F33F}'],
  [/\b(onions?|shallots|scallions|leeks)\b/, '\u{1F9C5}'], [/\bgarlic\b/, '\u{1F9C4}'],
  [/\b(ginger|turmeric)\b/, '\u{1FADA}'],
  [/\b(snow peas|snap peas|^peas)\b/, '\u{1FAD8}'],
  [/\b(beans|lentils|chickpeas|soybeans|edamame|peas)\b/, '\u{1FAD8}'],

  // Pasta and noodles before rice and eggs, so "rice noodles" and "egg noodles"
  // both read as noodles.
  [/\b(noodles|ramen|udon|soba)\b/, '\u{1F35C}'],
  [/\b(spaghetti|linguine|fettuccine|penne|rigatoni|ziti|rotini|fusilli|farfalle|macaroni|shells|lasagna|ravioli|tortellini|orzo|angel hair|pasta)\b/, '\u{1F35D}'],

  // Dairy, eggs and bread.
  [/\b(cheese|parmesan|mozzarella|cheddar|gouda|brie|feta|ricotta|provolone|gruyere|camembert|mascarpone|velveeta|queso|jack)\b/, '\u{1F9C0}'],
  [/\b(milk|cream|yogurt|buttermilk|half and half)\b/, '\u{1F95B}'], [/\beggs?\b/, '\u{1F95A}'],
  [/\bbread\b(?! flour)|\b(baguette|ciabatta|sourdough|brioche|buns|rolls|biscuits|breadcrumbs|muffins)\b/, '\u{1F35E}'],

  [/\b(vinegar|cider)\b/, '\u{1F9C3}'], [/\bwine\b/, '\u{1F377}'], [/\brice\b/, '\u{1F35A}'],

  // Nuts, seeds, fats and sweeteners.
  [/\bseeds\b/, '\u{1F331}'], [/\bpeanuts?\b/, '\u{1F95C}'],
  [/\b(nuts|almond|walnuts|pecans|cashews?|pistachios|hazelnuts|macadamia)\b/, '\u{1F330}'],
  [/\b(olive oil|olives)\b/, '\u{1FAD2}'], [/\bbutter\b(?! cups)|\bghee\b/, '\u{1F9C8}'],
  [/\b(lard|shortening)\b/, '\u{1F9C8}'], [/\b(oil|grease)\b/, '\u{1F9F4}'],
  [/\bsalt\b/, '\u{1F9C2}'], [/\b(za atar|sumac)\b/, '\u{1F33F}'],
  [/\b(sugar|sprinkles|marshmallows|caramel)\b/, '\u{1F36C}'],
  [/\b(honey|agave|molasses|syrup)\b/, '\u{1F36F}'],
  [/\b(jam|jelly|preserves|curd|marmalade)\b/, '\u{1F353}'],

  // Fruit.
  [/\bapples?\b(?! cider)/, '\u{1F34E}'], [/\bbananas\b/, '\u{1F34C}'],
  [/\b(oranges|tangerines|grapefruit)\b/, '\u{1F34A}'], [/\blimes?\b/, '\u{1F34B}‍\u{1F7E9}'],
  [/\blemons?\b/, '\u{1F34B}'], [/\bstrawberr/, '\u{1F353}'],
  [/\b(blueberries|raspberries|blackberries|cranberries)\b/, '\u{1FAD0}'], [/\bcherries\b/, '\u{1F352}'],
  [/\b(peaches|nectarines|apricots)\b/, '\u{1F351}'], [/\b(plums|figs|dates)\b/, '\u{1F7E3}'],
  [/\bpears?\b/, '\u{1F350}'], [/\b(mango|papaya|guava|passion fruit)\b/, '\u{1F96D}'],
  [/\bpineapple\b/, '\u{1F34D}'], [/\bkiwi\b/, '\u{1F95D}'], [/\bwatermelon\b/, '\u{1F349}'],
  [/\b(cantaloupe|honeydew|melon)\b/, '\u{1F348}'], [/\b(grapes|raisins)\b/, '\u{1F347}'],

  // Herbs, and the prepared jars and pastes.
  [/\b(basil|parsley|cilantro|mint|thyme|rosemary|sage|dill|oregano|tarragon|marjoram|bay leaves)\b/, '\u{1F33F}'],
  [/\b(miso|kimchi|nori|furikake)\b/, '\u{1F371}'], [/\b(curry|masala|tikka|tamarind)\b/, '\u{1F35B}'],
  [/\b(sauce|ketchup|mustard|mayonnaise|aioli|pesto|marinara|salsa|hummus|tahini|tzatziki|chimichurri|glaze|dressing)\b/, '\u{1F963}'],
  [/\b(canned|pickles|capers|artichoke hearts)\b/, '\u{1F96B}'],
];

// Words people type that aren't the catalog name. Keyed by exact CSV name.
const SYNONYMS = {
  'Chicken breast': ['chicken'], 'Chicken tenders': ['chicken tenderloins', 'goujons'],
  'Ground chicken': ['minced chicken'], 'Ground turkey': ['minced turkey'],
  'Ground beef': ['mince', 'minced beef', 'hamburger meat'],
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
  const n = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
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
const unknown = cats.filter(c => !CAT_STYLE[c]);
if (unknown.length) throw new Error('No CAT_STYLE for: ' + unknown.join(', '));

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
    + (emoji && emoji !== CAT_STYLE[cat].emoji ? '=' + emoji : '')
    + (syn.length ? '~' + syn.join(';') : '')
    + (tags ? '#' + tags : '');
}).join('|'));

const stale = Object.keys(SYNONYMS).filter(k => !usedSyn.has(k));
if (stale.length) throw new Error('SYNONYMS keys not in the CSV: ' + stale.join(', '));

const q = s => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
const block = [
  '  // Categories the catalog is grouped under: display name, the emoji anything',
  '  // in it falls back to, and the fill/ink of the chip the search results tag it',
  '  // with. Colours come from six shared families, so 22 categories read as six',
  '  // food groups; every pair clears WCAG AAA (7:1) and the generator refuses to',
  '  // build one that does not.',
  '  ingredientCats = [',
  ...cats.map(c => {
    const { emoji, palette } = CAT_STYLE[c];
    const { bg, fg } = PALETTE[palette];
    return `    [${q(c)}, ${q(emoji)}, ${q(bg)}, ${q(fg)}], // ${palette}`;
  }),
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

const worstContrast = Math.min(...Object.values(PALETTE).map(p => contrast(p.fg, p.bg)));
const counts = keys.map(k => `${k} ${Object.values(CAT_STYLE).filter(c => c.palette === k).length}`);
console.log(`${rows.length} ingredients, ${cats.length} categories, ` +
  `${Object.values(SYNONYMS).reduce((n, a) => n + a.length, 0)} synonyms → index.html`);
console.log(`${keys.length} colour families (${counts.join(', ')})`);
console.log(`worst chip contrast ${worstContrast.toFixed(2)}:1 (WCAG AAA needs ${AAA}:1)`);
