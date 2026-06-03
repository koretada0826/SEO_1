"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Button,
  Badge,
  Field,
  Textarea,
  ScoreBar,
  StatCard,
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
import type { Job, JudgeLabel } from "@/lib/types";

const TARGETS: TargetPlatform[] = ["crowdworks", "lancers", "both", "other"];
const MODES = Object.keys(ACQ_MODE_LABEL) as AcquisitionMode[];
const COUNT_OPTIONS = [1, 3, 5];
const APPLY_LABELS: JudgeLabel[] = ["apply_now", "apply_if", "apply_for_portfolio"];

const AUTOMATION_LEVELS = [
  { lv: "Lv1", title: "手動 + 整理補助", desc: "人が開いた1ページを読み取り整理" },
  { lv: "Lv2", title: "検索結果から候補抽出", desc: "一覧から良さそうな案件を最大5件候補化" },
  { lv: "Lv3", title: "キーワード検索", desc: "指定語で探索し候補をJSON化" },
  { lv: "Lv4", title: "フォーム直接入力", desc: "登録フォームに入力（保存は人が確認）" },
];

export default function AcquirePage() {
  // ── 設定 ──
  const [mode, setMode] = useState<AcquisitionMode>("search_results");
  const [target, setTarget] = useState<TargetPlatform>("both");
  const [jobTypeKeys, setJobTypeKeys] = useState<string[]>(["seo_outline", "rewrite"]);
  const [maxItems, setMaxItems] = useState<number>(3);
  const [keywords, setKeywords] = useState<string>("");
  const [keywordsEdited, setKeywordsEdited] = useState(false);

  // ── 安全 ──
  const [safetyChecks, setSafetyChecks] = useState<Record<string, boolean>>(
    Object.fromEntries(SAFETY_ITEMS.map((s) => [s.key, true]))
  );
  const [safetyConfirmed, setSafetyConfirmed] = useState(false);

  // ── 貼り付け / プレビュー ──
  const [pasted, setPasted] = useState<string>("");
  const [previewJobs, setPreviewJobs] = useState<Partial<Job>[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [resultMsg, setResultMsg] = useState<string>("");

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

  const promptFor = (m: AcquisitionMode) =>
    generateClaudeChromePrompt({ target, jobTypeKeys, mode: m, maxItems, keywords });

  const currentPrompt = useMemo(
    () => promptFor(mode),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, target, jobTypeKeys, maxItems, keywords]
  );

  const parseOutput = () => {
    const res = parseClaudeChromeOutput(pasted);
    setPreviewJobs(res.jobs);
    setParseErrors(res.errors);
    setResultMsg("");
  };

  const commit = (jobs: Partial<Job>[]) => {
    jobs.forEach((job) =>
      actions.addJob({ ...job, status: "saved", analysis: analyzeJob(job) })
    );
  };

  const saveOne = (job: Partial<Job>, idx: number) => {
    commit([job]);
    setPreviewJobs((prev) => prev.filter((_, i) => i !== idx));
    setResultMsg("1件を保存しました。");
  };

  const saveAll = () => {
    const n = previewJobs.length;
    commit(previewJobs);
    setPreviewJobs([]);
    setResultMsg(`${n}件をすべて保存しました。`);
  };

  const saveExcludingLandmines = () => {
    const keep = previewJobs.filter((j) => (j.scores?.risk ?? 0) < 65);
    const skipped = previewJobs.length - keep.length;
    commit(keep);
    setPreviewJobs([]);
    setResultMsg(`${keep.length}件を保存（地雷案件 ${skipped}件を除外）しました。`);
  };

  const saveApplyCandidates = () => {
    const keep = previewJobs.filter((j) => APPLY_LABELS.includes(previewLabel(j)));
    const skipped = previewJobs.length - keep.length;
    commit(keep);
    setPreviewJobs([]);
    setResultMsg(`応募候補 ${keep.length}件を保存（その他 ${skipped}件を除外）しました。`);
  };

  const canSave = safetyConfirmed;

  return (
    <>
      <PageHeader
        title="案件自動取得"
        desc="Claude in Chrome を使って、合法・規約配慮の範囲で案件を半自動取得します。人間が確認できる速度で、通常閲覧できる情報のみを整理。保存は必ずあなたの確認後に行います。"
      />

      {/* 自動化レベルの説明 */}
      <Card
        title="自動化レベルの考え方"
        desc={`Lv1〜Lv4 の範囲で運用し、Lv5（無制限クローラー）は目指しません。1回の取得は最大${MAX_ITEMS}件まで。`}
        className="mb-4"
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {AUTOMATION_LEVELS.map((l) => (
            <div
              key={l.lv}
              className="rounded-lg border border-border bg-bg/40 p-3"
            >
              <Badge className="border-accent/40 bg-accent/10 text-accent">{l.lv}</Badge>
              <p className="mt-2 text-[13px] font-medium text-zinc-100">{l.title}</p>
              <p className="mt-0.5 text-[11px] text-muted">{l.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="1回の最大取得件数" value={`${MAX_ITEMS}件`} tone="accent" />
          <StatCard label="高速巡回" value="しない" tone="good" />
          <StatCard label="CAPTCHA回避" value="しない" tone="good" />
          <StatCard label="保存前確認" value="必須" tone="warn" />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ───────── 左：設定 ───────── */}
        <div className="space-y-4">
          <Card title="取得設定" desc="モード・対象媒体・案件タイプ・件数を設定します">
            <div className="space-y-5">
              {/* 取得モード */}
              <Field label="取得モード">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {MODES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left text-[12.5px] transition",
                        mode === m
                          ? "border-accent/60 bg-accent/15 text-accent"
                          : "border-border bg-white/5 text-zinc-300 hover:bg-white/10"
                      )}
                    >
                      {ACQ_MODE_LABEL[m]}
                    </button>
                  ))}
                </div>
              </Field>

              {/* 対象媒体 */}
              <Field label="対象媒体">
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
              <Field label="案件タイプ" hint="選択内容から検索キーワードを自動生成します">
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

              {/* 検索キーワード */}
              <Field label="検索キーワード" hint="自動生成されます。自由に編集できます。">
                <Textarea
                  rows={3}
                  value={keywords}
                  onChange={(e) => {
                    setKeywords(e.target.value);
                    setKeywordsEdited(true);
                  }}
                  placeholder="例：SEO リライト、競合分析"
                />
                <button
                  type="button"
                  onClick={() => {
                    setKeywords(autoKeywords);
                    setKeywordsEdited(false);
                  }}
                  className="mt-1.5 text-[11px] text-accent2 hover:underline"
                >
                  選択した案件タイプからキーワードを再生成
                </button>
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
          </Card>

          {/* 安全 */}
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
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-bg/40 px-4 py-3 text-sm font-medium text-zinc-200">
              <input
                type="checkbox"
                checked={safetyConfirmed}
                onChange={(e) => setSafetyConfirmed(e.target.checked)}
                className="h-4 w-4 accent-[#7c5cff]"
              />
              安全チェック済み（これを確認すると案件の保存が可能になります）
            </label>
          </Card>
        </div>

        {/* ───────── 右：プロンプト・貼り付け・プレビュー ───────── */}
        <div className="space-y-4">
          {/* プロンプト（4モード分のコピー） */}
          <Card
            title="操作プロンプト"
            desc="モード別にプロンプトをコピーして、Claude in Chrome に貼り付けてください"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <CopyButton
                text={promptFor("current_page")}
                label="現在ページから取得するプロンプトをコピー"
              />
              <CopyButton
                text={promptFor("search_results")}
                label="検索結果から候補抽出するプロンプトをコピー"
              />
              <CopyButton
                text={promptFor("keyword_search")}
                label="指定キーワードで案件を探すプロンプトをコピー"
              />
              <CopyButton
                text={promptFor("form_fill")}
                label="フォーム直接入力用プロンプトをコピー"
              />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted">
                選択中モード：<span className="text-zinc-200">{ACQ_MODE_LABEL[mode]}</span>
              </p>
              <CopyButton text={currentPrompt} label="このプロンプトをコピー" />
            </div>
            <pre className="prose-report mt-2 max-h-[360px] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-bg/60 p-4 text-[12.5px] leading-relaxed text-zinc-200">
              {currentPrompt}
            </pre>
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
              placeholder='[{"title": "競合分析の案件", "platform": "ランサーズ", ...}]'
              className="font-mono text-xs"
            />
            <div className="mt-3">
              <Button variant="subtle" onClick={parseOutput} disabled={!pasted.trim()}>
                JSONを解析して案件登録フォームに反映
              </Button>
            </div>
            {parseErrors.length > 0 && (
              <div className="mt-3 space-y-1 rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-[13px] text-warn">
                {parseErrors.map((er, i) => (
                  <div key={i}>・{er}</div>
                ))}
              </div>
            )}
          </Card>

          {/* プレビュー & 登録 */}
          <Card
            title="案件登録プレビュー"
            desc="内容を確認してから保存してください"
          >
            {!canSave && (
              <div className="mb-3 rounded-lg border border-warn/40 bg-warn/10 px-4 py-2.5 text-[12.5px] text-warn">
                保存するには、安全チェック済みにチェックを入れてください。
              </div>
            )}

            {previewJobs.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  className="px-3 py-1.5 text-xs"
                  onClick={saveAll}
                  disabled={!canSave}
                >
                  すべて保存（{previewJobs.length}）
                </Button>
                <Button
                  variant="outline"
                  className="px-3 py-1.5 text-xs"
                  onClick={saveExcludingLandmines}
                  disabled={!canSave}
                >
                  地雷案件を除外して保存
                </Button>
                <Button
                  variant="outline"
                  className="px-3 py-1.5 text-xs"
                  onClick={saveApplyCandidates}
                  disabled={!canSave}
                >
                  応募候補だけ保存
                </Button>
              </div>
            )}

            {resultMsg && (
              <p className="mb-3 text-[13px] text-good">{resultMsg}</p>
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

// ── プレビュー用サブカード ──
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

      {job.url && <p className="mt-2 truncate text-[11px] text-accent2">{job.url}</p>}
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
          この案件を保存
        </Button>
      </div>
    </div>
  );
}
