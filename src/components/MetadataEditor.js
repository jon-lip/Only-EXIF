import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { MetadataService } from '../services/MetadataService';
import AnalysisProgress from './AnalysisProgress';
import AnalysisResults from './AnalysisResults';
import heic2any from 'heic2any';

function MetadataEditor({ file, onClose }) {
  const [metadata, setMetadata] = useState(null);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [strippingStatus, setStrippingStatus] = useState({
    loading: false,
    success: false,
    error: null,
  });
  const [isAnalyzing, setIsAnalyzing] = useState(true);

  const previewUrlRef = useRef(null);

  const createPreview = useCallback(async () => {
    try {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }

      let previewFile = file;
      // Convert HEIC to JPEG for preview if needed
      if (file.type.toLowerCase().includes('heic')) {
        const jpegBlob = await heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.8
        });
        previewFile = new File([jpegBlob], file.name.replace(/\.heic$/i, '.jpg'), {
          type: 'image/jpeg'
        });
      }

      const objectUrl = URL.createObjectURL(previewFile);
      previewUrlRef.current = objectUrl;
      setPreview(objectUrl);
    } catch (err) {
      setError({
        title: 'Preview Error',
        message: 'Failed to create image preview',
        severity: 'warning'
      });
    }
  }, [file]);

  const loadMetadata = useCallback(async () => {
    try {
      setIsAnalyzing(true);
      setError(null);
      const data = await MetadataService.extractMetadata(file);
      setMetadata(data);
    } catch (err) {
      setError({
        title: 'Failed to Load Metadata',
        message: err.message,
        severity: err.message.includes('Unsupported file type') ? 'warning' : 'error'
      });
    }
  }, [file]);

  useEffect(() => {
    if (file) {
      loadMetadata();
      createPreview();
    }

    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, [file, loadMetadata, createPreview]);

  const handleStripMetadata = async (keepCopyright = false) => {
    try {
      setStrippingStatus({ loading: true, success: false, error: null });
      const strippedFile = await MetadataService.stripMetadata(file, { keepCopyright });
      
      const downloadUrl = URL.createObjectURL(strippedFile);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `clean_${file.name}`;
      link.click();
      
      setStrippingStatus({ 
        loading: false, 
        success: true, 
        error: null 
      });

      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 100);
    } catch (err) {
      setStrippingStatus({ 
        loading: false, 
        success: false, 
        error: err.message 
      });
    }
  };

  if (isAnalyzing) {
    return (
      <AnalysisProgress 
        file={file}
        error={error}
        onReset={() => onClose(true)}
        onComplete={() => {
          if (metadata) {
            setIsAnalyzing(false);
          }
        }} 
      />
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 border border-red-100">
        <div className="flex items-start">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mt-0.5" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">{error.title}</h3>
            <p className="mt-1 text-sm text-red-700">{error.message}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto bg-red-50 text-red-500 hover:text-red-600 px-2 py-1 rounded"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <AnalysisResults
      file={file}
      metadata={metadata}
      preview={preview}
      onClean={handleStripMetadata}
      strippingStatus={strippingStatus}
      onReset={() => onClose(true)}
    />
  );
}

export default MetadataEditor; 