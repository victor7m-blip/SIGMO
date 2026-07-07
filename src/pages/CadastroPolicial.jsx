import { useState } from 'react'
import { salvarCadastroPolicial } from '../services/policiais'

const initialForm = {
  re: '',
  nome: '',
  nome_guerra: '',
  posto_graduacao: '',
  companhia: '5ª Companhia',
  pelotao: '',
  equipe: '',
  funcao: '',
  telefone: '',
  email: '',
  situacao: 'Ativo',
  observacoes: ''
}

export default function CadastroUsuario() {
  const [form, setForm] = useState(initialForm)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')
    setLoading(true)

    try {
      await salvarCadastroPolicial(form)

      setMessage('Policial cadastrado com sucesso.')
      setForm(initialForm)
    } catch (error) {
      console.error(error)
      setMessage(error.message || 'Erro ao salvar cadastro.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="panel">
      <h2>Cadastro de Usuário</h2>
      <p>Cadastro base do policial no SIGMO.</p>

      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="field">
          <span>RE</span>
          <input value={form.re} onChange={e => update('re', e.target.value)} />
        </label>

        <label className="field">
          <span>Nome completo</span>
          <input value={form.nome} onChange={e => update('nome', e.target.value)} />
        </label>

        <label className="field">
          <span>Nome de guerra</span>
          <input value={form.nome_guerra} onChange={e => update('nome_guerra', e.target.value)} />
        </label>

        <label className="field">
          <span>Posto / Graduação</span>
          <input value={form.posto_graduacao} onChange={e => update('posto_graduacao', e.target.value)} />
        </label>

        <label className="field">
          <span>Companhia</span>
          <input value={form.companhia} onChange={e => update('companhia', e.target.value)} />
        </label>

        <label className="field">
          <span>Pelotão</span>
          <input value={form.pelotao} onChange={e => update('pelotao', e.target.value)} />
        </label>

        <label className="field">
          <span>Equipe</span>
          <input value={form.equipe} onChange={e => update('equipe', e.target.value)} />
        </label>

        <label className="field">
          <span>Função</span>
          <input value={form.funcao} onChange={e => update('funcao', e.target.value)} />
        </label>

        <label className="field">
          <span>Telefone</span>
          <input value={form.telefone} onChange={e => update('telefone', e.target.value)} />
        </label>

        <label className="field">
          <span>E-mail</span>
          <input value={form.email} onChange={e => update('email', e.target.value)} />
        </label>

        <label className="field">
          <span>Situação</span>
          <select value={form.situacao} onChange={e => update('situacao', e.target.value)}>
            <option>Ativo</option>
            <option>Afastado</option>
            <option>Transferido</option>
            <option>Inativo</option>
          </select>
        </label>

        <label className="field">
          <span>Observações</span>
          <input value={form.observacoes} onChange={e => update('observacoes', e.target.value)} />
        </label>

        <div className="form-actions">
          <button className="primary-btn" disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar Cadastro'}
          </button>
        </div>
      </form>

      {message && <p className="message">{message}</p>}
    </section>
  )
}