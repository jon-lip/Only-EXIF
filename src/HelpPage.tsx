import type { MouseEvent } from 'react'
import './HelpPage.css'

interface HelpPageProps {
  onNavigateHome: () => void
  onCheckMetadata: () => void
  homeHref: string
}

const shouldHandleClientNavigation = (event: MouseEvent<HTMLAnchorElement>) => {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.shiftKey
  )
}

export default function HelpPage({ onNavigateHome, onCheckMetadata, homeHref }: HelpPageProps) {
  const currentYear = new Date().getFullYear()

  const handleHomeClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!shouldHandleClientNavigation(event)) {
      return
    }
    event.preventDefault()
    onNavigateHome()
  }

  return (
    <div className="help-page">
      <header>
        <h1 className="logo">
          <button type="button" className="logo-button" onClick={() => onNavigateHome()}>
            OnlyEXIF
          </button>
        </h1>
        <a href={homeHref} onClick={handleHomeClick} className="header-help" aria-label="Back to app">← Back</a>
      </header>
      <div className="help-wrap">
        <h1 className="help-title">Help</h1>
        <p className="help-subtitle">Quick guide to metadata, cleaning, and safe sharing.</p>

        <div className="help-grid">
          <section className="help-card">
            <h2>Get started</h2>
            <ul>
              <li>Click <strong>Check metadata</strong> at the bottom.</li>
              <li>Select an image from your camera roll or files.</li>
              <li>We instantly generate your audit and verdict.</li>
            </ul>
          </section>

          <section className="help-card">
            <h2>What is meta data?</h2>
            <p>Extra information saved with a photo—like GPS, device details, timestamps, and notes.</p>
          </section>

          <section className="help-card">
            <h2>What we check</h2>
            <ul>
              <li>GPS/location (lat/long, altitude)</li>
              <li>Device identifiers (camera, lens, serial)</li>
              <li>Text fields (author, captions, software)</li>
              <li>Binary anomalies (hidden payload hints)</li>
            </ul>
            <p className="help-note">Analysis runs locally in your browser—images never leave your device.</p>
          </section>

          <section className="help-card">
            <h2>Clean in one step</h2>
            <p>Use Clean to download a fresh copy without embedded metadata.</p>
            <ul>
              <li>Open an image → Review verdict → Clean</li>
              <li>Share the cleaned copy (keep the original private)</li>
            </ul>
          </section>

        </div>

        <div className="help-footer">
          <span>© {currentYear} OnlyEXIF</span>
        </div>
      </div>
      <div className="landing-bottom-bar" role="toolbar" aria-label="OnlyEXIF quick actions">
        <div className="landing-bottom-bar__cta">
          <button type="button" className="tool-button" onClick={onCheckMetadata}>
            Check metadata
          </button>
        </div>
      </div>
    </div>
  )
}
