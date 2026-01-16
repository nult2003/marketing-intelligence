import { Routes, Route, Link } from 'react-router-dom'
import { LayoutDashboard, Newspaper } from 'lucide-react'
import { NewsFeed } from './components/NewsFeed'
import { AdminSettings } from './components/AdminSettings'

function App() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
            <nav className="sticky top-0 z-40 border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex space-x-8 items-center">
                            <Link to="/" className="text-xl font-black bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
                                MARKET INTELLIGENT
                            </Link>
                            <nav className="flex gap-4">
                                <Link to="/news" className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
                                    <Newspaper size={18} />
                                    News Feed
                                </Link>
                                <Link to="/admin" className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
                                    <LayoutDashboard size={18} />
                                    Dashboard
                                </Link>
                            </nav>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs ring-2 ring-white">
                                AD
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
                <Routes>
                    <Route path="/" element={<NewsFeed />} />
                    <Route path="/news" element={<NewsFeed />} />
                    <Route path="/admin" element={<AdminSettings />} />
                </Routes>
            </main>
        </div>
    )
}

export default App
