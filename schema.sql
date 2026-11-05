-- FigurineHub database schema for Supabase. Paste into: Dashboard > SQL Editor > New query > Run.

-- ============ TABLES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  role text not null default 'buyer' check (role in ('buyer','seller','admin')),
  approved boolean not null default true,   -- sellers start unapproved
  banned boolean not null default false,
  avatar_url text, cover_url text, bio text,
  created_at timestamptz not null default now()
);
create table public.products (
  id bigint generated always as identity primary key,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  category text not null check (category in ('Figurines','Trading Cards')),   -- the product type
  genre text not null default 'Other' check (genre in ('Anime','Movies & TV','Games','Other')),
  price numeric(10,2) not null check (price > 0),
  old_price numeric(10,2),
  stock int not null default 0 check (stock >= 0),
  item_condition text not null default 'New' check (item_condition in ('New','Pre-Owned')),
  brand text, material text, image_url text,
  created_at timestamptz not null default now()
);
create table public.reviews (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);
create table public.wishlist (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  primary key (user_id, product_id)
);
create table public.orders (
  id bigint generated always as identity primary key,
  buyer_id uuid not null references public.profiles(id),
  name text not null, phone text not null, address text not null, payment text not null,
  promo text, subtotal numeric(10,2) not null, discount numeric(10,2) not null default 0,
  shipping numeric(10,2) not null default 0, total numeric(10,2) not null,
  created_at timestamptz not null default now()
);
create table public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  product_id bigint references public.products(id) on delete set null,
  seller_id uuid not null references public.profiles(id),
  product_name text not null, price numeric(10,2) not null, qty int not null check (qty > 0),
  status text not null default 'Pending' check (status in ('Pending','Shipped','Delivered','Cancelled'))
);
create index on public.products (seller_id);
create index on public.order_items (seller_id);
create index on public.order_items (order_id);

-- ============ HELPER FUNCTIONS ============
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;
create or replace function public.is_order_buyer(oid bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.orders where id = oid and buyer_id = auth.uid())
$$;

-- New signups get a profile. Only 'buyer' or 'seller' can be chosen; admins are promoted manually.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text := case when new.raw_user_meta_data->>'role' = 'seller' then 'seller' else 'buyer' end;
begin
  insert into public.profiles (id, name, role, approved)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), r, r <> 'seller');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Checkout: prices, promo codes, shipping and stock are calculated here, never trusted from the browser.
create or replace function public.place_order(
  p_name text, p_phone text, p_address text, p_payment text, p_promo text, p_items jsonb
) returns bigint language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); oid bigint; it jsonb; prod public.products%rowtype; q int;
  sub numeric := 0; fig numeric := 0; disc numeric := 0; ship numeric := 150;
  code text := upper(coalesce(p_promo, ''));
begin
  if uid is null then raise exception 'Please log in to place an order.'; end if;
  if exists (select 1 from public.profiles where id = uid and banned) then raise exception 'This account is suspended.'; end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then raise exception 'Your cart is empty.'; end if;

  for it in select value from jsonb_array_elements(p_items) as t(value) loop
    q := (it->>'qty')::int;
    select * into prod from public.products where id = (it->>'id')::bigint for update;
    if not found then raise exception 'A product in your cart is no longer available.'; end if;
    if q < 1 or prod.stock < q then raise exception 'Not enough stock for %.', prod.name; end if;
    sub := sub + prod.price * q;
    if prod.category = 'Figurines' then fig := fig + prod.price * q; end if;
  end loop;

  if code = 'FIGURE10' then disc := round(fig * 0.10);
  elsif code = 'COLLECT200' and sub >= 2000 then disc := 200;
  elsif code = 'FREESHIP' and sub >= 1500 then ship := 0;
  end if;

  insert into public.orders (buyer_id, name, phone, address, payment, promo, subtotal, discount, shipping, total)
  values (uid, p_name, p_phone, p_address, p_payment, nullif(code, ''), sub, disc, ship, sub - disc + ship)
  returning id into oid;

  for it in select value from jsonb_array_elements(p_items) as t(value) loop
    q := (it->>'qty')::int;
    select * into prod from public.products where id = (it->>'id')::bigint;
    insert into public.order_items (order_id, product_id, seller_id, product_name, price, qty)
    values (oid, prod.id, prod.seller_id, prod.name, prod.price, q);
    update public.products set stock = stock - q where id = prod.id;
  end loop;
  return oid;
end $$;

-- Admin-only helpers
create or replace function public.admin_list_users()
returns table (id uuid, email text, name text, role text, approved boolean, banned boolean, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return query select p.id, u.email::text, p.name, p.role, p.approved, p.banned, p.created_at
               from public.profiles p join auth.users u on u.id = p.id order by p.created_at desc;
end $$;
create or replace function public.admin_set_profile(p_id uuid, p_approved boolean default null, p_banned boolean default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  update public.profiles set approved = coalesce(p_approved, approved), banned = coalesce(p_banned, banned)
  where id = p_id and role <> 'admin';
end $$;

revoke execute on function public.place_order, public.admin_list_users, public.admin_set_profile from public, anon;
grant execute on function public.place_order, public.admin_list_users, public.admin_set_profile to authenticated;

-- ============ ROW LEVEL SECURITY ============
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.reviews enable row level security;
alter table public.wishlist enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Users may only change their own name; role/approved/banned change only through admin_set_profile().
revoke update on public.profiles from anon, authenticated;
grant update (name, avatar_url, cover_url, bio) on public.profiles to authenticated;
-- Sellers/admins may only change an order item's status.
revoke update on public.order_items from anon, authenticated;
grant update (status) on public.order_items to authenticated;

create policy "profiles readable" on public.profiles for select using (true);
create policy "update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "products readable" on public.products for select using (true);
create policy "approved sellers add products" on public.products for insert to authenticated
  with check (seller_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and role = 'seller' and approved and not banned));
create policy "owners/admin edit products" on public.products for update to authenticated
  using (seller_id = auth.uid() or public.is_admin()) with check (seller_id = auth.uid() or public.is_admin());
create policy "owners/admin delete products" on public.products for delete to authenticated
  using (seller_id = auth.uid() or public.is_admin());

create policy "reviews readable" on public.reviews for select using (true);
create policy "write own review" on public.reviews for insert to authenticated with check (user_id = auth.uid());
create policy "edit own review" on public.reviews for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own review" on public.reviews for delete to authenticated using (user_id = auth.uid() or public.is_admin());

create policy "own wishlist" on public.wishlist for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "see own/seller/admin orders" on public.orders for select to authenticated
  using (buyer_id = auth.uid() or public.is_admin()
         or exists (select 1 from public.order_items oi where oi.order_id = orders.id and oi.seller_id = auth.uid()));
create policy "see own/seller/admin order items" on public.order_items for select to authenticated
  using (seller_id = auth.uid() or public.is_admin() or public.is_order_buyer(order_id));
create policy "seller/admin update item status" on public.order_items for update to authenticated
  using (seller_id = auth.uid() or public.is_admin()) with check (seller_id = auth.uid() or public.is_admin());
-- (No insert/delete policies on orders or order_items: orders are created only by place_order().)

-- ============ PROFILE PHOTOS + PRIVATE CONTACT INFO ============
-- Photos and bio are public (shown on seller shop pages). Phone/address live in a separate table only the owner can read.
create table public.profile_private (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  phone text, street text, city text, postal text
);
alter table public.profile_private enable row level security;
create policy "own private info" on public.profile_private for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============ PRODUCT IMAGE STORAGE ============
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true) on conflict do nothing;
create policy "product images public read" on storage.objects for select using (bucket_id = 'product-images');
create policy "sellers upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "sellers delete own images" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============ AFTER YOU SIGN UP YOUR FIRST ACCOUNT ============
-- Make yourself the admin (run separately, with your email):
--   update public.profiles set role = 'admin', approved = true where id = (select id from auth.users where email = 'you@example.com');
