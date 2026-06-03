"use client";
import { useState } from "react";
import {
  Card,
  Button,
  Badge,
  Field,
  Input,
  Textarea,
  Select,
  ScoreRing,
  PageHeader,
  SectionTitle,
  CopyButton,
  EmptyState,
  cn,
} from "@/components/ui";
import { diagnoseRewrite } from "@/lib/mockAI";
import { scoreTone } from "@/lib/labels";
import type { RewriteDiagnosis, OutlineNode } from "@/lib/types";

const GOALS = [
  "順位改善",
  "CV改善",
  "滞在時間改善",
  "古い情報の更新",
  "AIっぽさの除去",
] as const;

function priorityBadge(p: "A" | "B" | "C") {
  if (p === "A") return "text-danger border-danger/50 bg-danger/15";
  if (p === "B") return "text-warn border-warn/50 bg-warn/15";
  return "text-muted border-border bg-white/5";
}

function indentForLevel(level: OutlineNode["level"]): string {
  if (level === "h2") return "pl-4";
  if (level === "h3") return "pl-8";
  return "pl-0";
}

function buildSummary(kw: string, goal: string, d: RewriteDiagnosis): string {
  const L: string[] = [];
  L.push(`# リライト診断レポート`);
  L.push(`- 対象キーワード: ${kw || "（未入力）"}`);
  L.push(`- 目標: ${goal}`);
  L.push(`- 現状スコア: ${d.currentScore}/100`);
  L.push("");
  L.push(`## タイトル改善案\n- ${d.titleFix}`);
  L.push(`## 導入文改善案\n- ${d.leadFix}`);
  L.push(`## 見出し改善\n- ${d.headingFixes.join("\n- ")}`);
  L.push(`## 不足情報\n- ${d.missingInfo.join("\n- ")}`);
  L.push(`## 古い情報の可能性\n- ${d.outdated.join("\n- ")}`);
  L.push(`## 読みにくい箇所\n- ${d.hardToRead.join("\n- ")}`);
  L.push(`## 冗長表現\n- ${d.redundant.join("\n- ")}`);
  L.push(`## AIっぽい表現\n- ${d.aiLikePhrases.join("\n- ")}`);
  L.push(`## 専門性不足\n- ${d.expertiseGaps.join("\n- ")}`);
  L.push(`## CTA改善\n- ${d.ctaFix}`);
  L.push(`## FAQ追加案\n- ${d.faqAdds.join("\n- ")}`);
  L.push("");
  L.push(`## リライト後の構成案`);
  for (const n of d.newOutline) {
    const prefix = n.level === "h1" ? "# " : n.level === "h2" ? "## " : "### ";
    L.push(`${prefix}${n.text}（${n.role} / 約${n.charBudget}字）`);
    L.push(`  - ${n.content}`);
  }
  L.push("");
  L.push(`## 修正優先度`);
  d.priorities.forEach((p) => L.push(`- [${p.priority}] ${p.item}`));
  return L.join("\n");
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

function FixCard({ title, desc, text }: { title: string; desc?: string; text: string }) {
  return (
    <Card title={title} desc={desc}>
      <p className="rounded-lg border border-border bg-bg/40 px-3 py-2.5 text-[13px] leading-relaxed text-zinc-100">
        {text}
      </p>
    </Card>
  );
}

export default function RewritePage() {
  const [existingBody, setExistingBody] = useState("");
  const [existingUrl, setExistingUrl] = useState("");
  const [keyword, setKeyword] = useState("");
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [issue, setIssue] = useState("");
  const [goal, setGoal] = useState<string>(GOALS[0]);
  const [result, setResult] = useState<RewriteDiagnosis | null>(null);
  const [usedGoal, setUsedGoal] = useState<string>(GOALS[0]);
  const [usedKeyword, setUsedKeyword] = useState("");

  function run() {
    const res = diagnoseRewrite({ keyword, body: existingBody, goal });
    setResult(res);
    setUsedGoal(goal);
    setUsedKeyword(keyword);
  }

  return (
    <>
      <PageHeader
        title="リライト診断"
        desc="既存記事の検索意図とのズレ・不足情報・古い情報・冗長表現を洗い出し、そのまま渡せる『改善診断レポート』を生成します。"
        right={
          result ? (
            <CopyButton text={buildSummary(usedKeyword, usedGoal, result)} label="診断レポートをコピー" />
          ) : undefined
        }
      />

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
            <Field label="既存記事URL">
              <Input
                value={existingUrl}
                onChange={(e) => setExistingUrl(e.target.value)}
                placeholder="https://…"
              />
            </Field>
            <Field label="狙うキーワード" hint="診断の基準となるキーワード">
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="例：投資信託 初心者"
              />
            </Field>
            <Field label="競合URL">
              <Input
                value={competitorUrl}
                onChange={(e) => setCompetitorUrl(e.target.value)}
                placeholder="https://…（比較対象の上位記事）"
              />
            </Field>
            <Field label="目標">
              <Select value={goal} onChange={(e) => setGoal(e.target.value)}>
                {GOALS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="現在の課題" hint="把握している問題があれば記入（任意）">
            <Textarea
              rows={3}
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              placeholder="例：公開から2年経過し順位が落ちている、CVにつながっていない など"
            />
          </Field>
          <div>
            <Button onClick={run}>リライト診断を実行する</Button>
          </div>
        </div>
      </Card>

      {!result ? (
        <div className="mt-6">
          <EmptyState
            title="まだ診断していません"
            desc="本文とキーワード・目標を入力して「リライト診断を実行する」を押すと、現状評価と改善項目、リライト後の構成案が表示されます。"
          />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <Card title="現状評価" desc="現行記事のSEO/GEO観点での総合スコア">
            <div className="flex items-center gap-5">
              <ScoreRing
                value={result.currentScore}
                size={96}
                tone={scoreTone(result.currentScore)}
              />
              <div className="text-[13px] text-muted">
                <p>
                  目標「<span className="text-zinc-200">{usedGoal}</span>」に向けて、下記の改善項目を優先度順に対応してください。
                </p>
                <p className="mt-1">スコアは結論ファースト・FAQ・比較表・E-E-A-T要素の有無から算出しています。</p>
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
              {result.newOutline.map((n, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-lg border border-border bg-bg/40 px-3 py-2",
                    indentForLevel(n.level)
                  )}
                >
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
                      <span className="ml-auto text-[11px] tabular-nums text-muted">
                        約{n.charBudget}字
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted">{n.content}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="修正優先度" desc="A=最優先 / B=推奨 / C=余力があれば">
            <div className="space-y-2">
              {result.priorities.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-border bg-bg/40 px-3 py-2"
                >
                  <Badge className={priorityBadge(p.priority)}>優先度{p.priority}</Badge>
                  <span className="text-[13px] text-zinc-100">{p.item}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
