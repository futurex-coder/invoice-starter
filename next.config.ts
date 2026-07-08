import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Partial prerendering (Next 16 model): static shells stream dynamic holes.
  // Uncached data access must sit under a Suspense/loading.tsx boundary or
  // inside a 'use cache' scope (see pricing/page.tsx).
  cacheComponents: true,
};

export default nextConfig;
