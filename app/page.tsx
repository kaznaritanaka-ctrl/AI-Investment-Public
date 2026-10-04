"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Menu, Plus, X } from "lucide-react";
import Image from "next/image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JapaneseText } from "@/components/japanese-text";
import { API_ORIGIN, PUBLIC_REPOSITORY, datasets, endpoints, SCOPE_REVIEW_DATE } from "@/lib/public-catalog";

const API_URL = API_ORIGIN;
const REPOSITORY = PUBLIC_REPOSITORY;
const lenses = [
  { id: "time", number: "01", name: "Time", ja: "いつの情報か。", label: "OBSERVATION / SOURCE DATE", title: ["観測した時刻と、", "情報の日付は違う。"], description: ["今日", "取得した", "情報が、", "今日の", "価格とは", "限りません。", "取得日時と", "原資料の", "日付を", "分け、", "変化が", "起きた", "時点を", "読み違えないように", "します。"], fields: ["observed_at", "source_date", "first_seen"] },
  { id: "context", number: "02", name: "Context", ja: "何を比べているか。", label: "UNITS / CONDITIONS", title: ["数字を比べる前に、", "条件を揃える。"], description: ["100万トークンあたりの", "入力価格と", "出力価格、", "通貨、", "キャッシュの", "有無。", "価格の", "横に", "条件を", "残すことで、", "比較の", "意味を", "保ちます。"], fields: ["currency / unit", "input / output", "pricing_conditions"] },
  { id: "source", number: "03", name: "Provenance", ja: "どこから来たか。", label: "SOURCE / PERMISSION", title: ["出典まで辿れる、", "記録をつくる。"], description: ["一次資料、", "二次カタログ、", "自ら", "計算した", "値を", "区別します。", "保存できる", "情報と", "公開できる", "情報の", "範囲も、", "情報源ごとに", "確認します。"], fields: ["source_id", "source_url", "rights_status"] },
];

function Brand({ footer = false }: { footer?: boolean }) {
  return <a href="#top" className={`brand ${footer ? "brand-footer" : ""}`} aria-label="AI Investment Research トップへ"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>AI INVESTMENT<br />RESEARCH</span></a>;
}
function SectionLabel({ number, children }: { number: string; children: React.ReactNode }) {
  return <div className="section-label"><span>{number}</span><span>{children}</span></div>;
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState("models");
  const [lens, setLens] = useState("time");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const heroRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reveals = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    const revealObserver = new IntersectionObserver((entries) => { entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("is-visible"); revealObserver.unobserve(entry.target); } }); }, { threshold: 0.08 });
    if (!reduced.matches) { document.documentElement.classList.add("motion-ready"); reveals.forEach((element) => revealObserver.observe(element)); }
    const sectionObserver = new IntersectionObserver((entries) => { entries.forEach((entry) => { if (entry.isIntersecting) setActiveSection(entry.target.id); }); }, { rootMargin: "-15% 0px -65% 0px" });
    document.querySelectorAll("main section[id]").forEach((section) => sectionObserver.observe(section));
    let frame = 0;
    const updateScroll = () => { if (frame) return; frame = requestAnimationFrame(() => { const max = document.documentElement.scrollHeight - window.innerHeight; if (progressRef.current) progressRef.current.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`; if (heroRef.current && !reduced.matches && window.scrollY < window.innerHeight * 1.4) heroRef.current.style.setProperty("--hero-drift", `${Math.min(window.scrollY * 0.11, 110)}px`); frame = 0; }); };
    window.addEventListener("scroll", updateScroll, { passive: true }); updateScroll();
    return () => { revealObserver.disconnect(); sectionObserver.disconnect(); window.removeEventListener("scroll", updateScroll); cancelAnimationFrame(frame); document.documentElement.classList.remove("motion-ready"); if (copyTimer.current) clearTimeout(copyTimer.current); };
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); document.getElementById("menu-button")?.focus(); } };
    document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);
  async function copyApi() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(API_URL);
      } else {
        const field = document.createElement("textarea");
        field.value = API_URL; field.style.position = "fixed"; field.style.opacity = "0";
        document.body.appendChild(field); field.select();
        const success = document.execCommand("copy"); field.remove();
        if (!success) throw new Error("Clipboard unavailable");
      }
      setCopied(true); setCopyError(false); if (copyTimer.current) clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setCopied(false), 2600); }
    catch { setCopyError(true); }
  }

  return <>
    <a className="skip-link" href="#main">本文へ移動</a>
    <header className="site-header"><Brand /><nav className={`main-nav ${menuOpen ? "is-open" : ""}`} id="main-navigation" aria-label="メインナビゲーション">{[{ id: "datasets", name: "Datasets" }, { id: "methodology", name: "Methodology" }, { id: "about", name: "About" }].map((item) => <a key={item.id} href={`#${item.id}`} className={activeSection === item.id ? "nav-active" : ""} onClick={() => setMenuOpen(false)}>{item.name}</a>)}<a href="/api-guide" onClick={() => setMenuOpen(false)}>API Guide</a><a href="https://tally.so/r/Xxa7XO" target="_blank" rel="noreferrer">Contact</a><a href="#access" className="nav-access" onClick={() => setMenuOpen(false)}>Explore the API</a></nav><button className="mobile-menu-button" id="menu-button" type="button" aria-expanded={menuOpen} aria-controls="main-navigation" aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button><div ref={progressRef} className="reading-progress" aria-hidden="true" /></header>
    <main id="main">
      <section className="hero" id="top" ref={heroRef}>
        <div className="hero-art" aria-hidden="true"><Image src="/images/observation.webp" width={1536} height={1024} alt="" priority unoptimized /></div>
        <div className="hero-topline"><span className="eyebrow"><span className="signal-dot" />INDEPENDENT DATA RESEARCH</span></div>
        <div className="hero-content"><h1><span>The AI</span><span>economy,</span><span>observed<span className="orange-period">.</span></span></h1><div className="hero-description"><h2><span className="phrase">AIの経済を、</span><span className="phrase">観測する。</span></h2><p><JapaneseText parts={["価格、", "条件、", "そして", "変化の", "履歴。"]} /><span className="hero-lead-description"><JapaneseText parts={["AIへの", "投資を", "考えるための、", "独立した", "データリサーチ。"]} /></span></p><a className="button button-orange" href="#datasets">データと公開範囲を見る</a></div></div>
        <div className="hero-bottom"><span>BEYOND THE HEADLINES.</span><span className="scroll-note">SCROLL TO OBSERVE<span className="scroll-line" aria-hidden="true" /></span></div>
      </section>
      <section className="thesis light-section" id="perspective"><SectionLabel number="01">THE PERSPECTIVE</SectionLabel><div className="thesis-layout reveal"><h2 className="thesis-heading"><span className="heading-line">変化は速い。</span><span className="heading-line muted-ink">記録は、</span><span className="heading-line">あとから作れない。</span></h2><div className="thesis-copy"><span className="small-index">WHY WE OBSERVE</span><p><JapaneseText parts={["新しいモデル、", "新しい価格、", "新しい計算資源。", "AIの経済は、", "毎日のように", "形を", "変えています。"]} /></p><p><JapaneseText parts={["けれど", "発表を", "追うだけでは、", "何が", "どれだけ", "変わったのかは", "見えにくい。", "今日の数字を、", "出典と", "条件ごと", "残す。", "明日の数字と、", "同じものさしで", "比べる。"]} /></p><p><JapaneseText parts={["その積み重ねを、", "投資家と", "AIエージェントが", "使える", "情報の土台に", "していきます。"]} /></p><div className="thesis-footnote"><span className="orange-square" aria-hidden="true" /><span>Today’s observation. Tomorrow’s perspective.</span></div></div></div><div className="principle-strip reveal"><div><span>01</span><strong>History</strong><p><JapaneseText parts={["その日にしか", "残せない", "記録"]} /></p></div><div><span>02</span><strong>Context</strong><p><JapaneseText parts={["比較を", "支える", "単位と", "条件"]} /></p></div><div><span>03</span><strong>Provenance</strong><p><JapaneseText parts={["出典まで", "辿れる", "透明性"]} /></p></div></div></section>
      <section className="datasets light-section" id="datasets"><SectionLabel number="02">THE OBSERVATION INDEX</SectionLabel><div className="section-heading reveal"><h2>What we’re<br /><span className="muted-ink">watching.</span></h2><div><p><JapaneseText parts={["AIの価値を、", "支えるものから", "見る。"]} /></p><span className="scope-caption"><JapaneseText parts={["現在の", "対象範囲と、", "公開準備中の", "観測領域"]} /></span></div></div><Tabs value={selectedDataset} onValueChange={setSelectedDataset} className="dataset-browser reveal" orientation="vertical"><TabsList className="dataset-list" aria-label="観測データセット" variant="line">{datasets.map((dataset) => <TabsTrigger key={dataset.id} value={dataset.id} className="dataset-row"><span className="dataset-number">{dataset.number}</span><span className="dataset-name"><strong>{dataset.name}</strong><span><JapaneseText parts={dataset.ja} /></span></span><span className={`dataset-state ${dataset.active ? "state-active" : ""}`}><span className="status-dot" />{dataset.state}</span><Plus className="dataset-plus" size={19} aria-hidden="true" /></TabsTrigger>)}</TabsList>{datasets.map((dataset) => <TabsContent key={dataset.id} value={dataset.id} className="dataset-detail"><div className="detail-topline"><span>OBSERVATION FILE / {dataset.number}</span><span className="detail-cross" aria-hidden="true">+</span></div><span className={`detail-status ${dataset.active ? "state-active" : ""}`}><span className="status-dot" />{dataset.state}</span><h3>{dataset.name}</h3><p className="detail-description"><JapaneseText parts={dataset.description} /></p><dl className="detail-facts"><div><dt>情報源</dt><dd>{dataset.source}</dd></div><div><dt>更新頻度</dt><dd>{dataset.cadence}</dd></div><div><dt>対象範囲</dt><dd>{dataset.scope}</dd></div><div><dt>情報の種類</dt><dd>{dataset.type}</dd></div></dl><div className="field-tags" aria-label="記録する情報">{dataset.fields.map((field) => <span key={field}>{field}</span>)}</div><p className="detail-note"><JapaneseText parts={dataset.note} /></p><a className="text-link" href={dataset.link} target="_blank" rel="noreferrer">{dataset.linkText}</a></TabsContent>)}</Tabs><div className="index-caption"><span>対象範囲の確認日：{SCOPE_REVIEW_DATE}</span><p><span className="copy-sentence"><JapaneseText parts={["情報源の更新日と、", "観測した日時を", "分けて記録しています。"]} /></span><span className="copy-sentence"><JapaneseText parts={["表示は", "収集設定と", "公開仕様に", "基づきます。", "最新の", "収録状況は", "APIで", "確認してください。"]} /></span></p></div></section>
      <section className="methodology dark-section" id="methodology"><SectionLabel number="03">THE METHOD</SectionLabel><div className="method-intro reveal"><h2><span className="heading-line">A number is</span><span className="heading-line">only the <em>beginning.</em></span></h2><p><span className="copy-sentence"><JapaneseText parts={["数字に、読める文脈を。"]} /></span><span className="copy-sentence"><JapaneseText parts={["観測を支える、", "3つの視点。"]} /></span></p></div><Tabs value={lens} onValueChange={setLens} className="method-browser reveal"><TabsList className="method-tabs" aria-label="データの観測方針" variant="line">{lenses.map((item) => <TabsTrigger key={item.id} value={item.id} className="method-tab"><span>{item.number}</span><strong>{item.name}</strong><span className="method-tab-ja">{item.ja}</span></TabsTrigger>)}</TabsList>{lenses.map((item) => <TabsContent value={item.id} key={item.id} className="method-detail"><div className="method-detail-index" aria-hidden="true">{item.number}<span>RESEARCH LENS</span></div><div className="method-detail-copy"><span className="eyebrow">{item.label}</span><h3>{item.title.map((line) => <span className="phrase" key={line}>{line}</span>)}</h3><p><JapaneseText parts={item.description} /></p><div className="method-fields">{item.fields.map((field) => <code key={field}>{field}</code>)}</div></div></TabsContent>)}</Tabs><div className="method-principle reveal"><span className="small-index">A RECORD, NOT A REWRITE.</span><p><span className="method-principle-main"><JapaneseText parts={["過去の", "記録を、", "未来の", "知識で", "塗り替えない。"]} /></span><span><JapaneseText parts={["訂正や", "欠測も、", "その経緯が", "分かる", "履歴として", "残していく。"]} /></span></p></div></section>
      <section className="access light-section" id="access"><SectionLabel number="04">BUILT TO BE USED</SectionLabel><div className="access-layout reveal"><div className="access-copy"><h2>For people.<br /><span className="muted-ink">And agents.</span></h2><p><span className="phrase">人間が読める。</span><span className="phrase">機械が使える。</span></p><p className="body-copy"><JapaneseText parts={["リサーチの", "入口は", "このサイトに。", "構造化された", "データの", "入口は", "APIに。", "同じ記録を、", "それぞれの", "方法で", "活用できます。"]} /></p><a className="text-link" href="/api-guide">APIの使い方・利用条件を読む</a></div><div className="api-panel"><div className="api-panel-header"><span className="signal-dot" /><span>PROGRAMMATIC ACCESS</span><span>HTTP</span></div><span className="api-label">API BASE URL</span><div className="api-url">api.ai-investment-research.net</div><div className="api-address-row"><code>{API_URL}</code><button type="button" onClick={copyApi} className="copy-button" aria-label="APIのURLをコピー">{copied ? <Check size={17} /> : <Copy size={17} />}</button></div><span role="status" className="copy-status"><JapaneseText parts={copied ? ["URLを", "コピーしました"] : copyError ? ["上のURLを", "選択して", "コピーしてください"] : ["構造化された", "観測データへの", "入口"]} /></span><div className="api-entry-links"><a href={`${API_URL}/openapi.json`} target="_blank" rel="noreferrer">OpenAPI</a><a href={`${API_URL}/llms.txt`} target="_blank" rel="noreferrer">AI向け案内</a><a href={`${API_URL}/v1/datasets`} target="_blank" rel="noreferrer">データセット</a></div><div className="api-panel-bottom"><span>VERSIONED DATA</span><span>TRACEABLE SOURCES</span></div></div></div><div className="endpoint-grid reveal" aria-label="APIの入口">{endpoints.map((endpoint) => <a className="endpoint-card" key={endpoint.path} href={`${API_URL}${endpoint.path}`} target="_blank" rel="noreferrer"><span>{endpoint.title}</span><code>{endpoint.path}</code><p><JapaneseText parts={endpoint.description} /></p></a>)}</div><div className="access-note reveal"><span>IN DEVELOPMENT</span><p><JapaneseText parts={["観測範囲と", "公開APIを", "順次", "拡張しています。", "必要な", "データや", "利用目的を、", "ぜひ", "聞かせてください。"]} /></p><a className="button button-dark" href="https://tally.so/r/Xxa7XO" target="_blank" rel="noreferrer">データについて相談する</a></div></section>
      <section className="about light-section" id="about">
        <SectionLabel number="05">INDEPENDENT BY DESIGN</SectionLabel>
        <div className="about-layout reveal">
          <div className="about-title">
            <span className="small-index">OUR PRINCIPLES</span>
            <h2>Built from<br /><em>curiosity.</em></h2>
          </div>
          <div className="about-copy">
            <h3><span className="phrase">解釈の前に、</span><span className="phrase">確かな記録を。</span></h3>
            <p><JapaneseText parts={["AIへの", "投資を", "考えるとき、", "必要な", "情報は", "散らばり、", "過去の", "状態を", "辿れないことが", "あります。", "AI Investment Researchは、", "その空白を", "埋めるために", "生まれた", "独立データリサーチです。"]} /></p>
            <p><JapaneseText parts={["価格だけでなく、", "出典や", "条件、", "観測日時も", "残す。", "日々の", "記録を", "積み重ね、", "投資家と", "AIエージェントが", "使える", "情報の土台を", "つくります。"]} /></p>
            <div className="about-service"><span className="signal-dot" aria-hidden="true" /><div><strong>AI Investment Research</strong><span>Independent data research</span></div></div>
            <div className="about-links"><a className="text-link" href="#methodology">観測の方針を読む</a><a className="text-link" href="https://tally.so/r/Xxa7XO" target="_blank" rel="noreferrer">お問い合わせ</a></div>
          </div>
        </div>
      </section>
      <section className="closing dark-section"><div className="closing-top"><span className="eyebrow">THE NEXT OBSERVATION STARTS TODAY.</span><span className="closing-coordinates">HISTORY / CONTEXT / PROVENANCE</span></div><h2 className="reveal">Stay curious.<br /><span>Keep observing.</span></h2><div className="closing-bottom"><p><JapaneseText parts={["明日の", "視点を、", "今日の", "記録から。"]} /></p><a className="button button-orange" href="https://tally.so/r/Xxa7XO" target="_blank" rel="noreferrer">Let’s talk</a></div></section>
    </main>
    <footer className="site-footer"><div className="footer-main"><Brand footer /><p>Independent observations on the economics of AI.</p><div className="footer-links"><a href="#datasets">Datasets</a><a href="#methodology">Methodology</a><a href="/api-guide">API Guide</a><a href={REPOSITORY} target="_blank" rel="noreferrer">Public source</a><a href="https://tally.so/r/Xxa7XO" target="_blank" rel="noreferrer">Contact</a></div></div><div className="footer-bottom"><span>© 2026 AI INVESTMENT RESEARCH</span><p><JapaneseText parts={["投資判断のための", "情報基盤を", "研究しています。", "掲載情報は", "投資助言では", "ありません。"]} /></p><a href="#top">BACK TO TOP</a></div></footer>
  </>;
}
