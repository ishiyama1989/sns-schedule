// localStorage を使った簡易データストア（プロトタイプ用）
// 本番ではこの層をサーバAPI（DB）に差し替える想定です。

import type {
  AppRequest,
  Availability,
  CommentTemplate,
  PayConfirmation,
  Recipient,
  RecipientType,
  ScheduleEvent,
  User,
  VideoTask,
} from "./types";

const KEYS = {
  users: "sns_users",
  events: "sns_events",
  avail: "sns_availability",
  session: "sns_session",
  templates: "sns_comment_templates",
  requests: "sns_requests",
  payConf: "sns_pay_confirmations",
  recipients: "sns_recipients",
  videoTasks: "sns_video_tasks",
  version: "sns_schema_version",
};

// データ構造を変えたらここを上げる。旧データは初期化される。
const SCHEMA_VERSION = "3";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ---- 初回起動時にオーナーアカウントとサンプルを用意 ----
export function seedIfEmpty(): void {
  // 旧バージョン（メール+パスワード形式）のデータは構造が変わったため一旦リセット
  if (read<string | null>(KEYS.version, null) !== SCHEMA_VERSION) {
    [
      KEYS.users,
      KEYS.events,
      KEYS.avail,
      KEYS.templates,
      KEYS.requests,
      KEYS.payConf,
      KEYS.recipients,
      KEYS.session,
    ].forEach((k) => localStorage.removeItem(k));
    write(KEYS.version, SCHEMA_VERSION);
  }

  if (read<User[]>(KEYS.users, []).length > 0) return;

  const owner: User = {
    id: uid(),
    name: "管理者",
    password: "0000",
    role: "owner",
    hourlyRate: 0,
  };
  const taro: User = {
    id: uid(),
    name: "山田 太郎",
    password: "1234",
    role: "member",
    hourlyRate: 1500,
  };
  const maya: User = {
    id: uid(),
    name: "maya",
    password: "0000",
    role: "member",
    hourlyRate: 2000,
  };
  const yuka: User = {
    id: uid(),
    name: "yuka",
    password: "0000",
    role: "member",
    hourlyRate: 1800,
  };
  write<User[]>(KEYS.users, [owner, taro, maya, yuka]);

  const base = new Date();
  const d = (offset: number) => {
    const x = new Date(base);
    x.setDate(base.getDate() + offset);
    return x.toISOString().slice(0, 10);
  };

  const events: ScheduleEvent[] = [
    // 山田 太郎
    {
      id: uid(), date: d(1), type: "shooting",
      title: "カフェ案件 撮影", location: "渋谷スタジオ",
      assigneeIds: [taro.id], start: "10:00", end: "16:00",
      note: "リール用素材を撮影",
    },
    {
      id: uid(), date: d(3), type: "other",
      title: "投稿編集・予約", location: "リモート",
      assigneeIds: [taro.id], start: "13:00", end: "17:00", note: "",
    },
    {
      id: uid(), date: d(5), type: "delivery",
      title: "カフェ案件 納品", location: "オンライン",
      assigneeIds: [taro.id], start: "12:00", end: "12:30",
      note: "クライアントへ共有",
    },
    // maya
    {
      id: uid(), date: d(2), type: "shooting",
      title: "コスメブランド撮影", location: "表参道スタジオ",
      assigneeIds: [maya.id], start: "10:00", end: "15:00",
      note: "商品撮影・モデル有り",
    },
    {
      id: uid(), date: d(4), type: "meeting",
      title: "クライアントMTG", location: "オンライン（Zoom）",
      assigneeIds: [maya.id], start: "14:00", end: "15:30", note: "",
    },
    {
      id: uid(), date: d(8), type: "delivery",
      title: "コスメ案件 納品", location: "オンライン",
      assigneeIds: [maya.id], start: "12:00", end: "12:30", note: "",
    },
    {
      id: uid(), date: d(11), type: "shooting",
      title: "カフェ新メニュー撮影", location: "渋谷カフェ",
      assigneeIds: [maya.id], start: "09:00", end: "13:00",
      note: "フード撮影",
    },
    {
      id: uid(), date: d(15), type: "other",
      title: "投稿スケジュール作成", location: "リモート",
      assigneeIds: [maya.id], start: "13:00", end: "16:00", note: "",
    },
    // yuka
    {
      id: uid(), date: d(1), type: "shooting",
      title: "アパレル春コーデ撮影", location: "代官山",
      assigneeIds: [yuka.id], start: "11:00", end: "17:00",
      note: "ルック撮影5セット",
    },
    {
      id: uid(), date: d(3), type: "meeting",
      title: "月次報告MTG", location: "オンライン",
      assigneeIds: [yuka.id], start: "10:00", end: "11:00", note: "",
    },
    {
      id: uid(), date: d(7), type: "shooting",
      title: "インスタ用リール撮影", location: "青山スタジオ",
      assigneeIds: [yuka.id, maya.id], start: "13:00", end: "18:00",
      note: "リール3本分",
    },
    {
      id: uid(), date: d(10), type: "delivery",
      title: "アパレル案件 納品", location: "オンライン",
      assigneeIds: [yuka.id], start: "15:00", end: "15:30", note: "",
    },
    {
      id: uid(), date: d(13), type: "other",
      title: "SNS分析レポート作成", location: "リモート",
      assigneeIds: [yuka.id], start: "14:00", end: "17:00", note: "",
    },
    // maya + yuka 合同
    {
      id: uid(), date: d(6), type: "shooting",
      title: "ジュエリーブランド撮影", location: "銀座スタジオ",
      assigneeIds: [maya.id, yuka.id], start: "10:00", end: "16:00",
      note: "新作コレクション撮影",
    },
  ];
  write<ScheduleEvent[]>(KEYS.events, events);

  const avail: Availability[] = [
    // maya
    { userId: maya.id, date: d(0), slots: ["allday"], comment: "終日OK" },
    { userId: maya.id, date: d(2), slots: ["morning", "afternoon"], comment: "午前・午後のみ" },
    { userId: maya.id, date: d(5), slots: ["afternoon", "evening"], comment: "" },
    { userId: maya.id, date: d(9), slots: ["allday"], comment: "" },
    { userId: maya.id, date: d(12), slots: ["morning"], comment: "午前のみ" },
    { userId: maya.id, date: d(16), slots: ["allday"], comment: "撮影後も対応可" },
    // yuka
    { userId: yuka.id, date: d(0), slots: ["afternoon", "evening"], comment: "午後から空いてます" },
    { userId: yuka.id, date: d(2), slots: ["allday"], comment: "" },
    { userId: yuka.id, date: d(6), slots: ["morning", "afternoon"], comment: "" },
    { userId: yuka.id, date: d(9), slots: ["allday"], comment: "終日空き" },
    { userId: yuka.id, date: d(14), slots: ["evening", "night"], comment: "夕方以降OK" },
    { userId: yuka.id, date: d(17), slots: ["allday"], comment: "" },
  ];
  write<Availability[]>(KEYS.avail, avail);
}

// ---- ユーザー ----
export function getUsers(): User[] {
  return read<User[]>(KEYS.users, []);
}
export function saveUsers(users: User[]): void {
  write(KEYS.users, users);
}
export function getMembers(): User[] {
  return getUsers().filter((u) => u.role === "member");
}

export function registerUser(input: {
  name: string;
  password: string;
  postalCode?: string;
  address?: string;
  phone?: string;
  email?: string;
}): { ok: true; user: User } | { ok: false; error: string } {
  const users = getUsers();
  const name = input.name.trim();
  if (users.some((u) => u.name === name)) {
    return { ok: false, error: "この名前は既に登録されています" };
  }
  const user: User = {
    id: uid(),
    name,
    password: input.password,
    role: "member",
    hourlyRate: 0,
    postalCode: input.postalCode?.trim() || undefined,
    address: input.address?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    email: input.email?.trim() || undefined,
  };
  saveUsers([...users, user]);
  return { ok: true, user };
}

// メンバー自身がプロフィール・印影を更新
export function updateUserProfile(
  userId: string,
  fields: {
    postalCode?: string;
    address?: string;
    phone?: string;
    email?: string;
    stamp?: User["stamp"];
  }
): User | null {
  let updated: User | null = null;
  saveUsers(
    getUsers().map((u) => {
      if (u.id !== userId) return u;
      updated = {
        ...u,
        postalCode: fields.postalCode?.trim() || undefined,
        address: fields.address?.trim() || undefined,
        phone: fields.phone?.trim() || undefined,
        email: fields.email?.trim() || undefined,
        stamp: fields.stamp,
      };
      return updated;
    })
  );
  return updated;
}

export function login(
  name: string,
  password: string
): { ok: true; user: User } | { ok: false; error: string } {
  const user = getUsers().find(
    (u) => u.name === name.trim() && u.password === password
  );
  if (!user) return { ok: false, error: "名前またはパスワードが違います" };
  write(KEYS.session, user.id);
  return { ok: true, user };
}

export function logout(): void {
  localStorage.removeItem(KEYS.session);
}

export function currentUser(): User | null {
  const id = read<string | null>(KEYS.session, null);
  if (!id) return null;
  return getUsers().find((u) => u.id === id) ?? null;
}

export function updateHourlyRate(userId: string, rate: number): void {
  const users = getUsers().map((u) =>
    u.id === userId ? { ...u, hourlyRate: rate } : u
  );
  saveUsers(users);
}

// オーナーがユーザー情報（名前・時給・任意でパスワード）を編集
export function updateUser(
  userId: string,
  fields: { name: string; hourlyRate: number; password?: string }
): { ok: true } | { ok: false; error: string } {
  const users = getUsers();
  if (!users.some((u) => u.id === userId))
    return { ok: false, error: "ユーザーが見つかりません" };
  const name = fields.name.trim();
  if (!name) return { ok: false, error: "名前を入力してください" };
  if (users.some((u) => u.id !== userId && u.name === name))
    return { ok: false, error: "この名前は既に使われています" };

  saveUsers(
    users.map((u) =>
      u.id === userId
        ? {
            ...u,
            name,
            hourlyRate: fields.hourlyRate,
            password: fields.password ? fields.password : u.password,
          }
        : u
    )
  );
  return { ok: true };
}

// ユーザー削除。関連する空き状況・予定の担当・定型文も掃除する
export function deleteUser(userId: string): void {
  saveUsers(getUsers().filter((u) => u.id !== userId));
  saveEvents(
    getEvents().map((e) => ({
      ...e,
      assigneeIds: e.assigneeIds.filter((id) => id !== userId),
    }))
  );
  write(
    KEYS.avail,
    getAvailability().filter((a) => a.userId !== userId)
  );
  write(
    KEYS.templates,
    read<CommentTemplate[]>(KEYS.templates, []).filter((t) => t.userId !== userId)
  );
}

// ---- 予定 ----
export function getEvents(): ScheduleEvent[] {
  return read<ScheduleEvent[]>(KEYS.events, []);
}
export function saveEvents(events: ScheduleEvent[]): void {
  write(KEYS.events, events);
}
export function upsertEvent(ev: ScheduleEvent): void {
  const events = getEvents();
  const idx = events.findIndex((e) => e.id === ev.id);
  if (idx >= 0) events[idx] = ev;
  else events.push(ev);
  saveEvents(events);
}
export function deleteEvent(id: string): void {
  saveEvents(getEvents().filter((e) => e.id !== id));
}

// ---- 空き状況 ----
export function getAvailability(): Availability[] {
  // 古い形式（statusのみ）が残っていても落ちないよう正規化
  return read<Availability[]>(KEYS.avail, []).map((a) => ({
    userId: a.userId,
    date: a.date,
    slots: Array.isArray(a.slots) ? a.slots : [],
    comment: typeof a.comment === "string" ? a.comment : "",
  }));
}

export function getAvailabilityFor(
  userId: string,
  date: string
): Availability | null {
  return getAvailability().find((a) => a.userId === userId && a.date === date) ?? null;
}

// スロットとコメントを保存。両方空なら登録を削除する。
export function setAvailability(
  userId: string,
  date: string,
  slots: Availability["slots"],
  comment: string
): void {
  const list = getAvailability().filter(
    (a) => !(a.userId === userId && a.date === date)
  );
  if (slots.length > 0 || comment.trim()) {
    list.push({ userId, date, slots, comment: comment.trim() });
  }
  write(KEYS.avail, list);
}

// その日に空き登録のあるメンバーの一覧（スロット・コメント付き）
export function availabilityOn(date: string): Availability[] {
  return getAvailability().filter(
    (a) => a.date === date && (a.slots.length > 0 || a.comment)
  );
}

// ---- コメント定型文（ユーザーごと） ----
export function getCommentTemplates(userId: string): CommentTemplate[] {
  return read<CommentTemplate[]>(KEYS.templates, []).filter(
    (t) => t.userId === userId
  );
}

export function addCommentTemplate(userId: string, text: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  const all = read<CommentTemplate[]>(KEYS.templates, []);
  // 同じユーザーの同じ文言は重複登録しない
  if (all.some((t) => t.userId === userId && t.text === trimmed)) return;
  all.push({ id: uid(), userId, text: trimmed });
  write(KEYS.templates, all);
}

export function deleteCommentTemplate(id: string): void {
  const all = read<CommentTemplate[]>(KEYS.templates, []).filter(
    (t) => t.id !== id
  );
  write(KEYS.templates, all);
}

// ---- 依頼（申請） ----
export function getRequests(): AppRequest[] {
  return read<AppRequest[]>(KEYS.requests, []);
}
function saveRequests(rs: AppRequest[]): void {
  write(KEYS.requests, rs);
}

// オーナーがメンバーへ依頼を送る（承認待ちで作成）
export function addRequest(
  input: Omit<AppRequest, "id" | "status">
): void {
  const rs = getRequests();
  rs.push({ ...input, id: uid(), status: "pending" });
  saveRequests(rs);
}

export function requestsOn(date: string): AppRequest[] {
  return getRequests().filter((r) => r.date === date);
}

// メンバー宛ての承認待ち依頼
export function pendingRequestsForUser(userId: string): AppRequest[] {
  return getRequests().filter(
    (r) => r.toUserId === userId && r.status === "pending"
  );
}

// メンバー宛ての全依頼（履歴含む）。新しい日付順
export function requestsForUser(userId: string): AppRequest[] {
  return getRequests()
    .filter((r) => r.toUserId === userId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

// 承認 → 予定としてカレンダーに登録
export function approveRequest(id: string): void {
  const rs = getRequests();
  const r = rs.find((x) => x.id === id);
  if (!r || r.status !== "pending") return;
  r.status = "approved";
  saveRequests(rs);
  upsertEvent({
    id: uid(),
    date: r.date,
    type: r.type,
    title: r.title,
    location: r.location,
    assigneeIds: [r.toUserId],
    start: r.start,
    end: r.end,
    note: r.note,
  });
}

export function rejectRequest(id: string): void {
  const rs = getRequests();
  const r = rs.find((x) => x.id === id);
  if (!r || r.status !== "pending") return;
  r.status = "rejected";
  saveRequests(rs);
}

// ---- 報酬の確認依頼 ----
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getPayConfirmations(): PayConfirmation[] {
  return read<PayConfirmation[]>(KEYS.payConf, []);
}
function savePayConfirmations(list: PayConfirmation[]): void {
  write(KEYS.payConf, list);
}

export function payConfirmationFor(
  userId: string,
  quarter: string
): PayConfirmation | null {
  return (
    getPayConfirmations().find(
      (p) => p.userId === userId && p.quarter === quarter
    ) ?? null
  );
}

// オーナーが報酬を確定して確認依頼を送る（既存があれば上書きして再依頼）
export function requestPayConfirmation(
  userId: string,
  quarter: string,
  amount: number,
  hours: number
): void {
  const list = getPayConfirmations();
  const idx = list.findIndex(
    (p) => p.userId === userId && p.quarter === quarter
  );
  const rec: PayConfirmation = {
    id: idx >= 0 ? list[idx].id : uid(),
    userId,
    quarter,
    amount,
    hours,
    status: "requested",
    requestedAt: today(),
  };
  if (idx >= 0) list[idx] = rec;
  else list.push(rec);
  savePayConfirmations(list);
}

// メンバーが内容を確認
export function confirmPayConfirmation(id: string): void {
  const list = getPayConfirmations();
  const p = list.find((x) => x.id === id);
  if (!p || p.status !== "requested") return;
  p.status = "confirmed";
  p.confirmedAt = today();
  savePayConfirmations(list);
}

export function pendingPayConfirmationsForUser(
  userId: string
): PayConfirmation[] {
  return getPayConfirmations().filter(
    (p) => p.userId === userId && p.status === "requested"
  );
}

// ---- 宛名帳（領収書の宛先） ----
export function getRecipients(userId: string): Recipient[] {
  return read<Recipient[]>(KEYS.recipients, []).filter(
    (r) => r.userId === userId
  );
}

export function addRecipient(
  userId: string,
  name: string,
  type: RecipientType
): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  const all = read<Recipient[]>(KEYS.recipients, []);
  // 同じユーザー・同名・同種別の重複は登録しない
  if (
    all.some(
      (r) => r.userId === userId && r.name === trimmed && r.type === type
    )
  )
    return;
  all.push({ id: uid(), userId, name: trimmed, type });
  write(KEYS.recipients, all);
}

export function deleteRecipient(id: string): void {
  write(
    KEYS.recipients,
    read<Recipient[]>(KEYS.recipients, []).filter((r) => r.id !== id)
  );
}

// ---- 動画編集依頼（依頼管理） ----
export function getVideoTasks(): VideoTask[] {
  return read<VideoTask[]>(KEYS.videoTasks, []);
}

function saveVideoTasks(tasks: VideoTask[]): void {
  write(KEYS.videoTasks, tasks);
}

export function addVideoTask(
  data: Omit<VideoTask, "id" | "status" | "createdAt">
): void {
  const tasks = getVideoTasks();
  tasks.push({ ...data, id: uid(), status: "pending", createdAt: today() });
  saveVideoTasks(tasks);
}

export function updateVideoTask(id: string, patch: Partial<VideoTask>): void {
  saveVideoTasks(getVideoTasks().map((t) => (t.id === id ? { ...t, ...patch } : t)));
}

export function pendingVideoTasksForUser(userId: string): VideoTask[] {
  return getVideoTasks().filter((t) => t.toUserId === userId && t.status === "pending");
}

export function submittedVideoTasksCount(): number {
  return getVideoTasks().filter((t) => t.status === "submitted").length;
}
