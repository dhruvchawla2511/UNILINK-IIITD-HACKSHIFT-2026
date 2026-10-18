export type { MediaItem } from './images';
export { images } from './images';
export { videos } from './videos';

import { images } from './images';
import { videos } from './videos';

export const allMedia = [...images, ...videos];

export const categories = Array.from(
  new Set(allMedia.map((item) => item.category))
).sort();
