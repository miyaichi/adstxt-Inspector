---
layout: default
lang: en
permalink: /en/
title: AdsTxt Inspector
description: Chrome extension for Ads.txt and Sellers.json validation
---

Home / [Schain Guide](./schain-guide)

# AdsTxt Inspector

AdsTxt Inspector is a Chrome extension that helps you validate and analyze Ads.txt and Sellers.json files for programmatic advertising transparency and compliance. It automatically scans these files to detect issues, validates relationships between publishers and sellers, and provides detailed reports.

![AdsTxt Inspector](../images/adstxt-inspector-en.png)

## Key Features

### Real-time Validation

- Automatic scanning of Ads.txt files on publisher websites
- Immediate detection of syntax errors and duplicate entries (optional)
- Verification of seller IDs against Sellers.json files
- Cross-validation of publisher-seller relationships

### Comprehensive Analysis

- Summary view of all advertising relationships
- Breakdown of DIRECT vs RESELLER relationships
- Transaction pattern analysis by domain types
- Publisher and seller-type distribution

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

1. Install the extension from [Chrome Web Store](https://chrome.google.com/webstore/detail/bgojlbkldapcmiimeafldjghcnbgcjha) (or [below](#installation))
2. Navigate to any website you want to analyze
3. Click the extension icon to open the side panel
4. Press "Analyze" to scan Ads.txt and Sellers.json
5. Review the summary, detailed entries, and any validation errors

## Understanding the Results

The extension provides three main views:

### Summary View

- Supply Chain Overview
- Ads.txt Analysis (Errors, Duplicates)
- Distribution of Relationships (DIRECT/RESELLER)
- Seller Verification
- Distribution of Seller Types
- Risk Assessment

### Ads.txt Details

- Complete list of all Ads.txt entries
- Validation status for each entry
- Detailed error messages and suggestions
- Direct links to raw Ads.txt files

### Sellers Analysis

- Comprehensive Sellers.json data
- Seller type distribution
- Relationship verification results
- Links to source Sellers.json files

## Reference Documentation

### Ads.txt Specification

- [IAB Tech Lab Ads.txt Specification 1.1](https://iabtechlab.com/wp-content/uploads/2022/04/Ads.txt-1.1.pdf)
- [IAB Tech Lab Ads.txt Implementation Guide](https://iabtechlab.com/wp-content/uploads/2022/04/Ads.txt-1.1-Implementation-Guide.pdf)
- [Ads.txt Validator](https://adstxt.guru/validator/)

### Sellers.json Specification

- [IAB Tech Lab Sellers.json Specification 1.0](https://iabtechlab.com/wp-content/uploads/2019/07/Sellers.json_Final.pdf)
- [FAQ for Sellers.json and SupplyChain Object](https://iabtechlab.com/wp-content/uploads/2019/07/Sellers.json_Final.pdf)
- [Sellers.json Validator](https://www.aditude.com/tools/sellers-json-validator)

## Installation

1. Download [adstxt-inspector-build.zip](https://github.com/miyaichi/adstxt-Inspector/releases/tag/latest-build)
2. Unzip to local directory
3. Open `chrome://extensions/`
4. Enable Developer Mode
5. Click `Load unpacked` and select the directory

## Privacy & Security

- Works entirely in your browser.
- No data sent to external servers.
- Only analyzes publicly available Ads.txt and Sellers.json files.
- No tracking or analytics collection.

## Contributing

The source code is available on [GitHub](https://github.com/miyaichi/adstxt-Inspector). Contributions are welcome!

## Support

If you have any questions, suggestions, or issues, please let us know [here](https://github.com/miyaichi/adstxt-Inspector/issues).

## Acknowledgements

- [IAB Tech Lab](https://iabtechlab.com/) - Ads.txt and Sellers.json specifications
- [Adstxt.guru](https://adstxt.guru/)、[Aditude](https://www.aditude.com/) - Validation tools for Ads.txt and Sellers.json
- [Ryota Yamauchi](https://www.facebook.com/ryotayamauchiwj), [Shinji Kawarano ](https://www.facebook.com/kawarano) - Debugging and advice
