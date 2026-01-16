import { useState, useMemo, useEffect } from 'react'
import { Save, Plus, X, Play, Pause, Settings2, Users, Bell, Mail, ShieldCheck, BarChart3, PieChart, LineChart as LineChartIcon, Activity, Trophy, Clock, TrendingUp, Filter } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, cn } from './ui/base-ui'
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart as RePieChart, Pie, Cell,
    BarChart, Bar, Legend, ScatterChart, Scatter, ZAxis,
    ComposedChart, Area
} from 'recharts'
import { useQuery } from '@tanstack/react-query'
import { subHours, subDays, subMonths, subYears, format, parseISO, isAfter } from 'date-fns'

type TimeRange = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly'

const COMMODITY_MAPPING = {
    'Electric Vehicle': { name: 'Lithium Carbonate', symbol: 'LI:COM', unit: '$/tonne', color: '#10b981' },
    'Construction': { name: 'Steel Index', symbol: 'STEEL', unit: 'Index', color: '#3b82f6' },
    'Logistics': { name: 'Diesel Price', symbol: 'DIESEL', unit: '$/gal', color: '#f59e0b' },
}

import { apiRequest } from '../lib/api'
import { useQueryClient } from '@tanstack/react-query'

export const AdminSettings = () => {
    const queryClient = useQueryClient()
    const [activeTab, setActiveTab] = useState<'crawler' | 'users' | 'analytics' | 'ranking'>('analytics')
    const [selectedIndustry, setSelectedIndustry] = useState<string>('Electric Vehicle')
    const [timeRange, setTimeRange] = useState<TimeRange>('Monthly')

    // Config Fetching
    const { data: config, isLoading: isLoadingConfig } = useQuery({
        queryKey: ['admin-config'],
        queryFn: () => apiRequest<{ search_keywords: string[], scraping_interval_minutes: number }>('/admin/config')
    })

    const [keywords, setKeywords] = useState<string[]>([])
    const [interval, setInterval] = useState(60)
    const [newKeyword, setNewKeyword] = useState('')
    const [isScrapingActive, setIsScrapingActive] = useState(true)

    // Sync state with fetched config
    useEffect(() => {
        if (config && keywords.length === 0) {
            setKeywords(config.search_keywords)
            setInterval(config.scraping_interval_minutes)
            if (config.search_keywords.length > 0) {
                setSelectedIndustry(config.search_keywords[0])
            }
        }
    }, [config])


    // User/Alert Management
    const { data: userList, isLoading: isLoadingUsers } = useQuery<any[]>({
        queryKey: ['users'],
        queryFn: () => apiRequest<any[]>('/admin/users')
    })
    const [newUserEmail, setNewUserEmail] = useState('')

    const addRecipient = async () => {
        if (!newUserEmail) return
        try {
            await apiRequest('/admin/users', {
                method: 'POST',
                body: JSON.stringify({ email: newUserEmail })
            })
            setNewUserEmail('')
            queryClient.invalidateQueries({ queryKey: ['users'] })
        } catch (e) {
            alert('Enrolling user failed')
        }
    }

    const toggleUserAlert = async (id: number) => {
        try {
            await apiRequest(`/admin/users/${id}/toggle-alerts`, { method: 'PATCH' })
            queryClient.invalidateQueries({ queryKey: ['users'] })
        } catch (e) {
            alert('Failed to toggle alerts')
        }
    }

    const removeUser = async (id: number) => {
        if (!confirm('Are you sure you want to remove this recipient?')) return
        try {
            await apiRequest(`/admin/users/${id}`, { method: 'DELETE' })
            queryClient.invalidateQueries({ queryKey: ['users'] })
        } catch (e) {
            alert('Failed to delete user')
        }
    }

    // Analytics Data Fetching - Fetch 'All' for ranking to show leaderboard comparison
    const queryIndustry = activeTab === 'ranking' ? 'All' : selectedIndustry;
    const { data: analyticsData = { news: [], trends: [] } } = useQuery<any>({
        queryKey: ['admin-analytics', queryIndustry, timeRange],
        queryFn: () => apiRequest<any>(`/admin/analytics?industry=${encodeURIComponent(queryIndustry)}&time_range=${timeRange}`)
    })

    const rawNews = analyticsData.news || []
    const trendData = analyticsData.trends || []

    const filteredSentimentData = useMemo(() => {
        let startDate: Date
        switch (timeRange) {
            case 'Daily': startDate = subHours(new Date(), 24); break;
            case 'Weekly': startDate = subDays(new Date(), 7); break;
            case 'Monthly': startDate = subMonths(new Date(), 1); break;
            case 'Yearly': startDate = subYears(new Date(), 1); break;
            default: startDate = subMonths(new Date(), 1)
        }

        const filtered = rawNews.filter((item: any) => isAfter(parseISO(item.published_at || item.created_at), startDate))

        const counts = {
            Positive: { name: 'Positive', value: 0, color: '#10b981' },
            Neutral: { name: 'Neutral', value: 0, color: '#f59e0b' },
            Risk: { name: 'Risk', value: 0, color: '#ef4444' }
        }

        filtered.forEach((item: any) => {
            if (item.sentiment_score > 7) counts.Positive.value++
            else if (item.sentiment_score < 4) counts.Risk.value++
            else counts.Neutral.value++
        })

        return Object.values(counts).filter(c => c.value > 0)
    }, [rawNews, timeRange])

    const industryImpactData = useMemo(() => {
        const aggregation: Record<string, { name: string, score: number, count: number }> = {}

        rawNews.forEach((item: any) => {
            const tag = item.industry_tag || 'General'
            if (!aggregation[tag]) aggregation[tag] = { name: tag, score: 0, count: 0 }
            aggregation[tag].score += item.impact_score
            aggregation[tag].count += 1
        })

        return Object.values(aggregation)
            .map((item: any) => ({
                name: item.name,
                score: parseFloat((item.score / item.count).toFixed(1))
            }))
            .sort((a, b) => b.score - a.score)
    }, [rawNews])

    const riskDistributionData = useMemo(() => {
        const risks = ['Policy', 'Competition', 'Supply Chain', 'Financial', 'Other', 'None']
        const counts = risks.map(r => ({ name: r, count: 0 }))

        rawNews.forEach((item: any) => {
            const r = item.risk_type || 'None'
            const found = counts.find(c => c.name === r)
            if (found) found.count++
            else counts.find(c => c.name === 'Other')!.count++
        })
        return counts.filter(c => c.count > 0)
    }, [rawNews])

    const scatterData = useMemo(() => {
        return rawNews.map((item: any) => ({
            impact: item.impact_score,
            urgency: item.urgency === 'High' ? 3 : item.urgency === 'Medium' ? 2 : 1,
            title: item.title,
            id: item.id
        }))
    }, [rawNews])


    // API Actions
    const updateConfig = async (newKeywords?: string[], newInterval?: number) => {
        const payload = {
            search_keywords: newKeywords || keywords,
            scraping_interval_minutes: newInterval || interval
        }
        try {
            await apiRequest('/admin/config', {
                method: 'POST',
                body: JSON.stringify(payload)
            })
            queryClient.invalidateQueries({ queryKey: ['admin-config'] })
            // Only alert if manually clicking "Update Settings" for interval
            if (!newKeywords) alert('Config updated successfully')
        } catch (e) {
            alert('Failed to update config')
        }
    }

    const triggerCrawl = async () => {
        try {
            await apiRequest('/admin/trigger-crawl', { method: 'POST' })
            alert('Crawl task queued')
        } catch (e) {
            alert('Failed to trigger crawl')
        }
    }

    // Event handlers
    const addKeyword = async () => {
        if (newKeyword && !keywords.includes(newKeyword)) {
            const updated = [...keywords, newKeyword];
            setKeywords(updated);
            setNewKeyword('');
            await updateConfig(updated);
        }
    }

    const removeKeyword = async (kw: string) => {
        const updated = keywords.filter(k => k !== kw);
        setKeywords(updated);
        await updateConfig(updated);
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
                        <ShieldCheck className="text-indigo-600" size={32} />
                        Command Center
                    </h1>
                    <p className="text-muted-foreground font-medium">Configure market intelligence parameters and insights.</p>
                </div>
                <div className="flex gap-2 p-1.5 bg-slate-200 shadow-inner rounded-xl overflow-x-auto">
                    {[
                        { id: 'analytics', label: 'Analytics', icon: Activity },
                        { id: 'ranking', label: 'Ranking', icon: Trophy },
                        { id: 'crawler', label: 'Crawler', icon: Settings2 },
                        { id: 'users', label: 'Users', icon: Users }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-5 py-2 text-sm font-black rounded-lg transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-white shadow-md text-primary' : 'text-slate-600 hover:text-slate-800 hover:bg-white/40'}`}
                        >
                            <tab.icon size={14} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </header>

            {/* Global Time Filter Bar */}
            {(activeTab === 'analytics' || activeTab === 'ranking') && (
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <Clock size={20} />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest leading-none">Global Timeframe</h2>
                            <p className="text-[10px] text-slate-500 font-bold mt-1">Updates all charts and data groups</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        {(['Daily', 'Weekly', 'Monthly', 'Yearly'] as TimeRange[]).map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={cn(
                                    "px-4 py-1.5 text-xs font-black rounded-lg transition-all",
                                    timeRange === range
                                        ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm"
                                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                )}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'analytics' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm gap-4">
                        <div className="flex items-center gap-3">
                            <Badge variant="outline" className="bg-indigo-600/20 text-indigo-400 border-indigo-500/30 font-black px-3 py-1 animate-pulse shadow-[0_0_15px_rgba(99,102,241,0.2)]">CORE SIGNALS</Badge>
                            <div>
                                <h3 className="text-sm font-black text-slate-100 uppercase tracking-[0.2em]">Industry Intelligence Snapshot</h3>
                                <p className="text-[10px] text-slate-500 font-black italic tracking-tighter opacity-80">Monitoring: {selectedIndustry}</p>
                            </div>
                        </div>
                        <select
                            value={selectedIndustry}
                            onChange={(e) => setSelectedIndustry(e.target.value)}
                            className="bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-black text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-500/10 outline-none w-full md:w-auto shadow-sm cursor-pointer"
                        >
                            <option value="All">All Keywords</option>
                            {keywords.map(kw => <option key={kw} value={kw}>{kw}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        <Card className="bg-slate-950 border-slate-800 text-white overflow-hidden shadow-2xl relative">
                            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
                            <CardHeader className="border-b border-slate-800/50 bg-slate-900/50">
                                <CardTitle className="flex items-center gap-2 text-slate-100 font-black text-sm uppercase tracking-widest">
                                    <BarChart3 size={16} /> Risk Distribution
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="h-[320px] pt-8 px-4 pb-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={riskDistributionData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                        <XAxis dataKey="name" stroke="#475569" fontSize={10} fontWeight="900" />
                                        <YAxis stroke="#475569" fontSize={10} fontWeight="900" />
                                        <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b' }} />
                                        <Bar dataKey="count" fill="#8884d8" radius={[4, 4, 0, 0]}>
                                            {riskDistributionData.map((_entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#6366f1'][index % 5]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card className="bg-slate-950 border-slate-800 text-white overflow-hidden shadow-2xl relative">
                            <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500" />
                            <CardHeader className="border-b border-slate-800/50 bg-slate-900/50">
                                <CardTitle className="flex items-center gap-2 text-slate-100 font-black text-sm uppercase tracking-widest">
                                    <TrendingUp size={16} /> Urgency vs Impact
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="h-[320px] pt-8 px-4 pb-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                        <XAxis type="number" dataKey="impact" name="Impact" stroke="#475569" domain={[0, 10]} />
                                        <YAxis type="number" dataKey="urgency" name="Urgency" stroke="#475569" domain={[1, 3]} tickFormatter={(val) => val === 3 ? 'High' : val === 2 ? 'Med' : 'Low'} />
                                        <ZAxis type="number" range={[100, 400]} />
                                        <Tooltip
                                            cursor={{ strokeDasharray: '3 3' }}
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const data = payload[0].payload;
                                                    return (
                                                        <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl shadow-2xl max-w-[240px]">
                                                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Impact Signal</p>
                                                            <p className="text-xs font-bold text-slate-100 mb-2 leading-tight">{data.title}</p>
                                                            <div className="flex justify-between items-center bg-slate-900 p-2 rounded-lg border border-slate-800/50">
                                                                <div>
                                                                    <p className="text-[8px] uppercase font-black text-slate-500">Impact</p>
                                                                    <p className="text-sm font-black text-emerald-400">{data.impact}</p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-[8px] uppercase font-black text-slate-500">Urgency</p>
                                                                    <p className={cn("text-xs font-black", data.urgency === 3 ? "text-rose-500" : "text-amber-500")}>
                                                                        {data.urgency === 3 ? 'HIGH' : data.urgency === 2 ? 'MED' : 'LOW'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Scatter name="Articles" data={scatterData} fill="#6366f1">
                                            {scatterData.map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={entry.urgency === 3 ? '#ef4444' : entry.urgency === 2 ? '#f59e0b' : '#10b981'} />
                                            ))}
                                        </Scatter>
                                    </ScatterChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card className="bg-slate-950 border-slate-800 text-white overflow-hidden shadow-2xl relative">
                            <div className="absolute top-0 left-0 w-full h-1 bg-amber-500" />
                            <CardHeader className="border-b border-slate-800/50 bg-slate-900/50">
                                <CardTitle className="flex items-center gap-2 text-slate-100 font-black text-sm uppercase tracking-widest">
                                    <PieChart className="text-amber-400" size={16} />
                                    Sentiment Mix
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="h-[320px] flex flex-col items-center justify-center p-6">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RePieChart>
                                        <Pie data={filteredSentimentData} innerRadius={60} outerRadius={90} paddingAngle={8} dataKey="value" stroke="none">
                                            {filteredSentimentData.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#020617',
                                                border: '1px solid #1e293b',
                                                borderRadius: '12px',
                                                fontSize: '11px',
                                                color: '#f8fafc'
                                            }}
                                            itemStyle={{ color: '#f8fafc' }}
                                        />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }} />
                                    </RePieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-2 bg-slate-950 border-slate-800 text-white overflow-hidden shadow-2xl mt-8">
                            <CardHeader className="bg-slate-900/80 border-b border-white/5 p-6">
                                <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-3">
                                    <Activity size={14} className="text-indigo-400" />
                                    Raw Business Metrics Log
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 z-10 bg-slate-900 border-b-2 border-slate-800">
                                            <tr className="text-slate-500 font-black uppercase text-[9px] tracking-[0.2em]">
                                                <th className="px-8 py-4">Brand / Source</th>
                                                <th className="px-8 py-4">Metric Indicator</th>
                                                <th className="px-8 py-4">Observed Value</th>
                                                <th className="px-8 py-4">Pub Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {trendData.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="py-20 text-center text-slate-500 font-black italic text-xs uppercase tracking-widest opacity-30">
                                                        No granular metrics recorded for this period
                                                    </td>
                                                </tr>
                                            ) : trendData.map((t: any, idx: number) => (
                                                <tr key={t.id} className={cn("text-[11px] group transition-colors", idx % 2 === 0 ? "bg-white/[0.02]" : "bg-transparent hover:bg-white/[0.04]")}>
                                                    <td className="px-8 py-4 font-black text-indigo-400 uppercase tracking-tighter">
                                                        {t.company_name || 'Global Market'}
                                                    </td>
                                                    <td className="px-8 py-4 text-slate-300 font-medium">
                                                        {t.metric_name}
                                                    </td>
                                                    <td className="px-8 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className={cn(
                                                                "px-2 py-0.5 rounded-md font-black text-[10px]",
                                                                /growth|tăng trưởng|thị phần|share/i.test(t.metric_name)
                                                                    ? t.metric_value > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                                                                    : "bg-slate-800 text-slate-100"
                                                            )}>
                                                                {t.metric_value.toLocaleString()} {t.metric_unit}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-4 text-slate-500 font-mono italic text-[9px]">
                                                        {format(parseISO(t.published_at), 'MMM dd, HH:mm')}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* Ranking, Crawler, Users tabs remain but with improved header consistency... */}
            {activeTab === 'ranking' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Card className="bg-slate-950 border-slate-800 text-white shadow-2xl overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
                        <CardHeader className="bg-slate-900/50 border-b border-slate-800 flex flex-row items-center justify-between p-8">
                            <div>
                                <CardTitle className="flex items-center gap-3 text-2xl font-black text-white italic">
                                    <Trophy className="text-emerald-400" size={28} />
                                    Leaderboard
                                </CardTitle>
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Impact Volatility Ranking</p>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8">
                            <div className="h-[400px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={industryImpactData} layout="vertical" margin={{ left: 40, right: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                                        <XAxis type="number" stroke="#475569" fontSize={10} fontWeight="900" domain={[0, 10]} axisLine={false} tickLine={false} />
                                        <YAxis dataKey="name" type="category" stroke="#f1f5f9" fontSize={12} fontWeight="900" axisLine={false} tickLine={false} width={120} />
                                        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px' }} labelStyle={{ color: '#fff' }} itemStyle={{ color: '#fff' }} />
                                        <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={30}>
                                            {industryImpactData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.score > 7 ? '#10b981' : entry.score > 5 ? '#f59e0b' : '#ef4444'} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {activeTab === 'crawler' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Card className="md:col-span-2 shadow-xl border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                        <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b p-6">
                            <CardTitle className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Mail size={14} className="text-indigo-600" />
                                Extraction Nodes
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="flex gap-3">
                                <Input
                                    placeholder="Global keyword..."
                                    value={newKeyword}
                                    onChange={(e) => setNewKeyword(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                                    className="bg-slate-900 dark:bg-slate-950 text-white dark:text-slate-50 font-black text-xs border-slate-200 dark:border-slate-800 h-12 rounded-xl focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-500"
                                />
                                <Button onClick={addKeyword} className="h-12 w-12 p-0 shadow-lg bg-indigo-600 hover:bg-indigo-700 transition-all text-white"><Plus size={24} strokeWidth={3} /></Button>
                            </div>
                            <div className="flex flex-wrap gap-2 pt-2">
                                {keywords.map(kw => (
                                    <Badge key={kw} variant="outline" className="px-4 py-2 flex items-center gap-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-full shadow-sm">
                                        <span className="text-slate-900 dark:text-slate-100 font-black text-[10px] uppercase tracking-wider">{kw}</span>
                                        <button onClick={() => removeKeyword(kw)} className="text-slate-400 hover:text-rose-600 transition-colors"><X size={14} /></button>
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="shadow-xl border-slate-200 dark:border-slate-800 rounded-2xl h-fit">
                        <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b p-6"><CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500">Node Status</CardTitle></CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Crawl</span>
                                <button onClick={() => setIsScrapingActive(!isScrapingActive)} className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all shadow-inner ${isScrapingActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-800'}`}><span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${isScrapingActive ? 'translate-x-6' : 'translate-x-1'}`} /></button>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between text-[10px] text-indigo-600 font-black uppercase tracking-[0.2em]"><span>Interval</span><span>{interval}m</span></div>
                                <input type="range" min="15" max="1440" step="15" value={interval} onChange={(e) => setInterval(parseInt(e.target.value))} className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                            </div>
                            <hr className="border-slate-100 dark:border-slate-800" />
                            <div className="space-y-3">
                                <Button className="w-full h-12 gap-2 font-black text-[10px] uppercase tracking-widest shadow-lg bg-emerald-600 hover:bg-emerald-700" onClick={triggerCrawl}>
                                    <Play size={16} /> Force Sync Now
                                </Button>
                                <Button className="w-full h-12 gap-2 font-black text-[10px] uppercase tracking-widest shadow-lg" variant="outline" onClick={() => updateConfig()}>
                                    <Save size={16} /> Update Settings
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {activeTab === 'users' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Card className="shadow-2xl border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                        <CardHeader className="bg-white dark:bg-slate-900 border-b p-6">
                            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                <Users size={16} className="text-indigo-600" />
                                Alert Network
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-950 border-b text-slate-400 font-black uppercase text-[9px] tracking-[0.3em]">
                                        <tr><th className="px-8 py-4">Identity</th><th className="px-8 py-4">Focus</th><th className="px-8 py-4">Status</th><th className="px-8 py-4 text-right">Action</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {userList?.map((user) => (
                                            <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-indigo-600 font-black border border-slate-300 dark:border-slate-700 shadow-sm">
                                                            {user.email[0].toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="font-black text-slate-900 dark:text-slate-50 text-sm">{user.email}</div>
                                                            <div className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">{user.is_admin ? 'Admin' : 'User'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <Badge variant="outline" className="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 font-black text-[9px] px-3 py-1 text-slate-700 dark:text-slate-300 shadow-sm">
                                                        {user.industry_preference || 'General'}
                                                    </Badge>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <button
                                                        onClick={() => toggleUserAlert(user.id)}
                                                        className={`flex items-center gap-2 text-[9px] font-black tracking-widest px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 ${user.receive_email_alerts ? 'text-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10' : 'text-slate-400'}`}
                                                    >
                                                        {user.receive_email_alerts ? <Bell size={12} className="fill-current" /> : <Mail size={12} />}
                                                        {user.receive_email_alerts ? 'LIVE' : 'MUTED'}
                                                    </button>
                                                </td>
                                                <td className="px-8 py-5 text-right"><Button variant="ghost" className="h-10 w-10 p-0 text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl" onClick={() => removeUser(user.id)}><X size={18} /></Button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-8 bg-slate-100 dark:bg-slate-950/80 border-t flex flex-col sm:flex-row gap-4">
                                <Input
                                    className="max-w-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 font-black text-xs border-slate-300 dark:border-slate-700 h-12 rounded-xl focus:ring-4 focus:ring-indigo-500/20 shadow-sm"
                                    placeholder="Enroll email address..."
                                    value={newUserEmail}
                                    onChange={(e) => setNewUserEmail(e.target.value)}
                                />
                                <Button className="h-12 px-8 font-black text-xs uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 shadow-lg text-white" onClick={addRecipient}>Add Recipient</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
