---
layout: default
lang: ja
permalink: /ja/schain-guide
title: Supply Chain ガイド
description: Supply Chain ガイド
---

[Home](.) / Supply Chain ガイド

# Supply Chain ガイド

## 1. SupplyChain Objectとは

SupplyChain Object（schain）は、プログラマティック広告の透明性を確保するためのIAB Tech Lab規格の一つです。この仕組みは、OpenRTB入札リクエストに含まれる広告取引経路の情報を提供し、広告インプレッションがどのサプライパスを経由したかを記録します。各取引参加者の詳細情報（Seller ID、ドメイン等）を連鎖的に記録し、経路情報の完全性を示すcompleteフラグによって、取引の透明性を担保します。

### 1.1 取引の流れと検証の仕組み

プログラマティック広告の取引において、Publisher、SSP/Exchange、DSP/Advertiserは各種ファイルを活用して不正在庫を排除し、透明性を確保しています。以下の図は、その取引の流れを示しています：

<pre class="mermaid">
flowchart LR
    subgraph Publisher["Publisher"]
        A["Ads.txt / App-ads.txt"] -->|"宣言"| B(("Inventory"))
        note1["正規販売パートナーを<br/>公開リストで宣言"]
    end

    subgraph SSP["SSP / Exchange"]
        C["Sellers.json"] -->|"OpenRTB"| D["Supply Chain Object"]
        note2["認可された<br/>販売者情報を公開"]
    end

    subgraph DSP["DSP / Advertiser"]
        E["入札判断"] -->|"検証"| F["取引の実行"]
        note3["- Ads.txt確認<br/>- Sellers.json確認<br/>- schain検証"]
    end

    B -->|"在庫情報"| C
    D -->|"Bid Request"| E
</pre>

### 1.2 各プレイヤーの役割と検証の仕組み

取引の透明性を確保するため、各プレイヤーは異なる役割を担っています。Publisher側では、Ads.txt/App-ads.txtを通じて正規販売パートナーを宣言し、認可された取引関係を公開することで、不正リセールを防止します。SSP/Exchange側は、Sellers.jsonで販売者情報を公開し、SupplyChain Objectを生成・伝達することで、取引経路の透明化を実現します。DSP/Advertiser側は、これらのファイルの整合性を確認し、取引経路を検証することで、不正在庫を排除します。

これらの要素は相互に連携し、検証を行います。Ads.txtでは正規販売者の確認やDIRECT/RESELLER関係の確認、Seller IDの整合性チェックが行われます。Sellers.jsonでは販売者情報や取引タイプの確認、ドメインの整合性チェックが実施されます。schainでは取引経路の完全性確認、各ノードの情報確認、completeフラグの確認が行われます。

## 2. Publisherにとっての意味

Publisherにとって、SupplyChain Objectの活用は在庫の価値向上につながります。正規ルートであることを証明し、不正リセールやドメインスプーフィングから在庫を保護することで、より高い入札価格を獲得する機会が生まれます。また、広告取引経路の完全な可視化により、不要なマージンを排除し、不審な取引を早期に発見することができます。これは信頼できる取引の証明となり、長期的なブランド価値の維持と広告主との信頼関係強化にもつながります。

これらのメリットを実現するため、Publisherは以下のような取り組みが必要です。まず、Ads.txtの適切な管理が重要です。正確な情報を記載し定期的に更新を行い、DIRECT/RESELLERの区別を正しく行い、正確なSeller IDを使用する必要があります。また、認可された販売パートナーを明確化し、取引形態を適切に分類することで、未許諾リセールを防止します。さらに、定期的なAds.txtの更新確認、取引経路の監視、エラーや異常の早期発見といった継続的なモニタリングが必要です。

### 2.1 Publisher がしなければいけないこと

1. **Ads.txt / App-ads.txt の整備**  
   - 自社が公認する SSP / Exchange / リセラーの情報を、**正確にファイルへ記載** する。  
   - 新規取引開始や提携終了があれば **速やかに更新** し、schain と矛盾しないようにする。  
   - 記載時は `DIRECT` / `RESELLER` の区別を間違えず、**正しい Seller ID** を使う。

2. **提供される schain 情報の確認**  
   - Publisher 自身は schain を直接生成する機会は少ないものの、**提携先の SSP/Exchange が schain を正しく送信・受信しているか** を確認する。  
   - **「complete=1」設定の有無** などをチェックし、可能な限り **経路が完全に可視化される** ようサポートする。

3. **定期的なメンテナンス**  
   - **Ads.txt / App-ads.txt の更新** を怠ると、DSP 側で「不明な Seller ID」としてブロックされる可能性がある。  
   - schain の活用が進むほど **Ads.txt との整合性** が重視されるため、**常に最新情報** を保つようにする。

## 3. SSP/Exchangeにとっての意味

SSP/Exchangeは、プログラマティック広告エコシステムにおいて重要な役割を担っています。取引経路の正確な記録、完全なschain情報の提供、Publisher在庫の適切な管理を通じて、取引の透明性を確保します。不正在庫の混入を防止し、取引の透明性を確保することで、コンプライアンスを遵守し、市場での信頼性を高めることができます。これにより、高品質なインプレッションを提供し、取引の信頼性を向上させ、市場での競争力を強化することができます。

これらの責任を果たすため、SSP/Exchangeには具体的なアクションが求められます。Sellers.jsonの管理においては、正確な情報を公開し、定期的に更新を行い、Publisher情報を適切に管理する必要があります。schainの実装では、OpenRTBでの正確な情報伝達、completeフラグの適切な設定、各ノードの正確な情報記録が重要です。また、Ads.txtとの整合性確認、不正取引の検知、エラー報告の体制整備といった検証システムの構築も必要です。

### 3.1 SSP/Exchange がしなければいけないこと

1. **Sellers.json の設置・更新**  
   - 自社が **許諾している Publisher や再販事業者** を公開する **Sellers.json** を用意し、ホスティングする。  
   - Publisher の追加・終了、権限変更などがあった場合は **随時ファイルを更新** し、常に最新状態を保つ。

2. **schain 対応の実装**  
   - OpenRTB に準拠して **schain ノードを入札リクエストに含める**（または受け取る）機能を実装する。  
   - schain と `Sellers.json` の情報が **矛盾なく対応** するよう、**Seller ID / Domain 情報** を正しく紐づける。

3. **Ads.txt / App-ads.txt との整合性確認**  
   - Publisher 側の Ads.txt / App-ads.txt と突合し、**不正な Seller ID** がないかチェックする仕組みを整える。  
   - 不正疑いの在庫が検知された場合は **取引ブロック** や **Publisher への通知** を行い、クリーンなマーケットプレイスを維持する。
