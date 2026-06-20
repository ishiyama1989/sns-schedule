import { useState } from "react";
import { deleteUser, getMembers, updateUser } from "../store";
import type { User } from "../types";

// オーナーが登録ユーザー（メンバー）の情報を編集・削除する画面
export default function OwnerMembers() {
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<User | null>(null);
  const members = getMembers();
  void version;

  function refresh() {
    setVersion((v) => v + 1);
  }

  return (
    <div className="members-view">
      <div className="section-head">
        <h2>メンバー管理</h2>
        <p className="muted">
          登録ユーザーの情報（名前・パスワード）を編集できます。削除も可能です。
        </p>
      </div>

      {members.length === 0 ? (
        <p className="muted">
          まだメンバーがいません。メンバーが新規登録するとここに表示されます。
        </p>
      ) : (
        <table className="members-table">
          <thead>
            <tr>
              <th>名前</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>
                  <div className="row-actions">
                    <button className="ghost" onClick={() => setEditing(m)}>
                      編集
                    </button>
                    <button
                      className="ghost danger"
                      onClick={() => {
                        if (
                          confirm(
                            `「${m.name}」を削除しますか？\nこのユーザーの空き状況や予定の担当からも外れます。`
                          )
                        ) {
                          deleteUser(m.id);
                          refresh();
                        }
                      }}
                    >
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <UserEditor
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function UserEditor({
  user,
  onClose,
  onSaved,
}: {
  user: User;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [rate, setRate] = useState(String(user.hourlyRate));
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function save() {
    if (password && !/^\d{4}$/.test(password))
      return setError("パスワードは4桁の数字で入力してください");
    const res = updateUser(user.id, {
      name,
      hourlyRate: Number(rate) || 0,
      password: password || undefined,
    });
    if (!res.ok) return setError(res.error);
    onSaved();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="day-panel modal" onClick={(e) => e.stopPropagation()}>
        <div className="day-panel-head">
          <h3>ユーザー情報の編集</h3>
          <button className="ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        <label>
          名前
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          時給（円）
          <input
            type="number"
            min={0}
            step={50}
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </label>
        <label>
          パスワードを変更（任意・4桁の数字）
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={password}
            onChange={(e) => setPassword(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="変更する場合のみ入力"
          />
        </label>

        {error && <p className="error">{error}</p>}

        <div className="form-actions">
          <button className="ghost" onClick={onClose}>
            キャンセル
          </button>
          <button className="primary" onClick={save}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
