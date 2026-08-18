-- MANUALE / DISTRUTTIVO
-- Eseguire SOLO prima della pubblicazione 1.0, dopo verifica/backup.
-- Non è una migration e non viene eseguito automaticamente.
-- Mantiene utenti/profiles, struttura organizzativa, sedi, stanze e posizioni.
-- Azzera inventario e dati operativi/test.

begin;

truncate table public.item_notes restart identity cascade;
truncate table public.stock_movements restart identity cascade;
truncate table public.audit_log restart identity cascade;
truncate table public.items restart identity cascade;
truncate table public.bug_reports restart identity cascade;
truncate table public.registration_requests restart identity cascade;

commit;
