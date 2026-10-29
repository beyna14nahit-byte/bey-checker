-- Three packages (AI, plagiarism/similarity, combo). Existing orders were all AI checks.
alter table orders add column if not exists package_id text not null default 'ai'
  check (package_id in ('ai', 'similarity', 'combo'));
alter table orders add column if not exists package_name_en text not null default 'AI Check';
alter table orders add column if not exists package_name_ms text not null default 'Semakan AI';
