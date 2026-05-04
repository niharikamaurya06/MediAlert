import { Link, useLocation } from 'react-router-dom'

export default function BottomNavBar() {
  const location = useLocation()

  const navItems = [
    { path: '/', icon: 'dashboard', label: 'Dashboard' },
    { path: '/history', icon: 'history', label: 'History' },
    { path: '/settings', icon: 'settings', label: 'Settings' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around rounded-t-3xl bg-white/95 px-4 pb-6 pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.04)] backdrop-blur-xl">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path

        return (
          <Link
            key={item.label}
            to={item.path}
            className={`flex flex-col items-center justify-center px-5 py-2 active:scale-90 transition-all duration-300 ease-out tap-highlight-none ${
              isActive ? 'rounded-2xl bg-blue-50 text-blue-700' : 'text-slate-400'
            }`}
          >
            <span
              className="material-symbols-outlined"
              style={isActive ? { fontVariationSettings: '"FILL" 1' } : {}}
            >
              {item.icon}
            </span>
            <span className="mt-1 text-[11px] font-medium tracking-wide">
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
