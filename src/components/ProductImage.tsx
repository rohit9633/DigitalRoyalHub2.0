import React, { useState } from 'react';
import { Layers } from 'lucide-react';

interface ProductImageProps {
  src: string;
  alt: string;
  className?: string;
}

export const ProductImage: React.FC<ProductImageProps> = ({ src, alt, className = 'w-full h-full object-cover' }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500 p-6 text-center">
        <Layers className="w-8 h-8 stroke-[1.5]" />
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 line-clamp-2 max-w-[200px]">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
