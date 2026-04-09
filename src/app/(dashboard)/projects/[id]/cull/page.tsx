'use client';
import { useEffect, use } from 'react';
import styles from './cull.module.css';
import { useCullStore } from '@/store/useCullStore';

export default function CullPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { photos, currentIndex, setCurrentIndex, acceptCurrent, rejectCurrent, analyzePhotos, fetchProjectPhotos } = useCullStore();

  // On mount, hydrate the Culler Room from native Postgres state, then trigger the AI Engine
  useEffect(() => {
    const initRoom = async () => {
      // 1. Grab Native UUID Postgres Database Rows if we aren't using the local demo "123" route
      if (resolvedParams.id !== '123') {
        await fetchProjectPhotos(resolvedParams.id);
      }
      
      // 2. Pass those exact Native rows through AWS Rekognition
      await analyzePhotos();
    };
    initRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams.id]);

  // Keyboard controls explicitly bound as requested
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          setCurrentIndex(currentIndex + 1);
          break;
        case 'ArrowLeft':
          setCurrentIndex(currentIndex - 1);
          break;
        case ' ':
          e.preventDefault();
          acceptCurrent();
          break;
        case 'x':
        case 'X':
          rejectCurrent();
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, setCurrentIndex, acceptCurrent, rejectCurrent, photos.length]);

  if (photos.length === 0) return <div className={styles.container}>Loading...</div>;

  const currentPhoto = photos[currentIndex];

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.stats}>
          Reviewed: {photos.filter(p => p.status !== 'pending').length} / {photos.length}
        </div>
        <div className={styles.controls}>
          <div className={styles.keyBind}><kbd>Space</kbd> Keep</div>
          <div className={styles.keyBind}><kbd>X</kbd> Reject</div>
          <div className={styles.keyBind}><kbd>←</kbd> <kbd>→</kbd> Navigate</div>
        </div>
        <button className={styles.saveBtn}>Save Shortlist</button>
      </div>

      <div className={styles.mainArea}>
        <div className={styles.filmstrip}>
          {photos.map((photo, i) => (
            <div 
              key={photo.id} 
              className={`${styles.thumbnail} ${i === currentIndex ? styles.thumbnailActive : ''} ${styles['status_' + photo.status]}`}
              onClick={() => setCurrentIndex(i)}
            >
              <img src={photo.url} alt={`Thumbnail ${i}`} className={styles.thumbImg} />
              {photo.status === 'accepted' && <div className={styles.indicatorKeep}></div>}
              {photo.status === 'rejected' && <div className={styles.indicatorReject}></div>}
            </div>
          ))}
        </div>

        <div className={styles.previewContainer}>
          {currentPhoto.aiFlags && currentPhoto.aiFlags.length > 0 && (
            <div className={styles.aiWarning}>
              ⚠️ AI Flag: {currentPhoto.aiFlags.join(', ')}
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={currentPhoto.url} 
            alt="Current review" 
            className={styles.previewImage}
          />
        </div>
      </div>
    </div>
  );
}
