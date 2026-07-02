export default function SidebarSIGMO() {
  const menu = [
    { label: 'Painel Operacional', icon: '📊', active: true },
    { label: 'Materiais', icon: '📦' },
    { label: 'Entrega', icon: '📤' },
    { label: 'Recebimento', icon: '📥' },
    { label: 'Policiais', icon: '👮' },
    { label: 'Auditoria', icon: '🛡️' },
    { label: 'Relatórios', icon: '📄' }
  ]

  return (
    <aside className="sigmo-sidebar">
      <div className="sigmo-sidebar-brand">
        <div className="sigmo-logo">SIGMO</div>
        <span>Sistema de Gestão de Materiais Operacionais</span>
      </div>

      <nav className="sigmo-menu">
        {menu.map((item) => (
          <button
            key={item.label}
            className={item.active ? 'sigmo-menu-item active' : 'sigmo-menu-item'}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}