'use client';

import Image from 'next/image';
import { useState } from 'react';

/**
 * The YouTube channel's thumbnail. It is served by YouTube, which can be slow, blocked by a network or missing the HD
 * frame: when it does not load, the card keeps its dark ground instead of showing a broken-image icon.
 */
export function ChannelThumbnail({ src, sizes }: { src: string; sizes: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <Image
      src={src}
      alt=""
      fill
      sizes={sizes}
      onError={() => setFailed(true)}
      style={{ objectFit: 'cover' }}
    />
  );
}
