import type { Metadata } from "next";
import { JapaneseText } from "@/components/japanese-text";
import { API_ORIGIN, API_REPOSITORY, CONTACT_URL, PUBLIC_REPOSITORY, SCOPE_REVIEW_DATE } from "@/lib/public-catalog";

export const metadata: Metadata = {
  title: "APIガイド — AI Investment Research",
  description: "AIモデルの価格・仕様と参照為替のAPIガイド。取得範囲、観測日時、品質、出典、再利用条件を確認するための入口。",
};

function Copy({ parts }: { parts: readonly string[] }) {
  return <p><JapaneseText parts={parts} /></p>;
}

export default function ApiGuide() {
  return <>
    <a className="skip-link" href="#guide-main">本文へ移動</a>
    <header className="site-header guide-header">
      <a className="brand" href="/" aria-label="AI Investment Research トップへ"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>AI INVESTMENT<br />RESEARCH</span></a>
      <nav aria-label="ガイドのナビゲーション"><a href="/#datasets">データの対象範囲</a><a href={CONTACT_URL} target="_blank" rel="noreferrer">お問い合わせ</a></nav>
    </header>
    <main id="guide-main" className="guide-main">
      <section className="guide-hero dark-section">
        <span className="eyebrow">READ THE DATA.</span>
        <h1>Start with<br /><em>the context.</em></h1>
        <h2><JapaneseText parts={["数字を", "使う前に、", "条件を", "読む。"]} /></h2>
        <Copy parts={["モデルの", "価格・仕様と", "参照為替を、", "出典、", "観測日時、", "取得範囲と", "一緒に", "取り出すための", "ガイドです。"]} />
        <div className="guide-meta"><span>仕様確認：{SCOPE_REVIEW_DATE}</span><span>JSON / GET・HEAD</span></div>
      </section>
      <div className="guide-body light-section">
        <nav className="guide-index" aria-label="ガイドの目次"><span>CONTENTS</span><a href="#start">01 はじめに</a><a href="#models">02 モデル</a><a href="#fx">03 為替</a><a href="#history">04 履歴と品質</a><a href="#rights">05 利用条件</a></nav>
        <div className="guide-sections">
          <section id="start" className="guide-section">
            <span className="section-kicker">01 / ACCESS</span><h2><JapaneseText parts={["まず、", "対象範囲を", "確認する。"]} /></h2>
            <Copy parts={["最初に", "データセットと", "情報源を", "確認し、", "次に", "必要な", "系列を", "取得します。", "公開される", "範囲や", "鮮度は、", "APIの", "応答で", "確認してください。"]} />
            <div className="guide-base"><span>BASE URL</span><code>{API_ORIGIN}</code></div>
            <dl className="guide-route-list">
              <div><dt><a href={`${API_ORIGIN}/v1/datasets`} target="_blank" rel="noreferrer"><code>/v1/datasets</code></a></dt><dd>公開データセットと定義</dd></div>
              <div><dt><a href={`${API_ORIGIN}/v1/sources`} target="_blank" rel="noreferrer"><code>/v1/sources</code></a></dt><dd>情報源・対象範囲・状態</dd></div>
              <div><dt><a href={`${API_ORIGIN}/openapi.json`} target="_blank" rel="noreferrer"><code>/openapi.json</code></a></dt><dd>パラメータと応答の仕様</dd></div>
              <div><dt><a href={`${API_ORIGIN}/llms.txt`} target="_blank" rel="noreferrer"><code>/llms.txt</code></a></dt><dd>AI向けの利用案内</dd></div>
            </dl>
            <div className="guide-note"><Copy parts={["空の", "応答と", "取得エラーは", "区別してください。", "データが", "ないことは、", "価格が", "0であることや", "市場から", "消えたことを", "意味しません。"]} /></div>
          </section>
          <section id="models" className="guide-section">
            <span className="section-kicker">02 / MODELS</span><h2><JapaneseText parts={["価格と", "カタログは、", "別の入口。"]} /></h2>
            <Copy parts={["価格の", "系列は", "ai_api_prices、", "仕様や", "掲載状態の", "カタログは", "ai_model_catalogです。", "カタログを", "取得する", "ときは、", "datasetを", "明示します。"]} />
            <pre className="guide-code" tabIndex={0} aria-label="APIの取得例"><code>{`# 価格の最新観測\ncurl '${API_ORIGIN}/v1/latest?dataset=ai_api_prices'\n\n# カタログの取得範囲\ncurl '${API_ORIGIN}/v1/models/coverage'\n\n# カタログ観測の履歴\ncurl '${API_ORIGIN}/v1/observations?dataset=ai_model_catalog&limit=100'`}</code></pre>
            <Copy parts={["対象となる", "提供元は", "OpenAI、", "Anthropic、", "Google、", "xAI、", "Mistralです。", "Models.devの", "二次カタログを", "観測するもので、", "各社の", "公式価格を", "直接", "検証した", "値では", "ありません。"]} />
            <div className="guide-note"><Copy parts={["latestは", "最大100系列です。", "ある時点の", "全カタログは、", "coverageで", "スナップショットIDを", "確認し、", "observationsの", "model_snapshotに", "指定して", "取得します。", "next_cursorが", "ある場合は、", "続きも", "取得してください。", "掲載されなくなった", "モデルを、", "提供終了と", "断定しないでください。"]} /></div>
            <a className="text-link" href={`${API_ORIGIN}/v1/methodology/models-catalog-v1`} target="_blank" rel="noreferrer">カタログの観測方法を読む</a>
          </section>
          <section id="fx" className="guide-section">
            <span className="section-kicker">03 / CURRENCY</span><h2><JapaneseText parts={["参照レートと", "計算値を", "分ける。"]} /></h2>
            <Copy parts={["ECBの", "EUR/USD・EUR/JPYを", "原系列として", "扱い、", "USD/JPYは", "そこから", "計算した", "クロスレートとして", "扱います。", "取引可能な", "リアルタイム価格では", "ありません。"]} />
            <div className="guide-formula"><span>USD/JPY</span><strong>EUR/JPY ÷ EUR/USD</strong><span>原系列の観測と計算方法を追跡</span></div>
            <Copy parts={["休日や", "更新が", "遅れた", "日には、", "原資料の", "日付と", "鮮度を", "確認します。", "取得日時が", "新しくても、", "レート自体が", "更新されたとは", "限りません。"]} />
            <div className="guide-link-row"><a className="text-link" href={`${API_ORIGIN}/v1/fx`} target="_blank" rel="noreferrer">為替API</a><a className="text-link" href={`${API_ORIGIN}/v1/methodology/fx-cross-v1`} target="_blank" rel="noreferrer">計算方法</a></div>
          </section>
          <section id="history" className="guide-section">
            <span className="section-kicker">04 / TIME & QUALITY</span><h2><JapaneseText parts={["いつの数字で、", "いつ知ったか。"]} /></h2>
            <dl className="guide-terms"><div><dt>observed_at</dt><dd><JapaneseText parts={["情報を", "取得した", "日時。"]} /></dd></div><div><dt>source_date</dt><dd><JapaneseText parts={["元データが", "示す", "日付。", "不明な", "日時は", "補いません。"]} /></dd></div><div><dt>recorded_at</dt><dd><JapaneseText parts={["観測を", "保存した", "日時。", "当時", "分かっていた", "情報を", "辿るための", "時刻です。"]} /></dd></div></dl>
            <Copy parts={["訂正は", "元の", "観測を", "上書きせず、", "新しい", "観測として", "残します。", "as_ofによる", "過去時点の", "取得にも、", "現在の", "利用条件が", "適用されます。"]} />
            <Copy parts={["履歴の", "検索期間は", "既定で過去30日、", "1回の検索で", "指定できる", "期間は", "最大366日です。", "その期間の", "データが", "すべて", "存在することを", "保証するものでは", "ありません。", "1ページは", "最大100件。", "続きの", "cursorを", "使うときは、", "期間や", "フィルターを", "変えずに", "取得してください。"]} />
            <div className="guide-note"><Copy parts={["小数は", "文字列で", "返ります。", "nullや", "unknownを", "0に", "変換しないでください。", "価格の0は", "未検証の", "ゼロとして", "扱われ、", "無料と", "確認された", "値では", "ありません。"]} /></div>
            <a className="text-link" href={`${API_ORIGIN}/v1/methodology/same-series-change-v1`} target="_blank" rel="noreferrer">同じ条件で変化を比べる</a>
          </section>
          <section id="rights" className="guide-section">
            <span className="section-kicker">05 / REUSE</span><h2><JapaneseText parts={["利用条件も、", "データの一部。"]} /></h2>
            <Copy parts={["出典表示、", "再配布、", "商用利用、", "AIサービスへの", "入力の", "条件は、", "情報源ごとに", "異なります。", "公開されている", "ことだけで、", "すべての", "用途が", "許可される", "わけでは", "ありません。"]} />
            <Copy parts={["応答に", "含まれる", "出典と", "利用条件を", "保ち、", "ライセンスの", "案内を", "確認してください。", "このサイトの", "コードと、", "元データの", "利用条件も", "別に", "扱います。"]} />
            <div className="guide-link-row"><a className="text-link" href={`${API_ORIGIN}/v1/methodology/licenses`} target="_blank" rel="noreferrer">情報源の利用条件</a><a className="text-link" href={CONTACT_URL} target="_blank" rel="noreferrer">利用について相談する</a></div>
            <Copy parts={["料金プランは", "現在", "未定です。", "このサイトは", "投資助言ではなく、", "調査の", "ための", "情報を", "案内します。"]} />
          </section>
        </div>
      </div>
    </main>
    <footer className="site-footer guide-footer"><a href="/">AI Investment Research</a><div><a href={PUBLIC_REPOSITORY} target="_blank" rel="noreferrer">Public source</a><a href={API_REPOSITORY} target="_blank" rel="noreferrer">API仕様・ソース</a><a href={CONTACT_URL} target="_blank" rel="noreferrer">Contact</a></div><span>© 2026 AI Investment Research</span></footer>
  </>;
}
