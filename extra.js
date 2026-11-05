// Checkout, orders, seller dashboard and admin panel, backed by Supabase. Access is enforced by Row Level Security
// in the database (see schema.sql); the checks below only decide what to show.
const STATUSES = ["Pending", "Shipped", "Delivered", "Cancelled"];
const pill = s => `<span class="status s-${s.toLowerCase()}">${s}</span>`;
const statusSel = o => `<select data-status="${o.id}" aria-label="Item status">${STATUSES.map(s => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}</select>`;
const table = (heads, rows) => `<div class="table-wrap"><table><thead><tr>${heads.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("") || `<tr><td colspan="${heads.length}" class="muted">Nothing here yet.</td></tr>`}</tbody></table></div>`;
const tr = cells => `<tr>${cells.map(c => `<td>${c}</td>`).join("")}</tr>`;
const stat = (n, l) => `<div class="stat"><strong>${n}</strong><span>${l}</span></div>`;
const input = (n, l, t = "text", extra = "") => `<label class="field"><span>${l}</span><input name="${n}" type="${t}" ${extra}></label>`;
const opts = (n, l, list) => `<label class="field"><span>${l}</span><select name="${n}">${list.map(o => `<option>${o}</option>`).join("")}</select></label>`;
const ref = id => "FH-" + id;
const fail = (root, err) => { console.error(err); root.innerHTML = empty(`Something went wrong loading this page.<br><small>${esc(err?.message || "")} ${esc(err?.code || "")}</small>`, "home.html", "Back to home"); };
const cartItems = () => cart().map(c => ({ ...find(c.id), qty: c.qty })).filter(i => i.id);

async function shrink(file, max = 1600) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 800 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file), k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", .85));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}
async function uploadImage(file, tag = "img") {
  file = await shrink(file);
  if (!file.type.startsWith("image/")) { toast("Please choose an image file."); return null; }
  if (file.size > 5 * 1024 * 1024) { toast("Image must be under 5 MB."); return null; }
  const path = `${ME.id}/${tag}-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await sb.storage.from("product-images").upload(path, file);
  if (error) { toast(error.message); return null; }
  return sb.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}
const bgOf = u => u ? ` style="background-image:url('${esc(u)}')"` : "";

function guard(roles, root) {
  if (!ME) { location.href = `login.html?next=${thisPage()}`; return null; }
  if (!roles.includes(ME.role)) { root.innerHTML = empty("You don’t have access to this page.", "home.html", "Back to home"); return null; }
  return ME;
}

Object.assign(pages, {
  async profile() {
    const root = $("#profileRoot"); if (!guard(["buyer", "seller", "admin"], root)) return;
    const { data: pr } = await sb.from("profile_private").select("*").eq("user_id", ME.id).maybeSingle(), c = pr || {}, seller = ME.role === "seller";
    root.innerHTML = `<div class="profile-grid">
      ${seller ? `<p class="dash-links"><a class="button button-ghost" href="seller.html">Seller dashboard</a><a class="button button-ghost" href="shop.html?id=${ME.id}">View my public shop</a></p>` : ""}
      <form id="profileForm" class="panel"><h2>${seller ? "Shop profile" : "My profile"}</h2>
        ${seller ? `<div class="shop-cover"${bgOf(ME.cover)}></div>` : ""}
        <div class="shop-id ${seller ? "" : "flat"}"><div class="avatar-lg"${bgOf(ME.avatar)}>${ME.avatar ? "" : esc((ME.name || "?")[0])}</div></div>
        ${input("avatar", "Profile photo", "file", 'accept="image/*"')}${seller ? input("cover", "Cover photo", "file", 'accept="image/*"') : ""}
        ${input("name", seller ? "Shop name" : "Full name", "text", `required value="${esc(ME.name)}"`)}
        ${seller ? `<label class="field"><span>About your shop</span><textarea name="bio" rows="3" maxlength="300">${esc(ME.bio || "")}</textarea></label>` : ""}
        <p class="muted">Email: ${esc(ME.email)}</p><p class="form-error" id="profileError" role="alert"></p><button class="button button-primary" type="submit">Save profile</button></form>
      <form id="contactForm" class="panel"><h2>Contact &amp; shipping details</h2><p class="muted">Pre-fills your checkout. Only you can see this.</p>
        ${input("phone", "Mobile number", "tel", `value="${esc(c.phone || "")}"`)}${input("street", "Street address", "text", `value="${esc(c.street || "")}"`)}
        <div class="two">${input("city", "City", "text", `value="${esc(c.city || "")}"`)}${input("postal", "Postal code", "text", `value="${esc(c.postal || "")}"`)}</div>
        <button class="button button-primary" type="submit">Save details</button></form>
      <form id="passwordForm" class="panel"><h2>Change password</h2>
        ${input("password", "New password (8+ characters)", "password", 'minlength="8" required autocomplete="new-password"')}${input("confirm", "Confirm new password", "password", 'required autocomplete="new-password"')}
        <button class="button button-primary" type="submit">Update password</button></form></div>`;
  },

  async shop() {
    const root = $("#shopRoot");
    const { data: s } = await sb.from("profiles").select("id, name, role, avatar_url, cover_url, bio, created_at").eq("id", params.get("id") || "").maybeSingle();
    if (!s || s.role !== "seller") { root.innerHTML = empty("We couldn’t find that shop.", "products.html", "Browse products"); return; }
    document.title = `${s.name} | FigurineHub`;
    const list = PRODUCTS.filter(p => p.sellerId === s.id);
    root.innerHTML = `<div class="shop-hero"><div class="shop-cover"${bgOf(s.cover_url)}></div>
      <div class="shop-id"><div class="avatar-lg"${bgOf(s.avatar_url)}>${s.avatar_url ? "" : esc((s.name || "?")[0])}</div>
        <div class="shop-name"><h1>${esc(s.name)}</h1><p class="muted">Seller since ${new Date(s.created_at).getFullYear()} · ${list.length} product${list.length === 1 ? "" : "s"}</p></div>
        ${ME?.id === s.id ? '<a class="button button-ghost" href="profile.html">Edit shop</a>' : ""}</div>
      ${s.bio ? `<p class="detail-desc">${esc(s.bio)}</p>` : ""}</div>
      <h2 class="sub-title">Products</h2>${list.length ? `<div class="product-grid">${list.map(p => card(p)).join("")}</div>` : empty("This shop has no products yet.", "products.html", "Browse products")}`;
  },

  async checkout() {
    const root = $("#checkoutRoot"); if (!guard(["buyer", "seller", "admin"], root)) return;
    const { data: pr } = await sb.from("profile_private").select("*").eq("user_id", ME.id).maybeSingle(), c = pr || {};
    const items = cartItems();
    if (!items.length) { root.innerHTML = empty("Your cart is empty.", "products.html", "Start shopping"); return; }
    const t = promoCalc(items);
    root.innerHTML = `<div class="cart-layout">
      <form id="checkoutForm" class="panel"><h2>Shipping details</h2>
        ${input("name", "Full name", "text", `required value="${esc(ME.name)}"`)}${input("phone", "Mobile number", "tel", `required value="${esc(c.phone || "")}"`)}${input("address", "Street address", "text", `required value="${esc(c.street || "")}"`)}
        <div class="two">${input("city", "City", "text", `required value="${esc(c.city || "")}"`)}${input("postal", "Postal code", "text", `required value="${esc(c.postal || "")}"`)}</div>
        <h2>Payment method</h2>
        <fieldset class="roles pay">${["Cash on Delivery", "GCash", "Credit/Debit Card"].map((m, i) => `<label><input type="radio" name="payment" value="${m}" ${i ? "" : "checked"}><span><strong>${m}</strong></span></label>`).join("")}</fieldset>
        <p class="muted">Online payments aren’t connected yet. The order is recorded and the seller will contact you.</p>
        <p class="form-error" id="formError" role="alert"></p>
        <button class="button button-primary wide" type="submit">PLACE ORDER · ${money(t.total)}</button></form>
      <aside class="summary"><h2>Order summary</h2>${items.map(i => `<p class="sum-line"><span>${esc(i.name)} × ${i.qty}</span><span>${money(i.price * i.qty)}</span></p>`).join("")}
        <dl><dt>Subtotal</dt><dd>${money(t.sub)}</dd><dt>Discount</dt><dd>−${money(t.disc)}</dd><dt>Shipping</dt><dd>${t.ship ? money(t.ship) : "Free"}</dd></dl>
        <p class="total"><span>Total</span><strong>${money(t.total)}</strong></p></aside></div>`;
  },

  async orders() {
    const root = $("#ordersRoot"); if (!guard(["buyer", "seller", "admin"], root)) return;
    const { data, error } = await sb.from("orders").select("*, order_items(*)").eq("buyer_id", ME.id).order("created_at", { ascending: false });
    if (error) return fail(root, error);
    root.innerHTML = data.length ? data.map(o => `<article class="panel order"><div class="row-between"><strong>${ref(o.id)}</strong><span class="muted">${new Date(o.created_at).toLocaleDateString("en-PH")}</span></div>
      <p class="muted">${esc(o.payment)} · ${esc(o.address)}</p>
      ${o.order_items.map(i => `<p class="row-between"><span>${esc(i.product_name)} ×${i.qty}</span>${pill(i.status)}</p>`).join("")}
      <strong>${money(o.total)}</strong></article>`).join("") : empty("You haven’t placed any orders yet.", "products.html", "Start shopping");
  },

  async seller() {
    const root = $("#sellerRoot"); if (!guard(["seller", "admin"], root)) return;
    if (ME.role === "seller" && !ME.approved) { root.innerHTML = empty("Your seller account is waiting for admin approval. You can list products once it’s approved.", "home.html", "Back to home"); return; }
    rerender = async () => {
      const [a, b] = await Promise.all([
        sb.from("products").select("*").eq("seller_id", ME.id).order("created_at", { ascending: false }),
        sb.from("order_items").select("*, orders(name, phone, address)").eq("seller_id", ME.id).order("id", { ascending: false })]);
      if (a.error || b.error) return fail(root, a.error || b.error);
      const mine = a.data, rows = b.data, rev = rows.filter(r => r.status !== "Cancelled").reduce((s, r) => s + r.price * r.qty, 0);
      root.innerHTML = `<p class="dash-links"><a class="button button-ghost" href="profile.html">Edit shop profile</a><a class="button button-ghost" href="shop.html?id=${ME.id}">View my public shop</a></p><div class="stats-row">${stat(mine.length, "Listings")}${stat(mine.reduce((s, p) => s + p.stock, 0), "Units in stock")}${stat(rows.length, "Items sold")}${stat(money(rev), "Revenue")}</div>
      <form id="productForm" class="panel form-grid"><h2 id="formTitle">Add a product</h2><input type="hidden" name="id"><input type="hidden" name="image_url">
        ${input("name", "Product name *", "text", "required")}${opts("category", "Type", ["Figurines", "Trading Cards"])}${opts("genre", "Genre", GENRES)}
        ${input("price", "Price (₱) *", "number", 'min="1" step="0.01" required')}${input("old_price", "Original price (optional)", "number", 'min="0" step="0.01"')}${input("stock", "Stock *", "number", 'min="0" required')}
        ${opts("item_condition", "Condition", ["New", "Pre-Owned"])}${input("brand", "Brand")}${input("material", "Material")}${input("file", "Photo (leave empty to keep current)", "file", 'accept="image/*"')}
        <label class="field wide-field"><span>Description</span><textarea name="description" rows="3"></textarea></label>
        <p class="form-error wide-field" id="productError" role="alert"></p><div class="form-actions"><button class="button button-primary" type="submit">Save product</button><button class="button button-ghost" type="button" data-cancel>Cancel</button></div></form>
      <h2 class="sub-title">Your products</h2>${table(["", "Product", "Type", "Genre", "Price", "Stock", ""], mine.map(p => tr([`<span class="thumb no-photo"${bgOf(p.image_url)}></span>`, esc(p.name), p.category, p.genre, money(p.price), `<input class="stock-input" type="number" min="0" data-stock="${p.id}" value="${p.stock}" aria-label="Stock">`,
        `<button class="link-btn dark" data-edit="${p.id}">Edit</button> <button class="link-btn" data-del="${p.id}">Delete</button>`])))}
      <h2 class="sub-title">Orders for your products</h2>${table(["Order", "Customer", "Ship to", "Item", "Status"], rows.map(r => tr([ref(r.order_id), `${esc(r.orders?.name)}<br><span class="muted">${esc(r.orders?.phone)}</span>`, esc(r.orders?.address), `${esc(r.product_name)} ×${r.qty}`, statusSel(r)])))}`;
      root._products = mine;
    };
    await rerender();
  },

  async admin() {
    const root = $("#adminRoot"); if (!guard(["admin"], root)) return;
    rerender = async () => {
      const [a, b, c] = await Promise.all([sb.rpc("admin_list_users"), sb.from("products").select("*, profiles!seller_id(name)").order("created_at", { ascending: false }),
        sb.from("order_items").select("*, orders(name)").order("id", { ascending: false })]);
      if (b.error || c.error) return fail(root, b.error || c.error);
      let us = a.data, note = "";
      if (a.error) {   // fall back to the profiles table (no emails) so sellers can still be approved
        console.error(a.error);
        const p = await sb.from("profiles").select("*").order("created_at", { ascending: false });
        if (p.error) return fail(root, p.error);
        us = p.data.map(x => ({ ...x, email: "—" }));
        note = `<p class="form-error">Couldn’t load user emails: ${esc(a.error.message)}</p>`;
      }
      const ps = b.data, rows = c.data;
      root.innerHTML = `<div class="stats-row">${stat(us.length, "Users")}${stat(us.filter(x => x.role === "seller" && !x.approved).length, "Sellers pending")}${stat(ps.length, "Listings")}${stat(money(rows.filter(r => r.status !== "Cancelled").reduce((s, r) => s + r.price * r.qty, 0)), "Total sales")}</div>
      <h2 class="sub-title">Users &amp; sellers</h2>${note}${table(["Name", "Email", "Role", "Status", ""], us.map(x => tr([esc(x.name), esc(x.email), x.role,
        x.banned ? "Suspended" : x.role === "seller" && !x.approved ? "Pending approval" : "Active",
        x.role === "admin" ? "" : (x.role === "seller" && !x.approved ? `<button class="link-btn dark" data-approve="${x.id}">Approve</button> ` : "") + `<button class="link-btn" data-ban="${x.id}" data-state="${x.banned}">${x.banned ? "Unban" : "Suspend"}</button>`])))}
      <h2 class="sub-title">All listings</h2>${table(["Product", "Seller", "Price", "Stock", ""], ps.map(p => tr([esc(p.name), esc(p.profiles?.name), money(p.price), p.stock, `<button class="link-btn" data-rm="${p.id}">Remove</button>`])))}
      <h2 class="sub-title">All order items</h2>${table(["Order", "Customer", "Item", "Amount", "Status"], rows.map(r => tr([ref(r.order_id), esc(r.orders?.name), `${esc(r.product_name)} ×${r.qty}`, money(r.price * r.qty), statusSel(r)])))}`;
    };
    await rerender();
  }
});

document.addEventListener("submit", async e => {
  const f = e.target, g = n => f.elements[n].value.trim(); const fid = f.getAttribute("id");
  if (fid === "profileForm") {
    e.preventDefault();
    const btn = f.querySelector("[type=submit]"), err = $("#profileError"), label = btn.textContent;
    const stop = msg => { err.textContent = msg || ""; btn.disabled = false; btn.textContent = label; };
    btn.disabled = true; btn.textContent = "Saving…"; err.textContent = "";
    try {
      const row = { name: g("name") }; if (ME.role === "seller") row.bio = g("bio") || null;
      for (const [field, col] of [["avatar", "avatar_url"], ["cover", "cover_url"]]) {
        const file = f.elements[field]?.files[0]; if (!file) continue;
        btn.textContent = "Uploading photo…"; const url = await uploadImage(file, field);
        if (!url) return stop("A photo couldn’t be uploaded. Try a different image.");
        row[col] = url;
      }
      const { data, error } = await sb.from("profiles").update(row).eq("id", ME.id).select("id");
      if (error) return stop(error.message);
      if (!data?.length) return stop("Your profile wasn’t saved (no permission). Make sure migration_profiles.sql was run in Supabase.");
      toast("Profile saved."); setTimeout(() => location.reload(), 700);
    } catch (ex) { console.error(ex); stop("Something went wrong. Check your connection and try again."); }
  }
  if (fid === "contactForm") {
    e.preventDefault();
    const { error } = await sb.from("profile_private").upsert({ user_id: ME.id, phone: g("phone"), street: g("street"), city: g("city"), postal: g("postal") });
    toast(error ? error.message : "Details saved.");
  }
  if (fid === "passwordForm") {
    e.preventDefault();
    if (g("password").length < 8) return toast("Password must be at least 8 characters.");
    if (g("password") !== g("confirm")) return toast("Passwords don’t match.");
    const { error } = await sb.auth.updateUser({ password: g("password") });
    toast(error ? error.message : "Password updated."); if (!error) f.reset();
  }
  if (fid === "checkoutForm") {
    e.preventDefault(); const btn = f.querySelector("[type=submit]"); btn.disabled = true;
    const { data, error } = await sb.rpc("place_order", { p_name: g("name"), p_phone: g("phone"), p_address: `${g("address")}, ${g("city")} ${g("postal")}`,
      p_payment: f.elements.payment.value, p_promo: store.get("fh_promo", ""), p_items: cartItems().map(i => ({ id: i.id, qty: i.qty })) });
    if (error) { btn.disabled = false; $("#formError").textContent = error.message; return; }
    store.set("fh_cart", []); store.set("fh_promo", "");
    $("#checkoutRoot").innerHTML = `<div class="empty-block"><h2>Thank you for your order!</h2><p>Order <strong>${ref(data)}</strong> was placed.</p><a class="button button-primary" href="orders.html">View my orders</a></div>`;
  }
  if (fid === "productForm") {
    e.preventDefault();
    const btn = f.querySelector("[type=submit]"), err = $("#productError"), label = btn.textContent;
    const stop = msg => { err.textContent = msg || ""; btn.disabled = false; btn.textContent = label; };
    btn.disabled = true; btn.textContent = "Saving…"; err.textContent = "";
    try {
      let image_url = g("image_url") || null; const file = f.elements.file.files[0];
      if (file) {
        btn.textContent = "Uploading photo…"; image_url = await uploadImage(file, "product");
        if (!image_url) return stop("The photo couldn’t be uploaded. Try a different image, or save without a photo.");
      }
      const price = +g("price"), id = g("id");
      const row = { name: g("name"), description: g("description") || null, category: g("category"), genre: g("genre"), price, old_price: +g("old_price") > price ? +g("old_price") : null,
        stock: +g("stock"), item_condition: g("item_condition"), brand: g("brand") || null, material: g("material") || null, image_url };
      const res = id ? await sb.from("products").update(row).eq("id", +id).select("id") : await sb.from("products").insert({ ...row, seller_id: ME.id });
      if (res.error) return stop(res.error.message);
      if (id && !res.data?.length) return stop("Couldn’t update this product (no permission).");
      toast(id ? "Product updated." : "Product listed. It’s now in the shop."); rerender();
    } catch (ex) { console.error(ex); stop("Something went wrong. Check your connection and try again."); }
  }
});

document.addEventListener("click", async e => {
  const t = e.target.closest("[data-edit],[data-del],[data-rm],[data-cancel],[data-approve],[data-ban]"); if (!t) return;
  const done = error => { if (error) toast(error.message); else rerender(); };
  if (t.dataset.edit) {
    const p = $("#sellerRoot")._products.find(x => x.id === +t.dataset.edit), f = $("#productForm");
    ["id", "name", "category", "genre", "price", "old_price", "stock", "item_condition", "brand", "material", "description", "image_url"].forEach(k => f.elements[k].value = p[k] ?? "");
    $("#formTitle").textContent = "Edit product"; f.scrollIntoView({ behavior: "smooth" });
  } else if (t.dataset.del || t.dataset.rm) {
    if (confirm("Delete this product? This can’t be undone.")) done((await sb.from("products").delete().eq("id", +(t.dataset.del || t.dataset.rm))).error);
  } else if (t.hasAttribute("data-cancel")) rerender();
  else if (t.dataset.approve) done((await sb.rpc("admin_set_profile", { p_id: t.dataset.approve, p_approved: true })).error);
  else if (t.dataset.ban) done((await sb.rpc("admin_set_profile", { p_id: t.dataset.ban, p_banned: t.dataset.state !== "true" })).error);
});

document.addEventListener("change", async e => {
  const sid = e.target.dataset?.stock;
  if (sid) { const { error } = await sb.from("products").update({ stock: Math.max(0, Math.floor(+e.target.value) || 0) }).eq("id", +sid); toast(error ? error.message : "Stock updated."); return; }
  const id = e.target.dataset?.status; if (!id) return;
  const { error } = await sb.from("order_items").update({ status: e.target.value }).eq("id", +id);
  toast(error ? error.message : "Status updated."); if (!error) rerender();
});