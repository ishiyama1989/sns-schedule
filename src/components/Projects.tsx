import { useMemo, useRef, useState } from "react";
import {
  PROJECT_STATUS_LABEL,
  type Project,
  type ProjectStatus,
  type User,
} from "../types";
import {
  addMaterial,
  addProject,
  deleteMaterial,
  deleteProject,
  getMaterialsFor,
  getMembers,
  getProjects,
  updateProject,
} from "../store";
import { uploadMaterialFile } from "../lib/supabase";

const STATUS_ORDER: ProjectStatus[] = ["active", "paused", "done"];

export default function Projects({ me }: { me: User }) {
  const [version, setVersion] = useState(0);
  const projects = useMemo(() => getProjects(), [version]);
  const members = useMemo(() => getMembers(), [version]);

  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...projects].sort((a, b) => {
        const sa = STATUS_ORDER.indexOf(a.status);
        const sb = STATUS_ORDER.indexOf(b.status);
        if (sa !== sb) return sa - sb;
        return a.createdAt < b.createdAt ? 1 : -1;
      }),
    [projects]
  );

  const open = openId ? projects.find((p) => p.id === openId) ?? null : null;

  function refresh() {
    setVersion((v) => v + 1);
  }

  return (
    <div className="projects-view">
      <div className="section-head">
        <h2>案件一覧</h2>
        <p className="muted">
          請負中の案件と資料をチームで共有します。資料はリンクでもファイルでも追加できます。
        </p>
      </div>

      <div className="tasks-toolbar">
        <span className="muted small">{projects.length}件の案件</span>
        <button className="primary" onClick={() => setShowForm(true)}>
          ＋ 新規案件追加
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="muted" style={{ marginTop: 20 }}>
          まだ案件がありません。「新規案件追加」から登録してください。
        </p>
      ) : (
        <div className="project-cards">
          {sorted.map((p) => {
            const mats = getMaterialsFor(p.id);
            return (
              <button
                key={p.id}
                className="project-card"
                onClick={() => setOpenId(p.id)}
              >
                <div className="project-card-head">
                  <span className={`project-status ${p.status}`}>
                    {PROJECT_STATUS_LABEL[p.status]}
                  </span>
                  <span className="project-mat-count">📎 {mats.length}</span>
                </div>
                <div className="project-card-name">{p.name}</div>
                {p.description && (
                  <p className="project-card-desc">{p.description}</p>
                )}
                <div className="project-card-foot">
                  {p.assigneeIds
                    .map((id) => members.find((m) => m.id === id)?.name)
                    .filter(Boolean)
                    .map((n) => (
                      <span key={n} className="project-assignee">{n}</span>
                    ))}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showForm && (
        <ProjectForm
          members={members}
          onClose={() => setShowForm(false)}
          onSaved={(id) => {
            setShowForm(false);
            refresh();
            setOpenId(id);
          }}
        />
      )}

      {open && (
        <ProjectDetail
          me={me}
          project={open}
          members={members}
          onClose={() => setOpenId(null)}
          onChanged={refresh}
          onDeleted={() => {
            setOpenId(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function ProjectForm({
  members,
  onClose,
  onSaved,
}: {
  members: User[];
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [description, setDescription] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(today);
  const [error, setError] = useState("");

  function toggle(id: string) {
    setAssigneeIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
  }

  function save() {
    if (!name.trim()) {
      setError("案件名を入力してください");
      return;
    }
    const p = addProject({
      name: name.trim(),
      status,
      description: description.trim(),
      assigneeIds,
      startDate,
    });
    onSaved(p.id);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="day-panel modal" onClick={(e) => e.stopPropagation()}>
        <div className="day-panel-head">
          <h3>新規案件を追加</h3>
          <button className="ghost" onClick={onClose}>✕</button>
        </div>

        <label>
          案件名・クライアント名
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: ラクサ SNS運用"
          />
        </label>
        <div className="task-form-row">
          <label>
            ステータス
            <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </label>
          <label>
            開始日
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
        </div>
        <label>
          概要
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="案件の内容・進め方など"
          />
        </label>
        <label>担当メンバー</label>
        <div className="assignee-pick">
          {members.length === 0 ? (
            <span className="muted small">メンバーがいません</span>
          ) : (
            members.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`type-btn ${assigneeIds.includes(m.id) ? "on" : ""}`}
                onClick={() => toggle(m.id)}
              >
                {m.name}
              </button>
            ))
          )}
        </div>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button className="ghost" onClick={onClose}>キャンセル</button>
          <button className="primary" onClick={save}>案件を追加</button>
        </div>
      </div>
    </div>
  );
}

function ProjectDetail({
  me,
  project,
  members,
  onClose,
  onChanged,
  onDeleted,
}: {
  me: User;
  project: Project;
  members: User[];
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [description, setDescription] = useState(project.description);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(project.assigneeIds);

  const [matTitle, setMatTitle] = useState("");
  const [matUrl, setMatUrl] = useState("");
  const [matNote, setMatNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [v, setV] = useState(0);

  const materials = useMemo(() => getMaterialsFor(project.id), [project.id, v]);

  function refreshMats() {
    setV((x) => x + 1);
    onChanged();
  }

  function toggleAssignee(id: string) {
    setAssigneeIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
  }

  function saveInfo() {
    updateProject(project.id, {
      name: name.trim() || project.name,
      status,
      description: description.trim(),
      assigneeIds,
    });
    setEditing(false);
    onChanged();
  }

  function addLink() {
    if (!matTitle.trim() || !matUrl.trim()) {
      alert("タイトルとURLを入力してください");
      return;
    }
    addMaterial({
      projectId: project.id,
      title: matTitle.trim(),
      kind: "link",
      url: matUrl.trim(),
      note: matNote.trim() || undefined,
      createdBy: me.id,
    });
    setMatTitle("");
    setMatUrl("");
    setMatNote("");
    refreshMats();
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    const res = await uploadMaterialFile(project.id, file);
    if (res) {
      addMaterial({
        projectId: project.id,
        title: matTitle.trim() || file.name,
        kind: "file",
        url: res.url,
        filePath: res.path,
        note: matNote.trim() || undefined,
        createdBy: me.id,
      });
      setMatTitle("");
      setMatNote("");
      refreshMats();
    } else {
      setUploadMsg("アップロードに失敗しました（ストレージ設定をご確認ください）");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="day-panel modal project-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="day-panel-head">
          <h3>{editing ? "案件を編集" : project.name}</h3>
          <button className="ghost" onClick={onClose}>✕</button>
        </div>

        {editing ? (
          <>
            <label>
              案件名
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              ステータス
              <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</option>
                ))}
              </select>
            </label>
            <label>
              概要
              <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <label>担当メンバー</label>
            <div className="assignee-pick">
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`type-btn ${assigneeIds.includes(m.id) ? "on" : ""}`}
                  onClick={() => toggleAssignee(m.id)}
                >
                  {m.name}
                </button>
              ))}
            </div>
            <div className="form-actions">
              <button className="ghost danger" onClick={() => {
                if (confirm("この案件と資料を削除しますか？")) onDeleted2();
              }}>
                案件を削除
              </button>
              <button className="ghost" onClick={() => setEditing(false)}>キャンセル</button>
              <button className="primary" onClick={saveInfo}>保存</button>
            </div>
          </>
        ) : (
          <>
            <div className="project-info">
              <span className={`project-status ${project.status}`}>
                {PROJECT_STATUS_LABEL[project.status]}
              </span>
              <span className="muted small">開始 {project.startDate.replace(/-/g, "/")}</span>
              <button className="ghost mini" onClick={() => setEditing(true)}>編集</button>
            </div>
            {project.description && <p className="project-detail-desc">{project.description}</p>}
            {project.assigneeIds.length > 0 && (
              <div className="project-card-foot" style={{ marginBottom: 8 }}>
                担当：
                {project.assigneeIds
                  .map((id) => members.find((m) => m.id === id)?.name)
                  .filter(Boolean)
                  .map((n) => <span key={n} className="project-assignee">{n}</span>)}
              </div>
            )}

            <h4 className="material-head">資料（{materials.length}）</h4>
            <div className="material-list">
              {materials.length === 0 ? (
                <p className="muted small">まだ資料がありません。</p>
              ) : (
                materials.map((m) => (
                  <div key={m.id} className="material-row">
                    <span className="material-kind">{m.kind === "file" ? "📄" : "🔗"}</span>
                    <div className="material-body">
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="material-title">
                        {m.title}
                      </a>
                      {m.note && <div className="material-note">{m.note}</div>}
                    </div>
                    <button
                      className="material-del"
                      title="削除"
                      onClick={() => {
                        if (confirm("この資料を削除しますか？")) {
                          deleteMaterial(m.id);
                          refreshMats();
                        }
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="material-add">
              <h4 className="material-head">資料を追加</h4>
              <input
                placeholder="タイトル（例: 構成台本）"
                value={matTitle}
                onChange={(e) => setMatTitle(e.target.value)}
              />
              <input
                placeholder="リンクURL（Googleドライブ・Canva等）"
                value={matUrl}
                onChange={(e) => setMatUrl(e.target.value)}
              />
              <input
                placeholder="メモ（任意）"
                value={matNote}
                onChange={(e) => setMatNote(e.target.value)}
              />
              <div className="material-add-actions">
                <button className="ghost" onClick={addLink}>🔗 リンクを追加</button>
                <button
                  className="ghost"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? "アップロード中…" : "📄 ファイルを選択"}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  style={{ display: "none" }}
                  onChange={onFilePicked}
                />
              </div>
              {uploadMsg && <p className="error">{uploadMsg}</p>}
              <p className="muted small">
                ※ ファイルはタイトル未入力ならファイル名で登録されます
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );

  function onDeleted2() {
    deleteProject(project.id);
    onDeleted();
  }
}
