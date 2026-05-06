import type { NextConfig } from 'next';

// Note: we don't use Server Actions for uploads (they don't replay cleanly from
// the offline IndexedDB queue), so `experimental.serverActions.bodySizeLimit`
// would have no effect. Route-handler upload size is enforced in `lib/storage.ts`
// (MAX_PHOTO_BYTES) instead.
const nextConfig: NextConfig = {};

export default nextConfig;
