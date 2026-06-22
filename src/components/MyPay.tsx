import { useEffect, useMemo, useState } from "react";
import {
  EVENT_TYPE_LABEL,
  HONORIFIC,
  RECIPIENT_TYPE_LABEL,
  type RecipientType,
  type User,
} from "../types";
import {
  addRecipient,
  deleteRecipient,
  getEvents,
  getRecipients,
  getVideoTasks,
  markPaymentsSeen,
  payConfirmationFor,
} from "../store";
import { quarterLabel, quarterOf, todayStr, yen } from "../lib/date";
import { payLinesFor, quartersForUserWork, videoTasksForQuarter } from "../lib/pay";
import { openReceiptPdf } from "../lib/receipt";
import { stampSvg } from "../lib/stamp";

// メンバーが自分の報酬（管理者が承認した確定額）を確認し、領収書を発行する画面
export default function MyPay({ me }: { me: User }) {
  const events = useMemo(() => getEvents(), []);
  const videoTasks = useMemo(() => getVideoTasks(), []);

  // 承認された報酬の通知を既読にする
  useEffect(() => {
    markPaymentsSeen(me.id);
  }, [me.id]);

  const quarters = useMemo(() => {
    const set = new Set<string>(quartersForUserWork(events, me.id));
    for (const t of videoTasks)
      if (t.toUserId === me.id && t.status === "completed")
        set.add(quarterOf(t.completedAt ?? t.deadline));
    const arr = Array.from(set).sort().reverse();
    return arr.length ? arr : [quarterOf(todayStr())];
  }, [events, videoTasks, me.id]);

  const [quarter, setQuarter] = useState(quarters[0]);
  const [issuedTo, setIssuedTo] = useState("");
  const [recipientType, setRecipientType] = useState<RecipientType>("corporate");
  const [version, setVersion] = useState(0);

  const recipients = useMemo(() => getRecipients(me.id), [me.id, version]);

  // 自動計算の稼働明細（参考表示用）
  const lines = useMemo(
    () => payLinesFor(events, me.id, me.hourlyRate, quarter),
    [events, me, quarter]
  );
  const vTasks = useMemo(
    () => videoTasksForQuarter(videoTasks, me.id, quarter),
    [videoTasks, me.id, quarter]
  );

  // 管理者が承認した確定報酬
  const confirmation = useMemo(
    () => payConfirmationFor(me.id, quarter),
    [me.id, quarter, version]
  );
  const isApproved = confirmation?.status === "approved";
  const rewardAmount = isApproved ? confirmation!.amount : 0;

  function saveRecipient() {
    if (!issuedTo.trim()) return alert("宛名を入力してください。");
    addRecipient(me.id, issuedTo, recipientType);
    setVersion((v) => v + 1);
  }

  function issueReceipt() {
    if (!isApproved) {
      alert("管理者が報酬を承認すると領収書を発行できます。");
      return;
    }
    if (rewardAmount <= 0) {
      alert("確定報酬がないため、領収書を発行できません。");
      return;
    }
    if (!issuedTo.trim()) {
      alert("宛名を入力（または選択）してください。");
      return;
    }
    // 領収書の明細：稼働明細 ＋ 動画報酬 ＋（管理者調整があれば）調整行
    const receiptLines = lines.map((l) => ({
      date: l.event.date.replace(/-/g, "/"),
      title: l.event.title,
      hours: l.hours,
      amount: l.amount,
    }));
    const eventSum = lines.reduce((s, l) => s + l.amount, 0);
    const workAdjust = confirmation!.workAmount - eventSum;
    if (workAdjust !== 0) {
      receiptLines.push({
        date: "",
        title: "稼働報酬の調整",
        hours: 0,
        amount: workAdjust,
      });
    }
    if (confirmation!.videoAmount > 0) {
      receiptLines.push({
        date: "",
        title: "動画編集報酬",
        hours: 0,
        amount: confirmation!.videoAmount,
      });
    }
    openReceiptPdf({
      receiptNo: `${quarter}-${me.id.slice(0, 4).toUpperCase()}`,
      issuedDate: todayStr().replace(/-/g, "/"),
      issuedTo: issuedTo.trim(),
      honorific: HONORIFIC[recipientType],
      issuerName: me.name,
      issuerInfo: {
        postalCode: me.postalCode,
        address: me.address,
        phone: me.phone,
        email: me.email,
      },
      stampSvg: me.stamp
        ? stampSvg(me.stamp.text, me.stamp.shape, me.stamp.orientation, me.stamp.font)
        : undefined,
      periodLabel: quarterLabel(quarter),
      amount: rewardAmount,
      lines: receiptLines,
    });
  }

  return (
    <div className="mypay-view">
      <div className="section-head">
        <h2>報酬の確認</h2>
        <p className="muted">
          管理者が承認した報酬がここに反映されます（時給 {yen(me.hourlyRate)}/時）。
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

      {/* 確定報酬の表示 */}
      {isApproved ? (
        <div className="pay-summary">
          <div className="pay-card">
            <span className="pay-label">稼働時間</span>
            <span className="pay-value">{confirmation!.hours.toFixed(1)}h</span>
          </div>
          <div className="pay-card">
            <span className="pay-label">稼働報酬</span>
            <span className="pay-value">{yen(confirmation!.workAmount)}</span>
          </div>
          <div className="pay-card">
            <span className="pay-label">動画報酬</span>
            <span className="pay-value">{yen(confirmation!.videoAmount)}</span>
          </div>
          <div className="pay-card highlight">
            <span className="pay-label">確定報酬</span>
            <span className="pay-value">{yen(rewardAmount)}</span>
          </div>
        </div>
      ) : (
        <div className="pay-confirm-box pending">
          ⏳ 管理者が報酬を承認すると、ここに確定報酬が表示されます。
          <div className="muted small" style={{ marginTop: 6 }}>
            （現在の自動集計：稼働 {lines.reduce((s, l) => s + l.hours, 0).toFixed(1)}h ・
            動画 {vTasks.length}件）
          </div>
        </div>
      )}
      {isApproved && confirmation!.note && (
        <p className="muted small">管理者メモ：{confirmation!.note}</p>
      )}
      {isApproved && (
        <div className="pay-confirm-box confirmed">
          ✅ 報酬が承認されました（{confirmation!.approvedAt?.replace(/-/g, "/")}）。
          領収書を発行できます。
        </div>
      )}

      {/* 稼働明細（参考） */}
      <h3 className="req-section-title">稼働明細</h3>
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

      {/* 動画編集報酬の明細 */}
      {vTasks.length > 0 && (
        <>
          <h3 className="req-section-title">動画編集報酬</h3>
          <table className="members-table">
            <thead>
              <tr>
                <th>完了日</th>
                <th>内容</th>
                <th>報酬</th>
              </tr>
            </thead>
            <tbody>
              {vTasks.map((t) => (
                <tr key={t.id}>
                  <td>{(t.completedAt ?? t.deadline).replace(/-/g, "/")}</td>
                  <td>{t.title}</td>
                  <td className="amount">{yen(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="receipt-box">
        <h3>領収書の発行</h3>
        <p className="muted small">
          {isApproved
            ? "宛名を選ぶか入力して発行できます。個人は「様」、法人は「御中」が付きます。印刷ダイアログで「PDFとして保存」を選ぶとPDFになります。"
            : "管理者が報酬を承認すると発行できるようになります。"}
        </p>

        {recipients.length > 0 && (
          <div className="recipient-saved">
            <span className="muted small">登録済みの宛名：</span>
            <div className="recipient-chips">
              {recipients.map((r) => (
                <span key={r.id} className="recipient-chip">
                  <button
                    type="button"
                    className="recipient-pick"
                    onClick={() => {
                      setIssuedTo(r.name);
                      setRecipientType(r.type);
                    }}
                  >
                    {r.name} {HONORIFIC[r.type]}
                    <span className="recipient-tag">{RECIPIENT_TYPE_LABEL[r.type]}</span>
                  </button>
                  <button
                    type="button"
                    className="recipient-del"
                    title="削除"
                    onClick={() => {
                      deleteRecipient(r.id);
                      setVersion((v) => v + 1);
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="recipient-type">
          {(["corporate", "individual"] as RecipientType[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`type-btn ${recipientType === t ? "on" : ""}`}
              disabled={!isApproved}
              onClick={() => setRecipientType(t)}
            >
              {RECIPIENT_TYPE_LABEL[t]}（{HONORIFIC[t]}）
            </button>
          ))}
        </div>

        <div className="receipt-row">
          <input
            value={issuedTo}
            onChange={(e) => setIssuedTo(e.target.value)}
            placeholder={
              recipientType === "individual" ? "宛名（例: 山田 花子）" : "宛名（例: 株式会社○○）"
            }
            disabled={!isApproved}
          />
          <button className="ghost" onClick={saveRecipient} disabled={!isApproved}>
            ＋宛名を登録
          </button>
          <button className="primary" onClick={issueReceipt} disabled={!isApproved}>
            🧾 領収書を発行（PDF）
          </button>
        </div>
        {issuedTo.trim() && (
          <p className="muted small recipient-preview">
            宛名プレビュー： <strong>{issuedTo.trim()} {HONORIFIC[recipientType]}</strong>
          </p>
        )}
      </div>
    </div>
  );
}
