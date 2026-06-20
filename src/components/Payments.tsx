import { useMemo, useState } from "react";
import {
  getEvents,
  getMembers,
  payConfirmationFor,
  requestPayConfirmation,
} from "../store";
import { hoursBetween, quarterLabel, quarterOf, yen } from "../lib/date";

// オーナーが3ヶ月（四半期）ごとの支払額を確認し、メンバーへ確認依頼を送る画面
export default function Payments() {
  const [version, setVersion] = useState(0);
  const events = getEvents();
  const members = getMembers();

  // 稼働(work)・撮影(shooting)を労働時間としてカウント。納品(delivery)は除外。
  const quarters = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) if (e.type !== "delivery") set.add(quarterOf(e.date));
    const arr = Array.from(set).sort().reverse();
    return arr.length ? arr : [quarterOf(new Date().toISOString().slice(0, 10))];
  }, [events]);

  const [quarter, setQuarter] = useState(quarters[0]);

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
    // version はボタン押下後の再計算トリガ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, events, quarter, version]);

  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="payments-view">
      <div className="section-head">
        <h2>3ヶ月ごとの支払額</h2>
        <p className="muted">
          稼働・撮影の時間 × 時給で自動集計します（納品は時間に含めません）。
          金額を確定したら「確認依頼」でメンバーに通知できます。
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
            <th>時給</th>
            <th>支払額</th>
            <th>報酬確認</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const status = r.confirm?.status;
            // 確定額が変わっていたら再依頼が必要
            const stale = r.confirm && r.confirm.amount !== r.amount;
            return (
              <tr key={r.member.id}>
                <td>{r.member.name}</td>
                <td>{r.count}件</td>
                <td>{r.hours.toFixed(1)}h</td>
                <td className="muted">{yen(r.member.hourlyRate)}/時</td>
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
                        requestPayConfirmation(
                          r.member.id,
                          quarter,
                          r.amount,
                          r.hours
                        );
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
            <td colSpan={4}>
              <strong>合計支払額</strong>
            </td>
            <td className="amount total">{yen(total)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
