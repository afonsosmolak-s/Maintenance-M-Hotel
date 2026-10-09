-- "after update of sector_id" só dispara quando sector_id está no SET do UPDATE;
-- ao mover um local (SET parent_id), o setor muda no BEFORE trigger e os descendentes
-- não eram atualizados. Passa a disparar também em mudanças de parent_id.
drop trigger propagate_sector on public.locations;
create trigger propagate_sector after update of parent_id, sector_id on public.locations
  for each row execute function app.locations_propagate_sector();
