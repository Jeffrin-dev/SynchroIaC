declare module '@supabase/ssr' {
  import type { SupabaseClient } from '@supabase/supabase-js'

  type CookieOptions = Record<string, unknown>

  export function createBrowserClient(_supabaseUrl: string, _supabaseKey: string): SupabaseClient

  export function createServerClient(
    _supabaseUrl: string,
    _supabaseKey: string,
    _options: {
      cookies: {
        get(_name: string): string | undefined
        set(_name: string, _value: string, _options: CookieOptions): void
        remove(_name: string, _options: CookieOptions): void
      }
    }
  ): SupabaseClient
}
