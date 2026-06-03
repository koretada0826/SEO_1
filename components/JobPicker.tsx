"use client";
import { useDB } from "@/lib/store";
import { Select } from "./ui";
import type { Job } from "@/lib/types";

export function JobPicker({
  value,
  onChange,
  filter,
  placeholder = "案件を選択…",
}: {
  value: string;
  onChange: (id: string) => void;
  filter?: (j: Job) => boolean;
  placeholder?: string;
}) {
  const db = useDB();
  const jobs = filter ? db.jobs.filter(filter) : db.jobs;
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {jobs.map((j) => (
        <option key={j.id} value={j.id}>
          {j.title.slice(0, 44)}
        </option>
      ))}
    </Select>
  );
}
