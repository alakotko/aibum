'use client';

import styles from './GalleryImage.module.css';

interface GalleryImageProps {
  src: string;
  alt: string;
  className?: string;
}

export default function GalleryImage({ src, alt, className }: GalleryImageProps) {
  return (
    <div className={`${styles.container} ${className}`}>
      <img
        src={src}
        alt={alt}
        className={styles.imageMain}
      />
    </div>
  );
}
