import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Dashboard from './pages/Dashboard';
import AddReminder from './pages/AddReminder';
import Taken from './pages/Taken';
import History from './pages/History';
import Settings from './pages/Settings';
import { supabase } from './services/supabaseClient';

function App() {
    return (
        <Router>
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
