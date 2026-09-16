-- =============================================================================
-- Eventos de seguridad y jobs automáticos
-- docs/05-modelo-de-datos.md §9.7, §9.9 · RF-10, RF-39, RF-49, RF-65, RNF-11,
-- RNF-25..27, RN-16, RN-18
-- =============================================================================

-- ---------------------------------------------------------------------------
-- EVENTOS_SEGURIDAD
-- ---------------------------------------------------------------------------

create table public.eventos_seguridad (
  id               uuid primary key default gen_random_uuid(),
  tipo             text not null
                   check (tipo in ('login_fallido', 'acceso_denegado', 'limite_tasa',
                                   'mfa_activado', 'mfa_fallido')),
  -- Nullable: un login fallido puede no resolver a un usuario existente.
  usuario_id       uuid references public.perfiles (id) on delete set null,
  ip               inet,
  ruta             text,
  detalle          text,
  bloqueado_hasta  timestamptz,
  fecha            timestamptz not null default now(),
  constraint eventos_seguridad_bloqueo_solo_limite_tasa
    check (bloqueado_hasta is null or tipo = 'limite_tasa')
);

create index eventos_seguridad_usuario_fecha_idx on public.eventos_seguridad (usuario_id, fecha);
create index eventos_seguridad_tipo_fecha_idx on public.eventos_seguridad (tipo, fecha);

alter table public.eventos_seguridad enable row level security;

create policy "eventos_seguridad: el administrador lee"
  on public.eventos_seguridad for select to authenticated
  using ((select privado.es_admin()));

-- Escritura solo desde código de servidor, nunca desde el cliente (§9.9).
-- Liberar un bloqueo (CU-40) también pasa por la API.

-- ---------------------------------------------------------------------------
-- Jobs diarios con pg_cron (§9.7). Hora en UTC: 05:00 UTC = 00:00 en Colombia.
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron with schema pg_catalog;

-- Job 1 · cierre de convocatorias vencidas (RF-10, RN-02)
select cron.schedule(
  'cerrar-convocatorias-vencidas',
  '0 5 * * *',
  $$
  update public.convocatorias
  set estado = 'cerrada'
  where estado = 'publicada' and fecha_cierre < current_date;
  $$
);

-- Job 2 · vencimiento de suscripciones con 5 días de gracia (RF-39, RN-16)
select cron.schedule(
  'vencer-suscripciones',
  '5 5 * * *',
  $$
  update public.suscripciones
  set estado = 'en_gracia'
  where estado in ('activa', 'trial') and fecha_vencimiento < current_date;

  update public.suscripciones
  set estado = 'vencida'
  where estado = 'en_gracia' and fecha_vencimiento < current_date - interval '5 days';
  $$
);

-- Job 3 · reinicio mensual de créditos (RF-49, RN-18). Avanza el ancla tantos
-- meses como hagan falta, por si el job dejó de correr algún día.
select cron.schedule(
  'reiniciar-creditos-ia',
  '10 5 * * *',
  $$
  update public.suscripciones
  set creditos_usados_periodo = 0,
      periodo_creditos_inicio = (
        periodo_creditos_inicio
        + make_interval(months => (
            (extract(year from age(current_date, periodo_creditos_inicio)) * 12
             + extract(month from age(current_date, periodo_creditos_inicio)))::int
          ))
      )::date
  where estado in ('activa', 'trial')
    and periodo_creditos_inicio + interval '1 month' <= current_date;
  $$
);
