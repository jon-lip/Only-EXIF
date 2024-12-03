import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  PhotoIcon,
  ArrowUpTrayIcon,
  CodeBracketIcon,
  HeartIcon,
  ShieldCheckIcon,
  MapPinIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import MetadataEditor from './components/MetadataEditor';
import ImageUploader from './components/ImageUploader';
import { Routes, Route, Link } from 'react-router-dom';
import Blog from './components/Blog';

function App() {
  const [file, setFile] = useState(null);
  const [showUploader, setShowUploader] = useState(false);
  const [heroTextIndex, setHeroTextIndex] = useState(0);
  const [currentAlertIndex, setCurrentAlertIndex] = useState(0);
  const [featuredPost, setFeaturedPost] = useState(null);

  const heroMessages = [
    {
      title: "Free EXIF Metadata Viewer & Editor",
      subtitle: "View and remove hidden metadata from your photos before sharing online. Protect your privacy with our free tool."
    },
    {
      title: "Protect Your Privacy Before Sharing",
      subtitle: "From social media photos to design exports - ensure your content is clean of sensitive data."
    },
    {
      title: "Free, Private, and Secure",
      subtitle: "No uploads needed. Analyze photos and graphics right in your browser."
    },
    {
      title: "Take Control of Your Content",
      subtitle: "Professional metadata tools for photographers, designers, and everyone in between."
    }
  ];

  const demoSecurityAlerts = [
    {
      type: 'high',
      icon: <MapPinIcon className="w-6 h-6" />,
      title: 'Location Data Detected',
      details: 'GPS coordinates and location tags found in your image.',
      recommendation: 'Remove location data before sharing'
    },
    {
      type: 'high',
      icon: <ExclamationTriangleIcon className="w-6 h-6" />,
      title: 'Personal Information Found',
      details: 'Creator names and contact details embedded in file.',
      recommendation: 'Remove personal identifiers'
    },
    {
      type: 'high',
      icon: <ShieldCheckIcon className="w-6 h-6" />,
      title: 'Device Information',
      details: 'Camera and device identifiers detected.',
      recommendation: 'Anonymize device info'
    },
    {
      type: 'medium',
      icon: <ClockIcon className="w-6 h-6" />,
      title: 'Timestamp Data',
      details: 'Creation and modification dates found.',
      recommendation: 'Clean if time data is sensitive'
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroTextIndex((prev) => (prev + 1) % heroMessages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [heroMessages.length]);

  useEffect(() => {
    const updateScrollProgress = () => {
      const scrolled = window.scrollY;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = (scrolled / height) * 100;
      document.documentElement.style.setProperty('--scroll-percent', `${scrollPercent}%`);
    };

    window.addEventListener('scroll', updateScrollProgress);
    return () => window.removeEventListener('scroll', updateScrollProgress);
  }, []);

  useEffect(() => {
    fetch('/blog/posts/posts.json')
      .then(response => response.json())
      .then(data => {
        const randomPost = data.posts[Math.floor(Math.random() * data.posts.length)];
        setFeaturedPost(randomPost);
      })
      .catch(error => console.error('Error loading featured post:', error));
  }, []);

  const handleReset = (toUploader = false) => {
    setFile(null);
    setShowUploader(toUploader);
  };

  const exampleImages = [
    {
      file: 'IMG_4005.JPG',
      description: 'Example with GPS location and camera info'
    },
    {
      file: '2019_02_17_The_Ritz_Carlton_Berlin_Social_Stills_Feb_2019_0289.jpg',
      description: 'Example with location and copyright metadata'
    }
  ];

  const loadExampleImage = async () => {
    try {
      const example = exampleImages[Math.floor(Math.random() * exampleImages.length)];
      const response = await fetch(`/${example.file}`);
      const blob = await response.blob();
      const file = new File([blob], example.file, { type: 'image/jpeg' });
      setFile(file);
    } catch (error) {
      console.error('Failed to load example image:', error);
    }
  };

  const nextAlert = () => {
    setCurrentAlertIndex((prev) => (prev + 1) % demoSecurityAlerts.length);
  };

  const prevAlert = () => {
    setCurrentAlertIndex((prev) => (prev - 1 + demoSecurityAlerts.length) % demoSecurityAlerts.length);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col overscroll-behavior-y-contain">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between p-4">
          <button 
            onClick={() => handleReset(false)}
            className="flex items-center space-x-1.5 hover:opacity-80 transition-opacity"
          >
            <PhotoIcon className="h-7 w-7" />
            <span className="text-lg font-bold tracking-tight font-inter">OnlyEXIF</span>
          </button>
          
          <div className="flex items-center space-x-2">
            <Link
              to="/blog/index.html"
              target="_blank"
              className="p-2 text-gray-500 hover:text-gray-700 flex items-center gap-2"
            >
              <span className="font-medium">Blog</span>
            </Link>
            <a
              href="https://github.com/jon-lip/onlyexif"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-500 hover:text-gray-700"
            >
              <CodeBracketIcon className="h-5 w-5" />
            </a>
            <a
              href="https://buymeacoffee.com/jonlip"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-500 hover:text-gray-700"
            >
              <HeartIcon className="h-5 w-5" />
            </a>
          </div>
        </nav>
      </header>
      <div className="scroll-progress" />

      <main className="flex-grow">
        <Routes>
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/posts/:slug" element={
            <div>
              <iframe 
                src={window.location.pathname} 
                style={{width: '100%', height: '100vh', border: 'none'}}
              />
            </div>
          } />
          <Route path="/" element={
            <>
              {!file && !showUploader && (
                <div className="flex flex-col">
                  <div className="px-4 sm:px-6 md:px-8 space-y-16 sm:space-y-32 pb-16 sm:pb-32">
                    <div className="mx-auto w-full max-w-7xl">
                      {/* Hero Section */}
                      <div className="relative">
                        {/* Background decoration */}
                        <div className="absolute inset-0 -z-10">
                          <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-gray-50" />
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] opacity-30 blur-3xl rounded-full bg-gradient-to-br from-gray-200 to-white" />
                        </div>

                        <div className="max-w-[1000px] w-full mx-auto pt-8 sm:pt-16 pb-12 sm:pb-16">
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-12 sm:space-y-16"
                          >
                            <div className="h-[200px] sm:h-[240px] flex flex-col justify-center items-center text-center px-4 sm:px-6 relative">
                              <AnimatePresence mode="wait">
                                <motion.div
                                  key={heroTextIndex}
                                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                                  transition={{ 
                                    duration: 0.4,
                                    ease: [0.165, 0.84, 0.44, 1] // Custom easing function
                                  }}
                                  className="absolute max-w-3xl"
                                >
                                  <h1 className="text-3xl sm:text-4xl md:text-6xl font-extrabold tracking-tight">
                                    {heroMessages[heroTextIndex].title}
                                  </h1>
                                  <p className="mt-4 sm:mt-8 text-lg sm:text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto px-4">
                                    {heroMessages[heroTextIndex].subtitle}
                                  </p>
                                </motion.div>
                              </AnimatePresence>
                            </div>

                            {/* CTA Section - Also optimized for mobile */}
                            <div className="flex flex-col items-center text-center max-w-xl mx-auto px-4 sm:px-6">
                              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
                                <button
                                  onClick={() => setShowUploader(true)}
                                  className="btn-primary bg-black text-white hover:bg-gray-900 w-full sm:w-auto
                                            flex items-center justify-center gap-2 px-6 py-3"
                                >
                                  <ArrowUpTrayIcon className="h-5 w-5 flex-shrink-0" />
                                  <span>Analyze Image</span>
                                </button>

                                <button
                                  onClick={loadExampleImage}
                                  className="btn-outline border-gray-200 text-gray-600 hover:bg-gray-50 w-full sm:w-auto
                                            flex items-center justify-center gap-2 px-6 py-3"
                                  title="Try with sample images containing GPS locations, camera info, and other metadata"
                                >
                                  <PhotoIcon className="h-5 w-5 flex-shrink-0" />
                                  <span>Try with Example</span>
                                </button>
                              </div>

                              <div className="mt-6 sm:mt-8 space-y-3 sm:space-y-4">
                                <div className="flex items-center justify-center gap-2 text-sm font-medium text-gray-700">
                                  <ShieldCheckIcon className="h-5 w-5 text-green-600" />
                                  <span>100% Private & Secure</span>
                                </div>
                                
                                <p className="text-sm text-gray-500 max-w-sm mx-auto">
                                  Instantly check your images for hidden data, right in your browser
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        </div>
                      </div>

                      {/* Value Props Section */}
                      <div className="w-full max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8">
                          {[
                            {
                              icon: <ShieldCheckIcon className="w-8 h-8 text-green-500" />,
                              title: "Privacy First",
                              description: "Your files never leave your device. All processing happens right in your browser."
                            },
                            {
                              icon: <ExclamationTriangleIcon className="w-8 h-8 text-orange-500" />,
                              title: "Smart Detection",
                              description: "Instantly find hidden metadata in photos, designs, and other image files."
                            },
                            {
                              icon: (
                                <div className="relative">
                                  <ShieldCheckIcon className="w-8 h-8 text-blue-500 absolute -right-0.5 -top-0.5" />
                                  <ShieldCheckIcon className="w-8 h-8 text-blue-300 absolute -left-0.5 -bottom-0.5" />
                                </div>
                              ),
                              title: "Double-Pass Stripping",
                              description: "Enhanced privacy with two-pass metadata removal. Thorough cleaning for complete peace of mind."
                            }
                          ].map((prop, index) => (
                            <ValuePropCard
                              key={index}
                              prop={prop}
                            />
                          ))}
                        </div>
                      </div>

                      {!file && !showUploader && featuredPost && (
                        <div className="w-full max-w-6xl mx-auto mb-16 mt-8">
                          <div className="bg-black rounded-xl p-6 sm:p-8 text-white">
                            <div className="flex flex-col sm:flex-row gap-6 items-start">
                              <div className="flex-1">
                                <div className="text-sm text-gray-400 mb-2">Featured Article</div>
                                <h3 className="text-xl font-semibold mb-3">
                                  {featuredPost.title}
                                </h3>
                                <p className="text-gray-300 mb-4">
                                  {featuredPost.excerpt}
                                </p>
                                <div className="flex gap-4">
                                  <Link 
                                    to="/blog/posts/${featuredPost.slug}"
                                    target="_blank"
                                    className="text-white font-medium hover:text-gray-300 transition-colors"
                                  >
                                    Read Article →
                                  </Link>
                                  <Link 
                                    to="/blog/index.html"
                                    target="_blank"
                                    className="text-gray-400 font-medium hover:text-white transition-colors"
                                  >
                                    View All Posts
                                  </Link>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Security Risks Section */}
                      <div className="w-full max-w-5xl mx-auto pt-16">
                        <div className="text-center space-y-4 mb-12">
                          <h2 className="text-3xl font-bold">
                            Common Privacy Risks
                          </h2>
                          <p className="text-gray-600 max-w-2xl mx-auto">
                            Understanding what data your images might be exposing
                          </p>
                        </div>
                        
                        <div className="hidden sm:grid grid-cols-2 gap-6">
                          {demoSecurityAlerts.map((alert, index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className={`group relative p-4 sm:p-6 rounded-xl border transition-all duration-200 
                                h-full flex flex-col
                                ${alert.type === 'high' 
                                  ? 'bg-red-50/50 border-red-100 hover:border-red-200 hover:bg-red-50' 
                                  : 'bg-amber-50/50 border-amber-100 hover:border-amber-200 hover:bg-amber-50'
                                }`}
                            >
                              <div className="flex gap-3 sm:gap-4 h-full">
                                <div className={`flex-shrink-0 p-2 sm:p-3 rounded-xl h-fit
                                  ${alert.type === 'high'
                                    ? 'bg-red-100 text-red-600'
                                    : 'bg-amber-100 text-amber-600'
                                  }`}
                                >
                                  {alert.icon}
                                </div>
                                <div className="space-y-2 sm:space-y-3 flex-grow">
                                  <h3 className={`text-base sm:text-lg font-semibold
                                    ${alert.type === 'high' ? 'text-red-900' : 'text-amber-900'}
                                  `}>
                                    {alert.title}
                                  </h3>
                                  <p className="text-sm sm:text-base text-gray-600">
                                    {alert.details}
                                  </p>
                                  <div className="flex flex-col space-y-1">
                                    <span className={`text-xs sm:text-sm font-medium
                                      ${alert.type === 'high' ? 'text-red-600' : 'text-amber-600'}
                                    `}>
                                      Recommendation:
                                    </span>
                                    <span className="text-xs sm:text-sm text-gray-600">
                                      {alert.recommendation}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>

                        {/* Mobile Carousel */}
                        <div className="sm:hidden relative">
                          <AnimatePresence mode="wait">
                            <motion.div
                              key={currentAlertIndex}
                              initial={{ opacity: 0, x: 50 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -50 }}
                              transition={{ duration: 0.3 }}
                              className="px-4 min-h-[200px]"
                            >
                              {/* Single Alert Card */}
                              <div className={`group relative p-4 rounded-xl border transition-all duration-200 
                                h-[180px] flex flex-col
                                ${demoSecurityAlerts[currentAlertIndex].type === 'high' 
                                  ? 'bg-red-50/50 border-red-100' 
                                  : 'bg-amber-50/50 border-amber-100'
                                }`}
                              >
                                <div className="flex gap-3 h-full">
                                  <div className={`flex-shrink-0 p-2 sm:p-3 rounded-xl h-fit
                                    ${demoSecurityAlerts[currentAlertIndex].type === 'high'
                                      ? 'bg-red-100 text-red-600'
                                      : 'bg-amber-100 text-amber-600'
                                    }`}
                                  >
                                    {demoSecurityAlerts[currentAlertIndex].icon}
                                  </div>
                                  <div className="space-y-2 flex-grow">
                                    <h3 className={`text-base sm:text-lg font-semibold
                                      ${demoSecurityAlerts[currentAlertIndex].type === 'high' ? 'text-red-900' : 'text-amber-900'}
                                    `}>
                                      {demoSecurityAlerts[currentAlertIndex].title}
                                    </h3>
                                    <p className="text-sm sm:text-base text-gray-600">
                                      {demoSecurityAlerts[currentAlertIndex].details}
                                    </p>
                                    <div className="flex flex-col space-y-1">
                                      <span className={`text-xs sm:text-sm font-medium
                                        ${demoSecurityAlerts[currentAlertIndex].type === 'high' ? 'text-red-600' : 'text-amber-600'}
                                      `}>
                                        Recommendation:
                                      </span>
                                      <span className="text-xs sm:text-sm text-gray-600">
                                        {demoSecurityAlerts[currentAlertIndex].recommendation}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          </AnimatePresence>

                          {/* Navigation Buttons */}
                          <div className="flex justify-between mt-4 px-4 mb-6">
                            <button
                              onClick={prevAlert}
                              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200"
                            >
                              <ChevronLeftIcon className="w-5 h-5" />
                            </button>
                            <div className="flex gap-1 items-center">
                              {demoSecurityAlerts.map((_, index) => (
                                <div
                                  key={index}
                                  className={`w-2 h-2 rounded-full transition-colors ${
                                    index === currentAlertIndex ? 'bg-gray-800' : 'bg-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                            <button
                              onClick={nextAlert}
                              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200"
                            >
                              <ChevronRightIcon className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Black section - full width and bottom aligned */}
                  <div className="mt-auto bg-black">
                    <div className="py-16 px-6 sm:px-8">
                      <div className="max-w-4xl mx-auto">
                        <div className="max-w-[600px] mx-auto text-center space-y-6">
                          <h2 className="text-2xl font-semibold text-white">
                            Start Protecting Your Privacy
                          </h2>
                          <p className="text-gray-400 text-base">
                            A free, open-source tool to help keep your personal data private
                          </p>
                          
                          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <button
                              onClick={() => setShowUploader(true)}
                              className="btn-primary bg-white text-black hover:bg-gray-100 w-full sm:w-auto
                                        flex items-center justify-center gap-2"
                            >
                              <ArrowUpTrayIcon className="h-5 w-5 flex-shrink-0" />
                              <span>Analyze Image</span>
                            </button>

                            <button
                              onClick={loadExampleImage}
                              className="btn-outline border-white/20 text-white hover:bg-white/10 w-full sm:w-auto
                                        flex items-center justify-center gap-2"
                            >
                              <PhotoIcon className="h-5 w-5 flex-shrink-0" />
                              <span>Try with Example</span>
                            </button>

                            <a
                              href="https://github.com/jon-lip/onlyexif"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-outline border-white/20 text-white hover:bg-white/10 w-full sm:w-auto
                                        flex items-center justify-center gap-2"
                            >
                              <CodeBracketIcon className="h-5 w-5 flex-shrink-0" />
                              <span>View Source</span>
                            </a>
                          </div>

                          <div className="pt-6 border-t border-white/10 mt-8">
                            <p className="text-sm text-gray-400">
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
                </div>
              )}

              {!file && showUploader && (
                <ImageUploader onFileSelect={setFile} />
              )}

              {file && (
                <MetadataEditor file={file} onClose={handleReset} />
              )}
            </>
          } />
        </Routes>
      </main>
    </div>
  );
}

function ValuePropCard({ prop }) {
  return (
    <div
      className="group p-5 sm:p-8 rounded-xl border border-gray-200 
                hover:border-transparent hover:shadow-lg
                hover:bg-gradient-to-b hover:from-white hover:to-gray-50/50
                transition-all duration-300 bg-white
                flex flex-col relative overflow-hidden"
    >
      <div className="mb-4 sm:mb-6 flex-shrink-0 w-12 sm:w-14 h-12 sm:h-14
                    flex items-center justify-center">
        {prop.icon}
      </div>
      <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 
                     group-hover:text-black transition-colors">
        {prop.title}
      </h3>
      <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
        {prop.description}
      </p>
    </div>
  );
}

export default App;
