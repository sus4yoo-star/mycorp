/**
 * Supabase configuration.
 *
 * The app must build and render without credentials — a contributor cloning the
 * repo should see a setup notice, not a stack trace. Every entry point checks
 * `isSupabaseConfigured()` first and degrades to `SetupNotice`.
 */

export const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
export const SUPABASE_ANON_KEY = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '';

export const isSupabaseConfigured = (): boolean =>
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
