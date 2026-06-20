import { useMemo, useRef, useState } from "react";
import { Clock as ClockIcon, MapPin, User as UserIcon, Search, ChevronDown } from "lucide-react";
import {
  EVENT_TYPE_COLOR,
  EVENT_TYPE_LABEL,
  EVENT_TYPES,
  REQUEST_STATUS_LABEL,
  SLOT_LABEL,
  type EventType,
  type ScheduleEvent,
  type User,
} from "../types";
import {
  addRequest,
  availabilityOn,
  deleteEvent,
  getAvailability,
  getEvents,
  getMembers,
  getUsers,
  pendingPayConfirmationsForUser,
  pendingRequestsForUser,
  requestsOn,
  upsertEvent,
  uid,
} from "../store";
import { WEEKDAYS, monthGrid, todayStr, ymd } from "../lib/date";
import MapLinks from "./MapLinks";

export default function Calendar({
  me,
  onOpenRequests,
  onOpenMyPay,
}: {
  me: User;
  onOpenRequests?: () => void;
  onOpenMyPay?: () => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState<string | null>(null);
  const [version, setVersion] = useState(0); // 再描画トリガ
  // ドラッグ&ドロップ（管理者のみ予定を移動できる）
  const draggingId = useRef<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const isOwner = me.role === "owner";
  const events = useMemo(() => getEvents(), [version]);
  const users = useMemo(() => getUsers(), [version]);
  const grid = useMemo(() => monthGrid(year, month), [year, month]);

  // 稼働日検索（管理者のみ）
  const [searchSelected, setSearchSelected] = useState<string[]>([]);
  const allMembers = useMemo(() => (isOwner ? getMembers() : []), [isOwner, version]);
  const availByDateIds = useMemo(() => {
    if (!isOwner) return {} as Record<string, Set<string>>;
    const map: Record<string, Set<string>> = {};
    for (const a of getAvailability())
      if (a.slots.length > 0 || a.comment)
        (map[a.date] ??= new Set()).add(a.userId);
    return map;
  }, [version, isOwner]);
  const searchMatchDates = useMemo(() => {
    if (searchSelected.length === 0) return new Set<string>();
    return new Set(
      Object.keys(availByDateIds).filter((d) =>
        searchSelected.every((id) => availByDateIds[d].has(id))
      )
    );
  }, [availByDateIds, searchSelected]);

  // メンバー：承認待ちの依頼（トップ画面で目立たせる）
  const pending = useMemo(
    () => (me.role === "member" ? pendingRequestsForUser(me.id) : []),
    [version, me]
  );
  // メンバー：報酬の確認依頼
  const pendingPay = useMemo(
    () => (me.role === "member" ? pendingPayConfirmationsForUser(me.id) : []),
    [version, me]
  );

  const eventsByDate = useMemo(() => {
    const map: Record<string, ScheduleEvent[]> = {};
    for (const e of events) (map[e.date] ??= []).push(e);
    return map;
  }, [events]);

  // 日付ごとの「空きを設定したメンバー情報（名前＋時間帯）」（オーナー用）
  const availNamesByDate = useMemo(() => {
    const nameById: Record<string, string> = {};
    for (const u of users) if (u.role === "member") nameById[u.id] = u.name;
    const map: Record<string, { name: string; slots: string[] }[]> = {};
    for (const a of getAvailability())
      if ((a.slots.length > 0 || a.comment) && nameById[a.userId])
        (map[a.date] ??= []).push({
          name: nameById[a.userId],
          slots: a.slots.map((s) => SLOT_LABEL[s]),
        });
    return map;
  }, [version, users]);

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }
  function refresh() {
    setVersion((v) => v + 1);
  }

  return (
    <div className="cal-layout">
      <div className="cal-main full">
        {isOwner && (
          <div className="search-panel">
            <div className="search-panel-head">
              <Search size={13} strokeWidth={2} />
              稼働日検索
              {searchSelected.length > 0 && searchMatchDates.size > 0 && (
                <span className="search-badge">{searchMatchDates.size}日</span>
              )}
            </div>
            <div className="search-body">
              <div className="search-chips">
                {allMembers.map((m) => (
                  <button
                    key={m.id}
                    className={`pick ${searchSelected.includes(m.id) ? "on" : ""}`}
                    onClick={() =>
                      setSearchSelected((cur) =>
                        cur.includes(m.id) ? cur.filter((x) => x !== m.id) : [...cur, m.id]
                      )
                    }
                  >
                    {m.name}
                  </button>
                ))}
                <button className="ghost mini" onClick={() => setSearchSelected(allMembers.map((m) => m.id))}>全員</button>
                <button className="ghost mini" onClick={() => setSearchSelected([])}>クリア</button>
              </div>
              {searchSelected.length > 0 && searchMatchDates.size === 0 && (
                <p className="muted small" style={{ marginTop: 10 }}>該当する日はありません</p>
              )}
              {searchMatchDates.size > 0 && (
                <div className="match-list" style={{ marginTop: 12, marginBottom: 0 }}>
                  {[...searchMatchDates].sort().map((d) => {
                    const avails = getAvailability().filter(
                      (a) => searchSelected.includes(a.userId) && a.date === d
                    );
                    return (
                      <div key={d} className="match-row">
                        <span className="match-date">{d.replace(/-/g, "/")}</span>
                        <div className="match-members">
                          {avails.map((a) => (
                            <span key={a.userId}>
                              {allMembers.find((m) => m.id === a.userId)?.name}：
                              {a.slots.map((s) => SLOT_LABEL[s]).join("・") || "—"}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        {pending.length > 0 && (
          <div className="pending-banner">
            <span className="pending-banner-text">
              承認待ちの依頼が <strong>{pending.length}件</strong> あります
            </span>
            {onOpenRequests && (
              <button className="primary" onClick={onOpenRequests}>
                確認する →
              </button>
            )}
          </div>
        )}
        {pendingPay.length > 0 && (
          <div className="pending-banner pay">
            <span className="pending-banner-text">
              報酬の確認依頼が <strong>{pendingPay.length}件</strong> あります
            </span>
            {onOpenMyPay && (
              <button className="primary" onClick={onOpenMyPay}>
                確認する →
              </button>
            )}
          </div>
        )}
        <div className="cal-header">
          <button onClick={() => shiftMonth(-1)}>‹</button>
          <h2>
            {year}年 {month + 1}月
          </h2>
          <button onClick={() => shiftMonth(1)}>›</button>
          <button
            className="today-btn"
            onClick={() => {
              setYear(now.getFullYear());
              setMonth(now.getMonth());
            }}
          >
            今日
          </button>
        </div>

        <div className="legend">
          {EVENT_TYPES.map((t) => (
            <span key={t}>
              <i style={{ background: EVENT_TYPE_COLOR[t] }} /> {EVENT_TYPE_LABEL[t]}
            </span>
          ))}
        </div>

        <div className="cal-grid">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={`cal-wd ${i === 0 ? "sun" : ""} ${i === 6 ? "sat" : ""}`}>
              {w}
            </div>
          ))}
          {grid.map((d) => {
            const ds = ymd(d);
            const inMonth = d.getMonth() === month;
            const dayEvents = eventsByDate[ds] ?? [];
            const isDragOver = dragOverDate === ds;
            const isSearchHit = searchMatchDates.has(ds);
            const isMyDay = !isOwner && inMonth && dayEvents.some((e) => e.assigneeIds.includes(me.id));
            return (
              <div
                key={ds}
                className={`cal-cell ${inMonth ? "" : "dim"} ${
                  ds === todayStr() ? "today" : ""
                } ${selected === ds ? "sel" : ""} ${isDragOver ? "drag-over" : ""} ${isSearchHit ? "hit" : ""} ${isMyDay ? "my-day" : ""}`}
                onClick={() => setSelected(ds)}
                onDragOver={isOwner ? (ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = "move"; setDragOverDate(ds); } : undefined}
                onDragLeave={isOwner ? (ev) => { if (!ev.currentTarget.contains(ev.relatedTarget as Node)) setDragOverDate(null); } : undefined}
                onDrop={isOwner ? (ev) => {
                  ev.preventDefault();
                  const id = draggingId.current;
                  if (id) {
                    const evt = events.find((e) => e.id === id);
                    if (evt && evt.date !== ds) {
                      upsertEvent({ ...evt, date: ds });
                      refresh();
                    }
                  }
                  draggingId.current = null;
                  setDragOverDate(null);
                } : undefined}
              >
                <div className="cal-date-row">
                  <span className="cal-date">{d.getDate()}</span>
                </div>
                {isOwner && availNamesByDate[ds] && (
                  <div className="cal-avail-names">
                    {availNamesByDate[ds].slice(0, 3).map((entry, i) => (
                      <span
                        key={i}
                        className="cal-avail-name"
                        title={`稼働: ${entry.name} ${entry.slots.join("・")}`}
                      >
                        {entry.name}
                        {entry.slots.length > 0 && (
                          <span className="cal-avail-slots">
                            {entry.slots.join("・")}
                          </span>
                        )}
                      </span>
                    ))}
                    {availNamesByDate[ds].length > 3 && (
                      <span className="cal-avail-name more">
                        +{availNamesByDate[ds].length - 3}
                      </span>
                    )}
                  </div>
                )}
                <div className="cal-events">
                  {dayEvents.slice(0, 3).map((e) => (
                    <div
                      key={e.id}
                      className={`cal-chip ${isOwner ? "draggable" : ""} ${!isOwner && e.assigneeIds.includes(me.id) ? "my-chip" : ""}`}
                      style={{ background: EVENT_TYPE_COLOR[e.type] }}
                      title={e.title}
                      draggable={isOwner}
                      onDragStart={isOwner ? (ev) => {
                        ev.stopPropagation();
                        draggingId.current = e.id;
                        ev.dataTransfer.effectAllowed = "move";
                        // ゴースト画像をチップ自体に（デフォルトで自動）
                      } : undefined}
                      onDragEnd={isOwner ? () => {
                        draggingId.current = null;
                        setDragOverDate(null);
                      } : undefined}
                    >
                      {e.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="cal-more">+{dayEvents.length - 3}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <DayPanel
          date={selected}
          me={me}
          users={users}
          events={eventsByDate[selected] ?? []}
          onClose={() => setSelected(null)}
          onChange={refresh}
        />
      )}
    </div>
  );
}

function DayPanel({
  date,
  me,
  users,
  events,
  onClose,
  onChange,
}: {
  date: string;
  me: User;
  users: User[];
  events: ScheduleEvent[];
  onClose: () => void;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState<ScheduleEvent | null>(null);
  const [requestTo, setRequestTo] = useState<User | null>(null);
  const availList = availabilityOn(date).filter((a) =>
    users.some((u) => u.id === a.userId && u.role === "member")
  );
  const dayRequests = requestsOn(date);

  function newEvent(): ScheduleEvent {
    return {
      id: uid(),
      date,
      type: "shooting",
      title: "",
      location: "",
      assigneeIds: [],
      start: "10:00",
      end: "12:00",
      note: "",
    };
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="day-panel modal" onClick={(e) => e.stopPropagation()}>
        <div className="day-panel-head">
          <h3>{date.replace(/-/g, "/")}</h3>
          <button className="ghost" onClick={onClose}>
            ✕
          </button>
        </div>

      {me.role === "owner" && (
        <div className="avail-box">
          <strong>この日に空いているメンバー</strong>
          <div className="avail-member-list">
            {availList.length === 0 ? (
              <span className="muted">登録なし</span>
            ) : (
              availList.map((a) => {
                const member = users.find((u) => u.id === a.userId);
                return (
                  <div key={a.userId} className="avail-member">
                    <span className="avail-chip">{member?.name ?? ""}</span>
                    <span className="avail-slots">
                      {a.slots.map((s) => SLOT_LABEL[s]).join("・") || "—"}
                    </span>
                    {a.comment && <span className="avail-comment">{a.comment}</span>}
                    {member && (
                      <button
                        className="ghost mini req-btn"
                        onClick={() => setRequestTo(member)}
                      >
                        依頼する
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {me.role === "owner" && requestTo && (
        <RequestForm
          date={date}
          fromUserId={me.id}
          toUser={requestTo}
          onCancel={() => setRequestTo(null)}
          onSent={() => {
            setRequestTo(null);
            onChange();
          }}
        />
      )}

      {me.role === "owner" && dayRequests.length > 0 && (
        <div className="req-box">
          <strong>送信した依頼</strong>
          {dayRequests.map((r) => (
            <div key={r.id} className="req-item">
              <span className={`req-status ${r.status}`}>
                {REQUEST_STATUS_LABEL[r.status]}
              </span>
              <span className="req-text">
                {users.find((u) => u.id === r.toUserId)?.name} ／ {r.title}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="event-list">
        {events.length === 0 && <p className="muted">予定はありません</p>}
        {events.map((e) => {
          const isMyEvent = me.role === "member" && e.assigneeIds.includes(me.id);
          const coAssignees = isMyEvent
            ? e.assigneeIds
                .filter((id) => id !== me.id)
                .map((id) => users.find((u) => u.id === id)?.name)
                .filter((n): n is string => !!n)
            : [];
          return (
          <div key={e.id} className={`event-item ${isMyEvent ? "my-event" : ""}`}>
            <span className="dot" style={{ background: EVENT_TYPE_COLOR[e.type] }} />
            <div className="event-body">
              <div className="event-title">
                {e.title}{" "}
                <span className="tag">{EVENT_TYPE_LABEL[e.type]}</span>
              </div>
              <div className="event-meta">
                <ClockIcon size={11} strokeWidth={2} style={{verticalAlign:"middle",marginRight:3}} />
                {e.start}–{e.end}
                <span style={{margin:"0 4px",opacity:.4}}>·</span>
                <MapPin size={11} strokeWidth={2} style={{verticalAlign:"middle",marginRight:3}} />
                {e.location || "場所未設定"}
              </div>
              {e.location && (
                <div className="event-meta">
                  <MapLinks query={e.location} />
                </div>
              )}
              <div className={`event-meta ${isMyEvent ? "event-companions" : ""}`}>
                <UserIcon size={11} strokeWidth={2} style={{verticalAlign:"middle",marginRight:3}} />
                {isMyEvent
                  ? coAssignees.length > 0
                    ? `同行: ${coAssignees.join(", ")}`
                    : "一人で参加"
                  : e.assigneeIds
                      .map((id) => users.find((u) => u.id === id)?.name)
                      .filter(Boolean)
                      .join(", ") || "未割当"}
              </div>
              {e.note && <div className="event-note">{e.note}</div>}
            </div>
            <div className="event-actions">
              <button className="ghost" onClick={() => setEditing(e)}>
                編集
              </button>
              {me.role === "owner" && (
                <button
                  className="ghost danger"
                  onClick={() => {
                    if (confirm("この予定を削除しますか？")) {
                      deleteEvent(e.id);
                      onChange();
                    }
                  }}
                >
                  削除
                </button>
              )}
            </div>
          </div>
          );
        })}
      </div>

      {editing ? (
        <EventForm
          value={editing}
          users={users}
          onCancel={() => setEditing(null)}
          onSave={(ev) => {
            upsertEvent(ev);
            setEditing(null);
            onChange();
          }}
        />
      ) : (
        <button className="primary full" onClick={() => setEditing(newEvent())}>
          ＋ 予定を追加
        </button>
      )}
        {me.role === "owner" && (
          <p className="muted small">
            ※ 撮影日・納品日もここで「種別」を選んで登録します
          </p>
        )}
      </div>
    </div>
  );
}

function EventForm({
  value,
  users,
  onCancel,
  onSave,
}: {
  value: ScheduleEvent;
  users: User[];
  onCancel: () => void;
  onSave: (e: ScheduleEvent) => void;
}) {
  const [draft, setDraft] = useState<ScheduleEvent>(value);
  const members = users.filter((u) => u.role === "member");

  function set<K extends keyof ScheduleEvent>(key: K, val: ScheduleEvent[K]) {
    setDraft((d) => ({ ...d, [key]: val }));
  }
  function toggleAssignee(id: string) {
    setDraft((d) => ({
      ...d,
      assigneeIds: d.assigneeIds.includes(id)
        ? d.assigneeIds.filter((x) => x !== id)
        : [...d.assigneeIds, id],
    }));
  }

  return (
    <div className="event-form">
      <label>
        何をするか
        <input
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="例: カフェ案件 撮影"
        />
      </label>
      <div className="row">
        <label>
          種別
          <select
            value={draft.type}
            onChange={(e) => set("type", e.target.value as EventType)}
          >
            <option value="shooting">撮影</option>
            <option value="meeting">会議</option>
            <option value="delivery">納品</option>
            <option value="other">その他</option>
          </select>
        </label>
        <label>
          場所
          <input
            value={draft.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="渋谷スタジオ / 住所など"
          />
          <MapLinks query={draft.location} />
        </label>
      </div>
      <div className="row">
        <label>
          開始
          <input type="time" value={draft.start} onChange={(e) => set("start", e.target.value)} />
        </label>
        <label>
          終了
          <input type="time" value={draft.end} onChange={(e) => set("end", e.target.value)} />
        </label>
      </div>
      <label>
        担当者
        <div className="assignee-chips">
          {members.length === 0 && <span className="muted">メンバー未登録</span>}
          {members.map((m) => (
            <button
              type="button"
              key={m.id}
              className={`pick ${draft.assigneeIds.includes(m.id) ? "on" : ""}`}
              onClick={() => toggleAssignee(m.id)}
            >
              {m.name}
            </button>
          ))}
        </div>
      </label>
      <label>
        メモ
        <textarea value={draft.note} onChange={(e) => set("note", e.target.value)} rows={2} />
      </label>
      <div className="form-actions">
        <button className="ghost" onClick={onCancel}>
          キャンセル
        </button>
        <button
          className="primary"
          onClick={() => {
            if (!draft.title.trim()) return alert("内容を入力してください");
            onSave({ ...draft, title: draft.title.trim() });
          }}
        >
          保存
        </button>
      </div>
    </div>
  );
}

// オーナーがメンバーへ依頼（申請）を送るフォーム
function RequestForm({
  date,
  fromUserId,
  toUser,
  onCancel,
  onSent,
}: {
  date: string;
  fromUserId: string;
  toUser: User;
  onCancel: () => void;
  onSent: () => void;
}) {
  const [type, setType] = useState<EventType>("shooting");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("12:00");
  const [note, setNote] = useState("");

  function send() {
    if (!title.trim()) return alert("依頼内容を入力してください");
    addRequest({
      date,
      fromUserId,
      toUserId: toUser.id,
      type,
      title: title.trim(),
      location,
      start,
      end,
      note,
    });
    onSent();
  }

  return (
    <div className="event-form req-form">
      <div className="req-form-head">
        <strong>{toUser.name}</strong> さんへ依頼
      </div>
      <label>
        依頼内容
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例: カフェ案件の撮影をお願いします"
        />
      </label>
      <div className="row">
        <label>
          種別
          <select value={type} onChange={(e) => setType(e.target.value as EventType)}>
            <option value="shooting">撮影</option>
            <option value="meeting">会議</option>
            <option value="delivery">納品</option>
            <option value="other">その他</option>
          </select>
        </label>
        <label>
          場所
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="渋谷スタジオ / 住所など"
          />
          <MapLinks query={location} />
        </label>
      </div>
      <div className="row">
        <label>
          開始
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label>
          終了
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      <label>
        メモ
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </label>
      <div className="form-actions">
        <button className="ghost" onClick={onCancel}>
          キャンセル
        </button>
        <button className="primary" onClick={send}>
          依頼を送る
        </button>
      </div>
    </div>
  );
}
