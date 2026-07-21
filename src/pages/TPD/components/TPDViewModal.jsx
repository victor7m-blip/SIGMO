import '../../Armas/styles/armaViewModal.css'

export default function TPDViewModal({
  tpd,
  onClose,
  onEdit
}) {
  if (!tpd) return null

  return (
    <div
      className="tpd-view-backdrop"
      onClick={onClose}
    >
      <div
        className="tpd-view-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="tpd-view-header">
          <div>
            <span className="tpd-view-subtitle">
              Terminal Portátil de Dados
            </span>

            <h2>
              {tpd.patrimonio ||
                tpd.numero_serie}
            </h2>
          </div>

          <button
            className="tpd-view-close"
            onClick={onClose}
          >
            ✕
          </button>
        </header>

        <div className="tpd-view-body">
          <aside className="tpd-view-photo">
            {tpd.foto_url ? (
              <img
                src={tpd.foto_url}
                alt=""
              />
            ) : (
              <div className="tpd-photo-placeholder">
                SEM FOTO
              </div>
            )}
          </aside>

          <section className="tpd-view-grid">
            <Info
              titulo="Patrimônio"
              valor={tpd.patrimonio}
            />

            <Info
              titulo="Número de Série"
              valor={tpd.numero_serie}
            />

            <Info
              titulo="Marca"
              valor={tpd.marca}
            />

            <Info
              titulo="Modelo"
              valor={tpd.modelo}
            />

            <Info
              titulo="Tipo"
              valor={
                tpd.tipo_equipamento
              }
            />

            <Info
              titulo="Status"
              valor={
                tpd.status_operacional
              }
            />

            <Info
              titulo="Unidade"
              valor={tpd.unidade}
            />

            <Info
              titulo="Local Atual"
              valor={
                tpd.local_atual
              }
            />

            <Info
              titulo="Equipe"
              valor={
                tpd.equipe_vinculada
              }
            />

            <Info
              titulo="Viatura"
              valor={
                tpd.viatura_vinculada
              }
            />

            <Info
              titulo="QR Code"
              valor={tpd.qr_code}
            />

            <Info
              titulo="Situação"
              valor={
                tpd.ativo
                  ? 'ATIVO'
                  : 'INATIVO'
              }
            />
          </section>
        </div>

        <section className="tpd-view-observacoes">
          <h3>Observações</h3>

          <p>
            {tpd.observacoes ||
              'Nenhuma observação cadastrada.'}
          </p>
        </section>

        <footer className="tpd-view-footer">
          <button
            className="sigmo-btn-secondary"
            onClick={onClose}
          >
            Fechar
          </button>

          <button
            className="sigmo-btn-primary"
            onClick={() =>
              onEdit?.(tpd)
            }
          >
            Editar
          </button>
        </footer>
      </div>
    </div>
  )
}

function Info({
  titulo,
  valor
}) {
  return (
    <div className="tpd-info-item">
      <span>{titulo}</span>

      <strong>
        {valor || '-'}
      </strong>
    </div>
  )
}