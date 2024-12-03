import EXIF from 'exif-js';
import heic2any from 'heic2any';

export class MetadataService {
  static SUPPORTED_TYPES = [
    'image/jpeg', 
    'image/jpg', 
    'image/heic', 
    'image/heif',
    'image/webp',  // Adding WebP
    'image/png',   // Adding PNG
    'image/gif'    // Adding GIF
  ];

  static validateFile(file) {
    if (!file) {
      throw new Error('No file provided');
    }

    const fileType = file.type.toLowerCase();
    const isSupported = this.SUPPORTED_TYPES.some(type => fileType.includes(type.toLowerCase()));
    
    if (!isSupported) {
      throw new Error(
        `Unsupported file type: ${file.type}. Currently supported formats: JPEG/JPG, HEIC, WebP, PNG, and GIF.`
      );
    }

    if (file.size > 50 * 1024 * 1024) {
      throw new Error('File too large. Maximum size is 50MB.');
    }
  }

  static async extractMetadata(file) {
    try {
      this.validateFile(file);
      
      let processedFile = file;
      // Convert HEIC to JPEG if needed
      if (file.type.toLowerCase().includes('heic')) {
        const jpegBlob = await heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.8
        });
        processedFile = new File([jpegBlob], file.name.replace(/\.heic$/i, '.jpg'), {
          type: 'image/jpeg'
        });
      }
      
      return new Promise((resolve, reject) => {
        EXIF.getData(processedFile, function() {
          try {
            const allMetadata = EXIF.getAllTags(this);
            const convertDMSToDD = MetadataService.convertDMSToDD; // Reference the static method
            
            const metadata = {
              image: {
                make: EXIF.getTag(this, 'Make'),
                model: EXIF.getTag(this, 'Model'),
                software: EXIF.getTag(this, 'Software'),
                orientation: EXIF.getTag(this, 'Orientation'),
                artist: EXIF.getTag(this, 'Artist'),
                copyright: EXIF.getTag(this, 'Copyright'),
                description: EXIF.getTag(this, 'ImageDescription'),
                author: EXIF.getTag(this, 'Author'),
                userComment: EXIF.getTag(this, 'UserComment'),
                ownerName: EXIF.getTag(this, 'OwnerName'),
                creatorTool: EXIF.getTag(this, 'CreatorTool'),
                byline: EXIF.getTag(this, 'Byline'),
                credit: EXIF.getTag(this, 'Credit'),
              },
              exif: {
                exposureTime: EXIF.getTag(this, 'ExposureTime'),
                fNumber: EXIF.getTag(this, 'FNumber'),
                iso: EXIF.getTag(this, 'ISOSpeedRatings'),
                focalLength: EXIF.getTag(this, 'FocalLength'),
                lensMake: EXIF.getTag(this, 'LensMake'),
                lensModel: EXIF.getTag(this, 'LensModel'),
              },
              gps: {
                latitude: this.exifdata.GPSLatitude ? convertDMSToDD(
                  this.exifdata.GPSLatitude,
                  this.exifdata.GPSLatitudeRef
                ) : null,
                longitude: this.exifdata.GPSLongitude ? convertDMSToDD(
                  this.exifdata.GPSLongitude,
                  this.exifdata.GPSLongitudeRef
                ) : null,
                altitude: EXIF.getTag(this, 'GPSAltitude'),
              },
              dateCreated: EXIF.getTag(this, 'DateTimeOriginal'),
              hasMetadata: Object.keys(allMetadata).length > 0,
              raw: {
                ...allMetadata,
                _raw: this.exifdata,
              }
            };
            
            resolve(metadata);
          } catch (error) {
            console.error('Metadata Extraction Error:', error);
            reject(new Error('Failed to extract metadata: ' + error.message));
          }
        });
      });
    } catch (error) {
      throw error;
    }
  }

  static convertDMSToDD(dms, ref) {
    if (!dms || dms.length !== 3) return null;
    
    let dd = dms[0] + dms[1] / 60 + dms[2] / 3600;
    if (ref === 'S' || ref === 'W') {
      dd = dd * -1;
    }
    return dd;
  }

  static async stripMetadata(file) {
    try {
      this.validateFile(file);
      
      let processedFile = file;
      // Convert HEIC to JPEG if needed
      if (file.type.toLowerCase().includes('heic')) {
        const jpegBlob = await heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.8
        });
        processedFile = new File([jpegBlob], file.name.replace(/\.heic$/i, '.jpg'), {
          type: 'image/jpeg'
        });
      }

      return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          
          // First pass - strip metadata through canvas
          canvas.toBlob((firstPassBlob) => {
            // Second pass - create a new image from the first stripped blob
            const secondImg = new Image();
            const secondCanvas = document.createElement('canvas');
            const secondCtx = secondCanvas.getContext('2d');
            
            secondImg.onload = () => {
              secondCanvas.width = secondImg.width;
              secondCanvas.height = secondImg.height;
              secondCtx.drawImage(secondImg, 0, 0);
              
              // Final pass with maximum compression to ensure metadata removal
              secondCanvas.toBlob((finalBlob) => {
                resolve(finalBlob);
              }, 'image/jpeg', 0.95);
            };
            
            secondImg.src = URL.createObjectURL(firstPassBlob);
          }, 'image/jpeg', 1.0);
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };
        
        img.src = URL.createObjectURL(processedFile);
      });
    } catch (error) {
      throw error;
    }
  }
} 