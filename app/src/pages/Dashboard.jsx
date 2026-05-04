import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNavBar from '../components/BottomNavBar'
import Card from '../components/Card'
import FloatingActionButton from '../components/FloatingActionButton'
import TimerRing from '../components/TimerRing'
import ToggleSwitch from '../components/ToggleSwitch'
import TopAppBar from '../components/TopAppBar'
import { deleteReminderById, fetchActiveReminders, fetchHistoryLog, markReminderTaken, supabase } from '../services/supabaseClient'

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

export default function Dashboard() {
  const navigate = useNavigate()
  const [reminders, setReminders] = useState([])
  const [history, setHistory] = useState([])
  const [remainingText, setRemainingText] = useState('--:--')
  const [isSaving, setIsSaving] = useState(false)

  const nextDose = useMemo(() => {
    if (!reminders.length) {
      return null
    }

    return [...reminders].sort((a, b) => minutesUntil(a.time) - minutesUntil(b.time))[0]
  }, [reminders])

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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'history' }, async (payload) => {
        loadData()
        
        // Removed condition for debugging: ALWAYS trigger navigation on INSERT
        try {
          const { data: activeReminders } = await supabase
            .from('reminders')
            .select('*')
            .eq('active', true)
            .order('time', { ascending: true })
          
          const next = activeReminders && activeReminders.length ? activeReminders[0] : null
          
          const { data: todayHistory } = await supabase
            .from('history')
            .select('*')
            .eq('date', payload.new?.date || localDate())
            .eq('status', 'taken')
            
          const currentTakenCount = new Set((todayHistory || []).map((entry) => `${entry.medicine}-${entry.scheduled_time}`)).size
          const totalReminders = (activeReminders?.length || 0) + currentTakenCount
          const progress = totalReminders > 0 ? Math.min(100, Math.round((currentTakenCount / totalReminders) * 100)) : 0

          navigate('/taken', {
            state: {
              medicine: payload.new?.medicine || 'Unknown',
              takenTime: payload.new?.taken_time || '--:--',
              nextDose: next?.time ?? '--:--',
              progress,
              autoClose: true,
            },
          })
        } catch (e) {
          console.error("Navigation error:", e)
        }
      })
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
      let remainingMinutes = minutesUntil(nextDose.time)
      if (remainingMinutes < 0) remainingMinutes = 0
      const hours = Math.floor(remainingMinutes / 60)
      const minutes = remainingMinutes % 60
      setRemainingText(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`)
    }

    updateRemaining()
    const timer = setInterval(updateRemaining, 30000)
    return () => clearInterval(timer)
  }, [nextDose])

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
        trigger: 'app_button',
      })

      const next = reminders.length ? [...reminders].sort((a, b) => minutesUntil(a.time) - minutesUntil(b.time))[0] : null
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

  const remainingMinutes = nextDose ? minutesUntil(nextDose.time) : 0
  const ringProgress = nextDose ? Math.round(((1440 - remainingMinutes) / 1440) * 100) : 0
  const missed = history.filter((entry) => entry.status === 'missed').length
  const today = localDate()
  const takenToday = new Set(
    history
      .filter((entry) => entry.date === today && entry.status === 'taken')
      .map((entry) => `${entry.medicine}-${entry.scheduled_time}`),
  )

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
          <span className="text-[11px] uppercase tracking-[0.15em] text-slate-500">{reminders.length} scheduled today</span>
        </div>

        <div className="space-y-3">
          {!reminders.length ? (
            <Card className="px-4 py-5 text-center text-slate-500">No active reminders available.</Card>
          ) : (
            reminders.map((reminder) => {
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
