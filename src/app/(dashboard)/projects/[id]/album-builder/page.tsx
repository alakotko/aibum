'use client';
import { useEffect, useState, use } from 'react';
import { createClient } from '@/utils/supabase/client';
import styles from './album.module.css';
import { generateAutoLayout, LayoutSpread } from '@/utils/autoLayout';
import { useGalleryStore } from '@/store/useGalleryStore';

export default function AlbumBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { photos, selectedPhotoIds } = useGalleryStore();
  const [spreads, setSpreads] = useState<LayoutSpread[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Automatically parse photos and generate spreads using heuristics
  useEffect(() => {
    // If user explicitly selected photos, use only those. Otherwise, use all available photos.
    let activePhotos = selectedPhotoIds.length > 0
      ? photos.filter(p => selectedPhotoIds.includes(p.id))
      : photos;

    if (activePhotos.length === 0) {
      setSpreads([]);
      return;
    }

    setSpreads(generateAutoLayout(activePhotos));
  }, [photos, selectedPhotoIds]);

  const setScaleBg = (id: string, color: string) => {
    setSpreads(prev => prev.map(s => s.id === id ? { ...s, backgroundColor: color } : s));
  };

  const handleExport = async () => {
    setIsSaving(true);
    try {
      const supabase = createClient();

      // 1. Create Album
      const { data: album, error: albumErr } = await supabase
        .from('albums')
        .insert({ project_id: resolvedParams.id, title: 'Exported Album' })
        .select()
        .single();

      if (albumErr) throw albumErr;

      // 2. Insert Spreads
      for (const [index, spread] of spreads.entries()) {
        const { data: insertedSpread, error: spreadErr } = await supabase
          .from('spreads')
          .insert({
            album_id: album.id,
            page_number: index + 1,
            layout_type: spread.layoutType,
            background_color: spread.backgroundColor
          })
          .select()
          .single();

        if (spreadErr) throw spreadErr;

        // 3. Insert Image Slots mapping
        if (spread.images.length > 0) {
          const slots = spread.images.map((img, i) => ({
            spread_id: insertedSpread.id,
            // Fallback to standard DB writes assuming photo_id is valid UUID in prod
            photo_id: img.id,
            z_index: i
          }));
          const { error: slotsErr } = await supabase.from('image_slots').insert(slots);
          if (slotsErr) throw slotsErr;
        }
      }
      alert('Album layout successfully synced to Database!');

    } catch (e: any) {
      console.error("Album Sync Failed:", e);
      alert('Failed to sync album to database: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (spreads.length === 0) {
    return <div className={styles.container}>Loading Album Canvas... Ensure you have pulled photos in Milestone 3.</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Album Layout</h1>
          <p className={styles.subtitle}>Auto-generated based on timeline heuristics. You have raw canvas control.</p>
        </div>
        <button className={styles.exportBtn} onClick={handleExport} disabled={isSaving}>
          {isSaving ? 'Syncing...' : 'Export for Client Proofing'}
        </button>
      </header>

      <div className={styles.canvas}>
        {spreads.map((spread, index) => (
          <div key={spread.id} className={styles.spreadWrapper}>
            <div className={styles.spreadControls}>
              <span className={styles.spreadLabel}>Spread {index + 1} • {spread.images.length} Images</span>
              <div className={styles.colorToggles}>
                <button
                  className={`${styles.colorBtn} ${styles.colorWhite}`}
                  onClick={() => setScaleBg(spread.id, '#ffffff')}
                  title="Set to White Bg"
                />
                <button
                  className={`${styles.colorBtn} ${styles.colorBlack}`}
                  onClick={() => setScaleBg(spread.id, '#161b22')}
                  title="Set to Black Bg"
                />
              </div>
            </div>

            {/* The actual 2D representation of an open album (aspect ratio ~ 2:1 since two square/rectangle pages) */}
            <div
              className={`${styles.spreadBox} ${styles['layout_' + spread.layoutType]}`}
              style={{ backgroundColor: spread.backgroundColor }}
            >
              {/* Visual Gutter representing the album spine */}
              <div className={styles.spine}></div>

              {/* Images injected into precise CSS grid slots based on layoutType */}
              <div className={styles.slots}>
                {spread.images.map((img, i) => (
                  <div key={img.id} className={`${styles.imageSlot} ${styles[`slot_${i}`]}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="Album insert" draggable className={styles.spreadImg} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
