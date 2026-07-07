import { useEffect, useState } from 'react'
import './AppShell.css'

export default function AppShell({
  user,
  route,
  setRoute,
  onLogout,
  children,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const menuItems = [
    { key: 'dashboard', label: 'Painel' },
    { key: 'locais', label: 'Locais' },
    { key: 'materiais', label: 'Materiais' },
    { key: 'armas', label: 'Armas' },
    { key: 'policiais', label: 'Policiais' },
    { key: 'municoes', label: 'Munições' },
    { key: 'acautelamento', label: 'Acautelamento' },
    { key: 'relatorios', label: 'Relatórios' },
  ]

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [route])

  return (
    <div className="app-shell">
      <button
        className="menu-toggle"
        onClick={() => setMobileMenuOpen(true)}
      >
        ☰
      </button>

      {mobileMenuOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`app-sidebar ${
          mobileMenuOpen ? 'sidebar-open' : ''
        }`}
      >
        <div className="app-brand">
          <strong>SIGMO</strong>
          <span>Gestão Operacional</span>
        </div>

        <nav className="app-menu">
          {menuItems.map((item) => (
            <button
              key={item.key}
              className={route === item.key ? 'active' : ''}
              onClick={() => setRoute(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="app-user">
          <span>{user?.nome}</span>

          <button onClick={onLogout}>
            Sair
          </button>
        </div>
      </aside>

      <section className="app-content">
        {children}
      </section>
    </div>
  )
}