/** Editorial scope, audited against the API repository; never a live run status. */
export const API_ORIGIN = "https://api.ai-investment-research.net";
export const PUBLIC_REPOSITORY = "https://github.com/kaznaritanaka-ctrl/AI-Investment-Public";
export const API_REPOSITORY = "https://github.com/kaznaritanaka-ctrl/AI-Investment-APIs";
export const CONTACT_URL = "https://tally.so/r/Xxa7XO";
export const SCOPE_REVIEW_DATE = "2026-10-05";

export const datasets = [
  {
    id: "models", number: "01", name: "Model economics",
    ja: ["モデルの", "価格・仕様・", "変化"], state: "収集設定済み", active: true,
    source: "Models.dev", cadence: "日次観測を設定", scope: "OpenAI / Anthropic / Google / xAI / Mistral", type: "二次カタログ",
    description: ["価格の", "数字だけでは、", "モデルを", "比べられない。", "入力・出力、", "キャッシュ、", "コンテキスト、", "対応する", "入出力を、", "同じ", "観測の", "中に", "残します。"],
    fields: ["入力・出力・キャッシュ価格", "コンテキスト・入出力形式", "初回観測・掲載の変化", "出典・取得範囲・品質"],
    note: ["5社の", "提供元を", "対象にした", "カタログ拡張に", "対応しています。", "収録済みの", "モデルと", "観測日時は", "APIで", "確認できます。", "Models.devの", "掲載値であり、", "各社の", "公式価格を", "直接", "検証した", "値とは", "区別します。"],
    link: "/api-guide#models", linkText: "モデルデータの読み方を見る",
  },
  {
    id: "currency", number: "02", name: "Currency reference",
    ja: ["通貨をまたぐ", "比較の", "土台"], state: "収集設定済み", active: true,
    source: "European Central Bank", cadence: "日次観測を設定", scope: "EUR/USD · EUR/JPY · 計算値 USD/JPY", type: "一次資料・派生値",
    description: ["ドル建てと", "円建ての", "価格を", "読むために。", "ECBの", "参照レートと、", "そのレートから", "計算した", "クロスレートを、", "別の", "系列として", "扱います。"],
    fields: ["参照レート・通貨ペア", "原資料の日付・観測日時", "計算方法・入力となる観測", "休日・鮮度の表示"],
    note: ["リアルタイムの", "取引価格では", "ありません。", "USD/JPYは", "EUR/USDと", "EUR/JPYから", "計算した", "値であり、", "ECBが", "公表する", "原系列とは", "区別します。", "休日や", "更新の", "遅れも", "記録に", "残します。"],
    link: "/api-guide#fx", linkText: "為替データの読み方を見る",
  },
  {
    id: "compute", number: "03", name: "Compute markets",
    ja: ["GPUの", "料金と", "提供条件"], state: "公開準備中", active: false,
    source: "Lambda · さくら · eBay ほか", cadence: "ソースごとに検討", scope: "GPUレンタル / 中古GPU", type: "取得・公開条件を確認中",
    description: ["GPUの", "名前が", "同じでも、", "構成や", "課金単位は", "違う。", "レンタル料金と", "中古の", "掲載価格を、", "地域・仕様・", "提供条件と", "一緒に", "扱うための", "準備を", "進めています。"],
    fields: ["GPU構成・台数・メモリ", "原価格・通貨・課金単位", "地域・提供状況・掲載条件", "比較条件・利用許諾"],
    note: ["GPU向けの", "取得処理と", "APIの", "準備は", "進んでいますが、", "実データの", "収集は", "未有効化です。", "掲載価格は", "成約価格ではなく、", "提供状況は", "市場全体の", "在庫や", "稼働率を", "示しません。"],
    link: `${API_REPOSITORY}/blob/main/docs/source-register.md`, linkText: "情報源と検討状況を見る",
  },
  {
    id: "power", number: "04", name: "Physical inputs",
    ja: ["電力・メモリ・", "設備の", "コスト"], state: "調査・設計中", active: false,
    source: "EIA · JEPX 等を検討", cadence: "日次・月次など", scope: "電力価格・需給 / メモリ / DC設備", type: "今後の観測候補",
    description: ["AIの", "経済性を", "支える、", "電力と", "物理的な", "供給。", "公表頻度や", "地域、", "需要家の", "区分を", "保ちながら、", "価格と", "需給を", "読むための", "情報源を", "検討しています。"],
    fields: ["地域・需要家区分・対象期間", "電力の価格・需要・供給", "メモリ価格・設備関連指標", "原単位・公開条件"],
    note: ["この領域は", "調査・設計の", "段階です。", "月次の", "電力価格を", "日次相場とは", "扱わず、", "一般需要家の", "料金を", "データセンターの", "個別契約単価と", "同一視しません。"],
    link: `${API_REPOSITORY}/blob/main/docs/roadmap.md`, linkText: "拡張のロードマップを見る",
  },
] as const;

export const endpoints = [
  { path: "/v1/datasets", title: "Datasets" },
  { path: "/v1/sources", title: "Sources" },
  { path: "/v1/latest", title: "Latest" },
  { path: "/v1/observations", title: "Observations" },
  { path: "/v1/changes", title: "Changes" },
  { path: "/v1/fx", title: "FX" },
  { path: "/v1/models/coverage", title: "Model coverage" },
  { path: "/v1/models/events", title: "Model events" },
  { path: "/v1/gpu/catalog", title: "GPU catalog" },
  { path: "/v1/gpu/coverage", title: "GPU coverage" },
  { path: "/v1/gpu/metrics", title: "GPU metrics" },
  { path: "/v1/gpu/comparisons", title: "GPU comparisons" },
] as const;
