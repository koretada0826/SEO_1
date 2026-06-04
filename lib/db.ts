// ─────────────────────────────────────────────────────────────
// サーバー側の永続化（PostgreSQL）。DATABASE_URL が未設定なら null を返し、
// アプリは localStorage のみで動作する（後付けでDBを繋げられる設計）。
// jobs テーブルは {id, data(jsonb), updated_at} のシンプル構造。
// ─────────────────────────────────────────────────────────────
import { Pool } from "pg";
import type { Job } from "./types";

let pool: Pool | null = null;
let schemaReady = false;

function getPool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      max: 3,
    });
  }
  return pool;
}

export function dbEnabled(): boolean {
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

export async function listJobs(): Promise<Job[] | null> {
  const p = getPool();
  if (!p) return null;
  await ensureSchema(p);
  const r = await p.query<{ data: Job }>(
    `select data from jobs order by (data->>'createdAt') desc nulls last`
  );
  return r.rows.map((row) => row.data);
}

export async function upsertJob(job: Job): Promise<Job | null> {
  const p = getPool();
  if (!p) return null;
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
  if (!p) return null;
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
  if (!p) return false;
  await ensureSchema(p);
  await p.query(`delete from jobs where id = $1`, [id]);
  return true;
}

// URL（クラウドワークスの案件URL）で既存IDを探す。重複登録の防止に使う。
export async function findIdByUrl(url: string): Promise<string | null> {
  const p = getPool();
  if (!p || !url) return null;
  await ensureSchema(p);
  const r = await p.query<{ id: string }>(
    `select id from jobs where data->>'url' = $1 limit 1`,
    [url]
  );
  return r.rows.length ? r.rows[0].id : null;
}
