// FigurineHub homepage interactions.
// Product data is intentionally demo-only. Replace this array with your database/API response later.
const demoProducts = [
  { category: "Figurines", name: "One Piece Luffy Figurine", price: 2500, rating: "4.8", reviews: "136", stock: 12, theme: "luffy" },
  { category: "Figurines", name: "Goku Super Saiyan 1/6 figure", price: 3200, rating: "4.9", reviews: "180", stock: 5, theme: "goku" },
  { category: "Figurines", name: "Portgas D. Ace 1/8 figure", price: 1800, rating: "4.7", reviews: "96", stock: 20, theme: "ace" },
  { category: "Figurines", name: "Monkey D. Luffy", price: 2800, rating: "4.9", reviews: "201", stock: 13, theme: "luffy2" },
  { category: "Trading Cards", name: "Pokemon Charizard Holo Card", price: 5900, rating: "4.9", reviews: "132", stock: 11, theme: "cards-red" },
  { category: "Trading Cards", name: "Yu-Gi-Oh! Blue Eyes Dragon Card", price: 2800, rating: "4.8", reviews: "156", stock: 2, theme: "cards-blue" },
  { category: "Figurines", name: "Uzumaki Naruto Center Figure", price: 1200, rating: "4.5", reviews: "88", stock: 25, theme: "naruto" },
  { category: "Figurines", name: "Azura Lane Crosswave Limited Edition", price: 4200, rating: "4.7", reviews: "45", stock: 4, theme: "anime" }
];

const grid = document.getElementById("productGrid");
const emptyState = document.getElementById("emptyState");
const toast = document.getElementById("toast");
let toastTimer;

const money = amount => new Intl.NumberFormat("en-PH", {
  style: "currency", currency: "PHP", maximumFractionDigits: 0
}).format(amount);

function renderProducts(products) {
  grid.innerHTML = "";
  emptyState.hidden = products.length > 0;

  products.forEach((product, index) => {
    const card = document.createElement("article");
    card.className = "product-card";
    card.innerHTML = `
      <div class="product-image image-placeholder theme-${product.theme}" role="img" aria-label="Placeholder image for ${product.name}">
        <span class="placeholder-label">Product ${String(index + 1).padStart(2, "0")}</span>
      </div>
      <p class="product-category">${product.category}</p>
      <h3 class="product-name">${product.name}</h3>
      <div class="product-rating" aria-label="${product.rating} out of 5 stars">★★★★★ <span>${product.rating} (${product.reviews})</span></div>
      <p class="product-price">${money(product.price)}</p>
      <span class="stock">${product.stock} in stock</span>
      <button class="add-to-cart" type="button" data-product="${product.name}">Add to cart</button>
    `;
    grid.appendChild(card);
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

document.getElementById("searchForm").addEventListener("submit", event => {
  event.preventDefault();
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  const results = demoProducts.filter(product =>
    `${product.name} ${product.category}`.toLowerCase().includes(query)
  );
  renderProducts(results);
  document.getElementById("products").scrollIntoView({ behavior: "smooth", block: "start" });
});

document.getElementById("searchInput").addEventListener("input", event => {
  const query = event.target.value.trim().toLowerCase();
  if (!query) renderProducts(demoProducts);
});

grid.addEventListener("click", event => {
  const button = event.target.closest(".add-to-cart");
  if (!button) return;
  showToast(`${button.dataset.product} — cart functionality will be connected later.`);
});

document.getElementById("newsletterForm").addEventListener("submit", event => {
  event.preventDefault();
  const email = document.getElementById("newsletterEmail").value.trim();
  document.getElementById("newsletterMessage").textContent = "Thanks! Newsletter signup is a demo for now.";
  event.target.reset();
});

document.querySelectorAll(".deal-card code").forEach(code => {
  code.title = "Click to copy promo code";
  code.style.cursor = "pointer";
  code.addEventListener("click", async () => {
    const value = code.textContent.trim();
    try {
      await navigator.clipboard.writeText(value);
      showToast(`Promo code ${value} copied.`);
    } catch {
      showToast(`Promo code: ${value}`);
    }
  });
});

// CSS-only color variations give the demo cards distinct placeholder artwork until real product images are added.
const placeholderStyles = document.createElement("style");
placeholderStyles.textContent = `
.theme-luffy { background: linear-gradient(135deg,#172f2b 0 25%,#e9a26d 26% 48%,#a9472c 49% 68%,#e5c18a 69%); }
.theme-goku { background: radial-gradient(circle at 50% 30%,#f5d35c 0 12%,transparent 13%),linear-gradient(135deg,#273a4b,#e89b31 42%,#244d8c 75%,#171e2a); }
.theme-ace { background: radial-gradient(circle at 62% 32%,#f5c18c 0 11%,transparent 12%),linear-gradient(135deg,#263b35,#c85d2e 40%,#e6a84d 60%,#222d29); }
.theme-luffy2 { background: radial-gradient(circle at 42% 32%,#efb57d 0 13%,transparent 14%),linear-gradient(140deg,#343c38,#b94c38 40%,#e3c18e 60%,#263a33); }
.theme-cards-red { background: repeating-linear-gradient(45deg,transparent 0 14px,rgba(255,221,151,.7) 15px 17px),linear-gradient(135deg,#8d281f,#e6a44b,#2d493b); }
.theme-cards-blue { background: repeating-linear-gradient(-35deg,transparent 0 12px,rgba(255,255,255,.55) 13px 15px),linear-gradient(135deg,#174f7d,#62b7c8,#193e60); }
.theme-naruto { background: radial-gradient(circle at 50% 28%,#f4c553 0 15%,transparent 16%),linear-gradient(135deg,#9ed4dd,#283d62 50%,#e8c85b); }
.theme-anime { background: radial-gradient(circle at 40% 35%,#f4d7c5 0 12%,transparent 13%),linear-gradient(135deg,#9d8cae,#ece5ee 50%,#465a62); }
`;
document.head.appendChild(placeholderStyles);
renderProducts(demoProducts);
