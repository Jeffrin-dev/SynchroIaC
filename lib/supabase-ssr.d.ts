declare module '@supabase/ssr' {
  import type { SupabaseClient } from '@supabase/supabase-js'

  type CookieOptions = Record<string, unknown>

  export function createBrowserClient(supabaseUrl: string, supabaseKey: string): SupabaseClient

  export function createServerClient(
    supabaseUrl: string,
    supabaseKey: string,
    options: {
      cookies: {
        get(name: string): string | undefined
        set(name: string, value: string, options: CookieOptions): void
        remove(name: string, options: CookieOptions): void
      }
    }
  ): SupabaseClient
}
