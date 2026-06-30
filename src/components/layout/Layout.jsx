import React from 'react'
import { LogOut } from 'lucide-react'
import { NAV } from '../../data/navigation'

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

export default Layout