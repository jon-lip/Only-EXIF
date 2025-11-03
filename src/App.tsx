import { useState, useRef, useMemo, useEffect } from 'react'
import type { JSX } from 'react'
import { MapContainer, TileLayer, Circle, CircleMarker, useMap } from 'react-leaflet'
import type { LatLngExpression } from 'leaflet'
import exifr from 'exifr'
import 'leaflet/dist/leaflet.css'
import './App.css'
import HelpPage from './HelpPage.tsx'

type PreviewStatus = 'idle' | 'loading' | 'ready' | 'unsupported'
type DimensionSource = 'image' | 'metadata' | 'unknown'

interface ImageStats {
  name: string
  type: string
  size: number
  dimensions: { width: number; height: number } | null
  megapixels: number | null
  aspectRatio: string | null
  dateCreated: Date | null
  lastModified: Date
  dimensionsSource: DimensionSource
}

interface MetadataCategoryInsight {
  key: string
  label: string
  description: string
  present: boolean
  detectedFields: Array<{ name: string; path: string; value: unknown }>
}

interface GpsData {
  latitude: number
  longitude: number
  altitude?: number | null
  decimalString: string
  dmsString: string
}

type DataInspectorView = 'json' | 'hex'

interface SuspiciousMarker {
  label: string
  pattern: number[]
  minOffset?: number
}

type SectionKey = 'stats' | 'summary' | 'location' | 'insights' | 'inspector'
type SectionIndicatorStatus = 'alert' | 'clean'

const SENSITIVE_CATEGORY_KEYS = new Set<MetadataCategoryInsight['key']>([
  'locationData',
  'identifyingInfo',
  'captions',
  'freeformText'
])

const HEX_DUMP_PREVIEW_BYTES = 64 * 1024
const DEFAULT_COLLAPSE_STATE: Record<SectionKey, boolean> = {
  stats: true,
  summary: true,
  location: true,
  insights: true,
  inspector: true
}

const HERO_HIGHLIGHTS: Array<{ title: string; short: string; Icon: (props: { className?: string }) => JSX.Element }> = [
  { title: 'Location & GPS', short: 'GPS', Icon: MapPinIcon },
  { title: 'Device Serials', short: 'Serials', Icon: HashtagIcon },
  { title: 'Camera Details', short: 'Camera', Icon: CameraIcon },
  { title: 'Author & Credits', short: 'Author', Icon: PencilIcon },
  { title: 'Software Tags', short: 'Software', Icon: PuzzleIcon },
  { title: 'Timestamps', short: 'Time', Icon: ClockIcon },
  { title: 'Binary Scan', short: 'Binary', Icon: ChipIcon }
]

function App() {
  const ensureTrailingSlash = (value: string) => {
    if (!value) return '/'
    return value.endsWith('/') ? value : `${value}/`
  }

  const shouldHandleClientNavigation = (event: React.MouseEvent<HTMLAnchorElement>) => {
    return (
      !event.defaultPrevented &&
      event.button === 0 &&
      !event.metaKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.shiftKey
    )
  }

  const baseUrl =
    typeof window !== 'undefined'
      ? new URL(import.meta.env.BASE_URL ?? '/', window.location.origin)
      : new URL(import.meta.env.BASE_URL ?? '/', 'http://localhost')
  const basePath = ensureTrailingSlash(baseUrl.pathname)
  const helpHref = ensureTrailingSlash(`${basePath}help`)
  const homeHref = basePath
  const helpPath = helpHref

  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window === 'undefined') {
      return homeHref
    }
    return ensureTrailingSlash(window.location.pathname)
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handlePopState = () => {
      setCurrentPath(ensureTrailingSlash(window.location.pathname))
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const isHelpView = ensureTrailingSlash(currentPath) === helpPath

  const defaultTitleRef = useRef<string | null>(null)
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (defaultTitleRef.current === null) {
      defaultTitleRef.current = document.title
    }
    if (isHelpView) {
      document.title = 'OnlyEXIF • Help'
    } else if (defaultTitleRef.current) {
      document.title = defaultTitleRef.current
    }
  }, [isHelpView])

  const navigateToPath = (targetPath: string) => {
    if (typeof window === 'undefined') return
    const normalizedTarget = ensureTrailingSlash(targetPath)
    const normalizedCurrent = ensureTrailingSlash(window.location.pathname)
    if (normalizedTarget === normalizedCurrent) {
      setCurrentPath(normalizedCurrent)
      return
    }
    window.history.pushState({}, '', normalizedTarget)
    setCurrentPath(normalizedTarget)
  }

  const handleHelpLinkClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!shouldHandleClientNavigation(event)) {
      return
    }
    event.preventDefault()
    navigateToPath(helpHref)
  }

  const navigateHome = () => navigateToPath(homeHref)

  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageStats, setImageStats] = useState<ImageStats | null>(null)
  const [metadataInsights, setMetadataInsights] = useState<MetadataCategoryInsight[]>([])
  const [rawMetadata, setRawMetadata] = useState<Record<string, unknown> | null>(null)
  const [gpsData, setGpsData] = useState<GpsData | null>(null)
  const [locationLabels, setLocationLabels] = useState<string[]>([])
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('idle')
  const [fileError, setFileError] = useState<string | null>(null)
  const [isCleanModalOpen, setIsCleanModalOpen] = useState(false)
  const [isCleaning, setIsCleaning] = useState(false)
  const [cleanError, setCleanError] = useState<string | null>(null)
  const [cleanSuccess, setCleanSuccess] = useState(false)
  const [skipCleanConfirm, setSkipCleanConfirm] = useState<boolean>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('skipCleanConfirm') === '1' : false
  )
  const [, setWarningToast] = useState<{ title: string; message: string } | null>(null)
  const [binaryAlerts, setBinaryAlerts] = useState<string[]>([])
  const [dataInspectorView, setDataInspectorView] = useState<DataInspectorView>('json')
  const [hexDump, setHexDump] = useState<string | null>(null)
  const [isGeneratingHex, setIsGeneratingHex] = useState(false)
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null)
  const [, setShowSuccessToast] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Record<SectionKey, boolean>>(
    () => ({ ...DEFAULT_COLLAPSE_STATE })
  )
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewUrlRef = useRef<string | null>(null)
  const cleanTimeoutRef = useRef<number | null>(null)
  const warningToastTimeoutRef = useRef<number | null>(null)
  const successToastTimeoutRef = useRef<number | null>(null)

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!isSupportedImageFile(file)) {
      setFileError('That file type is not supported yet. Please select a standard image or RAW photo.')
      setSelectedImage(null)
      setImagePreview(null)
      setImageStats(null)
      setMetadataInsights([])
      setRawMetadata(null)
      setPreviewStatus('idle')
      event.target.value = ''
      return
    }

    setFileError(null)
    setSelectedImage(file)
    setPreviewStatus('loading')
    setImagePreview(null)
    setMetadataInsights([])
    setRawMetadata(null)
    setGpsData(null)
    setLocationLabels([])
    setIsCleanModalOpen(false)
    setIsCleaning(false)
    setCleanError(null)
    setCleanSuccess(false)
    setWarningToast(null)
    setBinaryAlerts([])
    setDataInspectorView('json')
    setHexDump(null)
    setIsGeneratingHex(false)
    setFileBuffer(null)
    resetCollapsibleSections()
    setShowSuccessToast(false)
    if (cleanTimeoutRef.current) {
      window.clearTimeout(cleanTimeoutRef.current)
      cleanTimeoutRef.current = null
    }
    if (warningToastTimeoutRef.current) {
      window.clearTimeout(warningToastTimeoutRef.current)
      warningToastTimeoutRef.current = null
    }
    if (successToastTimeoutRef.current) {
      window.clearTimeout(successToastTimeoutRef.current)
      successToastTimeoutRef.current = null
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }
    const objectUrl = URL.createObjectURL(file)
    previewUrlRef.current = objectUrl
    setImagePreview(objectUrl)

    let dateCreated: Date | null = new Date(file.lastModified)
    let metadataDimensions: { width: number; height: number } | null = null

    try {
      const buffer = await file.arrayBuffer()
      setFileBuffer(buffer)
      const binaryWarnings = analyzeBinaryContent(file, buffer)
      setBinaryAlerts(binaryWarnings)
      if (binaryWarnings.length > 0) {
        if (warningToastTimeoutRef.current) {
          window.clearTimeout(warningToastTimeoutRef.current)
        }
        setWarningToast({
          title: 'Suspicious binary markers',
          message: 'We spotted unusual data. Open the Data Inspector for details.'
        })
        warningToastTimeoutRef.current = window.setTimeout(() => {
          setWarningToast(null)
          warningToastTimeoutRef.current = null
        }, 7000)
      }

      const exif = await exifr.parse(file, {
        translateKeys: false,
        translateValues: false,
        reviveValues: true,
        sanitize: true,
        mergeOutput: true,
        tiff: true,
        ifd1: true,
        icc: true,
        xmp: true
      })

      if (exif?.DateTimeOriginal) {
        dateCreated = new Date(exif.DateTimeOriginal)
      } else if (exif?.CreateDate) {
        dateCreated = new Date(exif.CreateDate)
      } else if (exif?.DateTimeDigitized) {
        dateCreated = new Date(exif.DateTimeDigitized)
      } else if (exif?.DateTime) {
        dateCreated = new Date(exif.DateTime)
      }

      metadataDimensions = extractDimensionsFromMetadata(exif)

      const stats = computeImageStats({
        file,
        dateCreated,
        dimensions: metadataDimensions,
        dimensionSource: metadataDimensions ? 'metadata' : 'unknown'
      })
      setImageStats(stats)

      const gpsInfo = extractGpsData(exif ?? {})
      setGpsData(gpsInfo)

      const insights = buildMetadataInsights(exif ?? {}).map((category) => {
        if (category.key === 'locationData' && !gpsInfo) {
          return { ...category, present: false, detectedFields: [] }
        }
        return category
      })
      setMetadataInsights(insights)

      // Show warning toast if sensitive metadata is detected
      const sensitiveCategories = ['locationData', 'identifyingInfo']
      const hasSensitiveData = insights.some(
        (category) => sensitiveCategories.includes(category.key) && category.present
      )
      
      if (hasSensitiveData) {
        if (warningToastTimeoutRef.current) {
          window.clearTimeout(warningToastTimeoutRef.current)
        }
        setWarningToast({
          title: 'Sensitive data detected',
          message: 'Your image contains location or identifying information.'
        })
        warningToastTimeoutRef.current = window.setTimeout(() => {
          setWarningToast(null)
          warningToastTimeoutRef.current = null
        }, 5000)
      } else if (binaryWarnings.length > 0) {
        if (warningToastTimeoutRef.current) {
          window.clearTimeout(warningToastTimeoutRef.current)
        }
        warningToastTimeoutRef.current = window.setTimeout(() => {
          setWarningToast(null)
          warningToastTimeoutRef.current = null
        }, 7000)
      }

      setRawMetadata(exif ?? {})
      setLocationLabels(extractLocationLabels(exif ?? {}))
    } catch (error) {
      console.error('Error extracting metadata:', error)

      const stats = computeImageStats({
        file,
        dateCreated,
        dimensions: null,
        dimensionSource: 'unknown'
      })
      setImageStats(stats)
      setMetadataInsights([])
      setRawMetadata(null)
      setGpsData(null)
      setLocationLabels([])
    }

    event.target.value = ''
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetAppState = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }

    if (cleanTimeoutRef.current) {
      window.clearTimeout(cleanTimeoutRef.current)
      cleanTimeoutRef.current = null
    }

    if (warningToastTimeoutRef.current) {
      window.clearTimeout(warningToastTimeoutRef.current)
      warningToastTimeoutRef.current = null
    }

    if (successToastTimeoutRef.current) {
      window.clearTimeout(successToastTimeoutRef.current)
      successToastTimeoutRef.current = null
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    setSelectedImage(null)
    setImagePreview(null)
    setImageStats(null)
    setMetadataInsights([])
    setRawMetadata(null)
    setGpsData(null)
    setLocationLabels([])
    setPreviewStatus('idle')
    setFileError(null)
    setWarningToast(null)
    setBinaryAlerts([])
    setDataInspectorView('json')
    setHexDump(null)
    setIsGeneratingHex(false)
    setFileBuffer(null)
    setIsCleanModalOpen(false)
    setIsCleaning(false)
    setCleanError(null)
    setCleanSuccess(false)
    setShowSuccessToast(false)
    resetCollapsibleSections()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSampleImageClick = async () => {
    try {
      const response = await fetch('/2019_02_17_The_Ritz_Carlton_Berlin_Social_Stills_Feb_2019_0289.jpg')
      const blob = await response.blob()
      const file = new File([blob], '2019_02_17_The_Ritz_Carlton_Berlin_Social_Stills_Feb_2019_0289.jpg', { type: blob.type })
      
      const event = {
        target: {
          files: [file],
          value: ''
        }
      } as unknown as React.ChangeEvent<HTMLInputElement>
      
      await handleImageSelect(event)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      console.error('Error loading sample image:', error)
    }
  }

  const handleLogoClick = () => {
    if (!selectedImage) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    resetAppState()
  }

  const handleInspectorToggle = (view: DataInspectorView) => {
    setDataInspectorView(view)
  }

  const toggleSection = (key: SectionKey) => {
    setCollapsedSections((current) => ({
      ...current,
      [key]: !current[key]
    }))
  }

  const resetCollapsibleSections = () => {
    setCollapsedSections({ ...DEFAULT_COLLAPSE_STATE })
  }

  

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }

  const metadataFieldCount = useMemo(() => {
    if (!rawMetadata) return 0
    return countMetadataFields(rawMetadata)
  }, [rawMetadata])

  const isHexTrimmed = useMemo(() => {
    if (!fileBuffer) return false
    return fileBuffer.byteLength > HEX_DUMP_PREVIEW_BYTES
  }, [fileBuffer])

  const metadataSummarySubtitle = metadataFieldCount > 0
    ? `${metadataFieldCount} metadata fields detected`
    : 'No metadata detected'

  const displayedInsights = metadataInsights
    .map((category) => ({
      ...category,
      detectedFields:
        category.key === 'locationData'
          ? category.detectedFields
          : dedupeFields(category.detectedFields)
    }))
    .filter((category) => category.present)

  const hasInsights = displayedInsights.length > 0

  const sectionStatuses = useMemo<Record<SectionKey, SectionIndicatorStatus | null>>(() => {
    const summarySensitive = metadataInsights.some(
      (category) => category.present && SENSITIVE_CATEGORY_KEYS.has(category.key)
    )
    const summaryHasMetadata = metadataInsights.some((category) => category.present)
    const insightsSensitive = displayedInsights.some((category) =>
      SENSITIVE_CATEGORY_KEYS.has(category.key)
    )
    const inspectorHasAlerts = binaryAlerts.length > 0

    return {
      stats: null,
      summary: summarySensitive ? 'alert' : summaryHasMetadata ? 'clean' : null,
      location: gpsData ? 'alert' : null,
      insights: insightsSensitive ? 'alert' : hasInsights ? 'clean' : null,
      inspector: inspectorHasAlerts ? 'alert' : fileBuffer ? 'clean' : null
    }
  }, [metadataInsights, displayedInsights, gpsData, hasInsights, binaryAlerts, fileBuffer])

  const isImageClean = useMemo(() => {
    const hasSensitive = metadataInsights.some(
      (c) => c.present && SENSITIVE_CATEGORY_KEYS.has(c.key)
    )
    const hasBinaryAlerts = binaryAlerts.length > 0
    const hasGps = Boolean(gpsData)
    return !hasSensitive && !hasBinaryAlerts && !hasGps
  }, [metadataInsights, binaryAlerts, gpsData])

  const openAllDetails = () => {
    setCollapsedSections({ stats: false, summary: false, location: false, insights: false, inspector: false })
    const el = document.getElementById('summary-content')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const renderSectionToggle = (
    key: SectionKey,
    title: string,
    options?: { subtitle?: string; controlsId?: string; status?: SectionIndicatorStatus | null }
  ) => {
    const collapsed = collapsedSections[key]
    const status = options?.status ?? null
    const showStatusIndicator = collapsed && status
    const statusMessage =
      showStatusIndicator && status === 'alert'
        ? 'Sensitive information detected'
        : showStatusIndicator && status === 'clean'
          ? 'Section is clean'
          : null

    return (
      <button
        type="button"
        className={`section-toggle${collapsed ? ' is-collapsed' : ''}`}
        onClick={() => toggleSection(key)}
        aria-expanded={!collapsed}
        aria-controls={options?.controlsId}
        aria-label={statusMessage ? `${title}. ${statusMessage}.` : undefined}
      >
        <span className="section-toggle__text">
          <span className="section-title">{title}</span>
          {options?.subtitle && <span className="section-subtitle">{options.subtitle}</span>}
        </span>
        <span className="section-toggle__icon">
          {showStatusIndicator && (
            <span
              className={`section-status-dot section-status-dot--${status}`}
              aria-hidden="true"
            />
          )}
          <ChevronIcon collapsed={collapsed} />
        </span>
      </button>
    )
  }

  const handlePreviewLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    if (!selectedImage || !imageStats) return
    const target = event.currentTarget
    const dimensions = {
      width: target.naturalWidth,
      height: target.naturalHeight
    }

    setPreviewStatus((status) => (status === 'ready' ? status : 'ready'))
    setImageStats((current) => {
      if (!current) return current
      if (
        current.dimensions &&
        current.dimensionsSource === 'image' &&
        current.dimensions.width === dimensions.width &&
        current.dimensions.height === dimensions.height
      ) {
        return current
      }

      return computeImageStats({
        file: selectedImage,
        dateCreated: current.dateCreated,
        dimensions,
        dimensionSource: 'image'
      })
    })
  }

  const handlePreviewError = () => {
    setPreviewStatus((status) => (status === 'unsupported' ? status : 'unsupported'))
    setImagePreview(null)
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
      if (cleanTimeoutRef.current) {
        window.clearTimeout(cleanTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!cleanSuccess) return
    setShowSuccessToast(true)
    if (successToastTimeoutRef.current) {
      window.clearTimeout(successToastTimeoutRef.current)
    }
    successToastTimeoutRef.current = window.setTimeout(() => {
      setShowSuccessToast(false)
      setCleanSuccess(false)
      successToastTimeoutRef.current = null
    }, 4000)
  }, [cleanSuccess])

  useEffect(() => {
    if (dataInspectorView !== 'hex') return
    if (!fileBuffer) return
    setIsGeneratingHex(true)
    const bytes = new Uint8Array(fileBuffer)
    const dump = generateHexDump(bytes, 16, HEX_DUMP_PREVIEW_BYTES)
    setHexDump(dump)
    setIsGeneratingHex(false)
  }, [dataInspectorView, fileBuffer])

  useEffect(() => {
    const body = document.body
    if (!selectedImage && !isHelpView) {
      body.classList.add('landing-scroll-locked')
    } else {
      body.classList.remove('landing-scroll-locked')
    }
    return () => {
      body.classList.remove('landing-scroll-locked')
    }
  }, [selectedImage, isHelpView])

  useEffect(() => {
    return () => {
      if (warningToastTimeoutRef.current) {
        window.clearTimeout(warningToastTimeoutRef.current)
      }
      if (successToastTimeoutRef.current) {
        window.clearTimeout(successToastTimeoutRef.current)
      }
    }
  }, [])

  const openCleanModal = () => {
    setCleanError(null)
    if (skipCleanConfirm) {
      // Bypass confirmation and clean immediately
      void handleCleanConfirm()
      return
    }
    setIsCleanModalOpen(true)
  }

  const closeCleanModal = () => {
    if (isCleaning) return
    setIsCleanModalOpen(false)
    setCleanError(null)
  }

  const handleCleanConfirm = async () => {
    if (!selectedImage || !imagePreview) {
      setCleanError('No image available to clean.')
      return
    }

    setIsCleaning(true)
    setCleanError(null)

    try {
      const img = document.createElement('img')
      img.src = imagePreview
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })

      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('Unable to initialise canvas context.')
      }
      ctx.drawImage(img, 0, 0)

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.92)
      )
      if (!blob) {
        throw new Error('Failed to generate cleaned image.')
      }

      const cleanedUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const baseName = selectedImage.name.replace(/\.[^/.]+$/, '')
      link.href = cleanedUrl
      link.download = `${baseName}-clean.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(cleanedUrl)

      setIsCleanModalOpen(false)
      setCleanSuccess(true)
    } catch (error) {
      console.error('Clean failed', error)
      setCleanError(
        error instanceof Error ? error.message : 'Unable to clean this image format in-browser.'
      )
    } finally {
      setIsCleaning(false)
    }
  }

  if (isHelpView) {
    return (
      <>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageSelect}
          accept="image/*,.heic,.heif,.dng,.raw,.arw,.cr2,.cr3,.nef,.nrw,.orf,.raf,.rw2,.rwl,.srw,.pef"
          style={{ display: 'none' }}
        />
        <HelpPage onNavigateHome={navigateHome} onCheckMetadata={handleButtonClick} homeHref={homeHref} />
      </>
    )
  }

  return (
    <>
      {/* Toast notifications removed in favor of verdict banner */}

    <div className={`app${!selectedImage ? ' app--landing' : ''}`}>
      <header>
        <h1 className="logo">
          <button type="button" className="logo-button" onClick={handleLogoClick}>
            OnlyEXIF
          </button>
        </h1>
        <a
          href={helpHref}
          target="_self"
          className="header-help"
          aria-label="Open help"
          onClick={handleHelpLinkClick}
        >
          Help
        </a>
      </header>

      <main>
        <section className={`tool-section${!selectedImage ? ' tool-section--landing' : ''}`}>
          {!selectedImage && (
            <>
              <div className="hero-image-container">
                <img
                  src="/2019_02_17_The_Ritz_Carlton_Berlin_Social_Stills_Feb_2019_0289.jpg"
                  alt="Sample image showing metadata"
                  className="hero-image"
                />
                <button className="hero-sample-button" onClick={handleSampleImageClick}>
                  Try sample
                </button>
              </div>
              <div className="hero-section">
                <h2 className="hero-title">Check your metadata!</h2>
                <p className="hero-description">
                  OnlyEXIF audits any image for GPS trails, device fingerprints, binary payloads, and more—so you can share images with confidence.
                </p>
                <div className="hero-pill-list" role="list" aria-label="Metadata we scan for">
                  {HERO_HIGHLIGHTS.map(({ title, short, Icon }) => (
                    <div key={title} className="hero-pill" role="listitem" aria-label={title} title={title}>
                      <span className="hero-pill__glyph" aria-hidden="true">
                        <Icon className="hero-pill__svg" />
                      </span>
                      <span className="hero-pill__label">{short}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {fileError && <div className="inline-error">{fileError}</div>}

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*,.heic,.heif,.dng,.raw,.arw,.cr2,.cr3,.nef,.nrw,.orf,.raf,.rw2,.rwl,.srw,.pef"
            style={{ display: 'none' }}
          />

          {selectedImage && (
            <div className="results">
              <div className="results-header">
                <div className="image-container">
                  {imagePreview && (
                    <img
                      src={imagePreview}
                      alt="Selected preview"
                      className="thumbnail"
                      onLoad={handlePreviewLoad}
                      onError={handlePreviewError}
                      style={{ display: previewStatus === 'unsupported' ? 'none' : 'block' }}
                    />
                  )}
                  {(!imagePreview && previewStatus !== 'loading') || previewStatus === 'unsupported' ? (
                    <div className="preview-placeholder">
                      <strong>Preview unavailable.</strong>
                      <span>
                        This format is not natively rendered by your browser, but the metadata report below is still complete.
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className={`verdict-card ${isImageClean ? 'verdict-card--clean' : 'verdict-card--alert'}`} role="status" aria-live="polite">
                  <span className="verdict-card__icon" aria-hidden="true">
                    {isImageClean ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L14.71 3.86a2 2 0 00-3.42 0z"/></svg>
                    )}
                  </span>
                  <div className="verdict-card__content">
                    <strong className="verdict-card__title">{isImageClean ? 'Looks clean' : 'Sensitive content detected'}</strong>
                    <span className="verdict-card__subtitle">
                      {isImageClean ? 'No GPS, device identifiers, or binary anomalies found.' : 'We found GPS or identifying data and/or binary anomalies.'}
                    </span>
                  </div>
                  <div className="verdict-card__actions">
                    <button type="button" className="secondary-button" onClick={openAllDetails}>View details</button>
                  </div>
                </div>

                {/* stats moved to bottom */}
              </div>

              <LocationPanel
                gpsData={gpsData}
                locationLabels={locationLabels}
                collapsed={collapsedSections.location}
                onToggle={() => toggleSection('location')}
                status={sectionStatuses.location}
              />

              <div className={`analysis-summary collapsible${collapsedSections.summary ? ' is-collapsed' : ''}`}>
                <div className="section-heading">
                  {renderSectionToggle('summary', 'Metadata Summary', {
                    subtitle: metadataSummarySubtitle,
                    controlsId: 'summary-content',
                    status: sectionStatuses.summary
                  })}
                </div>
                {!collapsedSections.summary && (
                  <div className="metadata-section" id="summary-content">
                    <div className="metadata-grid">
                      {metadataInsights.length === 0 ? (
                        <div className="metadata-item is-empty" aria-live="polite">
                          <span className="metadata-label">Metadata could not be read.</span>
                          <span className="metadata-indicator metadata-indicator--unknown" aria-hidden="true" />
                        </div>
                      ) : (
                        metadataInsights.map((category) => (
                          <div key={category.key} className="metadata-item">
                            <div>
                              <span className="metadata-label">{category.label}</span>
                              <p className="metadata-description">{category.description}</p>
                            </div>
                            <span
                              className={`metadata-indicator ${category.present ? 'metadata-indicator--present' : 'metadata-indicator--clean'}`}
                              aria-label={category.present ? 'Sensitive metadata detected' : 'Clean'}
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {hasInsights && (
                <div className={`insights-deep-dive collapsible${collapsedSections.insights ? ' is-collapsed' : ''}`}>
                  <div className="section-heading">
                    {renderSectionToggle('insights', 'Key Fields Worth Checking', {
                      controlsId: 'insights-content',
                      status: sectionStatuses.insights
                    })}
                  </div>
                  {!collapsedSections.insights && (
                    <div className="insights-grid" id="insights-content">
                      {displayedInsights.map((category) => (
                        <div key={category.key} className="insight-card">
                          <h4>{category.label}</h4>
                          {category.key === 'locationData' && gpsData ? (
                            <ul>
                              <li>
                                <span className="field-name">Coordinates</span>
                                <a
                                  className="field-value"
                                  href={`https://www.google.com/maps?q=${gpsData.latitude},${gpsData.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {gpsData.decimalString}
                                  <span className="field-subvalue">{gpsData.dmsString}</span>
                                </a>
                              </li>
                              {locationLabels.length > 0 && (
                                <li>
                                  <span className="field-name">Place</span>
                                  <span className="field-value">{locationLabels.slice(0, 3).join(', ')}</span>
                                </li>
                              )}
                              {gpsData.altitude !== undefined && gpsData.altitude !== null && (
                                <li>
                                  <span className="field-name">Altitude</span>
                                  <span className="field-value">{gpsData.altitude.toFixed(1)} m</span>
                                </li>
                              )}
                            </ul>
                          ) : (
                            <ul>
                              {category.detectedFields
                                .filter((field) => shouldDisplayField(category.key, field.name))
                                .slice(0, 5)
                                .map((field) => (
                                  <li key={field.path}>
                                    <span className="field-name">{field.name}</span>
                                    <span className="field-value">{formatMetadataValue(field.value)}</span>
                                  </li>
                                ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className={`raw-metadata collapsible${collapsedSections.inspector ? ' is-collapsed' : ''}`}>
                <div className="section-heading">
                  {renderSectionToggle('inspector', 'Data Inspector', {
                    subtitle: 'Peek at the raw metadata or bytes',
                    controlsId: 'inspector-content',
                    status: sectionStatuses.inspector
                  })}
                </div>

                {binaryAlerts.length > 0 && (
                  <div className="binary-warning" role="alert">
                    <strong>Binary scan flagged anomalies</strong>
                    <p>These patterns can hint at hidden payloads. Inspect carefully:</p>
                    <ul>
                      {binaryAlerts.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {!collapsedSections.inspector && (
                  <>
                    <div className="raw-metadata-toolbar" role="group" aria-label="Raw data view options">
                      <button
                        type="button"
                        className={`raw-metadata-toggle${dataInspectorView === 'json' ? ' is-active' : ''}`}
                        onClick={() => handleInspectorToggle('json')}
                        aria-pressed={dataInspectorView === 'json'}
                        disabled={!rawMetadata}
                      >
                        Metadata JSON
                      </button>
                      <button
                        type="button"
                        className={`raw-metadata-toggle${dataInspectorView === 'hex' ? ' is-active' : ''}`}
                        onClick={() => handleInspectorToggle('hex')}
                        aria-pressed={dataInspectorView === 'hex'}
                        disabled={!fileBuffer}
                      >
                        Hex Bytes
                      </button>
                    </div>

                    <div className="raw-metadata-content" id="inspector-content">
                      {dataInspectorView === 'json' ? (
                        rawMetadata ? (
                          <pre>{JSON.stringify(sanitizeMetadata(rawMetadata), null, 2)}</pre>
                        ) : (
                          <div className="raw-metadata-empty">No metadata available for this image.</div>
                        )
                      ) : isGeneratingHex ? (
                        <div className="raw-metadata-empty">Preparing hex preview…</div>
                      ) : hexDump ? (
                        <pre>{hexDump}</pre>
                      ) : (
                        <div className="raw-metadata-empty">No binary data available.</div>
                      )}
                    </div>

                    {dataInspectorView === 'hex' && isHexTrimmed && fileBuffer && (
                      <div className="raw-metadata-footnote">
                        Showing the first {formatFileSize(Math.min(fileBuffer.byteLength, HEX_DUMP_PREVIEW_BYTES))} of{' '}
                        {formatFileSize(fileBuffer.byteLength)}.
                      </div>
                    )}
                  </>
                )}
              </div>

              {imageStats && (
                <div className={`stats-section collapsible${collapsedSections.stats ? ' is-collapsed' : ''}`}>
                  <div className="section-heading">
                    {renderSectionToggle('stats', 'Image Stats', { controlsId: 'stats-content' })}
                  </div>
                  {!collapsedSections.stats && (
                    <div className="stats-grid" id="stats-content">
                      <div className="stat-item name-row">
                        <span className="stat-label">Name</span>
                        <span className="stat-value">{imageStats.name}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Type</span>
                        <span className="stat-value">{imageStats.type}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Size</span>
                        <span className="stat-value">{formatFileSize(imageStats.size)}</span>
                      </div>
                      {imageStats.dimensions && (
                        <div className="stat-item">
                          <span className="stat-label">Dimensions</span>
                          <span className="stat-value">
                            {imageStats.dimensions.width} × {imageStats.dimensions.height}
                          </span>
                        </div>
                      )}
                      {imageStats.megapixels && (
                        <div className="stat-item">
                          <span className="stat-label">Megapixels</span>
                          <span className="stat-value">{imageStats.megapixels.toFixed(2)} MP</span>
                        </div>
                      )}
                      {imageStats.aspectRatio && (
                        <div className="stat-item">
                          <span className="stat-label">Aspect Ratio</span>
                          <span className="stat-value">{imageStats.aspectRatio}</span>
                        </div>
                      )}
                      {imageStats.dateCreated && (
                        <div className="stat-item">
                          <span className="stat-label">Captured</span>
                          <span className="stat-value">{formatDate(imageStats.dateCreated)}</span>
                        </div>
                      )}
                      <div className="stat-item">
                        <span className="stat-label">Last Modified</span>
                        <span className="stat-value">{formatDate(imageStats.lastModified)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {!selectedImage && (
        <div className="landing-bottom-bar" role="toolbar" aria-label="OnlyEXIF quick actions">
          <div className="landing-bottom-bar__cta">
            <button type="button" className="tool-button" onClick={handleButtonClick}>
              Check metadata
            </button>
          </div>
        </div>
      )}

      {selectedImage && (
        <div className="bottom-bar" role="toolbar" aria-label="OnlyEXIF actions">
          <div className="bottom-bar__actions">
            <button className="tool-button" onClick={handleButtonClick}>
              Select New
            </button>
            <button className="tool-button" onClick={openCleanModal}>
              Clean
            </button>
          </div>
        </div>
      )}

      {isCleanModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="clean-modal-title">
            <h3 id="clean-modal-title">Clean Image?</h3>
            <p>
              We'll create a new copy without any embedded metadata. <strong>Your original file stays untouched and will still contain its metadata.</strong>
            </p>
            <p>Download the cleaned copy and share that version instead.</p>
            <p className="modal-note">Some browsers add fresh metadata on save—especially color or location tags generated by the device. Always double-check the cleaned copy before sharing.</p>
            <label className="modal-check" htmlFor="skip-clean-confirm">
              <input
                id="skip-clean-confirm"
                type="checkbox"
                checked={skipCleanConfirm}
                onChange={(e) => {
                  const next = e.target.checked
                  setSkipCleanConfirm(next)
                  try { localStorage.setItem('skipCleanConfirm', next ? '1' : '0') } catch {}
                }}
              />
              <span>Don't ask again</span>
            </label>
            {cleanError && <div className="modal-error">{cleanError}</div>}
            <div className="modal-actions">
              <button className="secondary-button" onClick={closeCleanModal} disabled={isCleaning}>
                Cancel
              </button>
              <button className="primary-button modal-primary" onClick={handleCleanConfirm} disabled={isCleaning}>
                {isCleaning ? 'Cleaning…' : 'Clean image'}
              </button>
      </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}

export default App

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 22s7-5.373 7-12a7 7 0 10-14 0c0 6.627 7 12 7 12z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function HashtagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M5 9h14M5 15h14M10 3L8 21M16 3l-2 18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 8h3l2-3h6l2 3h3a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2v-8a2 2 0 012-2z" />
      <circle cx="12" cy="14" r="4" />
    </svg>
  )
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 20l4-.8 10.6-10.6a2 2 0 10-2.8-2.8L5.2 16.4 4 20z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PuzzleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M9 3a2 2 0 012 2v1h2V5a2 2 0 114 0v2h1a2 2 0 012 2v2h-1.5a1.5 1.5 0 100 3H20v2a2 2 0 01-2 2h-2v-1.5a1.5 1.5 0 10-3 0V20H9a2 2 0 01-2-2v-2H5a2 2 0 110-4h2V9a2 2 0 012-2h0V5a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChipIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" strokeLinecap="round" />
    </svg>
  )
}

const PNG_KNOWN_CHUNKS = new Set([
  'IHDR',
  'PLTE',
  'IDAT',
  'IEND',
  'bKGD',
  'cHRM',
  'dSIG',
  'eXIf',
  'gAMA',
  'hIST',
  'iCCP',
  'iTXt',
  'pHYs',
  'sBIT',
  'sPLT',
  'sRGB',
  'sTER',
  'tEXt',
  'tIME',
  'tRNS',
  'zTXt',
  'oFFs',
  'acTL',
  'fcTL',
  'fdAT',
  'pCAL',
  'sCAL',
  'vpAg'
])

const SUSPICIOUS_BINARY_MARKERS: SuspiciousMarker[] = [
  {
    label: 'ZIP archive header (PK\\x03\\x04)',
    pattern: [0x50, 0x4b, 0x03, 0x04],
    minOffset: 512
  },
  {
    label: 'ZIP archive directory (PK\\x05\\x06)',
    pattern: [0x50, 0x4b, 0x05, 0x06],
    minOffset: 512
  },
  {
    label: 'RAR archive header (Rar!)',
    pattern: [0x52, 0x61, 0x72, 0x21],
    minOffset: 512
  },
  {
    label: '7z archive header',
    pattern: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c],
    minOffset: 512
  },
  {
    label: 'PDF header (%PDF)',
    pattern: [0x25, 0x50, 0x44, 0x46],
    minOffset: 512
  }
]

const ASCII_SUSPICIOUS_PATTERNS: Array<{ label: string; text: string; minOffset?: number }> = [
  {
    label: 'Windows executable signature text',
    text: 'This program cannot be run in DOS mode',
    minOffset: 128
  }
]

function analyzeBinaryContent(_file: File, buffer: ArrayBuffer): string[] {
  const warnings: string[] = []
  if (buffer.byteLength === 0) return warnings

  const bytes = new Uint8Array(buffer)

  if (isJpeg(bytes)) {
    const eoiIndex = findLastJpegEoi(bytes)
    if (eoiIndex !== null) {
      const trailing = bytes.length - (eoiIndex + 2)
      if (trailing > 32) {
        warnings.push(
          `JPEG ends at ${formatHexOffset(eoiIndex + 2)} but still has ${trailing} trailing byte${
            trailing === 1 ? '' : 's'
          }.`
        )
      }
    }
  }

  if (isPng(bytes)) {
    const { trailingBytes, unknownChunks } = inspectPngChunks(bytes)
    if (unknownChunks.length > 0) {
      warnings.push(
        `PNG includes non-standard chunk${unknownChunks.length > 1 ? 's' : ''}: ${unknownChunks.join(', ')}.`
      )
    }
    if (trailingBytes > 0) {
      warnings.push(
        `PNG file continues for ${trailingBytes} byte${trailingBytes === 1 ? '' : 's'} after the IEND marker.`
      )
    }
  }

  for (const marker of SUSPICIOUS_BINARY_MARKERS) {
    const startIndex = marker.minOffset ?? 0
    const index = findPattern(bytes, marker.pattern, startIndex)
    if (index >= 0) {
      const message = `${marker.label} detected near ${formatHexOffset(index)}.`
      if (!warnings.includes(message)) {
        warnings.push(message)
      }
    }
  }

  for (const pattern of ASCII_SUSPICIOUS_PATTERNS) {
    const codes = asciiToPattern(pattern.text)
    const index = findPattern(bytes, codes, pattern.minOffset ?? 0)
    if (index >= 0) {
      const message = `${pattern.label} spotted near ${formatHexOffset(index)}.`
      if (!warnings.includes(message)) {
        warnings.push(message)
      }
    }
  }

  return warnings
}

function generateHexDump(bytes: Uint8Array, bytesPerRow = 16, maxBytes = HEX_DUMP_PREVIEW_BYTES): string {
  if (bytesPerRow <= 0) return ''
  const limit = Math.min(bytes.length, maxBytes)
  const lines: string[] = []

  for (let offset = 0; offset < limit; offset += bytesPerRow) {
    const slice = bytes.subarray(offset, Math.min(offset + bytesPerRow, limit))
    const hex = Array.from(slice, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ')
    const ascii = Array.from(slice, (byte) =>
      byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.'
    ).join('')
    const paddedHex = hex.padEnd(bytesPerRow * 3 - 1, ' ')
    lines.push(`${offset.toString(16).toUpperCase().padStart(6, '0')}  ${paddedHex}  ${ascii}`)
  }

  if (limit === 0) {
    return ''
  }

  if (limit < bytes.length) {
    const remaining = bytes.length - limit
    lines.push(`... (${remaining} more byte${remaining === 1 ? '' : 's'} not shown)`)
  }

  return lines.join('\n')
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8
}

function findLastJpegEoi(bytes: Uint8Array): number | null {
  for (let i = bytes.length - 2; i >= 0; i -= 1) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) {
      return i
    }
  }
  return null
}

function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  return signature.every((value, index) => bytes[index] === value)
}

function inspectPngChunks(bytes: Uint8Array): { trailingBytes: number; unknownChunks: string[] } {
  if (!isPng(bytes)) return { trailingBytes: 0, unknownChunks: [] }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const unknown = new Set<string>()
  let offset = 8
  let iendEnd = bytes.length

  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset)
    const typeBytes = bytes.subarray(offset + 4, offset + 8)
    const type = String.fromCharCode(...typeBytes)
    const chunkDataStart = offset + 8
    const chunkEnd = chunkDataStart + length + 4

    if (!Number.isFinite(length) || chunkEnd > bytes.length || length < 0) {
      break
    }

    if (!PNG_KNOWN_CHUNKS.has(type)) {
      unknown.add(type)
    }

    offset = chunkEnd

    if (type === 'IEND') {
      iendEnd = chunkEnd
      break
    }
  }

  const trailingBytes = Math.max(0, bytes.length - iendEnd)
  return { trailingBytes, unknownChunks: Array.from(unknown).sort() }
}

function findPattern(bytes: Uint8Array, pattern: number[], start = 0): number {
  if (pattern.length === 0) return -1
  const offset = Math.max(0, start)
  const limit = bytes.length - pattern.length
  for (let i = offset; i <= limit; i += 1) {
    let matched = true
    for (let j = 0; j < pattern.length; j += 1) {
      if (bytes[i + j] !== pattern[j]) {
        matched = false
        break
      }
    }
    if (matched) {
      return i
    }
  }
  return -1
}

function asciiToPattern(text: string): number[] {
  return Array.from(text).map((char) => char.charCodeAt(0) & 0xff)
}

function formatHexOffset(offset: number): string {
  return `0x${offset.toString(16).toUpperCase().padStart(6, '0')}`
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className={`section-chevron${collapsed ? ' is-collapsed' : ''}`}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 8l4 4 4-4" />
    </svg>
  )
}

function LocationPanel({
  gpsData,
  locationLabels,
  collapsed,
  onToggle,
  status
}: {
  gpsData: GpsData | null
  locationLabels: string[]
  collapsed: boolean
  onToggle: () => void
  status?: SectionIndicatorStatus | null
}) {
  if (!gpsData) {
    return null
  }

  const locationSummary = locationLabels.join(', ')
  const subtitle = locationSummary || gpsData.decimalString
  const contentId = 'location-content'
  const showStatusIndicator = collapsed && status
  const statusMessage =
    showStatusIndicator && status === 'alert'
      ? 'Sensitive location data detected'
      : showStatusIndicator && status === 'clean'
        ? 'Location section is clean'
        : null

  return (
    <div className={`location-panel collapsible${collapsed ? ' is-collapsed' : ''}`}>
      <div className="section-heading">
        <button
          type="button"
          className={`section-toggle${collapsed ? ' is-collapsed' : ''}`}
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-controls={contentId}
          aria-label={statusMessage ? `Location Preview. ${statusMessage}.` : undefined}
        >
          <span className="section-toggle__text">
            <span className="section-title">Location Preview</span>
            {subtitle && <span className="section-subtitle">{subtitle}</span>}
          </span>
          <span className="section-toggle__icon">
            {showStatusIndicator && (
              <span
                className={`section-status-dot section-status-dot--${status}`}
                aria-hidden="true"
              />
            )}
            <ChevronIcon collapsed={collapsed} />
          </span>
        </button>
      </div>
      {!collapsed && (
        <div className="location-grid" id={contentId}>
          <div className="location-map">
            <InlineMap
              latitude={gpsData.latitude}
              longitude={gpsData.longitude}
              label={locationLabels[0]}
              secondaryLabel={locationLabels[1]}
            />
          </div>
          <div className="location-details">
            {locationSummary && (
              <div className="location-item">
                <span className="location-label">Location</span>
                <span className="location-value location-value--emphasis">{locationSummary}</span>
              </div>
            )}
          <div className="location-item">
            <span className="location-label">Coordinates</span>
            <a
              className="location-value"
              href={`https://www.google.com/maps?q=${gpsData.latitude},${gpsData.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {gpsData.decimalString}
            </a>
            <span className="location-subvalue">{gpsData.dmsString}</span>
          </div>
            {gpsData.altitude !== undefined && gpsData.altitude !== null && (
              <div className="location-item">
                <span className="location-label">Altitude</span>
                <span className="location-value">{gpsData.altitude.toFixed(1)} m</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface MapStyleConfig {
  url: string
  attribution: string
  credit: string
  defaultZoom: number
  maxZoom?: number
  focusRadius?: number
  subdomains?: string | string[]
  strokeColor: string
  fillColor: string
}

const DUSK_MAP_STYLE: MapStyleConfig = {
  url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  credit: '© OpenStreetMap · © CARTO',
  subdomains: 'abcd',
  defaultZoom: 13,
  maxZoom: 18,
  focusRadius: 320,
  strokeColor: '#1d4ed8',
  fillColor: '#2563eb'
}

function InlineMap({
  latitude,
  longitude,
  label,
  secondaryLabel
}: {
  latitude: number
  longitude: number
  label?: string | null
  secondaryLabel?: string | null
}) {
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  const center = useMemo<LatLngExpression>(() => [latitude, longitude], [latitude, longitude])
  const styleConfig = DUSK_MAP_STYLE
  const overlayPrimary = label && label.trim().length > 0 ? label : `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`
  const overlaySecondary = secondaryLabel && secondaryLabel.trim().length > 0 ? secondaryLabel : null

  return (
    <div className="map-wrapper">
      <div className="map-canvas-wrapper">
        {hasMounted ? (
          <MapContainer
            center={center}
            zoom={styleConfig.defaultZoom}
            maxZoom={styleConfig.maxZoom}
            scrollWheelZoom={false}
            doubleClickZoom={false}
            touchZoom={false}
            dragging={false}
            keyboard={false}
            attributionControl={false}
            zoomControl={false}
            className="leaflet-map"
          >
            <TileLayer
              url={styleConfig.url}
              attribution={styleConfig.attribution}
              subdomains={styleConfig.subdomains}
            />
            <RecenterMap center={center} zoom={styleConfig.defaultZoom} />
            {styleConfig.focusRadius && (
              <Circle
                center={center}
                radius={styleConfig.focusRadius}
                pathOptions={{
                  color: styleConfig.strokeColor,
                  weight: 1.4,
                  fillColor: styleConfig.fillColor,
                  fillOpacity: 0.08
                }}
              />
            )}
            <CircleMarker
              center={center}
              radius={7}
              pathOptions={{
                color: styleConfig.strokeColor,
                weight: 2,
                fillColor: styleConfig.fillColor,
                fillOpacity: 0.95
              }}
            />
          </MapContainer>
        ) : (
          <div className="map-placeholder" aria-live="polite">
            Loading map preview…
          </div>
        )}
        <div className="map-crosshair" aria-hidden="true" />
        <div className="map-overlay">
          <span>{overlayPrimary}</span>
          {overlaySecondary && <span>{overlaySecondary}</span>}
        </div>
      </div>

      <div className="map-footnote">{styleConfig.credit}</div>
    </div>
  )
}

function RecenterMap({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMap()

  useEffect(() => {
    map.setView(center, zoom)
  }, [center, zoom, map])

  return null
}

function computeImageStats(params: {
  file: File
  dateCreated: Date | null
  dimensions: { width: number; height: number } | null
  dimensionSource: DimensionSource
}): ImageStats {
  const extension = getFileExtension(params.file.name)
  const typeLabel = params.file.type || formatExtensionLabel(extension)
  const normalizedDimensions = params.dimensions
    ? {
        width: Math.round(params.dimensions.width),
        height: Math.round(params.dimensions.height)
      }
    : null

  const megapixels = normalizedDimensions
    ? (normalizedDimensions.width * normalizedDimensions.height) / 1_000_000
    : null
  const aspectRatio = normalizedDimensions
    ? simplifyAspectRatio(normalizedDimensions.width, normalizedDimensions.height)
    : null

  return {
    name: params.file.name,
    type: typeLabel,
    size: params.file.size,
    dimensions: normalizedDimensions,
    megapixels,
    aspectRatio,
    dateCreated: params.dateCreated,
    lastModified: new Date(params.file.lastModified),
    dimensionsSource: params.dimensionSource
  }
}

function buildMetadataInsights(exif: Record<string, unknown>): MetadataCategoryInsight[] {
  const entries = collectMetadataEntries(exif)

  const categories: CategoryConfig[] = [
    {
      key: 'locationData',
      label: 'Location Data',
      description: 'GPS coordinates, altitude, and map positioning',
      matcher: createKeywordMatcher({
        exactKeys: [
          'gpslatitude',
          'gpslatituderef',
          'gpslongitude',
          'gpslongituderef',
          'gpsposition',
          'gpscoordinates',
          'gpsaltitude',
          'gpsimgdirection',
          'gpsimgdirectionref',
          'gpsmapdatum',
          'gpsareainformation',
          'gpsdestlongitude',
          'gpsdestlatitude',
          'gpsspeed',
          'gpsspeedref',
          'gpsdifferential',
          'gpsstatus',
          'gpsmeasuremode',
          'gpstrack',
          'gpsdatestamp',
          'gpshpositioningerror',
          'latitude',
          'longitude'
        ],
        keywords: ['gps', 'latitude', 'longitude', 'position', 'altitude']
      })
    },
    {
      key: 'identifyingInfo',
      label: 'Identifying Info',
      description: 'Camera owner, device serial, author credits, and software tags',
      matcher: createKeywordMatcher({
        exactKeys: [
          'make',
          'model',
          'unique_cameramodel',
          'cameramodel',
          'cameramodelname',
          'lensmodel',
          'lensmake',
          'lensserialnumber',
          'serialnumber',
          'bodyserialnumber',
          'cameraserialnumber',
          'ownersname',
          'ownername',
          'cameraownername',
          'artist',
          'author',
          'creator',
          'byline',
          'credit',
          'photographer',
          'software',
          'firmwareversion',
          'applicationname',
          'imagename',
          'imagedescription',
          'keywords',
          'iptnames',
          'xpauthor',
          'xpcomment',
          'xpkeywords',
          'xpcompany',
          'personsinpicture',
          'subject'
        ],
        keywords: ['owner', 'artist', 'author', 'creator', 'credit', 'serial', 'make', 'model', 'software', 'copyright', 'lens', 'camera', 'photograph', 'firmware', 'person', 'name']
      })
    },
    {
      key: 'captions',
      label: 'Captions & Notes',
      description: 'Descriptions, captions, comments, and freeform notes stored with the photo',
      matcher: createKeywordMatcher({
        exactKeys: [
          'imagedescription',
          'caption',
          'captionabstract',
          'description',
          'objectname',
          'headline',
          'usercomment',
          'imagehistory',
          'imagenotes',
          'xptitle',
          'xpcomment',
          'xpkeywords',
          'xpauthor',
          'iptcobjectname',
          'iptccaption',
          'iptcheadline',
          'iptcinstructions',
          'xmpdc description',
          'xmpdc title',
          'dublincore description',
          'dublincore title'
        ],
        keywords: ['comment', 'caption', 'description', 'note', 'message', 'title', 'headline', 'abstract', 'memo', 'log', 'story', 'keywords', 'tags']
      })
    },
    {
      key: 'freeformText',
      label: 'Freeform Text',
      description: 'Long text strings that might include hidden messages or comments',
      matcher: (entry) => isLikelyHumanText(entry.value)
    },
    {
      key: 'cameraSettings',
      label: 'Camera Settings',
      description: 'Exposure details that describe how the shot was taken',
      matcher: createKeywordMatcher({
        exactKeys: [
          'fnumber',
          'aperturevalue',
          'exposuretime',
          'exposuremode',
          'exposureprogram',
          'exposurebiasvalue',
          'exposurecompensation',
          'isospeedratings',
          'iso',
          'shutterspeedvalue',
          'shutterspeed',
          'focallength',
          'focallengthin35mmformat',
          'flash',
          'lightsource',
          'whitebalance',
          'meteringmode',
          'scenetype',
          'sensortype',
          'brightnessvalue'
        ],
        keywords: ['exposure', 'shutter', 'aperture', 'fnumber', 'iso', 'focal', 'lens', 'whitebalance', 'metering', 'flash', 'scene', 'focus', 'gain', 'ev']
      })
    },
    {
      key: 'timestamps',
      label: 'Timestamps',
      description: 'Capture, digitized, and modification dates',
      matcher: createKeywordMatcher({
        exactKeys: [
          'datetimeoriginal',
          'createdate',
          'datetime',
          'datetimedigitized',
          'modifydate',
          'subsectime',
          'subsectimeoriginal',
          'subsectimedigitized',
          'gpsdatestamp',
          'gpstimestamp'
        ],
        keywords: ['date', 'time', 'timestamp']
      })
    },
    {
      key: 'otherData',
      label: 'Other Metadata',
      description: 'Orientation, color space, and resolution metadata',
      matcher: createKeywordMatcher({
        exactKeys: [
          'orientation',
          'xresolution',
          'yresolution',
          'resolutionunit',
          'colorspace',
          'iccprofile',
          'iccdescription',
          'compression',
          'interlaced',
          'imagetype',
          'dpi',
          'profiledescription',
          'componentsconfiguration'
        ],
        keywords: ['resolution', 'orientation', 'colorspace', 'profile', 'gamma', 'dpi', 'tonereproduction', 'calibration', 'matrix']
      })
    }
  ]

  return categories.map((category) => {
    const matches = entries.filter(category.matcher)

    const unique = new Map<string, { name: string; path: string; value: unknown }>()
    matches.forEach((entry) => {
      const path = entry.path || entry.key
      if (!path) return
      if (!unique.has(path)) {
        unique.set(path, {
          path,
          name: formatMetadataKey(entry.friendlyPath || path),
          value: entry.value
        })
      }
    })

    const detectedFields = Array.from(unique.values())

    return {
      key: category.key,
      label: category.label,
      description: category.description,
      present: detectedFields.length > 0,
      detectedFields
    }
  })
}

function countMetadataFields(metadata: Record<string, unknown>): number {
  const stack: unknown[] = [metadata]
  const seen = new WeakSet<object>()
  let count = 0

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || typeof current !== 'object') continue
    if (seen.has(current)) continue
    seen.add(current)

    if (Array.isArray(current)) {
      stack.push(...current)
      continue
    }

    Object.entries(current).forEach(([_, value]) => {
      count += 1
      if (value && typeof value === 'object') {
        stack.push(value)
      }
    })
  }

  return count
}

function extractGpsData(metadata: Record<string, unknown>): GpsData | null {
  const entries = collectMetadataEntries(metadata)
  const lookup = new Map<string, unknown>()

  entries.forEach((entry) => {
    lookup.set(normalizeKey(entry.key), entry.value)
    if (entry.friendlyKey) {
      lookup.set(normalizeKey(entry.friendlyKey), entry.value)
    }
    if (entry.path) {
      lookup.set(normalizeKey(entry.path), entry.value)
    }
    if (entry.friendlyPath) {
      lookup.set(normalizeKey(entry.friendlyPath), entry.value)
    }
  })

  const latValue = lookup.get('gpslatitude')
  const lonValue = lookup.get('gpslongitude')

  if (latValue === undefined || lonValue === undefined) {
    return null
  }

  const latRef = lookup.get('gpslatituderef')
  const lonRef = lookup.get('gpslongituderef')
  const altitudeValue = lookup.get('gpsaltitude')
  const altitudeRef = lookup.get('gpsaltituderef')

  const latitude = applyHemisphere(coerceGpsCoordinate(latValue), latRef, ['s'])
  const longitude = applyHemisphere(coerceGpsCoordinate(lonValue), lonRef, ['w'])

  if (latitude === null || longitude === null) {
    return null
  }

  const decimalString = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
  const dmsString = `${formatDms(latitude, 'N', 'S')}, ${formatDms(longitude, 'E', 'W')}`
  const altitude = coerceGpsAltitude(altitudeValue, altitudeRef)

  return {
    latitude,
    longitude,
    altitude,
    decimalString,
    dmsString
  }
}

function extractLocationLabels(metadata: Record<string, unknown>): string[] {
  const entries = collectMetadataEntries(metadata)
  const candidateKeys = new Set([
    'city',
    'cityname',
    'suburb',
    'sublocation',
    'location',
    'locationname',
    'locality',
    'province',
    'state',
    'region',
    'county',
    'country',
    'countryname',
    'countrycode',
    'address',
    'addressline',
    'placename'
  ])

  const priority = new Map<string, number>([
    ['city', 1],
    ['cityname', 1],
    ['suburb', 1],
    ['sublocation', 2],
    ['location', 2],
    ['locationname', 2],
    ['locality', 2],
    ['province', 3],
    ['state', 3],
    ['region', 3],
    ['county', 3],
    ['country', 4],
    ['countryname', 4],
    ['countrycode', 5],
    ['address', 2],
    ['addressline', 2],
    ['placename', 2]
  ])

  const collected: Array<{ value: string; rank: number; order: number }> = []

  entries.forEach((entry, index) => {
    const keysToCheck = [entry.key, entry.friendlyKey, entry.path, entry.friendlyPath].filter(
      (value): value is string => Boolean(value)
    )

    for (const key of keysToCheck) {
      const normalizedKey = normalizeKey(key)
      if (!candidateKeys.has(normalizedKey)) continue

      const text = stringifyLocationValue(entry.value)
      if (!text) continue

      const rank = priority.get(normalizedKey) ?? 10
      const expanded = expandLocationValue(text)
      expanded.forEach((label) => {
        collected.push({ value: label, rank, order: index })
      })
      break
    }
  })

  const deduped = new Map<string, { value: string; rank: number; order: number }>()
  collected.forEach((item) => {
    const key = item.value.toLowerCase()
    if (!deduped.has(key) || deduped.get(key)!.rank > item.rank) {
      deduped.set(key, item)
    }
  })

  return Array.from(deduped.values())
    .sort((a, b) => (a.rank === b.rank ? a.order - b.order : a.rank - b.rank))
    .map((entry) => entry.value)
    .slice(0, 4)
}

const COUNTRY_CODE_MAP: Record<string, string> = {
  AE: 'United Arab Emirates',
  ARE: 'United Arab Emirates',
  AR: 'Argentina',
  ARG: 'Argentina',
  AU: 'Australia',
  AUS: 'Australia',
  BE: 'Belgium',
  BEL: 'Belgium',
  BR: 'Brazil',
  BRA: 'Brazil',
  CA: 'Canada',
  CAN: 'Canada',
  CH: 'Switzerland',
  CHE: 'Switzerland',
  CL: 'Chile',
  CHL: 'Chile',
  CN: 'China',
  CHN: 'China',
  CO: 'Colombia',
  COL: 'Colombia',
  CZ: 'Czechia',
  CZE: 'Czechia',
  DE: 'Germany',
  DEU: 'Germany',
  DK: 'Denmark',
  DNK: 'Denmark',
  ES: 'Spain',
  ESP: 'Spain',
  FI: 'Finland',
  FIN: 'Finland',
  FR: 'France',
  FRA: 'France',
  GB: 'United Kingdom',
  GBR: 'United Kingdom',
  GR: 'Greece',
  GRC: 'Greece',
  HK: 'Hong Kong',
  HKG: 'Hong Kong',
  IE: 'Ireland',
  IRL: 'Ireland',
  IL: 'Israel',
  ISR: 'Israel',
  IN: 'India',
  IND: 'India',
  IT: 'Italy',
  ITA: 'Italy',
  JP: 'Japan',
  JPN: 'Japan',
  KR: 'South Korea',
  KOR: 'South Korea',
  MX: 'Mexico',
  MEX: 'Mexico',
  NL: 'Netherlands',
  NLD: 'Netherlands',
  NO: 'Norway',
  NOR: 'Norway',
  NZ: 'New Zealand',
  NZL: 'New Zealand',
  PE: 'Peru',
  PER: 'Peru',
  PH: 'Philippines',
  PHL: 'Philippines',
  PL: 'Poland',
  POL: 'Poland',
  PT: 'Portugal',
  PRT: 'Portugal',
  RU: 'Russia',
  RUS: 'Russia',
  SA: 'Saudi Arabia',
  SAU: 'Saudi Arabia',
  SE: 'Sweden',
  SWE: 'Sweden',
  SG: 'Singapore',
  SGP: 'Singapore',
  TH: 'Thailand',
  THA: 'Thailand',
  TR: 'Türkiye',
  TUR: 'Türkiye',
  TW: 'Taiwan',
  TWN: 'Taiwan',
  UA: 'Ukraine',
  UK: 'United Kingdom',
  USA: 'United States',
  UAE: 'United Arab Emirates',
  US: 'United States',
  UZ: 'Uzbekistan',
  VN: 'Vietnam',
  VNM: 'Vietnam',
  ZA: 'South Africa',
  ZAF: 'South Africa'
}

const REGION_DISPLAY_NAMES =
  typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null

const REGION_NAME_LOOKUP = (() => {
  const map = new Map<string, string>()
  Object.values(COUNTRY_CODE_MAP).forEach((name) => {
    const key = normalizeRegionKey(name)
    if (key && !map.has(key)) {
      map.set(key, name)
    }
  })
  return map
})()

function expandLocationValue(value: string): string[] {
  if (!value) return []
  const normalized = value
    .replace(/[;|•·]+/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*,\s*/g, ',')
    .trim()

  if (!normalized) return []

  const fragments = normalized
    .split(',')
    .flatMap((part) => part.split('/'))
    .map((fragment) => fragment.trim())
    .filter(Boolean)

  const expanded = fragments
    .flatMap((fragment) => {
      const cleaned = fragment.split(' - ').map((piece) => piece.trim()).filter(Boolean)
      return cleaned.length > 0 ? cleaned : [fragment]
    })
    .map((fragment) => normalizeLocationFragment(fragment))
    .filter((fragment): fragment is string => Boolean(fragment))

  const deduped: string[] = []
  const seen = new Set<string>()
  expanded.forEach((fragment) => {
    const key = fragment.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(fragment)
    }
  })

  if (deduped.length === 0) {
    const fallback = formatLocationLabel(normalized)
    return fallback ? [fallback] : deduped
  }

  return deduped
}

function normalizeLocationFragment(fragment: string): string | null {
  let value = fragment
    .replace(/[()[\]]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  value = value.replace(/^[,.\-–—]+/, '').replace(/[,.\-–—]+$/, '')
  value = value.replace(/\?+/g, '').trim()

  if (!value || value.length === 0) return null
  if (/^\d+$/.test(value)) return null

  const upper = value.toUpperCase()

  if (/^[A-Z]{2}$/.test(upper)) {
    return resolveRegionName(upper) ?? upper
  }

  if (/^[A-Z]{3}$/.test(upper)) {
    const resolved = resolveRegionName(upper)
    if (resolved) return resolved
    return maybeCorrectRegionName(formatLocationLabel(value))
  }

  return maybeCorrectRegionName(formatLocationLabel(value))
}

function formatLocationLabel(input: string): string {
  const words = input.split(/\s+/).map((word) => formatLocationWord(word))
  return words.filter(Boolean).join(' ').trim()
}

function formatLocationWord(word: string): string {
  if (!word) return word
  if (word.includes('-')) {
    return word
      .split('-')
      .map((segment) => formatLocationWord(segment))
      .join('-')
  }

  const upper = word.toUpperCase()
  if (/^[A-Z]{2,3}$/.test(upper)) {
    return resolveRegionName(upper) ?? upper
  }

  const lower = word.toLowerCase()
  if (lower === 'of' || lower === 'and' || lower === 'the') {
    return lower
  }

  if (/^\d/.test(word)) {
    return word
  }

  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

function resolveRegionName(code: string): string | null {
  const upper = code.toUpperCase()
  if (REGION_DISPLAY_NAMES) {
    try {
      const resolved = REGION_DISPLAY_NAMES.of(upper)
      if (resolved && typeof resolved === 'string' && resolved.toUpperCase() !== upper) {
        return resolved
      }
    } catch {
      // Ignore locale resolution errors; we'll fall back to static map.
    }
  }
  return COUNTRY_CODE_MAP[upper] ?? null
}

function normalizeRegionKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z]/g, '')
}

function maybeCorrectRegionName(label: string): string {
  const sanitized = normalizeRegionKey(label)
  if (!sanitized) return label

  const direct = REGION_NAME_LOOKUP.get(sanitized)
  if (direct) return direct

  let bestName: string | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const [key, name] of REGION_NAME_LOOKUP.entries()) {
    const lengthDiff = Math.abs(key.length - sanitized.length)
    if (lengthDiff > 2) continue
    const distance = levenshtein(sanitized, key)
    if (distance <= 4 && distance < bestDistance) {
      bestDistance = distance
      bestName = name
      if (distance === 0) break
    }
  }

  return bestName ?? label
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const matrix: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))

  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i
  }
  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }

  return matrix[a.length][b.length]
}

function stringifyLocationValue(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => stringifyLocationValue(item))
      .filter((part): part is string => Boolean(part))
    if (parts.length === 0) return null
    return parts.join(', ')
  }
  return null
}

function sanitizeMetadata(metadata: Record<string, unknown>): unknown {
  const seen = new WeakSet<object>()

  const convert = (value: unknown): unknown => {
    if (value instanceof Date) {
      return value.toISOString()
    }

    if (typeof value === 'bigint') {
      return value.toString()
    }

    if (ArrayBuffer.isView(value)) {
      const view = value as ArrayBufferView
      return Array.from(new Uint8Array(view.buffer, view.byteOffset, view.byteLength))
    }

    if (value instanceof ArrayBuffer) {
      return Array.from(new Uint8Array(value))
    }

    if (value instanceof Map) {
      return Object.fromEntries(Array.from(value.entries()).map(([key, val]) => [String(key), convert(val)]))
    }

    if (value instanceof Set) {
      return Array.from(value).map(convert)
    }

    if (Array.isArray(value)) {
      return value.map(convert)
    }

    if (value && typeof value === 'object') {
      if (seen.has(value)) {
        return '[Circular]'
      }
      seen.add(value)

      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, val]) => [key, convert(val)])
      )
    }

    if (typeof value === 'number' && !Number.isFinite(value)) {
      return String(value)
    }

    return value
  }

  return convert(metadata)
}

function formatMetadataValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (Array.isArray(value)) {
    return value.map(formatMetadataValue).join(', ')
  }

  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(sanitizeMetadata(value as Record<string, unknown>))
  }

  return String(value)
}

function formatMetadataKey(path: string): string {
  if (!path) return ''
  const segments = path
    .split('.')
    .filter((segment) => segment !== '' && segment !== undefined)
    .map((segment) =>
      segment
        .replace(/\[\d+\]/g, '')
        .replace(/[_:\-]+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((segment) => segment.length > 0)

  if (segments.length === 0) {
    return path
  }

  const formatted = segments.map((segment) => {
    if (/^[a-z0-9]+$/i.test(segment) && segment.length <= 4) {
      return segment.toUpperCase()
    }
    return segment
      .split(' ')
      .filter(Boolean)
      .map((word) => {
        if (word.length <= 3) {
          return word.toUpperCase()
        }
        return word.charAt(0).toUpperCase() + word.slice(1)
      })
      .join(' ')
  })

  return formatted.join(' › ')
}

function shouldDisplayField(categoryKey: string, fieldName: string): boolean {
  if (categoryKey === 'locationData') {
    const normalized = fieldName.toLowerCase()
    if (normalized.includes('ref') || normalized.endsWith('reference')) {
      return false
    }
  }
  return true
}

function simplifyAspectRatio(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const divisor = gcd(width, height)
  const simplifiedWidth = Math.round(width / divisor)
  const simplifiedHeight = Math.round(height / divisor)
  return `${simplifiedWidth}:${simplifiedHeight}`
}

function extractDimensionsFromMetadata(metadata: Record<string, unknown>): { width: number; height: number } | null {
  const widthCandidates = [
    metadata.ExifImageWidth,
    metadata.ImageWidth,
    metadata.PixelXDimension,
    metadata.PhotoWidth,
    metadata.RawImageWidth
  ]

  const heightCandidates = [
    metadata.ExifImageHeight,
    metadata.ExifImageLength,
    metadata.ImageHeight,
    metadata.ImageLength,
    metadata.PixelYDimension,
    metadata.PhotoHeight,
    metadata.RawImageHeight
  ]

  let width = pickFirstNumber(widthCandidates)
  let height = pickFirstNumber(heightCandidates)

  const defaultCropSize = metadata.DefaultCropSize
  if ((!width || !height) && Array.isArray(defaultCropSize) && defaultCropSize.length >= 2) {
    width = width ?? toFiniteNumber(defaultCropSize[0])
    height = height ?? toFiniteNumber(defaultCropSize[1])
  } else if ((!width || !height) && ArrayBuffer.isView(defaultCropSize)) {
    const first = toFiniteNumber(Reflect.get(defaultCropSize, 0))
    const second = toFiniteNumber(Reflect.get(defaultCropSize, 1))
    width = width ?? first
    height = height ?? second
  }

  if (!width || !height) {
    const stringDimensions =
      typeof metadata.ImageSize === 'string'
        ? metadata.ImageSize
        : typeof metadata.ImageDimensions === 'string'
          ? metadata.ImageDimensions
          : null
    const parsed = stringDimensions ? parseDimensionString(stringDimensions) : null
    if (parsed) {
      width = width ?? parsed.width
      height = height ?? parsed.height
    }
  }

  if (width && height) {
    return { width, height }
  }

  return null
}

const SUPPORTED_RAW_EXTENSIONS = new Set([
  'heic',
  'heif',
  'dng',
  'raw',
  'arw',
  'cr2',
  'cr3',
  'nef',
  'nrw',
  'orf',
  'raf',
  'rw2',
  'rwl',
  'srw',
  'pef',
  'dcr',
  'kdc'
])

const TAG_NUMBER_LOOKUP: Record<string, string> = {
  '254': 'NewSubfileType',
  '256': 'ImageWidth',
  '257': 'ImageLength',
  '258': 'BitsPerSample',
  '259': 'Compression',
  '261': 'GrayResponseUnit',
  '262': 'PhotometricInterpretation',
  '270': 'ImageDescription',
  '271': 'Make',
  '272': 'Model',
  '273': 'StripOffsets',
  '274': 'Orientation',
  '277': 'SamplesPerPixel',
  '282': 'XResolution',
  '283': 'YResolution',
  '284': 'PlanarConfiguration',
  '296': 'ResolutionUnit',
  '305': 'Software',
  '306': 'DateTime',
  '315': 'Artist',
  '316': 'HostComputer',
  '33432': 'Copyright',
  '36864': 'ExifVersion',
  '36867': 'DateTimeOriginal',
  '36868': 'DateTimeDigitized',
  '36880': 'OffsetTime',
  '37121': 'ComponentsConfiguration',
  '37377': 'ShutterSpeedValue',
  '37378': 'ApertureValue',
  '37379': 'BrightnessValue',
  '37380': 'ExposureBiasValue',
  '37381': 'MaxApertureValue',
  '37382': 'SubjectDistance',
  '37383': 'MeteringMode',
  '37384': 'LightSource',
  '37385': 'Flash',
  '37386': 'FocalLength',
  '37500': 'MakerNote',
  '37510': 'UserComment',
  '37520': 'SubsecTime',
  '37521': 'SubsecTimeOriginal',
  '37522': 'SubsecTimeDigitized',
  '40961': 'ColorSpace',
  '40962': 'PixelXDimension',
  '40963': 'PixelYDimension',
  '40965': 'InteroperabilityIFDPointer',
  '41483': 'FlashEnergy',
  '41486': 'FocalPlaneXResolution',
  '41487': 'FocalPlaneYResolution',
  '41488': 'FocalPlaneResolutionUnit',
  '41495': 'SensingMethod',
  '41728': 'FileSource',
  '41729': 'SceneType',
  '41730': 'CFAPattern',
  '41985': 'CustomRendered',
  '41986': 'ExposureMode',
  '41987': 'WhiteBalance',
  '41988': 'DigitalZoomRatio',
  '41989': 'FocalLengthIn35mmFilm',
  '42016': 'ImageUniqueID',
  '42032': 'CameraOwnerName',
  '42033': 'BodySerialNumber',
  '42034': 'LensSpecification',
  '42035': 'LensMake',
  '42036': 'LensModel',
  '42037': 'LensSerialNumber',
  '0': 'GPSVersionID',
  '1': 'GPSLatitudeRef',
  '2': 'GPSLatitude',
  '3': 'GPSLongitudeRef',
  '4': 'GPSLongitude',
  '5': 'GPSAltitudeRef',
  '6': 'GPSAltitude',
  '7': 'GPSTimestamp',
  '9': 'GPSSpeedRef',
  '10': 'GPSSpeed',
  '11': 'GPSTrackRef',
  '12': 'GPSTrack',
  '13': 'GPSImgDirectionRef',
  '14': 'GPSImgDirection',
  '15': 'GPSMapDatum',
  '16': 'GPSDestLatitudeRef',
  '17': 'GPSDestLatitude',
  '18': 'GPSDestLongitudeRef',
  '19': 'GPSDestLongitude',
  '20': 'GPSDestBearingRef',
  '21': 'GPSDestBearing',
  '22': 'GPSDestDistanceRef',
  '23': 'GPSDestDistance',
  '27': 'GPSProcessingMethod',
  '29': 'GPSDateStamp',
  '40091': 'XPTitle',
  '40092': 'XPComment',
  '40093': 'XPAuthor',
  '40094': 'XPKeywords',
  '40095': 'XPSubject'
}

const TAG_GROUP_LOOKUP: Record<string, string> = {
  '0th': 'IFD0',
  '1st': 'IFD1',
  ExifIFD: 'EXIF',
  GPS: 'GPS',
  InteropIFD: 'Interoperability',
  Thumbnail: 'Thumbnail'
}

function isSupportedImageFile(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) {
    return true
  }

  const extension = getFileExtension(file.name)
  if (!extension) {
    return false
  }

  return SUPPORTED_RAW_EXTENSIONS.has(extension)
}

function getFileExtension(filename: string): string | null {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1 || lastDot === filename.length - 1) {
    return null
  }
  return filename.slice(lastDot + 1).toLowerCase()
}

function formatExtensionLabel(extension: string | null): string {
  if (!extension) {
    return 'Unknown'
  }
  return `${extension.toUpperCase()} file`
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'bigint') {
    const converted = Number(value)
    return Number.isFinite(converted) ? converted : null
  }
  if (typeof value === 'string') {
    const numeric = Number.parseFloat(value)
    return Number.isFinite(numeric) ? numeric : null
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return null
    return toFiniteNumber(value[0])
  }

  if (ArrayBuffer.isView(value)) {
    return toFiniteNumber(Reflect.get(value, 0))
  }

  if (typeof value === 'object' && value !== null) {
    if ('numerator' in (value as Record<string, unknown>) && 'denominator' in (value as Record<string, unknown>)) {
      const numerator = toFiniteNumber((value as Record<string, unknown>).numerator)
      const denominator = toFiniteNumber((value as Record<string, unknown>).denominator)
      if (numerator !== null && denominator) {
        return numerator / denominator
      }
    }

    const directValue = Number(value)
    return Number.isFinite(directValue) ? directValue : null
  }

  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function pickFirstNumber(candidates: unknown[]): number | null {
  for (const candidate of candidates) {
    const numeric = toFiniteNumber(candidate)
    if (numeric !== null) {
      return numeric
    }
  }
  return null
}

function parseDimensionString(value: string): { width: number; height: number } | null {
  const match = value.match(/(\d+)\D+(\d+)/)
  if (!match) return null
  const width = Number.parseInt(match[1], 10)
  const height = Number.parseInt(match[2], 10)
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return null
  }
  return { width, height }
}

interface MetadataEntry {
  path: string
  friendlyPath: string
  key: string
  friendlyKey: string
  value: unknown
}

interface CategoryConfig {
  key: string
  label: string
  description: string
  matcher: (entry: MetadataEntry) => boolean
}

function collectMetadataEntries(metadata: Record<string, unknown>): MetadataEntry[] {
  const entries: MetadataEntry[] = []
  const stack: Array<{ value: unknown; path: string[]; friendlyPath: string[] }> = [
    { value: metadata, path: [], friendlyPath: [] }
  ]
  const seen = new WeakSet<object>()

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue
    const { value, path, friendlyPath } = current
    if (!value || typeof value !== 'object') {
      continue
    }

    if (seen.has(value)) {
      continue
    }
    seen.add(value)

    if (ArrayBuffer.isView(value) || value instanceof Date) {
      continue
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        const key = String(index)
        const nextPath = [...path, key]
        const nextFriendlyPath = [...friendlyPath, key]
        const pathString = nextPath.join('.')
        const friendlyString = nextFriendlyPath.join('.')
        entries.push({ key, friendlyKey: key, path: pathString, friendlyPath: friendlyString, value: item })
        if (item && typeof item === 'object' && !ArrayBuffer.isView(item) && !(item instanceof Date)) {
          stack.push({ value: item, path: nextPath, friendlyPath: nextFriendlyPath })
        }
      })
      continue
    }

    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      const friendlyKey = translateTagKey(key) ?? key
      const nextPath = [...path, key]
      const nextFriendlyPath = [...friendlyPath, friendlyKey]
      const pathString = nextPath.join('.')
      const friendlyString = nextFriendlyPath.join('.')
      entries.push({
        key,
        friendlyKey,
        path: pathString,
        friendlyPath: friendlyString,
        value: child
      })
      if (child && typeof child === 'object' && !ArrayBuffer.isView(child) && !(child instanceof Date)) {
        stack.push({ value: child, path: nextPath, friendlyPath: nextFriendlyPath })
      }
    })
  }

  return entries
}

function createKeywordMatcher(options: {
  exactKeys?: string[]
  keywords?: string[]
}): (entry: MetadataEntry) => boolean {
  const exactKeys = new Set((options.exactKeys ?? []).map(normalizeKey))
  const keywords = (options.keywords ?? []).map((keyword) => keyword.toLowerCase())

  return (entry: MetadataEntry) => {
    if (!hasMeaningfulValue(entry.value)) {
      return false
    }

    const normalizedKey = normalizeKey(entry.key)
    const normalizedFriendlyKey = normalizeKey(entry.friendlyKey)
    const normalizedPath = normalizeKey(entry.path.replace(/\./g, ''))
    const normalizedFriendlyPath = normalizeKey(entry.friendlyPath.replace(/\./g, ''))

    if (
      exactKeys.size > 0 &&
      (exactKeys.has(normalizedKey) ||
        exactKeys.has(normalizedFriendlyKey) ||
        exactKeys.has(normalizedPath) ||
        exactKeys.has(normalizedFriendlyPath))
    ) {
      return true
    }

    return keywords.some(
      (keyword) =>
        normalizedKey.includes(keyword) ||
        normalizedFriendlyKey.includes(keyword) ||
        normalizedPath.includes(keyword) ||
        normalizedFriendlyPath.includes(keyword)
    )
  }
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'bigint') return true
  if (typeof value === 'boolean') return true
  if (value instanceof Date) return !Number.isNaN(value.getTime())
  if (Array.isArray(value)) return value.length > 0
  if (ArrayBuffer.isView(value)) return (value as ArrayBufferView).byteLength > 0
  if (value instanceof Map || value instanceof Set) return value.size > 0
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0
  return true
}

function translateTagKey(key: string): string | null {
  const trimmed = key.trim()
  if (TAG_GROUP_LOOKUP[trimmed]) {
    return TAG_GROUP_LOOKUP[trimmed]
  }

  if (TAG_NUMBER_LOOKUP[trimmed]) {
    return TAG_NUMBER_LOOKUP[trimmed]
  }

  if (/^0x[0-9a-f]+$/i.test(trimmed)) {
    const decimal = Number.parseInt(trimmed, 16)
    if (!Number.isNaN(decimal)) {
      const mapped = TAG_NUMBER_LOOKUP[String(decimal)]
      if (mapped) return mapped
    }
  }

  return null
}

function isLikelyHumanText(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const text = value.trim()
  if (text.length < 20) return false
  const letterCount = text.replace(/[^a-zA-Z]/g, '').length
  const letterRatio = letterCount / text.length
  if (letterRatio < 0.35) return false
  const wordCount = text.split(/\s+/).filter(Boolean).length
  if (wordCount < 4) return false
  const punctuation = /[.!?]/.test(text)
  return punctuation || wordCount >= 6
}

function normalizeKey(input: string): string {
  if (!input) return ''
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function applyHemisphere(value: number | null, ref: unknown, negatives: string[]): number | null {
  if (value === null) return null
  if (typeof ref !== 'string') return value
  const normalized = ref.trim().toLowerCase()
  return negatives.includes(normalized) ? -Math.abs(value) : Math.abs(value)
}

function coerceGpsCoordinate(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (Array.isArray(value) && value.length >= 3) {
    const [degrees, minutes, seconds] = value
    const deg = toFiniteNumber(degrees) ?? 0
    const min = toFiniteNumber(minutes) ?? 0
    const sec = toFiniteNumber(seconds) ?? 0
    return deg + min / 60 + sec / 3600
  }

  if (typeof value === 'string') {
    const numeric = Number.parseFloat(value)
    if (Number.isFinite(numeric)) {
      return numeric
    }
  }

  if (value && typeof value === 'object' && 'numerator' in (value as Record<string, unknown>)) {
    return toFiniteNumber(value)
  }

  return null
}

function coerceGpsAltitude(value: unknown, ref: unknown): number | null {
  const numeric = toFiniteNumber(value)
  if (numeric === null) return null

  if (typeof ref === 'number' && ref === 1) {
    return -Math.abs(numeric)
  }

  if (typeof ref === 'string') {
    const trimmed = ref.trim()
    if (trimmed === '1') {
      return -Math.abs(numeric)
    }
  }

  return numeric
}

function formatDms(value: number, positive: string, negative: string): string {
  const suffix = value >= 0 ? positive : negative
  const absolute = Math.abs(value)
  const degrees = Math.floor(absolute)
  const minutesFloat = (absolute - degrees) * 60
  const minutes = Math.floor(minutesFloat)
  const seconds = (minutesFloat - minutes) * 60
  return `${degrees}° ${minutes}' ${seconds.toFixed(2)}" ${suffix}`
}

function dedupeFields(fields: Array<{ name: string; path: string; value: unknown }>): Array<{ name: string; path: string; value: unknown }> {
  const seen = new Map<string, { name: string; path: string; value: unknown }>()
  fields.forEach((field) => {
    const normalizedValue = formatMetadataValue(field.value)
    const key = `${field.name}::${normalizedValue}`
    if (!seen.has(key)) {
      seen.set(key, field)
    }
  })
  return Array.from(seen.values())
}
