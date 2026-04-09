/**
 * Generates a lightweight blob URL thumbnail from a local File object.
 * Uses an offscreen canvas to resize the image to prevent high memory usage
 * in the browser when 1000+ files are dropped simultaneously.
 */
export async function generateThumbnail(file: File, maxWidth = 800, maxHeight = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions maintaining aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        // Fallback to original blob if canvas fails
        resolve(objectUrl);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // We explicitly revoke the original high-res object URL to save memory!
      URL.revokeObjectURL(objectUrl);

      // Return a lightweight WebP data URL
      resolve(canvas.toDataURL('image/webp', 0.8));
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };

    img.src = objectUrl;
  });
}

/**
 * Converts a data URL (e.g. from canvas.toDataURL) to a Blob
 * so it can be uploaded to Supabase Storage.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const mimeType = header.match(/:(.*?);/)?.[1] ?? 'image/webp';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}
