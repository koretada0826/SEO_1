"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Card,
  Button,
  Badge,
  Field,
  Textarea,
  Select,
  ScoreBar,
  EmptyState,
  PageHeader,
  CopyButton,
  cn,
} from "@/components/ui";
import { actions } from "@/lib/store";
import {
  MAX_ITEMS,
  TARGET_LABEL,
  JOB_TYPES,
  ACQ_MODE_LABEL,
  SAFETY_ITEMS,
  suggestedKeywords,
  generateClaudeChromePrompt,
  parseClaudeChromeOutput,
  previewLabel,
  type TargetPlatform,
  type AcquisitionMode,
} from "@/lib/claudeChrome";
import { analyzeJob } from "@/lib/mockAI";
import {
  PLATFORM_LABEL,
  CATEGORY_LABEL,
  BUDGET_TYPE_LABEL,
  yen,
  scoreTone,
  riskTone,
  labelColor,
  LABEL_TEXT,
} from "@/lib/labels";
import type { Job } from "@/lib/types";

const TARGETS: TargetPlatform[] = ["crowdworks", "lancers", "both", "other"];
const COUNT_OPTIONS = [1, 3, 5];

export default function ClaudeChromePage() {
  // ── 探索条件 ──
  const [target, setTarget] = useState<TargetPlatform>("both");
  const [jobTypeKeys, setJobTypeKeys] = useState<string[]>(["seo_outline", "rewrite"]);
  const [mode, setMode] = useState<AcquisitionMode>("search_results");
  const [maxItems, setMaxItems] = useState<number>(3);
  const [keywords, setKeywords] = useState<string>("");
  const [keywordsEdited, setKeywordsEdited] = useState(false);

  // ── 安全 ──
  const [safetyChecks, setSafetyChecks] = useState<Record<string, boolean>>(
    Object.fromEntries(SAFETY_ITEMS.map((s) => [s.key, true]))
  );
  const [safetyConfirmed, setSafetyConfirmed] = useState(false);

  // ── 出力 ──
  const [prompt, setPrompt] = useState<string>("");

  // ── 貼り付け / プレビュー ──
  const [pasted, setPasted] = useState<string>("");
  const [previewJobs, setPreviewJobs] = useState<Partial<Job>[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [savedCount, setSavedCount] = useState(0);

  // 案件タイプ選択が変わるたびに、キーワードを再生成（手動編集していない場合のみ）
  const autoKeywords = useMemo(
    () => suggestedKeywords(jobTypeKeys).join("、"),
    [jobTypeKeys]
  );
  useEffect(() => {
    if (!keywordsEdited) setKeywords(autoKeywords);
  }, [autoKeywords, keywordsEdited]);

  const toggleJobType = (key: string) =>
    setJobTypeKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  const regenerateKeywords = () => {
    setKeywords(autoKeywords);
    setKeywordsEdited(false);
  };

  const buildPrompt = () => {
    setPrompt(
      generateClaudeChromePrompt({
        target,
        jobTypeKeys,
        mode,
        maxItems,
        keywords,
      })
    );
  };

  const parseOutput = () => {
    const res = parseClaudeChromeOutput(pasted);
    setPreviewJobs(res.jobs);
    setParseErrors(res.errors);
    setSavedCount(0);
  };

  const saveOne = (job: Partial<Job>, idx: number) => {
    actions.addJob({ ...job, status: "saved", analysis: analyzeJob(job) });
    setPreviewJobs((prev) => prev.filter((_, i) => i !== idx));
    setSavedCount((c) => c + 1);
  };

  const saveAll = () => {
    const n = previewJobs.length;
    previewJobs.forEach((job) =>
      actions.addJob({ ...job, status: "saved", analysis: analyzeJob(job) })
    );
    setPreviewJobs([]);
    setSavedCount((c) => c + n);
  };

  const canSave = safetyConfirmed;

  return (
    <>
      <Link href="/jobs" className="mb-3 inline-block text-xs text-muted transition hover:text-zinc-200">
        ← 案件一覧
      </Link>
      <PageHeader
        title="案件を探す / 取り込む"
        desc="規約に配慮した案件探索用プロンプトを生成し、Claude in Chrome に渡します。返ってきたJSONを貼り付けて内容を確認し、あなたの承認後に案件として登録します。大量取得・高速巡回・CAPTCHA回避は行いません。"
      />

      {/* Claude in Chrome での使い方 */}
      <div className="mb-4 rounded-xl border border-accent/30 bg-accent/5 p-4">
        <p className="mb-2.5 text-xs font-semibold text-zinc-200">Claude in Chrome での使い方</p>
        <ol className="grid gap-2 text-[12px] text-zinc-300 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["1", "条件を選んでプロンプトを作成", "下で媒体・案件タイプ・取得モードを選び「プロンプトを作成」"],
            ["2", "Claude in Chrome に貼り付け", "コピーして Chrome の Claude に渡すと、案件を探して整理します"],
            ["3", "結果をこの画面に戻す", "ClaudeのJSON出力を貼り付け（または Claude がフォームに直接記入）"],
            ["4", "確認して登録", "プレビューを確認し、安全チェック後に「登録」。保存はあなたが行います"],
          ].map(([n, t, d]) => (
            <li key={n} className="rounded-lg border border-border bg-bg/40 p-2.5">
              <div className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-accent">
                  {n}
                </span>
                <span className="font-medium text-zinc-100">{t}</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ───────── 左：設定 ───────── */}
        <div className="space-y-4">
          <Card title="探索条件" desc="どの媒体で、どんなSEO案件を、いくつ探すかを決めます">
            <div className="space-y-5">
              {/* 検索対象 */}
              <Field label="検索対象">
                <div className="flex flex-wrap gap-2">
                  {TARGETS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTarget(t)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-sm transition",
                        target === t
                          ? "border-accent/60 bg-accent/15 text-accent"
                          : "border-border bg-white/5 text-zinc-300 hover:bg-white/10"
                      )}
                    >
                      {TARGET_LABEL[t]}
                    </button>
                  ))}
                </div>
              </Field>

              {/* 案件タイプ */}
              <Field label="案件タイプ" hint="複数選択できます。選択内容から検索キーワードを自動生成します。">
                <div className="flex flex-wrap gap-2">
                  {JOB_TYPES.map((jt) => {
                    const on = jobTypeKeys.includes(jt.key);
                    return (
                      <button
                        key={jt.key}
                        type="button"
                        onClick={() => toggleJobType(jt.key)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition",
                          on
                            ? "border-accent/60 bg-accent/15 text-accent"
                            : "border-border bg-white/5 text-zinc-300 hover:bg-white/10"
                        )}
                      >
                        {on ? "✓ " : ""}
                        {jt.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* 取得モード */}
                <Field label="取得モード">
                  <Select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as AcquisitionMode)}
                  >
                    {(Object.keys(ACQ_MODE_LABEL) as AcquisitionMode[]).map((m) => (
                      <option key={m} value={m}>
                        {ACQ_MODE_LABEL[m]}
                      </option>
                    ))}
                  </Select>
                </Field>

                {/* 取得件数 */}
                <Field label="取得件数" hint={`安全のため最大${MAX_ITEMS}件まで`}>
                  <div className="flex gap-2">
                    {COUNT_OPTIONS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setMaxItems(c)}
                        className={cn(
                          "flex-1 rounded-lg border px-3 py-1.5 text-sm tabular-nums transition",
                          maxItems === c
                            ? "border-accent/60 bg-accent/15 text-accent"
                            : "border-border bg-white/5 text-zinc-300 hover:bg-white/10"
                        )}
                      >
                        {c}件
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              {/* 検索キーワード */}
              <Field
                label="検索キーワード"
                hint="案件タイプから自動生成されます。自由に編集できます。"
              >
                <Textarea
                  rows={3}
                  value={keywords}
                  onChange={(e) => {
                    setKeywords(e.target.value);
                    setKeywordsEdited(true);
                  }}
                  placeholder="例：SEO 構成、記事 リライト"
                />
                <button
                  type="button"
                  onClick={regenerateKeywords}
                  className="mt-1.5 text-[11px] text-accent2 hover:underline"
                >
                  選択した案件タイプからキーワードを再生成
                </button>
              </Field>

              <Button onClick={buildPrompt} className="w-full">
                この条件で案件を探すプロンプトを作成
              </Button>
            </div>
          </Card>

          {/* 安全チェックリスト */}
          <Card title="安全チェックリスト" desc="合法・規約配慮で運用するための確認項目">
            <div className="space-y-2.5">
              {SAFETY_ITEMS.map((s) => (
                <label
                  key={s.key}
                  className="flex cursor-pointer items-start gap-2.5 text-sm text-zinc-300"
                >
                  <input
                    type="checkbox"
                    checked={!!safetyChecks[s.key]}
                    onChange={(e) =>
                      setSafetyChecks((prev) => ({ ...prev, [s.key]: e.target.checked }))
                    }
                    className="mt-0.5 h-4 w-4 accent-[#7c5cff]"
                  />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>

            <div className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-[13px] text-danger">
              危険な取得方法（大量スクレイピング・高速巡回・CAPTCHA回避）は使いません。
              「ユーザーが通常閲覧できる範囲」を、人間が確認できる速度で整理する補助に限定します。
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-bg/40 px-4 py-3 text-sm font-medium text-zinc-200">
              <input
                type="checkbox"
                checked={safetyConfirmed}
                onChange={(e) => setSafetyConfirmed(e.target.checked)}
                className="h-4 w-4 accent-[#7c5cff]"
              />
              安全チェック済み（これを確認すると案件の登録が可能になります）
            </label>
          </Card>
        </div>

        {/* ───────── 右：出力・プレビュー ───────── */}
        <div className="space-y-4">
          {/* 生成プロンプト */}
          <Card
            title="Claudeに渡すプロンプト"
            desc="そのままClaude in Chromeのチャットに貼り付けてください"
            right={prompt ? <CopyButton text={prompt} label="Claudeに渡すプロンプトをコピー" /> : undefined}
          >
            {prompt ? (
              <pre className="prose-report max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-bg/60 p-4 text-[12.5px] leading-relaxed text-zinc-200">
                {prompt}
              </pre>
            ) : (
              <EmptyState
                title="まだプロンプトが生成されていません"
                desc="左の「探索条件」を設定し、「この条件で案件を探すプロンプトを作成」を押してください。"
              />
            )}
          </Card>

          {/* 貼り付け */}
          <Card
            title="Claudeの出力を貼り付け"
            desc="Claudeが返したJSON（[]配列または{}オブジェクト）を貼り付けます"
          >
            <Textarea
              rows={7}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder='[{"title": "SEO記事のリライト", "platform": "クラウドワークス", ...}]'
              className="font-mono text-xs"
            />
            <div className="mt-3 flex items-center gap-3">
              <Button variant="subtle" onClick={parseOutput} disabled={!pasted.trim()}>
                JSONを解析して案件登録フォームに反映
              </Button>
              {savedCount > 0 && (
                <span className="text-[13px] text-good">{savedCount}件を登録しました</span>
              )}
            </div>

            {parseErrors.length > 0 && (
              <div className="mt-3 space-y-1 rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-[13px] text-warn">
                {parseErrors.map((er, i) => (
                  <div key={i}>・{er}</div>
                ))}
              </div>
            )}
          </Card>

          {/* プレビュー */}
          <Card
            title="案件登録プレビュー"
            desc="内容を確認してから登録してください"
            right={
              <Button
                variant="primary"
                className="px-2.5 py-1 text-xs"
                onClick={saveAll}
                disabled={!canSave || previewJobs.length === 0}
              >
                すべて保存（{previewJobs.length}）
              </Button>
            }
          >
            {!canSave && (
              <div className="mb-3 rounded-lg border border-warn/40 bg-warn/10 px-4 py-2.5 text-[12.5px] text-warn">
                登録するには、安全チェック済みにチェックを入れてください。
              </div>
            )}
            {previewJobs.length ? (
              <div className="space-y-3">
                {previewJobs.map((job, idx) => (
                  <PreviewCard
                    key={idx}
                    job={job}
                    canSave={canSave}
                    onSave={() => saveOne(job, idx)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="プレビューする案件がありません"
                desc="上の貼り付け欄にClaudeの出力を入れて「JSONを解析」を押すと、ここに候補が並びます。"
              />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

// ── プレビュー用サブカード（両ページ共通の見た目） ──
function PreviewCard({
  job,
  canSave,
  onSave,
}: {
  job: Partial<Job>;
  canSave: boolean;
  onSave: () => void;
}) {
  const label = previewLabel(job);
  const priority = job.scores?.priority ?? 0;
  const risk = job.scores?.risk ?? 0;

  return (
    <div className="rounded-xl border border-border bg-bg/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-zinc-100">
            {job.title || "無題の案件"}
          </h4>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
            <Badge className="border-border bg-white/5 text-muted">
              {PLATFORM_LABEL[job.platform ?? "other"]}
            </Badge>
            <Badge className="border-border bg-white/5 text-muted">
              {CATEGORY_LABEL[job.category ?? "other"]}
            </Badge>
            <span>
              {yen(job.budget)}・{BUDGET_TYPE_LABEL[job.budgetType ?? "unknown"]}
            </span>
            {job.deadline && <span>納期 {job.deadline}</span>}
            <span>
              AI使用:{" "}
              {job.aiPolicy === "allowed"
                ? "可"
                : job.aiPolicy === "forbidden"
                ? "不可"
                : "不明"}
            </span>
          </div>
        </div>
        <Badge className={labelColor(label)}>{LABEL_TEXT[label]}</Badge>
      </div>

      {job.url && (
        <p className="mt-2 truncate text-[11px] text-accent2">{job.url}</p>
      )}
      {job.notes && (
        <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-muted">
          {job.notes}
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1 flex justify-between text-[10px] text-muted">
            <span>応募優先度</span>
            <span className="tabular-nums">{priority}</span>
          </div>
          <ScoreBar value={priority} tone={scoreTone(priority)} />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-[10px] text-muted">
            <span>地雷度</span>
            <span className="tabular-nums">{risk}</span>
          </div>
          <ScoreBar value={risk} tone={riskTone(risk)} />
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Button
          variant="primary"
          className="px-3 py-1.5 text-xs"
          onClick={onSave}
          disabled={!canSave}
        >
          この案件を登録
        </Button>
      </div>
    </div>
  );
}
