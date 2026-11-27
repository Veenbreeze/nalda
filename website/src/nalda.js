/*
  Muulize Nalda: the shop's product assistant.

  Runs entirely in the browser over CATALOG, so it can only ever recommend
  things the shop actually stocks, and it never invents a price.
  It understands Kiswahili and English, budgets ("chini ya 100k", "under 50,000"),
  skin concerns, who a product is for, where it comes from, and forgives typos.
*/
import { CATALOG, ORIGIN, SHOP, money, orderText, waLink } from "./catalog.js";

const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "'");

const words = (s) => norm(s).replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean);

// ---------------- Vocabulary ----------------
const SW_MARKERS = ["nataka", "nina", "naomba", "nitumie", "nini", "ya", "kwa", "na", "mtoto", "watoto", "ngozi", "manukato", "marashi", "mafuta", "bei", "chini", "habari", "mambo", "mnayo", "kuna", "je", "gani", "wapi", "kiume", "kike", "madoa", "chunusi", "kavu", "sabuni", "meno", "nafuu", "zawadi", "elfu", "mwanaume", "mwanamke", "tafadhali", "nipe", "natafuta", "mko", "mnafungua", "lipa", "naweza", "mnaleta", "mzigo", "vya", "vitu", "kutoka", "bajeti", "zaidi", "mnauza", "nitapata", "asante", "sawa", "leo", "kesho"];

const CATS = {
  perfume: ["perfume", "perfumes", "parfum", "manukato", "marashi", "fragrance", "scent", "cologne", "mist", "edp", "edt"],
  baby: ["baby", "babies", "mtoto", "watoto", "newborn", "infant", "kids", "kid", "mchanga", "child", "children"],
  oral: ["toothpaste", "toothbrush", "teeth", "meno", "mswaki", "miswaki", "dental"],
  face: ["face", "uso", "facial"],
};
const FOR = {
  men: ["men", "man", "male", "him", "his", "husband", "boyfriend", "father", "dad", "kiume", "mwanaume", "wanaume", "mume", "baba", "kaka"],
  women: ["women", "woman", "female", "her", "she", "wife", "girlfriend", "mother", "mum", "mom", "kike", "mwanamke", "wanawake", "mke", "mama", "dada", "lady", "ladies"],
};
const ORIGINS = {
  US: ["usa", "us", "america", "american", "marekani", "states"],
  FR: ["france", "french", "paris", "ufaransa"],
  DE: ["germany", "german", "ujerumani", "deutsch"],
};
const CHEAP = ["cheap", "cheaper", "cheapest", "affordable", "budget", "nafuu", "rahisi", "ndogo"];
const STOP = new Set([
  "i", "im", "a", "an", "the", "for", "my", "me", "some", "do", "you", "have", "any", "something", "looking", "show", "please", "with", "and", "of", "to", "is", "it", "what", "which", "need", "want", "get", "can", "in", "on", "that", "this", "your", "are", "there", "how", "much", "price", "under", "below", "less", "than", "max", "around", "about", "k", "tsh", "tzs", "shillings",
  "ones", "one", "options", "more", "other", "others", "instead", "only", "just", "also", "too", "good", "best", "nice", "budget", "range", "type", "kind",
  "nataka", "nina", "naomba", "nitumie", "nini", "ya", "wa", "la", "kwa", "na", "za", "vya", "cha", "mimi", "je", "mnayo", "mna", "kuna", "tafadhali", "nipe", "natafuta", "gani", "hii", "ile", "bei", "chini", "elfu", "hadi", "kitu", "vitu", "kizuri", "nzuri", "zuri", "yangu", "wangu", "ni", "inauzwa", "shilingi", "sh", "bajeti", "zaidi", "nyingine", "tu", "pia", "ajili", "kwaajili", "aina", "kutoka", "kwenye", "yenye",
]);

const INTENTS = {
  greet: ["hi", "hello", "hey", "habari", "mambo", "niaje", "shikamoo", "salama", "hujambo", "vipi", "jambo", "sasa"],
  where: ["where", "location", "address", "located", "directions", "wapi", "mahali", "mko", "mpo", "duka", "shop", "map"],
  hours: ["hours", "open", "opening", "close", "closed", "saa", "mnafungua", "mnafunga", "sunday", "jumapili", "today", "leo"],
  pay: ["pay", "payment", "mpesa", "m-pesa", "tigo", "airtel", "halopesa", "card", "visa", "mastercard", "lipa", "malipo", "kadi", "crdb", "cash"],
  delivery: ["delivery", "deliver", "shipping", "ship", "kuleta", "mnaleta", "usafiri", "boda", "send", "tuma", "mkoani"],
  real: ["original", "orijino", "fake", "feki", "genuine", "authentic", "real", "copy"],
};

// ---------------- Helpers ----------------
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const has = (toks, list) => toks.some((t) => list.includes(t));
const hasPhrase = (text, list) => list.some((p) => (p.includes(" ") ? text.includes(p) : false));

const INDEX = CATALOG.map((p) => {
  const text = norm(`${p.brand} ${p.name} ${p.tags.join(" ")}`);
  return { p, text, toks: new Set(words(text)), brandToks: words(p.brand), nameToks: words(p.name) };
});
const VOCAB = [...new Set(INDEX.flatMap((x) => [...x.toks]))].filter((w) => w.length >= 4);

function parseBudget(raw) {
  const t = norm(raw).replace(/,/g, "");
  let m = t.match(/elfu\s*(\d+)/);
  if (m) return Number(m[1]) * 1000;
  m = t.match(/(\d+(?:\.\d+)?)\s*(k|elfu)\b/);
  if (m) return Math.round(Number(m[1]) * 1000);
  m = t.match(/(\d{4,7})/);
  if (m) return Number(m[1]);
  return null;
}

function detectLang(toks) {
  const sw = toks.filter((t) => SW_MARKERS.includes(t)).length;
  return sw > 0 ? "sw" : "en";
}

// ---------------- Assistant ----------------
export function createNalda() {
  let last = null; // remembers the previous search for follow-ups like "cheaper ones"

  function ask(raw) {
    const text = norm(raw);
    const toks = words(raw);
    const lang = detectLang(toks);
    const T = (sw, en) => (lang === "sw" ? sw : en);

    // Filters
    const f = { cat: null, for: null, origin: null, max: parseBudget(raw), cheap: has(toks, CHEAP) };
    for (const [k, list] of Object.entries(CATS)) if (has(toks, list)) f.cat = k;
    for (const [k, list] of Object.entries(FOR)) if (has(toks, list)) f.for = k;
    for (const [k, list] of Object.entries(ORIGINS)) if (has(toks, list)) f.origin = k;
    if (f.cat === "baby") f.for = null;

    // Free words left over after removing filter vocabulary
    const filterVocab = new Set([...Object.values(CATS), ...Object.values(FOR), ...Object.values(ORIGINS), CHEAP].flat());
    const free = toks.filter((t) => !STOP.has(t) && !filterVocab.has(t) && !/^\d/.test(t) && t.length > 1);

    // Info questions (answered only when no product is being asked about)
    const isProducty = free.some((w) => VOCAB.includes(w)) || f.cat || f.max;
    if (!isProducty) {
      if (has(toks, INTENTS.where)) return info(T(`Tupo ${SHOP.address}. Bonyeza hapa chini kwa ramani, au tuandikie WhatsApp tukuelekeze.`, `We're in ${SHOP.address}. Tap below for the map, or message us on WhatsApp for directions.`), lang, [T("Saa za kufungua", "Opening hours"), T("Njia za malipo", "How to pay")], true);
      if (has(toks, INTENTS.hours)) return info(T("Tunafungua Jumatatu hadi Jumamosi. Jumapili tumefunga. Kwa saa kamili za leo, uliza WhatsApp.", "We're open Monday to Saturday and closed on Sunday. For today's exact hours, ask on WhatsApp."), lang, [T("Mko wapi?", "Where are you?")]);
      if (has(toks, INTENTS.pay)) return info(T("Unaweza kulipa kwa M-Pesa, Tigo Pesa, Airtel Money, HaloPesa, Ezypesa, CRDB Lipa Hapa, TemboCard, SimBanking, Visa au Mastercard.", "You can pay by M-Pesa, Tigo Pesa, Airtel Money, HaloPesa, Ezypesa, CRDB Lipa Hapa, TemboCard, SimBanking, Visa or Mastercard."), lang, [T("Mko wapi?", "Where are you?")]);
      if (has(toks, INTENTS.delivery)) return info(T("Sina uhakika wa utaratibu wa kuleta mzigo. Duka litakujibu haraka WhatsApp.", "I don't have delivery details. The shop will answer quickly on WhatsApp."), lang, [], false, T("Habari NALDA, mnaleta mzigo? Niko ", "Hello NALDA, do you deliver? I'm in "));
      if (has(toks, INTENTS.real)) return info(T("Ndiyo. Authenticity is our pride: kila bidhaa ni original, kutoka Marekani, Ufaransa na Ujerumani.", "Yes. Authenticity is our pride: every product is original, imported from the USA, France and Germany."), lang, [T("Perfume ya Paris", "Perfume from Paris"), T("Body oil", "Body oil")]);
      if (has(toks, INTENTS.greet) || toks.length === 0) return info(T("Karibu! Niambie unachotafuta: bajeti yako, tatizo la ngozi, au ni kwa ajili ya nani.", "Welcome! Tell me what you're looking for: your budget, a skin concern, or who it's for."), lang, [T("Perfume ya 85,000", "Perfume under 100k"), T("Vitu vya mtoto", "Baby products"), T("Madoa usoni", "Dark spots")]);
    }

    // Follow-up: only modifiers, reuse the last search
    const onlyModifiers = !free.length && !f.cat && last;
    if (onlyModifiers && f.cheap && !f.max && !last.shown.some((p) => p.price)) {
      return info(T("Bidhaa hizo bado hazina bei kwenye orodha yetu, kwa hiyo siwezi kulinganisha. Duka litakupa bei za leo WhatsApp.",
                    "Those products don't have prices on our list yet, so I can't compare them. The shop will give you today's prices on WhatsApp."),
                  lang, [T("Body oil", "Body oil"), T("Perfume ya 85,000", "Perfume under 100k")], false,
                  T("Habari NALDA, naomba bei za: ", "Hello NALDA, could I get prices for: ") + last.shown.map((p) => `${p.brand} ${p.name}`).join(", "));
    }
    if (onlyModifiers) {
      f.cat = last.cat;
      f.for = f.for || last.for;
      f.origin = f.origin || last.origin;
      free.push(...last.free);
      if (f.cheap && !f.max && last.shown.length) {
        const priced = last.shown.filter((p) => p.price);
        if (priced.length) f.max = Math.min(...priced.map((p) => p.price)) - 1;
      }
    }

    // Score products
    const scored = [];
    for (const x of INDEX) {
      const p = x.p;
      if (f.cat === "face" ? !(p.cat === "face" || p.tags.includes("serum")) : f.cat && p.cat !== f.cat) continue;
      if (f.origin && p.origin !== f.origin) continue;
      if (f.for === "men" && !(p.for === "men" || p.for === "unisex")) continue;
      if (f.for === "women" && !(p.for === "women" || p.for === "unisex")) continue;
      let s = 0;
      const matched = [];
      for (const w of free) {
        if (x.brandToks.includes(w)) { s += 8; matched.push(w); continue; }
        if (x.toks.has(w)) { s += x.nameToks.includes(w) ? 4 : 3; matched.push(w); continue; }
        if (w.length >= 4) {
          const near = [...x.toks].find((v) => v.length >= 4 && lev(w, v) <= (w.length >= 5 ? 2 : 1));
          if (near) { s += x.brandToks.includes(near) ? 7 : 2; matched.push(near); }
        }
      }
      // multi-word tag phrases like "dark spots", "body oil"
      for (const tag of p.tags) if (tag.includes(" ") && text.includes(norm(tag))) s += 4;
      scored.push({ p, s, matched });
    }

    // If the leftover words match nothing but the filters do, trust the filters.
    const hasFilters = f.cat || f.for || f.origin || f.max;
    const anyWordHit = scored.some((r) => r.s > 0);
    const wantsWords = free.length > 0 && (anyWordHit || !hasFilters);
    let hits = scored.filter((r) => (wantsWords ? r.s > 0 : true));
    hits.sort((a, b) => b.s - a.s || (a.p.price ?? 1e12) - (b.p.price ?? 1e12));

    let unpricedNote = 0;
    if (f.max) {
      const within = hits.filter((r) => r.p.price && r.p.price <= f.max);
      unpricedNote = hits.filter((r) => !r.p.price).length;
      hits = within;
    }
    if (f.cheap && !f.max) hits.sort((a, b) => (a.p.price ?? 1e12) - (b.p.price ?? 1e12));

    const shown = hits.slice(0, 4).map((r) => r.p);
    const typo = hits.slice(0, 4).flatMap((r) => r.matched).find((m) => !free.includes(m) && INDEX.some((x) => x.brandToks.includes(m)));
    last = { cat: f.cat, for: f.for, origin: f.origin, free: [...free], shown };

    // Compose the answer
    const what = [];
    if (f.cat) what.push({ perfume: T("manukato", "perfumes"), baby: T("bidhaa za mtoto", "baby products"), oral: T("bidhaa za meno", "oral care"), face: T("bidhaa za uso", "face products") }[f.cat]);
    const ki = f.cat === "perfume" ? "ya" : "za"; // Kiswahili noun-class agreement: manukato ya kike, bidhaa za kike
    if (f.for) what.push(f.for === "men" ? T(`${ki} kiume`, "for men") : T(`${ki} kike`, "for women"));
    if (f.origin) what.push(T(`kutoka ${ORIGIN[f.origin].sw}`, `from ${ORIGIN[f.origin].en}`));
    if (f.max) what.push(T(`chini ya ${money(f.max)}`, `under ${money(f.max)}`));
    const desc = what.join(" ");

    if (!shown.length) {
      const extra = f.max && unpricedNote
        ? T(` Kuna bidhaa ${unpricedNote} ambazo bei yake haijawekwa hapa; uliza WhatsApp.`, ` ${unpricedNote} matching products don't have a price listed here yet; ask on WhatsApp.`)
        : "";
      return {
        lang,
        text: T(`Sijapata ${desc || "bidhaa hiyo"} kwenye orodha yetu, kwa hiyo huenda haipo kwa sasa.${extra} Duka linaweza kukuthibitishia WhatsApp.`,
                `I couldn't find ${desc || "that"} on our list, so it may not be in stock right now.${extra} The shop can confirm on WhatsApp.`),
        products: [],
        waText: T(`Habari NALDA, mnayo: ${raw}?`, `Hello NALDA, do you have: ${raw}?`),
        chips: [T("Perfume ya Paris", "Perfume from Paris"), T("Body oil", "Body oil"), T("Vitu vya mtoto", "Baby products")],
      };
    }

    let lead = shown.length === 1
      ? T(`Nimepata hii${desc ? ` (${desc})` : ""}.`, `Here's what we have${desc ? ` ${desc}` : ""}.`)
      : T(`Nimepata ${shown.length}${desc ? ` ${desc}` : ""}.`, `I found ${shown.length}${desc ? ` ${desc}` : ""}.`);
    if (typo) lead = T(`Nadhani ulimaanisha ${CATALOG.find((p) => norm(p.brand).includes(typo))?.brand}. `, `I think you meant ${CATALOG.find((p) => norm(p.brand).includes(typo))?.brand}. `) + lead;
    if (shown.some((p) => !p.price)) lead += T(" Bei ambazo hazijaandikwa, uliza WhatsApp.", " Where no price is shown, ask on WhatsApp.");
    if (f.max && unpricedNote) lead += T(` Pia kuna ${unpricedNote} zisizo na bei hapa.`, ` ${unpricedNote} more have no price listed here.`);

    const chips = [];
    if (shown.some((p) => p.price)) chips.push(T("Nafuu zaidi", "Cheaper ones"));
    if (f.cat === "perfume" && f.for !== "men") chips.push(T("Ya kiume", "For men"));
    if (!f.origin) chips.push(T("Kutoka Ujerumani", "From Germany"));
    chips.push(T("Mko wapi?", "Where are you?"));

    return { lang, text: lead, products: shown, chips, waText: shown.length === 1 ? orderText(shown[0], lang) : null };
  }

  function info(text, lang, chips = [], map = false, waText = null) {
    return { lang, text, products: [], chips, map, waText };
  }

  return { ask, waLink, orderText };
}
