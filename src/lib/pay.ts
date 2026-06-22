// 報酬計算の共通ロジック
// 稼働(work)・撮影(shooting)を労働時間としてカウントし、納品(delivery)は除外。

import type { ScheduleEvent, VideoTask } from "../types";
import { hoursBetween, quarterOf } from "./date";

export interface PayLine {
  event: ScheduleEvent;
  hours: number;
  amount: number;
}

// 指定ユーザー・指定四半期の報酬明細
export function payLinesFor(
  events: ScheduleEvent[],
  userId: string,
  hourlyRate: number,
  quarter: string
): PayLine[] {
  return events
    .filter(
      (e) =>
        e.type !== "delivery" &&
        quarterOf(e.date) === quarter &&
        e.assigneeIds.includes(userId)
    )
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((e) => {
      const hours = hoursBetween(e.start, e.end);
      return { event: e, hours, amount: hours * hourlyRate };
    });
}

// そのユーザーに稼働実績のある四半期一覧（新しい順）
export function quartersForUserWork(
  events: ScheduleEvent[],
  userId: string
): string[] {
  const set = new Set<string>();
  for (const e of events)
    if (e.type !== "delivery" && e.assigneeIds.includes(userId))
      set.add(quarterOf(e.date));
  return Array.from(set).sort().reverse();
}

// 完了した動画編集依頼を四半期で割り当てる（完了日→なければ締切日で判定）
export function videoTasksForQuarter(
  tasks: VideoTask[],
  userId: string,
  quarter: string
): VideoTask[] {
  return tasks
    .filter(
      (t) =>
        t.toUserId === userId &&
        t.status === "completed" &&
        quarterOf(t.completedAt ?? t.deadline) === quarter
    )
    .sort((a, b) => ((a.completedAt ?? a.deadline) < (b.completedAt ?? b.deadline) ? -1 : 1));
}
