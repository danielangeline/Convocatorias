-- La empresa descarga los adjuntos de las convocatorias que puede ver
-- (CU-08, RF-13, RN-33, RNF-16 · docs/05 §9.14 · sesión 016, Sprint 2 paso 4).
--
-- Firmar una URL de descarga exige poder leer el objeto con la sesión de quien
-- la pide, y hasta ahora solo el administrador podía. La condición no repite
-- ninguna regla: un objeto se lee si su fila de documentos_convocatoria es
-- visible para quien pide, y esa fila hereda la visibilidad de su convocatoria
-- (la empresa ve las publicadas y vigentes; el administrador, todas). El bucket
-- sigue privado y nadie firma con service_role.
drop policy if exists "convocatorias: se leen los adjuntos visibles" on storage.objects;
create policy "convocatorias: se leen los adjuntos visibles"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos-convocatorias'
    and exists (select 1 from public.documentos_convocatoria d where d.storage_path = name)
  );
