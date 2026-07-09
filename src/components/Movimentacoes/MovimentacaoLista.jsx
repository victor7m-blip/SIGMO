import MovimentacaoItem from './MovimentacaoItem'
import './MovimentacaoLista.css'

export default function MovimentacaoLista({
  itens = [],
  onRemove
}) {

  if (itens.length === 0) {
    return (
      <div className="mov-lista-vazia">
        Nenhum patrimônio adicionado.
      </div>
    )
  }

  return (

    <div className="mov-lista">

      {itens.map(item => (

        <MovimentacaoItem
          key={item.id}
          item={item}
          onRemove={onRemove}
        />

      ))}

    </div>

  )
}