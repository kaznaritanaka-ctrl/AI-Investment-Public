# AI Investment Research — Public

AI投資リサーチの人間向けサイトと、公開APIの読み方を案内するフロントエンドです。

## 内容

- `/`：観測の目的、モデル・為替・GPU・物理コストの対象範囲、方法、APIの入口、問い合わせ。
- `/api-guide`：価格とカタログの区別、取得範囲、履歴のページ送り、参照為替、品質・再利用条件。
- 問い合わせ：https://tally.so/r/Xxa7XO

2026-10-04時点のAPI・Adminリポジトリを照合しています。収集設定、実装、本番の収録状況を区別し、最新の収録状況は公開APIの応答で確認する設計です。確認根拠は `docs/content-audit.md`、表示用の対象範囲は `lib/public-catalog.ts` にあります。

## リポジトリの役割

| Repository | Role |
| --- | --- |
| [AI-Investment-Public](https://github.com/kaznaritanaka-ctrl/AI-Investment-Public) | この人間向けサイトとAPIガイド |
| [AI-Investment-APIs](https://github.com/kaznaritanaka-ctrl/AI-Investment-APIs) | Collector・観測履歴・権利ゲート・公開API |
| [AI-Investment-Admin](https://github.com/kaznaritanaka-ctrl/AI-Investment-Admin) | 運用者向けの別画面 |

Publicにはprivate DB/R2や収集用Secretsを渡しません。公開APIへのリンクを案内し、Collector・Adminへの操作導線は設けていません。現在のAPIのCORSを前提にしたブラウザからの直接取得も行いません。

## 開発

Node.js 22.13以上。既存のVinext / React / Vite構成とpnpm lockfileを維持しています。

```sh
corepack pnpm install --frozen-lockfile
npm run dev
node node_modules/typescript/bin/tsc --noEmit
npm run build
```

通常のローカル開発はportable profileで動作します。ChatGPT Sitesのmanaged-linux環境は、Sitesの手順に従って既存profile・監督付きプレビュー・ビルドを使用します。実行profile、依存関係、生成物、秘密情報はコミットしません。

## 公開

`.openai/hosting.json`は既存Sitesプロジェクトの識別情報です。Sitesでの確認用公開と、将来の `ai-investment-research.net` への配置は分けて管理します。現在のサイトの閲覧範囲を維持し、独自ドメインやAccessの変更は別途行います。

このリポジトリのコードに対する新しい利用ライセンスは今回設定していません。元データの利用条件はコードと別であり、情報源ごとの出典表示・再配布・商用利用・AI入力条件に従います。既存フォントのOFLとvendorのライセンス表記は同梱しています。
