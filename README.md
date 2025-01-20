# AdsTxt Inspector

A Chrome extension for validating and analyzing ads.txt files and their corresponding sellers.json entries. Built with TypeScript, React, and TailwindCSS, it helps maintain transparency and quality in programmatic advertising setups.

## Architecture

The extension consists of three main components:

1. **Background Service Worker**
   - Monitors active tabs and fetches ads.txt/sellers.json
   - Stores scan results in Chrome Storage
   - Handles restricted URL patterns
   - Manages scheduled scans
   - Controls alert notifications

2. **Content Script**
   - Verifies and retrieves ads.txt file content
   - Fetches and parses sellers.json
   - Monitors tab information
   - Maintains bidirectional communication with Side Panel
   - Prevents duplicate initialization

3. **Side Panel (React UI)**
   - Visualizes scan results
   - Displays real-time errors
   - Provides advertising service analysis view
   - Offers custom settings interface
   - Generates and exports reports

## Core Features

### Validation Features
- Automated ads.txt validation
  - Syntax error checking
  - Duplicate entry detection
  - Required field verification
- Sellers.json integration
  - Seller ID verification
  - Relationship validation
  - Missing seller detection

### Analysis Features
- Advertising service analysis
  - DIRECT/RESELLER ratio
  - Major provider coverage
  - New entry detection
- History management
  - Periodic scan result storage
  - Change tracking
  - Trend analysis

### Reporting Features
- Customizable reports
- Multiple export formats (JSON/CSV)
- Error summaries
- Improvement suggestions

## State Management

Robust state management system utilizing ConnectionManager:

- **Chrome Storage API** for cross-component state sharing
- **Type-safe communication interfaces**
- **Automatic reconnection** with exponential backoff
- **Error handling and logging**

## Project Structure

```
├── src/
│   ├── background/
│   │   ├── background.ts
│   │   ├── adsTxtScanner.ts
│   │   └── sellersJsonFetcher.ts
│   ├── contentScript/
│   │   ├── contentScript.ts
│   │   └── documentScanner.ts
│   ├── sidepanel/
│   │   ├── App.tsx
│   │   ├── components/
│   │   └── hooks/
│   ├── types/
│   │   ├── ads.ts
│   │   ├── messages.ts
│   │   └── sellers.ts
│   └── utils/
│       ├── connectionManager.ts
│       ├── validator.ts
│       └── logger.ts
```

## Tech Stack

- TypeScript
- React
- TailwindCSS
- shadcn/ui
- Chrome Extensions API
- Webpack

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

4. Build for production:
```bash
npm run build
```

## Security Considerations

- Proper handling of cross-origin requests
- Secure storage of sensitive data
- Appropriate handling of restricted URLs
- Implementation of Content Security Policy

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/NewFeature`)
3. Commit changes (`git commit -m 'Add NewFeature'`)
4. Push to branch (`git push origin feature/NewFeature`)
5. Create Pull Request

## License

MIT License