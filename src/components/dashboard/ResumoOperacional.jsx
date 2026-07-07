import {
  PackageCheck,
  UserRoundCheck,
  Wrench,
  Users,
  TriangleAlert
} from 'lucide-react'

export default function ResumoOperacional() {
  const cards = [
    {
      title: 'MATERIAIS DISPONÍVEIS',
      icon: PackageCheck,
      color: 'green',
      items: [
        ['Pistolas', '18'],
        ['HTs', '16'],
        ['Coletes', '20'],
        ['Outros', '08']
      ],
      total: '62'
    },
    {
      title: 'MATERIAIS EM SERVIÇO',
      icon: UserRoundCheck,
      color: 'red',
      items: [
        ['Pistolas', '12'],
        ['HTs', '14'],
        ['Coletes', '10'],
        ['Outros', '06']
      ],
      total: '42'
    },
    {
      title: 'MATERIAIS EM MANUTENÇÃO',
      icon: Wrench,
      color: 'yellow',
      items: [
        ['Pistolas', '01'],
        ['HTs', '02'],
        ['Coletes', '02'],
        ['Outros', '01']
      ],
      total: '06'
    },
    {
      title: 'POLICIAIS',
      icon: Users,
      color: 'blue',
      items: [
        ['Com turno ativo', '23'],
        ['Sem turno ativo', '05']
      ],
      total: '28'
    },
    {
      title: 'PENDÊNCIAS',
      icon: TriangleAlert,
      color: 'white',
      items: [
        ['Materiais não devolvidos', '01'],
        ['Manutenção vencida', '02'],
        ['Turno encerrado sem devolução', '03']
      ],
      total: '06'
    }
  ]

  return (
    <section className="sigmo-section">
      <h2>RESUMO GERAL DO PLANTÃO</h2>

      <div className="sigmo-summary-grid">
        {cards.map((card) => {
          const Icon = card.icon

          return (
            <article key={card.title} className="sigmo-summary-card">
              <div className={`sigmo-summary-head ${card.color}`}>
                <Icon size={42} strokeWidth={2.4} />
                <strong>{card.title}</strong>
              </div>

              <div className="sigmo-summary-list">
                {card.items.map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <b>{value}</b>
                  </div>
                ))}
              </div>

              <div className={`sigmo-summary-total ${card.color}`}>
                <span>TOTAL</span>
                <b>{card.total}</b>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}