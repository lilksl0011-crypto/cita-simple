create or replace function public.unpublish_if_incomplete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.workshop_ready(new.workshop_id) then
    update workshops set active = false where id = new.workshop_id and active and not is_demo;
  end if;
  return new;
end $$;
revoke execute on function public.unpublish_if_incomplete() from public, anon, authenticated;
create trigger services_unpublish after update on public.services for each row execute function public.unpublish_if_incomplete();