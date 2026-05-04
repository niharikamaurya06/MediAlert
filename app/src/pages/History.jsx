import { useEffect, useState } from 'react'
import BottomNavBar from '../components/BottomNavBar'
import Card from '../components/Card'
import TopAppBar from '../components/TopAppBar'
import { clearHistory, fetchHistoryLog, supabase } from '../services/supabaseClient'

export default function History() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [isClearing, setIsClearing] = useState(false)

  const loadHistory = async () => {
    try {
      const historyLog = await fetchHistoryLog()
      setHistory(historyLog)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
    const channel = supabase
      .channel('medialert-live-history')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'history' }, loadHistory)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleClearHistory = async () => {
    const shouldClear = window.confirm('Clear all medication history? This cannot be undone.')
    if (!shouldClear) {
      return
    }

    setIsClearing(true)
    try {
      await clearHistory()
      setHistory([])
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-28">
      <TopAppBar title="History" />
      <main className="mx-auto max-w-md px-4 pt-20">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-4xl font-extrabold text-slate-900">Medication History</h1>
          {!!history.length && (
            <button
              type="button"
              onClick={handleClearHistory}
              disabled={isClearing}
              className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 disabled:opacity-50"
            >
              {isClearing ? 'Clearing...' : 'Clear History'}
            </button>
          )}
        </div>
        <div className="space-y-3">
          {loading ? (
            <Card className="px-4 py-5 text-slate-500">Loading history...</Card>
          ) : !history.length ? (
            <Card className="px-4 py-5 text-slate-500">No medication history found.</Card>
          ) : (
            history.map((log) => (
              <Card key={log.id} className={`px-4 py-4 ${log.status === 'missed' ? 'border border-red-200' : ''}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xl font-bold text-slate-900">{log.medicine}</p>
                    <p className="text-xs text-slate-500">{log.date} • Scheduled {log.scheduled_time}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-bold uppercase tracking-widest ${log.status === 'missed' ? 'text-red-600' : 'text-primary'}`}>
                      {log.status}
                    </p>
                    <p className="text-sm font-semibold text-slate-700">{log.taken_time || '--:--'}</p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </main>
      <BottomNavBar />
    </div>
  )
}
