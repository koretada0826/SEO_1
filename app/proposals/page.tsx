"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useDB, actions, getJob } from "@/lib/store";
import { JobPicker } from "@/components/JobPicker";
import {
  Card,
  Button,
  Badge,
  Field,
  Select,
  PageHeader,
  SectionTitle,
  EmptyState,
  CopyButton,
} from "@/components/ui";
import { PROPOSAL_TYPES, generateProposal } from "@/lib/mockAI";
import { CATEGORY_LABEL, PLATFORM_LABEL, yen } from "@/lib/labels";
import type { Job, Proposal, AiPolicy } from "@/lib/types";

const TONES = ["丁寧", "カジュアル", "簡潔", "専門的"] as const;
const AI_MODES: { value: AiPolicy; label: string }[] = [
  { value: "allowed", label: "使用可" },
  { value: "forbidden", label: "使用不可" },
  { value: "unknown", label: "不明" },
];

const AVOID_PHRASES = [
  "AIで一瞬で作れます",
  "ChatGPTで作ります",
  "誰でもできます",
  "初心者ですが頑張ります",
  "とりあえずやってみます",
  "格安で対応します",
  "AIに任せれば早いです",
];

const BULK_TYPES = [
  "丁寧め提案文",
  "自作ツールアピール型",
  "実績不足カバー型",
  "AI使用不可案件向け",
];

export default function ProposalsPage() {
  const db = useDB();
  const [jobId, setJobId] = useState("");
  const [type, setType] = useState<string>(PROPOSAL_TYPES[1]);
  const [tone, setTone] = useState<string>(TONES[0]);
  const [aiMode, setAiMode] = useState<AiPolicy>("unknown");
  const [result, setResult] = useState<Proposal | null>(null);
  const [bulk, setBulk] = useState<Proposal[]>([]);

  // read ?job=id on mount
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("job");
    if (q) setJobId(q);
  }, []);

  const job = useMemo<Job | undefined>(
    () => (jobId ? getJob(jobId) : undefined),
    [jobId, db.jobs]
  );

  // default AI mode follows the job's policy
  useEffect(() => {
    if (job) setAiMode(job.aiPolicy);
  }, [job?.id, job?.aiPolicy]);

  const savedProposals = useMemo(
    () =>
      job
        ? db.proposals
            .filter((p) => p.jobId === job.id)
            .slice()
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : [],
    [db.proposals, job?.id]
  );

  const handleGenerate = () => {
    if (!job) return;
    setResult(generateProposal({ job, type, tone, aiPolicyMode: aiMode }));
  };

  const handleBulk = () => {
    if (!job) return;
    setBulk(
      BULK_TYPES.map((t) =>
        generateProposal({ job, type: t, tone, aiPolicyMode: aiMode })
      )
    );
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString("ja-JP", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <>
      <PageHeader
        title="提案文生成"
        desc="案件ごとに最適化した提案文を作成。トーン・AI表現モードを切り替え、保存して使い回せます。"
      />

      <Card title="対象案件" desc="提案文を作る案件を選択してください">
        <JobPicker value={jobId} onChange={setJobId} placeholder="案件を選択…" />
      </Card>

      {!job ? (
        <div className="mt-6">
          <EmptyState
            title="案件が選択されていません"
            desc="まずは案件を登録・選択してください。スカウト画面から案件を登録できます。"
            action={
              <Link href="/scout">
                <Button>案件を登録する</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {/* 案件サマリ */}
          <div className="mt-6">
            <Card title="案件サマリ">
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-100">{job.title}</p>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                  <Badge className="border-border bg-white/5 text-muted">
                    {PLATFORM_LABEL[job.platform]}
                  </Badge>
                  <Badge className="border-border bg-white/5 text-muted">
                    {CATEGORY_LABEL[job.category]}
                  </Badge>
                  <span>{yen(job.budget)}</span>
                  {job.deadline && <span>納期 {job.deadline}</span>}
                  <Badge
                    className={
                      job.aiPolicy === "forbidden"
                        ? "border-danger/40 bg-danger/10 text-danger"
                        : job.aiPolicy === "allowed"
                        ? "border-good/40 bg-good/10 text-good"
                        : "border-border bg-white/5 text-muted"
                    }
                  >
                    AI
                    {job.aiPolicy === "forbidden"
                      ? "使用不可"
                      : job.aiPolicy === "allowed"
                      ? "使用可"
                      : "可否不明"}
                  </Badge>
                </div>
                {job.description && (
                  <p className="line-clamp-3 whitespace-pre-wrap text-xs text-muted">
                    {job.description}
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* AIポリシーガイダンス */}
          <div className="mt-4">
            {job.aiPolicy === "forbidden" ? (
              <div className="rounded-xl border border-danger/40 bg-danger/10 px-5 py-4 text-sm text-danger">
                <p className="font-semibold">AI使用不可案件</p>
                <p className="mt-1 text-[13px] leading-relaxed">
                  『AIで作る』とは書かず、独自チェックリスト/競合分析テンプレ/手作業での整理を前面に出しましょう。
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card/60 px-5 py-4 text-[13px] leading-relaxed text-muted">
                {job.aiPolicy === "allowed"
                  ? "AI使用可。効率化ツールの活用を自然にアピールできます（最終品質は自分で担保すると明記すると安心）。"
                  : "AI可否の明記なし。『独自ツールで効率化しつつ最終品質は自分で確認』という中立表現が安全です。"}
              </div>
            )}
          </div>

          {/* コントロール */}
          <div className="mt-6">
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
                  <Select
                    value={aiMode}
                    onChange={(e) => setAiMode(e.target.value as AiPolicy)}
                  >
                    {AI_MODES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={handleGenerate}>提案文を作る</Button>
                <Button variant="subtle" onClick={handleBulk}>
                  主要タイプを一括生成
                </Button>
              </div>
            </Card>
          </div>

          {/* 生成結果 */}
          {result && (
            <div className="mt-6">
              <Card
                title="生成された提案文"
                desc={`${result.type} / ${result.tone}`}
                right={
                  <div className="flex items-center gap-2">
                    <CopyButton text={result.content} />
                    <Button
                      onClick={() => {
                        actions.addProposal(result);
                      }}
                    >
                      この提案文を保存
                    </Button>
                  </div>
                }
              >
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-200">
                  {result.content}
                </p>
                <p className="mt-3 text-[11px] text-muted">
                  文字数：{result.content.length}字
                </p>
              </Card>
            </div>
          )}

          {/* 一括生成の比較カード */}
          {bulk.length > 0 && (
            <div className="mt-6">
              <SectionTitle sub="それぞれコピー・保存できます">
                主要タイプの比較
              </SectionTitle>
              <div className="grid gap-4 lg:grid-cols-2">
                {bulk.map((p) => (
                  <Card
                    key={p.id}
                    title={p.type}
                    desc={`${p.tone} / ${p.content.length}字`}
                    right={
                      <div className="flex items-center gap-2">
                        <CopyButton text={p.content} />
                        <Button
                          variant="outline"
                          className="px-2.5 py-1 text-xs"
                          onClick={() => actions.addProposal(p)}
                        >
                          保存
                        </Button>
                      </div>
                    }
                  >
                    <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-zinc-300">
                      {p.content}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* 保存済み提案文 */}
          <div className="mt-6">
            <SectionTitle sub="新しい順">保存済みの提案文</SectionTitle>
            {savedProposals.length ? (
              <div className="space-y-3">
                {savedProposals.map((p) => (
                  <Card
                    key={p.id}
                    right={<CopyButton text={p.content} />}
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge className="border-accent/40 bg-accent/10 text-accent">
                        {p.type}
                      </Badge>
                      <Badge className="border-border bg-white/5 text-muted">
                        {p.tone}
                      </Badge>
                      <span className="text-[11px] text-muted">
                        {fmtDate(p.createdAt)}
                      </span>
                    </div>
                    <p className="line-clamp-4 whitespace-pre-wrap text-[12px] leading-relaxed text-zinc-300">
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

          {/* 避けるべき表現 */}
          <div className="mt-6">
            <Card title="避けるべき表現" desc="信頼を損なう・単価を下げる表現は使わない">
              <ul className="flex flex-wrap gap-2">
                {AVOID_PHRASES.map((ph) => (
                  <li key={ph}>
                    <Badge className="border-danger/30 bg-danger/5 text-danger/90">
                      ✕ {ph}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
