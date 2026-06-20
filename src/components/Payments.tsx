import { useMemo, useState } from "react";
import {
  getEvents,
  getMembers,
  payConfirmationFor,
  requestPayConfirmation,
} from "../store";
import { hoursBetween, quarterLabel, quarterOf, yen } from "../lib/date";
import { payLinesFor } from "../lib/pay";
import { EVENT_TYPE_LABEL } from "../types";

// オーナーが3ヶ月（四半期）ごとの支払額を確認し、メンバーへ確認依頼を送る画面
export default function Payments() {
  const [version, setVersion] = useState(0);
  const events = useMemo(() => getEvents(), [version]);
  const members = useMemo(() => getMembers(), [version]);

  const quarters = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) if (e.type !== "delivery") set.add(quarterOf(e.date));
    const arr = Array.from(set).sort().reverse();
    return arr.length ? arr : [quarterOf(new Date().toISOString().slice(0, 10))];
  }, [events]);

  const [quarter, setQuarter] = useState(quarters[0]);
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null);

  const rows = useMemo(() => {
    return members.map((m) => {
      const myEvents = events.filter(
        (e) =>
          e.type !== "delivery" &&
          quarterOf(e.date) === quarter &&
          e.assigneeIds.includes(m.id)
      );
      const hours = myEvents.reduce((sum, e) => sum + hoursBetween(e.start, e.end), 0);
      const amount = hours * m.hourlyRate;
      const confirm = payConfirmationFor(m.id, quarter);
      return { member: m, hours, amount, count: myEvents.length, confirm };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, events, quarter, version]);

  const total = rows.reduce((s, r) => s + r.amount, 0);

  const detailRow = detailMemberId ? rows.find((r) => r.member.id === detailMemberId) : null;

  return (
    <div className="payments-view">
      <div className="section-head">
        <h2>3ヶ月ごとの支払額</h2>
        <p className="muted">
          稼働・撮影の時間 × 時給で自動集計します（納品は時間に含めません）。
          金額を確定したら「確認依頼」でメンバーに通知できます。名前をクリックすると明細を確認できます。
        </p>
      </div>

      <label className="quarter-select">
        対象期間
        <select value={quarter} onChange={(e) => setQuarter(e.target.value)}>
          {quarters.map((q) => (
            <option key={q} value={q}>
              {quarterLabel(q)}
            </option>
          ))}
        </select>
      </label>

      <table className="members-table">
        <thead>
          <tr>
            <th>メンバー</th>
            <th>件数</th>
            <th>稼働時間</th>
            <th>支払額</th>
            <th>報酬確認</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const status = r.confirm?.status;
            const stale = r.confirm && r.confirm.amount !== r.amount;
            return (
              <tr key={r.member.id}>
                <td>
                  <button
                    className="member-name-btn"
                    onClick={() => setDetailMemberId(r.member.id)}
                  >
                    {r.member.name}
                  </button>
                </td>
                <td>{r.count}件</td>
                <td>{r.hours.toFixed(1)}h</td>
                <td className="amount">{yen(r.amount)}</td>
                <td>
                  <div className="confirm-cell">
                    {status === "confirmed" && !stale ? (
                      <span className="req-status approved">確認済み</span>
                    ) : status === "requested" && !stale ? (
                      <span className="req-status pending">確認依頼中</span>
                    ) : (
                      <span className="req-status rejected" style={{ visibility: status ? "visible" : "hidden" }}>
                        要再依頼
                      </span>
                    )}
                    <button
                      className="ghost mini"
                      disabled={r.amount <= 0}
                      onClick={() => {
                        requestPayConfirmation(r.member.id, quarter, r.amount, r.hours);
                        setVersion((v) => v + 1);
                      }}
                    >
                      {status ? "再依頼" : "確認依頼"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>
              <strong>合計支払額</strong>
            </td>
            <td className="amount total">{yen(total)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      {detailRow && (
        <MemberDetail
          member={detailRow.member}
          events={events}
          quarter={quarter}
          quarters={quarters}
          onClose={() => setDetailMemberId(null)}
        />
      )}
    </div>
  );
}

function MemberDetail({
  member,
  events,
  quarter,
  quarters,
  onClose,
}: {
  member: ReturnType<typeof getMembers>[0];
  events: ReturnType<typeof getEvents>;
  quarter: string;
  quarters: string[];
  onClose: () => void;
}) {
  const [q, setQ] = useState(quarter);
  const lines = useMemo(
    () => payLinesFor(events, member.id, member.hourlyRate, q),
    [events, member, q]
  );
  const totalHours = lines.reduce((s, l) => s + l.hours, 0);
  const totalAmount = lines.reduce((s, l) => s + l.amount, 0);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="day-panel modal member-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="day-panel-head">
          <h3>{member.name} の稼働明細</h3>
          <button className="ghost" onClick={onClose}>✕</button>
        </div>

        <label className="quarter-select" style={{ marginBottom: 16 }}>
          対象期間
          <select value={q} onChange={(e) => setQ(e.target.value)}>
            {quarters.map((qo) => (
              <option key={qo} value={qo}>{quarterLabel(qo)}</option>
            ))}
          </select>
        </label>

        <div className="pay-summary" style={{ marginBottom: 16 }}>
          <div className="pay-card">
            <span className="pay-label">稼働時間</span>
            <span className="pay-value">{totalHours.toFixed(1)}h</span>
          </div>
          <div className="pay-card">
            <span className="pay-label">件数</span>
            <span className="pay-value">{lines.length}件</span>
          </div>
          <div className="pay-card highlight">
            <span className="pay-label">支払額</span>
            <span className="pay-value">{yen(totalAmount)}</span>
          </div>
        </div>

        <table className="members-table">
          <thead>
            <tr>
              <th>日付</th>
              <th>内容</th>
              <th>種別</th>
              <th>稼働</th>
              <th>金額</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">この期間の稼働はありません。</td>
              </tr>
            ) : (
              lines.map((l) => (
                <tr key={l.event.id}>
                  <td>{l.event.date.replace(/-/g, "/")}</td>
                  <td>{l.event.title}</td>
                  <td className="muted">{EVENT_TYPE_LABEL[l.event.type]}</td>
                  <td>{l.hours.toFixed(1)}h</td>
                  <td className="amount">{yen(l.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
