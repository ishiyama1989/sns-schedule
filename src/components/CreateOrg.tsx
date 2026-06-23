import { useState } from "react";
import { createOrg, signOut } from "../lib/auth";

// サインアップ後、最初に会社（組織）とオーナー名を作成する画面
export default function CreateOrg({ onCreated }: { onCreated: () => void }) {
  const [orgName, setOrgName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!orgName.trim() || !ownerName.trim()) {
      setError("会社名とお名前を入力してください");
      return;
    }
    setBusy(true);
    const res = await createOrg(orgName, ownerName);
    setBusy(false);
    if (res.ok) onCreated();
    else setError(res.error);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <span className="logo"><span className="logo-dot" />ようこそ</span>
        <p className="muted">あなたの会社（チーム）を作成しましょう。あなたが管理者になります。</p>

        <label>
          会社・チーム名
          <input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="例: ○○運用代行"
          />
        </label>
        <label>
          あなたのお名前
          <input
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="例: 石田 桃花"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button className="primary full" disabled={busy} onClick={submit}>
          {busy ? "作成中…" : "会社を作成して始める"}
        </button>
        <button className="ghost full" onClick={async () => { await signOut(); location.reload(); }}>
          ログアウト
        </button>
      </div>
    </div>
  );
}
