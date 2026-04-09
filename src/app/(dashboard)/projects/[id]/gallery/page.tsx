'use client';

import { useEffect, useCallback, use, memo } from 'react';
import { useGalleryStore } from '@/store/useGalleryStore';
import { useUploadStore } from '@/store/useUploadStore';
import GalleryImage from './GalleryImage';
import styles from './gallery.module.css';

// Memoized grid item — only re-renders when THIS photo's selection state changes,
// not when other photos in the list are selected.
const GalleryGridItem = memo(function GalleryGridItem({
  photo,
  isSelected,
  onClick,
}: {
  photo: { id: string; url: string; thumbnailUrl?: string; aiFlags?: string[] };
  isSelected: boolean;
  onClick: (id: string, e: React.MouseEvent) => void;
}) {
  return (
    <div
      className={`${styles.gridItem} ${isSelected ? styles.selected : ''}`}
      onClick={(e) => onClick(photo.id, e)}
    >
      <GalleryImage
        src={photo.thumbnailUrl ?? photo.url}
        alt="Gallery item"
        className={styles.thumbnail}
      />
      <div className={styles.selectionOverlay}>
        <div className={styles.checkbox}></div>
      </div>
      {photo.aiFlags && photo.aiFlags.length > 0 && (
        <div className={styles.badgeWarning}>⚠️ {photo.aiFlags[0]}</div>
      )}
    </div>
  );
});

export default function GalleryPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;

  const { photos, selectedPhotoIds, toggleSelection, clearSelection, deleteSelected, fetchProjectPhotos } = useGalleryStore();
  const { addFiles, processQueue } = useUploadStore();

  useEffect(() => {
    fetchProjectPhotos(projectId);
  }, [projectId, fetchProjectPhotos]);

  // Global Drag & Drop over the gallery
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const processDrop = async (files: File[]) => {
    if (files.length === 0) return;
    await addFiles(files);
    processQueue(projectId).catch(console.error);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processDrop(Array.from(e.dataTransfer.files));
    }
  }, [projectId, addFiles, processQueue]);

  const handleManualUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processDrop(Array.from(e.target.files));
    }
  };

  // Click & Multiselect Logic
  const handlePhotoClick = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    toggleSelection(id, e.shiftKey);
  };

  // Keyboard shortcut for deleting selected photos
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedPhotoIds.length > 0) {
        deleteSelected();
      }
      if (e.key === 'Escape') {
        clearSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhotoIds, deleteSelected, clearSelection]);

  return (
    <div 
      className={styles.container}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={(e) => {
        // Clear selection if clicking on the background
        if (e.target === e.currentTarget) clearSelection();
      }}
    >
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <h1>Media Finder</h1>
          <span className={styles.photoCount}>{photos.length} items</span>
        </div>
        
        <div className={styles.toolbar}>
          {selectedPhotoIds.length > 0 && (
            <button className={styles.deleteBtn} onClick={deleteSelected}>
              Delete Selected ({selectedPhotoIds.length})
            </button>
          )}
          
          <label className={styles.uploadBtn}>
            Upload Photos
            <input 
              type="file" 
              multiple 
              accept="image/jpeg, image/png, image/webp" 
              onChange={handleManualUpload}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </header>

      {photos.length === 0 ? (
        <div className={styles.emptyState}>
          <h2>Drag and drop photos anywhere to begin</h2>
        </div>
      ) : (
        <div className={styles.grid}>
          {photos.map(photo => (
            <GalleryGridItem
              key={photo.id}
              photo={photo}
              isSelected={selectedPhotoIds.includes(photo.id)}
              onClick={handlePhotoClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
