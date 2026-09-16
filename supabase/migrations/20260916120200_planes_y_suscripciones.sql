-- =============================================================================
-- Planes, suscripciones y pagos
-- docs/05-modelo-de-datos.md §9.2, §9.4, §9.10 · RF-36, RF-38, RNF-20, RN-11, RN-16, RN-18, RN-28
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PLANES
-- ---------------------------------------------------------------------------

create table public.planes (
  id                      uuid primary key default gen_random_uuid(),
  nombre                  text not null,
  rol                     text not null check (rol in ('empresa', 'consultor')),
  precio_mensual          numeric not null check (precio_mensual >= 0),
  precio_anual            numeric not null check (precio_anual >= 0),
  creditos_ia_mensuales   int not null default 0 check (creditos_ia_mensuales >= 0),
  activo                  boolean not null default true,
  creado_at               timestamptz not null default now(),
  actualizado_at          timestamptz not null default now(),
  -- RN-28: el plan de consultor no incluye créditos de IA.
  constraint planes_consultor_sin_creditos
    check (rol = 'empresa' or creditos_ia_mensuales = 0)
);

create trigger planes_actualizado_at
  before update on public.planes
  for each row execute function privado.fijar_actualizado_at();

alter table public.planes enable row level security;

create policy "planes: lectura pública de los activos"
  on public.planes for select to anon, authenticated
  using (activo);

create policy "planes: el administrador lee todos"
  on public.planes for select to authenticated
  using ((select privado.es_admin()));

create policy "planes: el administrador crea"
  on public.planes for insert to authenticated
  with check ((select privado.es_admin()));

create policy "planes: el administrador edita"
  on public.planes for update to authenticated
  using ((select privado.es_admin()))
  with check ((select privado.es_admin()));

-- ---------------------------------------------------------------------------
-- SUSCRIPCIONES
-- ---------------------------------------------------------------------------

create table public.suscripciones (
  id                        uuid primary key default gen_random_uuid(),
  usuario_id                uuid not null references public.perfiles (id) on delete cascade,
  plan_id                   uuid references public.planes (id),  -- null en trial
  modalidad                 text not null check (modalidad in ('trial', 'mensual', 'anual')),
  estado                    text not null
                            check (estado in ('trial', 'activa', 'en_gracia', 'vencida', 'suspendida')),
  fecha_inicio              date not null default current_date,
  fecha_vencimiento         date not null,
  activada_por              uuid references public.perfiles (id),
  -- Créditos de IA (§9.2)
  creditos_usados_periodo   int not null default 0 check (creditos_usados_periodo >= 0),
  creditos_extra            int not null default 0 check (creditos_extra >= 0),
  periodo_creditos_inicio   date not null default current_date,
  creado_at                 timestamptz not null default now(),
  actualizado_at            timestamptz not null default now(),
  constraint suscripciones_rango_fechas check (fecha_inicio <= fecha_vencimiento),
  constraint suscripciones_plan_fuera_de_trial check (modalidad = 'trial' or plan_id is not null)
);

create index suscripciones_usuario_idx on public.suscripciones (usuario_id);
-- §9.4: para el job de reinicio mensual de créditos.
create index suscripciones_periodo_creditos_idx on public.suscripciones (periodo_creditos_inicio);
-- RN-11: un solo trial por cuenta.
create unique index suscripciones_un_trial_por_cuenta on public.suscripciones (usuario_id)
  where modalidad = 'trial';

create trigger suscripciones_actualizado_at
  before update on public.suscripciones
  for each row execute function privado.fijar_actualizado_at();

alter table public.suscripciones enable row level security;

create policy "suscripciones: cada suscriptor lee las suyas"
  on public.suscripciones for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy "suscripciones: el administrador lee todas"
  on public.suscripciones for select to authenticated
  using ((select privado.es_admin()));

create policy "suscripciones: el administrador crea"
  on public.suscripciones for insert to authenticated
  with check ((select privado.es_admin()));

create policy "suscripciones: el administrador edita"
  on public.suscripciones for update to authenticated
  using ((select privado.es_admin()))
  with check ((select privado.es_admin()));

-- Suscripción que habilita acciones restringidas (RF-40): trial, activa o en
-- los 5 días de gracia (RN-16). Se compara también la fecha para no depender
-- de que el job diario ya haya corrido.
create or replace function privado.tiene_suscripcion_vigente(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.suscripciones s
    where s.usuario_id = p_usuario
      and s.estado in ('trial', 'activa', 'en_gracia')
      and s.fecha_vencimiento + 5 >= current_date
  );
$$;

revoke all on function privado.tiene_suscripcion_vigente(uuid) from public, anon;
grant execute on function privado.tiene_suscripcion_vigente(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- PAGOS_SUSCRIPCION
-- ---------------------------------------------------------------------------

create table public.pagos_suscripcion (
  id                uuid primary key default gen_random_uuid(),
  suscripcion_id    uuid not null references public.suscripciones (id) on delete cascade,
  monto             numeric not null check (monto > 0),
  fecha_pago        date not null default current_date,
  -- Preparado para pasarela sin migración (RF-38).
  medio             text not null default 'manual' check (medio in ('manual', 'wompi')),
  registrado_por    uuid references public.perfiles (id),
  comprobante_path  text,
  creado_at         timestamptz not null default now()
);

create index pagos_suscripcion_suscripcion_idx on public.pagos_suscripcion (suscripcion_id);

alter table public.pagos_suscripcion enable row level security;

create policy "pagos_suscripcion: cada suscriptor lee los suyos"
  on public.pagos_suscripcion for select to authenticated
  using (exists (
    select 1 from public.suscripciones s
    where s.id = suscripcion_id and s.usuario_id = (select auth.uid())
  ));

create policy "pagos_suscripcion: el administrador lee todos"
  on public.pagos_suscripcion for select to authenticated
  using ((select privado.es_admin()));

create policy "pagos_suscripcion: el administrador registra"
  on public.pagos_suscripcion for insert to authenticated
  with check ((select privado.es_admin()));
