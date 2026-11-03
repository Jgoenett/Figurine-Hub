// FigurineHub shared logic: demo data, cart/wishlist/auth (localStorage), header/footer, and per-page rendering.
// TODO (backend): replace PRODUCTS with fetch('/api/products'), and the store.* helpers with API calls.
const PRODUCTS = [
  { id: 1, category: "Figurines", name: "One Piece Luffy Figurine", price: 2500, rating: "4.8", reviews: 136, stock: 12, theme: "luffy", seller: "Straw Hat Shop" },
  { id: 2, category: "Figurines", name: "Goku Super Saiyan 1/6 figure", price: 3200, rating: "4.9", reviews: 180, stock: 5, theme: "goku", seller: "Saiyan Store" },
  { id: 3, category: "Figurines", name: "Portgas D. Ace 1/8 figure", price: 1800, rating: "4.7", reviews: 96, stock: 20, theme: "ace", seller: "Straw Hat Shop" },
  { id: 4, category: "Figurines", name: "Monkey D. Luffy", price: 2800, rating: "4.9", reviews: 201, stock: 13, theme: "luffy2", seller: "Grand Line Goods" },
  { id: 5, category: "Trading Cards", name: "Pokemon Charizard Holo Card", price: 5900, rating: "4.9", reviews: 132, stock: 11, theme: "cards-red", seller: "Card Vault PH" },
  { id: 6, category: "Trading Cards", name: "Yu-Gi-Oh! Blue Eyes Dragon Card", price: 2800, rating: "4.8", reviews: 156, stock: 2, theme: "cards-blue", seller: "Card Vault PH" },
  { id: 7, category: "Figurines", name: "Uzumaki Naruto Center Figure", price: 1200, rating: "4.5", reviews: 88, stock: 25, theme: "naruto", seller: "Leaf Village Toys" },
  { id: 8, category: "Figurines", name: "Azura Lane Crosswave Limited Edition", price: 4200, rating: "4.7", reviews: 45, stock: 4, theme: "anime", seller: "Moe Collectibles" }
];

const EXTRA = {
  1: { brand: "Bandai", material: "PVC", old: 2800, release: "Mar 2024" }, 2: { brand: "Banpresto", material: "PVC", release: "Jan 2024" },
  3: { brand: "Bandai", material: "PVC & ABS", cond: "Pre-Owned" }, 4: { brand: "Banpresto", material: "PVC", release: "Aug 2023" },
  5: { brand: "Pokémon Co.", material: "Card stock", cond: "Pre-Owned", genre: "Games" }, 6: { brand: "Konami", material: "Card stock" },
  7: { brand: "Bandai", material: "PVC" }, 8: { brand: "Azur Lane", material: "PVC", genre: "Games" }
};
PRODUCTS.forEach(p => Object.assign(p, { genre: "Anime", cond: "New", brand: "Generic", material: "PVC", release: "2024" }, EXTRA[p.id]));
const REVIEWS = [
  { n: "Marco R.", s: 5, t: "Sealed box and clean paint. Arrived in two days.", d: "2 weeks ago" },
  { n: "Anna L.", s: 5, t: "Great detail for the price. The seller replied fast.", d: "1 month ago" },
  { n: "Jiro T.", s: 4, t: "Looks amazing. Small scuff on the packaging only.", d: "2 months ago" }
];
const TABS = {
  description: p => `${p.name} from ${p.seller}. Brand new and securely packed. Replace this with the description uploaded by the seller.`,
  specs: p => `Brand: ${p.brand}. Material: ${p.material}. Condition: ${p.cond}. Release date: ${p.release}.`,
  shipping: () => "Ships within 1–3 business days. Free shipping on orders of ₱1,500 or more with code FREESHIP. All orders include buyer protection."
};
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = n => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(n);
const find = id => PRODUCTS.find(p => p.id === +id);
const params = new URLSearchParams(location.search);

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); updateCounts(); }
};
const cart = () => store.get("fh_cart", []);
const wish = () => store.get("fh_wish", []);
const user = () => store.get("fh_user", null);

let toastTimer, rerender = () => {};
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}
function updateCounts() {
  const set = (id, n) => { const el = $(id); if (el) { el.textContent = n; el.hidden = !n; } };
  set("#cartCount", cart().reduce((s, i) => s + i.qty, 0));
  set("#wishCount", wish().length);
}
function addToCart(id, qty = 1) {
  const p = find(id), c = cart(), line = c.find(i => i.id === p.id);
  if (line) line.qty = Math.min(p.stock, line.qty + qty); else c.push({ id: p.id, qty: Math.min(p.stock, qty) });
  store.set("fh_cart", c); toast(`${p.name} added to cart.`);
}
function toggleWish(id) {
  let w = wish(); const on = !w.includes(id);
  w = on ? [...w, id] : w.filter(x => x !== id);
  store.set("fh_wish", w); return on;
}

function layout() {
  const u = user(), bare = ["login", "register"].includes(document.body.dataset.page);
  if (!bare) document.body.insertAdjacentHTML("afterbegin", `
  <header class="site-header">
    <a class="brand" href="home.html"><span class="brand-mark" aria-hidden="true">▦</span><span>FigurineHub</span></a>
    <form class="search-bar" action="products.html" role="search">
      <input name="q" type="search" value="${esc(params.get("q") || "")}" placeholder="Search figures, cards, brands..." aria-label="Search products">
      <button type="submit" aria-label="Search">⌕</button>
    </form>
    <nav class="desktop-nav" aria-label="Main navigation">
      <a class="nav-icon" href="wishlist.html" aria-label="Wishlist">♡<b class="badge" id="wishCount" hidden></b></a>
      <a class="nav-icon" href="cart.html" aria-label="Cart">♧<b class="badge" id="cartCount" hidden></b></a>
      ${u ? `<span class="hi">Hi, ${esc(u.name)}</span><a href="#" id="logout">Logout</a>`
          : `<a href="login.html">Login</a><a class="signup-link" href="register.html">Signup</a>`}
    </nav>
  </header>`);
  document.body.insertAdjacentHTML("beforeend", `${bare ? "" : `
  <footer class="site-footer"><div class="footer-top"><a class="brand footer-brand" href="home.html"><span class="brand-mark" aria-hidden="true">▦</span><span>FigurineHub</span></a>
  <form class="newsletter" id="newsletterForm"><label for="nlEmail">Get deals in your inbox</label><div class="newsletter-control"><input id="nlEmail" type="email" placeholder="your@email.com" required><button type="submit">GO</button></div><span id="newsletterMessage" class="newsletter-message" aria-live="polite"></span></form></div>
  <p class="footer-tagline">Your premier destination for figurines and trading cards. Collect. Trade. Discover.</p>
  <p class="copyright">© 2026 FigurineHub. All rights reserved.</p></footer>`}<div class="toast" id="toast" role="status" aria-live="polite"></div>`);
  updateCounts();
}

function card(p, heart = false) {
  const on = wish().includes(p.id);
  return `<article class="product-card">
    ${heart ? `<button class="wish-btn" type="button" data-wish="${p.id}" aria-label="Toggle wishlist">${on ? "♥" : "♡"}</button>` : ""}
    <a href="product.html?id=${p.id}" class="product-image image-placeholder theme-${p.theme}" role="img" aria-label="Image of ${esc(p.name)}"><span class="placeholder-label">Product ${String(p.id).padStart(2, "0")}</span></a>
    <p class="product-category">${p.category}</p>
    <h3 class="product-name"><a href="product.html?id=${p.id}">${esc(p.name)}</a></h3>
    <div class="product-rating" aria-label="${p.rating} out of 5 stars">★★★★★ <span>${p.rating} (${p.reviews})</span></div>
    <p class="product-price">${money(p.price)}</p>
    <span class="stock ${p.stock <= 5 ? "low" : ""}">${p.stock} in stock</span>
    <button class="add-to-cart" type="button" data-add="${p.id}">Add to cart</button></article>`;
}
const empty = (msg, href, label) => `<div class="empty-block"><p>${msg}</p><a class="button button-primary" href="${href}">${label}</a></div>`;

const pages = {
  products() {
    const q = (params.get("q") || "").toLowerCase(), st = { cat: params.get("cat") || "All" };
    const cats = ["All", "Figurines", "Trading Cards", "Anime", "Movies & TV", "Games", "Other"];
    $("#cats").innerHTML = cats.map(c => `<button type="button" data-cat="${c}">${c}</button>`).join("");
    const draw = () => {
      const max = +$("#price").value, conds = [...document.querySelectorAll(".cond:checked")].map(x => x.value), stock = $("#instock").checked;
      $("#priceVal").textContent = money(max);
      document.querySelectorAll("#cats button").forEach(b => b.classList.toggle("on", b.dataset.cat === st.cat));
      const list = PRODUCTS.filter(p => (st.cat === "All" || p.category === st.cat || p.genre === st.cat) && p.price <= max && (!conds.length || conds.includes(p.cond)) && (!stock || p.stock > 0) && `${p.name} ${p.category} ${p.seller} ${p.brand}`.toLowerCase().includes(q));
      const by = { low: (a, b) => a.price - b.price, high: (a, b) => b.price - a.price, rated: (a, b) => b.rating - a.rating };
      if (by[$("#sort").value]) list.sort(by[$("#sort").value]);
      $("#grid").innerHTML = list.map(p => card(p)).join("");
      $("#count").textContent = `${list.length} product${list.length === 1 ? "" : "s"} found`;
      $("#empty").hidden = list.length > 0;
    };
    $("#filters").addEventListener("input", draw); $("#sort").onchange = draw;
    $("#cats").addEventListener("click", e => { if (e.target.dataset.cat) { st.cat = e.target.dataset.cat; draw(); } });
    $("#clear").onclick = () => { st.cat = "All"; $("#price").value = 50000; $("#instock").checked = false; document.querySelectorAll(".cond").forEach(c => c.checked = false); $("#sort").value = ""; draw(); };
    document.querySelectorAll(".view").forEach(b => b.onclick = () => {
      $("#grid").classList.toggle("list", b.dataset.view === "list");
      document.querySelectorAll(".view").forEach(x => x.classList.toggle("on", x === b));
    });
    draw();
  },

  product() {
    const p = find(params.get("id")), root = $("#detail");
    if (!p) { root.innerHTML = empty("We couldn’t find that product.", "products.html", "Browse products"); return; }
    document.title = `${p.name} | FigurineHub`;
    const on = wish().includes(p.id), off = p.old ? Math.round((1 - p.price / p.old) * 100) : 0;
    const stars = n => "★".repeat(n) + "☆".repeat(5 - n);
    root.innerHTML = `
      <nav class="crumbs"><a href="home.html">Home</a> / <a href="products.html">Shop</a> / <a href="products.html?cat=${encodeURIComponent(p.category)}">${p.category}</a> / ${esc(p.name)}</nav>
      <div class="detail">
        <div class="detail-image image-placeholder theme-${p.theme}" role="img" aria-label="Image of ${esc(p.name)}"><span class="placeholder-label">Product ${String(p.id).padStart(2, "0")}</span></div>
        <div class="detail-info">
          <div class="pills"><span class="pill">${p.category}</span><span class="pill soft">${p.cond}</span></div>
          <h1>${esc(p.name)}</h1>
          <div class="product-rating big">${stars(5)} <strong>${p.rating}</strong> <a href="#reviews">(${p.reviews} reviews)</a></div>
          <p class="detail-price">${money(p.price)} ${off ? `<s>${money(p.old)}</s><span class="off">${off}% OFF</span>` : ""}</p>
          <p class="in-stock ${p.stock <= 5 ? "low" : ""}">● ${p.stock <= 5 ? "Low stock" : "In stock"} • ${p.stock} units available</p>
          <p class="label">Quantity</p>
          <div class="buy-row"><div class="qty"><button type="button" data-step="-1" aria-label="Decrease">−</button><input id="qty" type="number" min="1" max="${p.stock}" value="1" aria-label="Quantity"><button type="button" data-step="1" aria-label="Increase">+</button></div><span class="muted">Max ${p.stock} units</span></div>
          <div class="buy-row"><button class="button button-primary" type="button" data-add="${p.id}" data-useqty>Add to Cart</button><button class="button button-dark" type="button" data-buynow="${p.id}">Buy Now</button></div>
          <button class="link-wish" type="button" data-wish="${p.id}" data-full>${on ? "♥ In wishlist" : "♡ Add to wishlist"}</button>
          <dl class="specs"><dt>Brand</dt><dd>${p.brand}</dd><dt>Material</dt><dd>${p.material}</dd><dt>Condition</dt><dd>${p.cond}</dd><dt>Release date</dt><dd>${p.release}</dd><dt>Seller</dt><dd>${esc(p.seller)}</dd><dt>Category</dt><dd>${p.category}</dd></dl>
        </div>
      </div>
      <div class="tabs"><button class="on" data-tab="description">Description</button><button data-tab="specs">Specifications</button><button data-tab="shipping">Shipping</button></div>
      <p id="tabPanel" class="tab-panel">${TABS.description(p)}</p>
      <h2 class="sub-title" id="reviews">Customer Reviews</h2>
      <div class="reviews">
        <div class="rating-box"><p class="big-score">${p.rating}</p><p class="stars">${stars(5)}</p><p class="muted">Based on ${p.reviews} reviews</p>
          ${[70, 20, 6, 2, 2].map((w, i) => `<div class="bar-row"><span>${5 - i}</span><div class="bar"><i style="width:${w}%"></i></div></div>`).join("")}</div>
        <div class="review-list">${REVIEWS.map(r => `<article class="review"><span class="avatar">${r.n[0]}</span><div><strong>${r.n}</strong> <span class="stars sm">${stars(r.s)}</span><p>${r.t}</p><span class="muted">${r.d}</span></div></article>`).join("")}
          <button class="button button-ghost" type="button" data-soon>Write a review</button></div>
      </div>
      <h2 class="sub-title">You may also like</h2>
      <div class="product-grid">${PRODUCTS.filter(x => x.id !== p.id && x.category === p.category).slice(0, 4).map(x => card(x)).join("")}</div>`;
  },

  wishlist() {
    rerender = () => {
      const items = wish().map(find).filter(Boolean), root = $("#wishGrid");
      root.className = items.length ? "product-grid" : "";
      root.innerHTML = items.length ? items.map(p => card(p, true)).join("") : empty("Your wishlist is empty. Tap the heart on any product to save it here.", "products.html", "Browse products");
    };
    rerender();
  },

  cart() {
    const promo = items => {
      const code = store.get("fh_promo", ""), sub = items.reduce((s, i) => s + i.price * i.qty, 0);
      let disc = 0, ship = items.length ? 150 : 0, msg = "";
      if (code === "FIGURE10") disc = Math.round(items.filter(i => i.category === "Figurines").reduce((s, i) => s + i.price * i.qty, 0) * .1);
      else if (code === "COLLECT200") sub >= 2000 ? disc = 200 : msg = "COLLECT200 needs ₱2,000 or more.";
      else if (code === "FREESHIP") sub >= 1500 ? ship = 0 : msg = "FREESHIP needs ₱1,500 or more.";
      else if (code) msg = "That promo code isn’t valid.";
      if (code && !msg && !disc && code === "FIGURE10") msg = "FIGURE10 applies to figurines only.";
      return { code, sub, disc, ship, msg, total: sub - disc + ship };
    };
    rerender = () => {
      const items = cart().map(c => ({ ...find(c.id), qty: c.qty })).filter(i => i.id), root = $("#cartRoot");
      if (!items.length) { root.innerHTML = empty("Your cart is empty.", "products.html", "Start shopping"); return; }
      const t = promo(items);
      root.innerHTML = `<div class="cart-layout"><div class="cart-lines">${items.map(i => `
        <article class="cart-line">
          <a class="cart-thumb image-placeholder theme-${i.theme}" href="product.html?id=${i.id}" aria-label="${esc(i.name)}"></a>
          <div class="cart-meta"><p class="product-category">${i.category}</p><h3><a href="product.html?id=${i.id}">${esc(i.name)}</a></h3><p class="muted">Sold by ${esc(i.seller)}</p>
            <button class="link-btn" type="button" data-remove="${i.id}">Remove</button></div>
          <div class="qty"><button type="button" data-qty="${i.id}:-1" aria-label="Decrease">−</button><span>${i.qty}</span><button type="button" data-qty="${i.id}:1" aria-label="Increase">+</button></div>
          <strong class="line-total">${money(i.price * i.qty)}</strong></article>`).join("")}</div>
        <aside class="summary"><h2>Order summary</h2>
          <form id="promoForm" class="promo"><input id="promoInput" value="${esc(t.code)}" placeholder="Promo code" aria-label="Promo code"><button type="submit">Apply</button></form>
          <p class="promo-msg ${t.msg ? "err" : ""}">${t.msg || (t.code ? "Promo applied." : "")}</p>
          <dl><dt>Subtotal</dt><dd>${money(t.sub)}</dd>
          <dt>Discount</dt><dd>−${money(t.disc)}</dd>
          <dt>Shipping</dt><dd>${t.ship ? money(t.ship) : "Free"}</dd></dl>
          <p class="total"><span>Total</span><strong>${money(t.total)}</strong></p>
          <button class="button button-primary wide" type="button" data-checkout>CHECK OUT</button></aside></div>`;
    };
    rerender();
  }
};

document.addEventListener("click", e => {
  const t = e.target.closest("[data-add],[data-wish],[data-qty],[data-remove],[data-step],[data-checkout],[data-tab],[data-buynow],[data-soon],#logout");
  if (!t) return;
  if (t.dataset.add) addToCart(+t.dataset.add, t.hasAttribute("data-useqty") ? Math.max(1, +$("#qty").value || 1) : 1);
  else if (t.dataset.wish) {
    const on = toggleWish(+t.dataset.wish);
    t.textContent = (on ? "♥" : "♡") + (t.hasAttribute("data-full") ? (on ? " In wishlist" : " Add to wishlist") : "");
    toast(on ? "Saved to wishlist." : "Removed from wishlist.");
    if (document.body.dataset.page === "wishlist") rerender();
  } else if (t.dataset.qty) {
    const [id, d] = t.dataset.qty.split(":").map(Number), p = find(id), c = cart(), l = c.find(i => i.id === id);
    l.qty = Math.min(p.stock, Math.max(1, l.qty + d)); store.set("fh_cart", c); rerender();
  } else if (t.dataset.remove) { store.set("fh_cart", cart().filter(i => i.id !== +t.dataset.remove)); rerender(); }
  else if (t.dataset.step) { const q = $("#qty"); q.value = Math.min(+q.max, Math.max(1, (+q.value || 1) + +t.dataset.step)); }
  else if (t.hasAttribute("data-checkout")) { user() ? toast("Checkout will be connected to your backend later.") : location.href = "login.html?next=cart.html"; }
  else if (t.dataset.tab) { document.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("on", b === t)); $("#tabPanel").textContent = TABS[t.dataset.tab](find(params.get("id"))); }
  else if (t.dataset.buynow) { addToCart(+t.dataset.buynow, Math.max(1, +$("#qty").value || 1)); location.href = "cart.html"; }
  else if (t.dataset.soon !== undefined) { e.preventDefault(); toast("This feature is coming soon."); }
  else if (t.id === "logout") { e.preventDefault(); localStorage.removeItem("fh_user"); location.href = "home.html"; }
});

document.addEventListener("submit", e => {
  const f = e.target, v = n => f.elements[n]?.value.trim();
  if (f.id === "newsletterForm") { e.preventDefault(); $("#newsletterMessage").textContent = "Thanks! Newsletter signup is a demo for now."; f.reset(); }
  if (f.id === "promoForm") { e.preventDefault(); store.set("fh_promo", $("#promoInput").value.trim().toUpperCase()); rerender(); }
  // Demo auth only: passwords are stored in plain text in the browser. Replace with real backend auth (hashed passwords, sessions/JWT, roles).
  if (f.id === "registerForm") {
    e.preventDefault(); const err = $("#formError"), users = store.get("fh_users", []);
    if (v("password").length < 8) return err.textContent = "Password must be at least 8 characters.";
    if (v("password") !== v("confirm")) return err.textContent = "Passwords don’t match.";
    if (users.some(u => u.email === v("email").toLowerCase())) return err.textContent = "That email is already registered. Try logging in.";
    const u = { name: v("name"), email: v("email").toLowerCase(), password: v("password"), role: v("role") };
    store.set("fh_users", [...users, u]); store.set("fh_user", { name: u.name, email: u.email, role: u.role }); location.href = "home.html";
  }
  if (f.id === "loginForm") {
    e.preventDefault(); const u = store.get("fh_users", []).find(x => x.email === v("email").toLowerCase() && x.password === v("password"));
    if (!u) return $("#formError").textContent = "Email or password is incorrect.";
    store.set("fh_user", { name: u.name, email: u.email, role: u.role }); location.href = params.get("next") || "home.html";
  }
});

layout();
pages[document.body.dataset.page]?.();
