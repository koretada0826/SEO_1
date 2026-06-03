"use client";
import { useState } from "react";
import { useDB } from "@/lib/store";
import {
  Card,
  PageHeader,
  Button,
  Badge,
  cn,
} from "@/components/ui";
import {
  GAS_WEBAPP_URL,
  saveJobToSheet,
  saveProposalToSheet,
  saveDeliverableToSheet,
  exportReportToGoogleDocs,
  exportReportToPDF,
  createGmailDraft,
  updateJobStatus,
  type GasResult,
} from "@/lib/google";

export default function GooglePage() {
  const db = useDB();
  const settings = db.settings;
  const connected = !!GAS_WEBAPP_URL;

  const firstJob = db.jobs[0];
  const firstProposal = db.proposals[0];
  const firstDeliverable = db.deliverables[0];

  const [status, setStatus] = useState<Record<string, GasResult>>({});
  const [banner, setBanner] = useState<GasResult | null>(null);
  const [busy, setBusy] = useState("");

  async function run(key: string, fn: () => Promise<GasResult>) {
    setBusy(key);
    const res = await fn();
    setStatus((s) => ({ ...s, [key]: res }));
    setBanner(res);
    setBusy("");
  }

  const integrations: {
    key: string;
    name: string;
    desc: string;
    disabled?: boolean;
    note?: string;
    fn: () => Promise<GasResult>;
  }[] = [
    {
      key: "saveJob",
      name: "saveJobToSheet",
      desc: "案件1件をGoogle Sheetsの案件一覧に追記します。",
      disabled: !firstJob,
      note: firstJob ? undefined : "案件がありません",
      fn: () => saveJobToSheet(firstJob!),
    },
    {
      key: "saveProposal",
      name: "saveProposalToSheet",
      desc: "提案文1件をSheetsに保存します。",
      disabled: !firstProposal,
      note: firstProposal ? undefined : "提案文がありません",
      fn: () => saveProposalToSheet(firstProposal!),
    },
    {
      key: "saveDeliverable",
      name: "saveDeliverableToSheet",
      desc: "納品物1件をSheetsに保存します。",
      disabled: !firstDeliverable,
      note: firstDeliverable ? undefined : "納品物がありません",
      fn: () => saveDeliverableToSheet(firstDeliverable!),
    },
    {
      key: "docs",
      name: "exportReportToGoogleDocs",
      desc: "レポート本文をGoogle Docsとして出力します。",
      fn: () => exportReportToGoogleDocs("テスト", "本文"),
    },
    {
      key: "pdf",
      name: "exportReportToPDF",
      desc: "レポート本文をPDFとして出力します。",
      fn: () => exportReportToPDF("テスト", "本文"),
    },
    {
      key: "gmail",
      name: "createGmailDraft",
      desc: "提案文をGmailの下書きとして作成します。",
      fn: () => createGmailDraft("", "提案文", "本文"),
    },
    {
      key: "updateStatus",
      name: "updateJobStatus",
      desc: "Sheets側の案件ステータスを更新します。",
      disabled: !firstJob,
      note: firstJob ? undefined : "案件がありません",
      fn: () => updateJobStatus(firstJob!.id, "applied"),
    },
  ];

  async function syncAll(
    key: string,
    items: unknown[],
    fn: (x: never) => Promise<GasResult>,
    label: string
  ) {
    if (items.length === 0) {
      const res: GasResult = {
        ok: false,
        mock: true,
        message: `${label}が0件のため送信するデータがありません。`,
        at: new Date().toISOString(),
      };
      setStatus((s) => ({ ...s, [key]: res }));
      setBanner(res);
      return;
    }
    setBusy(key);
    let success = 0;
    for (const it of items) {
      const r = await fn(it as never);
      if (r.ok) success++;
    }
    const res: GasResult = {
      ok: true,
      mock: true,
      message: `【モック】${label} ${success}/${items.length}件を送信しました（実際の送信はしていません）。`,
      at: new Date().toISOString(),
    };
    setStatus((s) => ({ ...s, [key]: res }));
    setBanner(res);
    setBusy("");
  }

  return (
    <>
      <PageHeader
        title="Google連携"
        desc="MVPではすべてモック動作です。後からGAS Web App / Google APIに接続できるよう、関数のインターフェースを固定した設計になっています。"
      />

      {banner && (
        <div
          className={cn(
            "mb-4 rounded-lg border px-3 py-2 text-xs",
            banner.ok
              ? "border-good/40 bg-good/10 text-good"
              : "border-warn/40 bg-warn/10 text-warn"
          )}
        >
          {banner.message}
        </div>
      )}

      <Card title="接続ステータス" className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge
            className={
              connected
                ? "border-good/40 bg-good/10 text-good"
                : "border-warn/40 bg-warn/10 text-warn"
            }
          >
            {connected ? "接続済み" : "未接続 / モック動作中"}
          </Badge>
          <Badge className="border-border bg-white/5 text-muted">
            GAS_WEBAPP_URL: {GAS_WEBAPP_URL || "（未設定）"}
          </Badge>
          <Badge className="border-border bg-white/5 text-muted">
            settings.googleConnected: {settings.googleConnected ? "ON" : "OFF"}
          </Badge>
        </div>
        <p className="mt-3 text-xs text-muted">
          実際に接続するには、<code className="text-accent2">lib/google.ts</code> の{" "}
          <code className="text-accent2">GAS_WEBAPP_URL</code> にGAS Web AppのURLを設定してください。
          URLが空の間は、各関数はログ出力のみのモックとして動作し、課金・送信は一切発生しません。
        </p>
      </Card>

      <Card
        title="連携関数"
        desc="各関数を「テスト送信」で実行できます。現在はモックのため実際の送信はされません。"
        className="mb-6"
      >
        <div className="space-y-2">
          {integrations.map((it) => {
            const r = status[it.key];
            return (
              <div
                key={it.key}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-bg/40 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <code className="text-[13px] font-medium text-zinc-100">
                    {it.name}
                  </code>
                  <p className="mt-0.5 text-xs text-muted">{it.desc}</p>
                  {r && (
                    <p
                      className={cn(
                        "mt-1 text-[11px]",
                        r.ok ? "text-good" : "text-warn"
                      )}
                    >
                      {r.message}
                    </p>
                  )}
                </div>
                {it.disabled && it.note && (
                  <span className="text-[11px] text-muted">{it.note}</span>
                )}
                <Button
                  variant="outline"
                  className="px-3 py-1.5 text-xs"
                  disabled={it.disabled || busy === it.key}
                  onClick={() => run(it.key, it.fn)}
                >
                  {busy === it.key ? "実行中…" : "テスト送信"}
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      <Card
        title="Sheetsへの一括保存"
        desc="ローカルのデータをまとめてSheetsに保存します（モックのため実際には送信されません）。"
        className="mb-6"
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant="subtle"
            disabled={busy === "allJobs"}
            onClick={() =>
              syncAll("allJobs", db.jobs, (j) => saveJobToSheet(j), "案件")
            }
          >
            案件一覧をSheetsに保存（{db.jobs.length}件）
          </Button>
          <Button
            variant="subtle"
            disabled={busy === "allProposals"}
            onClick={() =>
              syncAll(
                "allProposals",
                db.proposals,
                (p) => saveProposalToSheet(p),
                "提案文"
              )
            }
          >
            提案文をSheetsに保存（{db.proposals.length}件）
          </Button>
          <Button
            variant="subtle"
            disabled={busy === "allDeliverables"}
            onClick={() =>
              syncAll(
                "allDeliverables",
                db.deliverables,
                (d) => saveDeliverableToSheet(d),
                "納品物"
              )
            }
          >
            納品物をSheetsに保存（{db.deliverables.length}件）
          </Button>
        </div>
        <div className="mt-3 space-y-1">
          {(["allJobs", "allProposals", "allDeliverables"] as const).map((k) =>
            status[k] ? (
              <p key={k} className="text-[11px] text-good">
                {status[k].message}
              </p>
            ) : null
          )}
        </div>
      </Card>

      <Card title="今後の連携ロードマップ">
        <ul className="space-y-2 text-xs text-zinc-300">
          <li>
            <Badge className="border-accent/40 bg-accent/10 text-accent">
              Google Sheets
            </Badge>{" "}
            案件一覧・提案文・納品物の自動バックアップと、スプレッドシート上でのステータス管理。
          </li>
          <li>
            <Badge className="border-accent/40 bg-accent/10 text-accent">
              Google Docs
            </Badge>{" "}
            納品レポートをそのままDocsとして共有・クライアント納品。
          </li>
          <li>
            <Badge className="border-accent/40 bg-accent/10 text-accent">PDF</Badge>{" "}
            Docs経由でのPDFエクスポート（請求書・提案書の整形出力）。
          </li>
          <li>
            <Badge className="border-accent/40 bg-accent/10 text-accent">Gmail</Badge>{" "}
            提案文・連絡文をGmailの下書きとして自動生成し、送信前に手動確認。
          </li>
        </ul>
      </Card>
    </>
  );
}
