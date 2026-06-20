import { useMemo, useState } from "react";
import {
  EVENT_TYPE_LABEL,
  HONORIFIC,
  RECIPIENT_TYPE_LABEL,
  type RecipientType,
  type User,
} from "../types";
import {
  addRecipient,
  confirmPayConfirmation,
  deleteRecipient,
  getEvents,
  getRecipients,
  payConfirmationFor,
} from "../store";
import { quarterLabel, quarterOf, todayStr, yen } from "../lib/date";
import { payLinesFor, quartersForUserWork } from "../lib/pay";
import { openReceiptPdf } from "../lib/receipt";
import { stampSvg } from "../lib/stamp";

// メンバーが自分の報酬を確認し、領収書を発行する画面
export default function MyPay({ me }: { me: User }) {
  const events = useMemo(() => getEvents(), []);
  const quarters = useMemo(() => {
    const qs = quartersForUserWork(events, me.id);
    return qs.length ? qs : [quarterOf(todayStr())];
  }, [events, me.id]);

  const [quarter, setQuarter] = useState(quarters[0]);
  const [issuedTo, setIssuedTo] = useState("");
  const [recipientType, setRecipientType] = useState<RecipientType>("corporate");
  const [version, setVersion] = useState(0);

  const recipients = useMemo(() => getRecipients(me.id), [me.id, version]);

  const lines = useMemo(
    () => payLinesFor(events, me.id, me.hourlyRate, quarter),
    [events, me, quarter]
  );
  const totalHours = lines.reduce((s, l) => s + l.hours, 0);
  const totalAmount = lines.reduce((s, l) => s + l.amount, 0);

  // 管理者からの報酬確認依頼（この期間ぶん）
  const confirmation = useMemo(
    () => payConfirmationFor(me.id, quarter),
    [me.id, quarter, version]
  );
  const isConfirmed = confirmation?.status === "confirmed";

  function saveRecipient() {
    if (!issuedTo.trim()) return alert("宛名を入力してください。");
    addRecipient(me.id, issuedTo, recipientType);
    setVersion((v) => v + 1);
  }

  function issueReceipt() {
    if (!isConfirmed) {
      alert("管理者の確認依頼を確認してから領収書を発行してください。");
      return;
    }
    if (totalAmount <= 0) {
      alert("この期間の報酬がないため、領収書を発行できません。");
      return;
    }
    if (!issuedTo.trim()) {
      alert("宛名を入力（または選択）してください。");
      return;
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
        ? stampSvg(
            me.stamp.text,
            me.stamp.shape,
            me.stamp.orientation,
            me.stamp.font
          )
        : undefined,
      periodLabel: quarterLabel(quarter),
      amount: totalAmount,
      lines: lines.map((l) => ({
        date: l.event.date.replace(/-/g, "/"),
        title: l.event.title,
        hours: l.hours,
        amount: l.amount,
      })),
    });
  }

  return (
    <div className="mypay-view">
      <div className="section-head">
        <h2>報酬の確認</h2>
        <p className="muted">
          稼働・撮影の時間 × あなたの時給（{yen(me.hourlyRate)}/時）で計算しています。
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

      <div className="pay-summary">
        <div className="pay-card">
          <span className="pay-label">稼働時間</span>
          <span className="pay-value">{totalHours.toFixed(1)}h</span>
        </div>
        <div className="pay-card">
          <span className="pay-label">件数</span>
          <span className="pay-value">{lines.length}件</span>
        </div>
        <div className="pay-card highlight">
          <span className="pay-label">報酬合計</span>
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
              <td colSpan={5} className="muted">
                この期間の稼働はありません。
              </td>
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

      {/* 管理者からの報酬確認依頼 */}
      {confirmation && confirmation.status === "requested" && (
        <div className="pay-confirm-box requested">
          <div className="pay-confirm-title">
            📢 管理者から報酬の確認依頼が届いています
          </div>
          <div className="pay-confirm-amount">
            確定額 <strong>{yen(confirmation.amount)}</strong>（{quarterLabel(quarter)}）
          </div>
          <p className="muted small">
            内容を確認のうえ「確認しました」を押すと、領収書を発行できるようになります。
          </p>
          <button
            className="primary"
            onClick={() => {
              confirmPayConfirmation(confirmation.id);
              setVersion((v) => v + 1);
            }}
          >
            ✓ 内容を確認しました
          </button>
        </div>
      )}
      {isConfirmed && (
        <div className="pay-confirm-box confirmed">
          ✅ 報酬を確認済みです（{confirmation?.confirmedAt?.replace(/-/g, "/")}）。
          領収書を発行できます。
        </div>
      )}
      {!confirmation && (
        <div className="pay-confirm-box pending">
          ⏳ 管理者が報酬を確定すると、ここに確認依頼が届きます。
        </div>
      )}

      <div className="receipt-box">
        <h3>領収書の発行</h3>
        <p className="muted small">
          {isConfirmed
            ? "宛名を選ぶか入力して発行できます。個人は「様」、法人は「御中」が付きます。印刷ダイアログで「PDFとして保存」を選ぶとPDFになります。"
            : "管理者の確認依頼を確認すると発行できるようになります。"}
        </p>

        {/* 登録済みの宛名 */}
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

        {/* 種別（個人 / 法人） */}
        <div className="recipient-type">
          {(["corporate", "individual"] as RecipientType[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`type-btn ${recipientType === t ? "on" : ""}`}
              disabled={!isConfirmed}
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
            disabled={!isConfirmed}
          />
          <button className="ghost" onClick={saveRecipient} disabled={!isConfirmed}>
            ＋宛名を登録
          </button>
          <button className="primary" onClick={issueReceipt} disabled={!isConfirmed}>
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
