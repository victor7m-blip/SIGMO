import { useState } from 'react'

import DetailsModal from '../DetailsModal/DetailsModal'
import MovimentacaoLista from './MovimentacaoLista'

import './MovimentacaoDialog.css'

export default function MovimentacaoDialog({
  open,
  titulo = 'Nova Movimentação',
  itens = [],
  locais = [],
  policiais = [],
  onClose,
  onRemoveItem,
  onSalvar
}) {
  const [form, setForm] = useState({
    origem_local: '',
    destino_local: '',
    recebedor_id: '',
    observacoes: ''
  })

  function alterar(event) {
    const { name, value } = event.target

    setForm((old) => ({
      ...old,
      [name]: value
    }))
  }

  function salvar() {
    onSalvar?.({
      ...form,
      itens
    })
  }

  return (
    <DetailsModal
      isOpen={open}
      onClose={onClose}
      title={titulo}
      subtitle={`${itens.length} patrimônio(s)`}
    >

      <div className="mov-dialog">

        <section className="mov-bloco">

          <h3>Patrimônios</h3>

          <MovimentacaoLista
            itens={itens}
            onRemove={onRemoveItem}
          />

        </section>

        <section className="mov-bloco">

          <div className="mov-grid">

            <label>

              Origem

              <select
                name="origem_local"
                value={form.origem_local}
                onChange={alterar}
              >
                <option value="">Selecione</option>

                {locais.map(local => (
                  <option
                    key={local.id}
                    value={local.id}
                  >
                    {local.nome}
                  </option>
                ))}

              </select>

            </label>

            <label>

              Destino

              <select
                name="destino_local"
                value={form.destino_local}
                onChange={alterar}
              >
                <option value="">Selecione</option>

                {locais.map(local => (
                  <option
                    key={local.id}
                    value={local.id}
                  >
                    {local.nome}
                  </option>
                ))}

              </select>

            </label>

          </div>

          <label>

            Recebedor

            <select
              name="recebedor_id"
              value={form.recebedor_id}
              onChange={alterar}
            >

              <option value="">Selecione</option>

              {policiais.map(policial => (

                <option
                  key={policial.id}
                  value={policial.id}
                >
                  {policial.nome_completo}
                </option>

              ))}

            </select>

          </label>

          <label>

            Observações

            <textarea
              rows="4"
              name="observacoes"
              value={form.observacoes}
              onChange={alterar}
            />

          </label>

        </section>

        <footer className="mov-dialog-footer">

          <button
            type="button"
            className="mov-btn-secundario"
            onClick={onClose}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="mov-btn-principal"
            onClick={salvar}
          >
            Criar movimentação
          </button>

        </footer>

      </div>

    </DetailsModal>
  )
}