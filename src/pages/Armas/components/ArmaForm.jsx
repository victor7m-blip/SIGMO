import { useState } from 'react'
import { cadastrarArma } from '../../../services/armasService'

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

export default function ArmaForm({ onCancel, onSaved }) {
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  function handleChange(event) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    try {
      setSaving(true)
      setErro('')

      await cadastrarArma(form)

      setForm(initialForm)
      onSaved()
    } catch (error) {
      console.error(error)
      setErro('Erro ao cadastrar arma. Verifique patrimônio e série.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="armas-form-card">
      <div className="armas-form-header">
        <div>
          <h2>Nova Arma</h2>
          <p>Cadastre o armamento institucional.</p>
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
            {saving ? 'Salvando...' : 'Salvar arma'}
          </button>
        </div>
      </form>
    </section>
  )
}