-- Mantiene l'audit anche dopo l'eventuale eliminazione fisica di un oggetto.
-- audit_log.item_id è un identificatore storico e non deve dipendere dalla vita
-- della riga in items.

alter table public.audit_log
  drop constraint if exists audit_log_item_id_fkey;
