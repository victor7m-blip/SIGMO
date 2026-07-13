import CarrinhoMateriais from './CarrinhoMateriais'

function obterNomePolicial(policial) {
  return (
    policial?.nome_guerra ||
    policial?.nome ||
    policial?.nome_completo ||
    'NÃO INFORMADO'
  )
}

export default function ResumoEntrega({
  policial,
  re,
  destino,
  itens,
  salvando = false,
  onRemover,
  onLimpar,
  onConfirmar
}) {
  return (
    <aside className="pagar-material-summary">
      <section className="pagar-material-card pagar-material-summary-card">
        <div className="pagar-material-card-header">
          <div>
            <span>ETAPA 3</span>
            <h2>Resumo da entrega</h2>
          </div>
        </div>

        <div className="pagar-material-summary-data">
          <div>
            <span>Recebedor</span>

            <strong>
              {policial
                ? obterNomePolicial(policial)
                : 'NÃO INFORMADO'}
            </strong>
          </div>

          <div>
            <span>RE</span>

            <strong>
              {re || 'NÃO INFORMADO'}
            </strong>
          </div>

          <div>
            <span>Destino</span>

            <strong>
              {destino || 'NÃO INFORMADO'}
            </strong>
          </div>

          <div>
            <span>Total de itens</span>

            <strong>{itens.length}</strong>
          </div>
        </div>

        <CarrinhoMateriais
          itens={itens}
          onRemover={onRemover}
        />

        <div className="pagar-material-actions">
          <button
            type="button"
            className="pagar-material-cancel"
            disabled={salvando}
            onClick={onLimpar}
          >
            Limpar
          </button>

          <button
            type="button"
            className="pagar-material-confirm"
            disabled={salvando}
            onClick={onConfirmar}
          >
            {salvando
              ? 'Registrando...'
              : 'Confirmar entrega'}
          </button>
        </div>
      </section>
    </aside>
  )
}