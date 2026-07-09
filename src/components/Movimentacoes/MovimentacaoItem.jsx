import './MovimentacaoItem.css'

export default function MovimentacaoItem({
  item,
  onRemove
}) {
  return (
    <article className="mov-item">

      <div className="mov-item-info">

        <strong>
          {item.descricao}
        </strong>

        <span>
          Patrimônio:
          {' '}
          {item.numero_patrimonio}
        </span>

        {item.numero_serie && (
          <span>
            Série:
            {' '}
            {item.numero_serie}
          </span>
        )}

      </div>

      <button
        type="button"
        className="mov-item-remove"
        onClick={() => onRemove(item)}
      >
        Remover
      </button>

    </article>
  )
}