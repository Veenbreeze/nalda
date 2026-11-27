import { CATALOG, ORIGIN, money, orderText, waLink } from "./catalog.js";
import { createNalda } from "./nalda.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const byId = (id) => CATALOG.find((p) => p.id === id);

/* ---------------- Featured carousel ---------------- */
const FEATURED = ["olay-super-body-oil", "her-choice-edp", "balea-vanille-deo", "saltair-salt-water-vanilla-wash", "ht26-serum", "bubchen-lotion"].map(byId);
const track = $("[data-track]");
track.innerHTML = FEATURED.map((p, i) => `
  <article class="pcard">
    <img src="${p.img}" alt="${esc(p.brand + " " + p.name)}" loading="lazy">
    <div>
      <div class="meta"><span>${esc(ORIGIN[p.origin].en)}</span><span>[ ${String(i + 1).padStart(2, "0")} ]</span></div>
      <h3>${esc(p.brand)}</h3>
      <span class="price br">${p.price ? money(p.price) : "Uliza bei"}</span>
      <p>${esc(p.name)}. ${esc(p.desc.en)}</p>
      <a class="br wa" href="${waLink(orderText(p))}" target="_blank" rel="noopener">Agiza kwa WhatsApp</a>
    </div>
  </article>`).join("");

let slide = 0;
const prev = $("[data-prev]"), next = $("[data-next]");
function visibleCards() { return window.innerWidth <= 760 ? 1 : 2; }
function renderCarousel() {
  const max = Math.max(0, FEATURED.length - visibleCards());
  slide = Math.min(slide, max);
  const card = track.children[0];
  const step = card ? card.getBoundingClientRect().width + 14 : 0;
  track.style.transform = `translateX(${-slide * step}px)`;
  prev.disabled = slide === 0;
  next.disabled = slide === max;
}
prev.addEventListener("click", () => { slide--; renderCarousel(); });
next.addEventListener("click", () => { slide++; renderCarousel(); });
window.addEventListener("resize", renderCarousel);
renderCarousel();

/* ---------------- Pink stack ---------------- */
const STACK = [
  ["olay-super-body-oil", "-4deg"], ["her-choice-edp", "3deg"], ["bubchen-bath-shampoo", "-2deg"],
  ["cetaphil-baby-wash", "5deg"], ["bedon-excellence-love", "-3deg"],
];
$("[data-stack]").innerHTML = STACK.map(([id, r], i) => {
  const p = byId(id);
  const from = i * 18, to = from + 18;
  return `<figure class="card-up" style="--r:${r};--y:${i * 16}px;animation-range:contain ${from}% contain ${to}%">
    <img src="${p.img}" alt="${esc(p.brand + " " + p.name)}" loading="lazy">
    <figcaption><span>${esc(p.brand)}</span><span>${esc(ORIGIN[p.origin].en)}</span></figcaption>
  </figure>`;
}).join("");

/* ---------------- Crown launcher ---------------- */
const dock = $("[data-dock]");
const orb = $("[data-orb]");
const items = $$(".dock-item", dock);
const ripple = $("[data-ripple]");
let closeTimer, scrollTimer, openedAt = 0;

function setDock(mode) {
  dock.classList.toggle("open", mode === "open");
  dock.classList.toggle("away", mode === "away");
  const open = mode === "open";
  orb.setAttribute("aria-expanded", String(open));
  orb.setAttribute("aria-label", open ? "Funga chaguo" : "Fungua: Muulize Nalda, WhatsApp, Instagram");
  items.forEach((el) => (el.tabIndex = open ? 0 : -1));
}
function openDock(ms = 4200) {
  clearTimeout(closeTimer); clearTimeout(scrollTimer);
  dock.classList.add("touched");
  if (!dock.classList.contains("open")) openedAt = Date.now();
  setDock("open");
  closeTimer = setTimeout(() => setDock("peek"), ms);
}
orb.addEventListener("click", () => {
  // A click right after hover opened it means "I want it open", not "close it".
  if (dock.classList.contains("open") && Date.now() - openedAt > 500) { clearTimeout(closeTimer); setDock("peek"); }
  else openDock();
});
dock.addEventListener("mouseenter", () => openDock());
dock.addEventListener("mouseleave", () => { clearTimeout(closeTimer); closeTimer = setTimeout(() => setDock("peek"), 1400); });
dock.addEventListener("focusin", () => openDock(8000));

window.addEventListener("pointerdown", (e) => {
  if (document.body.classList.contains("nalda-open")) return;
  ripple.style.left = `${e.clientX}px`;
  ripple.style.top = `${e.clientY}px`;
  ripple.classList.remove("go"); void ripple.offsetWidth; ripple.classList.add("go");
  if (!e.target.closest("[data-orb]")) openDock();
}, { passive: true });

window.addEventListener("scroll", () => {
  if (!dock.classList.contains("away")) setDock("away");
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => { if (dock.classList.contains("away")) setDock("peek"); }, 650);
}, { passive: true });

/* ---------------- Muulize Nalda drawer ---------------- */
const nalda = createNalda();
const drawer = $(".nalda");
const msgs = $("[data-msgs]");
const input = $("#nalda-input");
let lastFocus = null;

function openNalda(question) {
  lastFocus = document.activeElement;
  document.body.classList.add("nalda-open");
  drawer.setAttribute("aria-hidden", "false");
  setDock("peek");
  if (!msgs.children.length) botSay(nalda.ask("habari"));
  if (question) askNalda(question);
  setTimeout(() => input.focus(), 350);
}
function closeNalda() {
  document.body.classList.remove("nalda-open");
  drawer.setAttribute("aria-hidden", "true");
  if (lastFocus) lastFocus.focus();
}
$$("[data-open-nalda]").forEach((b) => b.addEventListener("click", () => openNalda()));
$$("[data-close-nalda]").forEach((b) => b.addEventListener("click", closeNalda));
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.body.classList.contains("nalda-open")) closeNalda(); });

function meSay(text) {
  msgs.insertAdjacentHTML("beforeend", `<div class="msg me"><span class="who">${"Wewe"}</span><p>${esc(text)}</p></div>`);
}
function botSay(r) {
  const T = (sw, en) => (r.lang === "sw" ? sw : en);
  const cards = r.products.map((p) => `
    <article class="result">
      ${p.img ? `<img src="${p.img}" alt="${esc(p.brand + " " + p.name)}">` : `<div class="noimg">${esc(p.brand)}</div>`}
      <div class="r">
        <span class="o">[ ${esc(r.lang === "sw" ? ORIGIN[p.origin].sw : ORIGIN[p.origin].en)} ]</span>
        <h3>${esc(p.name)}</h3>
        <span class="d">${esc(p.brand)}${p.size ? `, ${esc(p.size)}` : ""}. ${esc(p.desc[r.lang] || p.desc.en)}</span>
        <span class="p ${p.price ? "" : "ask"}">${p.price ? money(p.price) : T("Uliza bei", "Ask price")}</span>
        <a href="${waLink(orderText(p, r.lang))}" target="_blank" rel="noopener"><span style="color:var(--wa)">[</span>&nbsp;${T("Agiza WhatsApp", "Order on WhatsApp")}&nbsp;<span style="color:var(--wa)">]</span></a>
      </div>
    </article>`).join("");
  const extra = [];
  if (r.map) extra.push(`<a class="br" href="https://www.google.com/maps/search/?api=1&query=Mikocheni+B,+Dar+es+Salaam" target="_blank" rel="noopener">${T("Fungua ramani", "Open map")}</a>`);
  if (r.waText && !r.products.length) extra.push(`<a class="br wa" href="${waLink(r.waText)}" target="_blank" rel="noopener">${T("Uliza duka WhatsApp", "Ask the shop on WhatsApp")}</a>`);
  const chips = (r.chips || []).map((c) => `<button type="button" data-chip="${esc(c)}">[ ${esc(c)} ]</button>`).join("");
  msgs.insertAdjacentHTML("beforeend", `
    <div class="msg bot"><span class="who">Nalda</span><p>${esc(r.text)}</p></div>
    ${cards}
    ${extra.length ? `<div class="sugg">${extra.join("")}</div>` : ""}
    ${chips ? `<div class="sugg">${chips}</div>` : ""}`);
  msgs.scrollTop = msgs.scrollHeight;
}
function askNalda(q) {
  q = q.trim();
  if (!q) return;
  meSay(q);
  botSay(nalda.ask(q));
}
msgs.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-chip]");
  if (chip) askNalda(chip.dataset.chip);
});
$("[data-nalda-form]").addEventListener("submit", (e) => {
  e.preventDefault();
  askNalda(input.value);
  input.value = "";
});

// Big inline question line in the dark section
const bigForm = $("[data-ask-form]");
bigForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const v = $("#ask-big").value || $("#ask-big").placeholder;
  openNalda(v);
  $("#ask-big").value = "";
});
$$("[data-ask]").forEach((b) => b.addEventListener("click", () => openNalda(b.dataset.ask)));
