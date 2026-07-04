import { useEffect, useState } from 'react'
import {
  listarPoliciais,
  cadastrarPolicial,
  atualizarPolicial,
  excluirPolicial
} from '../services/policiaisService'
import { registerAudit } from '../services/auditoriaService'
import ConfirmModal from '../components/ConfirmModal'
import './Policiais/Policiais.css'
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
  perfil_operacional: '',
  participa_teste: false,
  status: 'Ativo',
  observacoes: ''
}

const initialFilters = {
  busca: '',
  status: '',
  unidade: '',
  posto_graduacao: '',
  perfil_operacional: ''
}

export default function Policiais({ user }) {
  const [policiais, setPoliciais] = useState([])
  const [filters, setFilters] = useState(initialFilters)
  const [form, setForm] = useState(initialForm)
  const [editando, setEditando] = useState(null)
  const [visualizando, setVisualizando] = useState(null)
  const [excluindo, setExcluindo] = useState(null)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)
  const limite = 10

  const [sortBy, setSortBy] = useState('nome_completo')
  const [sortDirection, setSortDirection] = useState('asc')

  const totalPaginas = Math.max(1, Math.ceil(total / limite))
  const isEditing = Boolean(editando?.id)

  async function carregarPoliciais() {
    try {
      setLoading(true)
      setErro('')

      const result = await listarPoliciais({
        filters,
        pagina,
        limite,
        sortBy,
        sortDirection
      })

      setPoliciais(result.data)
      setTotal(result.total)
    } catch (err) {
      setErro(err.message || 'Erro ao carregar policiais.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarPoliciais()
  }, [filters, pagina, sortBy, sortDirection])

  function handleFilterChange(e) {
    const { name, value } = e.target
    setPagina(1)
    setFilters(prev => ({ ...prev, [name]: value }))
  }

  function limparFiltros() {
    setPagina(1)
    setFilters(initialFilters)
  }

  function handleFormChange(e) {
    const { name, value, type, checked } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  function iniciarEdicao(policial) {
    setEditando(policial)

    setForm({
      nome_completo: policial.nome_completo || '',
      nome_guerra: policial.nome_guerra || '',
      matricula: policial.matricula || '',
      cpf: policial.cpf || '',
      rg: policial.rg || '',
      posto_graduacao: policial.posto_graduacao || '',
      unidade: policial.unidade || '',
      funcao: policial.funcao || '',
      telefone: policial.telefone || '',
      email: policial.email || '',
      perfil_operacional: policial.perfil_operacional || '',
      participa_teste: Boolean(policial.participa_teste),
      status: policial.status || 'Ativo',
      observacoes: policial.observacoes || ''
    })

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelarEdicao() {
    setEditando(null)
    setForm(initialForm)
    setErro('')
  }

  async function salvarPolicial(e) {
    e.preventDefault()

    if (!form.nome_completo.trim()) {
      setErro('Informe o nome completo do policial.')
      return
    }

    try {
      setSaving(true)
      setErro('')

      if (isEditing) {
        await atualizarPolicial(editando.id, form)

        await registerAudit({
          acao: 'EDITAR_POLICIAL',
          descricao: `Policial atualizado: ${form.nome_completo}`,
          ator_id: user?.id,
          ator_nome: user?.nome,
          perfil: user?.perfil,
          modulo: 'Policiais',
          severidade: 'Informativo'
        })
      } else {
        await cadastrarPolicial({
          ...form,
          created_by: user?.id,
          created_by_nome: user?.nome
        })

        await registerAudit({
          acao: 'CADASTRAR_POLICIAL',
          descricao: `Policial cadastrado: ${form.nome_completo}`,
          ator_id: user?.id,
          ator_nome: user?.nome,
          perfil: user?.perfil,
          modulo: 'Policiais',
          severidade: 'Informativo'
        })
      }

      setForm(initialForm)
      setEditando(null)
      carregarPoliciais()
    } catch (err) {
      setErro(err.message || 'Erro ao salvar policial.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmarExclusao() {
    if (!excluindo?.id) return

    try {
      await excluirPolicial(excluindo.id)

      await registerAudit({
        acao: 'EXCLUIR_POLICIAL',
        descricao: `Policial excluído: ${excluindo.nome_completo}`,
        ator_id: user?.id,
        ator_nome: user?.nome,
        perfil: user?.perfil,
        modulo: 'Policiais',
        severidade: 'Atenção'
      })

      setExcluindo(null)
      carregarPoliciais()
    } catch (err) {
      setErro(err.message || 'Erro ao excluir policial.')
    }
  }

  function ordenar(campo) {
    if (sortBy === campo) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(campo)
      setSortDirection('asc')
    }
  }

  return (
    <main className="policiais-page">
      <section className="policiais-header">
        <div>
          <h1>Policiais</h1>
          <p>Cadastro operacional de policiais do SIGMO.</p>
        </div>
      </section>

      <section className="policiais-card">
        <h2>{isEditing ? 'Editar policial' : 'Cadastrar policial'}</h2>

        {erro && <div className="policiais-error">{erro}</div>}

        <form className="policiais-form" onSubmit={salvarPolicial}>
          <div className="policiais-grid">
            <label>
              Nome completo
              <input name="nome_completo" value={form.nome_completo} onChange={handleFormChange} />
            </label>

            <label>
              Nome de guerra
              <input name="nome_guerra" value={form.nome_guerra} onChange={handleFormChange} />
            </label>

            <label>
              Matrícula
              <input name="matricula" value={form.matricula} onChange={handleFormChange} />
            </label>

            <label>
              CPF
              <input name="cpf" value={form.cpf} onChange={handleFormChange} />
            </label>

            <label>
              RG
              <input name="rg" value={form.rg} onChange={handleFormChange} />
            </label>

            <label>
              Posto/Graduação
              <input name="posto_graduacao" value={form.posto_graduacao} onChange={handleFormChange} />
            </label>

            <label>
              Unidade
              <input name="unidade" value={form.unidade} onChange={handleFormChange} />
            </label>

            <label>
              Função
              <input name="funcao" value={form.funcao} onChange={handleFormChange} />
            </label>

            <label>
              Telefone
              <input name="telefone" value={form.telefone} onChange={handleFormChange} />
            </label>

            <label>
              E-mail
              <input name="email" value={form.email} onChange={handleFormChange} />
            </label>

            <label>
              Perfil operacional
              <select name="perfil_operacional" value={form.perfil_operacional} onChange={handleFormChange}>
                <option value="">Selecione</option>
                <option value="Administrador">Administrador</option>
                <option value="Comando">Comando</option>
                <option value="Operacional">Operacional</option>
                <option value="Consulta">Consulta</option>
              </select>
            </label>

            <label>
              Status
              <select name="status" value={form.status} onChange={handleFormChange}>
                <option value="Ativo">Ativo</option>
                <option value="Afastado">Afastado</option>
                <option value="Transferido">Transferido</option>
                <option value="Inativo">Inativo</option>
              </select>
            </label>

            <label className="check-label">
              <input
                type="checkbox"
                name="participa_teste"
                checked={form.participa_teste}
                onChange={handleFormChange}
              />
              Participa do teste
            </label>

            <label className="policiais-span">
              Observações
              <textarea name="observacoes" value={form.observacoes} onChange={handleFormChange} />
            </label>
          </div>

          <div className="policiais-actions">
            <button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Cadastrar'}
            </button>

            {isEditing && (
              <button type="button" className="secondary" onClick={cancelarEdicao}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="policiais-card">
        <h2>Filtros</h2>

        <div className="policiais-filters">
          <input
            name="busca"
            placeholder="Buscar por nome, guerra, matrícula, CPF, RG ou unidade"
            value={filters.busca}
            onChange={handleFilterChange}
          />

          <input
            name="posto_graduacao"
            placeholder="Posto/Graduação"
            value={filters.posto_graduacao}
            onChange={handleFilterChange}
          />

          <input
            name="unidade"
            placeholder="Unidade"
            value={filters.unidade}
            onChange={handleFilterChange}
          />

          <select name="perfil_operacional" value={filters.perfil_operacional} onChange={handleFilterChange}>
            <option value="">Todos os perfis</option>
            <option value="Administrador">Administrador</option>
            <option value="Comando">Comando</option>
            <option value="Operacional">Operacional</option>
            <option value="Consulta">Consulta</option>
          </select>

          <select name="status" value={filters.status} onChange={handleFilterChange}>
            <option value="">Todos os status</option>
            <option value="Ativo">Ativo</option>
            <option value="Afastado">Afastado</option>
            <option value="Transferido">Transferido</option>
            <option value="Inativo">Inativo</option>
          </select>

          <button type="button" className="secondary" onClick={limparFiltros}>
            Limpar
          </button>
        </div>
      </section>

      <section className="policiais-card">
        <div className="policiais-table-top">
          <strong>{total} policial(is) encontrado(s)</strong>
          {loading && <span>Carregando...</span>}
        </div>

        <div className="policiais-table-wrap">
          <table className="policiais-table">
            <thead>
              <tr>
                <th onClick={() => ordenar('nome_completo')}>Nome</th>
                <th onClick={() => ordenar('nome_guerra')}>Guerra</th>
                <th onClick={() => ordenar('matricula')}>Matrícula</th>
                <th onClick={() => ordenar('posto_graduacao')}>Posto/Grad.</th>
                <th onClick={() => ordenar('unidade')}>Unidade</th>
                <th onClick={() => ordenar('perfil_operacional')}>Perfil</th>
                <th onClick={() => ordenar('status')}>Status</th>
                <th>Ações</th>
              </tr>
            </thead>

            <tbody>
              {!loading && policiais.length === 0 && (
                <tr>
                  <td colSpan="8" className="empty">Nenhum policial encontrado.</td>
                </tr>
              )}

              {policiais.map(policial => (
                <tr key={policial.id}>
                  <td>{policial.nome_completo}</td>
                  <td>{policial.nome_guerra}</td>
                  <td>{policial.matricula}</td>
                  <td>{policial.posto_graduacao}</td>
                  <td>{policial.unidade}</td>
                  <td>{policial.perfil_operacional}</td>
                  <td>
                    <span className={`status status-${String(policial.status || '').toLowerCase()}`}>
                      {policial.status}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button onClick={() => setVisualizando(policial)}>Ver</button>
                      <button onClick={() => iniciarEdicao(policial)}>Editar</button>
                      <button className="danger" onClick={() => setExcluindo(policial)}>
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <button disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>
            Anterior
          </button>

          <span>Página {pagina} de {totalPaginas}</span>

          <button disabled={pagina >= totalPaginas} onClick={() => setPagina(pagina + 1)}>
            Próxima
          </button>
        </div>
      </section>

      {visualizando && (
        <div className="modal-backdrop">
          <div className="policiais-modal">
            <h2>Detalhes do policial</h2>

            <div className="detail-grid">
              <p><strong>Nome:</strong> {visualizando.nome_completo}</p>
              <p><strong>Nome de guerra:</strong> {visualizando.nome_guerra}</p>
              <p><strong>Matrícula:</strong> {visualizando.matricula}</p>
              <p><strong>CPF:</strong> {visualizando.cpf}</p>
              <p><strong>RG:</strong> {visualizando.rg}</p>
              <p><strong>Posto/Graduação:</strong> {visualizando.posto_graduacao}</p>
              <p><strong>Unidade:</strong> {visualizando.unidade}</p>
              <p><strong>Função:</strong> {visualizando.funcao}</p>
              <p><strong>Telefone:</strong> {visualizando.telefone}</p>
              <p><strong>E-mail:</strong> {visualizando.email}</p>
              <p><strong>Perfil operacional:</strong> {visualizando.perfil_operacional}</p>
              <p><strong>Participa do teste:</strong> {visualizando.participa_teste ? 'Sim' : 'Não'}</p>
              <p><strong>Status:</strong> {visualizando.status}</p>
              <p className="detail-span"><strong>Observações:</strong> {visualizando.observacoes}</p>
            </div>

            <div className="policiais-actions">
              <button onClick={() => setVisualizando(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {excluindo && (
        <ConfirmModal
          title="Excluir policial"
          message={`Deseja realmente excluir ${excluindo.nome_completo}?`}
          onCancel={() => setExcluindo(null)}
          onConfirm={confirmarExclusao}
        />
      )}
    </main>
  )
}