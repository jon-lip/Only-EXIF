import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ExclamationTriangleIcon,
  MapPinIcon,
  CameraIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  ArrowUpTrayIcon,
  CodeBracketIcon,
  HeartIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { FixedSizeList as List } from 'react-window';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import PrivacyAlertBanner from './PrivacyAlertBanner';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Move getMetadataWarnings before the shared components
function getMetadataWarnings(metadata) {
  console.log('Full metadata for warnings:', {
    image: metadata?.image,
    raw: metadata?.raw,
    exif: metadata?.exif,
    ImageDescription: metadata?.raw?.ImageDescription || metadata?.image?.ImageDescription || metadata?.exif?.ImageDescription
  });

  const warnings = [];

  if (metadata?.gps?.latitude || metadata?.gps?.longitude) {
    warnings.push({
      type: 'high',
      icon: <MapPinIcon className="w-6 h-6" />,
      title: 'Location Data Found',
      details: `GPS coordinates detected: ${metadata.gps.latitude}, ${metadata.gps.longitude}`,
      recommendation: 'Consider removing location data before sharing'
    });
  }

  // Check for any personal information
  const personalInfo = [];
  if (metadata?.image?.artist) personalInfo.push(`Artist: ${metadata.image.artist}`);
  if (metadata?.image?.copyright) personalInfo.push(`Copyright: ${metadata.image.copyright}`);
  if (metadata?.image?.description) personalInfo.push(`Description: ${metadata.image.description}`);
  if (metadata?.image?.author) personalInfo.push(`Author: ${metadata.image.author}`);
  if (metadata?.image?.userComment) personalInfo.push(`Comment: ${metadata.image.userComment}`);
  if (metadata?.image?.ownerName) personalInfo.push(`Owner: ${metadata.image.ownerName}`);
  if (metadata?.image?.byline) personalInfo.push(`Byline: ${metadata.image.byline}`);
  if (metadata?.image?.credit) personalInfo.push(`Credit: ${metadata.image.credit}`);

  // Also check raw metadata for any fields containing 'name', 'author', 'person'
  Object.entries(metadata?.raw || {}).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();
    if ((lowerKey.includes('name') || lowerKey.includes('author') || lowerKey.includes('person')) 
        && value && typeof value === 'string') {
      personalInfo.push(`${key}: ${value}`);
    }
  });

  if (personalInfo.length > 0) {
    warnings.push({
      type: 'high',
      icon: <ExclamationTriangleIcon className="w-6 h-6" />,
      title: 'Personal Information',
      details: `Found ${personalInfo.join(' and ')}`,
      recommendation: 'Review and remove personal identifiers before sharing'
    });
  }

  if (metadata?.image?.make || metadata?.image?.model) {
    warnings.push({
      type: 'medium',
      icon: <CameraIcon className="w-6 h-6" />,
      title: 'Device Information',
      details: `Camera: ${metadata.image.make} ${metadata.image.model}`,
      recommendation: 'Consider anonymizing device information'
    });
  }

  return warnings;
}

// Shared Components
function ImagePreview({ preview, file, metadata, className = "" }) {
  return (
    <div className={`bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 overflow-hidden ${className}`}>
      <div className="p-4">
        <div className="aspect-w-4 aspect-h-3 bg-gray-50 rounded-lg overflow-hidden">
          {preview && (
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-contain"
            />
          )}
        </div>
        
        <div className="mt-4 space-y-2">
          <BasicInfo file={file} metadata={metadata} />
        </div>
      </div>
    </div>
  );
}

function BasicInfo({ file, metadata }) {
  console.log('Metadata in BasicInfo:', {
    image: metadata?.image,
    exif: metadata?.exif,
    raw: metadata?.raw
  });

  const fileType = file.name.split('.').pop().toUpperCase();
  
  // Get dimensions from metadata - check all possible locations
  const width = metadata?.raw?.PixelXDimension || metadata?.image?.width || metadata?.exif?.ExifImageWidth;
  const height = metadata?.raw?.PixelYDimension || metadata?.image?.height || metadata?.exif?.ExifImageHeight;

  return (
    <>
      <div className="flex justify-between items-start gap-2 text-sm">
        <span className="text-gray-500 flex-shrink-0">File name</span>
        <span className="font-medium text-right truncate">
          {file.name}
        </span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Size</span>
        <span className="font-medium">
          {(file.size / 1024 / 1024).toFixed(2)} MB
        </span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Type</span>
        <span className="font-medium">
          {fileType}
        </span>
      </div>
      {(width && height) && (
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Dimensions</span>
          <span className="font-medium">
            {width} × {height} px
          </span>
        </div>
      )}
    </>
  );
}

function WarningsSection({ metadata, className = "", onToggleKeep }) {
  return (
    <div className={`bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 overflow-hidden ${className}`}>
      <div className="p-4 space-y-3">
        {metadata && getMetadataWarnings(metadata).map((warning, index) => (
          <WarningCard 
            key={index} 
            warning={warning} 
            index={index} 
            onToggleKeep={onToggleKeep}
          />
        ))}
      </div>
    </div>
  );
}

function WarningCard({ warning, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`group relative p-2.5 sm:p-3 rounded-xl border transition-all duration-200 
        hover:shadow-sm hover:transform hover:scale-[1.01]
        ${warning.type === 'high' 
          ? 'bg-red-50/30 border-red-100 hover:border-red-200 hover:bg-red-50/50' 
          : 'bg-amber-50/30 border-amber-100 hover:border-amber-200 hover:bg-amber-50/50'
        }`}
    >
      <div className="flex gap-4">
        <div className={`flex-shrink-0 p-3 rounded-xl
          ${warning.type === 'high'
            ? 'bg-red-100 text-red-600'
            : 'bg-amber-100 text-amber-600'
          }`}
        >
          {warning.icon}
        </div>
        <div className="space-y-2">
          <h3 className={`text-lg font-semibold
            ${warning.type === 'high' ? 'text-red-900' : 'text-amber-900'}
          `}>
            {warning.title}
          </h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            {warning.details}
          </p>
          <div className="flex flex-col space-y-1.5">
            <span className={`text-sm font-medium
              ${warning.type === 'high' ? 'text-red-600' : 'text-amber-600'}
            `}>
              Recommendation:
            </span>
            <span className="text-gray-600 text-sm">
              {warning.recommendation}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ActionButton({ onClean, strippingStatus, metadata }) {
  return (
    <div className="space-y-2">
      <button
        onClick={onClean}
        disabled={strippingStatus.loading || !metadata?.hasMetadata}
        className="btn-primary w-full flex items-center justify-center py-3"
      >
        <ShieldCheckIcon className="w-5 h-5 mr-2 flex-shrink-0" />
        {strippingStatus.loading ? 'Cleaning...' : 'Save Clean Copy'}
      </button>
      <p className="text-xs text-gray-500 text-center">
        Creates a new file with all metadata removed
      </p>
      <p className="text-[11px] text-gray-400 text-center mt-2">
        While we strive for accuracy, we cannot guarantee the detection or removal of all metadata. Use with discretion.
      </p>
    </div>
  );
}

function AnalysisResults({ file, metadata, preview, onClean, strippingStatus, onReset }) {
  const [activeTab, setActiveTab] = useState('simple');
  const [expandedSection, setExpandedSection] = useState('preview');
  const [keepCopyright, setKeepCopyright] = useState(false);

  const handleClean = () => {
    onClean(keepCopyright); // Pass the keepCopyright flag to the cleaning function
  };

  const handleToggleKeep = (field, value) => {
    if (field === 'copyright') {
      setKeepCopyright(value);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col overscroll-behavior-y-contain">
      <main className="flex-1">
        {/* Desktop Layout */}
        <div className="hidden lg:block max-w-7xl mx-auto px-6 sm:px-8 py-4 sm:py-6">
          {/* Background decoration */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-gray-50" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] opacity-30 blur-3xl rounded-full bg-gradient-to-br from-gray-200 to-white" />
          </div>

          {/* Two column grid for preview and metadata */}
          <div className="grid grid-cols-12 gap-3 sm:gap-4 mb-6">
            {/* Left Column */}
            <div className="col-span-5 space-y-3 sm:space-y-4">
              <ImagePreview preview={preview} file={file} metadata={metadata} />
              <PrivacyAlertBanner metadata={metadata} />
              <WarningsSection metadata={metadata} />
            </div>

            {/* Right Column - Metadata Details */}
            <div className="col-span-7">
              <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                {/* Enhanced Tab Navigation */}
                <div className="border-b border-gray-100 bg-white/95 backdrop-blur-sm sticky top-0 z-10">
                  <nav className="flex px-3">
                    {['simple', 'advanced'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`py-2.5 px-3 text-sm font-medium border-b-2 transition-colors
                          ${activeTab === tab
                            ? 'border-black text-black'
                            : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'
                          }
                        `}
                      >
                        {tab === 'simple' ? 'Simple View' : 'Advanced View'}
                      </button>
                    ))}
                  </nav>
                </div>

                <div className="p-4 overflow-y-auto">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {activeTab === 'simple' ? (
                        <SimpleView metadata={metadata} />
                      ) : (
                        <AdvancedView metadata={metadata} />
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button - Centered below the columns */}
          <div className="flex justify-center">
            <div className="max-w-sm w-full">
              <ActionButton onClean={onClean} strippingStatus={strippingStatus} metadata={metadata} />
            </div>
          </div>
        </div>

        {/* Mobile Layout - Add proper padding */}
        <div className="lg:hidden pt-4 sm:pt-6">
          {/* Image Preview */}
          <div className="px-4 sm:px-6 mb-6">
            <div className="aspect-w-4 aspect-h-3 bg-gray-50 rounded-lg overflow-hidden">
              {preview && (
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-full object-contain"
                />
              )}
            </div>
            
            <div className="mt-4">
              <PrivacyAlertBanner metadata={metadata} />
            </div>
          </div>

          {/* Warnings Section - Adjusted spacing */}
          <div className="px-4 sm:px-6 mb-6 -mt-2">
            <div className="space-y-4">
              {metadata && getMetadataWarnings(metadata).map((warning, index) => (
                <WarningCard 
                  key={index} 
                  warning={warning} 
                  index={index}
                />
              ))}
            </div>
          </div>
          
          {/* Metadata Details Section */}
          <div className="divide-y divide-gray-200 mb-6">
            <button 
              onClick={() => setExpandedSection(expandedSection === 'metadata' ? null : 'metadata')}
              className="w-full flex items-center justify-between px-4 sm:px-6 py-4"
            >
              <span className="font-medium text-sm sm:text-base text-gray-900">
                {expandedSection === 'metadata' ? 'Detailed Information' : 'View Detailed Information'}
              </span>
              <ChevronDownIcon className="w-5 h-5 text-gray-500 transition-transform" />
            </button>
            
            {expandedSection === 'metadata' && (
              <div className="px-4 sm:px-6 py-4">
                {activeTab === 'simple' ? (
                  <SimpleView metadata={metadata} />
                ) : (
                  <AdvancedView metadata={metadata} />
                )}
              </div>
            )}
          </div>

          {/* Mobile Action Button */}
          <div className="sticky bottom-0 bg-white/80 backdrop-blur-sm py-4 px-4 sm:px-6 border-t border-gray-200 z-50">
            <ActionButton onClean={onClean} strippingStatus={strippingStatus} metadata={metadata} />
          </div>
        </div>
      </main>

      {/* Notifications - tighter mobile spacing */}
      <div className="fixed bottom-4 right-3 left-3 sm:left-auto sm:right-6 space-y-2 z-50">
        <AnimatePresence>
          {strippingStatus.success && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-green-50 text-green-800 px-4 py-3 rounded-lg shadow-lg border border-green-100"
            >
              Metadata successfully removed and file downloaded
            </motion.div>
          )}

          {strippingStatus.error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-red-50 text-red-800 px-4 py-3 rounded-lg shadow-lg border border-red-100"
            >
              {strippingStatus.error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer - full width */}
      <div className="bg-black">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-12 sm:py-16">
          <div className="max-w-[600px] mx-auto text-center space-y-4 sm:space-y-6">
            <h2 className="text-lg sm:text-2xl font-semibold text-white mb-3 sm:mb-4">
              Ready to Check Another Image?
            </h2>
            <p className="text-gray-400 text-sm sm:text-base mb-4 sm:mb-6">
              Keep your photos and designs private by checking them for hidden data
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 mb-6 sm:mb-8">
              <button
                onClick={onReset}
                className="btn-primary bg-white text-black hover:bg-gray-100 w-full sm:w-auto px-4 sm:px-6 py-2.5 flex items-center justify-center"
              >
                <ArrowUpTrayIcon className="h-5 w-5 mr-2 flex-shrink-0" />
                <span>Check Another Image</span>
              </button>
              <a
                href="https://github.com/jon-lip/onlyexif"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline border-white/20 text-white hover:bg-white/10 w-full sm:w-auto px-4 sm:px-6 py-2.5 flex items-center justify-center"
              >
                <CodeBracketIcon className="h-5 w-5 mr-2 flex-shrink-0" />
                <span>View Source</span>
              </a>
            </div>

            <div className="border-t border-white/10 pt-4 sm:pt-6">
              <p className="text-xs sm:text-sm text-gray-400">
                OnlyEXIF is free and will always be. If you find it useful, consider{' '}
                <a
                  href="https://buymeacoffee.com/jonlip"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white hover:text-gray-200 underline underline-offset-2"
                >
                  supporting the project
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SimpleView({ metadata }) {
  return (
    <div className="w-full">
      <div className="space-y-6">
        {['Basic Info', 'Camera Info', 'Location Info'].map((section, index) => (
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Section
              title={section}
              icon={[InformationCircleIcon, CameraIcon, MapPinIcon][index]}
              items={getItemsForSection(section, metadata)}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, items }) {
  const hasGPS = items.some(item => 
    (item.label === "Latitude" || item.label === "Longitude") && item.value != null
  );
  
  const hasItems = items.some(item => item.value != null);
  
  if (!hasItems) return null;

  const latitude = items.find(item => item.label === "Latitude")?.value;
  const longitude = items.find(item => item.label === "Longitude")?.value;

  return (
    <div className="bg-gray-50/50 rounded-xl p-4 hover:bg-gray-50/80 transition-colors">
      <div className="flex items-center mb-3">
        <div className="p-2 bg-white rounded-lg mr-3">
          <Icon className="w-5 h-5 text-gray-500" />
        </div>
        <h2 className="text-base font-medium text-gray-900">{title}</h2>
      </div>
      
      <div className="space-y-2.5">
        {items.map((item, index) => (
          item.value != null && (
            <div key={index} className="group flex justify-between items-center">
              <dt className="text-sm text-gray-500">{item.label}</dt>
              <dd className="text-sm font-medium text-gray-900 break-all">
                {item.value.toString()}
              </dd>
            </div>
          )
        ))}
        
        {/* Add map if GPS coordinates are present */}
        {title === 'Location Info' && hasGPS && latitude && longitude && (
          <div className="mt-4 rounded-lg overflow-hidden border border-gray-200 relative z-10">
            <MapContainer 
              center={[latitude, longitude]} 
              zoom={13} 
              style={{ height: '200px', width: '100%' }}
              zoomControl={false}
              attributionControl={false}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <Marker position={[latitude, longitude]} />
            </MapContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function AdvancedView({ metadata }) {
  const [expandedKeys, setExpandedKeys] = useState(new Set());
  
  if (!metadata?.raw) return null;
  const items = Object.entries(metadata.raw);

  const toggleExpand = (key) => {
    const newExpanded = new Set(expandedKeys);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedKeys(newExpanded);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Raw Metadata</h2>
        <span className="text-xs px-2.5 py-1 bg-gray-100 rounded-full text-gray-600 font-medium">
          {items.length} fields
        </span>
      </div>

      <div className="bg-gray-900 rounded-xl overflow-hidden shadow-sm border border-gray-800">
        <div className="p-1">
          {items.map(([key, value], index) => {
            const isObject = typeof value === 'object' && value !== null;
            const isExpanded = expandedKeys.has(key);

            return (
              <motion.div 
                key={key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="p-2 rounded-lg hover:bg-gray-800/50 transition-colors"
              >
                <button 
                  onClick={() => isObject && toggleExpand(key)}
                  className={`w-full text-left flex items-start gap-2 ${isObject ? 'cursor-pointer' : ''}`}
                >
                  <span className="font-mono text-sm text-blue-400">{key}</span>
                  {isObject && (
                    <span className="text-xs bg-gray-800 px-1.5 py-0.5 rounded text-gray-400 font-mono">
                      {Object.keys(value).length} fields
                    </span>
                  )}
                </button>
                
                <AnimatePresence>
                  {(!isObject || isExpanded) && (
                    <motion.pre
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-1 font-mono text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap"
                    >
                      {JSON.stringify(value, null, 2)}
                    </motion.pre>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getItemsForSection(section, metadata) {
  switch (section) {
    case 'Basic Info':
      return [
        { label: "Software", value: metadata?.image.software },
        { label: "Artist", value: metadata?.image.artist },
        { label: "Copyright", value: metadata?.image.copyright },
        { label: "Date Created", value: metadata?.dateCreated },
      ];
    case 'Camera Info':
      return [
        { label: "Camera Make", value: metadata?.image.make },
        { label: "Camera Model", value: metadata?.image.model },
        { label: "Lens", value: metadata?.exif.lensModel },
        { label: "Exposure", value: metadata?.exif.exposureTime },
        { label: "F-Number", value: metadata?.exif.fNumber },
        { label: "ISO", value: metadata?.exif.iso },
      ];
    case 'Location Info':
      return [
        { label: "Latitude", value: metadata?.gps.latitude },
        { label: "Longitude", value: metadata?.gps.longitude },
        { label: "Altitude", value: metadata?.gps.altitude },
      ];
    default:
      return [];
  }
}

export default AnalysisResults; 