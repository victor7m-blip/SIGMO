import { useEffect, useState } from 'react'
import {
  cadastrarPolicial,
  atualizarPolicial
} from '../../../services/policiaisService'

const initialForm = {
  nome: '',
  nome_guerra: '',
  re: '',
  posto_graduacao: '',
  companhia: '',
  pelotao: '',
  equipe: '',
  funcao: '',
  telefone: '',
  email: '',
  cpf: '',
  rg: '',
  perfil: 'Operador',
  situacao: 'Ativo',
  observacoes: '',
  foto_url: '',
  qr_code: ''
}

const postosGraduacoes = [
  'Sd PM',
  'Cb PM',
  '3º Sgt PM',
  '2º Sgt PM',
  '1º Sgt PM',
  'Subten PM',
  'Asp Of PM',
  '2º Ten PM',
  '1º Ten PM',
  'Cap PM',
  'Maj PM',
  'Ten Cel PM',
  'Cel PM'
]

export default function PolicialForm({
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
        nome: policialEditando.nome || '',
        nome_guerra: policialEditando.nome_guerra || '',
        re: policialEditando.re || '',
        posto_graduacao: policialEditando.posto_graduacao || '',
        companhia: policialEditando.companhia || '',
        pelotao: policialEditando.pelotao || '',
        equipe: policialEditando.equipe || '',
        funcao: policialEditando.funcao || '',
        telefone: policialEditando.telefone || '',
        email: policialEditando.email || '',
        cpf: policialEditando.cpf || '',
        rg: policialEditando.rg || '',
        perfil: policialEditando.perfil || 'Operador',
        situacao: policialEditando.situacao || 'Ativo',
        observacoes: policialEditando.observacoes || '',
        foto_url: policialEditando.foto_url || '',
        qr_code: policialEditando.qr_code || ''
      })
    } else {
      setForm(initialForm)
    }
  }, [policialEditando])

  function handleChange(event) {
    const { name, value } = event.target

    setForm(prev => ({
      ...prev,
      [name]: value
    }))
  }

  function validar() {
    if (!form.nome.trim()) return 'Informe o nome completo.'
    if (!form.nome_guerra.trim()) return 'Informe o nome de guerra.'
    if (!form.re.trim()) return 'Informe o RE.'
    if (!/^\d{6}-[A-Za-z0-9]$/.test(form.re.trim())) {
      return 'O RE deve estar no formato 123456-A.'
    }
    if (!form.posto_graduacao.trim()) return 'Informe o posto ou graduação.'
    if (!form.companhia.trim()) return 'Informe a companhia.'
    if (!form.pelotao.trim()) return 'Informe o pelotão.'
    return ''
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const erroValidacao = validar()
    if (erroValidacao) {
      setErro(erroValidacao)
      return
    }

    try {
      setSaving(true)
      setErro('')

      const payload = {
        ...form,
        re: form.re.trim().toUpperCase(),
        nome: form.nome.trim(),
        nome_guerra: form.nome_guerra.trim()
      }

      if (isEditing) {
        await atualizarPolicial(policialEditando.id, payload)
      } else {
        await cadastrarPolicial(payload)
      }

      onSaved()
    } catch (err) {
      console.error(err)
      setErro('Erro ao salvar policial.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="policial-form-overlay">
      <div className="policial-form-modal">
        <div className="policial-form-header">
          <div>
            <h2>{isEditing ? 'Editar policial' : 'Novo policial'}</h2>
            <p>Preencha os dados cadastrais do efetivo.</p>
          </div>

          <button className="btn-icon" onClick={onCancel}>
            ×
          </button>
        </div>

        {erro && <div className="form-error">{erro}</div>}

        <form onSubmit={handleSubmit} className="policial-form">
          <div className="form-grid">
            <div className="form-group form-span-2">
              <label>Nome completo *</label>
              <input
                name="nome"
                value={form.nome}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Nome de guerra *</label>
              <input
                name="nome_guerra"
                value={form.nome_guerra}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>RE *</label>
              <input
                name="re"
                value={form.re}
                onChange={handleChange}
                placeholder="123456-A"
                maxLength={8}
              />
            </div>

            <div className="form-group">
              <label>Posto / Graduação *</label>
              <select
                name="posto_graduacao"
                value={form.posto_graduacao}
                onChange={handleChange}
              >
                <option value="">Selecione</option>
                {postosGraduacoes.map(item => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Companhia *</label>
              <input
                name="companhia"
                value={form.companhia}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Pelotão *</label>
              <input
                name="pelotao"
                value={form.pelotao}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Equipe</label>
              <input
                name="equipe"
                value={form.equipe}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Função</label>
              <input
                name="funcao"
                value={form.funcao}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Telefone</label>
              <input
                name="telefone"
                value={form.telefone}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>E-mail</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>CPF</label>
              <input
                name="cpf"
                value={form.cpf}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>RG</label>
              <input
                name="rg"
                value={form.rg}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Perfil</label>
              <select
                name="perfil"
                value={form.perfil}
                onChange={handleChange}
              >
                <option value="Administrador">Administrador</option>
                <option value="Gestor">Gestor</option>
                <option value="Operador">Operador</option>
                <option value="Consulta">Consulta</option>
              </select>
            </div>

            <div className="form-group">
              <label>Situação</label>
              <select
                name="situacao"
                value={form.situacao}
                onChange={handleChange}
              >
                <option value="Ativo">Ativo</option>
                <option value="Afastado">Afastado</option>
                <option value="Transferido">Transferido</option>
                <option value="Inativo">Inativo</option>
              </select>
            </div>

            <div className="form-group form-span-2">
              <label>Observações</label>
              <textarea
                name="observacoes"
                value={form.observacoes}
                onChange={handleChange}
                rows="4"
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Cancelar
            </button>

            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}