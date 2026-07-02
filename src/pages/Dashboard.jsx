import painelDesktop from '../assets/painel-operacional.png'
import painelMobile from '../assets/painel-operacional-mobile.png'

import './DashboardV2.css'
import { useEffect, useState } from 'react'

import { supabase } from '../services/supabase'

function Metric({ title, value, detail, tone = 'blue' }) {
  return (
    <div className={`metric-card ${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

export default function Dashboard() {
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
          Estrutura profissional ativa: React + Vite + Supabase.
          O próximo módulo será o cadastro de materiais.
        </p>
      </section>

      <section className="panel warning-panel">
        <AlertTriangle />
        <div>
          <h3>Próximo marco</h3>
          <p>Modelagem do banco de dados e regras de negócio.</p>
        </div>
      </section>
    </>
  )
}