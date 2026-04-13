'use client';

import { useEffect, useCallback, use, memo, useState } from 'react';
import { useGalleryStore } from '@/store/useGalleryStore';
import { useUploadStore } from '@/store/useUploadStore';
import { createClient } from '@/utils/supabase/client';
import { generateAutoLayout, LayoutSpread } from '@/utils/autoLayout';
import GalleryImage from './GalleryImage';
import styles from './gallery.module.css';

// ─── Gallery Grid Item ──────────────────────────────────────────────────────

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

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function GalleryPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;

  const { photos, selectedPhotoIds, toggleSelection, clearSelection, deleteSelected, fetchProjectPhotos } = useGalleryStore();
  const { addFiles, processQueue } = useUploadStore();

  const [thumbSize, setThumbSize] = useState(200);
  const [activeTab, setActiveTab] = useState<'gallery' | 'album'>('gallery');
  const [spreads, setSpreads] = useState<LayoutSpread[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Persist thumb size
  useEffect(() => {
    const saved = localStorage.getItem('gallery-thumb-size');
    if (saved) setThumbSize(Number(saved));
  }, []);
  useEffect(() => {
    localStorage.setItem('gallery-thumb-size', String(thumbSize));
  }, [thumbSize]);

  // Fetch photos on mount
  useEffect(() => {
    fetchProjectPhotos(projectId);
  }, [projectId, fetchProjectPhotos]);

  // Regenerate album layout whenever photos/selection changes
  useEffect(() => {
    const activePhotos = selectedPhotoIds.length > 0
      ? photos.filter(p => selectedPhotoIds.includes(p.id))
      : photos;
    setSpreads(activePhotos.length > 0 ? generateAutoLayout(activePhotos) : []);
  }, [photos, selectedPhotoIds]);

  // ── Upload handlers ────────────────────────────────────────────────────────

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

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

  // ── Selection handlers ─────────────────────────────────────────────────────

  const handlePhotoClick = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    toggleSelection(id, e.shiftKey);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedPhotoIds.length > 0) {
        deleteSelected();
      }
      if (e.key === 'Escape') clearSelection();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhotoIds, deleteSelected, clearSelection]);

  // ── Album Spread Controls ─────────────────────────────────────────────────

  const setSpreadBg = (id: string, color: string) => {
    setSpreads(prev => prev.map(s => s.id === id ? { ...s, backgroundColor: color } : s));
  };

  const handleRegenerateLayout = () => {
    const activePhotos = selectedPhotoIds.length > 0
      ? photos.filter(p => selectedPhotoIds.includes(p.id))
      : photos;
    setSpreads(activePhotos.length > 0 ? generateAutoLayout(activePhotos) : []);
  };

  const handleExport = async () => {
    setIsSaving(true);
    try {
      const supabase = createClient();

      // 1. Insert album
      const { data: album, error: albumErr } = await supabase
        .from('albums')
        .insert({ project_id: projectId, title: 'Exported Album' })
        .select()
        .single();
      if (albumErr) throw albumErr;

      // 2. Batch-insert all spreads in one round-trip
      const { data: insertedSpreads, error: spreadsErr } = await supabase
        .from('spreads')
        .insert(
          spreads.map((spread, index) => ({
            album_id: album.id,
            page_number: index + 1,
            layout_type: spread.layoutType,
            background_color: spread.backgroundColor,
          }))
        )
        .select();
      if (spreadsErr) throw spreadsErr;

      // 3. Batch-insert all image slots in one round-trip
      const allSlots = insertedSpreads.flatMap((insertedSpread, index) =>
        spreads[index].images.map((img, i) => ({
          spread_id: insertedSpread.id,
          photo_id: img.id,
          z_index: i,
        }))
      );
      if (allSlots.length > 0) {
        const { error: slotsErr } = await supabase.from('image_slots').insert(allSlots);
        if (slotsErr) throw slotsErr;
      }

      alert('Album layout successfully synced to Database!');
    } catch (e: any) {
      console.error('Album Sync Failed:', e);
      alert('Failed to sync album to database: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={styles.container}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* ── Unified Header ───────────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <h1>Media Studio</h1>
          <span className={styles.photoCount}>{photos.length} photos</span>
          {selectedPhotoIds.length > 0 && (
            <span className={styles.selectionBadge}>{selectedPhotoIds.length} selected</span>
          )}
        </div>

        <div className={styles.toolbar}>
          {activeTab === 'gallery' && (
            <>
              <div className={styles.scaleControl}>
                <span>🔲</span>
                <input
                  id="thumb-scale-slider"
                  type="range"
                  min={80}
                  max={400}
                  step={10}
                  value={thumbSize}
                  onChange={(e) => setThumbSize(Number(e.target.value))}
                  className={styles.scaleSlider}
                  title={`Thumbnail size: ${thumbSize}px`}
                />
                <span>🔳</span>
              </div>
              {selectedPhotoIds.length > 0 && (
                <button className={styles.deleteBtn} onClick={deleteSelected}>
                  Delete ({selectedPhotoIds.length})
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
            </>
          )}

          {activeTab === 'album' && (
            <>
              <button className={styles.regenBtn} onClick={handleRegenerateLayout}>
                ↺ Re-shuffle Layout
              </button>
              <button className={styles.exportBtn} onClick={handleExport} disabled={isSaving || spreads.length === 0}>
                {isSaving ? 'Syncing…' : 'Export for Proofing'}
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── Tab Nav ──────────────────────────────────────────────────────── */}
      <div className={styles.tabNav}>
        <button
          id="tab-gallery"
          className={`${styles.tabBtn} ${activeTab === 'gallery' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('gallery')}
        >
          Gallery
        </button>
        <button
          id="tab-album"
          className={`${styles.tabBtn} ${activeTab === 'album' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('album')}
        >
          Album Builder
          {spreads.length > 0 && (
            <span className={styles.spreadCount}>{spreads.length} spreads</span>
          )}
        </button>
      </div>

      {/* ── Gallery Tab ──────────────────────────────────────────────────── */}
      {activeTab === 'gallery' && (
        photos.length === 0 ? (
          <div
            className={styles.emptyState}
            onClick={(e) => { if (e.target === e.currentTarget) clearSelection(); }}
          >
            <h2>Drag and drop photos anywhere to begin</h2>
            <p>Or use the Upload Photos button above</p>
          </div>
        ) : (
          <div
            className={styles.grid}
            style={{ '--thumb-size': `${thumbSize}px` } as React.CSSProperties}
            onClick={(e) => { if (e.target === e.currentTarget) clearSelection(); }}
          >
            {photos.map(photo => (
              <GalleryGridItem
                key={photo.id}
                photo={photo}
                isSelected={selectedPhotoIds.includes(photo.id)}
                onClick={handlePhotoClick}
              />
            ))}
          </div>
        )
      )}

      {/* ── Album Builder Tab ─────────────────────────────────────────────── */}
      {activeTab === 'album' && (
        spreads.length === 0 ? (
          <div className={styles.emptyState}>
            <h2>No photos to build an album from</h2>
            <p>Upload photos in the Gallery tab first, then come back here.</p>
          </div>
        ) : (
          <div className={styles.albumCanvas}>
            {spreads.map((spread, index) => (
              <div key={spread.id} className={styles.spreadWrapper}>
                <div className={styles.spreadControls}>
                  <span className={styles.spreadLabel}>Spread {index + 1} · {spread.images.length} image{spread.images.length !== 1 ? 's' : ''}</span>
                  <div className={styles.colorToggles}>
                    <button
                      className={`${styles.colorBtn} ${styles.colorWhite}`}
                      onClick={() => setSpreadBg(spread.id, '#ffffff')}
                      title="White background"
                    />
                    <button
                      className={`${styles.colorBtn} ${styles.colorBlack}`}
                      onClick={() => setSpreadBg(spread.id, '#161b22')}
                      title="Dark background"
                    />
                  </div>
                </div>

                <div
                  className={`${styles.spreadBox} ${styles['layout_' + spread.layoutType]}`}
                  style={{ backgroundColor: spread.backgroundColor }}
                >
                  <div className={styles.spine} />
                  <div className={styles.slots}>
                    {spread.images.map((img, i) => (
                      <div key={img.id} className={`${styles.imageSlot} ${styles[`slot_${i}`]}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.thumbnailUrl ?? img.url}
                          alt="Album spread"
                          draggable
                          className={styles.spreadImg}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
