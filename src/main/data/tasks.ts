import { getDb } from '../db'
import type { Task, TaskInput, TaskPatch } from '../../shared/api'

interface TaskRow {
  id: number
  title: string
  notes: string
  due_date: string | null
  due_time: string | null
  done_at: string | null
  created_at: string
}

const toTask = (row: TaskRow): Task => ({
  id: row.id,
  title: row.title,
  notes: row.notes,
  dueDate: row.due_date,
  dueTime: row.due_time,
  doneAt: row.done_at,
  createdAt: row.created_at
})

function cleanTitle(title: string): string {
  const value = title.trim()
  if (!value) throw new Error('Görev başlığı boş olamaz.')
  return value
}

function cleanDueDate(dueDate: string | null | undefined): string | null {
  if (!dueDate) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate))
    throw new Error('Son tarih YYYY-AA-GG biçiminde olmalı.')
  return dueDate
}

// Saat sadece bir son tarihe bağlı olarak anlamlı; tarihsiz görevde saat kabul edilmez
function cleanDueTime(dueTime: string | null | undefined, dueDate: string | null): string | null {
  if (!dueTime) return null
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime)) throw new Error('Saat SS:DD biçiminde olmalı.')
  if (!dueDate) throw new Error('Saat girmek için önce son tarih seçilmeli.')
  return dueTime
}

// Bekleyenler önce (son tarihi yakın olan üstte, tarihsizler sonda),
// tamamlananlar en sonda (en son tamamlanan üstte)
export function listTasks(): Task[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM tasks
       ORDER BY
         done_at IS NOT NULL,
         CASE WHEN done_at IS NULL THEN due_date IS NULL END,
         CASE WHEN done_at IS NULL THEN due_date END,
         done_at DESC,
         id DESC`
    )
    .all() as TaskRow[]
  return rows.map(toTask)
}

function requireTask(id: number): Task {
  const row = getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined
  if (!row) throw new Error(`${id} numaralı görev bulunamadı.`)
  return toTask(row)
}

export function createTask(input: TaskInput): Task {
  const dueDate = cleanDueDate(input.dueDate)
  const { lastInsertRowid } = getDb()
    .prepare('INSERT INTO tasks (title, notes, due_date, due_time) VALUES (?, ?, ?, ?)')
    .run(
      cleanTitle(input.title),
      input.notes?.trim() ?? '',
      dueDate,
      cleanDueTime(input.dueTime, dueDate)
    )
  return requireTask(Number(lastInsertRowid))
}

export function updateTask(id: number, patch: TaskPatch): Task {
  const current = requireTask(id)
  const title = patch.title !== undefined ? cleanTitle(patch.title) : current.title
  const notes = patch.notes !== undefined ? patch.notes.trim() : current.notes
  const dueDate = patch.dueDate !== undefined ? cleanDueDate(patch.dueDate) : current.dueDate
  // Tarih kaldırılırsa (dueDate null olursa) eski saat de geçersiz kalmasın
  const dueTimeInput =
    patch.dueTime !== undefined ? patch.dueTime : dueDate ? current.dueTime : null
  const dueTime = cleanDueTime(dueTimeInput, dueDate)
  let doneAt = current.doneAt
  if (patch.done !== undefined)
    doneAt = patch.done ? (current.doneAt ?? new Date().toISOString()) : null

  getDb()
    .prepare(
      'UPDATE tasks SET title = ?, notes = ?, due_date = ?, due_time = ?, done_at = ? WHERE id = ?'
    )
    .run(title, notes, dueDate, dueTime, doneAt, id)
  return requireTask(id)
}

export function deleteTask(id: number): void {
  getDb().prepare('DELETE FROM tasks WHERE id = ?').run(id)
}
