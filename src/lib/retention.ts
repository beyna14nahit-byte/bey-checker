import { db } from "./db";

/** Deletes files of orders completed or cancelled more than `days` days ago. Order records stay. */
export async function purgeExpiredFiles(days: number, actor = "system"): Promise<number> {
  if (!Number.isInteger(days) || days < 1) throw new Error("Retention days must be a positive whole number.");
  return db().begin(async (tx) => {
    const rows = await tx<{ order_id: string }[]>`
      delete from files f using orders o
      where f.order_id = o.id and o.status in ('completed', 'cancelled')
        and o.closed_at is not null and o.closed_at < now() - make_interval(days => ${days})
      returning f.order_id`;
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.order_id, (counts.get(r.order_id) ?? 0) + 1);
    for (const [id, n] of counts) await tx`insert into events (order_id, actor, message) values (${id}, ${actor}, ${`Retention policy: ${n} file(s) deleted.`})`;
    return rows.length;
  });
}
