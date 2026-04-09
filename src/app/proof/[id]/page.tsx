'use client';
import { useState, useEffect } from 'react';
import styles from './proof.module.css';
import { generateAutoLayout, LayoutSpread } from '@/utils/autoLayout';
import { useCullStore } from '@/store/useCullStore';

export default function ClientProofingPage({ params }: { params: { id: string } }) {
  // In a real app we fetch this from Supabase where project matching params.id lives.
  // For MVP fluidity, we grab the Zustand store directly.
  const { photos } = useCullStore();
  const [spreads, setSpreads] = useState<LayoutSpread[]>([]);
  const [currentSpread, setCurrentSpread] = useState(0);
  const [comment, setComment] = useState("");

  useEffect(() => {
    // Generate identical layouts mimicking what the database would return
    let currentPhotos = photos;

    const acceptedList = currentPhotos.filter(p => p.status === 'accepted');
    if (acceptedList.length > 0) {
      setSpreads(generateAutoLayout(acceptedList));
    }
  }, [photos]);

  const handleNext = () => {
    if (currentSpread < spreads.length - 1) setCurrentSpread(currentSpread + 1);
  };
  const handlePrev = () => {
    if (currentSpread > 0) setCurrentSpread(currentSpread - 1);
  };

  const submitComment = () => {
    if (!comment.trim()) return;
    console.log("Submitted comment on Spread", currentSpread + 1, ":", comment);
    setComment("");
    alert("Feedback successfully submitted to your photographer!");
  };

  if (spreads.length === 0) return <div className={styles.container}>Loading Studio Link...</div>;

  const sp = spreads[currentSpread];

  return (
    <div className={styles.container}>
      {/* Sticky top bar for client context */}
      <header className={styles.clientHeader}>
        <div className={styles.brandInfo}>
          <h2>Aperture Studios</h2>
          <p>Smith Wedding Premium Book Review</p>
        </div>
        <div className={styles.actionButtons}>
          <button className={styles.approveBtn}>Approve This Spread</button>
          <button className={styles.finalizeBtn}>Finalize Whole Book</button>
        </div>
      </header>

      <div className={styles.mainContent}>
        {/* Gallery / Spread Viewport */}
        <div className={styles.viewport}>
          <div className={styles.navControls}>
            <button onClick={handlePrev} disabled={currentSpread === 0} className={styles.navBtn}>← Previous</button>
            <span className={styles.pageCount}>Spread {currentSpread + 1} / {spreads.length}</span>
            <button onClick={handleNext} disabled={currentSpread === spreads.length - 1} className={styles.navBtn}>Next →</button>
          </div>

          <div className={styles.canvasContainer}>
            <div
              className={`${styles.spreadBox} ${styles['layout_' + sp.layoutType]}`}
              style={{ backgroundColor: sp.backgroundColor }}
            >
              <div className={styles.spine}></div>
              <div className={styles.slots}>
                {sp.images.map((img, i) => (
                  <div key={img.id} className={`${styles.imageSlot} ${styles[`slot_${i}`]}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="Album Content" className={styles.spreadImg} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Comment Sidebar */}
        <aside className={styles.commentSidebar}>
          <div className={styles.commentHeader}>Feedback & Adjustments</div>
          <div className={styles.commentList}>
            <div className={styles.emptyComments}>No comments on this specific spread yet. Review the layout carefully.</div>
          </div>
          <div className={styles.commentInputBox}>
            <textarea
              placeholder="Ask for color correction, crop adjustments, or swap out an image..."
              className={styles.textarea}
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
            <button className={styles.submitBtn} onClick={submitComment}>Send Feedback</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
