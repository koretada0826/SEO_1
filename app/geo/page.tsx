"use client";
import { useState } from "react";
import {
  Card,
  Button,
  Badge,
  ScoreRing,
  PageHeader,
  SectionTitle,
  CopyButton,
  cn,
} from "@/components/ui";
import { GEO_CHECK_AREAS, generateGeoSuggestions, geoScore } from "@/lib/mockAI";
import type { GeoSuggestion } from "@/lib/types";

function scoreLabel(n: number): { text: string; tone: "good" | "warn" | "danger" } {
  if (n >= 71) return { text: "良好：AI検索にも拾われやすい設計です", tone: "good" };
  if (n >= 41) return { text: "あと一歩：いくつか補強すれば付加価値を訴求できます", tone: "warn" };
  return { text: "要改善：まずは結論ファースト・FAQ・短文回答を整えましょう", tone: "danger" };
}

const CITATION_EXAMPLES = [
  {
    kind: "結論ファースト",
    text: "結論として、初心者はまず少額の積立から始めるのが安全です。理由は、価格変動リスクを抑えながら投資に慣れられるためです。",
  },
  {
    kind: "定義文",
    text: "NISAとは、一定額までの投資で得た利益が非課税になる制度です。対象は株式・投資信託などで、長期の資産形成に向いています。",
  },
  {
    kind: "手順",
    text: "始め方は3ステップです。(1)証券口座を開設する (2)NISA口座を申請する (3)積立する銘柄と金額を設定する。",
  },
];

function buildSummary(suggestions: GeoSuggestion[], score: number): string {
  const L: string[] = [];
  L.push(`# GEO対応チェック結果（GEOスコア: ${score}/100）`);
  L.push("");
  const done = suggestions.filter((s) => s.present);
  const todo = suggestions.filter((s) => !s.present);
  L.push(`## 対応済み（${done.length}件）`);
  done.forEach((s) => L.push(`- [x] ${s.area}`));
  L.push("");
  L.push(`## 追加すべき項目（${todo.length}件）`);
  todo.forEach((s) => L.push(`- [ ] ${s.area} → ${s.suggestion}`));
  return L.join("\n");
}

export default function GeoPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [suggestions, setSuggestions] = useState<GeoSuggestion[] | null>(null);

  const score = geoScore(checked);
  const sl = scoreLabel(score);

  function toggle(area: string) {
    setChecked((prev) => ({ ...prev, [area]: !prev[area] }));
  }

  function run() {
    setSuggestions(generateGeoSuggestions(checked));
  }

  const done = suggestions?.filter((s) => s.present) ?? [];
  const todo = suggestions?.filter((s) => !s.present) ?? [];

  return (
    <>
      <PageHeader
        title="GEO対応チェック"
        desc="GEOはSEOの代替ではなく、SEO納品物の付加価値。『通常のSEO構成に加えてAI検索にも拾われやすい設計にできる』と説明できる状態を作ります。"
        right={
          suggestions ? (
            <CopyButton text={buildSummary(suggestions, score)} label="GEO対応ポイントをコピー" />
          ) : undefined
        }
      />

      <Card title="GEO / LLMO とは" desc="付加価値としての位置づけ">
        <div className="space-y-2 text-[13px] leading-relaxed text-zinc-200">
          <p>
            GEO（Generative Engine Optimization）/ LLMO は、ChatGPTやGoogle
            AI概要などの生成AI検索に引用・参照されやすくするための最適化です。
          </p>
          <p>
            通常のSEO（検索順位を狙う設計）を土台にしつつ、結論ファースト・短文回答ブロック・FAQ・比較表・定義文を整えることで、
            <span className="text-accent2">「同じ記事をAI検索にも拾われやすくできる」</span>
            という上乗せ価値として提案できます。納品物の差別化ポイントになります。
          </p>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="GEO対応チェックリスト" desc="該当する項目にチェック" className="lg:col-span-2">
          <div className="grid gap-2 sm:grid-cols-2">
            {GEO_CHECK_AREAS.map((area) => {
              const on = !!checked[area];
              return (
                <button
                  key={area}
                  type="button"
                  onClick={() => toggle(area)}
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
            <Button onClick={run}>GEO対応ポイントを追加する</Button>
          </div>
        </Card>

        <Card title="GEOスコア" desc="チェック状況からリアルタイム算出">
          <div className="flex flex-col items-center gap-3 py-2">
            <ScoreRing value={score} size={120} tone={sl.tone} />
            <Badge
              className={cn(
                sl.tone === "good"
                  ? "border-good/50 bg-good/15 text-good"
                  : sl.tone === "warn"
                  ? "border-warn/50 bg-warn/15 text-warn"
                  : "border-danger/50 bg-danger/15 text-danger"
              )}
            >
              {score <= 40 ? "要改善" : score <= 70 ? "あと一歩" : "良好"}
            </Badge>
            <p className="text-center text-xs text-muted">{sl.text}</p>
          </div>
        </Card>
      </div>

      {suggestions && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card title="対応済み" desc={`${done.length}件 — 引用されやすい表現にさらに磨き込みましょう`}>
            {done.length ? (
              <ul className="space-y-1.5">
                {done.map((s) => (
                  <li
                    key={s.area}
                    className="flex items-start gap-2 rounded-lg border border-good/30 bg-good/10 px-3 py-2 text-[13px] text-zinc-100"
                  >
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
                  <li
                    key={s.area}
                    className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2"
                  >
                    <p className="text-[13px] font-medium text-zinc-100">{s.area}</p>
                    <p className="mt-0.5 text-xs text-warn">→ {s.suggestion}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-center text-xs text-muted">
                すべて対応済みです。素晴らしい設計です。
              </p>
            )}
          </Card>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="AI検索向け要約文" desc="各h2直下に置く40〜100字の短文回答テンプレート">
          <div className="rounded-lg border border-border bg-bg/40 px-3 py-2.5">
            <p className="text-[11px] text-muted">テンプレート</p>
            <p className="mt-1 text-[13px] leading-relaxed text-zinc-100">
              「{"{"}テーマ{"}"}とは、{"{"}定義を1文{"}"}です。要点は{"{"}数{"}"}つで、
              {"{"}結論{"}"}。」
            </p>
            <p className="mt-2 text-[11px] text-muted">記入例</p>
            <p className="mt-1 text-[13px] leading-relaxed text-zinc-100">
              「iDeCoとは、自分で積み立てる私的年金制度です。掛金が全額所得控除になり、60歳以降に受け取れます。長期の老後資金づくりに向いています。」
            </p>
          </div>
        </Card>

        <Card title="引用されやすい文章例" desc="結論ファースト／定義文／手順の3パターン">
          <ul className="space-y-2">
            {CITATION_EXAMPLES.map((ex) => (
              <li key={ex.kind} className="rounded-lg border border-border bg-bg/40 px-3 py-2">
                <Badge className="border-accent2/40 bg-accent2/10 text-accent2">{ex.kind}</Badge>
                <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-100">{ex.text}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4">
        <Card title="追加すべきFAQ・回答ブロック・比較表" desc="納品時にそのまま提案できるGEO補強要素">
          <ul className="space-y-2 text-[13px] text-zinc-200">
            {[
              "読者の検索質問をそのままFAQ化し、各回答を40〜100字の短文で直接答える（AI引用を狙う）",
              "各h2の直下に『結論→理由→補足』の順で短い回答ブロックを置く",
              "選択肢を3〜5項目で比較する表を追加し、項目名を明確にする（料金/対象者/メリット 等）",
              "用語は冒頭で1〜2文の定義を提示し、定義文だけで意味が伝わるようにする",
              "手順は番号付きリストに分解し、1ステップ1動作で記述する",
            ].map((t, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
