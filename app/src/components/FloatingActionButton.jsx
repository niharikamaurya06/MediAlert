import { useNavigate } from 'react-router-dom'

export default function FloatingActionButton() {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate('/add-reminder')}
      className="fixed bottom-28 right-6 w-16 h-16 bg-primary text-on-primary rounded-full shadow-[0_12px_24px_rgba(0,72,141,0.3)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-50 tap-highlight-none"
    >
      <span className="material-symbols-outlined text-3xl">add</span>
    </button>
  )
}
