import { motion } from 'framer-motion';
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

function PrivacyAlertBanner({ metadata }) {
  // Determine privacy risk level based on metadata
  const getPrivacyLevel = () => {
    const hasLocation = metadata?.gps?.latitude || metadata?.gps?.longitude;
    const hasPersonalInfo = metadata?.image?.artist || 
                           metadata?.image?.copyright || 
                           metadata?.image?.author || 
                           metadata?.image?.ownerName;
    const hasDeviceInfo = metadata?.image?.make || metadata?.image?.model;
    
    if (hasLocation && hasPersonalInfo) {
      return 'critical';
    } else if (hasLocation || hasPersonalInfo) {
      return 'high';
    } else if (hasDeviceInfo) {
      return 'medium';
    } else if (Object.keys(metadata?.raw || {}).length > 0) {
      return 'low';
    } else {
      return 'safe';
    }
  };

  const privacyLevel = getPrivacyLevel();

  const alertConfigs = {
    safe: {
      icon: ShieldCheckIcon,
      color: 'bg-green-50 border-green-100',
      textColor: 'text-green-700',
      iconColor: 'text-green-500',
      title: 'Minimal Privacy Risk',
      description: 'No sensitive metadata detected'
    },
    low: {
      icon: ShieldCheckIcon,
      color: 'bg-blue-50 border-blue-100',
      textColor: 'text-blue-700',
      iconColor: 'text-blue-500',
      title: 'Low Privacy Risk',
      description: 'Basic metadata present but no sensitive information detected'
    },
    medium: {
      icon: ExclamationCircleIcon,
      color: 'bg-yellow-50 border-yellow-100',
      textColor: 'text-yellow-700',
      iconColor: 'text-yellow-500',
      title: 'Medium Privacy Risk',
      description: 'Device information detected'
    },
    high: {
      icon: ExclamationTriangleIcon,
      color: 'bg-orange-50 border-orange-100',
      textColor: 'text-orange-700',
      iconColor: 'text-orange-500',
      title: 'High Privacy Risk',
      description: 'Sensitive information detected (location or personal data)'
    },
    critical: {
      icon: ExclamationTriangleIcon,
      color: 'bg-red-50 border-red-100',
      textColor: 'text-red-700',
      iconColor: 'text-red-500',
      title: 'Critical Privacy Risk',
      description: 'Multiple sensitive data points detected (location and personal info)'
    }
  };

  const config = alertConfigs[privacyLevel];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border ${config.color} p-4`}
    >
      <div className="flex">
        <div className={`flex-shrink-0 ${config.iconColor}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="ml-3">
          <h3 className={`text-sm font-medium ${config.textColor}`}>
            {config.title}
          </h3>
          <div className={`mt-2 text-sm ${config.textColor} opacity-90`}>
            {config.description}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default PrivacyAlertBanner; 