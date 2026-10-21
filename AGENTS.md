# 運用方針（2026-10-21 Kaz決定・全リポジトリ共通）

この節は下の既存ルールより優先する。ただし既存の技術ルール（権利ゲート、migration、Secrets、テスト手順など）は緩めない。

## 役割と判断
- Kaz（オーナー）が決めるのは「費用」と「方針」だけ。技術的な判断はAIが行い、Kazには平易な日本語で結果と理由を伝える。専門用語を使うときは一言で意味を添える。
- 実装担当は Claude Code（`claude-sonnet-5-5`）と Codex（`gpt-6.1-sol`）。1つの変更は片方が実装し、もう片方がレビューする（相互レビュー）。
- 両者の意見が分かれたら Claude Code の `claude-opus-5-5` が判断する。判断理由はPRに残す。
- SubAgent を使うかどうかは各タスクで各エージェントが決めてよい。
- 利用上限に近づいたら Codex を優先して使う。どちらも上限なら作業を翌日に回す。追加課金で上限を超えない。

## マージとデプロイ
- 相互レビューで承認され、テストとCIがすべて通った変更は、AIがmainへマージし本番へデプロイしてよい。
- 次は従来どおり個別にKazの承認が要る：費用が増える変更（有料プラン・新サービス・従量課金が大幅に増える設定。小さな従量課金は除く）、新しい情報源の権利grant、Secrets/トークンの新規作成や権限拡大、ドメイン/Access変更、データの公開範囲を広げる変更。
- 本番のremote migrationは、相互レビューでmigration自体を確認し、ローカルで既存データ相当の検証が通った場合だけ行う。破壊的migration（削除・型変更）は意見が一致していても Opus 判断を経る。
- マージ・デプロイ後は動作確認を行い、失敗したら直前の版へ戻してKazに報告する。
- 相互レビューの片方が利用上限で使えないときは、片方だけでマージせず翌日に回す。

## 費用
- Cloudflare は Workers Paid（月額5ドル）で運用する。有料プランの変更や新しい有料サービスの追加はKazの承認なしに行わない（小さな従量課金は下記のとおり許容）。
- 小さな従量課金（D1/R2 の保存量・リクエスト増など）は許容する。Cloudflare アカウント全体（3リポジトリ合算）の月額合計（Workers Paid のプラン料金＋従量課金）が20ドルを超える見込みになった場合は、作業を止めてKazに相談する（2026-10-21 Kaz決定）。作業中の見込みと毎月の見積もりのどちらで判明した場合も同様。
- 毎月1日に来月〜1年後の費用見積もりをKazに報告する（定期ルーティンあり）。
- 運用費は Grok・Claude・ChatGPT のサブスクリプションと Cloudflare だけで賄う。別のAPIキー課金や外部有料サービスを増やさない。

## データと公開
- データ元ごとの扱いは利用規約・ライセンスで決める（Kaz決定 2026-10-21）：
  - 再配布が認められている → 公開してよい。
  - 記載がない・判断がつかない → 研究用として非公開で保存（公開しない）。
  - 自動取得や再配布が禁止されている → 収集しない（非公開でも不可）。例: OpenRouter、RunPod。
  - この3区分の判定はAIが行い、判定結果と根拠を記録する。ただし研究用の収集・保存はソースごとの research grant と保存ゲートを通した場合だけ行い（通過前は従来どおり取得も保存もしない）、公開用の収集は既存の権利・保存ゲートに従う。grant の新規登録と公開範囲の拡大は従来どおり個別にKazの承認を取る。
- 後から禁止と判明したソースは収集を止める。保存済みデータの削除は、既存の保持・削除手順に従い、Kazに報告してから行う。
- 個人研究用途として収集したデータは原則公開しない。
- データを出すときは、APIの仕様どおりライセンス・出典の情報を必ず一緒に付ける。

## 触らないもの
- NAS（TOS7）のバックアップ基盤には触らない（設定・スクリプト・認証情報を含む）。

## スケジュールと報告
- データ収集は毎日 03:00 JST過ぎ、その後にバックアップ。Morning Brief は 07:00 JST ごろにKazのチャットへ出す。
- 報告は平易な日本語で、Kazに判断してほしいこと（費用・方針）を一番上に書く。
- Kazは Windows PC・iPad・iPhone から操作する。Kazに頼む作業はブラウザかスマホで完結する形にし、コマンド操作を求めない。

---

# 既存ルール（技術）

- 注記: このサイトは誰でも見られる。表示するデータはライセンスで公開が認められたものだけにし、出典・利用条件を併記する。個人研究用データ（Private研究履歴）は表示しない。
- 注記: CIがないため、マージ条件の「テスト」は TypeScript check と build の成功とする（CI追加は計画の候補）。ai-investment-research.net への新規配置は方針変更なのでKazに確認する。

# AI Investment Research — Public

This repository contains the human-facing website and API reading guide. The Collector, API and Admin remain in their own repositories.

- Preserve the existing editorial design, imagery, Japanese phrase boundaries, responsive behavior and reduced-motion support.
- Visible content must distinguish repository configuration, implementation and observed production availability. Never infer a successful run, live coverage, uptime, real-time prices or available inventory from source code.
- Editorial dataset scope lives in `lib/public-catalog.ts`; revise its review date and `docs/content-audit.md` when refreshing the source audit.
- API responses are the authority for current public data and source-specific reuse conditions. Do not add private D1/R2 bindings, Collector controls, acquisition credentials or an arbitrary HTTP proxy here.
- No browser-side cross-origin fetching should be assumed to work until the API's CORS behavior has been verified. The current website links public read endpoints.
- Preserve anonymous branding. Do not add the operator's personal name or email to public copy. Contact uses the existing Tally URL.
- Keep original currencies, units, source dates, observation times, quality flags and reuse conditions intact when adding data views. Unknown/missing is not zero; advertised price is not transaction price.
- Changes to this website do not authorize API/Admin deployment, database migration, domain/Access changes or newly enabled collectors.
- Run TypeScript checking and the build for source changes. Do not commit dependencies, build output, runtime state, credentials or TypeScript build caches.

The existing `.openai/hosting.json` identifies the same Sites project. Preserve its identity and audience when updating the Sites publication. A separate deployment to `ai-investment-research.net` requires its own explicit request and configuration review.
