// Configuración de PRODUCCIÓN (ng build, lo que despliega Vercel).
//
// Todos estos valores son PÚBLICOS por diseño: viajan al navegador. La seguridad
// no depende de ocultarlos, sino de las políticas RLS y de las validaciones de
// las Edge Functions. Lo que NUNCA va acá es la service role key ni las claves de R2.
//
// Dónde conseguir cada valor: ver "Puesta en marcha" en el README.
const supabaseUrl = 'https://vwtqkglkenogylkranzz.supabase.co';

export const environment = {
  production: true,
  // Supabase: Project Settings → API (la "publishable key" es la nueva versión de la anon key)
  supabaseUrl,
  supabaseAnonKey: 'sb_publishable_QNkMch7noHsQpWVHTecZtw_rITvkg0h',
  // Las Edge Functions reemplazan al backend Express (antes http://localhost:3000/api)
  apiUrl: `${supabaseUrl}/functions/v1`,
  // Cloudflare R2: URL pública de cada bucket (con la barra final)
  productImagesUrl: 'https://productos.laelsi.com.ar/',
  userImagesUrl: 'https://usuarios.laelsi.com.ar/',
  // Cloudflare Turnstile: clave pública del widget anti-bots del checkout
  turnstileSiteKey: '0x4AAAAAAFWEnT36p2VGxVYN',
};
