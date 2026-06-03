"use client";
import Link from "next/link";
import { useDB, actions } from "@/lib/store";
import { GAS_WEBAPP_URL } from "@/lib/google";
import {
  Card,
  PageHeader,
  Field,
  Input,
  Select,
  Button,
  Badge,
  StatCard,
} from "@/components/ui";
import type { AppSettings } from "@/lib/types";

export default function SettingsPage() {
  const db = useDB();
  const s = db.settings;

  const update = (patch: Partial<AppSettings>) => actions.updateSettings(patch);

  const enableNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      alert("このブラウザは通知に対応していません。");
      return;
    }
    if (Notification.permission === "granted") {
      update({ notificationsEnabled: true });
      new Notification("通知をオンにしました", { body: "応募・受注・作業完了でお知らせします" });
      return;
    }
    const res = await Notification.requestPermission();
    if (res === "granted") {
      update({ notificationsEnabled: true });
      new Notification("通知をオンにしました", { body: "応募・受注・作業完了でお知らせします" });
    } else {
      update({ notificationsEnabled: false });
      alert("ブラウザ側で通知がブロックされています。アドレスバー左の鍵アイコン → サイトの設定 → 通知 を「許可」にしてください。");
    }
  };

  return (
    <>
      <PageHeader
        title="設定"
        desc="表示名・目標時給・地雷判定の基準・AIプロバイダなどを設定します。変更は即座に保存されます。"
      />

      <Card title="基本設定" className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="表示名">
            <Input
              defaultValue={s.displayName}
              placeholder="例：SEOディレクター"
              onBlur={(e) => update({ displayName: e.target.value })}
            />
          </Field>
          <Field label="目標時給（円）" hint="収益性スコア・時給換算の基準に使います">
            <Input
              type="number"
              defaultValue={s.defaultHourlyTarget}
              onBlur={(e) =>
                update({ defaultHourlyTarget: Number(e.target.value) || 0 })
              }
            />
          </Field>
          <Field
            label="最低予算ライン（円）"
            hint="これ未満の案件は地雷度が加点されます"
          >
            <Input
              type="number"
              defaultValue={s.minBudget}
              onBlur={(e) => update({ minBudget: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field
            label="AIプロバイダ"
            hint="現在はmockのみ動作します。claude / openai は将来対応予定です"
          >
            <Select
              value={s.aiProvider}
              onChange={(e) =>
                update({ aiProvider: e.target.value as AppSettings["aiProvider"] })
              }
            >
              <option value="mock">mock（モック・課金ゼロ）</option>
              <option value="claude">claude（今後対応）</option>
              <option value="openai">openai（今後対応）</option>
            </Select>
          </Field>
          <Field label="Google連携" hint="GAS Web App接続時にONにします">
            <label className="flex items-center gap-2 rounded-lg border border-border bg-bg/60 px-3 py-2 text-sm text-zinc-200">
              <input
                type="checkbox"
                checked={s.googleConnected}
                onChange={(e) => update({ googleConnected: e.target.checked })}
                className="h-4 w-4 accent-accent"
              />
              Googleと連携済みにする
            </label>
          </Field>
        </div>
      </Card>

      <Card title="AI処理について" className="mb-6">
        <p className="text-xs leading-relaxed text-muted">
          AI処理はすべて <code className="text-accent2">lib/mockAI.ts</code> に分離済みで、
          後から Claude / OpenAI API に差し替え可能な設計になっています。
          現在はルールベースのモックで動作しており、外部APIには一切接続しないため
          <span className="text-good">課金はゼロ</span>です。
        </p>
      </Card>

      <Card title="通知" className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs leading-relaxed text-muted">
              案件が <span className="text-accent2">応募済み</span> /{" "}
              <span className="text-good">受注</span> /{" "}
              <span className="text-good">作業完了（納品済み）</span>{" "}
              になったときに、デスクトップ通知でお知らせします。
              <br />
              ※このツールのタブを開いている間に届きます（ブラウザの通知許可が必要）。
            </p>
            <div className="mt-2">
              <Badge
                className={
                  s.notificationsEnabled
                    ? "border-good/40 bg-good/10 text-good"
                    : "border-border bg-white/5 text-muted"
                }
              >
                {s.notificationsEnabled ? "通知：オン" : "通知：オフ"}
              </Badge>
            </div>
          </div>
          {s.notificationsEnabled ? (
            <Button variant="outline" onClick={() => update({ notificationsEnabled: false })}>
              通知をオフにする
            </Button>
          ) : (
            <Button onClick={enableNotifications}>通知をオンにする</Button>
          )}
        </div>
      </Card>

      <Card title="Google連携" className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs leading-relaxed text-muted">
              案件一覧・提案文・納品物・売上の Google Sheets / Docs / PDF / Gmail 連携。
              現在は{" "}
              {GAS_WEBAPP_URL ? (
                <span className="text-good">接続設定あり</span>
              ) : (
                <span className="text-warn">未接続（モック動作中・送信は発生しません）</span>
              )}
              。接続するには <code className="text-accent2">lib/google.ts</code> の{" "}
              <code className="text-accent2">GAS_WEBAPP_URL</code> を設定します。
            </p>
          </div>
          <Link href="/google">
            <Button variant="outline">Google連携を開く</Button>
          </Link>
        </div>
      </Card>

      <Card title="データ管理" className="mb-6">
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="案件" value={db.jobs.length} tone="accent" />
          <StatCard label="提案文" value={db.proposals.length} tone="accent" />
          <StatCard label="納品物" value={db.deliverables.length} tone="accent" />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (
                window.confirm(
                  "現在のデータをすべて破棄し、サンプルデータで初期化します。よろしいですか？"
                )
              ) {
                actions.resetAll();
              }
            }}
          >
            サンプルデータで初期化
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (
                window.confirm(
                  "すべての案件・提案文・納品物を削除します。この操作は取り消せません。よろしいですか？"
                )
              ) {
                actions.clearAll();
              }
            }}
          >
            全データを削除
          </Button>
        </div>

        <p className="mt-3 text-xs text-muted">
          <Badge className="border-border bg-white/5 text-muted">localStorage</Badge>{" "}
          現在データはブラウザのlocalStorageに保存されています。将来的にSupabaseへ移行予定です。
        </p>
      </Card>
    </>
  );
}
