'use client';

import { useState, useEffect } from 'react';
import styles from './GalleryImage.module.css';

interface GalleryImageProps {
  src: string;
  alt: string;
  className?: string;
}

export default function GalleryImage({ src, alt, className }: GalleryImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [previousSrc, setPreviousSrc] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (src !== currentSrc) {
      // The prop changed (likely from blob to supabase URL)
      // We keep the current (old) one as the background/previous source
      setPreviousSrc(currentSrc);
      setCurrentSrc(src);
      setIsLoaded(false);
    }
  }, [src, currentSrc]);

  return (
    <div className={`${styles.container} ${className}`}>
      {/* 
        This is the "Background" image. 
        It stays visible while the new source is loading.
      */}
      {previousSrc && !isLoaded && (
        <img
          src={previousSrc}
          alt=""
          className={styles.imagePlaceholder}
          aria-hidden="true"
        />
      )}

      {/* 
        This is the "New/Real" image. 
        It sits on top and only reveals itself once fully loaded.
      */}
      <img
        src={currentSrc}
        alt={alt}
        className={`${styles.imageMain} ${isLoaded ? styles.visible : styles.hidden}`}
        onLoad={() => {
          setIsLoaded(true);
          // Optional: we can clear previousSrc here, but the transition is usually enough
        }}
      />
    </div>
  );
}
