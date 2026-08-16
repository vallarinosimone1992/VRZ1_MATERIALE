-- La Edge Function admin-users usa service_role per creare e gestire i profili applicativi.
-- Con l'esposizione automatica delle nuove tabelle disabilitata, il grant va esplicitato.
grant select, insert, update, delete on table public.profiles to service_role;
