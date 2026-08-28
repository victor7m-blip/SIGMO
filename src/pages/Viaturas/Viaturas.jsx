import { useEffect, useMemo, useState } from 'react'

import {
  alterarSituacaoViatura,
  formatarSituacaoViatura,
  listarViaturas,
  salvarViatura,
  SITUACOES_VIATURA,
  TIPOS_VEICULO
} from '../../services/viaturasService'

import ViaturaDetalhesModal from './ViaturaDetalhesModal'

import './Viaturas.css'

const FORM_VAZIO = {
  id: null,
  prefixo: '',
  placa: '',
  modelo: '',
  ano: '',
  tipo_veiculo: 'VIATURA',
  situacao: 'DISPONIVEL',
  observacoes: ''
}

function normalizar(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function formatarPlaca(valor) {
  const limpo = String(valor || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 7)

  if (limpo.length <= 3) return limpo

  return `${limpo.slice(0, 3)}-${limpo.slice(3)}`
}

export default function Viaturas({ user }) {
  const [viaturas, setViaturas] = useState([])
  const [pesquisa, setPesquisa] = useState('')
  const [filtroSituacao, setFiltroSituacao] = useState('TODAS')
  const [filtroTipo, setFiltroTipo] = useState('TODOS')
  const [form, setForm] = useState(FORM_VAZIO)
  const [modalAberto, setModalAberto] = useState(false)
  const [detalheViatura, setDetalheViatura] = useState(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function carregar() {
    try {
      setLoading(true)
      setErro('')
      setViaturas(await listarViaturas())
    } catch (error) {
      setErro(error?.message || 'Não foi possível carregar as viaturas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const resumo = useMemo(() => {
    const contar = (situacao) =>
      viaturas.filter((item) => item.situacao === situacao).length

    return {
      total: viaturas.length,
      disponivel: contar('DISPONIVEL'),
      interna: contar('MANUTENCAO_INTERNA'),
      externa: contar('MANUTENCAO_EXTERNA'),
      descarga: contar('PROCESSO_DESCARGA')
    }
  }, [viaturas])

  const lista = useMemo(() => {
    const termo = normalizar(pesquisa)

    return viaturas.filter((item) => {
      if (
        filtroSituacao !== 'TODAS' &&
        item.situacao !== filtroSituacao
      ) {
        return false
      }

      if (
        filtroTipo !== 'TODOS' &&
        item.tipo_veiculo !== filtroTipo
      ) {
        return false
      }

      if (!termo) return true

      return normalizar(
        `${item.prefixo} ${item.placa} ${item.modelo} ${item.ano}`
      ).includes(termo)
    })
  }, [viaturas, pesquisa, filtroSituacao, filtroTipo])

  function novaViatura() {
    setForm(FORM_VAZIO)
    setErro('')
    setModalAberto(true)
  }

  function editarViatura(viatura) {
    setForm({
      id: viatura.id,
      prefixo: viatura.prefixo || '',
      placa: viatura.placa || '',
      modelo: viatura.modelo || '',
      ano: viatura.ano || '',
      tipo_veiculo: viatura.tipo_veiculo || 'VIATURA',
      situacao: viatura.situacao || 'DISPONIVEL',
      observacoes: viatura.observacoes || ''
    })
    setErro('')
    setModalAberto(true)
  }

  async function enviar(event) {
    event.preventDefault()

    try {
      setSalvando(true)
      setErro('')

      const registro = await salvarViatura(form)

      setModalAberto(false)
      setForm(FORM_VAZIO)
      await carregar()

      // Ao cadastrar uma nova viatura, abre a ficha para registrar
      // imediatamente as fotos do estado inicial.
      if (!form.id && registro) {
        setDetalheViatura(registro)
      }
    } catch (error) {
      setErro(error?.message || 'Não foi possível salvar a viatura.')
    } finally {
      setSalvando(false)
    }
  }

  async function mudarSituacao(viatura, situacao) {
    if (situacao === viatura.situacao) return

    try {
      setErro('')
      await alterarSituacaoViatura(viatura.id, situacao)
      await carregar()
    } catch (error) {
      setErro(error?.message || 'Não foi possível alterar a situação.')
    }
  }

  async function atualizarAposFotos() {
    await carregar()

    if (detalheViatura?.id) {
      const atualizada = (await listarViaturas()).find(
        (item) => item.id === detalheViatura.id
      )

      if (atualizada) {
        setDetalheViatura(atualizada)
      }
    }
  }

  return (
    <main className="viaturas-page">
      <header className="viaturas-hero">
        <div>
          <span className="viaturas-kicker">SIGMO · GESTÃO PATRIMONIAL</span>
          <h1>Viaturas</h1>
          <p>
            Cadastro, disponibilidade e ficha individual da frota da unidade.
          </p>
        </div>

        <button type="button" onClick={novaViatura}>
          + Cadastrar viatura
        </button>
      </header>

      <section className="viaturas-resumo">
        <button type="button" onClick={() => setFiltroSituacao('TODAS')}>
          <small>Total</small>
          <strong>{resumo.total}</strong>
        </button>
        <button type="button" onClick={() => setFiltroSituacao('DISPONIVEL')}>
          <small>Disponíveis</small>
          <strong>{resumo.disponivel}</strong>
        </button>
        <button type="button" onClick={() => setFiltroSituacao('MANUTENCAO_INTERNA')}>
          <small>Manutenção interna</small>
          <strong>{resumo.interna}</strong>
        </button>
        <button type="button" onClick={() => setFiltroSituacao('MANUTENCAO_EXTERNA')}>
          <small>Manutenção externa</small>
          <strong>{resumo.externa}</strong>
        </button>
        <button type="button" onClick={() => setFiltroSituacao('PROCESSO_DESCARGA')}>
          <small>Processo de descarga</small>
          <strong>{resumo.descarga}</strong>
        </button>
      </section>

      <section className="viaturas-painel">
        <div className="viaturas-toolbar viaturas-toolbar--3">
          <input
            value={pesquisa}
            onChange={(event) => setPesquisa(event.target.value)}
            placeholder="Pesquisar prefixo, placa, modelo ou ano..."
          />

          <select
            value={filtroTipo}
            onChange={(event) => setFiltroTipo(event.target.value)}
          >
            <option value="TODOS">Todos os tipos</option>
            {TIPOS_VEICULO.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <select
            value={filtroSituacao}
            onChange={(event) => setFiltroSituacao(event.target.value)}
          >
            <option value="TODAS">Todas as situações</option>
            {SITUACOES_VIATURA.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {erro && <div className="viaturas-erro">{erro}</div>}

        {loading ? (
          <div className="viaturas-vazio">Carregando viaturas...</div>
        ) : lista.length === 0 ? (
          <div className="viaturas-vazio">
            Nenhuma viatura encontrada.
          </div>
        ) : (
          <div className="viaturas-grid">
            {lista.map((viatura) => (
              <article
                className="viatura-card viatura-card--clicavel"
                key={viatura.id}
                onClick={() => setDetalheViatura(viatura)}
              >
                <div className="viatura-card__foto">
                  {viatura.foto_principal_url ? (
                    <img
                      src={viatura.foto_principal_url}
                      alt={`Foto principal ${viatura.prefixo}`}
                    />
                  ) : (
                    <span>{viatura.tipo_veiculo === 'MOTOCICLETA' ? '🏍️' : '🚓'}</span>
                  )}
                </div>

                <div className="viatura-card__topo">
                  <div>
                    <small>
                      {viatura.tipo_veiculo === 'MOTOCICLETA'
                        ? 'MOTOCICLETA'
                        : 'VIATURA'}
                    </small>
                    <h2>{viatura.prefixo}</h2>
                  </div>
                </div>

                <dl>
                  <div>
                    <dt>Placa</dt>
                    <dd>{viatura.placa}</dd>
                  </div>
                  <div>
                    <dt>Modelo</dt>
                    <dd>{viatura.modelo}</dd>
                  </div>
                  <div>
                    <dt>Ano</dt>
                    <dd>{viatura.ano}</dd>
                  </div>
                </dl>

                <label
                  className="viatura-card__situacao"
                  onClick={(event) => event.stopPropagation()}
                >
                  <span>Situação</span>
                  <select
                    value={viatura.situacao}
                    onChange={(event) =>
                      mudarSituacao(viatura, event.target.value)
                    }
                  >
                    {SITUACOES_VIATURA.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className={`viatura-status viatura-status--${viatura.situacao.toLowerCase()}`}>
                  {formatarSituacaoViatura(viatura.situacao)}
                </div>

                <div className="viatura-card__acoes">
                  <button
                    className="viatura-card__ficha"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      setDetalheViatura(viatura)
                    }}
                  >
                    Abrir ficha
                  </button>

                  <button
                    className="viatura-card__editar"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      editarViatura(viatura)
                    }}
                  >
                    Editar cadastro
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {modalAberto && (
        <div
          className="viaturas-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !salvando) {
              setModalAberto(false)
            }
          }}
        >
          <form className="viaturas-modal" onSubmit={enviar}>
            <div className="viaturas-modal__header">
              <div>
                <small>CADASTRO PATRIMONIAL</small>
                <h2>{form.id ? 'Editar viatura' : 'Nova viatura'}</h2>
              </div>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                disabled={salvando}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className="viaturas-form-grid">
              <label>
                <span>Tipo</span>
                <select
                  value={form.tipo_veiculo}
                  onChange={(event) =>
                    setForm((atual) => ({
                      ...atual,
                      tipo_veiculo: event.target.value
                    }))
                  }
                >
                  {TIPOS_VEICULO.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Prefixo</span>
                <input
                  required
                  value={form.prefixo}
                  onChange={(event) =>
                    setForm((atual) => ({
                      ...atual,
                      prefixo: event.target.value.toUpperCase()
                    }))
                  }
                  placeholder={
                    form.tipo_veiculo === 'MOTOCICLETA'
                      ? 'M-27509-11'
                      : 'M-27505'
                  }
                />
              </label>

              <label>
                <span>Placa</span>
                <input
                  required
                  value={form.placa}
                  onChange={(event) =>
                    setForm((atual) => ({
                      ...atual,
                      placa: formatarPlaca(event.target.value)
                    }))
                  }
                  placeholder="AAA-1234 ou AAA-1A23"
                  maxLength={8}
                />
              </label>

              <label>
                <span>Modelo</span>
                <input
                  required
                  value={form.modelo}
                  onChange={(event) =>
                    setForm((atual) => ({
                      ...atual,
                      modelo: event.target.value.toUpperCase()
                    }))
                  }
                  placeholder="TRAILBLAZER"
                />
              </label>

              <label>
                <span>Ano</span>
                <input
                  required
                  type="number"
                  min="1900"
                  max="2100"
                  value={form.ano}
                  onChange={(event) =>
                    setForm((atual) => ({
                      ...atual,
                      ano: event.target.value
                    }))
                  }
                  placeholder="2025"
                />
              </label>

              <label>
                <span>Situação</span>
                <select
                  value={form.situacao}
                  onChange={(event) =>
                    setForm((atual) => ({
                      ...atual,
                      situacao: event.target.value
                    }))
                  }
                >
                  {SITUACOES_VIATURA.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="viaturas-modal__acoes">
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                disabled={salvando}
              >
                Cancelar
              </button>
              <button type="submit" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar viatura'}
              </button>
            </div>
          </form>
        </div>
      )}

      {detalheViatura && (
        <ViaturaDetalhesModal
          user={user}
          viatura={detalheViatura}
          onClose={() => setDetalheViatura(null)}
          onUpdated={atualizarAposFotos}
        />
      )}
    </main>
  )
}
