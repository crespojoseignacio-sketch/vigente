// Conexión con Supabase: el mismo proyecto que Tachán, La Vaquita, Partila y El Fijo (tablas propias vg_).
// Estos dos datos son públicos por diseño: viajan dentro de la app a cada navegador.
// La seguridad la dan la sesión de cada emprendedora y las funciones de supabase/vigente.sql, no esta clave.
// Si se cargan SUPABASE_URL / SUPABASE_ANON_KEY en Vercel, tienen prioridad.
export default {
  supabaseUrl: 'https://iyxfthfpesqcevvuqggd.supabase.co',
  supabaseKey: 'sb_publishable_-oWA4mDrct5x06YUnIx36g_kDhAB5yK',
  publicOrigin: '',
};
