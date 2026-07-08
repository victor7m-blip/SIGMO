import { useState } from 'react'
import './PatrimonioForm.css'

export default function PatrimonioForm({ config, item, onSave, onCancel }) {
  const estadoInicial = {}

  config.campos?.forEach((campo) => {
    estadoInicial[campo.name] = item?.[campo.name] || campo.defaultValue || ''
  })

  const [form, setForm] = useState(estadoInicial)
  const [erro, setErro] = useState('')

  function onChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function validar() {
    const obrigatorios = config.campos?.filter((campo) => campo.required) || []

    for (const campo of obrigatorios) {
      if (!form[campo.name]) {
        return `Preencha o campo: ${campo.label}`
      }
    }

    return ''
  }

  function submit(e) {
    e.preventDefault()

    const erroValidacao = validar()

    if (erroValidacao) {
      setErro(erroValidacao)
      return
    }

    onSave(form)
  }

  return (
    <section className="patrimonio-form-card">
      <form onSubmit={submit}>
        {erro && <div className="form-error">{erro}</div>}

        <div className="form-grid">
          {config.campos?.map((campo) => (
            <label key={campo.name}>
              {campo.label}

              {campo.type === 'select' ? (
                <select
                  name={campo.name}
                  value={form[campo.name]}
                  onChange={onChange}
                  required={campo.required}
                >
                  <option value="">Selecione</option>

                  {campo.options?.map((option) => (
                    <option key={option.value || option} value={option.value || option}>
                      {option.label || option}
                    </option>
                  ))}
                </select>
              ) : campo.type === 'textarea' ? (
                <textarea
                  name={campo.name}
                  value={form[campo.name]}
                  onChange={onChange}
                  required={campo.required}
                  rows={campo.rows || 4}
                />
              ) : (
                <input
                  type={campo.type || 'text'}
                  name={campo.name}
                  value={form[campo.name]}
                  onChange={onChange}
                  required={campo.required}
                />
              )}
            </label>
          ))}
        </div>

        <footer className="patrimonio-form-footer">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancelar
          </button>

          <button type="submit" className="btn-primary">
            Salvar
          </button>
        </footer>
      </form>
    </section>
  )
}