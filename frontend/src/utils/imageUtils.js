/**
 * Image utility functions for compression and format conversion
 * All profile photos should be converted to WebP format with 200px width
 */

/**
 * Compress and convert an image to WebP format
 * @param {File} file - The original image file
 * @param {Object} options - Configuration options
 * @param {number} options.maxWidth - Maximum width in pixels (default: 200)
 * @param {number} options.quality - Quality 0-1 (default: 0.8)
 * @returns {Promise<Blob>} - The compressed WebP image blob
 */
export const compressImageToWebP = (file, options = {}) => {
  const { maxWidth = 200, quality = 0.8 } = options;
  
  return new Promise((resolve, reject) => {
    // Create an image element to load the file
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      
      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;
      
      // Draw the image on canvas
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to WebP
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Error al convertir imagen a WebP'));
          }
        },
        'image/webp',
        quality
      );
    };
    
    img.onerror = () => {
      reject(new Error('Error al cargar la imagen'));
    };
    
    // Load the image from file
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Process a profile photo: compress, convert to WebP, and prepare for upload
 * @param {File} file - The original image file
 * @param {Object} options - Configuration options
 * @returns {Promise<File>} - A new File object ready for upload
 */
export const processProfilePhoto = async (file, options = {}) => {
  const { maxWidth = 200, quality = 0.8 } = options;
  
  // Compress and convert to WebP
  const webpBlob = await compressImageToWebP(file, { maxWidth, quality });
  
  // Create a new File object with .webp extension
  const originalName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
  const newFileName = `${originalName}.webp`;
  
  return new File([webpBlob], newFileName, { type: 'image/webp' });
};

/**
 * Validate image file before processing
 * @param {File} file - The file to validate
 * @param {Object} options - Validation options
 * @returns {Object} - { valid: boolean, error?: string }
 */
export const validateImageFile = (file, options = {}) => {
  const { maxSizeMB = 5 } = options;
  
  if (!file) {
    return { valid: false, error: 'No se seleccionó ningún archivo' };
  }
  
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'Solo se permiten archivos de imagen' };
  }
  
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return { valid: false, error: `El archivo no debe superar ${maxSizeMB}MB` };
  }
  
  return { valid: true };
};
