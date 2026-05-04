import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '../components/Card'
import TopAppBar from '../components/TopAppBar'
import { insertReminder } from '../services/supabaseClient'

const repeatOptions = ['Daily', 'Weekly', 'Custom']
const ITEM_HEIGHT = 44
const weekDays = [
  { key: 'sun', label: 'Sun' },
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
]

const hours12 = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'))
const hours24 = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'))
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'))
const periods = ['AM', 'PM']
const SELECTED_TEXT_CLASS = 'text-slate-900'
const UNSELECTED_TEXT_CLASS = 'text-slate-300'

export default function AddReminder() {
  const navigate = useNavigate()
  const [medicine, setMedicine] = useState('')
  const [selectedHour, setSelectedHour] = useState('08')
  const [selectedMinute, setSelectedMinute] = useState('30')
  const [selectedPeriod, setSelectedPeriod] = useState('AM')
  const [is24Hour, setIs24Hour] = useState(false)
  const [notes, setNotes] = useState('')
  const [repeat, setRepeat] = useState('Daily')
  const [selectedDays, setSelectedDays] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const hasInitializedScroll = useRef(false)
  const hourRef = useRef(null)
  const minuteRef = useRef(null)
  const periodRef = useRef(null)
  const hourOptions = useMemo(() => (is24Hour ? hours24 : hours12), [is24Hour])

  const time = useMemo(() => {
    if (is24Hour) {
      return `${selectedHour}:${selectedMinute}`
    }
    let hour24 = Number(selectedHour) % 12
    if (selectedPeriod === 'PM') {
      hour24 += 12
    }
    return `${String(hour24).padStart(2, '0')}:${selectedMinute}`
  }, [is24Hour, selectedHour, selectedMinute, selectedPeriod])

  const scrollToOption = (element, index) => {
    if (!element) return
    element.scrollTo({ top: index * ITEM_HEIGHT, behavior: 'smooth' })
  }

  useEffect(() => {
    if (hasInitializedScroll.current) {
      return
    }
    scrollToOption(hourRef.current, hourOptions.indexOf(selectedHour))
    scrollToOption(minuteRef.current, minutes.indexOf(selectedMinute))
    scrollToOption(periodRef.current, periods.indexOf(selectedPeriod))
    hasInitializedScroll.current = true
  }, [hourOptions, selectedHour, selectedMinute, selectedPeriod])

  const toggleTimeFormat = () => {
    if (is24Hour) {
      const hour24 = Number(selectedHour)
      const nextPeriod = hour24 >= 12 ? 'PM' : 'AM'
      const normalizedHour = hour24 % 12 || 12
      const hour12 = String(normalizedHour).padStart(2, '0')
      setSelectedHour(hour12)
      setSelectedPeriod(nextPeriod)
      setIs24Hour(false)
      requestAnimationFrame(() => {
        scrollToOption(hourRef.current, hours12.indexOf(hour12))
        scrollToOption(periodRef.current, periods.indexOf(nextPeriod))
      })
      return
    }

    let hour24 = Number(selectedHour) % 12
    if (selectedPeriod === 'PM') {
      hour24 += 12
    }
    const nextHour = String(hour24).padStart(2, '0')
    setSelectedHour(nextHour)
    setIs24Hour(true)
    requestAnimationFrame(() => {
      scrollToOption(hourRef.current, hours24.indexOf(nextHour))
    })
  }

  const createScrollHandler = (options, setValue) => (event) => {
    const nearestIndex = Math.round(event.currentTarget.scrollTop / ITEM_HEIGHT)
    const safeIndex = Math.max(0, Math.min(options.length - 1, nearestIndex))
    setValue(options[safeIndex])
  }

  const getWheelTextClass = (isSelected) => (isSelected ? SELECTED_TEXT_CLASS : UNSELECTED_TEXT_CLASS)

  const handleSave = async () => {
    if (!medicine.trim()) {
      return
    }
    if (repeat === 'Custom' && selectedDays.length === 0) {
      return
    }

    const daysMetadata =
      repeat === 'Custom'
        ? ` [Days: ${selectedDays
            .map((dayKey) => weekDays.find((day) => day.key === dayKey)?.label)
            .filter(Boolean)
            .join(', ')}]`
        : repeat === 'Weekly'
          ? ' [Repeat: Weekly]'
          : ''

    const mergedNotes = `${notes.trim()}${daysMetadata}`.trim()

    setIsSaving(true)
    try {
      await insertReminder({
        medicine: medicine.trim(),
        time,
        notes: mergedNotes,
        active: true,
        status: 'pending',
      })
      navigate('/')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleDay = (dayKey) => {
    setSelectedDays((currentDays) => {
      if (currentDays.includes(dayKey)) {
        return currentDays.filter((item) => item !== dayKey)
      }
      return [...currentDays, dayKey]
    })
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-28">
      <TopAppBar title="Add Alarm" showBack showMore />
      <main className="mx-auto max-w-md px-4 pt-20">
        <h1 className="mb-2 text-5xl font-extrabold leading-[1.05] text-slate-900">New Dosage Reminder</h1>
        <p className="mb-6 text-xl text-slate-600">Precision tracking for your health.</p>

        <Card className="mb-6 px-4 py-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Schedule Time</span>
            <button
              type="button"
              onClick={toggleTimeFormat}
              className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-white"
            >
              {is24Hour ? '24H FORMAT' : '12H FORMAT'}
            </button>
          </div>
          <div className="relative mt-2 rounded-2xl bg-slate-100 px-2 py-5">
            <div className="pointer-events-none absolute inset-x-6 top-1/2 h-11 -translate-y-1/2 rounded-xl border border-blue-100" />
            <div className={`grid items-center gap-2 ${is24Hour ? 'grid-cols-[1fr_auto_1fr]' : 'grid-cols-[1fr_auto_1fr_1fr]'}`}>
              <div
                ref={hourRef}
                onScroll={createScrollHandler(hourOptions, setSelectedHour)}
                className="h-44 snap-y snap-mandatory overflow-y-auto scrollbar-none"
              >
                <div className="h-[66px]" />
                {hourOptions.map((hour, index) => (
                  <button
                    key={hour}
                    type="button"
                    onClick={() => {
                      setSelectedHour(hour)
                      scrollToOption(hourRef.current, index)
                    }}
                    className={`block h-11 w-full snap-center text-center text-4xl font-extrabold ${getWheelTextClass(selectedHour === hour)}`}
                  >
                    {hour}
                  </button>
                ))}
                <div className="h-[66px]" />
              </div>

              <span className="text-4xl font-extrabold text-primary">:</span>

              <div
                ref={minuteRef}
                onScroll={createScrollHandler(minutes, setSelectedMinute)}
                className="h-44 snap-y snap-mandatory overflow-y-auto scrollbar-none"
              >
                <div className="h-[66px]" />
                {minutes.map((minute, index) => (
                  <button
                    key={minute}
                    type="button"
                    onClick={() => {
                      setSelectedMinute(minute)
                      scrollToOption(minuteRef.current, index)
                    }}
                    className={`block h-11 w-full snap-center text-center text-4xl font-extrabold ${getWheelTextClass(selectedMinute === minute)}`}
                  >
                    {minute}
                  </button>
                ))}
                <div className="h-[66px]" />
              </div>

              {!is24Hour && (
                <div
                  ref={periodRef}
                  onScroll={createScrollHandler(periods, setSelectedPeriod)}
                  className="h-44 snap-y snap-mandatory overflow-y-auto scrollbar-none"
                >
                  <div className="h-[66px]" />
                  {periods.map((period, index) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => {
                        setSelectedPeriod(period)
                        scrollToOption(periodRef.current, index)
                      }}
                      className={`block h-11 w-full snap-center text-center text-2xl font-extrabold ${getWheelTextClass(selectedPeriod === period)}`}
                    >
                      {period}
                    </button>
                  ))}
                  <div className="h-[66px]" />
                </div>
              )}
            </div>
          </div>
        </Card>

        <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Medicine Name</label>
        <Card className="mb-6 px-4 py-3">
          <input
            value={medicine}
            onChange={(event) => setMedicine(event.target.value)}
            placeholder="e.g. Lisinopril 10mg"
            className="w-full border-0 bg-transparent text-lg font-semibold text-slate-800 placeholder:text-slate-300 focus:ring-0"
          />
        </Card>

        <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Repeat</label>
        <div className="mb-6 flex gap-2">
          {repeatOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRepeat(option)}
              className={`rounded-full px-4 py-2 text-sm font-bold ${repeat === option ? 'bg-primary text-white' : 'bg-slate-200 text-slate-700'}`}
            >
              {option}
            </button>
          ))}
        </div>

        {repeat === 'Custom' && (
          <div className="mb-6">
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Pick Days</label>
            <Card className="px-3 py-3">
              <div className="flex flex-wrap gap-2">
                {weekDays.map((day) => {
                  const active = selectedDays.includes(day.key)
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => toggleDay(day.key)}
                      className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                        active ? 'bg-primary text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {day.label}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {selectedDays.length
                  ? `${selectedDays.length} day${selectedDays.length > 1 ? 's' : ''} selected`
                  : 'Select at least one day'}
              </p>
            </Card>
          </div>
        )}

        <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Notes</label>
        <Card className="px-4 py-3">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Take with food, avoid caffeine..."
            rows={4}
            className="w-full resize-none border-0 bg-transparent text-base text-slate-700 placeholder:text-slate-300 focus:ring-0"
          />
        </Card>
      </main>

      <div className="fixed bottom-0 left-0 w-full bg-slate-100/95 px-4 py-4 backdrop-blur">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="mx-auto flex h-14 w-full max-w-md items-center justify-center rounded-2xl bg-primary text-lg font-bold text-white shadow-[0_12px_28px_rgba(10,93,192,0.34)] disabled:opacity-60"
        >
          {isSaving ? 'Saving...' : `Save Alarm (${repeat})`}
        </button>
      </div>
    </div>
  )
}
