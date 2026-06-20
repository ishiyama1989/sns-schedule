// 領収書を別ウィンドウで開き、ブラウザの印刷機能でPDF保存できるようにする。
// 日本語フォントの埋め込み不要（OSのフォントで描画され、文字化けしない）。

import { yen } from "./date";

export interface ReceiptData {
  receiptNo: string;
  issuedDate: string; // "YYYY/MM/DD"
  issuedTo: string; // 宛名（支払元）
  honorific: string; // 敬称（個人=様 / 法人=御中）
  issuerName: string; // 発行者（メンバー）
  issuerInfo?: {
    postalCode?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  stampSvg?: string; // デジタル印影のSVGマークアップ
  periodLabel: string;
  amount: number;
  lines: { date: string; title: string; hours: number; amount: number }[];
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function openReceiptPdf(data: ReceiptData): void {
  const w = window.open("", "_blank", "width=820,height=1000");
  if (!w) {
    alert(
      "ポップアップがブロックされました。ブラウザでポップアップを許可してから再度お試しください。"
    );
    return;
  }

  const rows = data.lines
    .map(
      (l) => `<tr>
        <td>${esc(l.date)}</td>
        <td>${esc(l.title)}</td>
        <td class="num">${l.hours.toFixed(1)}h</td>
        <td class="num">${yen(l.amount)}</td>
      </tr>`
    )
    .join("");

  w.document.write(`<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<title>領収書 ${esc(data.receiptNo)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: "Hiragino Kaku Gothic ProN", "Noto Sans JP", system-ui, sans-serif;
    color: #1f2733;
    margin: 0;
    padding: 40px;
    background: #fff;
  }
  .sheet { max-width: 720px; margin: 0 auto; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; }
  h1 {
    font-size: 30px; letter-spacing: 12px; margin: 0 0 4px;
    border-bottom: 3px solid #1f2733; padding-bottom: 6px; display: inline-block;
  }
  .meta { text-align: right; font-size: 13px; color: #555; line-height: 1.7; }
  .to { margin-top: 28px; font-size: 18px; }
  .to .line { display: inline-block; min-width: 260px; border-bottom: 1px solid #888; padding-bottom: 2px; }
  .amount-box {
    margin: 22px 0; border: 2px solid #1f2733; border-radius: 8px;
    padding: 14px 18px; display: flex; align-items: baseline; gap: 16px;
  }
  .amount-box .label { font-size: 15px; font-weight: 700; }
  .amount-box .value { font-size: 30px; font-weight: 800; letter-spacing: 1px; }
  .note { font-size: 14px; margin-bottom: 8px; }
  .note .line { border-bottom: 1px solid #bbb; padding: 0 6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 13px; }
  th, td { border: 1px solid #d6dae3; padding: 8px 10px; text-align: left; }
  th { background: #f4f6fb; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  tfoot td { font-weight: 700; background: #f9fafd; }
  .issuer { margin-top: 36px; font-size: 13px; line-height: 1.8; }
  .issuer-label { text-align: right; color: #555; }
  .issuer-row { display: flex; justify-content: flex-end; align-items: flex-end; gap: 14px; }
  .issuer-info { text-align: right; }
  .issuer-info .name { font-size: 17px; font-weight: 700; margin-bottom: 2px; }
  .stamp-area svg { display: block; }
  .stamp {
    display: inline-block; width: 56px; height: 56px; border: 2px solid #d33;
    border-radius: 50%; color: #d33; font-size: 11px; text-align: center;
    line-height: 56px;
  }
  .hint { margin-top: 30px; font-size: 12px; color: #888; }
  .toolbar {
    position: sticky; top: 0; background: #f4f6fb; padding: 12px 0;
    margin: -40px -40px 24px; text-align: center; border-bottom: 1px solid #e5e8f0;
  }
  .toolbar button {
    font: inherit; font-weight: 700; color: #fff; background: #4f46e5;
    border: none; border-radius: 8px; padding: 10px 22px; cursor: pointer;
  }
  @media print {
    body { padding: 0; }
    .hint, .toolbar { display: none; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">🖨️ PDFとして保存 / 印刷</button>
  </div>
  <div class="sheet">
    <div class="head">
      <div><h1>領収書</h1></div>
      <div class="meta">
        No. ${esc(data.receiptNo)}<br/>
        発行日: ${esc(data.issuedDate)}
      </div>
    </div>

    <div class="to"><span class="line">${esc(data.issuedTo)}</span> ${esc(
    data.honorific
  )}</div>

    <div class="amount-box">
      <span class="label">金額</span>
      <span class="value">${yen(data.amount)} -</span>
    </div>

    <div class="note">
      但し、<span class="line">SNS運用業務の報酬として（${esc(data.periodLabel)}分）</span>
    </div>
    <div class="note">上記、正に領収いたしました。</div>

    <table>
      <thead>
        <tr><th>日付</th><th>内容</th><th class="num">稼働</th><th class="num">金額</th></tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td colspan="3">合計</td><td class="num">${yen(data.amount)}</td></tr>
      </tfoot>
    </table>

    <div class="issuer">
      <div class="issuer-label">発行者</div>
      <div class="issuer-row">
        <div class="issuer-info">
          <div class="name">${esc(data.issuerName)}</div>
          ${data.issuerInfo?.postalCode ? `〒${esc(data.issuerInfo.postalCode)}<br/>` : ""}
          ${data.issuerInfo?.address ? `${esc(data.issuerInfo.address)}<br/>` : ""}
          ${data.issuerInfo?.phone ? `TEL: ${esc(data.issuerInfo.phone)}<br/>` : ""}
          ${data.issuerInfo?.email ? `${esc(data.issuerInfo.email)}` : ""}
        </div>
        <div class="stamp-area">${
          data.stampSvg ? data.stampSvg : '<span class="stamp">印</span>'
        }</div>
      </div>
    </div>

    <div class="hint">
      ※ 上の「PDFとして保存 / 印刷」ボタンを押し、印刷ダイアログで「PDFとして保存」を選んでください。
    </div>
  </div>
</body>
</html>`);
  w.document.close();
}
