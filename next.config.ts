import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Partial prerendering (Next 16 model): static shells stream dynamic holes.
  // Uncached data access must sit under a Suspense/loading.tsx boundary or
  // inside a 'use cache' scope (see pricing/page.tsx).
  //
  // NOTE: this cannot be turned off without also removing every `'use cache'`
  // directive (pricing/page.tsx, lib/fx/rates.ts) — those hard-require it, so a
  // `NODE_ENV`-conditional value 500s the app in dev. Left ON. Measured on the
  // HDD it's not the compile bottleneck anyway (see the OS-cache note below).
  cacheComponents: true,

  // PERF (P4): the unified `radix-ui` package and `lucide-react` are large
  // barrels. optimizePackageImports rewrites `import { X } from 'radix-ui'`
  // to deep per-module imports so Turbopack/webpack only pull what's used —
  // smaller module graph, faster cold compiles and lighter client bundles.
  experimental: {
    optimizePackageImports: ['radix-ui', 'lucide-react'],

    // UX: keep the client-side Router Cache for visited pages so repeat / back
    // navigation reuses the last render instantly instead of re-hitting the
    // server and flashing loading.tsx. `dynamic` covers our cookie/DB pages.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
