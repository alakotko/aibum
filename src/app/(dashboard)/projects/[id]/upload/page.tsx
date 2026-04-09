'use client';
import { useState, useCallback } from 'react';
import styles from './upload.module.css';
import { createClient } from '@/utils/supabase/client';

export default function UploadPage({ params }: { params: { id: string } }) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const supabase = createClient();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      setFiles((prev) => [...prev, ...droppedFiles]);
    }
  }, []);

  const handleManualSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...selectedFiles]);
    }
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setProgress(0);

    let completed = 0;
    
    // Process concurrently in small batches to avoid blocking
    for (const file of files) {
      const filePath = `${params.id}/${Date.now()}_${file.name}`;
      
      const { error: storageError } = await supabase.storage
        .from('photos')
        .upload(filePath, file);

      if (!storageError) {
        // Log to photos table
        await supabase.from('photos').insert([
          {
            project_id: params.id,
            storage_path: filePath,
            filename: file.name,
            status: 'uploaded',
          }
        ]);
      }
      
      completed++;
      setProgress(Math.round((completed / files.length) * 100));
    }
    
    setUploading(false);
    // Ideally redirect to Culling view here
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Upload Event Photos</h1>
        <p className={styles.subtitle}>RAW, JPEG, or HEIC. We'll handle the proxy generation.</p>
      </header>

      <div 
        className={`${styles.dropzone} ${isDragging ? styles.activeDropzone : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <div className={styles.iconBox}>
          {/* A simple arrow up icon */}
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        </div>
        <h3>Drag & drop your files here</h3>
        <p>or</p>
        <label className={styles.browseButton}>
          Browse Files
          <input 
            type="file" 
            multiple 
            accept="image/jpeg, image/png, image/webp" 
            style={{ display: 'none' }}
            onChange={handleManualSelection}
          />
        </label>
      </div>

      {files.length > 0 && (
        <div className={styles.uploadQueue}>
          <div className={styles.queueHeader}>
            <h3>Ready to upload: {files.length} images</h3>
            <button className={styles.startBtn} onClick={uploadFiles} disabled={uploading}>
              {uploading ? 'Processing...' : 'Start Upload'}
            </button>
          </div>

          {uploading && (
            <div className={styles.progressBarWrapper}>
              <div className={styles.progressBar} style={{ width: `${progress}%` }}></div>
            </div>
          )}

          <div className={styles.fileList}>
            {files.slice(0, 10).map((file, i) => (
              <div key={i} className={styles.fileItem}>
                <span className={styles.fileName}>{file.name}</span>
                <span className={styles.fileSize}>{(file.size / (1024*1024)).toFixed(2)} MB</span>
              </div>
            ))}
            {files.length > 10 && (
              <div className={styles.fileItemMore}>...and {files.length - 10} more</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
