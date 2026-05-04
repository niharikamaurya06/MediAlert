import BottomNavBar from '../components/BottomNavBar'
import TopAppBar from '../components/TopAppBar'

export default function Settings() {
  return (
    <div className="min-h-screen bg-slate-100 pb-28">
      <TopAppBar title="Settings" />
      <main className="mx-auto max-w-md px-4 pt-20">
        <h1 className="mb-3 text-4xl font-extrabold text-slate-900">Settings</h1>
        <p className="rounded-2xl bg-white px-4 py-5 text-slate-600 shadow-[0_8px_22px_rgba(15,41,77,0.08)]">
          Settings page placeholder. Preferences and account controls will be added here soon.
        </p>
      </main>
      <BottomNavBar />
    </div>
  )
}
