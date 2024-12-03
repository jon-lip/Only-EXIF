import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  DocumentIcon, 
  PhotoIcon, 
  ShieldCheckIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';

function AnalysisProgress({ onComplete, file, error, onReset }) {
  const [progress, setProgress] = useState(0);
  const steps = [
    { 
      icon: DocumentIcon, 
      label: error ? "Unsupported File Type" : "Reading file data...",
      detail: error ? `This file type (.${file.name.split('.').pop()}) is not supported. Please try with JPEG, PNG, HEIC, WebP, or GIF files.` : `Analyzing ${file.name}`
    },
    { 
      icon: PhotoIcon, 
      label: "Scanning metadata...",
      detail: "Extracting EXIF, IPTC, and XMP data"
    },
    { 
      icon: ShieldCheckIcon, 
      label: "Checking for privacy risks...",
      detail: "Identifying sensitive information"
    },
    { 
      icon: CheckCircleIcon, 
      label: "Analysis complete",
      detail: "Preparing results"
    }
  ];

  useEffect(() => {
    if (error) {
      setProgress(25);
      return;
    }

    const duration = 2000;
    const interval = 50;
    const increment = (100 / (duration / interval));
    
    const timer = setInterval(() => {
      setProgress(prev => {
        const next = Math.min(prev + increment, 100);
        if (next === 100) {
          clearInterval(timer);
          setTimeout(onComplete, 500);
        }
        return next;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [onComplete, error]);

  const currentStep = Math.min(Math.floor((progress / 100) * steps.length), steps.length - 1);

  return (
    <div className="min-h-[calc(100vh-120px)] flex flex-col">
      <div className="flex-grow flex items-start pt-12 sm:pt-24 p-4 sm:p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg mx-auto"
        >
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-8">
            <div className="mb-8 flex items-center gap-4">
              <div className="w-12 h-12 flex-shrink-0 bg-gray-100 rounded-lg flex items-center justify-center">
                <PhotoIcon className="w-6 h-6 text-gray-500" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-gray-900 truncate">
                  {file.name}
                </h3>
                <p className="text-sm text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>

            <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden mb-8">
              <motion.div 
                className="absolute inset-y-0 left-0 bg-black rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>

            <div className="space-y-4">
              {steps.map((step, index) => {
                const StepIcon = step.icon;
                const isActive = error ? index === 0 : index === currentStep;
                const isComplete = !error && index < currentStep;
                const isError = error && index === 0;

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ 
                      opacity: (isActive || isComplete) ? 1 : 0.25,
                      x: 0 
                    }}
                    className={`flex items-start gap-3 ${error && index > 0 ? 'opacity-25' : ''}`}
                  >
                    <div className={`p-2 rounded-lg flex-shrink-0 transition-colors ${
                      isError ? 'bg-red-500 text-white' :
                      isActive ? 'bg-black text-white' : 
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {isError ? <ExclamationTriangleIcon className="w-5 h-5" /> : <StepIcon className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium truncate ${
                        isError ? 'text-red-600' :
                        isActive ? 'text-black' : 
                        'text-gray-500'
                      }`}>
                        {step.label}
                      </p>
                      <p className={`text-sm truncate mt-0.5 ${
                        isError ? 'text-red-500' : 'text-gray-500'
                      }`}>
                        {step.detail}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="text-center mt-8">
              {error ? (
                <button
                  onClick={onReset}
                  className="btn-primary bg-black hover:bg-gray-800 text-white px-6 py-2 rounded-lg"
                >
                  Try Another File
                </button>
              ) : (
                <p className="text-sm text-gray-500">
                  Your file is being processed locally in your browser
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default AnalysisProgress; 