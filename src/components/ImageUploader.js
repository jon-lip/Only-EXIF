import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import {
  ArrowUpTrayIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

function ImageUploader({ onFileSelect }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.tiff']
    },
    maxFiles: 1,
    onDrop: files => files?.[0] && onFileSelect(files[0])
  });

  return (
    <div className="min-h-[calc(100vh-120px)] flex flex-col">
      <div className="flex-grow flex items-start pt-16 sm:pt-24 p-4 sm:p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl mx-auto space-y-6 sm:space-y-8"
        >
          {/* Header */}
          <div className="text-center space-y-1.5">
            <h2 className="text-2xl sm:text-3xl font-bold">Analyze Your Image</h2>
            <p className="text-gray-600">Check and clean metadata before sharing</p>
          </div>

          {/* Upload Area */}
          <div {...getRootProps()} 
            className={`relative group cursor-pointer
              border-2 border-dashed rounded-xl 
              transition-all duration-200 ease-in-out
              ${isDragActive 
                ? 'border-black bg-gray-50' 
                : 'border-gray-200 hover:border-gray-300'
              }
            `}
          >
            <input {...getInputProps()} />
            
            {/* Upload Content */}
            <div className="p-6 sm:p-10 flex flex-col items-center justify-center text-center space-y-4">
              <div className={`p-4 rounded-full bg-gray-50 group-hover:bg-gray-100 
                transition-colors duration-200
                ${isDragActive ? 'bg-gray-100' : ''}`}
              >
                <ArrowUpTrayIcon className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
              </div>
              
              <div className="space-y-2">
                <p className="text-base sm:text-lg font-medium text-gray-700">
                  {isDragActive ? 'Drop your image here' : 'Drag & drop your image'}
                </p>
                <p className="text-sm text-gray-500">or click to browse</p>
              </div>

              {/* Supported Formats */}
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {['.JPG', '.PNG', '.GIF', '.TIFF'].map(format => (
                  <span key={format} 
                    className="px-2 py-1 text-xs font-medium text-gray-500 
                             bg-gray-50 rounded-md">
                    {format}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <InfoCard 
              icon={ShieldCheckIcon}
              title="Private & Secure"
              description="Files are processed locally in your browser"
            />
            <InfoCard 
              icon={ExclamationTriangleIcon}
              title="What We Check"
              description="Location, device info, timestamps, and more"
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-gray-50 border border-gray-100">
      <Icon className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
      <div>
        <h3 className="font-medium text-gray-900">{title}</h3>
        <p className="text-gray-600 text-sm mt-0.5">{description}</p>
      </div>
    </div>
  );
}

export default ImageUploader; 