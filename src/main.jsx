import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase } from './services/supabase'
import loginImage from './SIGMO_01_Login.png'
import {
  Shield,
  Users,
  Boxes,
  ClipboardCheck,
  FileText,
  Search,
  LogOut,
  UserPlus,
  Activity,
  AlertTriangle
} from 'lucide-react'
import './styles.css'
const NAV = [
  { id: 'dashboard', label: 'Painel Operacional', icon: Shield },
  { id: 'usuarios', label: 'Usuários', icon: Users },
  { id: 'materiais', label: 'Materiais', icon: Boxes },
  { id: 'entrega', label: 'Entrega', icon: ClipboardCheck },
  { id: 'relatorios', label: 'Relatórios', icon: FileText },
  { id: 'auditoria', label: 'Auditoria', icon: Activity }
]

function saveSession(user) {
  localStorage.setItem('sigmo_user', JSON.stringify(user))
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem('sigmo_user') || 'null')
  } catch {
    return null
  }
}

async function registerAudit(action, description, user, module = 'Sistema', severity = 'Informativo') {
  try {
    await supabase.from('sigmo_audit').insert({
      action,
      description,
      actor_id: user?.id || null,
      actor_name: user?.nome || null,
      actor_profile: user?.perfil || null,
      module,
      severity
    })
  } catch (error) {
    console.warn('Falha ao registrar auditoria:', error)
  }
}

function Login({ onLogin }) {
  const [re, setRe] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setError('')

    if (!re.trim() || !pin.trim()) {
      setError('Informe usuário e senha.')
      return
    }

    setLoading(true)

    const { data, error: queryError } = await supabase
      .from('sigmo_users')
      .select('*')
      .eq('re', re.trim())
      .eq('pin', pin.trim())
      .eq('situacao', 'Ativo')
      .maybeSingle()

    setLoading(false)

    if (queryError) {
      console.error(queryError)
      setError('Erro ao consultar o banco. Verifique se o SQL foi executado no Supabase.')
      return
    }

    if (!data) {
      setError('Usuário não encontrado, senha incorreta ou usuário inativo.')
      return
    }

    await registerAudit('LOGIN', 'Usuário acessou o SIGMO.', data, 'Login')
    saveSession(data)
    onLogin(data)
  }

  return (
    <div className="login-page oficial">
      <img src={loginImage} className="login-bg-img" alt="Tela oficial SIGMO" />

      <form className="login-hotspot" onSubmit={handleLogin}>
        <input
          value={re}
          onChange={e => setRe(e.target.value)}
          placeholder="Digite seu usuário"
        />

        <input
          value={pin}
          onChange={e => setPin(e.target.value)}
          placeholder="Digite sua senha"
          type="password"
        />

        {error && <div className="error oficial-error">{error}</div>}

        <button disabled={loading}>
          {loading ? 'ENTRANDO...' : 'ENTRAR NO SISTEMA'}
        </button>
      </form>
    </div>
  )
}
function Layout({ user, route, setRoute, onLogout, children }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark">S</div>
          <div>
            <h2>SIGMO</h2>
            <span>Sistema Integrado de Gestão de Material Operacional</span>
          </div>
        </div>

        <nav>
          {NAV.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={route === item.id ? 'nav-item active' : 'nav-item'}
                onClick={() => setRoute(item.id)}
              >
                <Icon size={19} />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <strong>5ª Companhia</strong>
          <span>27º BPM/M</span>
          <span>Versão 0.2.0</span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{NAV.find(n => n.id === route)?.label || 'SIGMO'}</h1>
            <p>Ambiente de desenvolvimento funcional.</p>
          </div>

          <div className="user-card">
            <div className="avatar">{user?.nome?.charAt(0) || 'U'}</div>
            <div>
              <strong>{user?.nome}</strong>
              <span>{user?.perfil}</span>
            </div>
            <button className="icon-btn" onClick={onLogout} title="Sair">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {children}
      </main>
    </div>
  )
}

function Dashboard() {
  const [stats, setStats] = useState({ users: 0, pending: 0, audit: 0 })

  useEffect(() => {
    async function load() {
      const users = await supabase.from('sigmo_users').select('*', { count: 'exact', head: true })
      const pending = await supabase.from('sigmo_users').select('*', { count: 'exact', head: true }).eq('situacao', 'Aguardando Aprovação')
      const audit = await supabase.from('sigmo_audit').select('*', { count: 'exact', head: true })
      setStats({
        users: users.count || 0,
        pending: pending.count || 0,
        audit: audit.count || 0
      })
    }

    load()
  }, [])

  return (
    <>
      <section className="cards-grid">
        <Metric title="Usuários" value={stats.users} detail="cadastrados" />
        <Metric title="Aguardando" value={stats.pending} detail="aprovação" tone="yellow" />
        <Metric title="Materiais" value="0" detail="fase 0.3" />
        <Metric title="Auditoria" value={stats.audit} detail="registros" />
      </section>

      <section className="panel">
        <h2>SIGMO v0.2</h2>
        <p>
          Estrutura profissional ativa: React + Vite + Supabase. O próximo módulo será o cadastro
          de materiais com categorias, patrimônio, série, status e auditoria.
        </p>
      </section>

      <section className="panel warning-panel">
        <AlertTriangle />
        <div>
          <h3>Próximo marco</h3>
          <p>Transformar o cadastro de usuários em módulo completo com edição, aprovação e perfis.</p>
        </div>
      </section>
    </>
  )
}

function Metric({ title, value, detail, tone = 'blue' }) {
  return (
    <div className={`metric-card ${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

function Usuarios({ user }) {
  const [form, setForm] = useState({
    nome: '',
    re: '',
    graduacao: '',
    pelotao: 'A',
    email: '',
    telefone: '',
    perfil: 'Policial',
    situacao: 'Ativo',
    pin: ''
  })
  const [users, setUsers] = useState([])
  const [message, setMessage] = useState('')

  async function loadUsers() {
    const { data } = await supabase
      .from('sigmo_users')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30)

    setUsers(data || [])
  }

  useEffect(() => {
    loadUsers()
  }, [])

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')

    if (!form.nome || !form.re || !form.pin) {
      setMessage('Nome, RE e PIN são obrigatórios.')
      return
    }

    const { error } = await supabase.from('sigmo_users').insert({
      ...form,
      criado_por: user.nome
    })

    if (error) {
      console.error(error)
      setMessage('Erro ao salvar. Verifique se o RE já existe.')
      return
    }

    await registerAudit('CADASTRO_USUARIO', `Cadastro criado para ${form.nome} (${form.re}).`, user, 'Usuários')
    setMessage('Cadastro salvo com sucesso.')
    setForm({
      nome: '',
      re: '',
      graduacao: '',
      pelotao: 'A',
      email: '',
      telefone: '',
      perfil: 'Policial',
      situacao: 'Ativo',
      pin: ''
    })
    loadUsers()
  }

  return (
    <div className="two-columns">
      <section className="panel">
        <div className="panel-title">
          <UserPlus />
          <h2>Novo usuário</h2>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <Field label="Nome completo" value={form.nome} onChange={v => update('nome', v)} />
          <Field label="RE / Matrícula" value={form.re} onChange={v => update('re', v)} />
          <Field label="Posto / Graduação" value={form.graduacao} onChange={v => update('graduacao', v)} />
          <Select label="Pelotão" value={form.pelotao} onChange={v => update('pelotao', v)} options={['A', 'B', 'C', 'D', 'POP', 'Delegada', 'Intermediária', 'Outros']} />
          <Field label="E-mail" value={form.email} onChange={v => update('email', v)} />
          <Field label="Telefone" value={form.telefone} onChange={v => update('telefone', v)} />
          <Select label="Perfil" value={form.perfil} onChange={v => update('perfil', v)} options={['Policial', 'Auxiliar da Guarda', 'Comandante da Guarda', 'Comandante da Companhia']} />
          <Select label="Situação" value={form.situacao} onChange={v => update('situacao', v)} options={['Ativo', 'Aguardando Aprovação', 'Inativo']} />
          <Field label="PIN" value={form.pin} onChange={v => update('pin', v)} type="password" />

          <div className="form-actions">
            <button className="primary-btn">Salvar cadastro</button>
          </div>
        </form>

        {message && <p className="message">{message}</p>}
      </section>

      <section className="panel">
        <h2>Últimos cadastros</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>RE</th>
                <th>Perfil</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {users.map(item => (
                <tr key={item.id}>
                  <td>{item.nome}</td>
                  <td>{item.re}</td>
                  <td>{item.perfil}</td>
                  <td><span className={item.situacao === 'Ativo' ? 'status ok' : 'status wait'}>{item.situacao}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Auditoria() {
  const [logs, setLogs] = useState([])

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('sigmo_audit').select('*').order('created_at', { ascending: false }).limit(100)
      setLogs(data || [])
    }
    load()
  }, [])

  return (
    <section className="panel">
      <div className="panel-title">
        <Search />
        <h2>Auditoria</h2>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Ação</th>
              <th>Usuário</th>
              <th>Módulo</th>
              <th>Descrição</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id}>
                <td>{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                <td>{log.action}</td>
                <td>{log.actor_name || '-'}</td>
                <td>{log.module || '-'}</td>
                <td>{log.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Placeholder({ title }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <p>Este módulo será desenvolvido na próxima sprint do SIGMO.</p>
    </section>
  )
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} />
    </label>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}>
        {options.map(option => <option key={option}>{option}</option>)}
      </select>
    </label>
  )
}

function App() {
  const [user, setUser] = useState(loadSession)
  const [route, setRoute] = useState('dashboard')

  function logout() {
    registerAudit('LOGOUT', 'Usuário saiu do SIGMO.', user, 'Login')
    localStorage.removeItem('sigmo_user')
    setUser(null)
  }

  if (!user) {
    return <Login onLogin={setUser} />
  }

  let page = <Dashboard />

  if (route === 'usuarios') page = <Usuarios user={user} />
  if (route === 'auditoria') page = <Auditoria />
  if (route === 'materiais') page = <Placeholder title="Cadastro de Materiais" />
  if (route === 'entrega') page = <Placeholder title="Entrega de Material" />
  if (route === 'relatorios') page = <Placeholder title="Relatórios" />

  return (
    <Layout user={user} route={route} setRoute={setRoute} onLogout={logout}>
      {page}
    </Layout>
  )
}

createRoot(document.getElementById('root')).render(<App />)
