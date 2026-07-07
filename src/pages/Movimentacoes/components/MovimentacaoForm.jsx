import { useState } from 'react'
import {
  criarMovimentacao,
  adicionarItemMovimentacao
} from '../../../services/movimentacoesService'

import PatrimonioPicker from './PatrimonioPicker'
import CarrinhoMovimentacao from './CarrinhoMovimentacao'

const initialForm = {
  tipo_movimentacao: 'cautela',
  origem_local: 'Guarda do Quartel',
  destino_local: '',
  recebedor_nome: '',
  observacoes: ''
}

export default function MovimentacaoForm({ user, onCancel, onSaved }) {
  const [form, setForm] = useState(initialForm)
  const [itens, setItens] = useState([])
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  function handleChange(e) {
    const { name, value } = e.target

    setForm((prev) => ({
      ...prev,
      [name]: value
    }))
  }

  function handleAdicionarPatrimonio(patrimonio) {
    const jaExiste = itens.some((item) => item.id === patrimonio.id)

    if (jaExiste) {
      alert('Este patrimônio já está no carrinho.')
      return
    }

    setItens((prev) => [...prev, patrimonio])
  }

  function handleRemoverItem(patrimonioId) {
    setItens((prev) => prev.filter((item) => item.id !== patrimonioId))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!form.destino_local.trim()) {
      alert('Informe o destino.')
      return
    }

    if (!form.recebedor_nome.trim()) {
      alert('Informe o nome do recebedor.')
      return
    }

    if (itens.length === 0) {
      alert('Adicione pelo menos um patrimônio.')
      return
    }

    try {
      setSaving(true)
      setErro('')

      const movimentacaoId = await criarMovimentacao({
        tipo_movimentacao: form.tipo_movimentacao,
        origem_local: form.origem_local,
        destino_local: form.destino_local,
        solicitante: user,
        recebedor: {
          id: null,
          nome: form.recebedor_nome
        },
        observacoes: form.observacoes
      })

      for (const item of itens) {
        await adicionarItemMovimentacao({
          movimentacao_id: movimentacaoId,
          patrimonio_id: item.id,
          quantidade: 1,
          observacao: ''
        })
      }

      onSaved()
    } catch (error) {
      console.error(error)
      setErro(error.message || 'Erro ao salvar movimentação.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="movimentacao-form" onSubmit={handleSubmit}>
      <div className="movimentacao-form-header">
        <div>
          <h2>Nova Movimentação</h2>
          <p>Fluxo simples inicial do motor de movimentação.</p>
        </div>

        <button type="button" onClick={onCancel}>
          Fechar
        </button>
      </div>

      {erro && <div className="movimentacoes-erro">{erro}</div>}

      <div className="movimentacao-grid">
        <label>
          Tipo
          <select
            name="tipo_movimentacao"
            value={form.tipo_movimentacao}
            onChange={handleChange}
          >
            <option value="cautela">Cautela</option>
            <option value="devolucao">Devolução</option>
            <option value="transferencia">Transferência</option>
            <option value="operacao">Operação</option>
            <option value="manutencao">Manutenção</option>
            <option value="baixa">Baixa</option>
            <option value="ajuste_carga">Ajuste de Carga</option>
          </select>
        </label>

        <label>
          Origem
          <select
            name="origem_local"
            value={form.origem_local}
            onChange={handleChange}
          >
            <option value="Guarda do Quartel">Guarda do Quartel</option>
            <option value="P4">P4</option>
            <option value="Armaria">Armaria</option>
            <option value="Almoxarifado">Almoxarifado</option>
            <option value="Viaturas">Viaturas</option>
            <option value="Outra Companhia">Outra Companhia</option>
          </select>
        </label>

        <label>
          Destino
          <input
            name="destino_local"
            value={form.destino_local}
            onChange={handleChange}
            placeholder="Ex: 1º Pelotão / Operação / P4"
          />
        </label>

        <label>
          Recebedor
          <input
            name="recebedor_nome"
            value={form.recebedor_nome}
            onChange={handleChange}
            placeholder="Nome de quem vai receber"
          />
        </label>
      </div>

      <label className="movimentacao-observacoes">
        Observações
        <textarea
          name="observacoes"
          value={form.observacoes}
          onChange={handleChange}
          placeholder="Observações da movimentação"
        />
      </label>

      <PatrimonioPicker
        origemLocal={form.origem_local}
        onAdicionar={handleAdicionarPatrimonio}
      />

      <CarrinhoMovimentacao
        itens={itens}
        onRemover={handleRemoverItem}
      />

      <div className="movimentacao-actions">
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar Movimentação'}
        </button>
      </div>
    </form>
  )
}