import { useEffect, useState } from "react";
import "./App.css";
import {
  getCurrentEmail,
  getMyOrg,
  getMyProfile,
  signOut,
  type Org,
  type Profile,
} from "./lib/auth";
import { supabase } from "./lib/supabase";
import Auth from "./components/Auth";
import CreateOrg from "./components/CreateOrg";

type Stage = "loading" | "anon" | "needOrg" | "ready";

// SaaS版の入口。認証→組織作成→（今後）本体アプリ、をゲートする。
export default function AppShell() {
  const [stage, setStage] = useState<Stage>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  async function refresh() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setStage("anon");
      return;
    }
    setEmail(await getCurrentEmail());
    const p = await getMyProfile();
    if (!p) {
      setStage("needOrg");
      return;
    }
    setProfile(p);
    setOrg(await getMyOrg());
    setStage("ready");
  }

  useEffect(() => {
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => refresh());
    return () => sub.subscription.unsubscribe();
  }, []);

  if (stage === "loading")
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>読み込み中...</p>
      </div>
    );
  if (stage === "anon") return <Auth onLoggedIn={refresh} />;
  if (stage === "needOrg") return <CreateOrg onCreated={refresh} />;

  // 認証＋組織OK。ここに本体アプリ（カレンダー等）を順次組み込む。
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <span className="logo"><span className="logo-dot" />SNS Schedule</span>
        </div>
        <div className="topbar-right">
          <span className="user-badge">
            {org?.name} ／ {profile?.name}
            <span className={`role ${profile?.role}`}>
              {profile?.role === "owner" ? "管理者" : "メンバー"}
            </span>
          </span>
          <button
            className="ghost"
            onClick={async () => {
              await signOut();
              refresh();
            }}
          >
            ログアウト
          </button>
        </div>
      </header>
      <main className="content">
        <div className="section-head">
          <h2>セットアップ完了 🎉</h2>
          <p className="muted">
            ログイン・会社作成・データ分離（RLS）の土台ができました。<br />
            ログイン中：{email}<br />
            会社：{org?.name}（あなたは{profile?.role === "owner" ? "管理者" : "メンバー"}）<br />
            <br />
            次のステップで、カレンダー・報酬・案件などの機能をこの中に組み込んでいきます。
          </p>
        </div>
      </main>
    </div>
  );
}
