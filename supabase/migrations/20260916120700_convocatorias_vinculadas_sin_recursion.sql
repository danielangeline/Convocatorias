-- =============================================================================
-- Convocatorias vinculadas a registros propios, sin recursión de políticas
-- docs/05-modelo-de-datos.md §9.10 · RNF-25
--
-- Las tres políticas que dejaban ver una convocatoria cerrada por estar
-- vinculada a una postulación, un encargo o un documento propio consultaban esas
-- tablas directamente. Como la política de insert de postulaciones consulta a su
-- vez convocatorias, Postgres detectaba recursión infinita (42P17). Se sustituyen
-- por una sola política que resuelve el vínculo con una función security definer.
-- =============================================================================

drop policy "convocatorias: la empresa ve las de sus postulaciones" on public.convocatorias;
drop policy "convocatorias: la empresa ve las de sus encargos" on public.convocatorias;
drop policy "convocatorias: la empresa ve las de sus documentos" on public.convocatorias;

create or replace function privado.empresa_tiene_vinculo_con_convocatoria(p_convocatoria uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.postulaciones p
                 where p.convocatoria_id = p_convocatoria and p.usuario_id = auth.uid())
      or exists (select 1 from public.encargos e
                 where e.convocatoria_id = p_convocatoria and e.empresa_id = auth.uid())
      or exists (select 1 from public.documentos_generados d
                 where d.convocatoria_id = p_convocatoria and d.usuario_id = auth.uid());
$$;

revoke all on function privado.empresa_tiene_vinculo_con_convocatoria(uuid) from public, anon;
grant execute on function privado.empresa_tiene_vinculo_con_convocatoria(uuid) to authenticated;

-- La empresa sigue viendo la convocatoria de sus postulaciones, encargos y
-- documentos aunque se cierre o despublique; si no, su historial quedaría sin nombre.
create policy "convocatorias: la empresa ve las vinculadas a lo suyo"
  on public.convocatorias for select to authenticated
  using ((select privado.empresa_tiene_vinculo_con_convocatoria(id)));
