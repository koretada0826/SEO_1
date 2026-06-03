"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useDB, actions, getJob } from "@/lib/store";
import { JobPicker } from "@/components/JobPicker";
import {
  Card,
  Button,
  Badge,
  Field,
  Input,
  Textarea,
  Select,
  PageHeader,
  SectionTitle,
  CopyButton,
} from "@/components/ui";
import {
  generateSeoOutline,
  generateTitles,
  generateMetaDescriptions,
  generateFaqs,
  analyzeCompetitors,
  generateGeoSuggestions,
  GEO_CHECK_AREAS,
  formatForMarkdown,
} from "@/lib/mockAI";
import { CATEGORY_LABEL } from "@/lib/labels";
import type {
  Job,
  OutlineNode,
  TitleIdea,
  MetaIdea,
  FaqItem,
  GeoSuggestion,
  CompetitorAnalysis,
  AiPolicy,
} from "@/lib/types";

type SearchIntent = {
  explicit: string[];
  latent: string[];
  reallyWant: string;
  anxiety: string;
  finalAction: string;
};
type Persona = {
  age: string;
  situation: string;
  pains: string[];
  alternatives: string[];
  wants: string[];
};
type Goal = { understand: string; action: string; cta: string };

const PURPOSES = ["SEO流入", "問い合わせ", "資料請求", "商品購入", "予約", "認知獲得"];
const TONES = ["専門的", "やさしい", "初心者向け", "比較検討向け", "セールス寄り"];
const AI_MODES: { value: AiPolicy; label: string }[] = [
  { value: "allowed", label: "使用可" },
  { value: "forbidden", label: "使用不可" },
  { value: "unknown", label: "不明" },
];
const OUTPUT_FORMATS = [
  "Google Docs",
  "Markdown",
  "PDF",
  "スプレッドシート",
  "WordPress入稿用",
];

const priorityTone = (p: "A" | "B" | "C") =>
  p === "A"
    ? "border-danger/40 bg-danger/10 text-danger"
    : p === "B"
    ? "border-warn/40 bg-warn/10 text-warn"
    : "border-border bg-white/5 text-muted";

// ── inline helpers (mockAI has none) ──
function buildSearchIntent(keyword: string, purpose: string): SearchIntent {
  const kw = keyword || "対象キーワード";
  return {
    explicit: [
      `${kw}の意味・定義を知りたい`,
      `${kw}の選び方・始め方を知りたい`,
      `${kw}の費用・相場を知りたい`,
    ],
    latent: [
      `${kw}で失敗したくない`,
      `自分に合った${kw}を判断したい`,
      `他の選択肢と比較したい`,
    ],
    reallyWant: `${kw}について「結局どうすればよいか」を迷わず判断できる状態になりたい`,
    anxiety: `情報が多すぎて${kw}を正しく選べないのではないか、損をするのではないかという不安`,
    finalAction:
      purpose === "問い合わせ"
        ? "信頼できる相手に問い合わせる"
        : purpose === "資料請求"
        ? "詳しい資料を請求する"
        : purpose === "商品購入"
        ? "納得して商品を購入する"
        : purpose === "予約"
        ? "安心して予約する"
        : `${kw}に関する次の一歩を踏み出す`,
  };
}

function buildPersona(keyword: string, targetReader: string, painPoint: string): Persona {
  const kw = keyword || "対象キーワード";
  return {
    age: "30〜40代",
    situation:
      targetReader ||
      `${kw}に初めて本格的に取り組もうとしていて、情報を集めて比較検討している段階`,
    pains: [
      painPoint || `${kw}の何から始めればよいか分からない`,
      "情報が断片的で全体像がつかめない",
      "失敗・損をしたくない",
    ],
    alternatives: [
      "検索上位の競合記事を読み比べる",
      "SNS・口コミで体験談を探す",
      "知人や専門家に直接聞く",
    ],
    wants: [
      `${kw}の判断軸を提示してほしい`,
      "比較表で違いを一目で理解したい",
      "結論と次のアクションを明確にしてほしい",
    ],
  };
}

function buildGoal(keyword: string, purpose: string): Goal {
  const kw = keyword || "対象キーワード";
  return {
    understand: `${kw}の全体像・選び方・注意点を理解し、自分のケースで判断できるようになる`,
    action: `${kw}について読者が次に取るべき具体的な行動が明確になる`,
    cta:
      purpose === "問い合わせ"
        ? "無料相談・問い合わせへ誘導する"
        : purpose === "資料請求"
        ? "資料請求フォームへ誘導する"
        : purpose === "商品購入"
        ? "商品ページ・購入へ誘導する"
        : purpose === "予約"
        ? "予約ページへ誘導する"
        : "関連記事・比較表で次の行動へ誘導する",
  };
}

const emptyChecked = (): Record<string, boolean> =>
  GEO_CHECK_AREAS.reduce<Record<string, boolean>>((acc, a) => {
    acc[a] = false;
    return acc;
  }, {});

export default function WorkspacePage() {
  const db = useDB();
  const [jobId, setJobId] = useState("");

  // form inputs
  const [clientName, setClientName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [theme, setTheme] = useState("");
  const [targetReader, setTargetReader] = useState("");
  const [painPoint, setPainPoint] = useState("");
  const [purpose, setPurpose] = useState(PURPOSES[0]);
  const [charCount, setCharCount] = useState<number>(6000);
  const [existingUrl, setExistingUrl] = useState("");
  const [existingBody, setExistingBody] = useState("");
  const [competitorUrl1, setCompetitorUrl1] = useState("");
  const [competitorUrl2, setCompetitorUrl2] = useState("");
  const [competitorUrl3, setCompetitorUrl3] = useState("");
  const [clientConditions, setClientConditions] = useState("");
  const [tone, setTone] = useState(TONES[0]);
  const [aiPolicy, setAiPolicy] = useState<AiPolicy>("unknown");
  const [outputFormat, setOutputFormat] = useState(OUTPUT_FORMATS[0]);

  // output slices
  const [searchIntent, setSearchIntent] = useState<SearchIntent | null>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [outline, setOutline] = useState<OutlineNode[] | null>(null);
  const [titles, setTitles] = useState<TitleIdea[] | null>(null);
  const [metaDescriptions, setMetaDescriptions] = useState<MetaIdea[] | null>(null);
  const [faqs, setFaqs] = useState<FaqItem[] | null>(null);
  const [competitorAnalysis, setCompetitorAnalysis] =
    useState<CompetitorAnalysis | null>(null);
  const [geoSuggestions, setGeoSuggestions] = useState<GeoSuggestion[] | null>(null);
  const [report, setReport] = useState<string>("");
  const [saved, setSaved] = useState(false);

  // read ?job=id on mount
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("job");
    if (q) setJobId(q);
  }, []);

  const job = useMemo<Job | undefined>(
    () => (jobId ? getJob(jobId) : undefined),
    [jobId, db.jobs]
  );

  // prefill from job
  useEffect(() => {
    if (!job) return;
    setAiPolicy(job.aiPolicy);
    if (job.charCount) setCharCount(job.charCount);
  }, [job?.id]);

  const competitorUrls = useMemo(
    () => [competitorUrl1, competitorUrl2, competitorUrl3].filter(Boolean),
    [competitorUrl1, competitorUrl2, competitorUrl3]
  );

  const keywordMissing = !keyword.trim();

  const guard = (fn: () => void) => () => {
    if (keywordMissing) return;
    setSaved(false);
    fn();
  };

  const handleReport = guard(() => {
    setReport(
      formatForMarkdown({
        jobTitle: job?.title,
        clientName,
        keyword,
        purpose,
        outline: outline ?? undefined,
        titles: titles ?? undefined,
        metaDescriptions: metaDescriptions ?? undefined,
        faqs: faqs ?? undefined,
        geoSuggestions: geoSuggestions ?? undefined,
        competitorAnalysis: competitorAnalysis ?? undefined,
      })
    );
  });

  const handleSave = () => {
    actions.addDeliverable({
      id: `del_${Date.now()}`,
      jobId: jobId || "",
      type: outputFormat,
      clientName: clientName || undefined,
      keyword,
      theme: theme || undefined,
      targetReader,
      painPoint: painPoint || undefined,
      purpose,
      charCount,
      existingUrl: existingUrl || undefined,
      existingBody: existingBody || undefined,
      competitorUrls,
      tone,
      aiPolicy,
      outputFormat,
      searchIntent: searchIntent ?? undefined,
      persona: persona ?? undefined,
      goal: goal ?? undefined,
      outline: outline ?? undefined,
      titles: titles ?? undefined,
      metaDescriptions: metaDescriptions ?? undefined,
      faqs: faqs ?? undefined,
      competitorAnalysis: competitorAnalysis ?? undefined,
      geoSuggestions: geoSuggestions ?? undefined,
      report: report || undefined,
      createdAt: new Date().toISOString(),
    });
    setSaved(true);
  };

  return (
    <>
      <PageHeader
        title="SEO納品ワークスペース"
        desc="受注後の実際の納品物をここで作成します。検索意図・構成案・タイトル・FAQ・競合差分・GEO対応までまとめて1ドキュメントに整理。"
      />

      <Card title="案件と紐付け" desc="案件を選ぶと案件名・クライアント・カテゴリの参考になります（任意）">
        <JobPicker value={jobId} onChange={setJobId} placeholder="案件を選択（任意）…" />
        {job && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted">
            <span className="text-zinc-200">{job.title}</span>
            <Badge className="border-border bg-white/5 text-muted">
              {CATEGORY_LABEL[job.category]}
            </Badge>
          </div>
        )}
      </Card>

      {/* 納品インプット */}
      <div className="mt-6">
        <Card title="納品インプット" desc="キーワードは必須。埋めるほど精度の高い納品物になります。">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="クライアント名">
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="例：株式会社サンプル"
              />
            </Field>
            <Field label="対策キーワード（必須）">
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="例：ふるさと納税 やり方"
                className={keywordMissing ? "border-danger/50" : undefined}
              />
            </Field>
            <Field label="テーマ・切り口">
              <Input
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="例：初心者向けの始め方"
              />
            </Field>
            <Field label="ターゲット読者">
              <Input
                value={targetReader}
                onChange={(e) => setTargetReader(e.target.value)}
                placeholder="例：制度を初めて使う会社員"
              />
            </Field>
            <Field label="読者の悩み（ペインポイント）">
              <Input
                value={painPoint}
                onChange={(e) => setPainPoint(e.target.value)}
                placeholder="例：手続きが複雑そうで不安"
              />
            </Field>
            <Field label="記事の目的">
              <Select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                {PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="想定文字数">
              <Input
                type="number"
                value={charCount}
                onChange={(e) => setCharCount(Number(e.target.value) || 0)}
                placeholder="6000"
              />
            </Field>
            <Field label="既存記事URL（リライト時）">
              <Input
                value={existingUrl}
                onChange={(e) => setExistingUrl(e.target.value)}
                placeholder="https://…"
              />
            </Field>
            <Field label="トーン">
              <Select value={tone} onChange={(e) => setTone(e.target.value)}>
                {TONES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="AI表現モード">
              <Select
                value={aiPolicy}
                onChange={(e) => setAiPolicy(e.target.value as AiPolicy)}
              >
                {AI_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="出力フォーマット">
              <Select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value)}
              >
                {OUTPUT_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="競合URL 1">
              <Input
                value={competitorUrl1}
                onChange={(e) => setCompetitorUrl1(e.target.value)}
                placeholder="https://…"
              />
            </Field>
            <Field label="競合URL 2">
              <Input
                value={competitorUrl2}
                onChange={(e) => setCompetitorUrl2(e.target.value)}
                placeholder="https://…"
              />
            </Field>
            <Field label="競合URL 3">
              <Input
                value={competitorUrl3}
                onChange={(e) => setCompetitorUrl3(e.target.value)}
                placeholder="https://…"
              />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="既存記事の本文（リライト時）">
              <Textarea
                rows={4}
                value={existingBody}
                onChange={(e) => setExistingBody(e.target.value)}
                placeholder="リライト対象の本文を貼り付け"
              />
            </Field>
            <Field label="クライアント指定条件・レギュレーション">
              <Textarea
                rows={4}
                value={clientConditions}
                onChange={(e) => setClientConditions(e.target.value)}
                placeholder="例：見出しはh2まで／NGワード／参考トーン など"
              />
            </Field>
          </div>
        </Card>
      </div>

      {/* 生成ボタン */}
      <div className="mt-6">
        <Card title="納品物を生成" desc="各ボタンが対応セクションを作成します（キーワード必須）">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="subtle"
              disabled={keywordMissing}
              onClick={guard(() => setSearchIntent(buildSearchIntent(keyword, purpose)))}
            >
              検索意図を整理する
            </Button>
            <Button
              variant="subtle"
              disabled={keywordMissing}
              onClick={guard(() =>
                setPersona(buildPersona(keyword, targetReader, painPoint))
              )}
            >
              読者ペルソナを作る
            </Button>
            <Button
              variant="subtle"
              disabled={keywordMissing}
              onClick={guard(() => setGoal(buildGoal(keyword, purpose)))}
            >
              記事ゴールを設計する
            </Button>
            <Button
              variant="subtle"
              disabled={keywordMissing}
              onClick={guard(() =>
                setOutline(
                  generateSeoOutline({ keyword, theme, targetReader, charCount })
                )
              )}
            >
              SEO構成案を作る
            </Button>
            <Button
              variant="subtle"
              disabled={keywordMissing}
              onClick={guard(() => setTitles(generateTitles(keyword)))}
            >
              タイトル案を作る
            </Button>
            <Button
              variant="subtle"
              disabled={keywordMissing}
              onClick={guard(() =>
                setMetaDescriptions(generateMetaDescriptions(keyword))
              )}
            >
              メタディスクリプションを作る
            </Button>
            <Button
              variant="subtle"
              disabled={keywordMissing}
              onClick={guard(() => setFaqs(generateFaqs(keyword)))}
            >
              FAQを作る
            </Button>
            <Button
              variant="subtle"
              disabled={keywordMissing}
              onClick={guard(() =>
                setCompetitorAnalysis(
                  analyzeCompetitors({ keyword, competitorUrls })
                )
              )}
            >
              競合差分を出す
            </Button>
            <Button
              variant="subtle"
              disabled={keywordMissing}
              onClick={guard(() =>
                setGeoSuggestions(generateGeoSuggestions(emptyChecked()))
              )}
            >
              GEO対応ポイントを追加する
            </Button>
            <Button disabled={keywordMissing} onClick={handleReport}>
              納品レポートを出力する
            </Button>
          </div>
          {keywordMissing && (
            <p className="mt-3 text-[11px] text-danger">
              対策キーワードを入力すると生成できます。
            </p>
          )}
        </Card>
      </div>

      {/* ===== ドキュメント ===== */}
      <div className="mt-6 space-y-6">
        {/* 検索意図 */}
        {searchIntent && (
          <Card title="検索意図の整理">
            <div className="grid gap-4 sm:grid-cols-2">
              <IntentList label="顕在ニーズ" items={searchIntent.explicit} />
              <IntentList label="潜在ニーズ" items={searchIntent.latent} />
            </div>
            <div className="mt-4 space-y-3">
              <KV label="本当に知りたいこと" value={searchIntent.reallyWant} />
              <KV label="不安" value={searchIntent.anxiety} />
              <KV label="最終的に取りたい行動" value={searchIntent.finalAction} />
            </div>
          </Card>
        )}

        {/* ペルソナ */}
        {persona && (
          <Card title="読者ペルソナ">
            <div className="grid gap-4 sm:grid-cols-2">
              <KV label="年代" value={persona.age} />
              <KV label="状況" value={persona.situation} />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <IntentList label="悩み" items={persona.pains} />
              <IntentList label="代替手段" items={persona.alternatives} />
              <IntentList label="求めていること" items={persona.wants} />
            </div>
          </Card>
        )}

        {/* ゴール */}
        {goal && (
          <Card title="記事ゴール設計">
            <div className="space-y-3">
              <KV label="理解してほしいこと" value={goal.understand} />
              <KV label="起こしてほしい変化" value={goal.action} />
              <div className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-3">
                <p className="text-[11px] font-medium text-accent">CTA</p>
                <p className="mt-1 text-[13px] text-zinc-100">{goal.cta}</p>
              </div>
            </div>
          </Card>
        )}

        {/* 構成案 */}
        {outline && (
          <Card title="SEO構成案" desc="見出しレベル・役割・想定文字数まで設計">
            <div className="space-y-2">
              {outline.map((n, i) => {
                const indent =
                  n.level === "h1" ? "" : n.level === "h2" ? "ml-4" : "ml-10";
                return (
                  <div
                    key={i}
                    className={`${indent} rounded-lg border border-border bg-bg/40 px-4 py-3`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        className={
                          n.level === "h1"
                            ? "border-accent/40 bg-accent/10 text-accent"
                            : n.level === "h2"
                            ? "border-accent2/40 bg-accent2/10 text-accent2"
                            : "border-border bg-white/5 text-muted"
                        }
                      >
                        {n.level.toUpperCase()}
                      </Badge>
                      <span className="text-[13px] font-medium text-zinc-100">
                        {n.text}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-accent2">役割：{n.role}</p>
                    <p className="mt-0.5 text-[12px] text-muted">{n.content}</p>
                    {n.charBudget > 0 && (
                      <p className="mt-1 text-[11px] text-muted">
                        想定文字数：約{n.charBudget}字
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* タイトル */}
        {titles && (
          <Card title="タイトル案">
            <div className="space-y-4">
              {Array.from(new Set(titles.map((t) => t.kind))).map((kind) => (
                <div key={kind}>
                  <SectionTitle>{kind}</SectionTitle>
                  <div className="space-y-2">
                    {titles
                      .filter((t) => t.kind === kind)
                      .map((t, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg/40 px-4 py-2.5"
                        >
                          <span className="text-[13px] text-zinc-100">{t.text}</span>
                          <CopyButton text={t.text} />
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* メタ */}
        {metaDescriptions && (
          <Card title="メタディスクリプション案">
            <div className="grid gap-4 sm:grid-cols-3">
              {metaDescriptions.map((m, i) => (
                <div
                  key={i}
                  className="flex flex-col rounded-lg border border-border bg-bg/40 px-4 py-3"
                >
                  <Badge className="mb-2 w-fit border-accent2/40 bg-accent2/10 text-accent2">
                    {m.kind}
                  </Badge>
                  <p className="flex-1 text-[12px] leading-relaxed text-zinc-200">
                    {m.text}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-muted">{m.text.length}字</span>
                    <CopyButton text={m.text} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* FAQ */}
        {faqs && (
          <Card title="FAQ案" desc="✨ はGEO/AI検索に拾われやすい短文回答">
            <div className="space-y-3">
              {faqs.map((f, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-bg/40 px-4 py-3"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-[13px] font-medium text-zinc-100">
                      Q. {f.q}
                    </span>
                    {f.geoFriendly && (
                      <Badge className="border-accent/40 bg-accent/10 text-accent">
                        ✨ GEO
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                    A. {f.a}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 競合差分 */}
        {competitorAnalysis && (
          <Card title="競合との差分" desc="共通見出し・不足トピック・独自切り口・追加すべきセクション">
            <div className="grid gap-4 sm:grid-cols-2">
              <IntentList
                label="共通見出し"
                items={competitorAnalysis.commonHeadings}
              />
              <IntentList
                label="不足トピック"
                items={competitorAnalysis.missingTopics}
              />
              <IntentList
                label="独自の切り口"
                items={competitorAnalysis.uniqueAngles}
              />
              <IntentList label="FAQギャップ" items={competitorAnalysis.faqGaps} />
            </div>

            <div className="mt-4">
              <p className="mb-2 text-[11px] font-medium text-zinc-300">
                追加すべきセクション
              </p>
              <div className="space-y-2">
                {competitorAnalysis.suggestedSections.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-bg/40 px-4 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <Badge className={priorityTone(s.priority)}>
                        優先度 {s.priority}
                      </Badge>
                      <span className="text-[13px] font-medium text-zinc-100">
                        {s.title}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-muted">{s.why}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-[11px] font-medium text-zinc-300">
                  比較表の項目案
                </p>
                <div className="flex flex-wrap gap-2">
                  {competitorAnalysis.comparisonTable.map((c) => (
                    <Badge key={c} className="border-border bg-white/5 text-muted">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
              <IntentList
                label="E-E-A-T補強ポイント"
                items={competitorAnalysis.eeatPoints}
              />
            </div>
          </Card>
        )}

        {/* GEO */}
        {geoSuggestions && (
          <Card title="GEO/AI検索 対応ポイント">
            <div className="space-y-2">
              {geoSuggestions.map((g, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg border border-border bg-bg/40 px-4 py-2.5"
                >
                  <Badge
                    className={
                      g.present
                        ? "border-good/40 bg-good/10 text-good"
                        : "border-warn/40 bg-warn/10 text-warn"
                    }
                  >
                    {g.present ? "✓ 対応済" : "要対応"}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-[13px] text-zinc-100">{g.area}</p>
                    <p className="mt-0.5 text-[12px] text-muted">{g.suggestion}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* レポート */}
        {report && (
          <Card
            title="納品レポート"
            desc="そのままコピーして納品物に使えます"
            right={<CopyButton text={report} />}
          >
            <pre className="prose-report whitespace-pre-wrap rounded-lg border border-border bg-bg/40 p-4 text-[12px] leading-relaxed text-zinc-200">
              {report}
            </pre>
          </Card>
        )}
      </div>

      {/* 保存 */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button disabled={keywordMissing} onClick={handleSave}>
          この納品物を保存
        </Button>
        {saved && (
          <span className="text-[13px] text-good">✓ 納品物を保存しました</span>
        )}
        {keywordMissing && (
          <span className="text-[11px] text-muted">
            保存には対策キーワードが必要です。
          </span>
        )}
      </div>
    </>
  );
}

function IntentList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium text-zinc-300">{label}</p>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-[12px] leading-relaxed text-muted">
            ・{it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-zinc-300">{label}</p>
      <p className="mt-0.5 text-[13px] leading-relaxed text-zinc-100">{value}</p>
    </div>
  );
}
