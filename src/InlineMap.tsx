export default function InlineMap({
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
  const overlayPrimary = label && label.trim().length > 0 ? label : `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`
  const overlaySecondary = secondaryLabel && secondaryLabel.trim().length > 0 ? secondaryLabel : null

  return (
    <div className="map-wrapper">
      <div className="map-canvas-wrapper">
        <div className="map-placeholder" aria-live="polite">
          Map disabled —
          <a
            href={`https://www.google.com/maps?q=${latitude},${longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginLeft: 6 }}
          >
            Open in Maps
          </a>
        </div>
        <div className="map-crosshair" aria-hidden="true" />
        <div className="map-overlay">
          <span>{overlayPrimary}</span>
          {overlaySecondary && <span>{overlaySecondary}</span>}
        </div>
      </div>
      <div className="map-footnote">Coordinates preview</div>
    </div>
  )
}

