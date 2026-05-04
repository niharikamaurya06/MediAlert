import { useNavigate } from 'react-router-dom'

export default function TopAppBar({ title, showBack = false, showProfile = false, showMore = false }) {
  const navigate = useNavigate()

  return (
    <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between bg-slate-100/85 px-5 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        {showBack ? (
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-primary active:scale-95 transition-transform tap-highlight-none"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        ) : (
          <span className="material-symbols-outlined text-blue-700">clinical_notes</span>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-blue-900">{title || 'MediAlert'}</h1>
      </div>

      {showProfile && (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-200">
          <span className="material-symbols-outlined text-blue-900">person</span>
        </div>
      )}

      {showMore && (
        <div className="flex items-center gap-4">
          <button className="tap-highlight-none">
             <span className="material-symbols-outlined text-slate-500">more_vert</span>
          </button>
        </div>
      )}
    </header>
  )
}
