import { useMemo, useState } from "react";
import {
  eventsAwaitingAdmin,
  getEventApprovals,
  getEvents,
  getMembers,
  requestEventApproval,
} from "../store";
import { hoursBetween, quarterLabel, quarterOf, yen } from "../lib/date";
import { sendPushToUsers } from "../lib/push";
import {
  EVENT_APPROVAL_STATUS_LABEL,
  EVENT_TYPE_LABEL,
  type ScheduleEvent,
  type User,
} from "../types";

// オーナーが「過ぎた予定」ごとに報酬を確認し、メンバーへ承認依頼を送る画面
export default function Payments() {
  const [version, setVersion] = useState(0);
  const events = useMemo(() => getEvents(), [version]);
  const members = useMemo(() => getMembers(), [version]);
  const approvals = useMemo(() => getEventApprovals(), [version]);

  const memberById = useMemo(() => {
    const m: Record<string, User> = {};
    for (const u of members) m[u.id] = u;
    return m;
  }, [members]);
  const eventById = useMemo(() => {
    const m: Record<string, ScheduleEvent> = {};
    for (const e of events) m[e.id] = e;
    return m;
  }, [events]);

  // 確認待ち（まだ承認依頼を送っていない過ぎた予定）
  const awaiting = useMemo(() => eventsAwaitingAdmin(), [version]);
  // 承認依頼を送った金額の編集用
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  function amountKey(eventId: string, userId: string) {
    return `${eventId}:${userId}`;
  }
  function defaultAmount(e: ScheduleEvent, userId: string) {
    const h = hoursBetween(e.start, e.end);
    const rate = memberById[userId]?.hourlyRate ?? 0;
    return Math.round(h * rate);
  }

  function send(e: ScheduleEvent, userId: string) {
    const key = amountKey(e.id, userId);
    const amount =
      amounts[key] !== undefined ? Number(amounts[key]) || 0 : defaultAmount(e, userId);
    const hours = hoursBetween(e.start, e.end);
    requestEventApproval(e.id, userId, hours, amount);
    sendPushToUsers(
      [userId],
      "報酬の承認依頼が届きました",
      `${e.date.slice(5).replace("-", "/")}「${e.title}」の報酬 ${yen(amount)} を確認してください`,
      "/"
    );
    setVersion((v) => v + 1);
  }

  // メンバーの承認待ち / 承認済み
  const requested = approvals.filter((a) => a.status === "requested");
  const approved = approvals.filter((a) => a.status === "approved");

  // 承認済みをメンバー×四半期で集計
  const approvedSummary = useMemo(() => {
    const map: Record<string, { name: string; quarter: string; total: number; count: number }> = {};
    for (const a of approved) {
      const e = eventById[a.eventId];
      const q = e ? quarterOf(e.date) : "—";
      const k = `${a.userId}:${q}`;
      const name = memberById[a.userId]?.name ?? "—";
      if (!map[k]) map[k] = { name, quarter: q, total: 0, count: 0 };
      map[k].total += a.amount;
      map[k].count += 1;
    }
    return Object.values(map).sort((x, y) =>
      x.quarter === y.quarter ? x.name.localeCompare(y.name) : x.quarter < y.quarter ? 1 : -1
    );
  }, [approved, eventById, memberById]);

  return (
    <div className="payments-view">
      <div className="section-head">
        <h2>支払い集計・承認</h2>
        <p className="muted">
          予定が過ぎると下に表示されます。内容を確認して
          <strong>「承認依頼を送る」</strong>とメンバーに通知が届き、メンバーが承認すると報酬が確定します。
        </p>
      </div>

      {/* 確認待ち */}
      <h3 className="req-section-title">
        確認待ちの予定（{awaiting.length}件）
      </h3>
      {awaiting.length === 0 ? (
        <p className="muted">承認依頼を送る予定はありません。</p>
      ) : (
        <div className="approval-list">
          {awaiting.map(({ event: e, userId }) => {
            const key = amountKey(e.id, userId);
            const hours = hoursBetween(e.start, e.end);
            const val =
              amounts[key] !== undefined ? amounts[key] : String(defaultAmount(e, userId));
            return (
              <div key={key} className="approval-card">
                <div className="approval-card-main">
                  <div className="approval-card-head">
                    <span className="req-date">{e.date.replace(/-/g, "/")}</span>
                    <span className="tag">{EVENT_TYPE_LABEL[e.type]}</span>
                    <span className="approval-member">{memberById[userId]?.name ?? "—"}</span>
                  </div>
                  <div className="approval-card-title">{e.title}</div>
                  <div className="approval-card-meta">
                    🕒 {e.start}–{e.end || "未定"}（{hours.toFixed(1)}h） ／ 📍 {e.location || "未設定"}
                  </div>
                  {e.note && <div className="approval-card-note">{e.note}</div>}
                </div>
                <div className="approval-card-action">
                  <label className="approval-amount-label">
                    報酬額（円）
                    <input
                      type="number"
                      min={0}
                      step={500}
                      value={val}
                      onChange={(ev) =>
                        setAmounts((m) => ({ ...m, [key]: ev.target.value }))
                      }
                    />
                  </label>
                  <button className="primary" onClick={() => send(e, userId)}>
                    承認依頼を送る
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* メンバーの承認待ち */}
      {requested.length > 0 && (
        <>
          <h3 className="req-section-title">メンバーの承認待ち（{requested.length}件）</h3>
          <table className="members-table">
            <thead>
              <tr>
                <th>日付</th>
                <th>内容</th>
                <th>メンバー</th>
                <th>報酬</th>
                <th>状態</th>
              </tr>
            </thead>
            <tbody>
              {requested.map((a) => {
                const e = eventById[a.eventId];
                return (
                  <tr key={a.id}>
                    <td>{e ? e.date.replace(/-/g, "/") : "—"}</td>
                    <td>{e?.title ?? "—"}</td>
                    <td>{memberById[a.userId]?.name ?? "—"}</td>
                    <td className="amount">{yen(a.amount)}</td>
                    <td><span className="req-status pending">{EVENT_APPROVAL_STATUS_LABEL.requested}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {/* 承認済み（確定報酬） */}
      {approvedSummary.length > 0 && (
        <>
          <h3 className="req-section-title">承認済みの確定報酬</h3>
          <table className="members-table">
            <thead>
              <tr>
                <th>メンバー</th>
                <th>期間</th>
                <th>件数</th>
                <th>確定報酬</th>
              </tr>
            </thead>
            <tbody>
              {approvedSummary.map((s, i) => (
                <tr key={i}>
                  <td>{s.name}</td>
                  <td>{quarterLabel(s.quarter)}</td>
                  <td>{s.count}件</td>
                  <td className="amount"><strong>{yen(s.total)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
