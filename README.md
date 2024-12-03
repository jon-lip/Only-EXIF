# OnlyEXIF

Browser-based EXIF metadata viewer and removal tool.

## Security Features

### Double-Pass Metadata Stripping
Implements two-pass metadata stripping:
1. First pass: Initial canvas rendering to strip embedded metadata
2. Second pass: Additional canvas processing with recompression to ensure thorough metadata removal

## Features
- Local browser processing
- Supports: JPEG, PNG, HEIC, WebP, GIF
- GPS location detection
- Device information detection
- Personal data detection
- Metadata removal

## Privacy
All processing occurs client-side. No server uploads.

[OnlyEXIF.com](https://onlyexif.com)

![OnlyEXIF Sample](public/onlyexif-sample-image.png)

## Tech Stack
- React
- TailwindCSS
- ExifJS
- Framer Motion
- Leaflet

## Development

```bash
# Install dependencies
npm install

# Run development server
npm start

# Build for production
npm run build
```

## License
MIT

## Source Code
Available on [GitHub](https://github.com/jon-lip/onlyexif)
