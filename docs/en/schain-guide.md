---
layout: default
lang: en
permalink: /en/schain-guide
title: Supply Chain Guide
description: Understanding Advertising Supply Chains Made Simple
---

[Home](.) / Supply Chain Guide

# Supply Chain Guide - Understanding Digital Advertising Transparency

## What is an Advertising Supply Chain?

Before we dive into the technical details, let's understand what an advertising supply chain is.

In digital advertising, content publishers (website or app owners) want to show ads, and advertisers want to display their ads to users. However, between these two parties, there's often a complex network of companies that help connect publishers with advertisers. This network is called the "advertising supply chain."

Think of it like a delivery service for ads:

- **Publishers** own the space where ads appear (like a store with empty shelves)
- **Advertisers** have the ads they want to show (like products)
- The **supply chain** is all the companies that help get the right ads to the right spaces (like delivery trucks, warehouses, and distribution centers)

## What is the SupplyChain Object?

The SupplyChain Object (often abbreviated as "schain") is a technical standard developed by IAB Tech Lab to bring transparency to this complex system. It's basically a digital record that tracks every company involved in delivering an ad from the advertiser to the publisher.

### Why is this important?

1. **Transparency**: Helps advertisers know exactly where their money is going
2. **Fraud Prevention**: Makes it harder for bad actors to sell fake or unauthorized ad space
3. **Quality Control**: Enables verification of legitimate ad inventory sources
4. **Efficiency**: Helps identify and eliminate unnecessary middlemen

## How Does the Supply Chain Work?

### The Key Players

1. **Publishers**: Owners of websites and apps where ads appear

   - They create the content that attracts visitors
   - They have ad spaces to sell (inventory)

2. **SSPs / Exchanges**: Supply-Side Platforms and Ad Exchanges

   - Help publishers sell their ad inventory
   - Connect publishers to multiple potential buyers
   - Example: Google Ad Manager, Xandr, Magnite

3. **DSPs / Advertisers**: Demand-Side Platforms and the brands buying ads
   - Help advertisers buy ad space efficiently
   - Automatically purchase ad impressions across many publishers
   - Example: The Trade Desk, Google DV360, Amazon DSP

### How They Work Together

<pre class="mermaid">
flowchart LR
    subgraph Publisher["Publisher"]
        A["Ads.txt / App-ads.txt"] -->|"Declares"| B(("Inventory"))
        note1["Public list of authorized<br/>selling partners"]
    end

    subgraph SSP["SSP / Exchange"]
        C["Sellers.json"] -->|"OpenRTB"| D["Supply Chain Object"]
        note2["Publishes information<br/>about authorized sellers"]
    end

    subgraph DSP["DSP / Advertiser"]
        E[Bidding Decision] -->|Verify| F[Execute Transaction]
        note3["- Verifies Ads.txt<br/>- Verifies Sellers.json<br/>- Verifies Supply Chain"]
    end

    B -->|"Inventory Info"| C
    D -->|"Bid Request"| E
</pre>

When you visit a website or app:

1. The publisher's ad space becomes available
2. An ad request is sent through the supply chain
3. Advertisers bid to show their ads in real-time
4. The winning ad is displayed
5. Money flows from the advertiser back through the chain to the publisher

## Understanding the Key Files

### Ads.txt/App-ads.txt (Authorized Digital Sellers)

This is a simple text file that publishers place on their websites to publicly declare which companies are authorized to sell their ad inventory.

**Example:**

```
exchange.com, 1234, DIRECT, ab123
adnetwork.com, 5678, RESELLER, cd456
```

This means:

- `exchange.com` with ID `1234` can sell the publisher's inventory directly
- `adnetwork.com` with ID `5678` can resell the publisher's inventory

### Sellers.json

This is a file that SSPs and exchanges publish to identify all the sellers (publishers and intermediaries) they represent.

**Example:**

```json
{
  "sellers": [
    {
      "seller_id": "1234",
      "name": "Example Publisher",
      "domain": "example.com",
      "seller_type": "PUBLISHER"
    }
  ]
}
```

This means:

- The exchange works with a seller identified as `1234`
- This seller is "Example Publisher" with domain "example.com"
- This seller is the actual content publisher (not a reseller)

### SupplyChain Object

This is a data structure included in bid requests that shows the complete path an ad request takes through the supply chain.

**Example:**

```json
{
  "schain": {
    "ver": "1.0",
    "complete": 1,
    "nodes": [
      {
        "asi": "publisher-exchange.com",
        "sid": "1234",
        "hp": 1
      },
      {
        "asi": "dsp-partner.com",
        "sid": "5678",
        "hp": 1
      }
    ]
  }
}
```

This means:

- The ad request started at `publisher-exchange.com` (with seller ID `1234`)
- Then passed through `dsp-partner.com` (with seller ID `5678`)
- The chain is complete (no missing information)

## What Publishers Need to Do

1. **Maintain Accurate Ads.txt/App-ads.txt Files**

   - List all authorized selling partners
   - Specify correct relationships (DIRECT or RESELLER)
   - Update promptly when partnerships change

2. **Verify SupplyChain Information**

   - Work with partners who properly implement supply chain transparency
   - Ensure your inventory is properly identified throughout the chain

3. **Regular Monitoring**
   - Check that your Ads.txt/App-ads.txt is current
   - Monitor for unauthorized sellers of your inventory
   - Verify that supply chain data is accurate

## What SSPs/Exchanges Need to Do

1. **Maintain Accurate Sellers.json Files**

   - List all publishers and resellers in your system
   - Include correct identification information
   - Update when publisher relationships change

2. **Implement SupplyChain Support**

   - Properly pass supply chain information in bid requests
   - Ensure seller IDs match between systems
   - Maintain connection between Ads.txt/App-ads.txt and sellers.json information

3. **Verify Consistency**
   - Check that your sellers' Ads.txt/App-ads.txt entries are accurate
   - Block suspicious inventory without proper identification
   - Maintain a clean marketplace

## Benefits of a Transparent Supply Chain

For everyone in the digital advertising ecosystem:

1. **Reduced Fraud**: Makes it harder for unauthorized parties to sell counterfeit inventory
2. **Better ROI**: Advertisers know where their money is going
3. **Trust**: Creates a more trustworthy ecosystem
4. **Efficiency**: Can identify and eliminate unnecessary intermediaries
5. **Compliance**: Meets increasing industry standards for transparency

## Further Reading

- [IAB Tech Lab Ads.txt Specification](https://iabtechlab.com/ads-txt/)
- [IAB Tech Lab App-ads.txt Specification](https://iabtechlab.com/wp-content/uploads/2019/03/app-ads.txt-v1.0-final-.pdf)
- [IAB Tech Lab Sellers.json Specification](https://iabtechlab.com/sellers-json/)
- [SupplyChain Object Specification](https://github.com/InteractiveAdvertisingBureau/openrtb/blob/master/supplychainobject.md)

---

This guide provides a simplified explanation of the advertising supply chain transparency mechanisms. For more detailed technical information, please refer to the official IAB Tech Lab documentation.
