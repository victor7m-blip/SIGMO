import { useEffect, useState } from 'react'
import { cadastrarArma, atualizarArma } from '../../../services/armasService'
import { registerAudit } from '../../../services/auditoriaService'

const initialForm = {
  patrimonio: '',
  numero_serie: '',
  especie: '',
  marca: '',
  modelo: '',
  calibre: '',
  acabamento: '',
  unidade: '',
  status: 'Disponível',
  observacoes: '',
}

export default function ArmaForm({
  user,
  armaEditando,
  onCancel,
  onSaved
}) {
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  const isEditing = Boolean(armaEditando?.id)

  useEffect(() => {
    if (armaEditando) {
      setForm({
        patrimonio: armaEditando.patrimonio || '',
        numero_serie: armaEditando.numero_serie || '',
        especie: armaEditando.especie || '',
        marca: armaEditando.marca || '',
        modelo: armaEditando.modelo || '',
        calibre: armaEditando.calibre || '',
        acabamento: armaEditando.acabamento || '',
        unidade: armaEditando.unidade || '',
        status: armaEditando.status || 'Disponível',
        observacoes: armaEditando.observacoes || '',
      })
    } else {
      setForm(initialForm)
    }
  }, [armaEditando])

  function handleChange(event) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    try {
      setSaving(true)
      setErro('')

      if (isEditing) {
        const arma = await atualizarArma(armaEditando.id, form)

        await registerAudit(
          'ARMA_UPDATE',
          `Arma editada: ${arma.patrimonio} - ${arma.marca} ${arma.modelo}`,
          user,
          'Armas',
          'Informativo'
        )
      } else {
        const arma = await cadastrarArma(form)

        await registerAudit(
          'ARMA_CREATE',
          `Arma cadastrada: ${arma.patrimonio} - ${arma.marca} ${arma.modelo}`,
          user,
          'Armas',
          'Informativo'
        )
      }

      setForm(initialForm)
      onSaved()
    } catch (error) {
      console.error(error)
      setErro(
        isEditing
          ? 'Erro ao editar arma.'
          : 'Erro ao cadastrar arma. Verifique patrimônio e série.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="armas-form-card">
      <div className="armas-form-header">
        <div>
          <h2>{isEditing ? 'Editar Arma' : 'Nova Arma'}</h2>
          <p>
            {isEditing
              ? 'Atualize os dados do armamento institucional.'
              : 'Cadastre o armamento institucional.'}
          </p>
        </div>

        <button type="button" onClick={onCancel}>
          Fechar
        </button>
      </div>

      {erro && <p className="armas-feedback armas-feedback-error">{erro}</p>}

      <form className="armas-form" onSubmit={handleSubmit}>
        <input name="patrimonio" placeholder="Patrimônio" value={form.patrimonio} onChange={handleChange} required />
        <input name="numero_serie" placeholder="Número de série" value={form.numero_serie} onChange={handleChange} required />
        <input name="especie" placeholder="Espécie" value={form.especie} onChange={handleChange} required />
        <input name="marca" placeholder="Marca" value={form.marca} onChange={handleChange} required />
        <input name="modelo" placeholder="Modelo" value={form.modelo} onChange={handleChange} required />
        <input name="calibre" placeholder="Calibre" value={form.calibre} onChange={handleChange} required />
        <input name="acabamento" placeholder="Acabamento" value={form.acabamento} onChange={handleChange} />
        <input name="unidade" placeholder="Unidade atual" value={form.unidade} onChange={handleChange} />

        <select name="status" value={form.status} onChange={handleChange}>
          <option>Disponível</option>
          <option>Em uso</option>
          <option>Reserva</option>
          <option>Manutenção</option>
          <option>Extraviada</option>
          <option>Baixada</option>
        </select>

        <textarea name="observacoes" placeholder="Observações" value={form.observacoes} onChange={handleChange} />

        <div className="armas-form-actions">
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>

          <button type="submit" disabled={saving}>
            {saving
              ? 'Salvando...'
              : isEditing
                ? 'Salvar alterações'
                : 'Salvar arma'}
          </button>
        </div>
      </form>
    </section>
  )
}