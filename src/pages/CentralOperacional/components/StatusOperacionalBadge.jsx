function normalizarStatus(status) {
  return String(status ?? '')
    .trim()
    .toUpperCase()
}

function obterClasse(status) {
  const valor = normalizarStatus(status)

  if (
    [
      'OK',
      'ENCONTRADO',
      'DISPONÍVEL',
      'DISPONIVEL',
      'ATIVO',
      'NO COFRE'
    ].includes(valor)
  ) {
    return 'central-status central-status-ok'
  }

  if (
    [
      'CAUTELADO',
      'COM POLICIAL',
      'EM USO',
      'DISTRIBUÍDO',
      'DISTRIBUIDO'
    ].includes(valor)
  ) {
    return 'central-status central-status-policial'
  }

  if (
    ['DIVERGENTE', 'DIVERGÊNCIA', 'DIVERGENCIA', 'NÃO LOCALIZADO'].includes(
      valor
    )
  ) {
    return 'central-status central-status-divergencia'
  }

  if (['PENDENTE', 'SEM LOCALIZAÇÃO', 'SEM LOCALIZACAO'].includes(valor)) {
    return 'central-status central-status-pendente'
  }

  if (['BAIXADO', 'INATIVO', 'EXCLUÍDO', 'EXCLUIDO'].includes(valor)) {
    return 'central-status central-status-baixado'
  }

  return 'central-status central-status-neutro'
}

export default function StatusOperacionalBadge({
  status,
  children,
  className = ''
}) {
  const texto = children || status || 'SEM STATUS'

  return (
    <span className={`${obterClasse(status || texto)} ${className}`.trim()}>
      {texto}
    </span>
  )
}