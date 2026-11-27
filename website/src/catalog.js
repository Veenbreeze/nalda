/*
  NALDA product catalogue: the ONLY list Muulize Nalda knows about.
  The assistant never invents products, so keep this in sync with the shelf.

  Products and photos come from @nalda_usa_products. Prices are only filled
  in where the shop posted them in a caption; everything else is `null`,
  which the site shows as "Uliza bei" (ask for price).

  Fields
    id       unique id, no spaces
    brand    brand name
    name     product name as a customer would say it
    cat      "body" | "face" | "perfume" | "baby" | "oral"
    origin   "US" | "FR" | "DE"
    price    TSh number, or null when unknown
    size     e.g. "118 ml", or "" when unknown
    for      "women" | "men" | "unisex" | "baby"
    img      photo in /public/images, or null
    tags     words customers might search for (English and Kiswahili)
    desc     one or two short sentences
*/
export const SHOP = {
  name: "NALDA USA Products",
  whatsapp: "255747163059",
  phones: ["0747 163 059", "+1 202 743 9424"],
  instagram: "nalda_usa_products",
  instagramBaby: "nalda_usa_baby",
  address: "Mikocheni B, Dar es Salaam",
};

export const ORIGIN = {
  US: { en: "USA", sw: "Marekani" },
  FR: { en: "France", sw: "Ufaransa" },
  DE: { en: "Germany", sw: "Ujerumani" },
};

export const CATALOG = [
  // Body care
  { id: "olay-super-body-oil", brand: "Olay", name: "Super Body Oil", cat: "body", origin: "US", price: 100000, size: "118 ml", for: "unisex", img: "/images/olay-body-oil.jpg",
    tags: ["body oil", "oil", "mafuta", "glow", "mng'ao", "kung'arisha", "shine", "dry", "ukavu", "kavu", "moisture", "unyevu", "jojoba", "squalane", "vitamin e", "collagen"],
    desc: { en: "5-in-1 body oil with jojoba, squalane, collagen peptide and vitamin E. Apply after showering while skin is still damp.",
            sw: "Mafuta ya mwili yenye jojoba, squalane na vitamin E. Yanaongeza unyevu na kuipa ngozi mng'ao. Paka baada ya kuoga." } },
  { id: "olay-repair-body-wash", brand: "Olay", name: "Repair Serum Body Wash", cat: "body", origin: "US", price: null, size: "", for: "unisex", img: "/images/body-care-shelf.jpg",
    tags: ["body wash", "shower gel", "sabuni", "repair", "dry", "kavu", "vitamin b3"],
    desc: { en: "Serum body wash that cleans while it repairs dry skin.", sw: "Sabuni ya kuogea inayosaidia ngozi kavu." } },
  { id: "olay-dark-spot-lotion", brand: "Olay", name: "Dark Spot Correcting Body Lotion", cat: "body", origin: "US", price: null, size: "", for: "unisex", img: "/images/body-care-shelf.jpg",
    tags: ["lotion", "dark spots", "madoa", "even tone", "uneven", "hyperpigmentation", "aha", "vitamin c", "brightening", "kung'arisha"],
    desc: { en: "Body lotion with AHA and vitamin C to fade dark spots and even skin tone.", sw: "Lotion inayopunguza madoa na kusawazisha rangi ya ngozi." } },
  { id: "dove-restore-body-wash", brand: "Dove", name: "Restore Body Wash", cat: "body", origin: "US", price: null, size: "", for: "unisex", img: "/images/body-care-shelf.jpg",
    tags: ["body wash", "shower gel", "sabuni", "coconut", "cocoa butter", "soft skin"],
    desc: { en: "Gentle body wash with coconut and cocoa butter.", sw: "Sabuni laini ya kuogea yenye nazi na cocoa butter." } },
  { id: "vaseline-cocoa-radiant", brand: "Vaseline", name: "Cocoa Radiant Body Gel Oil", cat: "body", origin: "US", price: null, size: "", for: "unisex", img: "/images/body-care-shelf.jpg",
    tags: ["body oil", "gel oil", "cocoa", "glow", "mng'ao", "dry", "kavu"],
    desc: { en: "Lightweight gel oil with cocoa butter for a radiant glow.", sw: "Mafuta mepesi ya cocoa kwa ngozi yenye mng'ao." } },
  { id: "mixa-niacinamide", brand: "Mixa", name: "Niacinamide Bright Body Cream", cat: "body", origin: "FR", price: null, size: "", for: "unisex", img: "/images/body-care-shelf.jpg",
    tags: ["cream", "niacinamide", "bright", "dark spots", "madoa", "even tone", "kung'arisha"],
    desc: { en: "French body cream with niacinamide for brighter, more even skin.", sw: "Cream ya mwili kutoka Ufaransa yenye niacinamide." } },
  { id: "saltair-salt-water-vanilla-wash", brand: "Saltair", name: "Salt Water Vanilla Serum Body Wash", cat: "body", origin: "US", price: null, size: "500 ml", for: "unisex", img: "/images/saltair.jpg",
    tags: ["body wash", "sabuni", "vanilla", "scent", "harufu", "dehydrated", "dry", "kavu"],
    desc: { en: "Serum body wash in the Salt Water Vanilla scent everyone asks about.", sw: "Sabuni ya kuogea yenye harufu ya Salt Water Vanilla." } },
  { id: "saltair-body-butter", brand: "Saltair", name: "Salt Water Vanilla Multi-Lipid Body Butter", cat: "body", origin: "US", price: null, size: "283 g", for: "unisex", img: "/images/saltair.jpg",
    tags: ["body butter", "cream", "dry", "kavu", "vanilla", "moisture", "unyevu"],
    desc: { en: "Rich multi-lipid body butter for dry skin.", sw: "Body butter nzito kwa ngozi kavu." } },
  { id: "saltair-vitamin-c", brand: "Saltair", name: "Vitamin C Body Brightener Serum", cat: "body", origin: "US", price: null, size: "386 ml", for: "unisex", img: "/images/saltair.jpg",
    tags: ["serum", "vitamin c", "bright", "glow", "mng'ao", "kung'arisha", "dark spots", "madoa", "fragrance free"],
    desc: { en: "Fragrance-free vitamin C body serum for a full-body glow.", sw: "Serum ya vitamin C ya mwili mzima kwa mng'ao." } },
  { id: "ogx-coconut-coffee", brand: "OGX", name: "Coconut Coffee Scrub & Wash", cat: "body", origin: "US", price: null, size: "577 ml", for: "unisex", img: "/images/ogx-colgate-vaseline.jpg",
    tags: ["scrub", "exfoliate", "body wash", "sabuni", "coffee", "coconut", "nazi", "smooth"],
    desc: { en: "Smoothing scrub and wash with coconut oil and coffee.", sw: "Scrub ya kuogea yenye nazi na kahawa." } },
  { id: "vaseline-cocoa-jelly", brand: "Vaseline", name: "Cocoa Butter Healing Jelly", cat: "body", origin: "US", price: null, size: "", for: "unisex", img: "/images/ogx-colgate-vaseline.jpg",
    tags: ["jelly", "petroleum", "dry", "kavu", "lips", "midomo", "heels", "cocoa"],
    desc: { en: "Healing jelly with cocoa butter for very dry spots, lips and heels.", sw: "Vaseline ya cocoa kwa sehemu kavu, midomo na visigino." } },
  { id: "balea-vanille-shower", brand: "Balea", name: "Vanille & Kokos Shower Cream", cat: "body", origin: "DE", price: null, size: "", for: "women", img: "/images/balea-vanille.jpg",
    tags: ["shower gel", "body wash", "sabuni", "vanilla", "coconut", "nazi", "vegan"],
    desc: { en: "German vanilla and coconut shower cream.", sw: "Sabuni ya kuogea ya vanilla na nazi kutoka Ujerumani." } },
  { id: "balea-vanille-body-cream", brand: "Balea", name: "Vanille & Kokos Body Cream", cat: "body", origin: "DE", price: null, size: "", for: "women", img: "/images/balea-vanille.jpg",
    tags: ["cream", "body cream", "vanilla", "coconut", "nazi", "dry", "kavu"],
    desc: { en: "Vanilla and coconut body cream for dry skin.", sw: "Cream ya mwili ya vanilla na nazi." } },
  { id: "balea-vanille-deo", brand: "Balea", name: "Vanille & Kokos Deodorant Spray", cat: "body", origin: "DE", price: 30000, size: "", for: "women", img: "/images/balea-vanille.jpg",
    tags: ["deodorant", "deo", "spray", "0% aluminium", "vanilla", "coconut", "jasho", "sweat"],
    desc: { en: "Original German deodorant spray, 0% aluminium.", sw: "Deodorant original kutoka Ujerumani, bila aluminium." } },
  { id: "balea-men-dark-elegance", brand: "Balea Men", name: "Dark Elegance Deodorant & Body Spray", cat: "body", origin: "DE", price: 30000, size: "", for: "men", img: "/images/bedon-balea-men.jpg",
    tags: ["deodorant", "deo", "spray", "men", "wanaume", "jasho", "sweat", "24h"],
    desc: { en: "24-hour German deodorant and body spray for men.", sw: "Deodorant ya wanaume kutoka Ujerumani, saa 24." } },
  { id: "bedon-excellence-love", brand: "Pr. Françoise Bedon", name: "Excellence Love Booster Lightening Lotion", cat: "body", origin: "FR", price: null, size: "500 ml", for: "women", img: "/images/bedon-balea-men.jpg",
    tags: ["lotion", "lightening", "kung'arisha", "bright", "even tone", "madoa", "dark spots", "paris"],
    desc: { en: "Paris lightening body lotion with vegetable oils.", sw: "Lotion ya kung'arisha ngozi kutoka Paris." } },
  { id: "ht26-serum", brand: "HT26 Paris", name: "Multi-Lightening Beauty Serum", cat: "face", origin: "FR", price: null, size: "", for: "women", img: "/images/ht26-serum.jpg",
    tags: ["serum", "lightening", "kung'arisha", "anti-spot", "madoa", "dark spots", "blemish", "chunusi", "even tone"],
    desc: { en: "Anti-spot multi-lightening serum enriched with oils.", sw: "Serum ya kuondoa madoa na kung'arisha ngozi." } },

  // Perfume
  { id: "her-choice-edp", brand: "Her Choice", name: "Eau de Parfum for Women", cat: "perfume", origin: "FR", price: 85000, size: "", for: "women", img: "/images/her-choice.jpg",
    tags: ["perfume", "manukato", "marashi", "fragrance", "scent", "harufu", "women", "wanawake", "kike", "paris", "gift", "zawadi"],
    desc: { en: "Original eau de parfum from Paris. Come in and smell it before you choose.", sw: "Manukato original kutoka Paris. Njoo dukani unuse kabla ya kuchagua." } },
  { id: "armani-my-way", brand: "Giorgio Armani", name: "My Way Eau de Parfum", cat: "perfume", origin: "FR", price: null, size: "", for: "women", img: "/images/her-choice.jpg",
    tags: ["perfume", "manukato", "marashi", "fragrance", "armani", "floral", "women", "wanawake", "kike", "designer", "gift", "zawadi"],
    desc: { en: "Floral designer perfume by Giorgio Armani.", sw: "Manukato ya maua ya Giorgio Armani." } },
  { id: "amouage-love-hibiscus", brand: "Amouage", name: "Love Hibiscus Woman", cat: "perfume", origin: "FR", price: null, size: "", for: "women", img: null,
    tags: ["perfume", "manukato", "marashi", "luxury", "niche", "floral", "women", "kike", "gift", "zawadi"],
    desc: { en: "Luxury niche perfume from Amouage.", sw: "Manukato ya kifahari ya Amouage." } },
  { id: "eos-cotton-candy", brand: "eos", name: "Cotton Candy Body Mist", cat: "perfume", origin: "US", price: null, size: "", for: "women", img: null,
    tags: ["body mist", "mist", "sweet", "fragrance", "harufu", "gift", "zawadi"],
    desc: { en: "Sweet cotton candy body mist.", sw: "Body mist yenye harufu tamu ya cotton candy." } },
  { id: "eos-cozy-comfort", brand: "eos", name: "Cozy Comfort Body Mist", cat: "perfume", origin: "US", price: null, size: "", for: "women", img: null,
    tags: ["body mist", "mist", "warm", "fragrance", "harufu", "gift", "zawadi"],
    desc: { en: "Warm, cosy body mist.", sw: "Body mist yenye harufu ya joto." } },

  // Baby
  { id: "bubchen-bath-shampoo", brand: "Bübchen", name: "Bath & Shampoo (sensitive)", cat: "baby", origin: "DE", price: null, size: "", for: "baby", img: "/images/bubchen.jpg",
    tags: ["baby", "mtoto", "watoto", "newborn", "shampoo", "bath", "sabuni", "sensitive"],
    desc: { en: "Gentle German bath and shampoo for delicate baby skin.", sw: "Sabuni na shampoo laini ya mtoto kutoka Ujerumani." } },
  { id: "bubchen-lotion", brand: "Bübchen", name: "Pflege Baby Lotion (sensitive)", cat: "baby", origin: "DE", price: null, size: "", for: "baby", img: "/images/bubchen.jpg",
    tags: ["baby", "mtoto", "watoto", "lotion", "newborn", "sensitive"],
    desc: { en: "Sensitive baby lotion.", sw: "Lotion laini ya mtoto." } },
  { id: "bubchen-oil", brand: "Bübchen", name: "Baby Oil (sensitive)", cat: "baby", origin: "DE", price: null, size: "", for: "baby", img: "/images/bubchen.jpg",
    tags: ["baby", "mtoto", "watoto", "oil", "mafuta", "massage", "newborn"],
    desc: { en: "Mild baby oil, 0% mineral oil.", sw: "Mafuta ya mtoto, bila mineral oil." } },
  { id: "cetaphil-baby-wash", brand: "Cetaphil", name: "Baby Wash & Shampoo", cat: "baby", origin: "US", price: null, size: "", for: "baby", img: "/images/cetaphil-palmers.jpg",
    tags: ["baby", "mtoto", "watoto", "wash", "shampoo", "sabuni", "newborn"],
    desc: { en: "Tear-free baby wash and shampoo.", sw: "Sabuni na shampoo ya mtoto isiyouma macho." } },
  { id: "cetaphil-baby-lotion", brand: "Cetaphil", name: "Baby Daily Lotion", cat: "baby", origin: "US", price: null, size: "", for: "baby", img: "/images/cetaphil-palmers.jpg",
    tags: ["baby", "mtoto", "watoto", "lotion", "newborn", "dry", "kavu"],
    desc: { en: "Daily baby lotion for soft skin.", sw: "Lotion ya kila siku ya mtoto." } },
  { id: "palmers-baby-oil", brand: "Palmer's", name: "Cocoa Butter Formula Baby Oil", cat: "baby", origin: "US", price: null, size: "", for: "baby", img: "/images/cetaphil-palmers.jpg",
    tags: ["baby", "mtoto", "watoto", "oil", "mafuta", "cocoa butter", "massage"],
    desc: { en: "Cocoa butter baby oil for massage and moisture.", sw: "Mafuta ya mtoto ya cocoa butter." } },

  // Oral care
  { id: "colgate-optic-white-pro", brand: "Colgate", name: "Optic White Pro Series Toothpaste", cat: "oral", origin: "US", price: null, size: "85 g", for: "unisex", img: "/images/colgate.jpg",
    tags: ["toothpaste", "dawa ya meno", "meno", "teeth", "whitening", "white", "stains"],
    desc: { en: "Whitening toothpaste with 5% hydrogen peroxide.", sw: "Dawa ya meno ya kung'arisha meno." } },
  { id: "colgate-kids-brush", brand: "Colgate", name: "Kids Toothbrushes", cat: "oral", origin: "US", price: null, size: "", for: "baby", img: "/images/bubchen.jpg",
    tags: ["toothbrush", "mswaki", "kids", "watoto", "mtoto", "meno"],
    desc: { en: "Soft toothbrushes for children.", sw: "Miswaki laini ya watoto." } },
];

export function waLink(text) {
  return `https://wa.me/${SHOP.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function money(n) {
  return `TSh ${Number(n).toLocaleString("en-US")}`;
}

export function orderText(p, lang = "sw") {
  const price = p.price ? `, ${money(p.price)}` : "";
  const size = p.size ? ` ${p.size}` : "";
  return lang === "en"
    ? `Hello NALDA, I'd like ${p.brand} ${p.name}${size}${price}. Is it available?`
    : `Habari NALDA, naomba ${p.brand} ${p.name}${size}${price}. Ipo?`;
}
