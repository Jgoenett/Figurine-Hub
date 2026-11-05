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

// Show Orders / Logout in the header when someone is logged in.
sb.auth.getSession().then(({ data: { session } }) => {
  if (!session) return;
  const nav = document.querySelector(".desktop-nav"), login = nav.querySelector('a[href="login.html"]'), out = nav.querySelector(".signup-link");
  login.textContent = "Orders"; login.href = "orders.html";
  out.textContent = "Logout"; out.href = "#";
  out.onclick = async e => { e.preventDefault(); await sb.auth.signOut(); location.reload(); };
});
