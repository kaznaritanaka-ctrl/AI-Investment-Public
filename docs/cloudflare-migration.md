# Public Worker移行候補（2026-10-14）

この文書はローカル検証と次回の承認後の手順。**本番未適用、GitHub CI未実行、push/PR/main統合未実施**。既存Sitesは変更しない。

## 基準とSites比較

- GitHub main: `63764891a236ba1eef50482c8da502e1a3e5fc21`。開始時・検証途中に remote HEADを確認。
- 元checkoutは `codex/security-resilience-20261005`、同HEADでclean。隔離cloneの `codex/public-cloudflare-migration-20261014` だけを編集。
- Sitesの公開先: https://ai-investment-research.kaznaritanaka.chatgpt.site/
- Sites v6のsource commit: `4302c5a8e63c14344e84ca9418930401cf5a8646`。
- 最新の成功publish: `appgdep_6ac1ef2623688191af98b7e7dd707ca1`、2026-10-04 06:17 UTC。live URLと照合。
- Sites source archiveの登録hash: `d4b5eb3caa346f7661be52993bcab38b26635abcd400424ef42fefb99c4ef9ce`。
- Sitesのリビジョン情報と現行ページDOM・画面を確認した。source archive本体は取得していない。上記commitはGitHub clone内に存在せず、**全ソースの厳密な差分比較は不能**。確認できた表示差分を以下に限定して記録する。

| 部分 | 現行Sites | GitHub mainを採用する候補 |
| --- | --- | --- |
| トップ | 同じヒーロー画像・色・日本語・構成。対象範囲確認日10/04 | 確認日10/05、HTTP API仕様への簡潔な入口 |
| API Guide | 日本語の読み方、価格／カタログ／為替／権利の説明 | HTTP API v0.3.0の技術仕様 |
| canonical | 確認したHTMLにはなし | 本番予定ドメインのページ別canonical |

日本語GuideはGit履歴 `2892793` に存在し、`5da8c03` で技術仕様に変更されている。今回の移行で削除した内容ではない。GitHub mainを正本とする指定に従い現行mainを採用し、Sites版固有の未保存重要変更がないと断定はしない。Sites自体とGit履歴は保持する。
コンテンツの確認日を新しく見せる更新や、APIの現在の収録状況の再監査は今回の対象外。

## 配信構成と差分

`vite.cloudflare.config.ts` → Vinext RSC/SSR + Cloudflare Vite plugin → `build/public-worker.ts` → `dist/server` と `dist/client`。

- Worker名 `ai-investment-public`。独立したPublicのみ。
- ASSETSのみ。D1/R2/KV/Secrets/Service bindings/ADMIN_READ/BACKUP_READ/CONNECTORS/Cronなし。
- `workers_dev=false`、`preview_urls=false`、`routes=[]`。ドメインは後述の別操作で割り当てる。
- 既存固定依存を維持: Vinext 1.0.0-beta.5、Vite 8.0.13、React 19.2.6、Wrangler 4.92.0。
- compatibility dateは同梱workerd 2026-05-15で検証できる `2026-05-15`、`nodejs_compat`。依存更新を混在させない。
- サーバーsourcemapはデバッグ用に配信対象へ同梱し、client側には出さない。観測設定は新Publicだけに適用する。
- Sites用 `vite.config.ts`、`build/sites-worker.ts`、`.openai/hosting.json` は保持。PublicターゲットからSites auth、connector preview、request binding shimを参照しない。
- `app/layout.tsx` とGuide metadataだけ移行先URLへ変更。
- mainに残る `/api-guide#models` と `#fx` のリンク先IDを復元。表示本文・レイアウトは変えない。
- 未使用の `components/ui/input-otp.tsx` で既存の型推論エラーTS2339を検出。ライブラリが公開する `RenderProps` を `useContext` に明記して修正。any化・型検査除外・依存更新なし。Public bundleには含まれない。
- `app/page.tsx`、`app/globals.css`、`lib/public-catalog.ts`、画像・フォント6ファイル、lockfileはmainから変更しない。匿名表記とTally/API/GitHubリンクを維持。

追加・変更するファイル:
`wrangler.public.jsonc`、`vite.cloudflare.config.ts`、`build/public-worker.ts`、`build/public-env.d.ts`、
`scripts/run-public.mjs`、`scripts/verify-public-build.mjs`、`scripts/test-public-http.mjs`、
`package.json`、`app/layout.tsx`、`app/api-guide/page.tsx`、`components/ui/input-otp.tsx`、
`README.md`、本書。

## ローカル検証

Node 24.19.0 / pnpm 11.25.0 / Windows。固定lockfileでインストール。
Windowsでは長いpnpm virtual store pathによりworkerdのpostinstallがENOENTになったため、隔離した短いvirtual storeを指定して同じ固定依存を再インストールした。依存／lockfileの変更はない。

```sh
pnpm install --frozen-lockfile
pnpm types:cloudflare
pnpm typecheck
pnpm build:cloudflare
pnpm check:cloudflare
pnpm dry-run:cloudflare
pnpm preview:cloudflare
# 別ターミナル（loopbackのGET/HEADのみ）
pnpm test:cloudflare:http
```

`run-public.mjs` はbuild/dev/preview/types/dry-runだけを受け付ける。remote bindings無効、previewは127.0.0.1:5174限定。uploadコマンドは含めない。
Windows実行sandboxではesbuildの親ディレクトリ参照が拒否されたため、ローカルdry-run/previewに限って実行制限外で確認した。dry-runは実送信しない。初回の無効な結果を成功分へ加算せず、固定commitの結果をrelease evidenceに保存する。

受け入れ項目:
- 全体型検査、RSC/SSR/client build、Assetsだけのdeploy dry-run。
- build監査: Sites/private用モジュール不混入、client sourcemapなし、public assets 6件のhash一致。
- HTTP: home/Guide GET・HEAD、canonical/description/viewport/lang、両deep link、404、非公開にすべきビルドmetadataパスの404、任意URL proxy不存在。
- Vinext画像処理の外部URLは400。独自proxyを追加しない。
- Browser: 1440×1000、390×844。両画面の直接表示・画像・フォント・横overflow・日本語改行、メニュー、Escape、タブ、Guide往復、目次、別タブのFXアンカー、404。
- 外部リンクはhrefと既存sourceの一致を検証。Tally送信やAPIのCORS変更・収集は行わない。

既存依存由来のINEFFECTIVE_DYNAMIC_IMPORT警告が出る。buildは成功し、ページ遷移・hydrationのエラーは検証中に検出しなかった。GitHub CI、本番CPU/性能/TLS/CDN/WAFの実測は未確認。

## 本番の読取り基準

2026-10-14の確認時点:
- Public Workerなし。他はAPI/Admin/Collectorの3 Worker。
- Custom Domainは `api.ai-investment-research.net` と `admin.ai-investment-research.net` の2件。
- apexには既存TXT `v=spf1 -all` のみ。A/AAAA/CNAMEなし。このTXTは変更しない。
- zoneのWorker Routesは0件。
- Accessアプリは1件（worker宛先）。ポリシー変更なし。公開直前に対象を再照合し、Publicへの想定外の保護・wildcardの競合があれば止める。

これらは固定時点の観測。次の承認時に必ず再取得し、他更新があれば上書きしない。

## 成果物の固定

ローカル候補commitを作成後に型検査・build・build監査・dry-run・HTTP確認を再実行する。
成果物ZIPは `dist/`、移植可能な `wrangler.release.json`、ファイル別SHA256 manifestを含む。
`wrangler.release.json` は生成設定から作る。main/assetsをZIP相対にし、ローカル内部フィールド（configPath等、dev）を除くだけで、Workerの権限・routing・compatibility設定は同一にする。
固定distを書き換えたり、承認後に元作業ツリーから再buildしたりしない。ZIP hash・manifest・候補commit・結果ログはローカルreview成果物に記録する。
node_modules、.env、.dev.vars、認証情報、.gitはZIPへ入れない。

## 承認後の初回配信手順（今回は実行しない）

1. 候補commit・ZIP SHA256・manifestを照合。承認したZIPを新しいローカルdirectoryへ展開。ファイル別hashと設定を確認。
2. Cloudflareアカウント/zone、Public Worker不存在、apex DNS、Custom Domains、Routes、Access対象を直前確認する。既存3 WorkerとDNSの基準を保存。変化があれば停止。
3. **初回は `versions upload` では作成できない**。固定Wranglerで `deploy --config <展開先>/wrangler.release.json` を実行する。ただし設定はroutes空・workers.dev/preview無効なので、この段階ではWebへの配信入口を作らない。新Publicにだけ適用される。初回Worker作成とversion 100% deploymentを記録する。
4. version・bindings（ASSETSのみ）・name・compatibility・observability・workers.dev/preview無効・routes/Cronなしを読み取り照合。想定外ならドメインを追加しない。
5. **別途ドメイン公開承認を得た場合だけ**、Workers Domains APIへ `hostname=ai-investment-research.net`、`service=ai-investment-public`、正しいzone、`enabled=true`、`previews_enabled=false` を指定して1件追加する。CloudflareがDNSと証明書を作る操作を含む。既存TXT・api/adminドメインを編集しない。
6. 作成されたdomain ID・DNS record ID・証明書・deployment IDを保存。TLSが有効になったこと、匿名でhome/Guide/Assets/404が取得できること、PC/mobile、canonical、実version 100%を確認する。API/Adminは読み取り確認だけ。
7. Sitesの公開停止・リダイレクト・削除は行わない。重複公開と検索結果の扱いは別途判断。

CLIに新規API tokenやSecretを登録する手順は含まない。既存認証が利用できなければ不足を報告し、権限を勝手に拡大しない。
初回公開後もこのno-route configで `wrangler deploy` を無批判に繰り返さない。コード更新は `versions upload` →設定照合→ `versions deploy <新ID>@100%` とし、domainは別管理する。

## Rollback

**初回には直前Public versionが存在しない。**
- domain追加前の問題: 公開しないまま停止。Workerは非公開で残し、原因を報告する。削除・追加修正は別承認。
- domain追加後の候補起因障害: rollbackまで明示承認された場合に限り、今回作成したdomain IDだけをdetachする。対応DNSの自動削除結果を確認し、既存TXTとapi/adminレコードが維持されているか照合する。残留した新規DNSを削除する必要がある場合は、そのrecord ID・由来を特定して承認範囲を確認する。
- これはapexを公開前（Web向けDNSなし）へ戻す方法であり、apexをSitesへ自動転送するものではない。既存Sites URLはそのまま利用できる。
- 将来Publicに既存versionがある更新は、直前IDの100%への `versions deploy` で戻し、画面/HTTP/設定を再確認。今回の基準が変わっていたら新しいrollback先で再レビューする。
- DB migration、データ復元、API/Admin/Collector rollbackは不要であり対象外。

## 根拠（2026-10-14確認）

- [Cloudflare Vinext/Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/)
- [Deployment management](https://developers.cloudflare.com/workers/versions-and-deployments/deployment-management/)
- [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)

CLIの具体的な初回制約は固定Wranglerの実装・ヘルプと配信時の最新公式仕様を再確認する。独自ドメインは新DNSと証明書を生成するため、単なるファイルアップロードの承認と混同しない。
