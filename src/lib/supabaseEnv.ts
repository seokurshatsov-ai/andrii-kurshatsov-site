/** Public Supabase project URL + anon key (safe to embed — protected by RLS). */
const FALLBACK_URL = "https://tftlfzeytiwpmiyvimla.supabase.co";
const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmdGxmemV5dGl3cG1peXZpbWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNDQ4OTgsImV4cCI6MjA5NTcyMDg5OH0.UqavFhYGvEyD-mB-wuTfR5gpsYE12RIUej7cLEZFutU";

export function resolveSupabasePublicConfig(): { url: string; key: string } {
  const url =
    import.meta.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    FALLBACK_URL;
  const key =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    FALLBACK_ANON_KEY;
  return { url, key };
}
