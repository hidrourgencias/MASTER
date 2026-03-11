/**
 * Utilidad para capturar fotos desde Cámara o Galería.
 * En Capacitor (APK) usa el plugin nativo; en web usa input file.
 */
const isCapacitor = !!(window as any).Capacitor;

export type PhotoSource = 'camera' | 'gallery';

export async function pickPhoto(source: PhotoSource): Promise<File | null> {
  if (isCapacitor) {
    return pickPhotoCapacitor(source);
  }
  return pickPhotoWeb(source);
}

async function pickPhotoCapacitor(source: PhotoSource): Promise<File | null> {
  try {
    const { Camera } = await import('@capacitor/camera');
    const result = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      source: source === 'camera' ? 'CAMERA' : 'PHOTOS',
      resultType: 'base64'
    });
    if (!result.base64String) return null;
    const bytes = Uint8Array.from(atob(result.base64String), c => c.charCodeAt(0));
    const ext = result.format === 'png' ? 'png' : 'jpg';
    const blob = new Blob([bytes], { type: `image/${ext}` });
    return new File([blob], `photo_${Date.now()}.${ext}`, { type: blob.type });
  } catch (e) {
    console.error('Capacitor Camera error:', e);
    return null;
  }
}

function pickPhotoWeb(source: PhotoSource): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') input.capture = 'environment';
    input.onchange = () => {
      const file = input.files?.[0];
      resolve(file || null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
