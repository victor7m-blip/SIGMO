import { useCallback, useEffect, useMemo, useState } from 'react'

import './CentralOperacional.css'

import CentralResumo from './components/CentralResumo'
import CategoriaCard from './components/CategoriaCard'
import CategoriaDetalhes from './components/CategoriaDetalhes'
import ConferenciaPanel from './components/ConferenciaPanel'
import GaleriaFotos from './components/GaleriaFotos'
import QRScanner from './components/QRScanner'
import ResponsavelPanel from './components/ResponsavelPanel'
import TimelinePatrimonio from './components/TimelinePatrimonio'

import {
  carregarDashboardPatrimonial,
  listarCategoriasOperacionais,
  listarPatrimoniosCategoria
} from '../../services/dashboardService'

function normalizarTexto(valor) {
  return String(valor ?? '').trim()
}

function normalizarMaiusculo(valor) {
  return normalizarTexto(valor).toUpperCase()
}

function obterDadosPatrimonio(patrimonio) {
  if (!patrimonio) {
    return {}
  }

  if (
    patrimonio.dados &&
    typeof patrimonio.dados === 'object'
  ) {
    return patrimonio.dados
  }

  return {}
}

function obterReferenciaPatrimonio(patrimonio) {
  const dados = obterDadosPatrimonio(patrimonio)

  return (
    patrimonio?.identificador ||
    patrimonio?.numero_patrimonio ||
    patrimonio?.patrimonio ||
    patrimonio?.numero_serie ||
    patrimonio?.serie ||
    dados.numero_patrimonio ||
    dados.patrimonio ||
    dados.numero_serie ||
    dados.serie ||
    patrimonio?.referencia_id ||
    patrimonio?.id ||
    'SEM IDENTIFICAÇÃO'
  )
}

function obterNomePatrimonio(patrimonio) {
  const dados = obterDadosPatrimonio(patrimonio)

  const partes = [
    patrimonio?.tipo,
    dados.tipo,
    patrimonio?.marca,
    dados.marca,
    patrimonio?.modelo,
    dados.modelo
  ]
    .map(normalizarTexto)
    .filter(Boolean)

  if (partes.length > 0) {
    return [...new Set(partes)].join(' ')
  }

  return (
    dados.nome ||
    dados.descricao ||
    patrimonio?.descricao ||
    patrimonio?.tipo ||
    'Patrimônio'
  )
}

function obterStatusPatrimonio(patrimonio) {
  return normalizarMaiusculo(
    patrimonio?.status || 'SEM STATUS'
  )
}

function obterResponsavelNome(patrimonio) {
  const dados = obterDadosPatrimonio(patrimonio)

  return (
    patrimonio?.responsavel_nome ||
    patrimonio?.nome_responsavel ||
    dados.responsavel_nome ||
    dados.nome_responsavel ||
    dados.recebedor_nome ||
    dados.policial_nome ||
    ''
  )
}

function obterResponsavelRe(patrimonio) {
  const dados = obterDadosPatrimonio(patrimonio)

  return (
    patrimonio?.responsavel_re ||
    patrimonio?.re_responsavel ||
    dados.responsavel_re ||
    dados.re_responsavel ||
    dados.recebedor_re ||
    dados.policial_re ||
    ''
  )
}

function obterLocalAtual(patrimonio) {
  const dados = obterDadosPatrimonio(patrimonio)

  return (
    patrimonio?.local_atual ||
    patrimonio?.local ||
    dados.local_atual ||
    dados.local ||
    'NÃO INFORMADO'
  )
}

function normalizarPatrimonio(patrimonio) {
  const dados = obterDadosPatrimonio(patrimonio)

  const responsavelNome =
    obterResponsavelNome(patrimonio)

  const responsavelRe =
    obterResponsavelRe(patrimonio)

  const localAtual =
    obterLocalAtual(patrimonio)

  const noCofre =
    normalizarMaiusculo(localAtual).includes('COFRE')

  const comPolicial = Boolean(
    responsavelNome || responsavelRe
  )

  return {
    ...dados,
    ...patrimonio,

    dados,

    identificador:
      obterReferenciaPatrimonio(patrimonio),

    nome_operacional:
      obterNomePatrimonio(patrimonio),

    status_operacional:
      obterStatusPatrimonio(patrimonio),

    responsavel_nome:
      responsavelNome,

    responsavel_re:
      responsavelRe,

    local_atual:
      localAtual,

    com_policial:
      comPolicial,

    no_cofre:
      !comPolicial && noCofre
  }
}

function normalizarCategoria(categoria) {
  const total =
    Number(categoria?.total ?? 0)

  const comPolicial =
    Number(
      categoria?.com_policial ??
      categoria?.comPolicial ??
      0
    )

  const noCofre =
    Number(
      categoria?.no_cofre ??
      categoria?.reserva ??
      0
    )

  const semLocalizacao = Math.max(
    0,
    Number(
      categoria?.sem_localizacao ??
      total - comPolicial - noCofre
    )
  )

  return {
    ...categoria,

    categoria:
      normalizarMaiusculo(
        categoria?.categoria ||
        categoria?.tipo ||
        'OUTROS'
      ),

    tipo:
      normalizarTexto(
        categoria?.tipo ||
        categoria?.categoria ||
        'outros'
      ).toLowerCase(),

    total,

    com_policial:
      comPolicial,

    no_cofre:
      noCofre,

    sem_localizacao:
      semLocalizacao,

    divergencias:
      Number(categoria?.divergencias ?? 0)
  }
}

function CentralOperacional() {
  const [dashboard, setDashboard] = useState(null)

  const [categorias, setCategorias] = useState([])

  const [
    categoriaSelecionada,
    setCategoriaSelecionada
  ] = useState(null)

  const [
    patrimoniosCategoria,
    setPatrimoniosCategoria
  ] = useState([])

  const [
    patrimonioSelecionado,
    setPatrimonioSelecionado
  ] = useState(null)

  const [
    responsavelSelecionado,
    setResponsavelSelecionado
  ] = useState(null)

  const [
    conferenciaAberta,
    setConferenciaAberta
  ] = useState(false)

  const [
    carregandoCentral,
    setCarregandoCentral
  ] = useState(true)

  const [
    carregandoCategoria,
    setCarregandoCategoria
  ] = useState(false)

  const [erroCentral, setErroCentral] = useState('')

  const [erroCategoria, setErroCategoria] = useState('')

  const carregarCentral = useCallback(async () => {
    setCarregandoCentral(true)
    setErroCentral('')

    try {
      const [
        dadosDashboard,
        dadosCategorias
      ] = await Promise.all([
        carregarDashboardPatrimonial(),
        listarCategoriasOperacionais()
      ])

      setDashboard(dadosDashboard)

      setCategorias(
        (dadosCategorias ?? []).map(
          normalizarCategoria
        )
      )
    } catch (error) {
      console.error(
        'Erro ao carregar Central Operacional:',
        error
      )

      setErroCentral(
        error?.message ||
        'Não foi possível carregar a Central Operacional.'
      )
    } finally {
      setCarregandoCentral(false)
    }
  }, [])

  useEffect(() => {
    carregarCentral()
  }, [carregarCentral])
    const abrirCategoria = useCallback(
    async (categoria) => {
      setCategoriaSelecionada(categoria)
      setPatrimonioSelecionado(null)
      setResponsavelSelecionado(null)
      setConferenciaAberta(false)

      setCarregandoCategoria(true)
      setErroCategoria('')

      try {
        const lista =
          await listarPatrimoniosCategoria(
            categoria.tipo
          )

        const patrimonios =
          (lista ?? []).map(
            normalizarPatrimonio
          )

        setPatrimoniosCategoria(
          patrimonios
        )
      } catch (error) {
        console.error(
          'Erro ao carregar categoria:',
          error
        )

        setErroCategoria(
          error?.message ||
            'Não foi possível carregar os patrimônios.'
        )

        setPatrimoniosCategoria([])
      } finally {
        setCarregandoCategoria(false)
      }
    },
    []
  )

  const voltarCategorias =
    useCallback(() => {
      setCategoriaSelecionada(null)
      setPatrimonioSelecionado(null)
      setResponsavelSelecionado(null)
      setPatrimoniosCategoria([])
      setConferenciaAberta(false)
    }, [])

  const selecionarPatrimonio =
    useCallback((patrimonio) => {
      setPatrimonioSelecionado(
        patrimonio
      )
    }, [])

  const selecionarResponsavel =
    useCallback(
      (responsavel) => {
        setResponsavelSelecionado(
          responsavel
        )
      },
      []
    )

  const abrirConferencia =
    useCallback(() => {
      setConferenciaAberta(true)
    }, [])

  const fecharConferencia =
    useCallback(() => {
      setConferenciaAberta(false)
    }, [])

  const responsaveis =
    useMemo(() => {
      const mapa = new Map()

      patrimoniosCategoria.forEach(
        (item) => {
          const re =
            item.responsavel_re || ''

          const nome =
            item.responsavel_nome || ''

          if (!re && !nome) {
            return
          }

          const chave =
            re || nome

          if (!mapa.has(chave)) {
            mapa.set(chave, {
              re,
              nome,
              quantidade: 0,
              patrimonios: []
            })
          }

          const registro =
            mapa.get(chave)

          registro.quantidade += 1

          registro.patrimonios.push(
            item
          )
        }
      )

      return Array.from(
        mapa.values()
      ).sort((a, b) =>
        a.nome.localeCompare(
          b.nome,
          'pt-BR'
        )
      )
    }, [patrimoniosCategoria])

  const resumo =
    useMemo(() => {
      const total =
        patrimoniosCategoria.length

      const comPolicial =
        patrimoniosCategoria.filter(
          (item) =>
            item.com_policial
        ).length

      const noCofre =
        patrimoniosCategoria.filter(
          (item) => item.no_cofre
        ).length

      const semLocalizacao =
        patrimoniosCategoria.filter(
          (item) =>
            !item.com_policial &&
            !item.no_cofre
        ).length

      const divergencias =
        patrimoniosCategoria.filter(
          (item) =>
            item.divergencia === true ||
            item.possui_divergencia ===
              true
        ).length

      return {
        total,
        com_policial:
          comPolicial,
        no_cofre: noCofre,
        sem_localizacao:
          semLocalizacao,
        divergencias
      }
    }, [patrimoniosCategoria])

  return (
    <main className="central-operacional">
      <section className="central-hero">
        <div>
          <span className="central-section-eyebrow">
            SIGMO
          </span>

          <h1>
            Central Operacional
            Patrimonial
          </h1>

          <p>
            Acompanhe categorias,
            responsáveis,
            conferências,
            fotografias,
            QR Codes
            e histórico
            patrimonial em um
            único ambiente.
          </p>
        </div>

        <button
          type="button"
          className="central-button central-button-primary"
          onClick={carregarCentral}
          disabled={
            carregandoCentral
          }
        >
          {carregandoCentral
            ? 'Atualizando...'
            : 'Atualizar'}
        </button>
      </section>

      {erroCentral ? (
        <div className="central-error">
          {erroCentral}
        </div>
      ) : (
        <>
          <CentralResumo
            resumo={
              categoriaSelecionada
                ? resumo
                : {
                    total:
                      dashboard?.cards
                        ?.total ?? 0,
                    com_policial: 0,
                    no_cofre: 0,
                    sem_localizacao: 0,
                    divergencias: 0
                  }
            }
          />

          {!categoriaSelecionada && (
            <section className="central-categorias">
              <header className="central-section-header">
                <div>
                  <span className="central-section-eyebrow">
                    Categorias
                  </span>

                  <h2>
                    Patrimônio
                  </h2>
                </div>
              </header>

              <div className="central-categorias-grid">
                {categorias.map(
                  (
                    categoria
                  ) => (
                    <CategoriaCard
                      key={
                        categoria.tipo
                      }
                      categoria={
                        categoria
                      }
                      onClick={
                        abrirCategoria
                      }
                    />
                  )
                )}
              </div>
            </section>
          )}

          {categoriaSelecionada && (
            <CategoriaDetalhes
              categoria={
                categoriaSelecionada
              }
              patrimonios={
                patrimoniosCategoria
              }
              responsaveis={
                responsaveis
              }
              carregando={
                carregandoCategoria
              }
              onVoltar={
                voltarCategorias
              }
              onAbrirConferencia={
                abrirConferencia
              }
              onSelecionarPatrimonio={
                selecionarPatrimonio
              }
              onSelecionarResponsavel={
                selecionarResponsavel
              }
            />
          )}
                    {erroCategoria && (
            <div className="central-error">
              {erroCategoria}
            </div>
          )}

          {responsavelSelecionado && (
            <section className="central-panel">
              <div className="central-panel-header">
                <div>
                  <span className="central-section-eyebrow">
                    Responsável selecionado
                  </span>

                  <h3>
                    {responsavelSelecionado.nome ||
                      'Responsável'}
                  </h3>
                </div>

                <button
                  type="button"
                  className="central-link-button"
                  onClick={() =>
                    setResponsavelSelecionado(null)
                  }
                >
                  Fechar
                </button>
              </div>

              <ResponsavelPanel
                responsavel={responsavelSelecionado}
                patrimonios={
                  responsavelSelecionado.patrimonios ||
                  []
                }
              />
            </section>
          )}

          {patrimonioSelecionado && (
            <section className="central-patrimonio-detalhes">
              <header className="central-section-header">
                <div>
                  <span className="central-section-eyebrow">
                    Patrimônio selecionado
                  </span>

                  <h2>
                    {patrimonioSelecionado.nome_operacional}
                  </h2>

                  <p>
                    {
                      patrimonioSelecionado.identificador
                    }
                  </p>
                </div>

                <button
                  type="button"
                  className="central-link-button"
                  onClick={() =>
                    setPatrimonioSelecionado(null)
                  }
                >
                  Fechar detalhes
                </button>
              </header>

              <section className="central-panel">
                <div className="central-panel-header">
                  <div>
                    <span className="central-section-eyebrow">
                      Identificação
                    </span>

                    <h3>
                      Dados patrimoniais
                    </h3>
                  </div>

                  <span className="central-count">
                    {
                      patrimonioSelecionado.status_operacional
                    }
                  </span>
                </div>

                <div className="central-detalhes-metricas">
                  <div>
                    <span>Patrimônio</span>

                    <strong>
                      {
                        patrimonioSelecionado.identificador
                      }
                    </strong>
                  </div>

                  <div>
                    <span>Tipo</span>

                    <strong>
                      {normalizarMaiusculo(
                        patrimonioSelecionado.tipo
                      ) || 'NÃO INFORMADO'}
                    </strong>
                  </div>

                  <div>
                    <span>Marca</span>

                    <strong>
                      {patrimonioSelecionado.marca ||
                        'NÃO INFORMADA'}
                    </strong>
                  </div>

                  <div>
                    <span>Modelo</span>

                    <strong>
                      {patrimonioSelecionado.modelo ||
                        'NÃO INFORMADO'}
                    </strong>
                  </div>

                  <div>
                    <span>Número de série</span>

                    <strong>
                      {patrimonioSelecionado.numero_serie ||
                        patrimonioSelecionado.serie ||
                        'NÃO INFORMADO'}
                    </strong>
                  </div>

                  <div>
                    <span>Local atual</span>

                    <strong>
                      {
                        patrimonioSelecionado.local_atual
                      }
                    </strong>
                  </div>
                </div>
              </section>

              <ResponsavelPanel
                patrimonio={patrimonioSelecionado}
                responsavelNome={
                  patrimonioSelecionado.responsavel_nome
                }
                responsavelRe={
                  patrimonioSelecionado.responsavel_re
                }
              />

              <QRScanner
                patrimonio={patrimonioSelecionado}
                patrimonioId={
                  patrimonioSelecionado.id
                }
                codigo={
                  patrimonioSelecionado.qr_code ||
                  patrimonioSelecionado.codigo_qr ||
                  patrimonioSelecionado.identificador
                }
              />

              <GaleriaFotos
                patrimonio={patrimonioSelecionado}
                patrimonioId={
                  patrimonioSelecionado.id
                }
                referenciaId={
                  patrimonioSelecionado.referencia_id
                }
                fotos={
                  patrimonioSelecionado.fotos ||
                  []
                }
              />

              <ConferenciaPanel
                patrimonio={patrimonioSelecionado}
                patrimonioId={
                  patrimonioSelecionado.id
                }
                categoria={
                  categoriaSelecionada
                }
                aberto={
                  conferenciaAberta
                }
                onFechar={
                  fecharConferencia
                }
              />

              <TimelinePatrimonio
                patrimonio={patrimonioSelecionado}
                patrimonioId={
                  patrimonioSelecionado.id
                }
                referenciaId={
                  patrimonioSelecionado.referencia_id
                }
                tipo={
                  patrimonioSelecionado.tipo
                }
              />

              <section className="central-panel">
                <div className="central-panel-header">
                  <div>
                    <span className="central-section-eyebrow">
                      Observações
                    </span>

                    <h3>
                      Registro complementar
                    </h3>
                  </div>
                </div>

                <div className="central-observacoes">
                  {patrimonioSelecionado.observacoes ||
                    patrimonioSelecionado.observacao ||
                    patrimonioSelecionado.descricao ||
                    'Nenhuma observação cadastrada.'}
                </div>
              </section>
            </section>
          )}
        </>
      )}
    </main>
  )
}

export default CentralOperacional