import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNavBar from '../components/BottomNavBar'
import Card from '../components/Card'
import FloatingActionButton from '../components/FloatingActionButton'
import TimerRing from '../components/TimerRing'
import ToggleSwitch from '../components/ToggleSwitch'
import TopAppBar from '../components/TopAppBar'
import { deleteReminderById, fetchActiveReminders, fetchHistoryLog, markReminderTaken, supabase } from '../services/supabaseClient'

const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const dayLabelToKey = {
  sun: 'sun',
  mon: 'mon',
  tue: 'tue',
  wed: 'wed',
  thu: 'thu',
  fri: 'fri',
  sat: 'sat',
}

const minutesUntil = (time) => {
  const [hours, minutes] = time.split(':').map(Number)
  const now = new Date()
  const target = new Date(now)
  target.setHours(hours, minutes, 0, 0)

  let diffMins = Math.floor((target.getTime() - now.getTime()) / 60000)

  // Only roll over to tomorrow if it is more than 15 minutes in the past
  // This keeps the dose as "Next" while the hardware is actively ringing
  if (diffMins < -15) {
    target.setDate(target.getDate() + 1)
    diffMins = Math.floor((target.getTime() - now.getTime()) / 60000)
  }

  return diffMins
}

const formatHour = (time24) => {
  const [hour, minute] = time24.split(':').map(Number)
  const period = hour >= 12 ? 'PM' : 'AM'
  const normalizedHour = hour % 12 || 12
  return { label: `${String(normalizedHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, period }
}

const localDate = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const dateKey = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const parseDateKey = (value) => {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const withTime = (baseDate, time) => {
  const [hour, minute] = time.split(':').map(Number)
  const result = new Date(baseDate)
  result.setHours(hour, minute, 0, 0)
  return result
}

const addDays = (baseDate, amount) => {
  const next = new Date(baseDate)
  next.setDate(next.getDate() + amount)
  return next
}

const diffMinutes = (target, now) => Math.floor((target.getTime() - now.getTime()) / 60000)

const getReminderRepeat = (reminder) => {
  const notes = reminder.notes || ''
  const rawRepeat = String(reminder.repeat_type || reminder.repeat || '').toLowerCase()
  const daysFromArray = Array.isArray(reminder.days) ? reminder.days.map((day) => String(day).trim().toLowerCase()) : []
  const customMatch = notes.match(/\[Days:\s*([^\]]+)\]/i)
  const weeklyFromNotes = /\[Repeat:\s*Weekly\]/i.test(notes)

  if (rawRepeat.includes('custom') || customMatch || daysFromArray.length) {
    const parsedDays = customMatch
      ? customMatch[1]
          .split(',')
          .map((value) => value.trim().slice(0, 3).toLowerCase())
          .map((abbr) => dayLabelToKey[abbr])
          .filter(Boolean)
      : []
    const days = Array.from(new Set([...daysFromArray, ...parsedDays]))
    return { type: 'custom', days }
  }

  if (rawRepeat.includes('weekly') || weeklyFromNotes) {
    return { type: 'weekly', days: [] }
  }

  return { type: 'daily', days: [] }
}

const getNextOccurrence = ({ reminder, takenDateKeys, now, graceMinutes = 15 }) => {
  const todayKey = dateKey(now)
  const todayTaken = takenDateKeys.has(todayKey)
  const { type, days } = getReminderRepeat(reminder)
  const todayAtTime = withTime(now, reminder.time)
  const todayDiff = diffMinutes(todayAtTime, now)

  if (type === 'weekly') {
    const takenDates = Array.from(takenDateKeys)
      .map(parseDateKey)
      .sort((a, b) => a.getTime() - b.getTime())
    if (takenDates.length) {
      const lastTaken = takenDates[takenDates.length - 1]
      let candidate = withTime(addDays(lastTaken, 7), reminder.time)
      while (candidate < now) {
        candidate = addDays(candidate, 7)
      }
      return candidate
    }
    if (todayDiff < -graceMinutes) {
      return addDays(todayAtTime, 7)
    }
    return todayAtTime
  }

  if (type === 'custom' && days.length) {
    for (let offset = 0; offset < 14; offset += 1) {
      const candidateDate = addDays(now, offset)
      const candidateKey = dateKey(candidateDate)
      const candidateDay = dayKeys[candidateDate.getDay()]
      if (!days.includes(candidateDay)) {
        continue
      }
      if (takenDateKeys.has(candidateKey)) {
        continue
      }
      const candidate = withTime(candidateDate, reminder.time)
      if (offset === 0 && diffMinutes(candidate, now) < -graceMinutes) {
        continue
      }
      return candidate
    }
  }

  if (todayTaken || todayDiff < -graceMinutes) {
    return addDays(todayAtTime, 1)
  }
  return todayAtTime
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [reminders, setReminders] = useState([])
  const [history, setHistory] = useState([])
  const [remainingText, setRemainingText] = useState('--:--')
  const [isSaving, setIsSaving] = useState(false)
  const today = localDate()
  const takenDateMap = useMemo(() => {
    const map = new Map()
    history
      .filter((entry) => entry.status === 'taken')
      .forEach((entry) => {
        const key = `${entry.medicine}-${entry.scheduled_time}`
        if (!map.has(key)) {
          map.set(key, new Set())
        }
        map.get(key).add(entry.date)
      })
    return map
  }, [history])
  const takenToday = useMemo(
    () =>
      new Set(
        history
          .filter((entry) => entry.date === today && entry.status === 'taken')
          .map((entry) => `${entry.medicine}-${entry.scheduled_time}`),
      ),
    [history, today],
  )
  const upcomingReminders = useMemo(
    () =>
      reminders
        .map((reminder) => {
          const key = `${reminder.medicine}-${reminder.time}`
          const takenDateKeys = takenDateMap.get(key) ?? new Set()
          const nextOccurrence = getNextOccurrence({ reminder, takenDateKeys, now: new Date() })
          return { reminder, nextOccurrence }
        })
        .sort((a, b) => a.nextOccurrence.getTime() - b.nextOccurrence.getTime()),
    [reminders, takenDateMap],
  )

  const nextDose = useMemo(() => {
    if (!upcomingReminders.length) {
      return null
    }

    return upcomingReminders[0].reminder
  }, [upcomingReminders])
  const nextDoseAt = useMemo(() => (upcomingReminders.length ? upcomingReminders[0].nextOccurrence : null), [upcomingReminders])

  const adherence = useMemo(() => {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    const recent = history.filter((entry) => new Date(entry.date) >= sevenDaysAgo)
    if (!recent.length) {
      return 100
    }
    const taken = recent.filter((entry) => entry.status === 'taken').length
    return Math.round((taken / recent.length) * 100)
  }, [history])

  const loadData = async () => {
    const [activeReminders, historyLog] = await Promise.all([fetchActiveReminders(), fetchHistoryLog()])
    setReminders(activeReminders)
    setHistory(historyLog)
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 60000)

    const channel = supabase
      .channel('medialert-live-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, loadData)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'history' }, loadData)
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (!nextDose) {
      setRemainingText('--:--')
      return
    }

    const updateRemaining = () => {
      let remainingMinutes = nextDoseAt ? diffMinutes(nextDoseAt, new Date()) : minutesUntil(nextDose.time)
      if (remainingMinutes < 0) remainingMinutes = 0
      const hours = Math.floor(remainingMinutes / 60)
      const minutes = remainingMinutes % 60
      setRemainingText(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`)
    }

    updateRemaining()
    const timer = setInterval(updateRemaining, 30000)
    return () => clearInterval(timer)
  }, [nextDose, nextDoseAt])

  const handleMarkTaken = async (reminder) => {
    setIsSaving(true)
    try {
      const now = new Date()
      const takenTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const date = localDate()

      await markReminderTaken({
        reminderId: reminder.id,
        medicine: reminder.medicine,
        scheduledTime: reminder.time,
        takenTime,
        date,
        trigger: 'button',
      })

      const next = upcomingReminders.find((item) => item.reminder.id !== reminder.id)?.reminder ?? null
      const todayEntries = history.filter((entry) => entry.date === date && entry.status === 'taken')
      const currentTakenCount = new Set(todayEntries.map((entry) => `${entry.medicine}-${entry.scheduled_time}`)).size
      const progress = reminders.length ? Math.min(100, Math.round(((currentTakenCount + 1) / reminders.length) * 100)) : 0

      navigate('/taken', {
        state: {
          medicine: reminder.medicine,
          takenTime,
          nextDose: next?.time ?? '--:--',
          progress,
        },
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteReminder = async (reminder) => {
    const shouldDelete = window.confirm(`Delete alarm for ${reminder.medicine} at ${reminder.time}?`)
    if (!shouldDelete) {
      return
    }

    setIsSaving(true)
    try {
      await deleteReminderById(reminder.id)
      await loadData()
    } finally {
      setIsSaving(false)
    }
  }

  const remainingMinutes = nextDoseAt ? Math.max(0, diffMinutes(nextDoseAt, new Date())) : 0
  const clampedRemaining = Math.min(1440, remainingMinutes)
  const ringProgress = nextDoseAt ? Math.round(((1440 - clampedRemaining) / 1440) * 100) : 0
  const missed = history.filter((entry) => entry.status === 'missed').length
  return (
    <div className="min-h-screen bg-slate-100 pb-32">
      <TopAppBar showProfile />
      <main className="mx-auto max-w-md px-4 pb-8 pt-20">
        <div className="mb-6">
          <p className="text-sm text-slate-500">Welcome back</p>
          <h1 className="text-5xl font-extrabold leading-[1.05] text-slate-900">Your Health at a glance.</h1>
        </div>

        <Card className="mb-4 px-4 py-5">
          <div className="flex flex-col items-center">
            <TimerRing label={remainingText} progress={ringProgress} />
            <p className="mt-3 text-sm font-semibold text-primary">{nextDose ? `Next: ${nextDose.medicine}` : 'No active reminders'}</p>
          </div>
        </Card>

        <Card className="mb-6 bg-primary px-4 py-4 text-white">
          <p className="text-xl font-bold">Adherence is {adherence}% this week.</p>
          <p className="text-sm text-blue-100">You&apos;ve missed {missed} doses in the latest logs.</p>
        </Card>

        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Upcoming Alarms</h2>
          <span className="text-[11px] uppercase tracking-[0.15em] text-slate-500">{upcomingReminders.length} upcoming</span>
        </div>

        <div className="space-y-3">
          {!upcomingReminders.length ? (
            <Card className="px-4 py-5 text-center text-slate-500">No active reminders available.</Card>
          ) : (
            upcomingReminders.map(({ reminder }) => {
              const { label, period } = formatHour(reminder.time)
              return (
                <Card key={reminder.id} className="px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-4xl font-extrabold leading-none text-slate-900">
                        {label} <span className="text-base font-semibold text-slate-400">{period}</span>
                      </p>
                      <p className="text-lg font-semibold text-slate-800">{reminder.medicine}</p>
                      {!!reminder.notes && <p className="text-xs text-slate-500">{reminder.notes}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleDeleteReminder(reminder)}
                        disabled={isSaving}
                        className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 disabled:opacity-50"
                      >
                        Delete
                      </button>
                      <ToggleSwitch
                        checked={takenToday.has(`${reminder.medicine}-${reminder.time}`)}
                        onChange={() => handleMarkTaken(reminder)}
                        disabled={isSaving}
                      />
                    </div>
                  </div>
                </Card>
              )
            })
          )}
        </div>
      </main>
      <FloatingActionButton />
      <BottomNavBar />
    </div>
  )
}
