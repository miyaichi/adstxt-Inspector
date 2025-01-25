---
layout: default
title: AdsTxt Inspector
description: A Chrome extension for validating and analyzing ads.txt files and sellers.json entries
---

# AdsTxt Inspector

A Chrome extension that helps maintain transparency in programmatic advertising by validating ads.txt files and their corresponding sellers.json entries.

## Features

### Validation
- Automated ads.txt validation with syntax checking and duplicate detection
- Sellers.json integration with ID verification and relationship validation
- Real-time error monitoring and reporting

### Analysis
- Advertising service analysis with DIRECT/RESELLER ratio tracking
- Major provider coverage monitoring
- Historical trend analysis with change tracking

### Reporting
- Customizable report generation
- Multiple export formats (JSON/CSV)
- Error summaries with improvement suggestions

## Architecture

The extension consists of three main components:

### Background Service Worker
- Monitors active tabs and fetches ads.txt/sellers.json
- Manages Chrome Storage for scan results
- Handles restricted URLs and scheduled scans
- Controls notifications

### Content Script
- Validates ads.txt file content
- Processes sellers.json data
- Maintains bidirectional communication
- Prevents duplicate initialization

### Side Panel (React UI)
- Visualizes scan results
- Displays real-time errors
- Provides analysis views
- Manages custom settings
- Generates reports

## Installation

1. Download [adstxt-inspector-build.zip](https://github.com/miyaichi/adstxt-Inspector/releases/tag/latest-build)
2. Unzip to local directory
3. Open `chrome://extensions/`
4. Enable Developer Mode
5. Click "Load unpacked" and select directory

## Development

```bash
# Clone repository
git clone [repository-url]
cd ads-txt-inspector

# Install dependencies
npm install

# Development mode
npm run watch

# Build
npm run build

# Production build
npm run build:prod
```

## Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/NewFeature`)
3. Commit changes (`git commit -m 'Add NewFeature'`)
4. Push branch (`git push origin feature/NewFeature`)
5. Create Pull Request

## License

MIT License