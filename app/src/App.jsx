import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import Dashboard from './pages/Dashboard';
import AddReminder from './pages/AddReminder';
import Taken from './pages/Taken';
import History from './pages/History';
import Settings from './pages/Settings';
import { supabase } from './services/supabaseClient';

function FirmwareTakenListener() {
    const navigate = useNavigate()
    const location = useLocation()
    const lastEventKeyRef = useRef('')

    useEffect(() => {
        const openTaken = (entry) => {
            const medicine = entry?.medicine || 'Unknown'
            const takenTime = entry?.taken_time || '--:--'
            const eventKey = `${medicine}-${takenTime}`

            if (lastEventKeyRef.current === eventKey) {
                return
            }

            lastEventKeyRef.current = eventKey
            setTimeout(() => {
                if (lastEventKeyRef.current === eventKey) {
                    lastEventKeyRef.current = ''
                }
            }, 3000)

            navigate('/taken', {
                replace: location.pathname === '/taken',
                state: {
                    medicine,
                    takenTime,
                    autoClose: true,
                },
            })
        }

        const channel = supabase
            .channel('medialert-firmware-taken-listener')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'history' }, (payload) => {
                const entry = payload.new
                const firmwareTriggers = ['button', 'box_opened']
                const isFirmwareConfirmed = entry?.status === 'taken' && firmwareTriggers.includes(entry?.trigger)

                if (!isFirmwareConfirmed) {
                    return
                }

                // Schedule the reminder reset at the next minute boundary so the
                // firmware can't re-fetch and re-ring within the same scheduled minute.
                // Only do this here for box_opened; the button trigger is also used by
                // the app toggle (which schedules its own reset in markReminderTaken).
                const scheduledTime = entry?.scheduled_time
                const medicine = entry?.medicine
                if (scheduledTime && medicine) {
                    const now = new Date()
                    const msUntilReset = (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 2000
                    setTimeout(async () => {
                        await supabase
                            .from('reminders')
                            .update({ active: true, status: 'pending', taken_time: null })
                            .eq('medicine', medicine)
                            .eq('time', scheduledTime)
                    }, msUntilReset)
                }

                openTaken(entry)
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reminders' }, (payload) => {
                const entry = payload.new
                const isTakenUpdate = entry?.status === 'taken' && entry?.active === false && !!entry?.taken_time
                if (!isTakenUpdate) {
                    return
                }
                openTaken(entry)
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [navigate, location.pathname])

    return null
}

function App() {
    return (
        <Router>
            <FirmwareTakenListener />
            <div className="bg-surface text-on-surface min-h-screen relative">
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/add-reminder" element={<AddReminder />} />
                    <Route path="/taken" element={<Taken />} />
                    <Route path="/history" element={<History />} />
                    <Route path="/settings" element={<Settings />} />
                    {/* Aliases mapping for old routes */}
                    <Route path="/add-alarm" element={<AddReminder />} />
                    <Route path="/dose-confirmed" element={<Taken />} />
                    <Route path="/schedule" element={<Dashboard />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
