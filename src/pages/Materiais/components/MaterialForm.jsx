import { useState } from 'react'
import SigmoButton from '../../../ui/components/SigmoButton'
import {
  cadastrarMaterial,
  atualizarMaterial
} from '../../../services/materiaisService'

const initialForm = {
  patrimonio: '',
  descricao: '',
  categoria: '',
  marca: '',
  modelo: '',
  numero_serie: '',
  status: 'ATIVO',
  unidade: '',
  local_atual: '',
  observacoes: ''
}

export default function MaterialForm({
  user,
  materialEditando,
  onCancel,
  onSaved
}) {
  const [form, setForm] = useState(materialEditando || initialForm)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function handleChange(event) {
    const { name, value } = event.target

    setForm((prev) => ({
      ...prev,
      [name]: value
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    setSalvando(true)
    setErro('')

    try {
      if (form.id) {
        await atualizarMaterial(form.id, form, user)
      } else {
        await cadastrarMaterial(form, user)
      }

      onSaved?.()
    } catch (error) {
      console.error(error)
      setErro(error.message || 'Erro ao salvar material.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form className="material-form" onSubmit={handleSubmit}>
      <div className="form-header">
        <div>
          <h2>{materialEditando ? 'Editar material' : 'Novo material'}</h2>
          <p>Dados patrimoniais do material.</p>
        </div>

        <div className="form-actions">
          <SigmoButton type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </SigmoButton>

          <SigmoButton type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </SigmoButton>
        </div>
      </div>

      {erro && <div className="armas-alert error">{erro}</div>}

      <div className="form-grid">
        <label>
          Patrimônio
          <input name="patrimonio" value={form.patrimonio || ''} onChange={handleChange} />
        </label>

        <label>
          Descrição
          <input name="descricao" value={form.descricao || ''} onChange={handleChange} required />
        </label>

        <label>
          Categoria
          <input name="categoria" value={form.categoria || ''} onChange={handleChange} />
        </label>

        <label>
          Marca
          <input name="marca" value={form.marca || ''} onChange={handleChange} />
        </label>

        <label>
          Modelo
          <input name="modelo" value={form.modelo || ''} onChange={handleChange} />
        </label>

        <label>
          Nº de série
          <input name="numero_serie" value={form.numero_serie || ''} onChange={handleChange} />
        </label>

        <label>
          Status
          <select name="status" value={form.status || 'ATIVO'} onChange={handleChange}>
            <option value="ATIVO">ATIVO</option>
            <option value="BAIXADO">BAIXADO</option>
            <option value="MANUTENÇÃO">MANUTENÇÃO</option>
            <option value="EXTRAVIADO">EXTRAVIADO</option>
          </select>
        </label>

        <label>
          Unidade
          <input name="unidade" value={form.unidade || ''} onChange={handleChange} />
        </label>

        <label>
          Local atual
          <input name="local_atual" value={form.local_atual || ''} onChange={handleChange} />
        </label>

        <label className="full">
          Observações
          <textarea name="observacoes" value={form.observacoes || ''} onChange={handleChange} />
        </label>
      </div>
    </form>
  )
}