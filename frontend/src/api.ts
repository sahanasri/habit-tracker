export type Habit = {
  id: number
  name: string
  description: string
  color: string
  icon: string
  target_days_per_week: number
  is_archived: boolean
  completed_today: boolean
  current_streak: number
  completed_last_7_days: string[]
}

export type Dashboard = {
  selected_date: string
  habits: Habit[]
  completed_count: number
  total_count: number
  completion_rate: number
  best_streak: number
}

export type HabitInput = Pick<
  Habit,
  'name' | 'description' | 'color' | 'icon' | 'target_days_per_week'
>

export type Account = {
  name: string
  email: string
}

export type AuthResult = Account & {
  token: string
}

export type HabitNote = {
  id: number
  habit_id: number
  noted_on: string
  body: string
}

const sessionKey = 'daily-form-session'
const accountKey = 'daily-form-account'

function storeAccount(account: Account) {
  localStorage.setItem(accountKey, JSON.stringify(account))
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem(sessionKey)
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    if (response.status === 401) {
      localStorage.removeItem(sessionKey)
      localStorage.removeItem(accountKey)
    }
    throw new ApiError(body?.detail ?? 'Something went wrong', response.status)
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

export const api = {
  hasSession: () => Boolean(localStorage.getItem(sessionKey)),
  account: () => {
    const stored = localStorage.getItem(accountKey)
    if (!stored) return null
    try {
      return JSON.parse(stored) as Account
    } catch {
      localStorage.removeItem(accountKey)
      return null
    }
  },
  me: async () => {
    const account = await request<Account>('/api/auth/me')
    storeAccount(account)
    return account
  },
  login: async (email: string, password: string) => {
    const result = await request<AuthResult>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    localStorage.setItem(sessionKey, result.token)
    storeAccount(result)
    return result
  },
  register: async (name: string, email: string, password: string) => {
    const result = await request<AuthResult>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    })
    localStorage.setItem(sessionKey, result.token)
    storeAccount(result)
    return result
  },
  logout: async () => {
    try {
      await request<void>('/api/auth/logout', { method: 'POST' })
    } finally {
      localStorage.removeItem(sessionKey)
      localStorage.removeItem(accountKey)
    }
  },
  dashboard: (date: string) => request<Dashboard>(`/api/dashboard?date=${date}`),
  createHabit: (habit: HabitInput) =>
    request<Habit>('/api/habits', { method: 'POST', body: JSON.stringify(habit) }),
  toggleHabit: (id: number, date: string) =>
    request<Habit>(`/api/habits/${id}/toggle?date=${date}`, { method: 'POST' }),
  deleteHabit: (id: number) => request<void>(`/api/habits/${id}`, { method: 'DELETE' }),
  notes: (habitId: number) => request<HabitNote[]>(`/api/habits/${habitId}/notes`),
  createNote: (habitId: number, notedOn: string, body: string) =>
    request<HabitNote>(`/api/habits/${habitId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ noted_on: notedOn, body }),
    }),
}