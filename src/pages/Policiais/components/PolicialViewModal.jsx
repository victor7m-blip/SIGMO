export default function PolicialViewModal({ policial, onClose }) {
  if (!policial) return null

  return (
    <div className="policiais-modal-overlay">
      <div className="policiais-modal-card">
        <div className="policiais-modal-header">
          <h2>Detalhes do Policial</h2>

          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="policiais-details-grid">
          <div>
            <strong>Nome completo</strong>
            <span>{policial.nome_completo || '-'}</span>
          </div>

          <div>
            <strong>Nome de guerra</strong>
            <span>{policial.nome_guerra || '-'}</span>
          </div>

          <div>
            <strong>Matrícula</strong>
            <span>{policial.matricula || '-'}</span>
          </div>

          <div>
            <strong>CPF</strong>
            <span>{policial.cpf || '-'}</span>
          </div>

          <div>
            <strong>RG</strong>
            <span>{policial.rg || '-'}</span>
          </div>

          <div>
            <strong>Posto/Graduação</strong>
            <span>{policial.posto_graduacao || '-'}</span>
          </div>

          <div>
            <strong>Unidade</strong>
            <span>{policial.unidade || '-'}</span>
          </div>

          <div>
            <strong>Função</strong>
            <span>{policial.funcao || '-'}</span>
          </div>

          <div>
            <strong>Telefone</strong>
            <span>{policial.telefone || '-'}</span>
          </div>

          <div>
            <strong>E-mail</strong>
            <span>{policial.email || '-'}</span>
          </div>

          <div>
            <strong>Perfil operacional</strong>
            <span>{policial.perfil_operacional || '-'}</span>
          </div>

          <div>
            <strong>Equipe piloto</strong>
            <span>{policial.participa_teste ? 'Sim' : 'Não'}</span>
          </div>

          <div>
            <strong>Status</strong>
            <span>{policial.status || '-'}</span>
          </div>

          <div className="policiais-details-full">
            <strong>Observações</strong>
            <span>{policial.observacoes || '-'}</span>
          </div>
        </div>

        <div className="policiais-modal-actions">
          <button type="button" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}