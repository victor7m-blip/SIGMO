import { useEffect, useMemo, useRef, useState } from 'react'

import {
  formatarSituacaoViatura,
  listarViaturas,
  salvarViatura,
  SITUACOES_VIATURA,
  TIPOS_VEICULO
} from '../../services/viaturasService'

import ViaturaDetalhesModal from './ViaturaDetalhesModal'
import CentralManutencaoVtr from '../Manutencoes/CentralManutencaoVtr'

import './Viaturas.css'

const SITUACAO_OUTRAS_UNIDADES = {
  value: 'A_DISPOSICAO_OUTRAS_UNIDADES',
  label: 'À disposição de outras unidades'
}

const SITUACOES_VIATURA_UI = [
  ...SITUACOES_VIATURA,
  SITUACAO_OUTRAS_UNIDADES
]

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

export default function Viaturas({ user, abrirViaturaId = null, abrirDiretoRiv = false, onViaturaAberta }) {
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
  const [abrirRivInicial, setAbrirRivInicial] = useState(false)
  const [areaViaturas, setAreaViaturas] = useState('FROTA')
  const [consultaAberta, setConsultaAberta] = useState(false)
  const [consultaAvancada, setConsultaAvancada] = useState({
    prefixo: '',
    placa: '',
    modelo: '',
    ano: '',
    tipo: 'TODOS',
    situacao: 'TODAS'
  })
  const frotaRef = useRef(null)

  function mostrarFrota({ limparPesquisa = false, situacao = 'TODAS' } = {}) {
    setAreaViaturas('FROTA')
    setFiltroSituacao(situacao)

    if (limparPesquisa) {
      setPesquisa('')
    }

    window.setTimeout(() => {
      frotaRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    }, 0)
  }


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

  useEffect(() => {
    if (!abrirViaturaId || viaturas.length === 0) return

    const encontrada = viaturas.find(
      (item) => String(item.id) === String(abrirViaturaId)
    )

    if (!encontrada) return

    setDetalheViatura(encontrada)
    setAbrirRivInicial(Boolean(abrirDiretoRiv))
    onViaturaAberta?.()
  }, [abrirViaturaId, abrirDiretoRiv, viaturas, onViaturaAberta])

  const resumo = useMemo(() => {
    const contar = (situacao) =>
      viaturas.filter((item) => item.situacao === situacao).length

    return {
      total: viaturas.length,
      disponivel: contar('DISPONIVEL'),
      interna: contar('MANUTENCAO_INTERNA'),
      externa: contar('MANUTENCAO_EXTERNA'),
      outrasUnidades: contar('A_DISPOSICAO_OUTRAS_UNIDADES'),
      descarga: contar('PROCESSO_DESCARGA')
    }
  }, [viaturas])

  const consultaAvancadaAtiva = useMemo(() => {
    return Boolean(
      consultaAvancada.prefixo ||
      consultaAvancada.placa ||
      consultaAvancada.modelo ||
      consultaAvancada.ano ||
      consultaAvancada.tipo !== 'TODOS' ||
      consultaAvancada.situacao !== 'TODAS'
    )
  }, [consultaAvancada])

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

      const atendePesquisaGeral =
        !termo ||
        normalizar(
          `${item.prefixo} ${item.placa} ${item.modelo} ${item.ano}`
        ).includes(termo)

      if (!atendePesquisaGeral) return false

      if (
        consultaAvancada.prefixo &&
        !normalizar(item.prefixo).includes(normalizar(consultaAvancada.prefixo))
      ) {
        return false
      }

      if (
        consultaAvancada.placa &&
        !normalizar(item.placa).includes(normalizar(consultaAvancada.placa))
      ) {
        return false
      }

      if (
        consultaAvancada.modelo &&
        !normalizar(item.modelo).includes(normalizar(consultaAvancada.modelo))
      ) {
        return false
      }

      if (
        consultaAvancada.ano &&
        String(item.ano || '') !== String(consultaAvancada.ano)
      ) {
        return false
      }

      if (
        consultaAvancada.tipo !== 'TODOS' &&
        item.tipo_veiculo !== consultaAvancada.tipo
      ) {
        return false
      }

      if (
        consultaAvancada.situacao !== 'TODAS' &&
        item.situacao !== consultaAvancada.situacao
      ) {
        return false
      }

      return true
    })
  }, [
    viaturas,
    pesquisa,
    filtroSituacao,
    filtroTipo,
    consultaAvancada
  ])

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

      const registro = await salvarViatura({
        ...form,
        situacao: form.id ? form.situacao : 'DISPONIVEL'
      })

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

  async function removerViatura(viatura) {
    const prefixo = String(viatura?.prefixo || '').trim()

    const confirmou = window.confirm(
      `Remover a viatura ${prefixo || 'selecionada'} da frota ativa?\n\n` +
      'O cadastro será inativado para preservar o histórico de RIV, quilometragem, avarias e manutenções.'
    )

    if (!confirmou) return

    const digitado = window.prompt(
      `Para confirmar, digite o prefixo da viatura: ${prefixo}`
    )

    if (normalizar(digitado) !== normalizar(prefixo)) {
      if (digitado !== null) {
        setErro('Remoção cancelada: o prefixo informado não confere.')
      }
      return
    }

    try {
      setSalvando(true)
      setErro('')

      await salvarViatura({
        id: viatura.id,
        prefixo: viatura.prefixo || '',
        placa: viatura.placa || '',
        modelo: viatura.modelo || '',
        ano: viatura.ano || '',
        tipo_veiculo: viatura.tipo_veiculo || 'VIATURA',
        situacao: viatura.situacao || 'DISPONIVEL',
        observacoes: viatura.observacoes || '',
        ativo: false
      })

      if (String(detalheViatura?.id) === String(viatura.id)) {
        setDetalheViatura(null)
        setAbrirRivInicial(false)
      }

      await carregar()
    } catch (error) {
      setErro(error?.message || 'Não foi possível remover a viatura.')
    } finally {
      setSalvando(false)
    }
  }

  function abrirRivPelaManutencao(viaturaId) {
    const encontrada = viaturas.find(
      (item) => String(item.id) === String(viaturaId)
    )

    if (!encontrada) {
      setErro('Viatura não localizada na frota.')
      return
    }

    setAreaViaturas('FROTA')
    setDetalheViatura(encontrada)
    setAbrirRivInicial(true)
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
            Controle da frota, disponibilidade, RIV, manutenção e movimentação das viaturas da unidade.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={carregar}
            disabled={loading}
            style={{
              background: '#fff',
              color: '#0f2742',
              border: '1px solid #cbd5e1'
            }}
          >
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>

          <button type="button" onClick={novaViatura}>
            + Cadastrar viatura
          </button>
        </div>
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
        <button type="button" onClick={() => setFiltroSituacao('A_DISPOSICAO_OUTRAS_UNIDADES')}>
          <small>À disposição de outras unidades</small>
          <strong>{resumo.outrasUnidades}</strong>
        </button>
        <button type="button" onClick={() => setFiltroSituacao('PROCESSO_DESCARGA')}>
          <small>Processo de descarga</small>
          <strong>{resumo.descarga}</strong>
        </button>
      </section>

      <section
        aria-label="Operações permitidas"
        style={{
          marginTop: 18,
          marginBottom: 18,
          background: '#ffffff',
          border: '1px solid #d7e0ea',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(15, 39, 66, .06)'
        }}
      >
        <div style={{ padding: '18px 20px 8px' }}>
          <span
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: '.08em',
              color: '#2563a7',
              textTransform: 'uppercase',
              marginBottom: 4
            }}
          >
            Operações permitidas
          </span>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: 22 }}>
            Gestão da frota
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 14,
            padding: 20
          }}
        >
          <section
            style={{
              border: '1px solid #d8e1eb',
              borderRadius: 14,
              overflow: 'hidden',
              background: '#f8fafc'
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                padding: '16px 18px',
                borderBottom: '1px solid #d8e1eb',
                background: '#fff'
              }}
            >
              <div style={{ fontSize: 24 }}>🚓</div>
              <div>
                <strong style={{ display: 'block', color: '#0f172a', fontSize: 17 }}>
                  Cadastro e frota
                </strong>
                <span style={{ color: '#64748b', fontSize: 13 }}>
                  Cadastro, consulta e atualização das viaturas.
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 10,
                padding: 14
              }}
            >
              <button type="button" onClick={novaViatura}>
                <strong>+ Cadastrar viatura</strong>
                <span>Adicionar uma nova viatura à frota ativa</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAreaViaturas('FROTA')
                  setConsultaAberta(true)
                }}
              >
                <strong>Consultar frota</strong>
                <span>Combinar vários parâmetros para localizar viaturas</span>
              </button>
            </div>
          </section>

          <section
            style={{
              border: '1px solid #d8e1eb',
              borderRadius: 14,
              overflow: 'hidden',
              background: '#f8fafc'
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                padding: '16px 18px',
                borderBottom: '1px solid #d8e1eb',
                background: '#fff'
              }}
            >
              <div style={{ fontSize: 24 }}>🛠️</div>
              <div>
                <strong style={{ display: 'block', color: '#0f172a', fontSize: 17 }}>
                  Condição da viatura
                </strong>
                <span style={{ color: '#64748b', fontSize: 13 }}>
                  Novidades, manutenção interna e encaminhamento externo.
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 10,
                padding: 14
              }}
            >
              <button
                type="button"
                onClick={() => setAreaViaturas('MANUTENCAO')}
              >
                <strong>Central de manutenção</strong>
                <span>SVDD envia à manutenção interna; P4 encaminha ao fluxo externo</span>
              </button>

              <button
                type="button"
                onClick={() => mostrarFrota({ situacao: 'A_DISPOSICAO_OUTRAS_UNIDADES' })}
              >
                <strong>Outras unidades</strong>
                <span>Viaturas à disposição de outras unidades</span>
              </button>
            </div>
          </section>

          <section
            style={{
              border: '1px solid #d8e1eb',
              borderRadius: 14,
              overflow: 'hidden',
              background: '#f8fafc'
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                padding: '16px 18px',
                borderBottom: '1px solid #d8e1eb',
                background: '#fff'
              }}
            >
              <div style={{ fontSize: 24 }}>📋</div>
              <div>
                <strong style={{ display: 'block', color: '#0f172a', fontSize: 17 }}>
                  Registro operacional
                </strong>
                <span style={{ color: '#64748b', fontSize: 13 }}>
                  Ficha individual, RIV, avarias e quilometragem.
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 10,
                padding: 14
              }}
            >
              <button
                type="button"
                onClick={() => mostrarFrota({ limparPesquisa: true, situacao: 'TODAS' })}
              >
                <strong>Abrir ficha / RIV</strong>
                <span>Selecione uma viatura abaixo para acessar a ficha</span>
              </button>

              <button
                type="button"
                onClick={() => mostrarFrota({ situacao: 'PROCESSO_DESCARGA' })}
              >
                <strong>Processo de descarga</strong>
                <span>Acompanhar viaturas em processo de retirada da frota</span>
              </button>
            </div>
          </section>
        </div>
      </section>

      <section
        aria-label="Navegação do módulo"
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          padding: 6,
          border: '1px solid #d7e0ea',
          borderRadius: 12,
          background: '#fff'
        }}
      >
        <button
          type="button"
          onClick={() => setAreaViaturas('FROTA')}
          aria-pressed={areaViaturas === 'FROTA'}
          style={{
            border: areaViaturas === 'FROTA' ? '1px solid #2563eb' : '1px solid transparent',
            borderRadius: 8,
            padding: '9px 16px',
            fontWeight: 800,
            cursor: 'pointer',
            background: areaViaturas === 'FROTA' ? '#2563eb' : 'transparent',
            color: areaViaturas === 'FROTA' ? '#fff' : '#334155'
          }}
        >
          Frota
        </button>

        <button
          type="button"
          onClick={() => setAreaViaturas('MANUTENCAO')}
          aria-pressed={areaViaturas === 'MANUTENCAO'}
          style={{
            border: areaViaturas === 'MANUTENCAO' ? '1px solid #2563eb' : '1px solid transparent',
            borderRadius: 8,
            padding: '9px 16px',
            fontWeight: 800,
            cursor: 'pointer',
            background: areaViaturas === 'MANUTENCAO' ? '#2563eb' : 'transparent',
            color: areaViaturas === 'MANUTENCAO' ? '#fff' : '#334155'
          }}
        >
          Manutenção
        </button>
      </section>

      {areaViaturas === 'FROTA' && (
      <section ref={frotaRef} className="viaturas-painel">
        {consultaAvancadaAtiva && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 12,
              padding: '10px 12px',
              border: '1px solid #bfdbfe',
              borderRadius: 9,
              background: '#eff6ff',
              color: '#1e3a8a'
            }}
          >
            <strong>Consulta avançada ativa</strong>
            <button
              type="button"
              onClick={() =>
                setConsultaAvancada({
                  prefixo: '',
                  placa: '',
                  modelo: '',
                  ano: '',
                  tipo: 'TODOS',
                  situacao: 'TODAS'
                })
              }
              style={{
                minHeight: 34,
                padding: '0 12px',
                border: '1px solid #bfdbfe',
                borderRadius: 8,
                background: '#fff',
                color: '#1d4ed8',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Limpar filtros
            </button>
          </div>
        )}

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
            {SITUACOES_VIATURA_UI.map((item) => (
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
                onClick={() => { setAbrirRivInicial(false); setDetalheViatura(viatura) }}
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

                <div className={`viatura-status viatura-status--${viatura.situacao.toLowerCase()}`}>
                  {viatura.situacao === 'A_DISPOSICAO_OUTRAS_UNIDADES'
                    ? 'À disposição de outras unidades'
                    : formatarSituacaoViatura(viatura.situacao)}
                </div>

                <div className="viatura-card__acoes">
                  <button
                    className="viatura-card__ficha"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      setAbrirRivInicial(false)
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


                  <button
                    type="button"
                    disabled={salvando}
                    onClick={(event) => {
                      event.stopPropagation()
                      removerViatura(viatura)
                    }}
                    style={{
                      border: '1px solid rgba(239, 68, 68, .55)',
                      background: 'rgba(127, 29, 29, .22)',
                      color: '#fecaca'
                    }}
                  >
                    Remover viatura
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      )}

      {areaViaturas === 'MANUTENCAO' && (
        <div style={{ marginTop: 18 }}>
          <CentralManutencaoVtr
            user={user}
            onAbrirRiv={abrirRivPelaManutencao}
          />
        </div>
      )}

      {consultaAberta && (
        <div
          className="viaturas-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setConsultaAberta(false)
            }
          }}
        >
          <div className="viaturas-modal">
            <div className="viaturas-modal__header">
              <div>
                <small>CONSULTA AVANÇADA</small>
                <h2>Consultar frota</h2>
                <p
                  style={{
                    margin: '6px 0 0',
                    color: '#aebed0',
                    fontSize: 14
                  }}
                >
                  Combine um ou mais parâmetros. Todos os campos preenchidos serão considerados juntos.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setConsultaAberta(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className="viaturas-form-grid">
              <label>
                <span>Prefixo</span>
                <input
                  value={consultaAvancada.prefixo}
                  onChange={(event) =>
                    setConsultaAvancada((atual) => ({
                      ...atual,
                      prefixo: event.target.value.toUpperCase()
                    }))
                  }
                  placeholder="Ex.: M-27500"
                />
              </label>

              <label>
                <span>Placa</span>
                <input
                  value={consultaAvancada.placa}
                  onChange={(event) =>
                    setConsultaAvancada((atual) => ({
                      ...atual,
                      placa: event.target.value.toUpperCase()
                    }))
                  }
                  placeholder="Ex.: ABC-1D23"
                />
              </label>

              <label>
                <span>Modelo</span>
                <input
                  value={consultaAvancada.modelo}
                  onChange={(event) =>
                    setConsultaAvancada((atual) => ({
                      ...atual,
                      modelo: event.target.value.toUpperCase()
                    }))
                  }
                  placeholder="Ex.: TRAILBLAZER"
                />
              </label>

              <label>
                <span>Ano</span>
                <input
                  type="number"
                  min="1900"
                  max="2100"
                  value={consultaAvancada.ano}
                  onChange={(event) =>
                    setConsultaAvancada((atual) => ({
                      ...atual,
                      ano: event.target.value
                    }))
                  }
                  placeholder="Ex.: 2025"
                />
              </label>

              <label>
                <span>Tipo</span>
                <select
                  value={consultaAvancada.tipo}
                  onChange={(event) =>
                    setConsultaAvancada((atual) => ({
                      ...atual,
                      tipo: event.target.value
                    }))
                  }
                >
                  <option value="TODOS">Todos os tipos</option>
                  {TIPOS_VEICULO.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Situação</span>
                <select
                  value={consultaAvancada.situacao}
                  onChange={(event) =>
                    setConsultaAvancada((atual) => ({
                      ...atual,
                      situacao: event.target.value
                    }))
                  }
                >
                  <option value="TODAS">Todas as situações</option>
                  {SITUACOES_VIATURA_UI.map((item) => (
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
                onClick={() =>
                  setConsultaAvancada({
                    prefixo: '',
                    placa: '',
                    modelo: '',
                    ano: '',
                    tipo: 'TODOS',
                    situacao: 'TODAS'
                  })
                }
              >
                Limpar
              </button>

              <button
                type="button"
                onClick={() => {
                  setConsultaAberta(false)
                  setAreaViaturas('FROTA')
                  window.setTimeout(() => {
                    frotaRef.current?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start'
                    })
                  }, 0)
                }}
              >
                Aplicar consulta
              </button>
            </div>
          </div>
        </div>
      )}

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
                <input
                  value={
                    form.id
                      ? (
                          form.situacao === 'A_DISPOSICAO_OUTRAS_UNIDADES'
                            ? 'À disposição de outras unidades'
                            : formatarSituacaoViatura(form.situacao)
                        )
                      : 'Disponível'
                  }
                  readOnly
                  title="A situação da viatura é alterada pelos fluxos operacionais do SIGMO."
                />
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
          onClose={() => {
            setDetalheViatura(null)
            setAbrirRivInicial(false)
          }}
          onUpdated={atualizarAposFotos}
          abaInicial={abrirRivInicial ? 'RIV' : 'FOTOS'}
        />
      )}
    </main>
  )
}
