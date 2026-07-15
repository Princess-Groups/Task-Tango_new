
create or replace function public.touch_updated_at()
returns trigger language plpgsql
security invoker
set search_path = public
as $$
begin NEW.updated_at = now(); return NEW; end $$;
