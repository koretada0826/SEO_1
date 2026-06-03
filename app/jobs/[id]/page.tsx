"use client";
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useDB, actions } from "@/lib/store";
import {
  Card,
  Button,
  Badge,
  Field,
  Input,
  Textarea,
  Select,
  ScoreBar,
  ScoreRing,
  StatCard,
  EmptyState,
  PageHeader,
  SectionTitle,
  CopyButton,
  cn,
} from "@/components/ui";
import {
  STATUS_LABEL,
  STATUS_ORDER,
  statusColor,
  PLATFORM_LABEL,
  CATEGORY_LABEL,
  BUDGET_TYPE_LABEL,
  LABEL_TEXT,
  labelColor,
  scoreTone,
  riskTone,
  yen,
} from "@/lib/labels";
import {
  analyzeJob,
  generateProposal,
  generateSeoOutline,
  generateTitles,
  generateMetaDescriptions,
  generateFaqs,
  analyzeCompetitors,
  diagnoseRewrite,
  generateGeoSuggestions,
  geoScore,
  GEO_CHECK_AREAS,
  PROPOSAL_TYPES,
  formatForMarkdown,
  formatForGoogleDocs,
  formatForPdf,
  formatForSheets,
} from "@/lib/mockAI";
import { scoreJobRule } from "@/lib/scoring";
import {
  exportReportToGoogleDocs,
  exportReportToPDF,
  type GasResult,
} from "@/lib/google";
import type {
  Job,
  Scores,
  AiPolicy,
  Proposal,
  Deliverable,
  OutlineNode,
  TitleIdea,
  MetaIdea,
  FaqItem,
  GeoSuggestion,
  CompetitorAnalysis,
  RewriteDiagnosis,
  JobStatus,
} from "@/lib/types";

// ─────────────────────────────────────────────────────────────
const TABS = [
  "概要",
  "解析",
  "提案",
  "納品",
  "競合",
  "リライト",
  "GEO",
  "レポート",
] as const;
type Tab = (typeof TABS)[number];

const SCORE_ROWS: { key: keyof Scores; label: string; kind: "score" | "risk" | "neutral" }[] = [
  { key: "priority", label: "応募優先度", kind: "score" },
  { key: "profitability", label: "収益性", kind: "score" },
  { key: "portfolioValue", label: "実績化価値", kind: "score" },
  { key: "toolFit", label: "自作ツール適性", kind: "score" },
  { key: "continuity", label: "継続可能性", kind: "score" },
  { key: "difficulty", label: "作業難易度", kind: "neutral" },
  { key: "risk", label: "地雷度", kind: "risk" },
  { key: "geoReadiness", label: "GEO提案余地", kind: "score" },
];

const TONES = ["丁寧", "カジュアル", "簡潔", "専門的"];
const AI_MODES: { value: AiPolicy; label: string }[] = [
  { value: "allowed", label: "使用可" },
  { value: "forbidden", label: "使用不可" },
  { value: "unknown", label: "不明" },
];
const BULK_PROPOSAL_TYPES = [
  "丁寧め提案文",
  "自作ツールアピール型",
  "実績不足カバー型",
  "AI使用不可案件向け",
];
const PURPOSES = ["SEO流入", "問い合わせ", "資料請求", "商品購入", "予約", "認知獲得"];
const WS_TONES = ["専門的", "やさしい", "初心者向け", "比較検討向け", "セールス寄り"];
const OUTPUT_FORMATS = ["Google Docs", "Markdown", "PDF", "スプレッドシート", "WordPress入稿用"];
const REWRITE_GOALS = ["順位改善", "CV改善", "滞在時間改善", "古い情報の更新", "AIっぽさの除去"];
const REPORT_FORMATS = ["Markdown", "Google Docs用", "PDF用", "Google Sheets用", "WordPress入稿用"];

const priorityTone = (p: "A" | "B" | "C") =>
  p === "A"
    ? "border-danger/40 bg-danger/10 text-danger"
    : p === "B"
    ? "border-warn/40 bg-warn/10 text-warn"
    : "border-border bg-white/5 text-muted";

// ─────────────────────────────────────────────────────────────
export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const db = useDB();
  const job = db.jobs.find((j) => j.id === id);
  const [activeTab, setActiveTab] = useState<Tab>("概要");

  if (!job) {
    return (
      <EmptyState
        title="案件が見つかりません"
        desc="削除されたか、URLが正しくない可能性があります。"
        action={
          <Link href="/jobs">
            <Button>案件一覧へ戻る</Button>
          </Link>
        }
      />
    );
  }

  return (
    <>
      <div className="mb-3">
        <Link href="/jobs" className="text-xs text-accent hover:underline">
          ← 案件一覧
        </Link>
      </div>
      <PageHeader
        title={job.title.length > 60 ? job.title.slice(0, 60) + "…" : job.title}
        desc={`${PLATFORM_LABEL[job.platform]}・${CATEGORY_LABEL[job.category]}`}
        right={
          <div className="flex items-center gap-2">
            <Badge className={statusColor(job.status)}>{STATUS_LABEL[job.status]}</Badge>
            <Select
              value={job.status}
              onChange={(e) => actions.setStatus(job.id, e.target.value as JobStatus)}
              className={cn("min-w-[8rem] px-2 py-1.5 text-xs", statusColor(job.status))}
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s} className="bg-card text-zinc-100">
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {/* タブバー */}
      <div className="mb-6 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition",
              activeTab === t
                ? "border-accent text-zinc-50"
                : "border-transparent text-muted hover:text-zinc-200"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {activeTab === "概要" && <OverviewTab key={job.id + "ov"} job={job} />}
      {activeTab === "解析" && <AnalyzeTab job={job} />}
      {activeTab === "提案" && <ProposalTab job={job} db={db} />}
      {activeTab === "納品" && <DeliverableTab job={job} db={db} />}
      {activeTab === "競合" && <CompetitorTab job={job} db={db} />}
      {activeTab === "リライト" && <RewriteTab job={job} db={db} />}
      {activeTab === "GEO" && <GeoTab />}
      {activeTab === "レポート" && <ReportTab job={job} db={db} />}
    </>
  );
}

// ─────────── 共有の小コンポーネント ───────────
function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-bg/40 px-3 py-2">
      <p className="text-[10px] text-muted">{label}</p>
      <div className="mt-0.5 text-[13px] text-zinc-200">{children}</div>
    </div>
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

function ListCard({ title, desc, items }: { title: string; desc?: string; items: string[] }) {
  return (
    <Card title={title} desc={desc}>
      <ul className="space-y-1.5">
        {items.map((x, i) => (
          <li key={i} className="flex items-start gap-2 text-[13px] text-zinc-200">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
            <span>{x}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function FixCard({ title, text }: { title: string; text: string }) {
  return (
    <Card title={title}>
      <p className="rounded-lg border border-border bg-bg/40 px-3 py-2.5 text-[13px] leading-relaxed text-zinc-100">
        {text}
      </p>
    </Card>
  );
}

function AiPolicyBanner({ policy }: { policy: AiPolicy }) {
  if (policy !== "forbidden") return null;
  return (
    <div className="rounded-xl border border-danger/40 bg-danger/10 px-5 py-4 text-sm text-danger">
      <p className="font-semibold">AI使用不可案件</p>
      <p className="mt-1 text-[13px] leading-relaxed">
        『AIで作る』とは書かず、独自チェックリスト／競合分析テンプレ／手作業での整理を前面に出しましょう。
      </p>
    </div>
  );
}

// ════════════════════════ 概要 ════════════════════════
function OverviewTab({ job }: { job: Job }) {
  const db = useDB();
  const proposalCount = db.proposals.filter((p) => p.jobId === job.id).length;
  const deliverableCount = db.deliverables.filter((d) => d.jobId === job.id).length;

  return (
    <div className="space-y-6">
      <Card title="案件情報">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Info label="媒体">{PLATFORM_LABEL[job.platform]}</Info>
          <Info label="カテゴリ">{CATEGORY_LABEL[job.category]}</Info>
          <Info label="予算">
            {yen(job.budget)}（{BUDGET_TYPE_LABEL[job.budgetType]}）
          </Info>
          <Info label="納期">{job.deadline || "—"}</Info>
          <Info label="AI可否">
            {job.aiPolicy === "allowed"
              ? "使用可"
              : job.aiPolicy === "forbidden"
              ? "使用不可"
              : "不明"}
          </Info>
          <Info label="実績公開">
            {job.portfolioPermission === "allowed"
              ? "可"
              : job.portfolioPermission === "forbidden"
              ? "不可"
              : "不明"}
          </Info>
          <Info label="継続">
            {job.continuity === "yes" ? "あり" : job.continuity === "no" ? "なし" : "不明"}
          </Info>
          <Info label="クライアント評価">
            {job.clientRating != null ? `★${job.clientRating}` : "—"}
          </Info>
          <Info label="クライアント実績">
            {job.clientOrderCount != null ? `${job.clientOrderCount}件` : "—"}
          </Info>
          <Info label="応募人数">
            {job.applicantCount != null ? `${job.applicantCount}人` : "—"}
          </Info>
          <Info label="募集人数">
            {job.recruitCount != null ? `${job.recruitCount}人` : "—"}
          </Info>
          <Info label="提案文 / 納品物">
            {proposalCount} 件 / {deliverableCount} 件
          </Info>
        </div>
        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block break-all text-xs text-accent hover:underline"
          >
            募集ページを開く ↗ {job.url}
          </a>
        )}
        {job.description && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-medium text-zinc-300">募集本文</p>
            <p className="max-h-44 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-bg/60 p-3 text-xs text-muted">
              {job.description}
            </p>
          </div>
        )}
      </Card>

      <Card title="案件スコア" desc="8軸でのルールベース評価">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          {SCORE_ROWS.map((r) => {
            const v = job.scores[r.key];
            const tone =
              r.kind === "risk" ? riskTone(v) : r.kind === "neutral" ? "neutral" : scoreTone(v);
            return (
              <div key={r.key}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-300">{r.label}</span>
                  <span className="text-[11px] tabular-nums text-muted">{v}</span>
                </div>
                <ScoreBar value={v} tone={tone} />
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="メモ・次のアクション">
          <Field label="メモ">
            <Textarea
              defaultValue={job.notes}
              rows={4}
              placeholder="このクライアント・案件に関するメモ"
              onBlur={(e) => actions.updateJob(job.id, { notes: e.target.value })}
            />
          </Field>
          <div className="mt-4">
            <Field label="次のアクション">
              <Input
                defaultValue={job.nextAction ?? ""}
                placeholder="例：提案文を送る / 条件交渉する"
                onBlur={(e) => actions.updateJob(job.id, { nextAction: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="想定売上（円）">
              <Input
                type="number"
                defaultValue={job.expectedRevenue ?? 0}
                onBlur={(e) =>
                  actions.updateJob(job.id, { expectedRevenue: Number(e.target.value) || 0 })
                }
              />
            </Field>
            <Field label="実売上（円）">
              <Input
                type="number"
                defaultValue={job.actualRevenue ?? 0}
                onBlur={(e) =>
                  actions.updateJob(job.id, { actualRevenue: Number(e.target.value) || 0 })
                }
              />
            </Field>
          </div>
        </Card>

        <Card title="ステータス変更">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_ORDER.map((s) => (
              <Button
                key={s}
                variant={job.status === s ? "primary" : "outline"}
                className="px-2.5 py-1 text-[11px]"
                onClick={() => actions.setStatus(job.id, s)}
              >
                {STATUS_LABEL[s]}
              </Button>
            ))}
          </div>
          <div className="mt-6 border-t border-border pt-4">
            <Button
              variant="danger"
              onClick={() => {
                if (
                  window.confirm(
                    `「${job.title}」を削除します。関連する提案文・納品物も削除されます。よろしいですか？`
                  )
                ) {
                  actions.removeJob(job.id);
                  window.location.href = "/jobs";
                }
              }}
            >
              この案件を削除
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ════════════════════════ 解析 ════════════════════════
function AnalyzeTab({ job }: { job: Job }) {
  const analysis = job.analysis;

  function handleAnalyze() {
    const a = analyzeJob(job);
    const s = scoreJobRule(job);
    actions.updateJob(job.id, { analysis: a, scores: s });
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleAnalyze}>この案件を解析する</Button>
          {analysis && (
            <span className="text-xs text-muted">
              解析日時：{new Date(analysis.analyzedAt).toLocaleString("ja-JP")}
            </span>
          )}
        </div>
      </Card>

      {!analysis ? (
        <EmptyState
          title="まだ解析していません"
          desc="「この案件を解析する」を押すと、総合判定・スコア・応募/回避理由・作業時間見積もりを表示します。"
        />
      ) : (
        <>
          <Card title="総合判定">
            <div className="flex flex-wrap items-center gap-4">
              <Badge className={cn(labelColor(analysis.label), "px-3 py-1 text-sm")}>
                {LABEL_TEXT[analysis.label]}
              </Badge>
              <span className="text-xs text-muted">
                検出タイプ：
                <span className="text-zinc-200">{CATEGORY_LABEL[analysis.detectedType]}</span>
              </span>
            </div>
          </Card>

          <Card title="必要な納品物">
            <div className="flex flex-wrap gap-1.5">
              {analysis.deliverables.map((d, i) => (
                <Badge key={i} className="border-accent/40 bg-accent/10 text-accent">
                  {d}
                </Badge>
              ))}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="応募すべき理由">
              <ReasonList items={analysis.reasonsApply} tone="good" />
            </Card>
            <Card title="避けるべき理由">
              <ReasonList items={analysis.reasonsAvoid} tone="danger" />
            </Card>
            <Card title="注意点">
              <ReasonList items={analysis.cautions} tone="warn" />
            </Card>
            <Card title="提案文で強調すべき点">
              <ReasonList items={analysis.proposalEmphasis} tone="accent" />
            </Card>
          </div>

          <Card title="作業時間見積もり">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard label="最短" value={`${analysis.time.minHours}h`} tone="accent" />
              <StatCard label="標準" value={`${analysis.time.normalHours}h`} tone="accent" />
              <StatCard
                label="修正込み"
                value={`${analysis.time.withRevisionHours}h`}
                tone="warn"
              />
              <StatCard
                label="時給換算"
                value={yen(analysis.time.hourlyRate)}
                sub="修正込み工数で算出"
                tone={
                  analysis.time.hourlyRate >= 3000
                    ? "good"
                    : analysis.time.hourlyRate > 0
                    ? "warn"
                    : "danger"
                }
              />
              <StatCard
                label="ツール削減"
                value={`約${analysis.time.toolSavedHours}h`}
                tone="good"
              />
            </div>
          </Card>

          <Card title="AI使用可否">
            {job.aiPolicy === "forbidden" && (
              <div className="mb-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-[13px] text-danger">
                この案件ではAI使用をアピールしない（独自チェックリスト／手作業整理を前面に）
              </div>
            )}
            <div className="rounded-lg border border-accent2/30 bg-accent2/10 px-3 py-2.5 text-[13px] leading-relaxed text-zinc-200">
              {analysis.aiPolicyNote}
            </div>
          </Card>

          <Card title="地雷ワード">
            {analysis.riskHits.length === 0 ? (
              <p className="text-xs text-muted">地雷ワードは検出されませんでした。</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {analysis.riskHits.map((h) => (
                  <Badge
                    key={h.word}
                    title={h.reason}
                    className={cn(
                      h.severity === "high"
                        ? "border-danger/50 bg-danger/15 text-danger"
                        : h.severity === "medium"
                        ? "border-warn/50 bg-warn/15 text-warn"
                        : "border-border bg-white/5 text-muted"
                    )}
                  >
                    {h.word}
                  </Badge>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function ReasonList({
  items,
  tone,
}: {
  items: string[];
  tone: "good" | "danger" | "warn" | "accent";
}) {
  const dot =
    tone === "good"
      ? "bg-good"
      : tone === "danger"
      ? "bg-danger"
      : tone === "warn"
      ? "bg-warn"
      : "bg-accent";
  if (!items.length) return <p className="text-xs text-muted">該当する項目はありません。</p>;
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-zinc-200">
          <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

// ════════════════════════ 提案 ════════════════════════
function ProposalTab({ job, db }: { job: Job; db: ReturnType<typeof useDB> }) {
  const [type, setType] = useState<string>(PROPOSAL_TYPES[1]);
  const [tone, setTone] = useState<string>(TONES[0]);
  const [aiMode, setAiMode] = useState<AiPolicy>(job.aiPolicy);
  const [result, setResult] = useState<Proposal | null>(null);

  const saved = useMemo(
    () =>
      db.proposals
        .filter((p) => p.jobId === job.id)
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.proposals, job.id]
  );

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString("ja-JP", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-6">
      <AiPolicyBanner policy={job.aiPolicy} />

      <Card title="提案文の設定">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="提案文タイプ">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {PROPOSAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
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
            <Select value={aiMode} onChange={(e) => setAiMode(e.target.value as AiPolicy)}>
              {AI_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={() =>
              setResult(generateProposal({ job, type, tone, aiPolicyMode: aiMode }))
            }
          >
            提案文を作る
          </Button>
          <Button
            variant="subtle"
            onClick={() => {
              for (const t of BULK_PROPOSAL_TYPES) {
                actions.addProposal(generateProposal({ job, type: t, tone, aiPolicyMode: aiMode }));
              }
            }}
          >
            主要タイプを一括生成
          </Button>
        </div>
      </Card>

      {result && (
        <Card
          title="生成された提案文"
          desc={`${result.type} / ${result.tone} / ${result.content.length}字`}
          right={
            <div className="flex items-center gap-2">
              <CopyButton text={result.content} />
              <Button onClick={() => actions.addProposal(result)}>この提案文を保存</Button>
            </div>
          }
        >
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-200">
            {result.content}
          </p>
        </Card>
      )}

      <div>
        <SectionTitle sub="新しい順">保存済みの提案文</SectionTitle>
        {saved.length ? (
          <div className="space-y-3">
            {saved.map((p) => (
              <Card key={p.id} right={<CopyButton text={p.content} />}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge className="border-accent/40 bg-accent/10 text-accent">{p.type}</Badge>
                  <Badge className="border-border bg-white/5 text-muted">{p.tone}</Badge>
                  <span className="text-[11px] text-muted">{fmtDate(p.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-zinc-300">
                  {p.content}
                </p>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="保存済みの提案文はありません"
            desc="上で提案文を作成し『この提案文を保存』を押すとここに表示されます。"
          />
        )}
      </div>
    </div>
  );
}

// ════════════════════════ 納品 ════════════════════════
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
      targetReader || `${kw}に初めて本格的に取り組もうとしていて、情報を集めて比較検討している段階`,
    pains: [
      painPoint || `${kw}の何から始めればよいか分からない`,
      "情報が断片的で全体像がつかめない",
      "失敗・損をしたくない",
    ],
    alternatives: ["検索上位の競合記事を読み比べる", "SNS・口コミで体験談を探す", "知人や専門家に直接聞く"],
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

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-zinc-300">{label}</p>
      <p className="mt-0.5 text-[13px] leading-relaxed text-zinc-100">{value}</p>
    </div>
  );
}

function DeliverableTab({ job, db }: { job: Job; db: ReturnType<typeof useDB> }) {
  const [clientName, setClientName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [theme, setTheme] = useState("");
  const [targetReader, setTargetReader] = useState("");
  const [painPoint, setPainPoint] = useState("");
  const [purpose, setPurpose] = useState(PURPOSES[0]);
  const [charCount, setCharCount] = useState<number>(job.charCount && job.charCount > 0 ? job.charCount : 6000);
  const [existingUrl, setExistingUrl] = useState("");
  const [existingBody, setExistingBody] = useState("");
  const [competitorUrl1, setCompetitorUrl1] = useState("");
  const [competitorUrl2, setCompetitorUrl2] = useState("");
  const [competitorUrl3, setCompetitorUrl3] = useState("");
  const [tone, setTone] = useState(WS_TONES[0]);
  const [aiPolicy, setAiPolicy] = useState<AiPolicy>(job.aiPolicy);
  const [outputFormat, setOutputFormat] = useState(OUTPUT_FORMATS[0]);

  const [searchIntent, setSearchIntent] = useState<SearchIntent | null>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [outline, setOutline] = useState<OutlineNode[] | null>(null);
  const [titles, setTitles] = useState<TitleIdea[] | null>(null);
  const [metaDescriptions, setMetaDescriptions] = useState<MetaIdea[] | null>(null);
  const [faqs, setFaqs] = useState<FaqItem[] | null>(null);
  const [report, setReport] = useState<string>("");
  const [saved, setSaved] = useState(false);

  const competitorUrls = useMemo(
    () => [competitorUrl1, competitorUrl2, competitorUrl3].filter(Boolean),
    [competitorUrl1, competitorUrl2, competitorUrl3]
  );
  const keywordMissing = !keyword.trim();
  const savedCount = db.deliverables.filter((d) => d.jobId === job.id).length;

  const guard = (fn: () => void) => () => {
    if (keywordMissing) return;
    setSaved(false);
    fn();
  };

  function handleSave() {
    const d: Deliverable = {
      id: `del_${Date.now()}`,
      jobId: job.id,
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
      report: report || undefined,
      createdAt: new Date().toISOString(),
    };
    actions.addDeliverable(d);
    setSaved(true);
  }

  return (
    <div className="space-y-6">
      <Card title="納品インプット" desc="対策キーワードは必須。埋めるほど精度の高い納品物になります。">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="クライアント名">
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="例：株式会社サンプル" />
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
            <Input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="例：初心者向けの始め方" />
          </Field>
          <Field label="ターゲット読者">
            <Input value={targetReader} onChange={(e) => setTargetReader(e.target.value)} placeholder="例：制度を初めて使う会社員" />
          </Field>
          <Field label="読者の悩み（ペインポイント）">
            <Input value={painPoint} onChange={(e) => setPainPoint(e.target.value)} placeholder="例：手続きが複雑そうで不安" />
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
            <Input value={existingUrl} onChange={(e) => setExistingUrl(e.target.value)} placeholder="https://…" />
          </Field>
          <Field label="トーン">
            <Select value={tone} onChange={(e) => setTone(e.target.value)}>
              {WS_TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="AI表現モード">
            <Select value={aiPolicy} onChange={(e) => setAiPolicy(e.target.value as AiPolicy)}>
              {AI_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="出力フォーマット">
            <Select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)}>
              {OUTPUT_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="競合URL 1">
            <Input value={competitorUrl1} onChange={(e) => setCompetitorUrl1(e.target.value)} placeholder="https://…" />
          </Field>
          <Field label="競合URL 2">
            <Input value={competitorUrl2} onChange={(e) => setCompetitorUrl2(e.target.value)} placeholder="https://…" />
          </Field>
          <Field label="競合URL 3">
            <Input value={competitorUrl3} onChange={(e) => setCompetitorUrl3(e.target.value)} placeholder="https://…" />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="既存記事の本文（リライト時）">
            <Textarea
              rows={4}
              value={existingBody}
              onChange={(e) => setExistingBody(e.target.value)}
              placeholder="リライト対象の本文を貼り付け"
            />
          </Field>
        </div>
      </Card>

      <Card title="納品物を生成" desc="各ボタンが対応セクションを作成します（キーワード必須）">
        <div className="flex flex-wrap gap-2">
          <Button variant="subtle" disabled={keywordMissing} onClick={guard(() => setSearchIntent(buildSearchIntent(keyword, purpose)))}>
            検索意図を整理する
          </Button>
          <Button variant="subtle" disabled={keywordMissing} onClick={guard(() => setPersona(buildPersona(keyword, targetReader, painPoint)))}>
            読者ペルソナを作る
          </Button>
          <Button variant="subtle" disabled={keywordMissing} onClick={guard(() => setGoal(buildGoal(keyword, purpose)))}>
            記事ゴールを設計する
          </Button>
          <Button variant="subtle" disabled={keywordMissing} onClick={guard(() => setOutline(generateSeoOutline({ keyword, theme, targetReader, charCount })))}>
            SEO構成案を作る
          </Button>
          <Button variant="subtle" disabled={keywordMissing} onClick={guard(() => setTitles(generateTitles(keyword)))}>
            タイトル案を作る
          </Button>
          <Button variant="subtle" disabled={keywordMissing} onClick={guard(() => setMetaDescriptions(generateMetaDescriptions(keyword)))}>
            メタディスクリプションを作る
          </Button>
          <Button variant="subtle" disabled={keywordMissing} onClick={guard(() => setFaqs(generateFaqs(keyword)))}>
            FAQを作る
          </Button>
          <Button
            disabled={keywordMissing}
            onClick={guard(() =>
              setReport(
                formatForMarkdown({
                  jobTitle: job.title,
                  clientName,
                  keyword,
                  purpose,
                  outline: outline ?? undefined,
                  titles: titles ?? undefined,
                  metaDescriptions: metaDescriptions ?? undefined,
                  faqs: faqs ?? undefined,
                })
              )
            )}
          >
            納品レポートを出力する
          </Button>
        </div>
        {keywordMissing && (
          <p className="mt-3 text-[11px] text-danger">対策キーワードを入力すると生成できます。</p>
        )}
      </Card>

      <div className="space-y-6">
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

        {outline && (
          <Card title="SEO構成案" desc="見出しレベル・役割・想定文字数まで設計">
            <div className="space-y-2">
              {outline.map((n, i) => {
                const indent = n.level === "h1" ? "" : n.level === "h2" ? "ml-4" : "ml-10";
                return (
                  <div key={i} className={`${indent} rounded-lg border border-border bg-bg/40 px-4 py-3`}>
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
                      <span className="text-[13px] font-medium text-zinc-100">{n.text}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-accent2">役割：{n.role}</p>
                    <p className="mt-0.5 text-[12px] text-muted">{n.content}</p>
                    {n.charBudget > 0 && (
                      <p className="mt-1 text-[11px] text-muted">想定文字数：約{n.charBudget}字</p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

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

        {metaDescriptions && (
          <Card title="メタディスクリプション案">
            <div className="grid gap-4 sm:grid-cols-3">
              {metaDescriptions.map((m, i) => (
                <div key={i} className="flex flex-col rounded-lg border border-border bg-bg/40 px-4 py-3">
                  <Badge className="mb-2 w-fit border-accent2/40 bg-accent2/10 text-accent2">{m.kind}</Badge>
                  <p className="flex-1 text-[12px] leading-relaxed text-zinc-200">{m.text}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-muted">{m.text.length}字</span>
                    <CopyButton text={m.text} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {faqs && (
          <Card title="FAQ案" desc="✨ はGEO/AI検索に拾われやすい短文回答">
            <div className="space-y-3">
              {faqs.map((f, i) => (
                <div key={i} className="rounded-lg border border-border bg-bg/40 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <span className="text-[13px] font-medium text-zinc-100">Q. {f.q}</span>
                    {f.geoFriendly && (
                      <Badge className="border-accent/40 bg-accent/10 text-accent">✨ GEO</Badge>
                    )}
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-muted">A. {f.a}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {report && (
          <Card title="納品レポート" desc="そのままコピーして納品物に使えます" right={<CopyButton text={report} />}>
            <pre className="prose-report whitespace-pre-wrap rounded-lg border border-border bg-bg/40 p-4 text-[12px] leading-relaxed text-zinc-200">
              {report}
            </pre>
          </Card>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={keywordMissing} onClick={handleSave}>
          この納品物を保存
        </Button>
        {saved && <span className="text-[13px] text-good">✓ 納品物を保存しました</span>}
        <span className="text-[11px] text-muted">この案件の保存済み納品物：{savedCount}件</span>
      </div>
    </div>
  );
}

// ════════════════════════ 競合 ════════════════════════
function buildCompetitorSummary(kw: string, a: CompetitorAnalysis): string {
  const L: string[] = [];
  L.push(`【競合分析サマリー】対象キーワード: ${kw || "（未入力）"}`);
  if (a.competitorUrls.length) L.push(`競合URL: ${a.competitorUrls.join(" / ")}`);
  L.push("");
  L.push(`■ 競合共通見出し\n- ${a.commonHeadings.join("\n- ")}`);
  L.push("");
  L.push(`■ 比較テーブルにすべき項目\n- ${a.comparisonTable.join("\n- ")}`);
  L.push("");
  L.push(`■ 自社に不足している情報\n- ${a.missingTopics.join("\n- ")}`);
  L.push("");
  L.push(`■ 自社が勝てる独自切り口\n- ${a.uniqueAngles.join("\n- ")}`);
  L.push("");
  L.push(`■ FAQ差分\n- ${a.faqGaps.join("\n- ")}`);
  L.push("");
  L.push(
    `■ 追加すべきセクション\n${a.suggestedSections
      .map((s) => `- [優先度${s.priority}] ${s.title} … ${s.why}`)
      .join("\n")}`
  );
  L.push("");
  L.push(`■ E-E-A-T補強ポイント\n- ${a.eeatPoints.join("\n- ")}`);
  return L.join("\n");
}

function CompetitorTab({ job, db }: { job: Job; db: ReturnType<typeof useDB> }) {
  const latestKeyword = db.deliverables.find((d) => d.jobId === job.id)?.keyword ?? "";
  const [keyword, setKeyword] = useState(latestKeyword);
  const [u1, setU1] = useState("");
  const [u2, setU2] = useState("");
  const [u3, setU3] = useState("");
  const [result, setResult] = useState<CompetitorAnalysis | null>(null);

  return (
    <div className="space-y-6">
      <Card title="分析対象の入力" desc="狙うキーワードと競合URLを入力して差分を抽出します。">
        <div className="grid gap-4">
          <Field label="狙うキーワード" hint="必須。検索意図の中心となるキーワード">
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="例：ふるさと納税 やり方" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="競合URL 1">
              <Input value={u1} onChange={(e) => setU1(e.target.value)} placeholder="https://…" />
            </Field>
            <Field label="競合URL 2">
              <Input value={u2} onChange={(e) => setU2(e.target.value)} placeholder="https://…" />
            </Field>
            <Field label="競合URL 3">
              <Input value={u3} onChange={(e) => setU3(e.target.value)} placeholder="https://…" />
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <Button
              disabled={!keyword.trim()}
              onClick={() => setResult(analyzeCompetitors({ keyword, competitorUrls: [u1, u2, u3].filter(Boolean) }))}
            >
              競合差分を分析する
            </Button>
            {result && <CopyButton text={buildCompetitorSummary(keyword, result)} label="分析結果をコピー" />}
          </div>
        </div>
      </Card>

      {!result ? (
        <EmptyState
          title="まだ分析していません"
          desc="キーワードと競合URLを入力して「競合差分を分析する」を押すと、共通見出し・不足情報・独自切り口などが表示されます。"
        />
      ) : (
        <div className="space-y-4">
          <Card title="競合共通見出し" desc="上位が揃って扱っている＝最低限カバーすべき見出し">
            <div className="flex flex-wrap gap-2">
              {result.commonHeadings.map((h) => (
                <Badge key={h} className="border-border bg-white/5 text-zinc-200">
                  {h}
                </Badge>
              ))}
            </div>
          </Card>

          <Card title="比較テーブルにすべき項目">
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-white/5 text-zinc-200">
                    {result.comparisonTable.map((c) => (
                      <th key={c} className="border-b border-l border-border px-3 py-2 text-left font-semibold first:border-l-0">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
              </table>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="自社に不足している情報">
              <ol className="space-y-2">
                {result.missingTopics.map((t, i) => (
                  <li key={t} className="flex items-start gap-3 rounded-lg border border-border bg-bg/40 px-3 py-2 text-[13px] text-zinc-100">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent/20 text-[11px] font-semibold text-accent">
                      {i + 1}
                    </span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
            </Card>
            <Card title="自社が勝てる独自切り口">
              <ul className="space-y-2">
                {result.uniqueAngles.map((a) => (
                  <li key={a} className="flex items-start gap-2 rounded-lg border border-good/30 bg-good/10 px-3 py-2 text-[13px] text-zinc-100">
                    <span className="mt-0.5 text-good">◎</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card title="FAQ差分" desc="読者が検索しているのに競合が答えきれていない質問">
            <ul className="space-y-2">
              {result.faqGaps.map((q) => (
                <li key={q} className="flex items-start gap-2 rounded-lg border border-border bg-bg/40 px-3 py-2 text-[13px] text-zinc-100">
                  <span className="mt-0.5 text-accent2">Q.</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="追加すべきセクション" desc="A=必須 / B=推奨 / C=余力があれば">
            <div className="grid gap-3 sm:grid-cols-2">
              {result.suggestedSections.map((s) => (
                <div key={s.title} className="rounded-lg border border-border bg-bg/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-zinc-100">{s.title}</span>
                    <Badge className={priorityTone(s.priority)}>優先度{s.priority}</Badge>
                  </div>
                  <p className="mt-1.5 text-xs text-muted">{s.why}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="E-E-A-T補強ポイント">
            <div className="flex flex-wrap gap-2">
              {result.eeatPoints.map((p) => (
                <Badge key={p} className="border-accent2/40 bg-accent2/10 text-accent2">
                  {p}
                </Badge>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ════════════════════════ リライト ════════════════════════
function RewriteTab({ job, db }: { job: Job; db: ReturnType<typeof useDB> }) {
  const latestKeyword = db.deliverables.find((d) => d.jobId === job.id)?.keyword ?? "";
  const [existingBody, setExistingBody] = useState("");
  const [keyword, setKeyword] = useState(latestKeyword);
  const [goal, setGoal] = useState<string>(REWRITE_GOALS[0]);
  const [usedGoal, setUsedGoal] = useState<string>(REWRITE_GOALS[0]);
  const [result, setResult] = useState<RewriteDiagnosis | null>(null);

  return (
    <div className="space-y-6">
      <Card title="既存記事の入力" desc="本文とキーワード、改善の目標を指定して診断します。">
        <div className="grid gap-4">
          <Field label="既存記事本文" hint="本文を貼り付けると、文字数や定型表現から診断精度が上がります。">
            <Textarea
              rows={8}
              value={existingBody}
              onChange={(e) => setExistingBody(e.target.value)}
              placeholder="リライト対象の記事本文をそのまま貼り付け"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="狙うキーワード">
              <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="例：投資信託 初心者" />
            </Field>
            <Field label="目標">
              <Select value={goal} onChange={(e) => setGoal(e.target.value)}>
                {REWRITE_GOALS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div>
            <Button
              onClick={() => {
                setResult(diagnoseRewrite({ keyword, body: existingBody, goal }));
                setUsedGoal(goal);
              }}
            >
              リライト診断を実行する
            </Button>
          </div>
        </div>
      </Card>

      {!result ? (
        <EmptyState
          title="まだ診断していません"
          desc="本文とキーワード・目標を入力して「リライト診断を実行する」を押すと、現状評価と改善項目が表示されます。"
        />
      ) : (
        <div className="space-y-4">
          <Card title="現状評価" desc="現行記事のSEO/GEO観点での総合スコア">
            <div className="flex items-center gap-5">
              <ScoreRing value={result.currentScore} size={96} tone={scoreTone(result.currentScore)} />
              <div className="text-[13px] text-muted">
                <p>
                  目標「<span className="text-zinc-200">{usedGoal}</span>」に向けて、下記の改善項目を優先度順に対応してください。
                </p>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <FixCard title="タイトル改善案" text={result.titleFix} />
            <FixCard title="導入文改善案" text={result.leadFix} />
            <ListCard title="見出し改善" items={result.headingFixes} />
            <ListCard title="不足情報" items={result.missingInfo} />
            <ListCard title="古い情報の可能性" items={result.outdated} />
            <ListCard title="読みにくい箇所" items={result.hardToRead} />
            <ListCard title="冗長表現" items={result.redundant} />
            <ListCard title="AIっぽい表現" items={result.aiLikePhrases} />
            <ListCard title="専門性不足" items={result.expertiseGaps} />
            <FixCard title="CTA改善" text={result.ctaFix} />
          </div>

          <ListCard title="FAQ追加案" desc="AI検索にも拾われやすい短文回答を想定した質問" items={result.faqAdds} />

          <Card title="リライト後の構成案" desc="改善を反映した推奨アウトライン">
            <div className="space-y-1.5">
              {result.newOutline.map((n, i) => {
                const indent = n.level === "h2" ? "pl-4" : n.level === "h3" ? "pl-8" : "pl-0";
                return (
                  <div key={i} className={cn("rounded-lg border border-border bg-bg/40 px-3 py-2", indent)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        className={cn(
                          n.level === "h1"
                            ? "border-accent/50 bg-accent/15 text-accent"
                            : n.level === "h2"
                            ? "border-accent2/40 bg-accent2/10 text-accent2"
                            : "border-border bg-white/5 text-muted"
                        )}
                      >
                        {n.level.toUpperCase()}
                      </Badge>
                      <span className="text-[13px] font-semibold text-zinc-100">{n.text}</span>
                      <span className="text-[11px] text-muted">／ {n.role}</span>
                      {n.charBudget > 0 && (
                        <span className="ml-auto text-[11px] tabular-nums text-muted">約{n.charBudget}字</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted">{n.content}</p>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="修正優先度" desc="A=最優先 / B=推奨 / C=余力があれば">
            <div className="space-y-2">
              {result.priorities.map((p, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-bg/40 px-3 py-2">
                  <Badge className={priorityTone(p.priority)}>優先度{p.priority}</Badge>
                  <span className="text-[13px] text-zinc-100">{p.item}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ════════════════════════ GEO ════════════════════════
function GeoTab() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [suggestions, setSuggestions] = useState<GeoSuggestion[] | null>(null);
  const score = geoScore(checked);
  const tone: "good" | "warn" | "danger" = score >= 71 ? "good" : score >= 41 ? "warn" : "danger";

  const done = suggestions?.filter((s) => s.present) ?? [];
  const todo = suggestions?.filter((s) => !s.present) ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="GEO対応チェックリスト" desc="該当する項目にチェック" className="lg:col-span-2">
          <div className="grid gap-2 sm:grid-cols-2">
            {GEO_CHECK_AREAS.map((area) => {
              const on = !!checked[area];
              return (
                <button
                  key={area}
                  type="button"
                  onClick={() => setChecked((prev) => ({ ...prev, [area]: !prev[area] }))}
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left text-[13px] transition",
                    on
                      ? "border-good/40 bg-good/10 text-zinc-100"
                      : "border-border bg-bg/40 text-zinc-300 hover:border-accent/40 hover:bg-white/5"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]",
                      on ? "border-good bg-good text-bg" : "border-border text-transparent"
                    )}
                  >
                    ✓
                  </span>
                  <span>{area}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3">
            <Button onClick={() => setSuggestions(generateGeoSuggestions(checked))}>
              GEO対応ポイントを追加する
            </Button>
          </div>
        </Card>

        <Card title="GEOスコア" desc="チェック状況からリアルタイム算出">
          <div className="flex flex-col items-center gap-3 py-2">
            <ScoreRing value={score} size={120} tone={tone} />
            <Badge
              className={cn(
                tone === "good"
                  ? "border-good/50 bg-good/15 text-good"
                  : tone === "warn"
                  ? "border-warn/50 bg-warn/15 text-warn"
                  : "border-danger/50 bg-danger/15 text-danger"
              )}
            >
              {score <= 40 ? "要改善" : score <= 70 ? "あと一歩" : "良好"}
            </Badge>
          </div>
        </Card>
      </div>

      {suggestions && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="対応済み" desc={`${done.length}件 — 引用されやすい表現にさらに磨き込みましょう`}>
            {done.length ? (
              <ul className="space-y-1.5">
                {done.map((s) => (
                  <li key={s.area} className="flex items-start gap-2 rounded-lg border border-good/30 bg-good/10 px-3 py-2 text-[13px] text-zinc-100">
                    <span className="mt-0.5 text-good">✓</span>
                    <span>{s.area}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-center text-xs text-muted">対応済みの項目はまだありません</p>
            )}
          </Card>

          <Card title="追加すべき項目" desc={`${todo.length}件 — 付加価値として実装を提案できます`}>
            {todo.length ? (
              <ul className="space-y-2">
                {todo.map((s) => (
                  <li key={s.area} className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2">
                    <p className="text-[13px] font-medium text-zinc-100">{s.area}</p>
                    <p className="mt-0.5 text-xs text-warn">→ {s.suggestion}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-center text-xs text-muted">すべて対応済みです。素晴らしい設計です。</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

// ════════════════════════ レポート ════════════════════════
function ReportTab({ job, db }: { job: Job; db: ReturnType<typeof useDB> }) {
  const deliverables = useMemo(
    () => db.deliverables.filter((d) => d.jobId === job.id),
    [db.deliverables, job.id]
  );
  const [deliverableId, setDeliverableId] = useState("");
  const [format, setFormat] = useState<string>(REPORT_FORMATS[0]);
  const [generated, setGenerated] = useState(false);
  const [banner, setBanner] = useState<GasResult | null>(null);
  const [busy, setBusy] = useState<"" | "docs" | "pdf">("");

  const deliverable = deliverables.find((d) => d.id === deliverableId) ?? deliverables[0];
  const reportTitle = deliverable ? `SEO納品レポート：${job.title}` : job.title;

  const markdown = useMemo(() => {
    if (!deliverable) return "";
    return formatForMarkdown({
      jobTitle: job.title,
      clientName: deliverable.clientName,
      keyword: deliverable.keyword,
      purpose: deliverable.purpose,
      outline: deliverable.outline,
      titles: deliverable.titles,
      metaDescriptions: deliverable.metaDescriptions,
      faqs: deliverable.faqs,
      geoSuggestions: deliverable.geoSuggestions,
      competitorAnalysis: deliverable.competitorAnalysis,
    });
  }, [job, deliverable]);

  const sheetsRows = useMemo(() => formatForSheets(job), [job]);

  const transformed = useMemo(() => {
    if (!markdown) return "";
    switch (format) {
      case "Google Docs用":
        return formatForGoogleDocs(markdown);
      case "PDF用":
        return formatForPdf(markdown);
      default:
        return markdown;
    }
  }, [markdown, format]);

  const isSheets = format === "Google Sheets用";
  const copyText = isSheets ? sheetsRows.map((r) => r.join("\t")).join("\n") : transformed;

  async function handleExport(kind: "docs" | "pdf") {
    if (!deliverable) return;
    setBusy(kind);
    setBanner(null);
    const body = copyText;
    const res =
      kind === "docs"
        ? await exportReportToGoogleDocs(reportTitle, body)
        : await exportReportToPDF(reportTitle, body);
    setBanner(res);
    setBusy("");
  }

  if (deliverables.length === 0) {
    return (
      <EmptyState
        title="先に「納品」タブで納品物を作成してください"
        desc="納品物を保存すると、ここでクライアント向けの各形式に整形して出力できます。"
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card title="出力設定" desc="納品物と出力形式を選んでください。">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="納品物">
            <Select
              value={deliverable?.id ?? ""}
              onChange={(e) => {
                setDeliverableId(e.target.value);
                setGenerated(false);
                setBanner(null);
              }}
            >
              {deliverables.map((d) => (
                <option key={d.id} value={d.id}>
                  {(d.type || "納品物") + "｜" + d.keyword}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="出力形式">
            <Select
              value={format}
              onChange={(e) => {
                setFormat(e.target.value);
                setBanner(null);
              }}
            >
              {REPORT_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-4">
          <Button
            disabled={!deliverable}
            onClick={() => {
              setGenerated(true);
              setBanner(null);
            }}
          >
            レポートを生成する
          </Button>
        </div>
      </Card>

      {generated && deliverable && (
        <Card title={`プレビュー（${format}）`} desc={reportTitle} right={<CopyButton text={copyText} label="本文をコピー" />}>
          {banner && (
            <div
              className={cn(
                "mb-4 rounded-lg border px-3 py-2 text-xs",
                banner.ok ? "border-good/40 bg-good/10 text-good" : "border-danger/40 bg-danger/10 text-danger"
              )}
            >
              {banner.message}
            </div>
          )}

          {isSheets ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-white/5">
                    {sheetsRows[0]?.map((h, i) => (
                      <th key={i} className="border-b border-border px-3 py-2 text-left text-xs font-semibold text-zinc-200">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sheetsRows.slice(1).map((row, ri) => (
                    <tr key={ri} className="odd:bg-white/[0.02]">
                      {row.map((cell, ci) => (
                        <td key={ci} className="border-b border-border px-3 py-2 tabular-nums text-zinc-300">
                          {cell || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <pre className="prose-report max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-bg/60 p-4 text-[13px] leading-relaxed text-zinc-200">
              {transformed}
            </pre>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="subtle" disabled={busy !== ""} onClick={() => handleExport("docs")}>
              {busy === "docs" ? "出力中…" : "Google Docsへ出力"}
            </Button>
            <Button variant="outline" disabled={busy !== ""} onClick={() => handleExport("pdf")}>
              {busy === "pdf" ? "出力中…" : "PDFを出力"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
