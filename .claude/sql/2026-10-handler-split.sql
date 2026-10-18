-- Pembagian omzet per handler (Jasa Online, owner Okt 2026). Hanya MENAMBAH kolom kosong (nullable); data lama tidak berubah.
-- handler_partner_id : partner (profit_share_rules.id) yang jadi handler order ini
-- handler_name       : nama handler saat order dicatat (snapshot, tetap walau partner diganti nama)
-- handler_split      : snapshot pembagian saat order dicatat: [{partner_id, partner_name, pct}], pct = pecahan dari bagian non-Kas (jumlah = 1).
--                      Disimpan di transaksi supaya mengubah pengaturan handler nanti TIDAK mengubah hak partner di order lama.
alter table public.transactions add column if not exists handler_partner_id uuid;
alter table public.transactions add column if not exists handler_name text;
alter table public.transactions add column if not exists handler_split jsonb;
