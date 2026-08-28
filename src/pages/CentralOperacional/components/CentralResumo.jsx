function ResumoCard({ label, valor, destaque = '' }) {
  return (
    <article className={`central-resumo-card ${destaque}`.trim()}>
      <span>{label}</span>
      <strong>{valor ?? 0}</strong>
    </article>
  )
}

export default function CentralResumo({ resumo }) {
  return (
    <section className="central-resumo-grid">
      <ResumoCard label="Total ativo" valor={resumo?.total} />

      <ResumoCard
        label="Com policial"
        valor={resumo?.com_policial}
        destaque="central-resumo-policial"
      />

      <ResumoCard
        label="No cofre"
        valor={resumo?.no_cofre}
        destaque="central-resumo-cofre"
      />

      <ResumoCard
        label="Manutenção interna"
        valor={resumo?.manutencao_interna}
        destaque="central-resumo-pendente"
      />

      <ResumoCard
        label="Manutenção externa"
        valor={resumo?.manutencao_externa}
      />
    </section>
  )
}