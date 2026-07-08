export default function PatrimonioResumoStep({
  itemSalvo,
  fotos = [],
  onVoltar,
  onFinalizar
}) {
  return (
    <div className="patrimonio-card">
      <h2>Cadastro pronto</h2>

      <div className="patrimonio-resumo">
        <p>
          <strong>Patrimônio:</strong>{' '}
          {itemSalvo?.patrimonio || 'Não informado'}
        </p>

        <p>
          <strong>Descrição:</strong>{' '}
          {itemSalvo?.descricao || itemSalvo?.especie || 'Não informado'}
        </p>

        <p>
          <strong>Status:</strong>{' '}
          {itemSalvo?.status || 'Não informado'}
        </p>

        <p>
          <strong>Fotos:</strong> {fotos.length}
        </p>
      </div>

      <div className="patrimonio-actions between">
        <button type="button" className="btn-secondary" onClick={onVoltar}>
          Voltar
        </button>

        <button type="button" className="btn-primary" onClick={onFinalizar}>
          Finalizar
        </button>
      </div>
    </div>
  )
}