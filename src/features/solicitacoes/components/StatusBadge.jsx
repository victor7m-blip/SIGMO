const MAPA_STATUS = {
  PENDENTE: {
    label: 'Pendente',
    className: 'solicitacao-status-pendente'
  },

  EM_ANALISE: {
    label: 'Em análise',
    className: 'solicitacao-status-pendente'
  },

  APROVADO: {
    label: 'Aprovada',
    className: 'solicitacao-status-aprovado'
  },

  REPROVADO: {
    label: 'Reprovada',
    className: 'solicitacao-status-reprovado'
  },

  CANCELADO: {
    label: 'Cancelada',
    className: 'solicitacao-status-cancelado'
  }
}

export default function StatusBadge({
  status
}) {
  const chave =
    String(
      status || 'PENDENTE'
    ).toUpperCase()

  const item =
    MAPA_STATUS[chave] ||
    MAPA_STATUS.PENDENTE

  return (
    <span
      className={[
        'solicitacao-status',
        item.className
      ].join(' ')}
    >
      {item.label}
    </span>
  )
}