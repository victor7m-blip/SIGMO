import './ArmaDetails.css'

export default function ArmaDetails({ arma }) {
  if (!arma) return null

  function Campo(label, valor, full = false) {
    return (
      <div className={`arma-detail-card ${full ? 'full' : ''}`}>
        <span>{label}</span>
        <strong>{valor || '-'}</strong>
      </div>
    )
  }

  return (
    <div className="arma-details">
      {Campo('Patrimônio', arma.patrimonio)}
      {Campo('Espécie', arma.especie)}
      {Campo('Marca', arma.marca)}
      {Campo('Modelo', arma.modelo)}
      {Campo('Calibre', arma.calibre)}
      {Campo('Número de Série', arma.numero_serie)}
      {Campo('Status', arma.status)}
      {Campo('Unidade', arma.unidade)}
      {Campo('Carga', arma.carga)}
      {Campo('Origem', arma.origem)}
      {Campo('Tombamento', arma.numero_tombamento, true)}
      {Campo('Observações', arma.observacoes, true)}
    </div>
  )
}