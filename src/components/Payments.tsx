import { useMemo, useState } from "react";
import {
  approvePayment,
  getEvents,
  getMembers,
  getVideoTasks,
  payConfirmationFor,
  unapprovePayment,
} from "../store";
import { hoursBetween, quarterLabel, quarterOf, yen } from "../lib/date";
import { payLinesFor, videoTasksForQuarter } from "../lib/pay";
import { sendPushToUsers } from "../lib/push";
import { EVENT_TYPE_LABEL, type User, type VideoTask } from "../types";

// オーナーが四半期ごとに稼働時間・報酬を確定し「承認」する画面。
// 承認するとメンバーの報酬に反映される。
export default function Payments() {
  const [version, setVersion] = useState(0);
  const events = useMemo(() => getEvents(), [version]);
  const members = useMemo(() => getMembers(), [version]);
  const videoTasks = useMemo(() => getVideoTasks(), [version]);

  const quarters = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) if (e.type !== "delivery") set.add(quarterOf(e.date));
    for (const t of videoTasks)
      if (t.status === "completed") set.add(quarterOf(t.completedAt ?? t.deadline));
    const arr = Array.from(set).sort().reverse();
    return arr.length ? arr : [quarterOf(new Date().toISOString().slice(0, 10))];
  }, [events, videoTasks]);

  const [quarter, setQuarter] = useState(quarters[0]);
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null);
  const [approveMemberId, setApproveMemberId] = useState<string | null>(null);

  if (!quarters.includes(quarter)) {
    // 期間リストが変わったとき先頭にフォールバック
    setQuarter(quarters[0]);
  }

  const rows = useMemo(() => {
    return members.map((m) => {
      const myEvents = events.filter(
        (e) =>
          e.type !== "delivery" &&
          quarterOf(e.date) === quarter &&
          e.assigneeIds.includes(m.id)
      );
      const autoHours = myEvents.reduce(
        (sum, e) => sum + hoursBetween(e.start, e.end),
        0
      );
      const autoWork = Math.round(autoHours * m.hourlyRate);
      const vTasks = videoTasksForQuarter(videoTasks, m.id, quarter);
      const autoVideo = vTasks.reduce((s, t) => s + (t.amount || 0), 0);
      const confirm = payConfirmationFor(m.id, quarter);
      const approved = confirm?.status === "approved";
      // 承認後に稼働や動画報酬が増えていたら「要更新」
      const stale =
        approved &&
        (autoWork !== confirm!.workAmount || autoVideo !== confirm!.videoAmount);
      return {
        member: m,
        autoHours,
        autoWork,
        vTasks,
        autoVideo,
        confirm,
        approved,
        stale,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, events, videoTasks, quarter, version]);

  const total = rows.reduce(
    (s, r) => s + (r.approved ? r.confirm!.amount : 0),
    0
  );

  const detailRow = detailMemberId
    ? rows.find((r) => r.member.id === detailMemberId)
    : null;
  const approveRow = approveMemberId
    ? rows.find((r) => r.member.id === approveMemberId)
    : null;

  return (
    <div className="payments-view">
      <div className="section-head">
        <h2>支払い集計・承認</h2>
        <p className="muted">
          稼働時間×時給を自動集計し、動画編集の報酬も合算できます。内容を確認して
          <strong>「承認」</strong>を押すと、メンバーの報酬に反映され領収書が発行可能になります。
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
            <th>稼働</th>
            <th>稼働報酬</th>
            <th>動画報酬</th>
            <th>確定額</th>
            <th>状態 / 操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.member.id}>
              <td>
                <button
                  className="member-name-btn"
                  onClick={() => setDetailMemberId(r.member.id)}
                >
                  {r.member.name}
                </button>
              </td>
              <td>{r.autoHours.toFixed(1)}h</td>
              <td className="amount">{yen(r.autoWork)}</td>
              <td className="amount">{yen(r.autoVideo)}</td>
              <td className="amount">
                {r.approved ? <strong>{yen(r.confirm!.amount)}</strong> : "—"}
              </td>
              <td>
                <div className="confirm-cell">
                  {r.approved ? (
                    r.stale ? (
                      <span className="req-status rejected">要更新</span>
                    ) : (
                      <span className="req-status approved">承認済み</span>
                    )
                  ) : (
                    <span className="req-status pending">未承認</span>
                  )}
                  <button
                    className="ghost mini"
                    onClick={() => setApproveMemberId(r.member.id)}
                  >
                    {r.approved ? "編集" : "承認"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>
              <strong>承認済みの合計</strong>
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

      {approveRow && (
        <ApprovalModal
          member={approveRow.member}
          quarter={quarter}
          autoHours={approveRow.autoHours}
          autoWork={approveRow.autoWork}
          autoVideo={approveRow.autoVideo}
          vTasks={approveRow.vTasks}
          existing={approveRow.confirm}
          onClose={() => setApproveMemberId(null)}
          onSaved={() => {
            setApproveMemberId(null);
            setVersion((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}

function ApprovalModal({
  member,
  quarter,
  autoHours,
  autoWork,
  autoVideo,
  vTasks,
  existing,
  onClose,
  onSaved,
}: {
  member: User;
  quarter: string;
  autoHours: number;
  autoWork: number;
  autoVideo: number;
  vTasks: VideoTask[];
  existing: ReturnType<typeof payConfirmationFor>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const approved = existing?.status === "approved";
  const [hours, setHours] = useState(
    String(approved ? existing!.hours : autoHours)
  );
  const [workAmount, setWorkAmount] = useState(
    String(approved ? existing!.workAmount : autoWork)
  );
  const [videoAmount, setVideoAmount] = useState(
    String(approved ? existing!.videoAmount : autoVideo)
  );
  const [note, setNote] = useState(existing?.note ?? "");

  const total = (Number(workAmount) || 0) + (Number(videoAmount) || 0);

  function approve() {
    approvePayment(member.id, quarter, {
      hours: Number(hours) || 0,
      workAmount: Number(workAmount) || 0,
      videoAmount: Number(videoAmount) || 0,
      note,
    });
    sendPushToUsers(
      [member.id],
      "報酬が承認されました",
      `${quarterLabel(quarter)}の報酬 ${yen(total)} が確定しました`,
      "/"
    );
    onSaved();
  }

  function cancelApproval() {
    if (!confirm("承認を取り消しますか？メンバーへの反映が解除されます。")) return;
    unapprovePayment(member.id, quarter);
    onSaved();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="day-panel modal" onClick={(e) => e.stopPropagation()}>
        <div className="day-panel-head">
          <h3>{member.name} の報酬を確定</h3>
          <button className="ghost" onClick={onClose}>✕</button>
        </div>
        <p className="muted small" style={{ marginTop: 0 }}>
          {quarterLabel(quarter)}・時給 {yen(member.hourlyRate)}/時
        </p>

        <div className="task-form-row">
          <label>
            確定稼働時間（h）
            <input
              type="number"
              min={0}
              step={0.5}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </label>
          <label>
            稼働報酬（円）
            <input
              type="number"
              min={0}
              step={1000}
              value={workAmount}
              onChange={(e) => setWorkAmount(e.target.value)}
            />
          </label>
        </div>
        <button
          className="ghost mini"
          type="button"
          style={{ alignSelf: "flex-start", marginBottom: 6 }}
          onClick={() => {
            setHours(String(autoHours));
            setWorkAmount(String(autoWork));
          }}
        >
          自動計算で埋める（{autoHours.toFixed(1)}h・{yen(autoWork)}）
        </button>

        <label>
          動画編集報酬（円）
          <input
            type="number"
            min={0}
            step={1000}
            value={videoAmount}
            onChange={(e) => setVideoAmount(e.target.value)}
          />
        </label>
        {vTasks.length > 0 && (
          <div className="video-reward-list">
            <span className="muted small">この期間に完了した動画依頼：</span>
            {vTasks.map((t) => (
              <div key={t.id} className="video-reward-row">
                <span>{t.title}</span>
                <span className="amount">{yen(t.amount)}</span>
              </div>
            ))}
            <button
              className="ghost mini"
              type="button"
              onClick={() => setVideoAmount(String(autoVideo))}
            >
              合計 {yen(autoVideo)} を反映
            </button>
          </div>
        )}

        <label>
          メモ（任意）
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="交通費込み など"
          />
        </label>

        <div className="approval-total">
          合計確定額 <strong>{yen(total)}</strong>
        </div>

        <div className="form-actions">
          {approved && (
            <button className="ghost danger" onClick={cancelApproval}>
              承認を取り消す
            </button>
          )}
          <button className="ghost" onClick={onClose}>キャンセル</button>
          <button className="primary" onClick={approve}>
            {approved ? "再承認する" : "承認する"}
          </button>
        </div>
      </div>
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
  member: User;
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
            <span className="pay-label">稼働報酬</span>
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
