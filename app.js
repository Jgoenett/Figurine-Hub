// FigurineHub shared logic, backed by Supabase (auth, database, RLS). Cart and promo code stay in localStorage until checkout.
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const PRODUCTS = [];
let ME = null, WISH = [], toastTimer, rerender = () => {};

const GENRES = ["Anime", "Movies & TV", "Games", "Other"];
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = n => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(n);
const find = id => PRODUCTS.find(p => p.id === +id);
const params = new URLSearchParams(location.search);
const stars = n => "★".repeat(n) + "☆".repeat(5 - n);
const thisPage = () => encodeURIComponent(location.pathname.split("/").pop() + location.search);
const artStyle = p => p.img ? ` style="background:url('${esc(p.img)}') center/cover no-repeat"` : "";

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); updateCounts(); }
};
const cart = () => store.get("fh_cart", []);
const wish = () => WISH;
const user = () => ME;

// ---------- data loading ----------
const mapProduct = r => {
  const rs = r.reviews || [];
  return { id: r.id, category: r.category, genre: r.genre, name: r.name, description: r.description, price: +r.price, old: +r.old_price || 0, stock: r.stock,
    cond: r.item_condition, brand: r.brand || "Generic", material: r.material || "PVC", img: r.image_url, release: new Date(r.created_at).getFullYear(),
    rating: rs.length ? (rs.reduce((s, x) => s + x.rating, 0) / rs.length).toFixed(1) : "0.0", reviews: rs.length,
    seller: r.profiles?.name || "Seller", sellerId: r.seller_id };
};
async function loadProducts() {
  const { data, error } = await sb.from("products").select("*, profiles!seller_id(name), reviews(rating)").order("created_at", { ascending: false });
  if (error) { console.error(error); toast("Couldn’t load products. Check supabase-config.js."); return; }
  PRODUCTS.push(...data.map(mapProduct));
}
async function loadSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const { data: p } = await sb.from("profiles").select("*").eq("id", session.user.id).single();
  if (!p || p.banned) { await sb.auth.signOut(); return; }
  ME = { id: p.id, name: p.name, email: session.user.email, role: p.role, approved: p.approved, avatar: p.avatar_url, cover: p.cover_url, bio: p.bio };
  const { data: w } = await sb.from("wishlist").select("product_id").eq("user_id", ME.id);
  WISH = (w || []).map(x => x.product_id);
}

// ---------- helpers ----------
function toast(msg) {
  const t = $("#toast"); if (!t) return; t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}
function updateCounts() {
  const set = (id, n) => { const el = $(id); if (el) { el.textContent = n; el.hidden = !n; } };
  set("#cartCount", cart().reduce((s, i) => s + i.qty, 0)); set("#wishCount", WISH.length);
}
function addToCart(id, qty = 1) {
  const p = find(id), c = cart(), line = c.find(i => i.id === p.id);
  if (line) line.qty = Math.min(p.stock, line.qty + qty); else c.push({ id: p.id, qty: Math.min(p.stock, qty) });
  store.set("fh_cart", c); toast(`${p.name} added to cart.`);
}
async function toggleWish(id) {
  if (!ME) { location.href = `login.html?next=${thisPage()}`; return null; }
  const on = !WISH.includes(id);
  const { error } = on ? await sb.from("wishlist").insert({ user_id: ME.id, product_id: id })
                       : await sb.from("wishlist").delete().eq("user_id", ME.id).eq("product_id", id);
  if (error) { toast("Couldn’t update your wishlist."); return null; }
  WISH = on ? [...WISH, id] : WISH.filter(x => x !== id); updateCounts(); return on;
}

function layout() {
  const u = ME, bare = ["login", "register"].includes(document.body.dataset.page);
  if (!bare) document.body.insertAdjacentHTML("afterbegin", `
  <header class="site-header">
    <a class="brand" href="index.html"><img src="images/cat2.png" alt="" class="brand-logo"><span>FigurineHub</span></a>
    <form class="search-bar" action="products.html" role="search">
      <input name="q" type="search" value="${esc(params.get("q") || "")}" placeholder="Search figures, cards, brands..." aria-label="Search products">
      <button type="submit" aria-label="Search">⌕</button>
    </form>
    <nav class="desktop-nav" aria-label="Main navigation">
      <a class="nav-icon" href="wishlist.html" aria-label="Wishlist">♡<b class="badge" id="wishCount" hidden></b></a>
      <a class="nav-icon" href="cart.html" aria-label="Cart">♧<b class="badge" id="cartCount" hidden></b></a>
      ${u ? `${u.role === "seller" ? '<a href="seller.html">Seller</a>' : ""}${u.role === "admin" ? '<a href="admin.html">Admin</a>' : ""}<a href="orders.html">Orders</a><a class="hi" href="profile.html">${u.avatar ? `<img class="nav-avatar" src="${esc(u.avatar)}" alt="">` : ""}Hi, ${esc(u.name)}</a><a href="#" id="logout">Logout</a>`
          : `<a href="login.html">Login</a><a class="signup-link" href="register.html">Signup</a>`}
    </nav>
  </header>`);
  document.body.insertAdjacentHTML("beforeend", `${bare ? "" : `
  <footer class="site-footer"><div class="footer-top"><a class="brand footer-brand" href="index.html"><img src="images/cat2.png" alt="" class="brand-logo"><span>FigurineHub</span></a>
  <form class="newsletter" id="newsletterForm"><label for="nlEmail">Get deals in your inbox</label><div class="newsletter-control"><input id="nlEmail" type="email" placeholder="your@email.com" required><button type="submit">GO</button></div><span id="newsletterMessage" class="newsletter-message" aria-live="polite"></span></form></div>
  <p class="footer-tagline">Your premier destination for figurines and trading cards. Collect. Trade. Discover.</p>
  <p class="copyright">© 2026 FigurineHub. All rights reserved.</p></footer>`}<div class="toast" id="toast" role="status" aria-live="polite"></div>`);
  if (SUPABASE_URL.includes("YOUR-PROJECT")) document.body.insertAdjacentHTML("afterbegin", '<p class="config-warn">Add your Supabase URL and anon key in supabase-config.js</p>');
  updateCounts();
}

function card(p, heart = false) {
  const on = WISH.includes(p.id);
  return `<article class="product-card">
    ${heart ? `<button class="wish-btn" type="button" data-wish="${p.id}" aria-label="Toggle wishlist">${on ? "♥" : "♡"}</button>` : ""}
    <a href="product.html?id=${p.id}" class="product-image image-placeholder no-photo"${artStyle(p)} role="img" aria-label="Image of ${esc(p.name)}">${p.img ? "" : '<span class="placeholder-label">No photo</span>'}</a>
    <p class="product-category">${p.category}</p>
    <h3 class="product-name"><a href="product.html?id=${p.id}">${esc(p.name)}</a></h3>
    <div class="product-rating" aria-label="${p.rating} out of 5 stars">${stars(Math.round(p.rating))} <span>${p.rating} (${p.reviews})</span></div>
    <p class="product-price">${money(p.price)}</p>
    <span class="stock ${p.stock <= 5 ? "low" : ""}">${p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}</span>
    <button class="add-to-cart" type="button" data-add="${p.id}" ${p.stock < 1 ? "disabled" : ""}>Add to cart</button></article>`;
}
const empty = (msg, href, label) => `<div class="empty-block"><p>${msg}</p><a class="button button-primary" href="${href}">${label}</a></div>`;

// Display-only estimate. The real totals are recalculated in the database by place_order().
const promoCalc = items => {
  const code = store.get("fh_promo", ""), sub = items.reduce((s, i) => s + i.price * i.qty, 0);
  let disc = 0, ship = items.length ? 150 : 0, msg = "";
  if (code === "FIGURE10") { disc = Math.round(items.filter(i => i.category === "Figurines").reduce((s, i) => s + i.price * i.qty, 0) * .1); if (!disc) msg = "FIGURE10 applies to figurines only."; }
  else if (code === "COLLECT200") sub >= 2000 ? disc = 200 : msg = "COLLECT200 needs ₱2,000 or more.";
  else if (code === "FREESHIP") sub >= 1500 ? ship = 0 : msg = "FREESHIP needs ₱1,500 or more.";
  else if (code) msg = "That promo code isn’t valid.";
  return { code, sub, disc, ship, msg, total: sub - disc + ship };
};
const TABS = {
  description: p => p.description || `${p.name} sold by ${p.seller}.`,
  specs: p => `Brand: ${p.brand}. Material: ${p.material}. Condition: ${p.cond}. Released/listed: ${p.release}.`,
  shipping: () => "Ships within 1–3 business days. Free shipping on orders of ₱1,500 or more with code FREESHIP. All orders include buyer protection."
};

const pages = {
  products() {
    const q = (params.get("q") || "").toLowerCase(), st = { cat: params.get("cat") || "All", genre: "All" };
    $("#types").innerHTML = ["All", "Figurines", "Trading Cards"].map(c => `<button type="button" data-cat="${c}">${c}</button>`).join("");
    $("#genres").innerHTML = ["All", ...GENRES].map(c => `<button type="button" data-genre="${c}">${c}</button>`).join("");
    const draw = () => {
      const max = +$("#price").value, conds = [...document.querySelectorAll(".cond:checked")].map(x => x.value), stock = $("#instock").checked;
      $("#priceVal").textContent = money(max);
      document.querySelectorAll("#types button").forEach(b => b.classList.toggle("on", b.dataset.cat === st.cat));
      document.querySelectorAll("#genres button").forEach(b => b.classList.toggle("on", b.dataset.genre === st.genre));
      const list = PRODUCTS.filter(p => (st.cat === "All" || p.category === st.cat) && (st.genre === "All" || p.genre === st.genre) && p.price <= max && (!conds.length || conds.includes(p.cond)) && (!stock || p.stock > 0) && `${p.name} ${p.category} ${p.genre} ${p.seller} ${p.brand}`.toLowerCase().includes(q));
      const by = { low: (a, b) => a.price - b.price, high: (a, b) => b.price - a.price, rated: (a, b) => b.rating - a.rating, popular: (a, b) => b.reviews - a.reviews };
      if (by[$("#sort").value]) list.sort(by[$("#sort").value]);
      $("#grid").innerHTML = list.map(p => card(p)).join("");
      $("#count").textContent = `${list.length} product${list.length === 1 ? "" : "s"} found`;
      $("#empty").hidden = list.length > 0;
    };
    $("#filters").addEventListener("input", draw); $("#sort").onchange = draw;
    $("#filters").addEventListener("click", e => { const b = e.target.closest("button"); if (b?.dataset.cat) st.cat = b.dataset.cat; else if (b?.dataset.genre) st.genre = b.dataset.genre; else return; draw(); });
    $("#clear").onclick = () => { st.cat = "All"; st.genre = "All"; $("#price").value = 50000; $("#instock").checked = false; document.querySelectorAll(".cond").forEach(c => c.checked = false); $("#sort").value = ""; draw(); };
    document.querySelectorAll(".view").forEach(b => b.onclick = () => { $("#grid").classList.toggle("list", b.dataset.view === "list"); document.querySelectorAll(".view").forEach(x => x.classList.toggle("on", x === b)); });
    draw();
  },

  async product() {
    const p = find(params.get("id")), root = $("#detail");
    if (!p) { root.innerHTML = empty("We couldn’t find that product.", "products.html", "Browse products"); return; }
    document.title = `${p.name} | FigurineHub`;
    const { data } = await sb.from("reviews").select("rating, comment, created_at, profiles(name)").eq("product_id", p.id).order("created_at", { ascending: false });
    const revs = data || [], on = WISH.includes(p.id), off = p.old > p.price ? Math.round((1 - p.price / p.old) * 100) : 0;
    root.innerHTML = `
      <nav class="crumbs"><a href="index.html">Home</a> / <a href="products.html">Shop</a> / <a href="products.html?cat=${encodeURIComponent(p.category)}">${p.category}</a> / ${esc(p.name)}</nav>
      <div class="detail">
        <div class="detail-image image-placeholder no-photo"${artStyle(p)} role="img" aria-label="Image of ${esc(p.name)}"></div>
        <div class="detail-info">
          <div class="pills"><span class="pill">${p.category}</span><span class="pill">${p.genre}</span><span class="pill soft">${p.cond}</span></div>
          <h1>${esc(p.name)}</h1>
          <div class="product-rating big">${stars(Math.round(p.rating))} <strong>${p.rating}</strong> <a href="#reviews">(${p.reviews} reviews)</a></div>
          <p class="detail-price">${money(p.price)} ${off ? `<s>${money(p.old)}</s><span class="off">${off}% OFF</span>` : ""}</p>
          <p class="in-stock ${p.stock <= 5 ? "low" : ""}">● ${p.stock < 1 ? "Out of stock" : p.stock <= 5 ? "Low stock" : "In stock"} • ${p.stock} units available</p>
          <p class="label">Quantity</p>
          <div class="buy-row"><div class="qty"><button type="button" data-step="-1" aria-label="Decrease">−</button><input id="qty" type="number" min="1" max="${Math.max(1, p.stock)}" value="1" aria-label="Quantity"><button type="button" data-step="1" aria-label="Increase">+</button></div><span class="muted">Max ${p.stock} units</span></div>
          <div class="buy-row"><button class="button button-primary" type="button" data-add="${p.id}" data-useqty ${p.stock < 1 ? "disabled" : ""}>Add to Cart</button><button class="button button-dark" type="button" data-buynow="${p.id}" ${p.stock < 1 ? "disabled" : ""}>Buy Now</button></div>
          <button class="link-wish" type="button" data-wish="${p.id}" data-full>${on ? "♥ In wishlist" : "♡ Add to wishlist"}</button>
          <dl class="specs"><dt>Brand</dt><dd>${esc(p.brand)}</dd><dt>Material</dt><dd>${esc(p.material)}</dd><dt>Condition</dt><dd>${p.cond}</dd><dt>Listed</dt><dd>${p.release}</dd><dt>Seller</dt><dd><a class="seller-link" href="shop.html?id=${p.sellerId}">${esc(p.seller)}</a></dd><dt>Type</dt><dd>${p.category}</dd><dt>Genre</dt><dd>${p.genre}</dd></dl>
        </div>
      </div>
      <div class="tabs"><button class="on" data-tab="description">Description</button><button data-tab="specs">Specifications</button><button data-tab="shipping">Shipping</button></div>
      <p id="tabPanel" class="tab-panel"></p>
      <h2 class="sub-title" id="reviews">Customer Reviews</h2>
      <div class="reviews">
        <div class="rating-box"><p class="big-score">${p.rating}</p><p class="stars">${stars(Math.round(p.rating))}</p><p class="muted">Based on ${revs.length} review${revs.length === 1 ? "" : "s"}</p>
          ${[5, 4, 3, 2, 1].map(n => `<div class="bar-row"><span>${n}</span><div class="bar"><i style="width:${revs.length ? revs.filter(r => r.rating === n).length / revs.length * 100 : 0}%"></i></div></div>`).join("")}</div>
        <div class="review-list">${revs.map(r => `<article class="review"><span class="avatar">${esc((r.profiles?.name || "?")[0])}</span><div><strong>${esc(r.profiles?.name || "Buyer")}</strong> <span class="stars sm">${stars(r.rating)}</span><p>${esc(r.comment)}</p><span class="muted">${new Date(r.created_at).toLocaleDateString("en-PH")}</span></div></article>`).join("") || '<p class="muted">No reviews yet. Be the first!</p>'}
          ${ME ? `<form id="reviewForm" class="panel" data-pid="${p.id}"><h2>Write a review</h2><label class="field"><span>Rating</span><select name="rating">${[5, 4, 3, 2, 1].map(n => `<option value="${n}">${n} ★</option>`).join("")}</select></label><label class="field"><span>Comment</span><textarea name="comment" rows="3" maxlength="600"></textarea></label><button class="button button-primary" type="submit">Submit review</button></form>`
                 : `<p class="muted"><a href="login.html?next=${thisPage()}">Log in</a> to write a review.</p>`}</div>
      </div>
      <h2 class="sub-title">You may also like</h2>
      <div class="product-grid">${PRODUCTS.filter(x => x.id !== p.id && x.category === p.category).slice(0, 4).map(x => card(x)).join("")}</div>`;
    $("#tabPanel").textContent = TABS.description(p);
  },

  wishlist() {
    rerender = () => {
      const items = WISH.map(find).filter(Boolean), root = $("#wishGrid");
      if (!ME) { root.innerHTML = empty("Log in to see your wishlist.", `login.html?next=${thisPage()}`, "Log in"); return; }
      root.className = items.length ? "product-grid" : "";
      root.innerHTML = items.length ? items.map(p => card(p, true)).join("") : empty("Your wishlist is empty. Open a product and tap “Add to wishlist”.", "products.html", "Browse products");
    };
    rerender();
  },

  cart() {
    rerender = () => {
      const items = cart().map(c => ({ ...find(c.id), qty: c.qty })).filter(i => i.id), root = $("#cartRoot");
      if (!items.length) { root.innerHTML = empty("Your cart is empty.", "products.html", "Start shopping"); return; }
      const t = promoCalc(items);
      root.innerHTML = `<div class="cart-layout"><div class="cart-lines">${items.map(i => `
        <article class="cart-line">
          <a class="cart-thumb image-placeholder no-photo"${artStyle(i)} href="product.html?id=${i.id}" aria-label="${esc(i.name)}"></a>
          <div class="cart-meta"><p class="product-category">${i.category}</p><h3><a href="product.html?id=${i.id}">${esc(i.name)}</a></h3><p class="muted">Sold by ${esc(i.seller)}</p>
            <button class="link-btn" type="button" data-remove="${i.id}">Remove</button></div>
          <div class="qty"><button type="button" data-qty="${i.id}:-1" aria-label="Decrease">−</button><span>${i.qty}</span><button type="button" data-qty="${i.id}:1" aria-label="Increase">+</button></div>
          <strong class="line-total">${money(i.price * i.qty)}</strong></article>`).join("")}</div>
        <aside class="summary"><h2>Order summary</h2>
          <form id="promoForm" class="promo"><input id="promoInput" value="${esc(t.code)}" placeholder="Promo code" aria-label="Promo code"><button type="submit">Apply</button></form>
          <p class="promo-msg ${t.msg ? "err" : ""}">${t.msg || (t.code ? "Promo applied." : "")}</p>
          <dl><dt>Subtotal</dt><dd>${money(t.sub)}</dd><dt>Discount</dt><dd>−${money(t.disc)}</dd><dt>Shipping</dt><dd>${t.ship ? money(t.ship) : "Free"}</dd></dl>
          <p class="total"><span>Total</span><strong>${money(t.total)}</strong></p>
          <button class="button button-primary wide" type="button" data-checkout>CHECK OUT</button></aside></div>`;
    };
    rerender();
  }
};

document.addEventListener("click", async e => {
  const t = e.target.closest("[data-add],[data-wish],[data-qty],[data-remove],[data-step],[data-checkout],[data-tab],[data-buynow],[data-soon],#logout");
  if (!t) return;
  if (t.dataset.add) addToCart(+t.dataset.add, t.hasAttribute("data-useqty") ? Math.max(1, +$("#qty").value || 1) : 1);
  else if (t.dataset.wish) {
    const on = await toggleWish(+t.dataset.wish); if (on === null) return;
    t.textContent = (on ? "♥" : "♡") + (t.hasAttribute("data-full") ? (on ? " In wishlist" : " Add to wishlist") : "");
    toast(on ? "Saved to wishlist." : "Removed from wishlist.");
    if (document.body.dataset.page === "wishlist") rerender();
  } else if (t.dataset.qty) {
    const [id, d] = t.dataset.qty.split(":").map(Number), p = find(id), c = cart(), l = c.find(i => i.id === id);
    l.qty = Math.min(p.stock, Math.max(1, l.qty + d)); store.set("fh_cart", c); rerender();
  } else if (t.dataset.remove) { store.set("fh_cart", cart().filter(i => i.id !== +t.dataset.remove)); rerender(); }
  else if (t.dataset.step) { const q = $("#qty"); q.value = Math.min(+q.max, Math.max(1, (+q.value || 1) + +t.dataset.step)); }
  else if (t.hasAttribute("data-checkout")) location.href = ME ? "checkout.html" : "login.html?next=checkout.html";
  else if (t.dataset.tab) { document.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("on", b === t)); $("#tabPanel").textContent = TABS[t.dataset.tab](find(params.get("id"))); }
  else if (t.dataset.buynow) { addToCart(+t.dataset.buynow, Math.max(1, +$("#qty").value || 1)); location.href = "cart.html"; }
  else if (t.dataset.soon !== undefined) { e.preventDefault(); toast("This feature is coming soon."); }
  else if (t.id === "logout") { e.preventDefault(); await sb.auth.signOut(); location.href = "index.html"; }
});

document.addEventListener("submit", async e => {
  const f = e.target, v = n => f.elements[n]?.value.trim(), err = $("#formError"), fid = f.getAttribute("id");
  if (fid === "newsletterForm") { e.preventDefault(); $("#newsletterMessage").textContent = "Thanks! Newsletter signup is a demo for now."; f.reset(); }
  if (fid === "promoForm") { e.preventDefault(); store.set("fh_promo", $("#promoInput").value.trim().toUpperCase()); rerender(); }
  if (fid === "reviewForm") {
    e.preventDefault();
    const { error } = await sb.from("reviews").upsert({ product_id: +f.dataset.pid, user_id: ME.id, rating: +v("rating"), comment: v("comment") }, { onConflict: "product_id,user_id" });
    if (error) return toast(error.message); location.reload();
  }
  if (fid === "registerForm") {
    e.preventDefault(); err.classList.remove("ok");
    if (v("password").length < 8) return err.textContent = "Password must be at least 8 characters.";
    if (v("password") !== v("confirm")) return err.textContent = "Passwords don’t match.";
    err.textContent = "Creating your account…";
    const { data, error } = await sb.auth.signUp({ email: v("email"), password: v("password"), options: { data: { name: v("name"), role: v("role") } } });
    if (error) return err.textContent = error.message;
    if (!data.session) { err.classList.add("ok"); return err.textContent = "Almost done! Check your email to confirm your account, then log in."; }
    location.href = "index.html";
  }
  if (fid === "loginForm") {
    e.preventDefault(); err.textContent = "";
    const { data, error } = await sb.auth.signInWithPassword({ email: v("email"), password: v("password") });
    if (error) return err.textContent = "Email or password is incorrect.";
    const { data: p } = await sb.from("profiles").select("banned").eq("id", data.user.id).single();
    if (p?.banned) { await sb.auth.signOut(); return err.textContent = "This account has been suspended."; }
    const next = params.get("next"); location.href = next && /^[\w.-]+(\?.*)?$/.test(next) ? next : "index.html";
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  await loadSession(); layout(); await loadProducts();
  await pages[document.body.dataset.page]?.();
});
