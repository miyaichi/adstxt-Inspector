---
layout: default
lang: ja
permalink: /ja/
title: AdsTxt Inspector
description: Chrome拡張機能 - Ads.txtとSellers.jsonの検証・分析ツール
---

Home / [Supply Chain ガイド](./schain-guide)

# AdsTxt Inspector

## 主な特徴

AdsTxt Inspectorは、プログラマティック広告の透明性とコンプライアンスを確保するために、Ads.txtやSellers.jsonファイルを検証・分析するChrome拡張機能です。これらのファイルを自動的にスキャンし、問題を検出、パブリッシャーとセラーの関係を検証し、詳細なレポートを提供します。Ads.txt, Sellers.jsonを適切に実装することで、[サプライチェーン](./schain-guide)の透明性を向上させ、不正広告のリスクを軽減できます。

## 主な特徴

### リアルタイム検証

- パブリッシャーウェブサイト上のAds.txtファイルを自動スキャン
- 文法エラーや重複エントリ（オプション）を検出
- Sellers.jsonファイルと照合してセラーIDを検証
- パブリッシャーとセラーの関係をクロス検証

### 詳細な分析

- すべての広告関係をサマリー表示
- DIRECT（直接）とRESELLER（リセラー）の関係を分類
- ドメインタイプごとの取引パターン分析
- パブリッシャーとセラータイプの分布

### エラー検出

- 行番号付きの文法エラーのハイライト
- 必須フィールドの欠落を検出
- セラーIDの不一致を識別
- 無効な関係に対する警告フラグ

### ユーザーインターフェース

- わかりやすい概要ダッシュボード
- エントリーごとの詳細な検査
- リアルタイムのエラー報告
- 見やすい関係の視覚化

## 使用方法

1. [Chromeウェブストア](https://chrome.google.com/webstore/detail/bgojlbkldapcmiimeafldjghcnbgcjha)(または[下記](#installation))から拡張機能をインストール
2. 分析したいウェブサイトにアクセス
3. 拡張機能のアイコンをクリックしてサイドパネルを開く
4. 「分析」を押してAds.txtとSellers.jsonをスキャン
5. 要約、詳細エントリ、検証エラーを確認

## 結果の理解

この拡張機能は、以下の3つの主要なビューを提供します：

### Summary View

- サプライチェーン概要
- Ads.txt分析(エラー、重複)
- 関係性の分布(DIRECT/RESELLER)
- セラー検証
- セラータイプの分布
- リスクアセスメント

### Ads.txt Details

- Ads.txtのすべてのエントリの一覧
- 各エントリの検証ステータス
- 詳細なエラーメッセージと改善提案
- 元のAds.txtファイルへのリンク

### Sellers Analysis

- Sellers.jsonの詳細データ
- セラータイプの分布
- 関係検証の結果
- ソースのSellers.jsonファイルへのリンク

## 参考ドキュメント

### Ads.txt 規格

- [IAB Tech Lab Ads.txt Specification 1.1](https://www.pier1.co.jp/wp-content/uploads/2024/02/Ads.txt-1.1-ja.pdf) (日本語)
- [IAB Tech Lab Ads.txt Implementation Guide](https://www.pier1.co.jp/wp-content/uploads/2024/02/Ads.txt-1.1-Implementation-Guide-ja.pdf) (日本語)
- [Ads.txt Validator](https://adstxt.guru/validator/)

### Sellers.json 規格

- [IAB Tech Lab Sellers.json Specification 1.0](https://www.pier1.co.jp/wp-content/uploads/2024/02/Sellers.json_Final-ja.pdf) (日本語)
- [FAQ for Sellers.json and SupplyChain Object](https://www.pier1.co.jp/wp-content/uploads/2024/02/FAQ-for-sellers.json_supplychain-objec-ja.pdf) (日本語)
- [Sellers.json Validator](https://www.aditude.com/tools/sellers-json-validator)

## インストール <a id="installation"></a>

1. [adstxt-inspector-build.zip](https://github.com/miyaichi/adstxt-Inspector/releases/tag/latest-build)をダウンロードします。
2. ローカルディレクトリに解凍します。
3. `chrome://extensions/` を開きます。
4. デベロッパーモードを有効にします。
5. `パッケージ化されていない拡張機能を読み込む` をクリックし、ローカルディレクトリを選択します。

## プライバシーとセキュリティ

- ブラウザ上で動作します。
- 外部サーバーにデータを送信しません。
- 一般公開されているAds.txtとSeller.jsonファイルのみを分析します。
- トラッキングやアナリティクスの収集はありません。

## 貢献

ソースコードは[GitHub](https://github.com/miyaichi/adstxt-Inspector)にあります。貢献を歓迎します！

## 謝辞

- [IAB Tech Lab](https://iabtechlab.com/) - Ads.txtとSellers.jsonの規格策定
- [Adstxt.guru](https://adstxt.guru/)、[Aditude](https://www.aditude.com/) - Ads.txtとSellers.jsonの検証ツール
- [Ryota Yamauchi](https://www.facebook.com/ryotayamauchiwj)、[Shinji Kawarano ](https://www.facebook.com/kawarano) - デバッグとアドバイス
