import { FormEvent, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CirclePlus,
  Dumbbell,
  Eye,
  EyeOff,
  Flame,
  Footprints,
  Leaf,
  LoaderCircle,
  LogIn,
  LogOut,
  NotebookPen,
  Plus,
  Send,
  Target,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { Account, api, ApiError, Dashboard, Habit, HabitInput, HabitNote } from './api'

const iconMap = {
  book: BookOpen,
  fitness: Dumbbell,
  walk: Footprints,
  leaf: Leaf,
  check: Check,
}

const colors = ['#19785b', '#d2643e', '#2f6295', '#d2a32f', '#76518e']
const icons = Object.keys(iconMap)

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

function shiftDate(value: string, days: number) {
  const next = new Date(`${value}T12:00:00`)
  next.setDate(next.getDate() + days)
  return isoDate(next)
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${value}T12:00:00`))
}

const emptyHabit: HabitInput = {
  name: '',
  description: '',
  color: colors[0],
  icon: 'check',
  target_days_per_week: 7,
}

function LoginScreen({ onAuthenticated }: { onAuthenticated: (account: Account) => void }) {
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const account = creatingAccount
        ? await api.register(name, email, password)
        : await api.login(email, password)
      onAuthenticated(account)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <div className="brand-mark"><Leaf size={24} /></div>
        <p className="eyebrow">Daily Form</p>
        <h1>Small acts,<br />well kept.</h1>
        <p>Your habits stay private to your account and ready for the next check-in.</p>
      </section>
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <div>
          <p className="eyebrow">Welcome</p>
          <h2>{creatingAccount ? 'Create your account' : 'Sign in to continue'}</h2>
        </div>
        {error && <div className="error-banner">{error}</div>}
        {creatingAccount && <label>Name<input type="text" autoComplete="name" autoFocus required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label>}
        <label>Email<input type="email" autoComplete="email" autoFocus required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <label>
          Password
          <span className="password-field">
            <input type={passwordVisible ? 'text' : 'password'} autoComplete={creatingAccount ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
            <button type="button" title={passwordVisible ? 'Hide password' : 'Show password'} aria-label={passwordVisible ? 'Hide password' : 'Show password'} onClick={() => setPasswordVisible(!passwordVisible)}>
              {passwordVisible ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </span>
        </label>
        <button className="primary-button auth-submit" type="submit" disabled={submitting}>
          {submitting ? <LoaderCircle className="spin" size={18} /> : <LogIn size={18} />}
          {creatingAccount ? 'Create account' : 'Sign in'}
        </button>
        <p className="auth-switch">
          {creatingAccount ? 'Already have an account?' : 'New to Daily Form?'}
          <button type="button" className="text-button" onClick={() => { setCreatingAccount(!creatingAccount); setError('') }}>
            {creatingAccount ? 'Sign in' : 'Create account'}
          </button>
        </p>
      </form>
    </main>
  )
}

function AccountMenu({ account, onSignOut }: { account: Account; onSignOut: () => void }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeMenu)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeMenu)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  return (
    <div className="account-menu" ref={menuRef}>
      <button className="account-trigger" type="button" title="Account" aria-label="Open account menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <UserRound size={20} />
      </button>
      {open && (
        <div className="account-dropdown">
          <div className="account-identity"><strong>{account.name}</strong><span>{account.email}</span></div>
          <button type="button" onClick={onSignOut}><LogOut size={17} /> Sign out</button>
        </div>
      )}
    </div>
  )
}

function NotesView({ habits, selectedDate }: { habits: Habit[]; selectedDate: string }) {
  const [selectedHabitId, setSelectedHabitId] = useState<number | null>(habits[0]?.id ?? null)
  const [notes, setNotes] = useState<HabitNote[]>([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!selectedHabitId || !habits.some((habit) => habit.id === selectedHabitId)) {
      setSelectedHabitId(habits[0]?.id ?? null)
    }
  }, [habits, selectedHabitId])

  useEffect(() => {
    if (!selectedHabitId) {
      setNotes([])
      return
    }
    setLoading(true)
    api.notes(selectedHabitId)
      .then((items) => { setNotes(items); setError('') })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load notes'))
      .finally(() => setLoading(false))
  }, [selectedHabitId])

  async function createNote(event: FormEvent) {
    event.preventDefault()
    if (!selectedHabitId || !body.trim()) return
    setSaving(true)
    try {
      const note = await api.createNote(selectedHabitId, selectedDate, body.trim())
      setNotes((current) => [note, ...current])
      setBody('')
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save note')
    } finally {
      setSaving(false)
    }
  }

  if (!habits.length) {
    return (
      <section className="notes-section empty-state">
        <NotebookPen size={34} />
        <h3>Create a habit before adding notes.</h3>
      </section>
    )
  }

  return (
    <section className="notes-section">
      <div className="note-habit-picker" role="tablist" aria-label="Choose a habit">
        {habits.map((habit) => (
          <button
            type="button"
            role="tab"
            aria-selected={selectedHabitId === habit.id}
            className={selectedHabitId === habit.id ? 'selected' : ''}
            key={habit.id}
            onClick={() => setSelectedHabitId(habit.id)}
          >
            <span style={{ background: habit.color }} />{habit.name}
          </button>
        ))}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <form className="note-composer" onSubmit={(event) => void createNote(event)}>
        <div>
          <p className="eyebrow">Note for {dateLabel(selectedDate)}</p>
          <h2>What would you like to remember?</h2>
        </div>
        <textarea required maxLength={1000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Add an observation, milestone, or reminder..." />
        <div className="note-composer-footer">
          <span>{body.length}/1000</span>
          <button className="primary-button" type="submit" disabled={saving || !body.trim()}>
            {saving ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />} Save note
          </button>
        </div>
      </form>

      <div className="note-history">
        <div className="section-heading"><h2>Past notes</h2><span>{notes.length} saved</span></div>
        {loading ? (
          <div className="notes-loading"><LoaderCircle className="spin" /><span>Loading notes...</span></div>
        ) : notes.length ? (
          <div className="note-list">
            {notes.map((note) => (
              <article className="note-entry" key={note.id}>
                <time dateTime={note.noted_on}>{dateLabel(note.noted_on)}</time>
                <p>{note.body}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="note-empty"><NotebookPen size={26} /><p>No notes for this habit yet.</p></div>
        )}
      </div>
    </section>
  )
}

function App() {
  const [authenticated, setAuthenticated] = useState(api.hasSession())
  const [account, setAccount] = useState<Account | null>(api.account())
  const [activeView, setActiveView] = useState<'today' | 'notes'>('today')
  const [selectedDate, setSelectedDate] = useState(isoDate(new Date()))
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<HabitInput>(emptyHabit)

  async function load() {
    setLoading(true)
    try {
      setDashboard(await api.dashboard(selectedDate))
      setError('')
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) setAuthenticated(false)
      setError(reason instanceof Error ? reason.message : 'Unable to load habits')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authenticated) void load()
  }, [authenticated, selectedDate])

  useEffect(() => {
    if (authenticated && !account) {
      api.me()
        .then(setAccount)
        .catch(() => setAuthenticated(false))
    }
  }, [account, authenticated])

  async function signOut() {
    await api.logout()
    setAccount(null)
    setAuthenticated(false)
  }

  async function toggle(habit: Habit) {
    setDashboard((current) =>
      current
        ? {
            ...current,
            habits: current.habits.map((item) =>
              item.id === habit.id ? { ...item, completed_today: !item.completed_today } : item,
            ),
          }
        : current,
    )
    try {
      await api.toggleHabit(habit.id, selectedDate)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update habit')
      await load()
    }
  }

  async function createHabit(event: FormEvent) {
    event.preventDefault()
    await api.createHabit(form)
    setForm(emptyHabit)
    setModalOpen(false)
    await load()
  }

  async function removeHabit(id: number) {
    await api.deleteHabit(id)
    await load()
  }

  const rate = Math.round((dashboard?.completion_rate ?? 0) * 100)

  if (!authenticated) {
    return <LoginScreen onAuthenticated={(authenticatedAccount) => { setAccount(authenticatedAccount); setAuthenticated(true) }} />
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark"><Leaf size={24} /></div>
        <div className="brand-copy"><strong>Daily Form</strong><span>Small acts, well kept.</span></div>
        <nav>
          <button title="Today" className={`nav-item ${activeView === 'today' ? 'active' : ''}`} onClick={() => setActiveView('today')}><Target size={18} />Today</button>
          <button title="Notes" className={`nav-item ${activeView === 'notes' ? 'active' : ''}`} onClick={() => setActiveView('notes')}><NotebookPen size={18} />Notes</button>
        </nav>
        <div className="sidebar-note">
          <Flame size={18} />
          <p><strong>{dashboard?.best_streak ?? 0} day best</strong><span>Consistency is taking shape.</span></p>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{activeView === 'today' ? 'Your daily practice' : 'Your observations'}</p>
            <h1>{activeView === 'today' ? "Today's Activities" : 'Notes'}</h1>
          </div>
          <div className="topbar-actions">
            {activeView === 'today' && (
              <button className="primary-button" onClick={() => setModalOpen(true)}>
                <Plus size={18} /> New habit
              </button>
            )}
            {account && <AccountMenu account={account} onSignOut={() => void signOut()} />}
          </div>
        </header>

        <div className="date-strip">
          <button className="icon-button" title="Previous day" onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}><ArrowLeft /></button>
          <button className="date-button" onClick={() => setSelectedDate(isoDate(new Date()))}>{dateLabel(selectedDate)}</button>
          <button className="icon-button" title="Next day" onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}><ArrowRight /></button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {activeView === 'today' ? <>
          <section className="summary-band">
            <div className="progress-ring" style={{ '--progress': `${rate * 3.6}deg` } as React.CSSProperties}>
              <div><strong>{rate}%</strong><span>complete</span></div>
            </div>
            <div className="summary-copy">
              <p className="eyebrow">Daily rhythm</p>
              <h2>{dashboard?.completed_count ?? 0} of {dashboard?.total_count ?? 0} practices complete</h2>
              <p>{rate === 100 ? 'A full day, thoughtfully finished.' : 'Each check-in is a vote for who you are becoming.'}</p>
            </div>
            <div className="summary-stat"><Flame /><strong>{dashboard?.best_streak ?? 0}</strong><span>best streak</span></div>
          </section>

          <section className="habit-section">
          <div className="section-heading"><h2>Today’s habits</h2><span>{dashboard?.habits.length ?? 0} active</span></div>
          {loading ? (
            <div className="empty-state"><LoaderCircle className="spin" /><p>Gathering today’s rhythm...</p></div>
          ) : dashboard?.habits.length ? (
            <div className="habit-list">
              {dashboard.habits.map((habit) => {
                const Icon = iconMap[habit.icon as keyof typeof iconMap] ?? Check
                const week = Array.from({ length: 7 }, (_, index) => shiftDate(selectedDate, index - 6))
                return (
                  <article className={`habit-row ${habit.completed_today ? 'done' : ''}`} key={habit.id}>
                    <button className="check-button" style={{ '--habit': habit.color } as React.CSSProperties} onClick={() => void toggle(habit)} aria-label={`Mark ${habit.name} ${habit.completed_today ? 'incomplete' : 'complete'}`}>
                      {habit.completed_today && <Check size={21} />}
                    </button>
                    <div className="habit-icon" style={{ color: habit.color, background: `${habit.color}18` }}><Icon size={21} /></div>
                    <div className="habit-copy"><h3>{habit.name}</h3><p>{habit.description || `${habit.target_days_per_week} times each week`}</p></div>
                    <div className="week-dots" aria-label="Last seven days">
                      {week.map((day) => <span key={day} className={habit.completed_last_7_days.includes(day) ? 'filled' : ''} style={{ '--habit': habit.color } as React.CSSProperties} />)}
                    </div>
                    <div className="streak"><Flame size={15} /><strong>{habit.current_streak}</strong><span>days</span></div>
                    <button className="row-action" title="Delete habit" onClick={() => void removeHabit(habit.id)}><Trash2 size={17} /></button>
                    <ChevronRight className="row-chevron" size={18} />
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="empty-state">
              <CirclePlus size={34} />
              <h3>Begin with one small practice.</h3>
              <button className="text-button" onClick={() => setModalOpen(true)}>Create your first habit</button>
            </div>
          )}
          </section>
        </> : (
          <NotesView habits={dashboard?.habits ?? []} selectedDate={selectedDate} />
        )}
      </section>

      {modalOpen && (
        <div className="modal-backdrop" onMouseDown={() => setModalOpen(false)}>
          <form className="habit-modal" onSubmit={(event) => void createHabit(event)} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading"><div><p className="eyebrow">New practice</p><h2>Add a habit</h2></div><button type="button" className="icon-button" title="Close" onClick={() => setModalOpen(false)}><X /></button></div>
            <label>Habit name<input autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Read before bed" /></label>
            <label>Short intention<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Why does this matter?" /></label>
            <fieldset><legend>Symbol</legend><div className="choice-row">{icons.map((icon) => { const Icon = iconMap[icon as keyof typeof iconMap]; return <button type="button" title={icon} className={form.icon === icon ? 'selected' : ''} key={icon} onClick={() => setForm({ ...form, icon })}><Icon size={20} /></button> })}</div></fieldset>
            <fieldset><legend>Color</legend><div className="choice-row">{colors.map((color) => <button type="button" title={color} aria-label={`Use ${color}`} className={`color-choice ${form.color === color ? 'selected' : ''}`} style={{ background: color }} key={color} onClick={() => setForm({ ...form, color })} />)}</div></fieldset>
            <label>Days per week<input type="range" min="1" max="7" value={form.target_days_per_week} onChange={(event) => setForm({ ...form, target_days_per_week: Number(event.target.value) })} /><span className="range-value">{form.target_days_per_week} days</span></label>
            <button className="primary-button submit-button" type="submit"><Plus size={18} /> Add habit</button>
          </form>
        </div>
      )}
    </main>
  )
}

export default App