declare module 'vite-plugin-handlebars' {
  import type { Plugin } from 'vite';

  type Options = {
    partialDirectory?: string | string[];
    context?: Record<string, unknown> | ((pagePath: string) => Record<string, unknown>);
    helpers?: Record<string, (...args: unknown[]) => string>;
    compileOptions?: Record<string, unknown>;
  };

  export default function handlebars(options?: Options): Plugin;
}
