/**
 * Declaraciones de tipos ambientales para Deno y sus importaciones (npm: / jsr:).
 *
 * Permite que el Language Server de TypeScript en el editor reconozca
 * el namespace global 'Deno' y los esquemas 'npm:' y 'jsr:' en las
 * Supabase Edge Functions sin necesidad de instalar extensiones externas.
 */

declare namespace Deno {
  interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    has(key: string): boolean;
    toObject(): Record<string, string>;
  }

  export const env: Env;

  export interface ServeOptions {
    port?: number;
    hostname?: string;
    signal?: AbortSignal;
    onError?: (error: unknown) => Response | Promise<Response>;
    onListen?: (params: { port: number; hostname: string }) => void;
  }

  export function serve(
    handler: (req: Request) => Response | Promise<Response>,
    options?: ServeOptions
  ): void;

  export function serve(
    options: ServeOptions,
    handler: (req: Request) => Response | Promise<Response>
  ): void;
}

// ----------------------------------------------------------------------------
// Módulos externos con esquema 'npm:'
// ----------------------------------------------------------------------------
declare module 'npm:postgres@*' {
  const postgres: any;
  export default postgres;
}
declare module 'npm:postgres' {
  const postgres: any;
  export default postgres;
}

declare module 'npm:aws4fetch@*' {
  export class AwsClient {
    constructor(options?: any);
    fetch(input: any, init?: any): Promise<Response>;
    sign(input: any, init?: any): Promise<Request>;
  }
}
declare module 'npm:aws4fetch' {
  export class AwsClient {
    constructor(options?: any);
    fetch(input: any, init?: any): Promise<Response>;
    sign(input: any, init?: any): Promise<Request>;
  }
}

// ----------------------------------------------------------------------------
// Módulos externos con esquema 'jsr:'
// ----------------------------------------------------------------------------
declare module 'jsr:@supabase/supabase-js@*' {
  export function createClient(supabaseUrl: string, supabaseKey: string, options?: any): any;
  export type SupabaseClient = any;
  export type User = any;
  export type Session = any;
}
declare module 'jsr:@supabase/supabase-js' {
  export function createClient(supabaseUrl: string, supabaseKey: string, options?: any): any;
  export type SupabaseClient = any;
  export type User = any;
  export type Session = any;
}
