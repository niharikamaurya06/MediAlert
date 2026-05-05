import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Card from '../components/Card'
import TopAppBar from '../components/TopAppBar'

export default function Taken() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [flashVisible, setFlashVisible] = useState(false)

  // Auto-close when triggered by firmware
  useEffect(() => {
    if (state?.autoClose) {
      const timer = setTimeout(() => {
        navigate('/')
      }, 1200)
      return () => clearTimeout(timer)
    }
  }, [state, navigate])

  // Flash on mount — always, regardless of how we got here (firmware or app toggle).
  // Fires 3 rapid pulses: on → off → on → off → on → off
  useEffect(() => {
    const PULSE_ON  = 180  // ms visible
    const PULSE_OFF = 120  // ms hidden
    const PULSES    = 3

    const timers = []
    let t = 0

    for (let i = 0; i < PULSES; i++) {
      const onDelay  = t
      const offDelay = t + PULSE_ON
      timers.push(setTimeout(() => setFlashVisible(true),  onDelay))
      timers.push(setTimeout(() => setFlashVisible(false), offDelay))
      t += PULSE_ON + PULSE_OFF
    }

    return () => timers.forEach(clearTimeout)
  }, [])

  const medicine = state?.medicine ?? 'Medicine'
  const takenTime = state?.takenTime ?? '--:--'
  const nextDose = state?.nextDose ?? '--:--'
  const progress = state?.progress ?? 0

  return (
    <div className="relative min-h-screen bg-slate-100 px-4 pt-20">
      {/* Flash overlay — sits above background, below content */}
      <div
        className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-75"
        style={{
          background: 'rgba(10, 93, 192, 0.22)',
          opacity: flashVisible ? 1 : 0,
        }}
      />

      <TopAppBar />
      <main className="relative z-20 mx-auto max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="flex h-44 w-44 items-center justify-center rounded-full bg-primary shadow-[0_16px_30px_rgba(10,93,192,0.28)]">
            <span className="material-symbols-outlined text-7xl text-white" style={{ fontVariationSettings: '"FILL" 1' }}>
              check
            </span>
          </div>
        </div>

        <h1 className="text-center text-6xl font-extrabold leading-none text-slate-900">Medicine Taken!</h1>
        <p className="mb-6 mt-2 text-center text-xl text-slate-500">Your dose has been successfully recorded.</p>

        <Card className="mb-4 px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-extrabold text-slate-900">{medicine}</p>
              <p className="text-slate-600">Time recorded</p>
            </div>
            <p className="text-4xl font-extrabold text-slate-900">{takenTime}</p>
          </div>
        </Card>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <Card className="px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Next Dose</p>
            <p className="text-2xl font-bold text-slate-900">{nextDose}</p>
          </Card>
          <Card className="px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Daily Progress</p>
            <p className="text-2xl font-bold text-slate-900">{progress}%</p>
          </Card>
        </div>

        <Card className="mb-6 px-4 py-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold text-slate-800">Daily Compliance</p>
            <p className="font-bold text-primary">{progress}%</p>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </Card>

        <button
          type="button"
          onClick={() => navigate('/')}
          className="mb-8 h-14 w-full rounded-2xl bg-primary text-xl font-bold text-white shadow-[0_12px_28px_rgba(10,93,192,0.34)]"
        >
          Back to Schedule
        </button>
      </main>
    </div>
  )
}
