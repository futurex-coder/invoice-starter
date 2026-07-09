import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Partial prerendering (Next 16 model): static shells stream dynamic holes.
  // Uncached data access must sit under a Suspense/loading.tsx boundary or
  // inside a 'use cache' scope (see pricing/page.tsx).
  cacheComponents: true,

  // PERF (P4): the unified `radix-ui` package and `lucide-react` are large
  // barrels. optimizePackageImports rewrites `import { X } from 'radix-ui'`
  // to deep per-module imports so Turbopack/webpack only pull what's used —
  // smaller module graph, faster cold compiles and lighter client bundles.
  experimental: {
    optimizePackageImports: ['radix-ui', 'lucide-react'],
  },
};

export default nextConfig;
