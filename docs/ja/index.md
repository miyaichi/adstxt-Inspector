---
layout: default
lang: ja
permalink: /ja/
title: AdsTxt Inspector
description: Chrome拡張機能 - Ads.txtとSellers.jsonの検証・分析ツール
---

# AdsTxt Inspector

AdsTxt Inspectorは、プログラマティック広告の透明性とコンプライアンスを確保するために、Ads.txtやSellers.jsonファイルを検証・分析するChrome拡張機能です。これらのファイルを自動的にスキャンし、問題を検出、出版社と販売者の関係を検証し、詳細なレポートを提供します。

## 主な特徴

### リアルタイム検証
- パブリッシャーウェブサイト上のAds.txtファイルを自動スキャン
- 文法エラーや重複エントリを検出
- Sellers.jsonファイルと照合してセラーIDを検証
- パブリッシャーとセラーの関係をクロス検証

### 詳細な分析
- すべての広告関係をサマリー表示
- DIRECT（直接）とRESELLER（再販業者）の関係を分類
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

1. Chromeウェブストア(または、[下記](#installation))から拡張機能をインストール
2. 分析したいウェブサイトにアクセス
3. 拡張機能のアイコンをクリックしてサイドパネルを開く
4.「分析」を押してAds.txtとSellers.jsonをスキャン
5. 要約、詳細エントリ、検証エラーを確認

## 結果の理解

この拡張機能は、以下の3つの主要なビューを提供します：

### Summary View
- すべての広告関係の概要
- エントリ総数とその分類
- セラー関係の分布
- エラー件数とその重要度を素早く確認

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

### Ads.txt Specification
- [IAB Tech Lab Ads.txt Specification 1.1](https://www.pier1.co.jp/wp-content/uploads/2024/02/Ads.txt-1.1-ja.pdf) (日本語)
- [IAB Tech Lab Ads.txt Implementation Guide](https://www.pier1.co.jp/wp-content/uploads/2024/02/Ads.txt-1.1-Implementation-Guide-ja.pdf) (日本語)
- [Ads.txt Validator](https://adstxt.guru/validator/)

### Sellers.json Specification
- [IAB Tech Lab Sellers.json Specification 1.0](https://www.pier1.co.jp/wp-content/uploads/2024/02/Sellers.json_Final-ja.pdf) (日本語)
- [FAQforSellers.jsonandSupplyChainObject](https://www.pier1.co.jp/wp-content/uploads/2024/02/FAQ-for-sellers.json_supplychain-objec-ja.pdf) (日本語)
- [Sellers.json Validator](https://www.aditude.com/tools/sellers-json-validator)

## Installation

1. [adstxt-inspector-build.zip](https://github.com/miyaichi/adstxt-Inspector/releases/tag/latest-build)をダウンロードします。
2.  ローカルディレクトリに解凍します。
3. `chrome://extensions/`を開きます。
4. デベロッパーモードを有効にします。
5. "デベロッパーモードを有効にする" をクリックし、ローカルディレクトリを選択します。

## プライバシーとセキュリティ

- ブラウザ上で動作します。
- 外部サーバーにデータを送信しません。
- 一般公開されているAds.txtとseller.jsonファイルのみを分析します。
- トラッキングやアナリティクスの収集はありません。