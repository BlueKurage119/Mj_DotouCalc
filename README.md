# Mj_DotouCalc — 少牌マイティ系ルール点数計算ツール

「怒涛の戦」（麻雀一番街）「万象修羅」（雀魂）のような **手牌12枚+万能牌（オールマイティ）1枚** のルールに特化した麻雀点数計算Webアプリです。

万能牌は捨てられず副露にも使えませんが、和了時には**最も点数が高くなる牌**として扱われます。このツールは万能牌を34種の牌すべてに置換して全パターンを計算し、ルール設定に従った高目判定で最高点の解釈を自動選択します。

## 特徴

- **怒涛の戦 / 万象修羅 プリセット** + 個別トグルによる詳細設定
- 万能牌の解釈（どの牌として計算したか）と全候補一覧を表示
- **聴牌分析**: 手牌12枚で待ち牌一覧と各待ちのロン・ツモ点数を表示
- **何切る分析**: 手牌13枚(ツモ番)で聴牌を保つ打牌候補と打牌後の待ちを表示。和了形なら点数を表示(末尾の牌=和了牌)
- **テンキー入力**: 麻雀牌表記スタイル(`234m` のように数字→スートで確定、0=赤5)。物理キーボードにも対応
- **マテリアルデザインUI**: 怒涛の戦=水色系 / 万象修羅=紫系のテーマ切替。牌画は [FluffyStuff riichi-mahjong-tiles](https://github.com/FluffyStuff/riichi-mahjong-tiles) (public domain) の [React SVG版](https://www.npmjs.com/package/riichi-mahjong-tiles) (MIT) を使用
- スマホでの対局中利用を想定したモバイルファーストUI
- 親なしルール（怒涛の戦: ツモ和了時は他家全員が子として支払い）に対応
- 和了済・飛びによる支払い人数の減少（ツモ損）に対応

## 対応ルール仕様

### 共通
- 手牌12枚 + 万能牌1枚（副露1組につき手牌-3枚）
- 万能牌は赤5への置換不可 / 同一牌の5枚目としての使用可 / 役牌への置換可
- 切り上げ満貫なし（トグルで変更可）・喰いタンあり

### 怒涛の戦（麻雀一番街）
- 親なしの一局戦。ツモ和了時は他家が子として支払い
- 場風なし・「役牌:自風」のみ
- 万能牌はドラとして扱われない

### 万象修羅（雀魂）
- 通常の親あり点数体系
- 万能牌がドラ相当になる場合はドラとして加算
- 高目判定は裏ドラを除いて行い、確定後に裏ドラを加算

これらの細部はすべて「⚙詳細」から個別に変更できます。

## 開発

```bash
npm install
npm run dev      # 開発サーバー
npm test         # vitest (計算コアのテスト)
npm run build    # 本番ビルド (tsc + vite)
```

### アーキテクチャ

```
src/core/       UI非依存の計算コア
  tiles.ts      牌の型定義・ドラ変換など
  backend.ts    riichi-rs-bundlers アダプタ (役・符のみ利用)
  payment.ts    翻符→基本点→支払い額 (親なし方式を自前実装)
  almighty.ts   万能牌の34種置換列挙と高目判定
  options.ts    ルールトグルとプリセット
src/ui/         Reactコンポーネント
tests/          vitest
```

役判定・符計算には [riichi-rs-bundlers](https://www.npmjs.com/package/riichi-rs-bundlers)（[riichi-rust](https://github.com/MahjongPantheon/riichi-rust) のWASMビルド）を使用しています。ドラ計算と支払い額計算は、万能牌ルール対応のため自前実装です。

> **Note**: riichi-rs-bundlers はnpm上でライセンス未宣言です（前身の riichi-ts は GPL-3.0）。本リポジトリを公開配布する場合はライセンス面の確認を推奨します。

## デプロイ (GitHub Pages)

`main` ブランチへのpushで `.github/workflows/deploy.yml` が自動デプロイします。
リポジトリの **Settings → Pages → Source** を **GitHub Actions** に設定してください。

公開URL: `https://<ユーザー名>.github.io/Mj_DotouCalc/`
