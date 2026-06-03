"use client";
import { useMemo, useState } from "react";
import { useDB } from "@/lib/store";
import { JobPicker } from "@/components/JobPicker";
import {
  Card,
  PageHeader,
  Field,
  Select,
  Button,
  CopyButton,
  EmptyState,
  Badge,
  cn,
} from "@/components/ui";
import {
  formatForMarkdown,
  formatForGoogleDocs,
  formatForPdf,
  formatForSheets,
} from "@/lib/mockAI";
import {
  exportReportToGoogleDocs,
  exportReportToPDF,
  type GasResult,
} from "@/lib/google";
import Link from "next/link";

const TEMPLATES = [
  "SEO構成案レポート",
  "リライト改善レポート",
  "競合分析レポート",
  "GEO対応レポート",
  "WordPress入稿前SEOチェックレポート",
  "提案文作成レポート",
] as const;

const FORMATS = [
  "Markdown",
  "Google Docs用",
  "PDF用",
  "Google Sheets用",
  "WordPress入稿用",
] as const;

export default function ReportsPage() {
  const db = useDB();
  const [jobId, setJobId] = useState("");
  const [deliverableId, setDeliverableId] = useState("");
  const [template, setTemplate] = useState<string>(TEMPLATES[0]);
  const [format, setFormat] = useState<string>(FORMATS[0]);
  const [generated, setGenerated] = useState(false);
  const [banner, setBanner] = useState<GasResult | null>(null);
  const [busy, setBusy] = useState<"" | "docs" | "pdf">("");

  const job = db.jobs.find((j) => j.id === jobId);
  const jobDeliverables = useMemo(
    () => db.deliverables.filter((d) => d.jobId === jobId),
    [db.deliverables, jobId]
  );
  const deliverable =
    jobDeliverables.find((d) => d.id === deliverableId) ?? jobDeliverables[0];

  const reportTitle = job
    ? `${template}：${job.title}`
    : template;

  const markdown = useMemo(() => {
    if (!job || !deliverable) return "";
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

  const sheetsRows = useMemo(
    () => (job ? formatForSheets(job) : []),
    [job]
  );

  const transformed = useMemo(() => {
    if (!markdown) return "";
    switch (format) {
      case "Google Docs用":
        return formatForGoogleDocs(markdown);
      case "PDF用":
        return formatForPdf(markdown);
      case "Markdown":
      case "WordPress入稿用":
      default:
        return markdown;
    }
  }, [markdown, format]);

  const isSheets = format === "Google Sheets用";
  const copyText = isSheets
    ? sheetsRows.map((r) => r.join("\t")).join("\n")
    : transformed;

  async function handleExport(kind: "docs" | "pdf") {
    if (!job || !deliverable) return;
    setBusy(kind);
    setBanner(null);
    const body = isSheets ? copyText : transformed;
    const res =
      kind === "docs"
        ? await exportReportToGoogleDocs(reportTitle, body)
        : await exportReportToPDF(reportTitle, body);
    setBanner(res);
    setBusy("");
  }

  return (
    <>
      <PageHeader
        title="レポート出力"
        desc="ワークスペースで作成した納品物を、クライアントにそのまま渡せる形式（Markdown / Google Docs / PDF / Sheets / WordPress入稿用）に整形して出力します。"
      />

      <Card title="出力設定" desc="案件と納品物を選び、テンプレート・出力形式を指定してください。">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="案件">
            <JobPicker
              value={jobId}
              onChange={(id) => {
                setJobId(id);
                setDeliverableId("");
                setGenerated(false);
                setBanner(null);
              }}
            />
          </Field>

          <Field
            label="納品物"
            hint={
              job && jobDeliverables.length === 0
                ? "納品物はワークスペースで作成してください"
                : undefined
            }
          >
            <Select
              value={deliverable?.id ?? ""}
              disabled={!job || jobDeliverables.length === 0}
              onChange={(e) => {
                setDeliverableId(e.target.value);
                setGenerated(false);
              }}
            >
              {jobDeliverables.length === 0 ? (
                <option value="">選択した案件の最新納品物</option>
              ) : (
                jobDeliverables.map((d) => (
                  <option key={d.id} value={d.id}>
                    {(d.type || "納品物") + "｜" + d.keyword}
                  </option>
                ))
              )}
            </Select>
          </Field>

          <Field label="テンプレート">
            <Select
              value={template}
              onChange={(e) => {
                setTemplate(e.target.value);
                setGenerated(false);
              }}
            >
              {TEMPLATES.map((t) => (
                <option key={t} value={t}>
                  {t}
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
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            disabled={!job || !deliverable}
            onClick={() => {
              setGenerated(true);
              setBanner(null);
            }}
          >
            レポートを生成する
          </Button>
          {job && deliverable && (
            <Badge className="border-border bg-white/5 text-muted">
              対象: {deliverable.keyword}
            </Badge>
          )}
        </div>
      </Card>

      <div className="mt-6">
        {!job ? (
          <EmptyState
            title="案件を選択してください"
            desc="出力する納品物が含まれる案件を上で選んでください。"
          />
        ) : !deliverable ? (
          <EmptyState
            title="この案件には納品物がありません"
            desc="まずワークスペースでSEO構成案・リライト診断・競合分析などの納品物を作成してください。"
            action={
              <Link href="/workspace">
                <Button>ワークスペースで作成する</Button>
              </Link>
            }
          />
        ) : !generated ? (
          <EmptyState
            title="プレビュー待ち"
            desc="「レポートを生成する」を押すと、選択した形式で整形結果が表示されます。"
          />
        ) : (
          <Card
            title={`プレビュー（${format}）`}
            desc={reportTitle}
            right={<CopyButton text={copyText} label="本文をコピー" />}
          >
            {banner && (
              <div
                className={cn(
                  "mb-4 rounded-lg border px-3 py-2 text-xs",
                  banner.ok
                    ? "border-good/40 bg-good/10 text-good"
                    : "border-danger/40 bg-danger/10 text-danger"
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
                        <th
                          key={i}
                          className="border-b border-border px-3 py-2 text-left text-xs font-semibold text-zinc-200"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sheetsRows.slice(1).map((row, ri) => (
                      <tr key={ri} className="odd:bg-white/[0.02]">
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            className="border-b border-border px-3 py-2 text-zinc-300 tabular-nums"
                          >
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
              <Button
                variant="subtle"
                disabled={busy !== ""}
                onClick={() => handleExport("docs")}
              >
                {busy === "docs" ? "出力中…" : "Google Docsへ出力"}
              </Button>
              <Button
                variant="outline"
                disabled={busy !== ""}
                onClick={() => handleExport("pdf")}
              >
                {busy === "pdf" ? "出力中…" : "PDFを出力"}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
