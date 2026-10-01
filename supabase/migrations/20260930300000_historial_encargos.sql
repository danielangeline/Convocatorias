-- Historial de los encargos (RNF-11 · docs/05 §9.24 · sesión 023, Sprint 4
-- paso 5). Igual que postulacion_historial: cada cambio de estado deja quién y
-- cuándo, también los que hace un job (cambiado_por nulo).

create table public.encargo_historial (
  id               uuid primary key default gen_random_uuid(),
  encargo_id       uuid not null references public.encargos (id) on delete cascade,
  estado_anterior  text,
  estado_nuevo     text not null,
  cambiado_por     uuid references public.perfiles (id) on delete set null,
  fecha            timestamptz not null default now()
);

create index encargo_historial_encargo_idx on public.encargo_historial (encargo_id, fecha);

alter table public.encargo_historial enable row level security;

create policy "encargo_historial: las partes del encargo leen"
  on public.encargo_historial for select to authenticated
  using ((select privado.es_parte_encargo(encargo_id)));

create policy "encargo_historial: el administrador lee todo"
  on public.encargo_historial for select to authenticated
  using ((select privado.es_admin()));

-- Sin políticas de escritura: solo el trigger escribe.

create or replace function privado.registrar_historial_encargo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.encargo_historial (encargo_id, estado_anterior, estado_nuevo, cambiado_por)
    values (new.id, null, new.estado, auth.uid());
  elsif new.estado is distinct from old.estado then
    insert into public.encargo_historial (encargo_id, estado_anterior, estado_nuevo, cambiado_por)
    values (new.id, old.estado, new.estado, auth.uid());
  end if;
  return new;
end;
$$;

create trigger encargos_registrar_historial
  after insert or update of estado on public.encargos
  for each row execute function privado.registrar_historial_encargo();

-- Los encargos que ya existían reciben su entrada de creación.
insert into public.encargo_historial (encargo_id, estado_anterior, estado_nuevo, cambiado_por, fecha)
select e.id, null, e.estado, null, e.creada_at from public.encargos e;
