import { createClient } from '@supabase/supabase-js'
import type {
  AppRequest,
  Availability,
  CommentTemplate,
  PayConfirmation,
  Recipient,
  ScheduleEvent,
  User,
  VideoTask,
} from '../types'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
)

// ---- App ↔ DB transformers ----

const toDbUser = (u: User) => ({
  id: u.id,
  name: u.name,
  password: u.password,
  role: u.role,
  hourly_rate: u.hourlyRate,
  postal_code: u.postalCode ?? null,
  address: u.address ?? null,
  phone: u.phone ?? null,
  email: u.email ?? null,
  stamp_text: u.stamp?.text ?? null,
  stamp_shape: u.stamp?.shape ?? null,
  stamp_orientation: u.stamp?.orientation ?? null,
  stamp_font: u.stamp?.font ?? null,
})

const fromDbUser = (r: any): User => ({
  id: r.id,
  name: r.name,
  password: r.password,
  role: r.role,
  hourlyRate: r.hourly_rate ?? 0,
  postalCode: r.postal_code ?? undefined,
  address: r.address ?? undefined,
  phone: r.phone ?? undefined,
  email: r.email ?? undefined,
  stamp: r.stamp_text
    ? {
        text: r.stamp_text,
        shape: r.stamp_shape ?? 'circle',
        orientation: r.stamp_orientation ?? 'vertical',
        font: r.stamp_font ?? 'mincho',
      }
    : undefined,
})

const toDbEvent = (e: ScheduleEvent) => ({
  id: e.id,
  date: e.date,
  type: e.type,
  title: e.title,
  location: e.location,
  assignee_ids: e.assigneeIds,
  start_time: e.start,
  end_time: e.end,
  note: e.note,
})

const fromDbEvent = (r: any): ScheduleEvent => ({
  id: r.id,
  date: r.date,
  type: r.type,
  title: r.title,
  location: r.location,
  assigneeIds: r.assignee_ids ?? [],
  start: r.start_time,
  end: r.end_time,
  note: r.note,
})

const toDbAvail = (a: Availability) => ({
  user_id: a.userId,
  date: a.date,
  slots: a.slots,
  comment: a.comment,
})

const fromDbAvail = (r: any): Availability => ({
  userId: r.user_id,
  date: r.date,
  slots: r.slots ?? [],
  comment: r.comment ?? '',
})

const toDbRequest = (r: AppRequest) => ({
  id: r.id,
  date: r.date,
  from_user_id: r.fromUserId,
  to_user_id: r.toUserId,
  type: r.type,
  title: r.title,
  location: r.location,
  start_time: r.start,
  end_time: r.end,
  note: r.note,
  status: r.status,
})

const fromDbRequest = (r: any): AppRequest => ({
  id: r.id,
  date: r.date,
  fromUserId: r.from_user_id,
  toUserId: r.to_user_id,
  type: r.type,
  title: r.title,
  location: r.location,
  start: r.start_time,
  end: r.end_time,
  note: r.note,
  status: r.status,
})

const toDbPayConf = (p: PayConfirmation) => ({
  id: p.id,
  user_id: p.userId,
  quarter: p.quarter,
  amount: p.amount,
  hours: p.hours,
  status: p.status,
  requested_at: p.requestedAt,
  confirmed_at: p.confirmedAt ?? null,
})

const fromDbPayConf = (r: any): PayConfirmation => ({
  id: r.id,
  userId: r.user_id,
  quarter: r.quarter,
  amount: r.amount,
  hours: r.hours,
  status: r.status,
  requestedAt: r.requested_at,
  confirmedAt: r.confirmed_at ?? undefined,
})

const toDbRecipient = (r: Recipient) => ({
  id: r.id,
  user_id: r.userId,
  name: r.name,
  type: r.type,
})

const fromDbRecipient = (r: any): Recipient => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  type: r.type,
})

const toDbTemplate = (t: CommentTemplate) => ({
  id: t.id,
  user_id: t.userId,
  text: t.text,
})

const fromDbTemplate = (r: any): CommentTemplate => ({
  id: r.id,
  userId: r.user_id,
  text: r.text,
})

const toDbVideoTask = (t: VideoTask) => ({
  id: t.id,
  from_user_id: t.fromUserId,
  to_user_id: t.toUserId,
  title: t.title,
  description: t.description,
  deadline: t.deadline,
  amount: t.amount,
  status: t.status,
  created_at: t.createdAt,
  delivery_url: t.deliveryUrl ?? null,
  delivery_note: t.deliveryNote ?? null,
  submitted_at: t.submittedAt ?? null,
  completed_at: t.completedAt ?? null,
})

const fromDbVideoTask = (r: any): VideoTask => ({
  id: r.id,
  fromUserId: r.from_user_id,
  toUserId: r.to_user_id,
  title: r.title,
  description: r.description,
  deadline: r.deadline,
  amount: r.amount,
  status: r.status,
  createdAt: r.created_at,
  deliveryUrl: r.delivery_url ?? undefined,
  deliveryNote: r.delivery_note ?? undefined,
  submittedAt: r.submitted_at ?? undefined,
  completedAt: r.completed_at ?? undefined,
})

// ---- Sync helper: delete all + re-insert ----
async function replaceTable<T>(
  table: string,
  items: T[],
  toDb: (item: T) => Record<string, unknown>,
  deleteByField = 'id',
): Promise<void> {
  await supabase.from(table).delete().neq(deleteByField, '~~~never~~~')
  if (items.length > 0) {
    await supabase.from(table).insert(items.map(toDb))
  }
}

// ---- Public sync functions (fire-and-forget from store.ts) ----

export function syncUsers(users: User[]): void {
  replaceTable('users', users, toDbUser).catch(() => {})
}

export function syncEvents(events: ScheduleEvent[]): void {
  replaceTable('schedule_events', events, toDbEvent).catch(() => {})
}

export function syncAvailability(avail: Availability[]): void {
  replaceTable('availability', avail, toDbAvail, 'user_id').catch(() => {})
}

export function syncRequests(requests: AppRequest[]): void {
  replaceTable('app_requests', requests, toDbRequest).catch(() => {})
}

export function syncPayConfirmations(list: PayConfirmation[]): void {
  replaceTable('pay_confirmations', list, toDbPayConf).catch(() => {})
}

export function syncRecipients(recipients: Recipient[]): void {
  replaceTable('recipients', recipients, toDbRecipient).catch(() => {})
}

export function syncTemplates(templates: CommentTemplate[]): void {
  replaceTable('comment_templates', templates, toDbTemplate).catch(() => {})
}

export function syncVideoTasks(tasks: VideoTask[]): void {
  replaceTable('video_tasks', tasks, toDbVideoTask).catch(() => {})
}

// ---- Hydration: Supabase → localStorage on app start ----

const SCHEMA_VERSION = '4'
const SCHEMA_KEY = 'sns_schema_version'

export async function hydrateFromSupabase(): Promise<boolean> {
  try {
    const [users, events, avail, requests, payConf, recipients, templates, videoTasks] =
      await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('schedule_events').select('*'),
        supabase.from('availability').select('*'),
        supabase.from('app_requests').select('*'),
        supabase.from('pay_confirmations').select('*'),
        supabase.from('recipients').select('*'),
        supabase.from('comment_templates').select('*'),
        supabase.from('video_tasks').select('*'),
      ])

    if (users.error) throw users.error

    if (users.data) localStorage.setItem('sns_users', JSON.stringify(users.data.map(fromDbUser)))
    if (events.data) localStorage.setItem('sns_events', JSON.stringify(events.data.map(fromDbEvent)))
    if (avail.data) localStorage.setItem('sns_availability', JSON.stringify(avail.data.map(fromDbAvail)))
    if (requests.data) localStorage.setItem('sns_requests', JSON.stringify(requests.data.map(fromDbRequest)))
    if (payConf.data) localStorage.setItem('sns_pay_confirmations', JSON.stringify(payConf.data.map(fromDbPayConf)))
    if (recipients.data) localStorage.setItem('sns_recipients', JSON.stringify(recipients.data.map(fromDbRecipient)))
    if (templates.data) localStorage.setItem('sns_comment_templates', JSON.stringify(templates.data.map(fromDbTemplate)))
    if (videoTasks.data) localStorage.setItem('sns_video_tasks', JSON.stringify(videoTasks.data.map(fromDbVideoTask)))

    // Set schema version so seedIfEmpty won't wipe the hydrated data
    localStorage.setItem(SCHEMA_KEY, SCHEMA_VERSION)

    return true
  } catch {
    return false
  }
}
