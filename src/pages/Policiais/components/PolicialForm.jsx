import { useEffect, useState } from 'react'
import {
  cadastrarPessoa,
  atualizarPessoa
} from '../../../services/policiaisService.js'
import { registerAudit } from '../../../services/auditoriaService'

const initialForm = {
  nome_completo: '',
  nome_guerra: '',
  matricula: '',
  cpf: '',
  rg: '',
  posto_graduacao: '',
  unidade: '',
  funcao: '',
  telefone: '',
  email: '',
  perfil_operacional: 'Policial',
  participa_teste: false,
  status: 'Ativo',
  observacoes: ''
}

export default function PolicialForm({
  user,
  policialEditando,
  onCancel,
  onSaved
}) {
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  const isEditing = Boolean(policialEditando?.id)

  useEffect(() => {
    if (policialEditando) {
      setForm({
        nome_completo: policialEditando.nome_completo || '',
        nome_guerra: policialEditando.nome_guerra || '',
        matricula: policialEditando.matricula || '',
        cpf: policialEditando.cpf || '',
        rg: policialEditando.rg || '',
        posto_graduacao: policialEditando.posto_graduacao || '',
        unidade: policialEditando.unidade || '',
        funcao: policialEditando.funcao || '',
        telefone: policialEditando.telefone || '',
        email: policialEditando.email || '',
        perfil_operacional: policialEditando.perfil_operacional || 'Policial',
        participa_teste: Boolean(policialEditando.participa_teste),
        status: policialEditando.status || 'Ativo',
        observacoes: policialEditando.observacoes || ''
      })
    } else {
      setForm(initialForm)
    }

    setErro('')
  }, [policialEditando])

  function handleChange(event) {
    const { name, value, type, checked } = event.target

    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    try {
      setSaving(true)
      setErro('')

      let policial

      if (isEditing) {
        policial = await atualizarPessoa(policialEditando.id, form)

        await registerAudit(
          'POLICIAL_UPDATE',
          `Policial editado: ${policial.nome_completo}`,
          user,
          'Policiais',
          'Informativo'
        )
      } else {
        policial = await cadastrarPessoa(form, user)

        await registerAudit(
          'POLICIAL_CREATE',
          `Policial cadastrado: ${policial.nome_completo}`,
          user,
          'Policiais',
          'Informativo'
        )
      }

      setForm(initialForm)
      onSaved()
    } catch (error) {
      console.error(error)
      setErro('Erro ao salvar policial. Verifique matrícula e dados obrigatórios.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="policiais-form-card">
      <div className="policiais-form-header">
        <div>
          <h2>{isEditing ? 'Editar Policial' : 'Novo Policial'}</h2>
          <p>{isEditing ? 'Atualize os dados do policial.' : 'Cadastre um policial ou servidor.'}</p>
        </div>

        <button type="button" onClick={onCancel}>
          Fechar
        </button>
      </div>

      {erro && <p className="policiais-error">{erro}</p>}

      <form className="policiais-form" onSubmit={handleSubmit}>
        <input name="nome_completo" placeholder="Nome completo" value={form.nome_completo} onChange={handleChange} required />
        <input name="nome_guerra" placeholder="Nome de guerra" value={form.nome_guerra} onChange={handleChange} />
        <input name="matricula" placeholder="Matrícula" value={form.matricula} onChange={handleChange} />
        <input name="cpf" placeholder="CPF" value={form.cpf} onChange={handleChange} />
        <input name="rg" placeholder="RG" value={form.rg} onChange={handleChange} />

        <select name="posto_graduacao" value={form.posto_graduacao} onChange={handleChange}>
          <option value="">Posto/Graduação</option>
          <option value="Soldado">Soldado</option>
          <option value="Cabo">Cabo</option>
          <option value="3º Sargento">3º Sargento</option>
          <option value="2º Sargento">2º Sargento</option>
          <option value="1º Sargento">1º Sargento</option>
          <option value="Subtenente">Subtenente</option>
          <option value="Aspirante">Aspirante</option>
          <option value="2º Tenente">2º Tenente</option>
          <option value="1º Tenente">1º Tenente</option>
          <option value="Capitão">Capitão</option>
          <option value="Major">Major</option>
          <option value="Tenente-Coronel">Tenente-Coronel</option>
          <option value="Coronel">Coronel</option>
          <option value="Servidor Civil">Servidor Civil</option>
        </select>

        <input name="unidade" placeholder="Unidade" value={form.unidade} onChange={handleChange} />
        <input name="funcao" placeholder="Função" value={form.funcao} onChange={handleChange} />
        <input name="telefone" placeholder="Telefone" value={form.telefone} onChange={handleChange} />
        <input name="email" placeholder="E-mail" value={form.email} onChange={handleChange} />

        <select name="perfil_operacional" value={form.perfil_operacional} onChange={handleChange}>
          <option value="Administrador">Administrador</option>
          <option value="Armeiro">Armeiro</option>
          <option value="Testador">Testador</option>
          <option value="Policial">Policial</option>
          <option value="Consulta">Consulta</option>
        </select>

        <select name="status" value={form.status} onChange={handleChange}>
          <option value="Ativo">Ativo</option>
          <option value="Afastado">Afastado</option>
          <option value="Transferido">Transferido</option>
          <option value="Inativo">Inativo</option>
        </select>

        <label className="policiais-checkbox">
          <input
            type="checkbox"
            name="participa_teste"
            checked={form.participa_teste}
            onChange={handleChange}
          />
          Participa da equipe piloto do SIGMO
        </label>

        <textarea name="observacoes" placeholder="Observações" value={form.observacoes} onChange={handleChange} />

        <div className="policiais-form-actions">
          <button type="button" onClick={onCancel}>Cancelar</button>
          <button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Salvar policial'}
          </button>
        </div>
      </form>
    </section>
  )
}