export default function HeaderSIGMO({ user }) {
  return (
    <header className="sigmo-header">
      <div>
        <h1>SIGMO</h1>
        <p>Sistema Integrado de Gestão de Material Operacional</p>
        <span>Ferramenta de Apoio à Gestão Logística da Companhia</span>
      </div>

      <div className="sigmo-user-card">
        <div className="sigmo-avatar">👤</div>
        <div>
          <small>Usuário logado</small>
          <strong>{user?.nome || 'Usuário'}</strong>
          <span>{user?.perfil || 'Perfil'}</span>
        </div>
      </div>
    </header>
  )
}