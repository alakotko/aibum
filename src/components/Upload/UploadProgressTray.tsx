'use client';

import { useEffect } from 'react';
import { useUploadStore } from '@/store/useUploadStore';
import styles from './UploadProgressTray.module.css';

export default function UploadProgressTray() {
  const queue = useUploadStore(state => state.queue);
  
  const total = queue.length;
  const completed = queue.filter(item => item.status === 'success').length;
  const error = queue.filter(item => item.status === 'error').length;
  const isUploading = queue.some(item => item.status === 'uploading');
  const isComplete = total > 0 && total === (completed + error);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUploading) {
        e.preventDefault();
        e.returnValue = 'You have active uploads that will be lost. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isUploading]);

  if (queue.length === 0) return null;

  return (
    <div className={styles.tray}>
      <div className={styles.header}>
        <h4>Upload Status</h4>
        <span className={styles.count}>{completed} / {total}</span>
      </div>
      
      {isUploading && (
        <div className={styles.progressContainer}>
           <div className={styles.progressBar} style={{ width: `${(completed / total) * 100}%` }} />
        </div>
      )}
      
      <div className={styles.statusText}>
        {isComplete ? (
          error > 0 ? `${error} uploads failed.` : 'All uploads complete!'
        ) : (
          isUploading ? 'Uploading photos in background...' : 'Pending uploads...'
        )}
      </div>
    </div>
  );
}
