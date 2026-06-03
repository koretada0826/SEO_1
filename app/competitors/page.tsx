"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Card,
  Button,
  Badge,
  Field,
  Input,
  Textarea,
  PageHeader,
  SectionTitle,
  CopyButton,
  EmptyState,
} from "@/components/ui";
import { analyzeCompetitors } from "@/lib/mockAI";
import type { CompetitorAnalysis } from "@/lib/types";

function priorityBadge(p: "A" | "B" | "C") {
  if (p === "A") return "text-danger border-danger/50 bg-danger/15";
  if (p === "B") return "text-warn border-warn/50 bg-warn/15";
  return "text-muted border-border bg-white/5";
}

function buildSummary(kw: string, a: CompetitorAnalysis): string {
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

export default function CompetitorsPage() {
  const [keyword, setKeyword] = useState("");
  const [ownBody, setOwnBody] = useState("");
  const [u1, setU1] = useState("");
  const [u2, setU2] = useState("");
  const [u3, setU3] = useState("");
  const [result, setResult] = useState<CompetitorAnalysis | null>(null);

  function run() {
    const res = analyzeCompetitors({
      keyword,
      competitorUrls: [u1, u2, u3].filter(Boolean),
    });
    setResult(res);
  }

  return (
    <>
      <PageHeader
        title="競合分析"
        desc="上位競合の共通見出しと差分を構造化し、そのまま構成案・リライトに渡せる『競合差分レポート』を作成します。"
        right={result ? <CopyButton text={buildSummary(keyword, result)} label="分析結果をコピー" /> : undefined}
      />

      <Card title="分析対象の入力" desc="狙うキーワードと競合URLを入力して差分を抽出します。">
        <div className="grid gap-4">
          <Field label="狙うキーワード" hint="必須。検索意図の中心となるキーワード">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="例：ふるさと納税 やり方"
            />
          </Field>
          <Field label="自社記事URLまたは本文" hint="既存記事がある場合に貼り付け（任意）">
            <Textarea
              rows={4}
              value={ownBody}
              onChange={(e) => setOwnBody(e.target.value)}
              placeholder="自社記事のURL、または本文をそのまま貼り付け"
            />
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
            <Button onClick={run} disabled={!keyword.trim()}>
              競合差分を分析する
            </Button>
            {!keyword.trim() && (
              <span className="text-[11px] text-muted">キーワードを入力すると実行できます</span>
            )}
          </div>
        </div>
      </Card>

      {!result ? (
        <div className="mt-6">
          <EmptyState
            title="まだ分析していません"
            desc="キーワードと競合URLを入力して「競合差分を分析する」を押すと、共通見出し・不足情報・独自切り口・FAQ差分などが表示されます。"
          />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="競合共通見出し" desc="上位が揃って扱っている＝最低限カバーすべき見出し">
              <div className="flex flex-wrap gap-2">
                {result.commonHeadings.map((h) => (
                  <Badge key={h} className="border-border bg-white/5 text-zinc-200">
                    {h}
                  </Badge>
                ))}
              </div>
            </Card>

            <Card title="自社が勝てる独自切り口" desc="競合が触れていない、差別化につながる角度">
              <ul className="space-y-2">
                {result.uniqueAngles.map((a) => (
                  <li
                    key={a}
                    className="flex items-start gap-2 rounded-lg border border-good/30 bg-good/10 px-3 py-2 text-[13px] text-zinc-100"
                  >
                    <span className="mt-0.5 text-good">◎</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card title="比較テーブルにすべき項目" desc="意思決定を助ける比較軸。自社／競合で埋めて差を可視化します。">
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-white/5 text-zinc-200">
                    <th className="border-b border-border px-3 py-2 text-left font-semibold">
                      項目
                    </th>
                    {result.comparisonTable.map((c) => (
                      <th
                        key={c}
                        className="border-b border-l border-border px-3 py-2 text-left font-semibold"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {["自社（記入例）", "競合A（記入例）"].map((label, ri) => (
                    <tr key={label} className={ri % 2 ? "bg-bg/30" : ""}>
                      <td className="border-b border-border px-3 py-2 font-medium text-zinc-100">
                        {label}
                      </td>
                      {result.comparisonTable.map((c) => (
                        <td
                          key={c}
                          className="border-b border-l border-border px-3 py-2 text-muted"
                        >
                          —
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-muted">
              ※ この比較軸をそのまま記事内の比較表として実装すると、AI検索にも拾われやすくなります。
            </p>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="自社に不足している情報" desc="競合にあって自社にない＝最優先で補うべき情報">
              <ol className="space-y-2">
                {result.missingTopics.map((t, i) => (
                  <li
                    key={t}
                    className="flex items-start gap-3 rounded-lg border border-border bg-bg/40 px-3 py-2 text-[13px] text-zinc-100"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent/20 text-[11px] font-semibold text-accent">
                      {i + 1}
                    </span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
            </Card>

            <Card title="FAQ差分" desc="読者が検索しているのに競合が答えきれていない質問">
              <ul className="space-y-2">
                {result.faqGaps.map((q) => (
                  <li
                    key={q}
                    className="flex items-start gap-2 rounded-lg border border-border bg-bg/40 px-3 py-2 text-[13px] text-zinc-100"
                  >
                    <span className="mt-0.5 text-accent2">Q.</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card title="追加すべきセクション" desc="優先度つきで提示。A=必須 / B=推奨 / C=余力があれば">
            <div className="grid gap-3 sm:grid-cols-2">
              {result.suggestedSections.map((s) => (
                <div
                  key={s.title}
                  className="rounded-lg border border-border bg-bg/40 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-zinc-100">{s.title}</span>
                    <Badge className={priorityBadge(s.priority)}>優先度{s.priority}</Badge>
                  </div>
                  <p className="mt-1.5 text-xs text-muted">{s.why}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="E-E-A-T補強ポイント" desc="経験・専門性・権威性・信頼性を示すために加える要素">
            <div className="flex flex-wrap gap-2">
              {result.eeatPoints.map((p) => (
                <Badge key={p} className="border-accent2/40 bg-accent2/10 text-accent2">
                  {p}
                </Badge>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <SectionTitle sub="この差分をもとに構成案を作成し、見出し・FAQ・比較表に落とし込みます。">
                  次のステップ
                </SectionTitle>
              </div>
              <div className="flex items-center gap-2">
                <CopyButton text={buildSummary(keyword, result)} label="差分をコピー" />
                <Link
                  href={`/workspace${keyword ? `?kw=${encodeURIComponent(keyword)}` : ""}`}
                >
                  <Button>この差分を構成案に反映</Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
