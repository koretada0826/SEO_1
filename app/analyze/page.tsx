"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  Button,
  Badge,
  ScoreRing,
  StatCard,
  EmptyState,
  PageHeader,
  SectionTitle,
  cn,
} from "@/components/ui";
import { JobPicker } from "@/components/JobPicker";
import {
  PLATFORM_LABEL,
  CATEGORY_LABEL,
  BUDGET_TYPE_LABEL,
  LABEL_TEXT,
  labelColor,
  scoreTone,
  riskTone,
  yen,
} from "@/lib/labels";
import { analyzeJob } from "@/lib/mockAI";
import { scoreJobRule } from "@/lib/scoring";
import { actions, useDB } from "@/lib/store";
import type { Scores } from "@/lib/types";

const SCORE_RINGS: {
  key: keyof Scores;
  label: string;
  kind: "score" | "risk" | "neutral";
}[] = [
  { key: "priority", label: "応募優先度", kind: "score" },
  { key: "profitability", label: "収益性", kind: "score" },
  { key: "portfolioValue", label: "実績化価値", kind: "score" },
  { key: "toolFit", label: "自作ツール適性", kind: "score" },
  { key: "continuity", label: "継続可能性", kind: "score" },
  { key: "difficulty", label: "作業難易度", kind: "neutral" },
  { key: "risk", label: "地雷度", kind: "risk" },
  { key: "geoReadiness", label: "GEO提案余地", kind: "score" },
];

function AiPolicyBadge({ policy }: { policy: "allowed" | "forbidden" | "unknown" }) {
  const text =
    policy === "allowed" ? "AI使用可" : policy === "forbidden" ? "AI使用不可" : "AI可否不明";
  const cls =
    policy === "allowed"
      ? "border-good/50 bg-good/15 text-good"
      : policy === "forbidden"
      ? "border-danger/50 bg-danger/15 text-danger"
      : "border-border bg-white/5 text-muted";
  return <Badge className={cls}>{text}</Badge>;
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
  if (!items.length)
    return <p className="text-xs text-muted">該当する項目はありません。</p>;
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

export default function AnalyzePage() {
  const db = useDB();
  const [selectedId, setSelectedId] = useState("");
  const [preselectChecked, setPreselectChecked] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("job");
    if (q) setSelectedId(q);
    setPreselectChecked(true);
  }, []);

  const job = selectedId ? db.jobs.find((j) => j.id === selectedId) : undefined;
  const analysis = job?.analysis;

  function handleAnalyze() {
    if (!job) return;
    const a = analyzeJob(job);
    const s = scoreJobRule(job);
    actions.updateJob(job.id, { analysis: a, scores: s });
  }

  return (
    <>
      <PageHeader
        title="案件解析"
        desc="保存した案件を解析し、応募すべきか・どう提案すべきか・地雷はないかを総合的に判断します。"
      />

      <Card title="解析する案件を選択" className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1">
            <JobPicker value={selectedId} onChange={setSelectedId} />
          </div>
          <Button onClick={handleAnalyze} disabled={!job}>
            この案件を解析する
          </Button>
        </div>
      </Card>

      {!job ? (
        preselectChecked && (
          <EmptyState
            title="解析する案件がありません"
            desc="まずは案件スカウトでクラウドワークス・ランサーズの案件を登録してください。"
            action={
              <Link href="/scout">
                <Button>案件を登録する</Button>
              </Link>
            }
          />
        )
      ) : (
        <div className="space-y-4">
          {/* 案件サマリー */}
          <Card title="案件サマリー">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-zinc-50">{job.title}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                  <Badge className="border-border bg-white/5 text-muted">
                    {PLATFORM_LABEL[job.platform]}
                  </Badge>
                  <Badge className="border-border bg-white/5 text-muted">
                    {CATEGORY_LABEL[job.category]}
                  </Badge>
                  <Badge className="border-border bg-white/5 text-muted">
                    {BUDGET_TYPE_LABEL[job.budgetType]}
                  </Badge>
                  <span>{yen(job.budget)}</span>
                  {job.deadline && <span>納期 {job.deadline}</span>}
                  <AiPolicyBadge policy={job.aiPolicy} />
                </div>
              </div>
              {job.url && (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-accent2 hover:underline"
                >
                  募集ページを開く ↗
                </a>
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
              {/* 総合判定 */}
              <Card title="総合判定">
                <div className="flex flex-wrap items-center gap-4">
                  <Badge className={cn(labelColor(analysis.label), "px-3 py-1 text-sm")}>
                    {LABEL_TEXT[analysis.label]}
                  </Badge>
                  <span className="text-xs text-muted">
                    検出タイプ：
                    <span className="text-zinc-200">
                      {CATEGORY_LABEL[analysis.detectedType]}
                    </span>
                  </span>
                  <span className="text-xs text-muted">
                    解析日時：{new Date(analysis.analyzedAt).toLocaleString("ja-JP")}
                  </span>
                </div>
              </Card>

              {/* スコア */}
              <Card title="案件スコア" desc="8軸でルールベース評価しています。">
                <div className="grid grid-cols-2 gap-y-5 sm:grid-cols-4">
                  {SCORE_RINGS.map((r) => {
                    const v = job.scores[r.key];
                    const tone =
                      r.kind === "risk"
                        ? riskTone(v)
                        : r.kind === "neutral"
                        ? "neutral"
                        : scoreTone(v);
                    return (
                      <div key={r.key} className="flex flex-col items-center">
                        <ScoreRing value={v} tone={tone} label={r.label} />
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* 納品物 */}
              <Card title="必要な納品物">
                <div className="flex flex-wrap gap-1.5">
                  {analysis.deliverables.map((d, i) => (
                    <Badge key={i} className="border-accent/40 bg-accent/10 text-accent">
                      {d}
                    </Badge>
                  ))}
                </div>
              </Card>

              {/* 理由・注意・強調 */}
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

              {/* 作業時間見積もり */}
              <Card title="作業時間見積もり">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  <StatCard
                    label="最短"
                    value={`${analysis.time.minHours}h`}
                    tone="accent"
                  />
                  <StatCard
                    label="標準"
                    value={`${analysis.time.normalHours}h`}
                    tone="accent"
                  />
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
                <p className="mt-3 text-xs text-muted">
                  自作ツールによる削減：約{analysis.time.toolSavedHours}時間（構成案・競合分析・FAQ抽出の効率化分）
                </p>
              </Card>

              {/* AI使用可否 */}
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

              {/* 地雷ワード */}
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

              {/* アクション */}
              <Card>
                <div className="flex flex-wrap justify-end gap-2">
                  <Link href={`/proposals?job=${job.id}`}>
                    <Button variant="outline">提案文を作る</Button>
                  </Link>
                  <Link href={`/workspace?job=${job.id}`}>
                    <Button>SEO構成案を作る</Button>
                  </Link>
                </div>
              </Card>
            </>
          )}
        </div>
      )}
    </>
  );
}
