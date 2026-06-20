import { useState } from "react";
import type {
  StampFont,
  StampOrientation,
  StampShape,
  User,
} from "../types";
import { updateUserProfile } from "../store";
import { STAMP_FONTS, stampSvg } from "../lib/stamp";

// メンバーが自分のプロフィール（住所等）とデジタル印影を設定する画面
export default function ProfileSettings({
  me,
  onUpdated,
}: {
  me: User;
  onUpdated: (u: User) => void;
}) {
  const [postalCode, setPostalCode] = useState(me.postalCode ?? "");
  const [address, setAddress] = useState(me.address ?? "");
  const [phone, setPhone] = useState(me.phone ?? "");
  const [email, setEmail] = useState(me.email ?? "");

  const [stampOn, setStampOn] = useState(!!me.stamp);
  const [stampText, setStampText] = useState(
    me.stamp?.text ?? me.name.split(/\s+/)[0] // 既定は苗字
  );
  const [stampShape, setStampShape] = useState<StampShape>(
    me.stamp?.shape ?? "circle"
  );
  const [stampOrientation, setStampOrientation] = useState<StampOrientation>(
    me.stamp?.orientation ?? "vertical"
  );
  const [stampFont, setStampFont] = useState<StampFont>(
    me.stamp?.font ?? "mincho"
  );
  const [saved, setSaved] = useState(false);

  function save() {
    const updated = updateUserProfile(me.id, {
      postalCode,
      address,
      phone,
      email,
      stamp:
        stampOn && stampText.trim()
          ? {
              text: stampText.trim(),
              shape: stampShape,
              orientation: stampOrientation,
              font: stampFont,
            }
          : undefined,
    });
    if (updated) {
      onUpdated(updated);
      setSaved(true);
    }
  }

  return (
    <div className="settings-view">
      <div className="section-head">
        <h2>ユーザー設定</h2>
        <p className="muted">
          ここで登録した情報は、領収書の発行時に自動で反映されます。
        </p>
      </div>

      <div className="settings-card">
        <h3>プロフィール（領収書の発行者欄に表示）</h3>
        <label>
          郵便番号
          <input
            value={postalCode}
            onChange={(e) => {
              setPostalCode(e.target.value);
              setSaved(false);
            }}
            placeholder="123-4567"
          />
        </label>
        <label>
          住所
          <input
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setSaved(false);
            }}
            placeholder="東京都渋谷区○○ 1-2-3"
          />
        </label>
        <div className="row">
          <label>
            電話番号
            <input
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setSaved(false);
              }}
              placeholder="090-1234-5678"
            />
          </label>
          <label>
            メールアドレス
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSaved(false);
              }}
              placeholder="you@example.com"
            />
          </label>
        </div>
      </div>

      <div className="settings-card">
        <h3>デジタル印影</h3>
        <label className="check-line">
          <input
            type="checkbox"
            checked={stampOn}
            onChange={(e) => {
              setStampOn(e.target.checked);
              setSaved(false);
            }}
          />
          領収書に印影を使用する
        </label>

        {stampOn && (
          <div className="stamp-editor">
            <div className="stamp-fields">
              <label>
                印影の文字（苗字や名前）
                <input
                  value={stampText}
                  onChange={(e) => {
                    setStampText(e.target.value);
                    setSaved(false);
                  }}
                  placeholder="例: 山田"
                  maxLength={9}
                />
              </label>
              <div className="row">
                <label>
                  向き
                  <div className="shape-toggle">
                    {(["vertical", "horizontal"] as StampOrientation[]).map((o) => (
                      <button
                        key={o}
                        type="button"
                        className={`type-btn ${stampOrientation === o ? "on" : ""}`}
                        onClick={() => {
                          setStampOrientation(o);
                          setSaved(false);
                        }}
                      >
                        {o === "vertical" ? "縦書き" : "横書き"}
                      </button>
                    ))}
                  </div>
                </label>
                <label>
                  形
                  <div className="shape-toggle">
                    {(["circle", "square"] as StampShape[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`type-btn ${stampShape === s ? "on" : ""}`}
                        onClick={() => {
                          setStampShape(s);
                          setSaved(false);
                        }}
                      >
                        {s === "circle" ? "丸" : "角"}
                      </button>
                    ))}
                  </div>
                </label>
              </div>
              <label>
                フォント
                <div className="font-toggle">
                  {(Object.keys(STAMP_FONTS) as StampFont[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`type-btn ${stampFont === f ? "on" : ""}`}
                      style={{ fontFamily: STAMP_FONTS[f].family }}
                      onClick={() => {
                        setStampFont(f);
                        setSaved(false);
                      }}
                    >
                      {STAMP_FONTS[f].label}
                    </button>
                  ))}
                </div>
              </label>
            </div>
            <div className="stamp-preview">
              <span className="muted small">プレビュー</span>
              <div
                className="stamp-svg"
                dangerouslySetInnerHTML={{
                  __html: stampSvg(
                    stampText || "印",
                    stampShape,
                    stampOrientation,
                    stampFont,
                    88
                  ),
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="settings-actions">
        <button className="primary" onClick={save}>
          {saved ? "保存しました ✓" : "設定を保存"}
        </button>
      </div>
    </div>
  );
}
