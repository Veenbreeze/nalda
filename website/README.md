# NALDA USA Products: landing website

The public landing page for NALDA USA Products (Mikocheni B, Dar es Salaam).
It lives in its own folder so it doesn't touch the CRM in `backend/` and `frontend/`.

## Run it

```bash
cd website
npm install
npm run dev        # http://localhost:5173
npm run build      # static files in website/dist
npm run preview    # serve the built site
```

`dist/` is plain static HTML, CSS and JS, so it can be hosted anywhere (Vercel, Netlify, cPanel, S3).

## What's in it

| File | What it does |
|---|---|
| `index.html` | All page sections and content |
| `src/styles.css` | Layout, scroll-driven effects, crown launcher, assistant drawer |
| `src/main.js` | Carousel, photo stack, crown launcher, assistant drawer |
| `src/nalda.js` | **Muulize Nalda**, the product assistant (Kiswahili + English) |
| `src/catalog.js` | The product list Nalda answers from, plus shop contact details |
| `public/images/` | Product photos from @nalda_usa_products |

## Muulize Nalda (the AI assistant)

Runs fully in the browser, with no API key and no server. It reads `src/catalog.js` and
understands budgets ("chini ya 100k", "under 50,000"), skin concerns ("madoa", "dark spots"),
who a product is for, where it comes from, follow-ups ("cheaper ones") and typos ("olai" → Olay).
It never recommends anything that isn't in the catalogue, and never invents a price:
products with `price: null` show **Uliza bei** and link to WhatsApp.

Every result has an **Agiza WhatsApp** button that opens WhatsApp with the product
and price already written.

## Keeping products up to date

Edit `src/catalog.js`. Add a product by copying an existing entry. Set `price` to a number
in TSh when the shop confirms it, or leave it `null`. Put new photos in `public/images/`.

Later this can read straight from the CRM's `Product` table (it already has `name`, `brand`,
`sellingPrice`, `imageUrl`, `stockQuantity`) through a small public endpoint, so the website
and the CRM share one product list.

## Scroll effects

Built with CSS scroll-driven animations (`animation-timeline`). They run in Chrome and Edge.
Safari, Firefox and visitors with "reduce motion" switched on get a still, fully readable layout.

## Still to confirm with the shop

- Opening hours (currently "Jumatatu–Jumamosi. Jumapili tumefunga.")
- Prices for products marked `price: null`
