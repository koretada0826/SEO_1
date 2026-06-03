"use client";
import { useMemo, useState } from "react";
import {
  Card,
  Button,
  Badge,
  Field,
  Input,
  Textarea,
  Select,
  ScoreBar,
  PageHeader,
  SectionTitle,
  cn,
} from "@/components/ui";
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
import { parseJobText, analyzeJob } from "@/lib/mockAI";
import { detectRiskWordsRule, detectPositiveSignals } from "@/lib/riskWords";
import { scoreJobRule, labelFromScores } from "@/lib/scoring";
import { parseClaudeChromeOutput } from "@/lib/claudeChrome";
import { actions } from "@/lib/store";
import type {
  Platform,
  Category,
  BudgetType,
  AiPolicy,
  Permission,
  Continuity,
} from "@/lib/types";

interface FormState {
  title: string;
  platform: Platform;
  url: string;
  description: string;
  budgetType: BudgetType;
  budget: string;
  deadline: string;
  recruitCount: string;
  applicantCount: string;
  clientRating: string;
  clientOrderCount: string;
  category: Category;
  aiPolicy: AiPolicy;
  portfolioPermission: Permission;
  continuity: Continuity;
  charCount: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  platform: "crowdworks",
  url: "",
  description: "",
  budgetType: "unknown",
  budget: "",
  deadline: "",
  recruitCount: "",
  applicantCount: "",
  clientRating: "",
  clientOrderCount: "",
  category: "other",
  aiPolicy: "unknown",
  portfolioPermission: "unknown",
  continuity: "unknown",
  charCount: "",
  notes: "",
};

const numOrU = (s: string): number | undefined =>
  s.trim() === "" ? undefined : Number(s);

// フォーム → scoreJobRule / analyzeJob に渡す Partial<Job>
function toPartialJob(f: FormState) {
  return {
    title: f.title,
    platform: f.platform,
    url: f.url,
    description: f.description,
    budgetType: f.budgetType,
    budget: f.budget.trim() === "" ? 0 : Number(f.budget),
    deadline: f.deadline,
    recruitCount: numOrU(f.recruitCount),
    applicantCount: numOrU(f.applicantCount),
    clientRating: numOrU(f.clientRating),
    clientOrderCount: numOrU(f.clientOrderCount),
    category: f.category,
    aiPolicy: f.aiPolicy,
    portfolioPermission: f.portfolioPermission,
    continuity: f.continuity,
    charCount: numOrU(f.charCount),
    notes: f.notes,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildHighlightedHtml(
  text: string,
  risks: { word: string; severity: "high" | "medium" | "low" }[],
  positives: { word: string }[]
): string {
  let html = escapeHtml(text);
  // 長い語を先に置換して部分一致の取りこぼし／二重ラップを防ぐ
  const riskCls: Record<string, string> = {
    high: "risk-high",
    medium: "risk-mid",
    low: "risk-low",
  };
  const all: { word: string; cls: string }[] = [
    ...risks.map((r) => ({ word: r.word, cls: riskCls[r.severity] })),
    ...positives.map((p) => ({ word: p.word, cls: "positive" })),
  ].sort((a, b) => b.word.length - a.word.length);
  for (const { word, cls } of all) {
    const esc = escapeHtml(word);
    if (!esc) continue;
    // 既にmarkで囲まれた箇所を避けるため、mark外のテキストのみ置換
    const re = new RegExp(esc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    html = html
      .split(/(<mark[^>]*>.*?<\/mark>)/g)
      .map((seg) =>
        seg.startsWith("<mark")
          ? seg
          : seg.replace(re, `<mark class="${cls}">${esc}</mark>`)
      )
      .join("");
  }
  return html;
}

const SCORE_ROWS: {
  key: keyof ReturnType<typeof scoreJobRule>;
  label: string;
  kind: "score" | "risk" | "neutral";
}[] = [
  { key: "priority", label: "応募優先度", kind: "score" },
  { key: "profitability", label: "収益性", kind: "score" },
  { key: "portfolioValue", label: "実績化価値", kind: "score" },
  { key: "toolFit", label: "自作ツール適性", kind: "score" },
  { key: "continuity", label: "継続可能性", kind: "score" },
  { key: "geoReadiness", label: "GEO提案余地", kind: "score" },
  { key: "difficulty", label: "作業難易度", kind: "neutral" },
  { key: "risk", label: "地雷度", kind: "risk" },
];

export default function ScoutPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [claudeJson, setClaudeJson] = useState("");
  const [parseMsg, setParseMsg] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const analysisText = `${form.title}\n${form.description}`;
  const riskHits = useMemo(() => detectRiskWordsRule(analysisText), [analysisText]);
  const positives = useMemo(() => detectPositiveSignals(analysisText), [analysisText]);
  const scores = useMemo(() => scoreJobRule(toPartialJob(form)), [form]);
  const judge = useMemo(() => labelFromScores(scores), [scores]);
  const highlighted = useMemo(
    () => buildHighlightedHtml(form.description, riskHits, positives),
    [form.description, riskHits, positives]
  );

  function handleAutoParse() {
    if (!form.description.trim()) {
      setParseMsg("先に募集本文を貼り付けてください");
      return;
    }
    const p = parseJobText(form.description);
    setForm((prev) => ({
      ...prev,
      title: prev.title.trim() === "" && p.title ? p.title : prev.title,
      category: p.category,
      budgetType: p.budgetType,
      budget: p.budget ? String(p.budget) : prev.budget,
      deadline: p.deadline ?? prev.deadline,
      aiPolicy: p.aiPolicy,
      recruitCount: p.recruitCount != null ? String(p.recruitCount) : prev.recruitCount,
      applicantCount:
        p.applicantCount != null ? String(p.applicantCount) : prev.applicantCount,
    }));
    setParseMsg("本文から項目を推定しました。内容を確認してください。");
  }

  function handleClaudeJson() {
    const res = parseClaudeChromeOutput(claudeJson);
    if (!res.jobs.length) {
      setParseMsg(res.errors[0] ?? "JSONを解析できませんでした");
      return;
    }
    const j = res.jobs[0];
    setForm((prev) => ({
      ...prev,
      title: j.title ?? prev.title,
      platform: j.platform ?? prev.platform,
      url: j.url ?? prev.url,
      description: j.description ?? prev.description,
      budgetType: j.budgetType ?? prev.budgetType,
      budget: j.budget != null ? String(j.budget) : prev.budget,
      deadline: j.deadline ?? prev.deadline,
      applicantCount:
        j.applicantCount != null ? String(j.applicantCount) : prev.applicantCount,
      clientRating: j.clientRating != null ? String(j.clientRating) : prev.clientRating,
      clientOrderCount:
        j.clientOrderCount != null ? String(j.clientOrderCount) : prev.clientOrderCount,
      category: j.category ?? prev.category,
      aiPolicy: j.aiPolicy ?? prev.aiPolicy,
      portfolioPermission: j.portfolioPermission ?? prev.portfolioPermission,
      continuity: j.continuity ?? prev.continuity,
      notes: j.notes ?? prev.notes,
    }));
    setParseMsg(
      `Claude出力から自動入力しました。${
        res.errors.length ? "（" + res.errors.join(" ") + "）" : ""
      }`
    );
  }

  function buildSavePayload() {
    const partial = toPartialJob(form);
    return {
      ...partial,
      scores: scoreJobRule(partial),
      analysis: analyzeJob(partial),
      status: "saved" as const,
    };
  }

  function handleSave() {
    const job = actions.addJob(buildSavePayload());
    setSavedMsg(`「${job.title}」を保存しました。`);
    setForm(EMPTY_FORM);
    setClaudeJson("");
    setParseMsg(null);
  }

  function handleSaveAndAnalyze() {
    const job = actions.addJob(buildSavePayload());
    window.location.href = `/analyze?job=${job.id}`;
  }

  return (
    <>
      <PageHeader
        title="案件スカウト"
        desc="クラウドワークス・ランサーズで見つけたSEO案件を登録し、地雷ワード検出とスコアリングで応募判断の材料にします。"
      />

      {/* 自動入力ヘルパー */}
      <Card title="自動入力" desc="募集本文の貼り付け、または Claude in Chrome の出力JSONから一括入力できます。" className="mb-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <Field label="募集本文から自動推定" hint="下のフォームの「募集本文」に貼り付けてから実行します。">
              <Button variant="subtle" onClick={handleAutoParse}>
                本文から項目を自動推定
              </Button>
            </Field>
          </div>
          <div>
            <Field label="Claude in Chrome の JSON" hint="貼り付けたJSON（[]または{}）の先頭1件をフォームに反映します。">
              <Textarea
                value={claudeJson}
                onChange={(e) => setClaudeJson(e.target.value)}
                placeholder='[{"title":"...","platform":"クラウドワークス", ...}]'
                className="h-24 font-mono text-[12px]"
              />
            </Field>
            <Button variant="outline" className="mt-2" onClick={handleClaudeJson}>
              JSONから自動入力
            </Button>
          </div>
        </div>
        {parseMsg && (
          <p className="mt-3 rounded-lg border border-accent2/30 bg-accent2/10 px-3 py-2 text-xs text-accent2">
            {parseMsg}
          </p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 左：入力フォーム */}
        <Card title="案件情報" desc="募集ページの内容を入力・貼り付けします。">
          <div className="space-y-4">
            <Field label="案件タイトル">
              <Input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="例：SEO構成案の作成（継続あり）"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="媒体">
                <Select
                  value={form.platform}
                  onChange={(e) => set("platform", e.target.value as Platform)}
                >
                  {Object.entries(PLATFORM_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="案件URL">
                <Input
                  value={form.url}
                  onChange={(e) => set("url", e.target.value)}
                  placeholder="https://..."
                />
              </Field>
            </div>

            <Field label="募集本文" hint="募集ページの本文をそのまま貼り付けると、地雷ワード検出とスコアの精度が上がります。">
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="募集本文をここに貼り付け…"
                className="h-48"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="報酬形態">
                <Select
                  value={form.budgetType}
                  onChange={(e) => set("budgetType", e.target.value as BudgetType)}
                >
                  {Object.entries(BUDGET_TYPE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="予算（円）"
                hint={form.budgetType === "per_char" ? "文字単価の場合は1文字あたりの円" : undefined}
              >
                <Input
                  type="number"
                  value={form.budget}
                  onChange={(e) => set("budget", e.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="納期">
                <Input
                  value={form.deadline}
                  onChange={(e) => set("deadline", e.target.value)}
                  placeholder="例：2026/06/30"
                />
              </Field>
              <Field label="想定文字数">
                <Input
                  type="number"
                  value={form.charCount}
                  onChange={(e) => set("charCount", e.target.value)}
                  placeholder="例：6000"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="募集人数">
                <Input
                  type="number"
                  value={form.recruitCount}
                  onChange={(e) => set("recruitCount", e.target.value)}
                  placeholder="例：1"
                />
              </Field>
              <Field label="応募人数">
                <Input
                  type="number"
                  value={form.applicantCount}
                  onChange={(e) => set("applicantCount", e.target.value)}
                  placeholder="例：12"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="クライアント評価" hint="0〜5">
                <Input
                  type="number"
                  step="0.1"
                  value={form.clientRating}
                  onChange={(e) => set("clientRating", e.target.value)}
                  placeholder="例：4.8"
                />
              </Field>
              <Field label="クライアント発注実績数">
                <Input
                  type="number"
                  value={form.clientOrderCount}
                  onChange={(e) => set("clientOrderCount", e.target.value)}
                  placeholder="例：120"
                />
              </Field>
            </div>

            <Field label="案件タイプ">
              <Select
                value={form.category}
                onChange={(e) => set("category", e.target.value as Category)}
              >
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="AI使用可否">
                <Select
                  value={form.aiPolicy}
                  onChange={(e) => set("aiPolicy", e.target.value as AiPolicy)}
                >
                  <option value="allowed">使用可</option>
                  <option value="forbidden">使用不可</option>
                  <option value="unknown">不明</option>
                </Select>
              </Field>
              <Field label="実績公開">
                <Select
                  value={form.portfolioPermission}
                  onChange={(e) => set("portfolioPermission", e.target.value as Permission)}
                >
                  <option value="allowed">可</option>
                  <option value="forbidden">不可</option>
                  <option value="unknown">不明</option>
                </Select>
              </Field>
              <Field label="継続性">
                <Select
                  value={form.continuity}
                  onChange={(e) => set("continuity", e.target.value as Continuity)}
                >
                  <option value="yes">あり</option>
                  <option value="no">なし</option>
                  <option value="unknown">不明</option>
                </Select>
              </Field>
            </div>

            <Field label="メモ">
              <Textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="気づいた点・確認すべき条件など"
                className="h-20"
              />
            </Field>
          </div>
        </Card>

        {/* 右：ライブ解析 */}
        <div className="space-y-4">
          <Card title="地雷ワード / シグナル検出" desc="タイトル＋募集本文から自動検出します。">
            {riskHits.length === 0 && positives.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted">
                本文を入力すると、地雷ワードとポジティブシグナルを検出します。
              </p>
            ) : (
              <div className="space-y-4">
                {riskHits.length > 0 && (
                  <div>
                    <SectionTitle sub="クリックで理由を確認">地雷ワード</SectionTitle>
                    <div className="flex flex-wrap gap-1.5">
                      {riskHits.map((r) => (
                        <Badge
                          key={r.word}
                          title={r.reason}
                          className={cn(
                            r.severity === "high"
                              ? "border-danger/50 bg-danger/15 text-danger"
                              : r.severity === "medium"
                              ? "border-warn/50 bg-warn/15 text-warn"
                              : "border-border bg-white/5 text-muted"
                          )}
                        >
                          {r.word}
                        </Badge>
                      ))}
                    </div>
                    <ul className="mt-2 space-y-1">
                      {riskHits.map((r) => (
                        <li key={r.word} className="text-[11px] text-muted">
                          <span className="text-zinc-300">「{r.word}」</span> {r.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {positives.length > 0 && (
                  <div>
                    <SectionTitle>ポジティブシグナル</SectionTitle>
                    <div className="flex flex-wrap gap-1.5">
                      {positives.map((p) => (
                        <Badge
                          key={p.word}
                          title={p.reason}
                          className="border-good/50 bg-good/15 text-good"
                        >
                          {p.word}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {form.description.trim() !== "" && (
              <div className="mt-4">
                <SectionTitle sub="検出語をハイライト表示">本文プレビュー</SectionTitle>
                <div
                  className="prose-report max-h-64 overflow-auto rounded-lg border border-border bg-bg/40 p-3 text-[13px] leading-relaxed text-zinc-200"
                  dangerouslySetInnerHTML={{ __html: highlighted }}
                />
              </div>
            )}
          </Card>

          <Card title="スコアプレビュー" desc="入力内容に応じてリアルタイムで再計算されます。">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs text-muted">総合判定</span>
              <Badge className={labelColor(judge.label)}>{LABEL_TEXT[judge.label]}</Badge>
            </div>
            <div className="space-y-3">
              {SCORE_ROWS.map((row) => {
                const v = scores[row.key];
                const tone =
                  row.kind === "risk"
                    ? riskTone(v)
                    : row.kind === "neutral"
                    ? "neutral"
                    : scoreTone(v);
                return (
                  <div key={row.key}>
                    <div className="mb-1 flex justify-between text-[11px]">
                      <span className="text-zinc-300">{row.label}</span>
                      <span className="tabular-nums text-muted">{v}</span>
                    </div>
                    <ScoreBar value={v} tone={tone} />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* フッター操作 */}
      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted">
            {savedMsg ? (
              <span className="text-good">{savedMsg}</span>
            ) : (
              <span>
                予算 {yen(form.budget.trim() === "" ? 0 : Number(form.budget))} ／ 判定{" "}
                {LABEL_TEXT[judge.label]}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSave}>
              この案件を保存
            </Button>
            <Button onClick={handleSaveAndAnalyze}>保存して解析する</Button>
          </div>
        </div>
      </Card>
    </>
  );
}
