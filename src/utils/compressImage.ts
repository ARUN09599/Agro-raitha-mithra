/**
 * Compresses uploaded crop/soil photos & live camera snapshots client-side
 * (max 768px AI upload + compact 280px timeline thumbnail)
 * for ultra-fast mobile & village-network uploads without timeouts.
 */

export async function createThumbnailFromDataUrl(
  dataUrl: string,
  maxDim = 280
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let width = img.naturalWidth || maxDim;
      let height = img.naturalHeight || maxDim;
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.56));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function compressVideoFrameToPayload(video: HTMLVideoElement): {
  mimeType: string;
  dataBase64: string;
  previewUrl: string;
  thumbUrl: string;
} {
  const maxDim = 768;
  let width = video.videoWidth || 768;
  let height = video.videoHeight || 576;
  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not read camera frame.');
  }
  ctx.drawImage(video, 0, 0, width, height);
  const previewUrl = canvas.toDataURL('image/jpeg', 0.72);

  // Compact 280px thumbnail for localStorage timeline history
  const thumbMax = 280;
  let tW = width;
  let tH = height;
  if (tW > thumbMax || tH > thumbMax) {
    if (tW >= tH) {
      tH = Math.round((tH * thumbMax) / tW);
      tW = thumbMax;
    } else {
      tW = Math.round((tW * thumbMax) / tH);
      tH = thumbMax;
    }
  }
  const tCanvas = document.createElement('canvas');
  tCanvas.width = tW;
  tCanvas.height = tH;
  const tCtx = tCanvas.getContext('2d');
  let thumbUrl = previewUrl;
  if (tCtx) {
    tCtx.drawImage(canvas, 0, 0, tW, tH);
    thumbUrl = tCanvas.toDataURL('image/jpeg', 0.56);
  }

  return {
    mimeType: 'image/jpeg',
    dataBase64: previewUrl.split(',')[1] ?? '',
    previewUrl,
    thumbUrl,
  };
}

export async function compressImageFile(file: File): Promise<{
  mimeType: string;
  dataBase64: string;
  previewUrl: string;
  thumbUrl: string;
}> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

  if (file.size <= 60 * 1024) {
    const thumbUrl = await createThumbnailFromDataUrl(rawDataUrl, 280);
    return {
      mimeType: file.type || 'image/jpeg',
      dataBase64: rawDataUrl.split(',')[1] ?? '',
      previewUrl: rawDataUrl,
      thumbUrl,
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = async () => {
      const maxDim = 768;
      let width = img.naturalWidth || 768;
      let height = img.naturalHeight || 768;
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        const thumbUrl = await createThumbnailFromDataUrl(rawDataUrl, 280);
        resolve({
          mimeType: file.type || 'image/jpeg',
          dataBase64: rawDataUrl.split(',')[1] ?? '',
          previewUrl: rawDataUrl,
          thumbUrl,
        });
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const compressedUrl = canvas.toDataURL('image/jpeg', 0.72);
      const thumbUrl = await createThumbnailFromDataUrl(compressedUrl, 280);
      resolve({
        mimeType: 'image/jpeg',
        dataBase64: compressedUrl.split(',')[1] ?? '',
        previewUrl: compressedUrl,
        thumbUrl,
      });
    };
    img.onerror = async () => {
      const thumbUrl = await createThumbnailFromDataUrl(rawDataUrl, 280);
      resolve({
        mimeType: file.type || 'image/jpeg',
        dataBase64: rawDataUrl.split(',')[1] ?? '',
        previewUrl: rawDataUrl,
        thumbUrl,
      });
    };
    img.src = rawDataUrl;
  });
}
