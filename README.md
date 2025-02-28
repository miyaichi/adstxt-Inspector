# AdsTxt Inspector

A Chrome extension for validating and analyzing Ads.txt, App-ads.txt files and their corresponding Sellers.json entries. Built with TypeScript, React, and TailwindCSS, it helps maintain transparency and quality in programmatic advertising setups.

<img src="src/assets/icons/source/icon.svg" width="20%">

## Architecture

The extension consists of three main components:

1. **Background Service Worker**

   - Monitors active tabs and fetches Ads.txt/App-ads.txt/Sellers.json
   - Stores scan results in Chrome Storage
   - Handles restricted URL patterns
   - Manages scheduled scans
   - Controls alert notifications

2. **Side Panel (React UI)**
   - Provides an intuitive interface with multiple views:
     - Summary View: Overview of supply chain, errors, and relationships
     - Ads.txt Details: Full analysis of ads.txt entries with validation
     - Sellers Analysis: Comprehensive sellers.json analysis
   - Features search, filtering and data export capabilities

## Core Features

### Validation Features

- Automated Ads.txt and App-ads.txt validation
  - Syntax error checking
  - Duplicate entry detection
  - Required field verification
- Sellers.json integration
  - Seller ID verification
  - Relationship validation
  - Missing seller detection

### Analysis Features

  - DIRECT/RESELLER relationship ratio
  - Seller type distribution (PUBLISHER/INTERMEDIARY/BOTH)
  - Validation rate assessment
  - Cross-validation of Ads.txt/App-ads.txt and Sellers.json entries

### Reporting Features

- Error summaries
- Improvement suggestions
- Download Ads.txt/App-ads.txt with errors commented out
- Exportable reports (CSV)

## State Management

Robust state management system utilizing ConnectionManager:

- **Chrome Storage API** for cross-component state sharing
- **Type-safe communication interfaces**
- **Automatic reconnection** with exponential backoff
- **Error handling and logging**

## Project Structure

```
└── src/
    ├── background/
    │   └── background.ts
    ├── hooks/
    │   └── useAdsSellers.ts
    ├── sidepanel/
    │   ├── App.tsx
    │   ├── components/
    │   │   ├── AdsTxtPanel.tsx
    │   │   ├── DownloadAdsTxt.tsx
    │   │   ├── DownloadSellersJson.tsx
    │   │   ├── SearchAndFilter.tsx
    │   │   ├── SellersPanel.tsx
    │   │   ├── SummaryPanel.tsx
    │   │   ├── Tooltip.tsx
    │   │   ├── UpdateNotification.tsx
    │   │   └─ ui/
    │   │       ├── Alert.tsx
    │   │       └── Button.tsx
    │   └── index.tsx
    ├── styles/
    │   └── global.css
    ├── types/
    │   ├── messages.ts
    │   └── types.ts
    └── utils/
        ├── fetchAdsTxt.ts
        ├── fetchSellersJson.ts
        ├── fetchWithTimeout.ts
        ├── logger.ts
        └── sellersJsonCache.ts
```

## Web and App Transparency

AdsTxt Inspector supports both website and mobile application advertising transparency:

- **Ads.txt for websites**: Validates standard Ads.txt files found on domains
- **App-ads.txt for mobile/CTV apps**: Analyzes App-ads.txt files on developer domains
- **Cross-validation**: Verifies relationships between publishers and advertising systems in both web and app environments

## Tech Stack

- TypeScript
- React
- TailwindCSS
- Chrome Extensions API
- Webpack

## Installation

1. Download the latest release file (adstxt-inspector-build.zip
   ) from the [Releases](https://github.com/miyaichi/adstxt-Inspector/releases/tag/latest-build) page.

2. Unzip the file to a local directory.

3. Open Chrome and navigate to `chrome://extensions/`.

4. Enable Developer Mode by toggling the switch in the top right corner.

5. Click on the `Load unpacked` button and select the unzipped directory.

6. The extension should now be installed and visible in the Extensions menu.

## Development Setup

1. Clone the repository:

```bash
git clone [repository-url]
cd ads-txt-inspector
```

2. Install dependencies:

```bash
npm install
```

3. Run in development mode:

```bash
npm run watch
```

4. Build for development:

```bash
npm run build
```

if you want to build for production:

```bash
npm run build:prod
```

## Security Considerations

- Proper handling of cross-origin requests
- Secure storage of sensitive data
- Appropriate handling of restricted URLs
- Implementation of timeout handling for network requests

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/NewFeature`)
3. Commit changes (`git commit -m 'Add NewFeature'`)
4. Push to branch (`git push origin feature/NewFeature`)
5. Create Pull Request

## License

MIT License