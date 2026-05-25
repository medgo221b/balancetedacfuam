'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, PieChart, Pie
} from 'recharts'
import { 
  Upload, Search, Filter, ArrowUpCircle, ArrowDownCircle, 
  Wallet, Download, Calendar, LayoutDashboard, FileText, 
  Lock, Unlock, Trash2, Edit3, PiggyBank, ArrowRightLeft, Plus,
  ListFilter
} from 'lucide-react'
import * as XLSX from 'xlsx'

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  operation_id: string
  source_file: string
  category: string
  type: 'transaction' | 'caixinha_in' | 'caixinha_out' | 'rendimento'
  sequence: number
}

type ViewType = 'overview' | 'caixinhas' | 'extrato' | 'monthly' | 'quarterly' | 'annual'

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState<ViewType>('overview')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all')
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchData = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
      .order('sequence', { ascending: false })

    if (!error && data) {
      setTransactions(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleToggleAdmin = () => {
    if (isAdmin) {
      setIsAdmin(false)
      setAdminPassword('')
    } else {
      const pass = prompt('Digite a senha administrativa:')
      if (pass) {
        setIsAdmin(true)
        setAdminPassword(pass)
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta transação?')) return

    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ password: adminPassword }),
      })
      const result = await res.json()
      if (result.success) {
        fetchData()
      } else {
        alert(result.error || 'Erro ao excluir')
      }
    } catch (err) {
      alert('Erro na requisição')
    }
  }

  const handleEdit = async (transaction: Transaction) => {
    const newDesc = prompt('Nova descrição:', transaction.description)
    if (newDesc === null) return
    const newAmountStr = prompt('Novo valor (use ponto para decimal):', transaction.amount.toString())
    if (newAmountStr === null) return
    const newAmount = parseFloat(newAmountStr)

    try {
      const res = await fetch(`/api/transactions/${transaction.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ 
          password: adminPassword,
          description: newDesc,
          amount: newAmount
        }),
      })
      const result = await res.json()
      if (result.success) {
        fetchData()
      } else {
        alert(result.error || 'Erro ao editar')
      }
    } catch (err) {
      alert('Erro na requisição')
    }
  }

  const handleAddManual = async () => {
    if (!isAdmin) {
      alert('Acesso administrativo necessário.');
      return;
    }
    const desc = prompt('Descrição (ex: Saldo Inicial Foto):');
    if (!desc) return;
    const value = prompt('Valor (ex: 150.50):');
    if (!value) return;
    const cat = prompt('Categoria (ex: Produtos, Crachás, Geral):', 'Geral');
    if (!cat) return;
    const type = prompt('Tipo (transaction, caixinha_in, caixinha_out, rendimento):', 'transaction') as any;
    if (!type) return;

    const { error } = await supabase.from('transactions').insert({
      description: desc,
      amount: parseFloat(value),
      category: cat,
      type: type,
      date: new Date().toISOString().split('T')[0],
      operation_id: 'MANUAL-' + Date.now(),
      sequence: 999
    });

    if (error) alert('Erro: ' + error.message);
    else { alert('Lançamento realizado!'); fetchData(); }
  }

  // Periods calculation
  const periods = useMemo(() => {
    const set = new Set<string>()
    transactions.forEach(t => {
      const d = new Date(t.date)
      const y = d.getUTCFullYear()
      const m = (d.getUTCMonth() + 1).toString().padStart(2, '0')
      if (activeTab === 'monthly' || activeTab === 'extrato') set.add(`${y}-${m}`)
      else if (activeTab === 'quarterly') set.add(`${y}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`)
      else if (activeTab === 'annual') set.add(y.toString())
    })
    return Array.from(set).sort().reverse()
  }, [transactions, activeTab])

  // Filtering Logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           t.category.toLowerCase().includes(searchTerm.toLowerCase())
      
      if (selectedPeriod === 'all' || activeTab === 'overview' || activeTab === 'caixinhas') return matchesSearch
      
      const date = new Date(t.date)
      const year = date.getUTCFullYear().toString()
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0')
      const periodKey = `${year}-${month}`
      
      if (activeTab === 'monthly' || activeTab === 'extrato') return matchesSearch && periodKey === selectedPeriod
      if (activeTab === 'quarterly') {
        const quarter = Math.floor(date.getUTCMonth() / 3) + 1
        return matchesSearch && `${year}-Q${quarter}` === selectedPeriod
      }
      return matchesSearch && year === selectedPeriod
    })
  }, [transactions, searchTerm, selectedPeriod, activeTab])

  // Stats recalculated
  const stats = useMemo(() => {
    const targetSet = (activeTab === 'overview' || activeTab === 'caixinhas') ? transactions : filteredTransactions

    const initialBalance = targetSet
      .filter(t => t.category.includes('Saldo Inicial'))
      .reduce((acc, t) => acc + t.amount, 0)

    const income = targetSet
      .filter(t => t.type === 'transaction' && t.amount > 0 && !t.category.includes('Saldo Inicial'))
      .reduce((acc, t) => acc + t.amount, 0)

    const expenses = targetSet
      .filter(t => t.type === 'transaction' && t.amount < 0)
      .reduce((acc, t) => acc + t.amount, 0)

    const rendimentos = targetSet
      .filter(t => t.type === 'rendimento')
      .reduce((acc, t) => acc + t.amount, 0)

    let cumulativeBalance = 0
    if (activeTab === 'overview' || activeTab === 'caixinhas' || selectedPeriod === 'all') {
      cumulativeBalance = transactions.reduce((acc, t) => {
        if (t.type === 'transaction' || t.type === 'rendimento') return acc + t.amount
        return acc
      }, 0)
    } else {
      const periodTransactions = transactions.filter(t => {
        const d = new Date(t.date)
        const y = d.getUTCFullYear().toString()
        const m = (d.getUTCMonth() + 1).toString().padStart(2, '0')
        if (activeTab === 'monthly' || activeTab === 'extrato') return `${y}-${m}` <= selectedPeriod
        if (activeTab === 'quarterly') {
          const q = Math.floor(d.getUTCMonth() / 3) + 1
          return `${y}-Q${q}` <= selectedPeriod
        }
        return y <= selectedPeriod
      })
      cumulativeBalance = periodTransactions.reduce((acc, t) => {
        if (t.type === 'transaction' || t.type === 'rendimento') return acc + t.amount
        return acc
      }, 0)
    }

    return { 
      initialBalance: Number(initialBalance.toFixed(2)), 
      income: Number(income.toFixed(2)), 
      expenses: Number(expenses.toFixed(2)), 
      rendimentos: Number(rendimentos.toFixed(2)), 
      balance: Number(cumulativeBalance.toFixed(2)) 
    }
  }, [transactions, filteredTransactions, activeTab, selectedPeriod])

  const exportToExcel = () => {
    const dataToExport = filteredTransactions.map(t => ({
      Data: new Date(t.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
      Descrição: t.description,
      Categoria: t.category,
      Tipo: t.type,
      Valor: t.amount,
      Arquivo: t.source_file
    }))
    const ws = XLSX.utils.json_to_sheet(dataToExport)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Transações")
    XLSX.writeFile(wb, `balancete_${activeTab}_${selectedPeriod}.xlsx`)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  const monthlyGrowthData = useMemo(() => {
    const data = transactions.reduce((acc: any[], t) => {
      if (t.type !== 'transaction' && t.type !== 'rendimento') return acc
      const d = new Date(t.date)
      const m = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' })
      let entry = acc.find(x => x.name === m)
      if (!entry) {
        entry = { name: m, total: 0 }
        acc.push(entry)
      }
      entry.total = Number((entry.total + t.amount).toFixed(2))
      return acc
    }, [])
    return data.sort((a,b) => {
        const [mA, yA] = a.name.split('/')
        const [mB, yB] = b.name.split('/')
        return new Date(2000 + parseInt(yA), 1).getTime() - new Date(2000 + parseInt(yB), 1).getTime()
    })
  }, [transactions])

  const caixinhasData = useMemo(() => {
    const categories: Record<string, number> = {}
    transactions.forEach(t => {
      if (t.type === 'caixinha_in') {
        categories[t.category] = (categories[t.category] || 0) + Math.abs(t.amount)
      } else if (t.type === 'caixinha_out') {
        categories[t.category] = (categories[t.category] || 0) - Math.abs(t.amount)
      }
    })
    return Object.entries(categories)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .filter(c => c.value !== 0)
  }, [transactions])

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100">
      <div className="flex flex-col md:flex-row min-h-screen">
        <aside className="w-full md:w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 p-6 flex flex-col">
          <div className="mb-8 text-center md:text-left">
            <h1 className="text-xl font-bold text-blue-600">D.A. 2026</h1>
            <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mt-1">Gestão Financeira</p>
          </div>

          <nav className="space-y-1 mb-8">
            <button onClick={() => { setActiveTab('overview'); setSelectedPeriod('all'); }} className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'overview' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
              <LayoutDashboard size={18} /> Panorama Geral
            </button>
            <button onClick={() => { setActiveTab('caixinhas'); setSelectedPeriod('all'); }} className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'caixinhas' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
              <PiggyBank size={18} /> Caixinhas
            </button>
            <div className="pt-4 pb-2 px-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Relatórios</div>
            <button onClick={() => { setActiveTab('extrato'); setSelectedPeriod(periods[0] || 'all'); }} className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'extrato' ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-lg' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
              <ListFilter size={18} /> Extrato Mensal
            </button>
            <button onClick={() => { setActiveTab('quarterly'); setSelectedPeriod(periods[0] || 'all'); }} className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'quarterly' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
              <Filter size={18} /> Trimestral
            </button>
            <button onClick={() => { setActiveTab('annual'); setSelectedPeriod(periods[0] || 'all'); }} className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'annual' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
              <FileText size={18} /> Anual
            </button>
          </nav>

          <div className="mt-auto space-y-3 pt-6 border-t border-zinc-100 dark:border-zinc-800">
            <button onClick={handleToggleAdmin} className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all border ${isAdmin ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800' : 'bg-zinc-50 border-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700'}`}>
              {isAdmin ? <Unlock size={14} /> : <Lock size={14} />}
              {isAdmin ? 'Admin Ativado' : 'Acesso Admin'}
            </button>

            {isAdmin && (
              <button onClick={handleAddManual} className="w-full flex items-center justify-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-2 rounded-xl text-xs font-bold hover:opacity-90 transition-all">
                <Plus size={14} /> Lançamento Foto
              </button>
            )}

            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20">
              <Upload size={18} /> {uploading ? 'Aguarde...' : 'Subir PDF'}
            </button>
            <input type="file" ref={fileInputRef} onChange={async (e) => {
               const files = e.target.files; if (!files) return;
               setUploading(true); const fd = new FormData(); for(let i=0; i<files.length; i++) fd.append('files', files[i]);
               const res = await fetch('/api/upload-pdf', { method: 'POST', body: fd });
               if((await res.json()).success) { alert('Sucesso!'); fetchData(); }
               setUploading(false);
            }} multiple accept=".pdf" className="hidden" />
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-10 overflow-auto">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
            <div>
              <h2 className="text-3xl font-black tracking-tight">
                {activeTab === 'overview' ? 'Panorama Geral' : 
                 activeTab === 'caixinhas' ? 'Gestão de Caixinhas' :
                 activeTab === 'extrato' ? 'Extrato Detalhado' :
                 activeTab === 'quarterly' ? 'Balanço Trimestral' : 'Balanço Anual'}
              </h2>
              <p className="text-zinc-500 font-medium">
                {activeTab === 'caixinhas' ? 'Saldos reservados por categoria' : 
                 activeTab === 'overview' ? 'Resumo consolidado da gestão' : `Período: ${selectedPeriod}`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {['extrato', 'quarterly', 'annual'].includes(activeTab) && (
                <select className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm font-bold outline-none ring-2 ring-transparent focus:ring-blue-500 transition-all" value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
                  {periods.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              )}
              <button onClick={exportToExcel} className="flex items-center gap-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-4 py-2 rounded-xl text-sm font-bold border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm">
                <Download size={18} /> Exportar Excel
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Cofre Inicial</p>
              <p className="text-xl font-bold text-blue-600 tabular-nums">{formatCurrency(stats.initialBalance)}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
              <p className="text-[10px] font-black text-emerald-500/70 uppercase tracking-widest mb-2">Entradas</p>
              <p className="text-xl font-bold text-emerald-600 tabular-nums">{formatCurrency(stats.income)}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
              <p className="text-[10px] font-black text-rose-500/70 uppercase tracking-widest mb-2">Saídas</p>
              <p className="text-xl font-bold text-rose-600 tabular-nums">{formatCurrency(stats.expenses)}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
              <p className="text-[10px] font-black text-purple-500/70 uppercase tracking-widest mb-2">Rendimentos</p>
              <p className="text-xl font-bold text-purple-600 tabular-nums">{formatCurrency(stats.rendimentos)}</p>
            </div>
            <div className="bg-blue-600 p-5 rounded-2xl shadow-xl shadow-blue-500/20 lg:scale-105">
              <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-2">Saldo Atual Real</p>
              <p className="text-2xl font-black text-white tabular-nums">{formatCurrency(stats.balance)}</p>
            </div>
          </div>

          <div className="space-y-8">
            {activeTab === 'overview' && (
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                <h3 className="font-bold text-lg mb-8">Evolução de Saldo Mensal</h3>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyGrowthData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.05}/>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 'bold'}}/>
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11}} tickFormatter={v => `R$${v}`}/>
                      <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}}/>
                      <Bar dataKey="total" radius={[8, 8, 0, 0]} barSize={45}>
                        {monthlyGrowthData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={index === monthlyGrowthData.length - 1 ? '#2563eb' : '#93c5fd'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {activeTab === 'caixinhas' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {caixinhasData.map(c => (
                      <div key={c.name} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-zinc-400 uppercase mb-1">{c.name}</p>
                          <p className="text-xl font-black text-zinc-800 dark:text-zinc-100 tabular-nums">{formatCurrency(c.value)}</p>
                        </div>
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl text-amber-600">
                          <PiggyBank size={24} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                  <h3 className="font-bold mb-6">Distribuição das Reservas</h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={caixinhasData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {caixinhasData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'][index % 5]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 space-y-2">
                    {caixinhasData.map((c, i) => (
                      <div key={c.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'][i % 5]}} />
                          <span className="font-medium">{c.name}</span>
                        </div>
                        <span className="font-bold">{formatCurrency(c.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {(activeTab === 'extrato' || activeTab === 'quarterly' || activeTab === 'annual') && (
              <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
                <div className="p-6 flex items-center justify-between border-b border-zinc-50 dark:border-zinc-800">
                  <div className="relative w-full max-w-sm">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input type="text" placeholder="Filtrar transações..." className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl pl-12 pr-6 py-3 text-sm outline-none ring-1 ring-zinc-200 dark:ring-zinc-700 focus:ring-2 focus:ring-blue-500 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50/50 dark:bg-zinc-800/50 text-[10px] uppercase font-black tracking-widest text-zinc-400">
                      <tr>
                        <th className="px-8 py-5">Data</th>
                        <th className="px-8 py-5">Descrição</th>
                        <th className="px-8 py-5">Categoria</th>
                        <th className="px-8 py-5 text-right">Valor</th>
                        {isAdmin && <th className="px-8 py-5 text-center">Ações</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                      {filteredTransactions.map(t => (
                        <tr key={t.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors">
                          <td className="px-8 py-5 text-zinc-400 font-bold text-[11px] tabular-nums">
                            {new Date(t.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                          </td>
                          <td className="px-8 py-5">
                            <p className="font-bold text-zinc-800 dark:text-zinc-100">{t.description}</p>
                            <p className="text-[10px] text-zinc-400 font-medium">{t.source_file}</p>
                          </td>
                          <td className="px-8 py-5">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              t.category.includes('Saldo Inicial') ? 'bg-blue-100 text-blue-700' :
                              t.type === 'rendimento' ? 'bg-purple-100 text-purple-700' :
                              t.type !== 'transaction' ? 'bg-amber-100 text-amber-700' :
                              'bg-zinc-100 text-zinc-500'
                            }`}>
                              {t.category}
                            </span>
                          </td>
                          <td className={`px-8 py-5 text-right font-black text-base tabular-nums ${t.amount > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {formatCurrency(t.amount)}
                          </td>
                          {isAdmin && (
                            <td className="px-8 py-5">
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => handleEdit(t)} className="p-2 text-zinc-400 hover:text-blue-600 transition-colors">
                                  <Edit3 size={16} />
                                </button>
                                <button onClick={() => handleDelete(t.id)} className="p-2 text-zinc-400 hover:text-rose-600 transition-colors">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
