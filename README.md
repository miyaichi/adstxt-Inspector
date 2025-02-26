# AdsTxt Inspector

A Chrome extension for validating and analyzing ads.txt files and their corresponding sellers.json entries. Built with TypeScript, React, and TailwindCSS, it helps maintain transparency and quality in programmatic advertising setups.

<img src="src/assets/icons/source/icon.svg" width="20%">

## Architecture

The extension consists of three main components:

1. **Background Service Worker**
   - Monitors active tabs and detects URL changes
   - Handles restricted URL patterns
   - Manages communication between components

2. **Side Panel (React UI)**
   - Provides an intuitive interface with multiple views:
     - Summary View: Overview of supply chain, errors, and relationships
     - Ads.txt Details: Full analysis of ads.txt entries with validation
     - Sellers Analysis: Comprehensive sellers.json analysis
   - Features search, filtering and data export capabilities

3. **Utility Modules**
   - Ads.txt and Sellers.json fetching and parsing
   - Advanced validation logic
   - Error detection and reporting

## Core Features

### Validation Features

- **Ads.txt Validation**
  - Syntax error checking
  - Duplicate entry detection
  - Required field verification
  - Proper formatting validation

- **Sellers.json Integration**
  - Seller ID verification
  - Relationship validation
  - Missing seller detection
  - Cross-reference with ads.txt entries

### Analysis Features

- **Transaction Analysis**
  - DIRECT/RESELLER relationship ratio
  - Seller type distribution (PUBLISHER/INTERMEDIARY/BOTH)
  - Validation rate assessment

- **Risk Assessment**
  - Missing owner domain detection
  - Relationship inconsistencies
  - Confidential seller identification
  - Supply chain completeness verification

### Reporting Features

- **Error Summaries**
  - Comprehensive error listings with line references
  - Exportable error reports
  - Actionable error messages

- **Data Export**
  - Download validated ads.txt data
  - Export to CSV for further analysis
  - Error-corrected ads.txt generation

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

## Tech Stack

- **TypeScript** - Type-safe JavaScript
- **React** - UI framework
- **TailwindCSS** - Utility-first CSS framework
- **Chrome Extensions API** - Browser integration
- **PSL** - Public Suffix List processing

## Installation

1. Download the latest release file (adstxt-inspector-build.zip) from the [Releases](https://github.com/miyaichi/adstxt-Inspector/releases/tag/latest-build) page.

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

## Documentation

For more information about ads.txt and sellers.json standards:
- [IAB Tech Lab Ads.txt Specification](https://iabtechlab.com/ads-txt/)
- [IAB Tech Lab Sellers.json Specification](https://iabtechlab.com/sellers-json/)

## License

MIT License
