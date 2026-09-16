import { createBrowserClient } from "@supabase/ssr";

/** Cliente de Supabase para componentes de cliente. Usa la clave anónima: todo pasa por RLS. */
export function crearClienteNavegador() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
