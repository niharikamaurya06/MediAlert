export default function TimerRing({ label = '--:--', progress = 0 }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const clampedProgress = Math.max(0, Math.min(100, progress))
  const offset = circumference - (clampedProgress / 100) * circumference

  return (
    <div className="relative h-36 w-36">
      <svg viewBox="0 0 120 120" className="-rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#e4eaf2" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#0a5dc0"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold text-slate-900">{label}</span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">remaining</span>
      </div>
    </div>
  )
}
