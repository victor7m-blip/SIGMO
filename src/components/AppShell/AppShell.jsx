import './AppShell.css'

export default function AppShell({ user, route, setRoute, onLogout, children }) {
  const menuItems = [
    { key: 'dashboard', label: 'Painel' },
    { key: 'materiais', label: 'Materiais' },
    { key: 'armas', label: 'Armas' },
    { key: 'municoes', label: 'Munições' },
    { key: 'acautelamento', label: 'Acautelamento' },
    { key: 'relatorios', label: 'Relatórios' },
  ]

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
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
          <span>{user?.nome || 'Usuário'}</span>
          <button onClick={onLogout}>Sair</button>
        </div>
      </aside>

      <section className="app-content">
        {children}
      </section>
    </div>
  )
}