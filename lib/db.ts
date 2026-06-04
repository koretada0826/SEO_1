// ─────────────────────────────────────────────────────────────
// サーバー側の案件ストア。
//   - DATABASE_URL があれば PostgreSQL（永続・端末間共有）
//   - 無ければ「メモリ上の受け取り口」（セットアップ不要・relay用途）
// どちらでも同じ関数で動く。クライアントは結果を localStorage にマージして保持するため、
// メモリ運用でもユーザーのブラウザ側にはデータが残る。
// ─────────────────────────────────────────────────────────────
import { Pool } from "pg";
import type { Job } from "./types";

let pool: Pool | null = null;
let schemaReady = false;
const mem = new Map<string, Job>(); // DBが無い時の一時ストア

function getPool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!pool) {
    pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 3 });
  }
  return pool;
}

// 永続（DB）かどうか。false の場合はメモリ運用（サーバー再起動で消えるが、
// クライアント側 localStorage には残る）。
export function durable(): boolean {
  return !!process.env.DATABASE_URL;
}

async function ensureSchema(p: Pool): Promise<void> {
  if (schemaReady) return;
  await p.query(
    `create table if not exists jobs (
       id text primary key,
       data jsonb not null,
       updated_at timestamptz not null default now()
     )`
  );
  schemaReady = true;
}

export async function listJobs(): Promise<Job[]> {
  const p = getPool();
  if (!p) return [...mem.values()];
  await ensureSchema(p);
  const r = await p.query<{ data: Job }>(
    `select data from jobs order by (data->>'createdAt') desc nulls last`
  );
  return r.rows.map((row) => row.data);
}

export async function upsertJob(job: Job): Promise<Job> {
  const p = getPool();
  if (!p) {
    mem.set(job.id, job);
    return job;
  }
  await ensureSchema(p);
  await p.query(
    `insert into jobs (id, data, updated_at) values ($1, $2::jsonb, now())
     on conflict (id) do update set data = $2::jsonb, updated_at = now()`,
    [job.id, JSON.stringify(job)]
  );
  return job;
}

export async function patchJob(id: string, patch: Partial<Job>): Promise<Job | null> {
  const p = getPool();
  if (!p) {
    const cur = mem.get(id);
    if (!cur) return null;
    const merged = { ...cur, ...patch, id, updatedAt: new Date().toISOString() };
    mem.set(id, merged);
    return merged;
  }
  await ensureSchema(p);
  const r = await p.query<{ data: Job }>(`select data from jobs where id = $1`, [id]);
  if (!r.rows.length) return null;
  const merged: Job = { ...r.rows[0].data, ...patch, id, updatedAt: new Date().toISOString() };
  await p.query(`update jobs set data = $2::jsonb, updated_at = now() where id = $1`, [
    id,
    JSON.stringify(merged),
  ]);
  return merged;
}

export async function deleteJob(id: string): Promise<boolean> {
  const p = getPool();
  if (!p) {
    mem.delete(id);
    return true;
  }
  await ensureSchema(p);
  await p.query(`delete from jobs where id = $1`, [id]);
  return true;
}

export async function getJobById(id: string): Promise<Job | null> {
  const p = getPool();
  if (!p) return mem.get(id) ?? null;
  await ensureSchema(p);
  const r = await p.query<{ data: Job }>(`select data from jobs where id = $1`, [id]);
  return r.rows.length ? r.rows[0].data : null;
}

export async function clearAllJobs(): Promise<void> {
  const p = getPool();
  if (!p) {
    mem.clear();
    return;
  }
  await ensureSchema(p);
  await p.query(`delete from jobs`);
}

// URL（案件URL）で既存IDを探す＝重複登録の防止。
export async function findIdByUrl(url: string): Promise<string | null> {
  if (!url) return null;
  const p = getPool();
  if (!p) {
    for (const j of mem.values()) if (j.url === url) return j.id;
    return null;
  }
  await ensureSchema(p);
  const r = await p.query<{ id: string }>(
    `select id from jobs where data->>'url' = $1 limit 1`,
    [url]
  );
  return r.rows.length ? r.rows[0].id : null;
}
