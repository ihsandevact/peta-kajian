import { copyFileSync, mkdirSync } from 'fs';
import path from 'path';

const destDir = 'public/lib/maplibre';
mkdirSync(destDir, { recursive: true });

copyFileSync(
  'node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs',
  path.join(destDir, 'maplibre-gl-worker.mjs')
);
try {
  copyFileSync(
    'node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs',
    path.join(destDir, 'maplibre-gl-shared.mjs')
  );
} catch (e) {
  // If the shared file doesn't exist in this version, ignore
}
console.log('MapLibre worker files copied to public/lib/maplibre');
