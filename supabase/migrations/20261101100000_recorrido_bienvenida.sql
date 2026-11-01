-- =============================================================================
-- Recorrido guiado de bienvenida de la empresa
-- docs/05-modelo-de-datos.md §9.2 · sesión 038
-- RF-119 · CU-51
-- =============================================================================

alter table public.perfiles
  add column if not exists recorrido_visto_at timestamptz;

-- Igual que en 20260926100000, más recorrido_visto_at: el cliente no la fija
-- ni la borra; la pone marcar_recorrido_visto(), que corre como dueño.
create or replace function privado.guardar_columnas_perfil()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if privado.es_cliente() then
    if new.id is distinct from old.id
       or new.rol is distinct from old.rol
       or new.mfa_habilitado is distinct from old.mfa_habilitado
       or new.es_propietario is distinct from old.es_propietario
       or new.admin_revocado_at is distinct from old.admin_revocado_at
       or new.admin_revocado_por is distinct from old.admin_revocado_por then
      raise exception 'No puedes modificar el rol, la verificación en dos pasos ni el acceso administrativo de tu perfil'
        using errcode = '42501';
    end if;
    if new.consentimiento_datos_at is distinct from old.consentimiento_datos_at then
      raise exception 'La autorización de tratamiento de datos no se modifica directamente'
        using errcode = '42501';
    end if;
    if new.recorrido_visto_at is distinct from old.recorrido_visto_at then
      raise exception 'El recorrido de bienvenida no se modifica directamente'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Solo la cuenta de la sesión y solo la primera vez (CU-51 paso 6).
create or replace function public.marcar_recorrido_visto()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.perfiles
  set recorrido_visto_at = now()
  where id = auth.uid() and recorrido_visto_at is null;
$$;

revoke all on function public.marcar_recorrido_visto() from public, anon;
grant execute on function public.marcar_recorrido_visto() to authenticated;
