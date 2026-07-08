import PatrimonioFotos from './PatrimonioFotos'
import PatrimonioQRCode from './PatrimonioQRCode'
import PatrimonioMovimentacoes from './PatrimonioMovimentacoes'
import './PatrimonioDetails.css'

export default function PatrimonioDetails({ config, item, onEdit }) {
  return (
    <section className="patrimonio-details">
      <div className="patrimonio-details-header">
        <div>
          <h2>{item[config.campoTitulo] || config.titulo}</h2>
          <p>{config.nomeSingular || 'Patrimônio'}</p>
        </div>

        <button className="btn-primary" onClick={onEdit}>
          Editar
        </button>
      </div>

      <div className="patrimonio-details-grid">
        {config.campos?.map((campo) => (
          <div className="patrimonio-detail-item" key={campo.name}>
            <strong>{campo.label}</strong>
            <span>{item[campo.name] || '-'}</span>
          </div>
        ))}
      </div>

      <PatrimonioFotos config={config} item={item} />
      <PatrimonioQRCode config={config} item={item} />
      <PatrimonioMovimentacoes config={config} item={item} />
    </section>
  )
}