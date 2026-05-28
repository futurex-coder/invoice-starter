import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // PPR was renamed to `cacheComponents` in Next 16 and is opt-in. Keeping
  // it off for now — re-enabling requires migrating per-route `dynamic` /
  // `revalidate` exports to the cacheComponents model. Tracked separately.
};

export default nextConfig;
