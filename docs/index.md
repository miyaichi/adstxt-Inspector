---
layout: default
title: AdsTxt Inspector
description: A Chrome extension for validating and analyzing ads.txt files and sellers.json entries
---

# AdsTxt Inspector

AdsTxt Inspector is a Chrome extension that helps you validate and analyze ads.txt and sellers.json files for programmatic advertising transparency and compliance. It automatically scans these files to detect issues, validates relationships between publishers and sellers, and provides detailed reports.

## Key Features

### Real-time Validation
- Automatic scanning of ads.txt files on publisher websites
- Immediate detection of syntax errors and duplicate entries
- Verification of seller IDs against sellers.json files
- Cross-validation of publisher-seller relationships

### Comprehensive Analysis
- Summary view of all advertising relationships
- Breakdown of DIRECT vs RESELLER relationships
- Transaction pattern analysis by domain types
- Publisher and seller type distribution

### Error Detection
- Syntax error highlighting with line references
- Missing required field detection
- Mismatched seller ID identification
- Invalid relationship flag warnings

### User Interface
- Clear summary dashboard
- Detailed entry-by-entry inspection
- Real-time error reporting
- Easy-to-read relationship visualizations

## How to Use

1. Install the extension from Chrome Web Store
2. Navigate to any website you want to analyze
3. Click the extension icon to open the side panel
4. Press "Analyze" to scan ads.txt and sellers.json
5. Review the summary, detailed entries, and any validation errors

## Understanding the Results

The extension provides three main views:

### Summary View
- Overview of all advertising relationships
- Total number of entries and their types
- Distribution of seller relationships
- Quick error count and severity levels

### Ads.txt Details
- Complete list of all ads.txt entries
- Validation status for each entry
- Detailed error messages and suggestions
- Direct links to raw ads.txt files

### Sellers Analysis
- Comprehensive sellers.json data
- Seller type distribution
- Relationship verification results
- Links to source sellers.json files

## Reference Documentation

### Ads.txt Specification
- [IAB Tech Lab Ads.txt Specification 1.0.2](https://iabtechlab.com/wp-content/uploads/2019/03/IAB-OpenRTB-Ads.txt-Public-Spec-1.0.2.pdf)
- [Ads.txt Validator](https://adstxt.guru/validator/)
- [IAB Ads.txt Crawler](https://iabtechlab.com/ads-txt-crawler/)

### Sellers.json Specification
- [IAB Tech Lab sellers.json Specification 1.0](https://iabtechlab.com/wp-content/uploads/2019/07/Sellers.json_Final.pdf)
- [Sellers.json Example](https://iabtechlab.com/sellers-json/)
- [Official Implementation Guide](https://iabtechlab.com/wp-content/uploads/2019/07/Sellers.json-Implementation-Guide_Final.pdf)

## Installation

1. Download [adstxt-inspector-build.zip](https://github.com/miyaichi/adstxt-Inspector/releases/tag/latest-build)
2. Unzip to local directory
3. Open `chrome://extensions/`
4. Enable Developer Mode
5. Click "Load unpacked" and select directory

## Privacy & Security

- Works entirely in your browser
- No data sent to external servers
- Only analyzes publicly available ads.txt and sellers.json files
- No tracking or analytics collection