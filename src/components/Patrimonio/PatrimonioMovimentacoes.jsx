import './PatrimonioMovimentacoes.css'

export default function PatrimonioMovimentacoes({ config, item }) {
  return (
    <section className="patrimonio-section">
      <header>
        <h3>Movimentações</h3>
        <p>Histórico patrimonial.</p>
      </header>

      <div className="patrimonio-empty-box">
        Motor de movimentações será ligado na próxima etapa.
      </div>
    </section>
  )
}