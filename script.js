// FigurineHub homepage: featured products come from Supabase (see supabase-config.js).
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const grid = document.getElementById("productGrid");
const emptyState = document.getElementById("emptyState");
const toast = document.getElementById("toast");
let toastTimer;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = amount => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(amount);

async function loadFeatured() {
  const { data, error } = await sb.from("products").select("*, reviews(rating)").gt("stock", 0).order("created_at", { ascending: false }).limit(8);
  if (error) { console.error(error); emptyState.textContent = "Couldn’t load products. Check supabase-config.js."; emptyState.hidden = false; return; }
  emptyState.hidden = data.length > 0;
  emptyState.textContent = "No products yet. Sellers can list items from their dashboard.";
  grid.innerHTML = data.map(p => {
    const rs = p.reviews || [], avg = rs.length ? (rs.reduce((s, x) => s + x.rating, 0) / rs.length).toFixed(1) : "0.0";
    const art = p.image_url ? ` style="background:url('${esc(p.image_url)}') center/cover no-repeat"` : "";
    return `<article class="product-card">
      <a href="product.html?id=${p.id}" class="product-image image-placeholder no-photo"${art} aria-label="${esc(p.name)}"></a>
      <p class="product-category">${esc(p.category)}</p>
      <h3 class="product-name"><a href="product.html?id=${p.id}">${esc(p.name)}</a></h3>
      <div class="product-rating">★★★★★ <span>${avg} (${rs.length})</span></div>
      <p class="product-price">${money(p.price)}</p>
      <span class="stock">${p.stock} in stock</span>
      <button class="add-to-cart" type="button" data-id="${p.id}">View product</button></article>`;
  }).join("");
}

function showToast(message) {
  toast.textContent = message; toast.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

document.getElementById("searchForm").addEventListener("submit", event => {
  event.preventDefault();
  location.href = "products.html?q=" + encodeURIComponent(document.getElementById("searchInput").value.trim());
});
grid.addEventListener("click", event => {
  const b = event.target.closest(".add-to-cart"); if (b) location.href = "product.html?id=" + b.dataset.id;
});

document.getElementById("newsletterForm").addEventListener("submit", event => {
  event.preventDefault();
  document.getElementById("newsletterMessage").textContent = "Thanks! Newsletter signup is a demo for now.";
  event.target.reset();
});

document.querySelectorAll(".deal-card code").forEach(code => {
  code.title = "Click to copy promo code";
  code.style.cursor = "pointer";
  code.addEventListener("click", async () => {
    const value = code.textContent.trim();
    try { await navigator.clipboard.writeText(value); showToast(`Promo code ${value} copied.`); }
    catch { showToast(`Promo code: ${value}`); }
  });
});

loadFeatured();

// Rotating "Featured collectibles" card: products the admin ticked as featured. Falls back to the decorative card if none.
async function loadHeroFeatured() {
  const card = document.querySelector(".hero-main-image"); if (!card) return;
  const { data, error } = await sb.from("products").select("id, name, price, image_url").eq("featured", true).gt("stock", 0).order("created_at", { ascending: false }).limit(6);
  if (error || !data?.length) return;
  card.classList.add("has-featured"); card.removeAttribute("role"); card.setAttribute("aria-label", "Featured collectibles"); card.setAttribute("aria-roledescription", "carousel");
  card.innerHTML = data.map(p => `<a class="hf-slide ${p.image_url ? "" : "no-photo"}" href="product.html?id=${p.id}"${p.image_url ? ` style="background-image:url('${esc(p.image_url)}')"` : ""}>
      <span class="hf-caption"><span class="hf-name">${esc(p.name)}</span><strong>${money(p.price)}</strong></span></a>`).join("")
    + (data.length > 1 ? `<div class="hf-dots">${data.map((_, k) => `<button type="button" data-k="${k}" aria-label="Show featured product ${k + 1}"></button>`).join("")}</div>` : "");
  const slides = [...card.querySelectorAll(".hf-slide")], dots = [...card.querySelectorAll(".hf-dots button")];
  let i = 0, timer;
  const show = n => {
    i = (n + slides.length) % slides.length;
    slides.forEach((s, k) => { s.classList.toggle("on", k === i); s.tabIndex = k === i ? 0 : -1; s.setAttribute("aria-hidden", k !== i); });
    dots.forEach((d, k) => d.classList.toggle("on", k === i));
  };
  const stop = () => clearInterval(timer);
  const start = () => { stop(); if (slides.length > 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches) timer = setInterval(() => show(i + 1), 4000); };
  card.addEventListener("click", e => { const b = e.target.closest("[data-k]"); if (b) { show(+b.dataset.k); start(); } });
  ["mouseenter", "focusin"].forEach(ev => card.addEventListener(ev, stop));
  ["mouseleave", "focusout"].forEach(ev => card.addEventListener(ev, start));
  show(0); start();
}
loadHeroFeatured();

// Show Orders / Logout in the header when someone is logged in.
sb.auth.getSession().then(({ data: { session } }) => {
  if (!session) return;
  const nav = document.querySelector(".desktop-nav"), login = nav.querySelector('a[href="login.html"]'), out = nav.querySelector(".signup-link");
  login.textContent = "Orders"; login.href = "orders.html";
  out.textContent = "Logout"; out.href = "#";
  out.onclick = async e => { e.preventDefault(); await sb.auth.signOut(); location.reload(); };
});

// Hamburger menu on the home page (the header here is static HTML, so we build the panel here).
(async function setupMenu() {
  const header = document.querySelector(".site-header"), btn = document.getElementById("menuToggle"); if (!header || !btn) return;
  const { data: { session } } = await sb.auth.getSession();
  let role = null;
  if (session) { const { data: p } = await sb.from("profiles").select("role").eq("id", session.user.id).maybeSingle(); role = p?.role; }
  let cartN = 0; try { cartN = JSON.parse(localStorage.getItem("fh_cart") || "[]").reduce((s, i) => s + i.qty, 0); } catch {}
  header.insertAdjacentHTML("beforeend", `<nav class="mobile-menu" id="mobileMenu" aria-label="Mobile navigation" hidden>
    <a href="products.html">Shop</a><a href="wishlist.html">Wishlist</a>
    <a href="cart.html">Cart ${cartN ? `<span class="mm-count">${cartN}</span>` : ""}</a>
    ${session ? `<a href="orders.html">My orders</a><a href="profile.html">My profile</a>
      ${role === "seller" ? `<p class="mm-group">Selling</p><a href="seller.html#add">Add a product</a><a href="seller.html">Seller dashboard</a><a href="shop.html?id=${session.user.id}">My public shop</a>` : ""}
      ${role === "admin" ? '<p class="mm-group">Admin</p><a href="admin.html">Admin panel</a>' : ""}
      <a class="mm-danger" href="#" id="menuLogout">Logout</a>` : '<a href="login.html">Login</a><a class="mm-cta" href="register.html">Sign up</a>'}
  </nav>`);
  const menu = document.getElementById("mobileMenu");
  const setMenu = open => { menu.hidden = !open; btn.setAttribute("aria-expanded", open); btn.setAttribute("aria-controls", "mobileMenu"); btn.setAttribute("aria-label", open ? "Close menu" : "Open menu"); btn.textContent = open ? "✕" : "☰"; };
  btn.addEventListener("click", () => setMenu(menu.hidden));
  document.addEventListener("click", e => { if (!menu.hidden && !e.target.closest("#mobileMenu, #menuToggle")) setMenu(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") setMenu(false); });
  document.getElementById("menuLogout")?.addEventListener("click", async e => { e.preventDefault(); await sb.auth.signOut(); location.reload(); });
})();