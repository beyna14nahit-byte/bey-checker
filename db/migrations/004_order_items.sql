-- One order can hold several documents, each with its own check. Prices are frozen per item.
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  position integer not null check (position between 1 and 20),
  package_id text not null check (package_id in ('ai', 'similarity', 'combo')),
  package_name_en text not null,
  package_name_ms text not null,
  normal_price numeric(10,2) not null,
  discount numeric(10,2) not null default 0,
  price numeric(10,2) not null check (price > 0),
  -- Set to null when the file is deleted (retention or owner request); the item stays for the record.
  file_id uuid references files(id) on delete set null,
  filename text not null,
  unique (order_id, position)
);
create index if not exists order_items_order_idx on order_items(order_id);
alter table order_items enable row level security;

-- Orders with documents of different checks are stored as 'mixed'.
alter table orders drop constraint if exists orders_package_id_check;
alter table orders add constraint orders_package_id_check check (package_id in ('ai', 'similarity', 'combo', 'mixed'));
alter table orders add column if not exists item_count integer not null default 1;

-- Existing single-document orders become one item each.
insert into order_items (order_id, position, package_id, package_name_en, package_name_ms, normal_price, discount, price, file_id, filename)
select o.id, 1, o.package_id, o.package_name_en, o.package_name_ms, o.normal_price, o.discount, o.amount_due, f.id, coalesce(f.filename, '(removed)')
from orders o
left join lateral (select id, filename from files where order_id = o.id and kind = 'document' order by created_at limit 1) f on true
where not exists (select 1 from order_items i where i.order_id = o.id);
