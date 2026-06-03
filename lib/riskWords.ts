import type { RiskHit } from "./types";

// 地雷ワード辞書（クラウドソーシングSEO案件向け）
export const RISK_WORDS: { word: string; reason: string; severity: RiskHit["severity"] }[] = [
  { word: "無料テスト", reason: "無償テストライティングは地雷の典型。労力が報われない", severity: "high" },
  { word: "無償", reason: "無償作業の要求", severity: "high" },
  { word: "テストライティング", reason: "テスト名目の無償/低単価作業の可能性", severity: "medium" },
  { word: "大量募集", reason: "使い捨て前提・単価が低いことが多い", severity: "medium" },
  { word: "初心者歓迎", reason: "初心者前提＝低単価設定の可能性が高い", severity: "medium" },
  { word: "簡単作業", reason: "実際は手間がかかる/単価が低い傾向", severity: "low" },
  { word: "修正無制限", reason: "無限修正は時給を破壊する。回数明記がないと危険", severity: "high" },
  { word: "修正回数無制限", reason: "無限修正リスク", severity: "high" },
  { word: "低単価", reason: "明示的に低単価", severity: "high" },
  { word: "継続前提", reason: "継続を理由に初回を買い叩く口実になりがち", severity: "medium" },
  { word: "まずはテスト", reason: "テスト名目の値切り/無償リスク", severity: "medium" },
  { word: "AI禁止", reason: "AI使用不可。納品方針を手作業前提に切替が必要", severity: "medium" },
  { word: "AI使用禁止", reason: "AI使用不可", severity: "medium" },
  { word: "ChatGPT禁止", reason: "AI使用不可", severity: "medium" },
  { word: "コピペ禁止", reason: "コピペチェック厳格。当然だが過度な監視の兆候も", severity: "low" },
  { word: "マニュアル厳守", reason: "過剰マニュアルは作業負荷大・裁量小", severity: "medium" },
  { word: "源泉徴収", reason: "報酬から源泉徴収＝手取り減。条件確認必須", severity: "low" },
  { word: "契約前", reason: "契約前の成果物提出要求は重大地雷", severity: "high" },
  { word: "事前提出", reason: "契約前の作業依頼の可能性", severity: "high" },
  { word: "即日", reason: "納期が短すぎる可能性", severity: "medium" },
  { word: "本日中", reason: "極端に短い納期", severity: "high" },
  { word: "短納期", reason: "短納期は品質と時給を圧迫", severity: "medium" },
  { word: "0.5円", reason: "文字単価0.5円以下は地雷ライン", severity: "high" },
  { word: "0.3円", reason: "極端な低文字単価", severity: "high" },
  { word: "1記事", reason: "報酬と作業量の確認が必要", severity: "low" },
  { word: "やる気", reason: "やる気重視＝条件が曖昧/低単価の兆候", severity: "low" },
  { word: "誰でも", reason: "差別化されず買い叩かれやすい", severity: "low" },
];

// ポジティブ（優先度を上げる）シグナル
export const POSITIVE_WORDS: { word: string; reason: string }[] = [
  { word: "構成案", reason: "SEO構成案は自作ツール適性が高い高優先案件" },
  { word: "リライト", reason: "リライト改善は実績化しやすく単価も取りやすい" },
  { word: "競合分析", reason: "競合分析は自作ツールで高速化でき差別化しやすい" },
  { word: "FAQ", reason: "FAQ作成はGEO付加価値を乗せやすい" },
  { word: "継続", reason: "継続案件は安定収益" },
  { word: "長期", reason: "長期＝安定収益" },
  { word: "実績公開", reason: "実績公開可はポートフォリオ価値が高い" },
  { word: "ポートフォリオ", reason: "実績化価値が高い" },
  { word: "WordPress", reason: "入稿前SEOチェックは付加価値を出せる" },
  { word: "メタディスクリプション", reason: "ツール適性が高い" },
  { word: "高単価", reason: "収益性が高い" },
  { word: "単価1", reason: "文字単価1円以上は健全ライン" },
];

export function detectRiskWordsRule(text: string): RiskHit[] {
  if (!text) return [];
  const hits: RiskHit[] = [];
  const seen = new Set<string>();
  for (const r of RISK_WORDS) {
    if (text.includes(r.word) && !seen.has(r.word)) {
      hits.push({ word: r.word, reason: r.reason, severity: r.severity });
      seen.add(r.word);
    }
  }
  return hits;
}

export function detectPositiveSignals(text: string): { word: string; reason: string }[] {
  if (!text) return [];
  const hits: { word: string; reason: string }[] = [];
  const seen = new Set<string>();
  for (const p of POSITIVE_WORDS) {
    if (text.includes(p.word) && !seen.has(p.word)) {
      hits.push(p);
      seen.add(p.word);
    }
  }
  return hits;
}
