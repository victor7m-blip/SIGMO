import { useEffect, useMemo, useState } from 'react'

import { supabase } from '../../services/supabaseClient'

import QrScanner from '../../components/QrScanner/QrScanner'

import {
  criarMovimentacaoCompleta
} from '../../services/movimentacaoEngine'

import {
  devolverTonfaDoSvddAoP4,
  distribuirTonfaParaSvdd
} from '../../services/tonfasService'

import {
  buscarPatrimonioPorQrCode
} from '../../services/pagarMaterialService'

import {
  obterPerfilEfetivo
} from '../../services/permissionService'

import RecebedorCard from './components/RecebedorCard'
import PesquisaMaterial from './components/PesquisaMaterial'
import ResumoEntrega from './components/ResumoEntrega'

import './PagarMaterial.css'

const ORIGEM_P4 = 'DEPÓSITO DO P4'
const ORIGEM_SVDD = 'COFRE DO SVDD'

const TIPO_CAUTELA = 'CAUTELA'
const TIPO_TRANSFERENCIA = 'TRANSFERÊNCIA'
const TIPO_ENTREGA = 'ENTREGA'
const TIPO_TRANSFERENCIA_P4 = 'TRANSFERÊNCIA PARA O P4'

const DESTINO_CAUTELA = 'CAUTELA INDIVIDUAL'
const DESTINO_P4 = 'DEPÓSITO DO P4'
const DESTINO_SVDD = 'COFRE DO SVDD'

const CHAVE_FIM_TURNO_DATA = 'sigmo_pagar_material_fim_turno_data'
const CHAVE_FIM_TURNO_HORA = 'sigmo_pagar_material_fim_turno_hora'
const CHAVE_PREVISAO_ENTREGA_DATA = 'sigmo_pagar_material_previsao_entrega_data'
const CHAVE_PREVISAO_ENTREGA_HORA = 'sigmo_pagar_material_previsao_entrega_hora'
const DURACAO_MAXIMA_CAUTELA_MS = (12 * 60 + 30) * 60 * 1000

function lerPreferenciaLocal(chave) {
  try {
    return window.localStorage.getItem(chave) || ''
  } catch {
    return ''
  }
}

function salvarPreferenciaLocal(chave, valor) {
  try {
    if (valor) {
      window.localStorage.setItem(chave, valor)
    } else {
      window.localStorage.removeItem(chave)
    }
  } catch {
    // Mantém o fluxo operacional caso o navegador bloqueie o localStorage.
  }
}

function normalizarPerfil(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function obterPerfilUsuario(user) {
  return normalizarPerfil(
    obterPerfilEfetivo(user)
  )
}

function podeEscolherOrigem(perfil) {
  return (
    perfil.includes('ADMINISTRADOR') ||
    perfil.includes('COMANDANTE')
  )
}

function origemInicialPorPerfil(perfil) {
  if (
    perfil.includes('ENCARREGADO') ||
    perfil.includes('AUXILIAR') ||
    perfil.includes('SVDD')
  ) {
    return ORIGEM_SVDD
  }

  return ORIGEM_P4
}

function obterNomeUsuario(user) {
  return (
    user?.nome ||
    user?.nome_guerra ||
    user?.nome_completo ||
    user?.email ||
    'USUÁRIO SIGMO'
  )
}

function montarDataHoraIso(data, hora) {
  if (!data || !hora) return null

  const valor = new Date(`${data}T${hora}`)

  if (Number.isNaN(valor.getTime())) {
    return null
  }

  return valor.toISOString()
}

function formatarDataInput(data) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function formatarHoraInput(data) {
  const hora = String(data.getHours()).padStart(2, '0')
  const minuto = String(data.getMinutes()).padStart(2, '0')
  return `${hora}:${minuto}`
}

function obterLimiteCautela() {
  return new Date(Date.now() + DURACAO_MAXIMA_CAUTELA_MS)
}

function aplicarFimTurnoPadrao(setData, setHora) {
  const limite = obterLimiteCautela()
  setData(formatarDataInput(limite))
  setHora(formatarHoraInput(limite))
}

function criarChaveMaterial(material) {
  return [
    material?.tabela_origem || 'patrimonio',
    material?.id
  ].join(':')
}

function tiposPermitidos(origem) {
  if (origem === ORIGEM_SVDD) {
    return [
      { value: TIPO_CAUTELA, label: 'CAUTELA' },
      { value: TIPO_TRANSFERENCIA_P4, label: 'TRANSFERÊNCIA PARA O P4' }
    ]
  }

  return [
    { value: TIPO_CAUTELA, label: 'CAUTELA' },
    { value: TIPO_TRANSFERENCIA, label: 'TRANSFERÊNCIA' },
    { value: TIPO_ENTREGA, label: 'ENTREGA / CARGA PERMANENTE' }
  ]
}

function destinoAutomatico(tipo, origem) {
  if (tipo === TIPO_CAUTELA) return DESTINO_CAUTELA
  if (tipo === TIPO_TRANSFERENCIA_P4) return DESTINO_P4
  if (tipo === TIPO_ENTREGA) return 'CARGA PERMANENTE'
  if (tipo === TIPO_TRANSFERENCIA && origem === ORIGEM_P4) return DESTINO_SVDD
  return ''
}


async function resolverPatrimonioIdItem(item) {
  if (item?.patrimonio_id) {
    return item.patrimonio_id
  }

  if (!item?.controla_quantidade || !item?.tonfa_id) {
    return null
  }

  const { data, error } = await supabase
    .from('sigmo_patrimonios')
    .select('id')
    .eq('tipo', 'tonfa')
    .eq('referencia_id', item.tonfa_id)
    .eq('ativo', true)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data?.id) {
    throw new Error(
      `O registro patrimonial de ${item.descricao || item.categoria || 'Tonfa/Cassetete'} não foi encontrado.`
    )
  }

  return data.id
}

async function prepararItensPendentes(itens) {
  const preparados = []

  for (const item of itens) {
    const patrimonioId =
      await resolverPatrimonioIdItem(item)

    if (!patrimonioId) {
      throw new Error(
        `Não foi possível identificar o patrimônio de ${item.descricao || item.patrimonio || 'um dos itens selecionados'}.`
      )
    }

    preparados.push({
      ...item,
      patrimonio_id: patrimonioId,
      quantidade: Number(item.quantidade || 1),
      observacao: item.controla_quantidade
        ? JSON.stringify({
            tipo_registro: 'TONFA_QUANTIDADE',
            tonfa_id: item.tonfa_id,
            categoria: item.categoria,
            quantidade: Number(item.quantidade || 1)
          })
        : item.observacao || ''
    })
  }

  return preparados
}

export default function PagarMaterial({
  user,
  onVoltar = null,
  onConcluido = null
}) {
  const perfil = useMemo(() => obterPerfilUsuario(user), [user])
  const origemSelecionavel = podeEscolherOrigem(perfil)

  const [reRecebedor, setReRecebedor] = useState('')
  const [policialRecebedor, setPolicialRecebedor] = useState(null)
  const [localOrigem, setLocalOrigem] = useState(
    origemInicialPorPerfil(perfil)
  )
  const [tipoMovimentacao, setTipoMovimentacao] = useState(TIPO_CAUTELA)
  const [localDestino, setLocalDestino] = useState(DESTINO_CAUTELA)
  const [observacoes, setObservacoes] = useState('')
  const [fimTurnoData, setFimTurnoData] = useState(() => {
    const limite = obterLimiteCautela()
    return formatarDataInput(limite)
  })
  const [fimTurnoHora, setFimTurnoHora] = useState(() => {
    const limite = obterLimiteCautela()
    return formatarHoraInput(limite)
  })
  const [previsaoEntregaData, setPrevisaoEntregaData] = useState(
    () => lerPreferenciaLocal(CHAVE_PREVISAO_ENTREGA_DATA)
  )
  const [previsaoEntregaHora, setPrevisaoEntregaHora] = useState(
    () => lerPreferenciaLocal(CHAVE_PREVISAO_ENTREGA_HORA)
  )
  const [itensSelecionados, setItensSelecionados] = useState([])
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const [erroConfirmacao, setErroConfirmacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [scannerAberto, setScannerAberto] = useState(false)
  const [buscandoQrCode, setBuscandoQrCode] = useState(false)
  const [atualizarPesquisaEm, setAtualizarPesquisaEm] = useState(0)

  const opcoesTipo = useMemo(
    () => {
      if (perfil.includes('AUXILIAR')) {
        return [
          {
            value: TIPO_CAUTELA,
            label: 'CAUTELA'
          }
        ]
      }

      return tiposPermitidos(
        localOrigem
      )
    },
    [localOrigem, perfil]
  )

  const exigePolicial = tipoMovimentacao !== TIPO_TRANSFERENCIA_P4

  const ehCautela = tipoMovimentacao === TIPO_CAUTELA

  const ehTransferencia =
    tipoMovimentacao === TIPO_TRANSFERENCIA ||
    tipoMovimentacao === TIPO_TRANSFERENCIA_P4

  useEffect(() => {
    const origemPerfil = origemInicialPorPerfil(perfil)
    if (!origemSelecionavel) setLocalOrigem(origemPerfil)
  }, [perfil, origemSelecionavel])

  useEffect(() => {
    salvarPreferenciaLocal(
      CHAVE_PREVISAO_ENTREGA_DATA,
      previsaoEntregaData
    )
  }, [previsaoEntregaData])

  useEffect(() => {
    salvarPreferenciaLocal(
      CHAVE_PREVISAO_ENTREGA_HORA,
      previsaoEntregaHora
    )
  }, [previsaoEntregaHora])

  useEffect(() => {
    const tipoAindaPermitido = opcoesTipo.some(
      (opcao) => opcao.value === tipoMovimentacao
    )

    const proximoTipo = tipoAindaPermitido
      ? tipoMovimentacao
      : opcoesTipo[0]?.value || TIPO_CAUTELA

    if (proximoTipo !== tipoMovimentacao) {
      setTipoMovimentacao(proximoTipo)
      return
    }

    setLocalDestino(destinoAutomatico(proximoTipo, localOrigem))
    setItensSelecionados([])
    setErro('')
    setMensagem('')
  }, [localOrigem, opcoesTipo, tipoMovimentacao])

  useEffect(() => {
    setLocalDestino(destinoAutomatico(tipoMovimentacao, localOrigem))
    setItensSelecionados([])
    setErro('')
    setMensagem('')
  }, [tipoMovimentacao])

  function adicionarMaterial(material) {
    if (!material?.disponivel) {
      setErro('Este material não está disponível na origem selecionada.')
      return
    }

    const chave = criarChaveMaterial(material)
    const jaSelecionado = itensSelecionados.some(
      (item) => criarChaveMaterial(item) === chave
    )

    if (jaSelecionado) {
      setErro('Este material já foi adicionado.')
      return
    }

    setItensSelecionados((listaAtual) => [
      ...listaAtual,
      {
        ...material,
        patrimonio_id: material.controla_quantidade
          ? null
          : material.patrimonio_id || material.id,
        quantidade: 1
      }
    ])

    setErro('')
    setMensagem('')
  }

  function alterarQuantidade(materialId, quantidade) {
    setItensSelecionados((listaAtual) =>
      listaAtual.map((item) => {
        if (item.id !== materialId || !item.controla_quantidade) return item

        const maxima = Number(item.quantidade_maxima || item.quantidade_disponivel || 1)
        const novaQuantidade = Math.max(1, Math.min(Number(quantidade) || 1, maxima))

        return { ...item, quantidade: novaQuantidade }
      })
    )
  }

  function removerMaterial(materialId) {
    setItensSelecionados((listaAtual) =>
      listaAtual.filter((item) => item.id !== materialId)
    )
  }

  function limparMovimentacao() {
    setReRecebedor('')
    setPolicialRecebedor(null)
    setTipoMovimentacao(TIPO_CAUTELA)
    setLocalDestino(DESTINO_CAUTELA)
    setObservacoes('')
    setItensSelecionados([])
    aplicarFimTurnoPadrao(setFimTurnoData, setFimTurnoHora)
    setMensagem('')
    setErro('')
  }

  async function handleQrRead(valor) {
    try {
      setScannerAberto(false)
      setBuscandoQrCode(true)
      setErro('')
      setMensagem('')

      const material = await buscarPatrimonioPorQrCode(valor, {
        origemLocal: localOrigem
      })

      if (!material) {
        setErro(`Nenhum material encontrado para o QR Code: ${valor}`)
        return
      }

      if (!material.disponivel) {
        setErro(`${material.patrimonio} foi localizado, mas não está disponível.`)
        return
      }

      adicionarMaterial(material)
      setMensagem(`${material.patrimonio} adicionado pelo QR Code.`)
    } catch (error) {
      console.error(error)
      setErro('Não foi possível consultar o QR Code.')
    } finally {
      setBuscandoQrCode(false)
    }
  }

  function mostrarErroConfirmacao(mensagemErro) {
    const texto =
      mensagemErro ||
      'Não foi possível confirmar a movimentação.'

    setErro(texto)
    setErroConfirmacao(texto)
  }

  async function confirmarEntrega() {
    if (exigePolicial && !policialRecebedor) {
      mostrarErroConfirmacao('Informe um RE válido.')
      return
    }

    if (ehCautela && (!fimTurnoData || !fimTurnoHora)) {
      mostrarErroConfirmacao('Informe a data e a hora do término do turno de serviço.')
      return
    }

    if (ehTransferencia && (!previsaoEntregaData || !previsaoEntregaHora)) {
      mostrarErroConfirmacao('Informe a data e a hora da previsão de entrega.')
      return
    }

    if (itensSelecionados.length === 0) {
      mostrarErroConfirmacao('Adicione pelo menos um material.')
      return
    }

    const possuiArma = itensSelecionados.some(
      (item) =>
        String(item?.modulo || '').trim().toUpperCase() === 'ARMA' ||
        String(item?.tabela_origem || '').trim().toLowerCase() === 'sigmo_armas'
    )

    if (
      possuiArma &&
      tipoMovimentacao === TIPO_ENTREGA &&
      policialRecebedor?.arma_somente_cautela
    ) {
      mostrarErroConfirmacao(
        'Este policial possui restrição de armamento: somente cautela. Não é permitido entregar arma como carga permanente.'
      )
      return
    }

    if (
      possuiArma &&
      tipoMovimentacao === TIPO_CAUTELA &&
      policialRecebedor?.arma_sem_cautela
    ) {
      mostrarErroConfirmacao(
        'Este policial possui restrição de armamento: sem cautela de arma. Não é permitido cautelar arma para este policial.'
      )
      return
    }

    const fimTurnoServico = ehCautela
      ? montarDataHoraIso(fimTurnoData, fimTurnoHora)
      : null

    const previsaoEntrega = ehTransferencia
      ? montarDataHoraIso(previsaoEntregaData, previsaoEntregaHora)
      : null

    if (ehCautela && !fimTurnoServico) {
      mostrarErroConfirmacao('A data/hora do término do turno é inválida.')
      return
    }

    if (ehCautela) {
      const fimTurnoMs = new Date(fimTurnoServico).getTime()
      const agoraMs = Date.now()
      const limiteMs = agoraMs + DURACAO_MAXIMA_CAUTELA_MS

      if (fimTurnoMs <= agoraMs) {
        mostrarErroConfirmacao('O término da cautela deve ser posterior ao horário atual.')
        return
      }

      if (fimTurnoMs > limiteMs) {
        mostrarErroConfirmacao(
          'A cautela inicial não pode ultrapassar 12h30. Se necessário, o SVDD deverá estender o turno posteriormente.'
        )
        return
      }
    }

    if (ehTransferencia && !previsaoEntrega) {
      mostrarErroConfirmacao('A data/hora da previsão de entrega é inválida.')
      return
    }

    try {
      setSalvando(true)
      setErroConfirmacao('')
      setMensagem('')

      const movimentacaoParaUsuario =
        tipoMovimentacao === TIPO_CAUTELA ||
        tipoMovimentacao === TIPO_ENTREGA

      if (movimentacaoParaUsuario) {
        const itensPendentes =
          await prepararItensPendentes(
            itensSelecionados
          )

        await criarMovimentacaoCompleta({
          tipo: tipoMovimentacao,
          origemLocal: localOrigem,
          destinoLocal: localDestino,
          solicitante: user,
          recebedor: policialRecebedor,
          observacoes,
          fimTurnoServico,
          previsaoEntrega,
          itens: itensPendentes,
          aprovarAutomaticamente: false
        })

        setMensagem(
          'Carrinho pago com sucesso. Os materiais permanecerão na origem até o usuário confirmar o recebimento.'
        )
      } else {
        const itensQuantidade =
          itensSelecionados.filter(
            (item) => item.controla_quantidade
          )

        const itensIndividuais =
          itensSelecionados.filter(
            (item) => !item.controla_quantidade
          )

        for (const item of itensQuantidade) {
          const quantidade =
            Number(item.quantidade || 1)

          if (
            tipoMovimentacao ===
            TIPO_TRANSFERENCIA_P4
          ) {
            await devolverTonfaDoSvddAoP4({
              tonfaId: item.tonfa_id,
              quantidade,
              observacoes,
              user
            })
          } else if (
            tipoMovimentacao ===
            TIPO_TRANSFERENCIA
          ) {
            await distribuirTonfaParaSvdd({
              tonfaId: item.tonfa_id,
              quantidade,
              observacoes,
              user
            })
          }
        }

        if (itensIndividuais.length > 0) {
          await criarMovimentacaoCompleta({
            tipo: tipoMovimentacao,
            origemLocal: localOrigem,
            destinoLocal: localDestino,
            solicitante: user,
            recebedor: exigePolicial
              ? policialRecebedor
              : null,
            observacoes,
            fimTurnoServico,
            previsaoEntrega,
            itens: itensIndividuais,
            aprovarAutomaticamente: true
          })
        }

        setMensagem(
          'Movimentação registrada com sucesso.'
        )
      }

      setReRecebedor('')
      setPolicialRecebedor(null)
      setItensSelecionados([])
      setObservacoes('')
      aplicarFimTurnoPadrao(setFimTurnoData, setFimTurnoHora)
      setAtualizarPesquisaEm(Date.now())

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      })

    } catch (error) {
      console.error(error)

      mostrarErroConfirmacao(
        error?.message ||
        'Não foi possível registrar a movimentação.'
      )
      return
    } finally {
      setSalvando(false)
    }

    try {
      onConcluido?.()
    } catch (callbackError) {
      console.warn(
        'Movimentação concluída, mas não foi possível atualizar a tela automaticamente:',
        callbackError
      )
    }
  }

  return (
    <main className="pagar-material-page">
      <header className="pagar-material-header">
        <div>
          <span className="pagar-material-kicker">SIGMO • MOVIMENTAÇÃO</span>
          <h1>Pagar Material</h1>
          <p>Registre cautelas e transferências a partir do local sob responsabilidade do operador.</p>
        </div>

        <div className="pagar-material-operador">
          <span>Operador</span>
          <strong>{obterNomeUsuario(user)}</strong>
        </div>
      </header>

      {typeof onVoltar === 'function' && (
        <div className="pagar-material-top-actions">
          <button type="button" className="pagar-material-refresh" onClick={onVoltar} disabled={salvando}>
            Voltar
          </button>
        </div>
      )}

      {buscandoQrCode && <div className="pagar-material-feedback">Consultando QR Code...</div>}
      {erro && <div className="pagar-material-feedback pagar-material-feedback-error">{erro}</div>}
      {mensagem && <div className="pagar-material-feedback pagar-material-feedback-success">{mensagem}</div>}

      <section className="pagar-material-layout">
        <div className="pagar-material-main">
          <section className="pagar-material-card">
            <div className="pagar-material-card-header">
              <div>
                <span>ETAPA 1</span>
                <h2>{exigePolicial ? 'Identificar recebedor' : 'Configurar movimentação'}</h2>
              </div>
              <span className="pagar-material-status">RASCUNHO</span>
            </div>

            {exigePolicial && (
              <RecebedorCard
                re={reRecebedor}
                onChangeRE={setReRecebedor}
                onSelecionado={setPolicialRecebedor}
              />
            )}

            <div className="pagar-material-form-grid pagar-material-form-grid-spaced">
              <label>
                Tipo de movimentação
                <select value={tipoMovimentacao} onChange={(event) => setTipoMovimentacao(event.target.value.toUpperCase())}>
                  {opcoesTipo.map((opcao) => (
                    <option key={opcao.value} value={opcao.value}>{opcao.label}</option>
                  ))}
                </select>
              </label>

              <label>
                Local de origem
                {origemSelecionavel ? (
                  <select value={localOrigem} onChange={(event) => setLocalOrigem(event.target.value.toUpperCase())}>
                    <option value={ORIGEM_P4}>{ORIGEM_P4}</option>
                    <option value={ORIGEM_SVDD}>{ORIGEM_SVDD}</option>
                  </select>
                ) : (
                  <input value={localOrigem} readOnly />
                )}
              </label>

              <label className="pagar-material-hidden-field" aria-hidden="true">
                Local de destino
                <input value={localDestino} readOnly tabIndex={-1} />
              </label>

              {ehCautela && (
                <>
                  <label>
                    Término do turno de serviço
                    <input
                      type="date"
                      value={fimTurnoData}
                      onChange={(event) => setFimTurnoData(event.target.value)}
                    />
                  </label>

                  <label>
                    Hora de devolução
                    <input
                      type="time"
                      value={fimTurnoHora}
                      onChange={(event) => setFimTurnoHora(event.target.value)}
                    />
                    <small>
                      Prazo inicial máximo: 12h30. Pode reduzir, mas não ultrapassar esse limite.
                    </small>
                  </label>
                </>
              )}

              {ehTransferencia && (
                <>
                  <label>
                    Previsão de entrega
                    <input
                      type="date"
                      value={previsaoEntregaData}
                      onChange={(event) => setPrevisaoEntregaData(event.target.value)}
                    />
                  </label>

                  <label>
                    Hora prevista
                    <input
                      type="time"
                      value={previsaoEntregaHora}
                      onChange={(event) => setPrevisaoEntregaHora(event.target.value)}
                    />
                  </label>
                </>
              )}

              <label className="pagar-material-field-full">
                Observações
                <textarea
                  value={observacoes}
                  onChange={(event) => setObservacoes(event.target.value.toUpperCase())}
                  placeholder="Informações adicionais sobre a movimentação"
                />
              </label>
            </div>
          </section>

          <PesquisaMaterial
            origemLocal={localOrigem}
            itensSelecionados={itensSelecionados}
            onAdicionar={adicionarMaterial}
            onAbrirQrCode={() => setScannerAberto(true)}
            atualizarEm={atualizarPesquisaEm}
          />
        </div>

        <ResumoEntrega
          policial={policialRecebedor}
          re={reRecebedor}
          origem={localOrigem}
          destino={localDestino}
          itens={itensSelecionados}
          salvando={salvando}
          onRemover={removerMaterial}
          onQuantidadeChange={alterarQuantidade}
          onLimpar={limparMovimentacao}
          onConfirmar={confirmarEntrega}
        />
      </section>

      {erroConfirmacao && (
        <div
          role="presentation"
          onClick={() => setErroConfirmacao('')}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10020,
            display: 'grid',
            placeItems: 'center',
            padding: '24px',
            background: 'rgba(15,23,42,.58)',
            backdropFilter: 'blur(2px)'
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="pagar-material-erro-titulo"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(520px, 100%)',
              overflow: 'hidden',
              border: '1px solid #fecaca',
              borderRadius: '18px',
              background: '#ffffff',
              boxShadow: '0 28px 70px rgba(15,23,42,.28)'
            }}
          >
            <div
              style={{
                padding: '22px 24px',
                borderBottom: '1px solid #fee2e2',
                background: '#fff7f7'
              }}
            >
              <span
                style={{
                  display: 'block',
                  marginBottom: '5px',
                  color: '#dc2626',
                  fontSize: '12px',
                  fontWeight: 900,
                  letterSpacing: '.1em'
                }}
              >
                MOVIMENTAÇÃO NÃO CONFIRMADA
              </span>

              <h2
                id="pagar-material-erro-titulo"
                style={{
                  margin: 0,
                  color: '#7f1d1d',
                  fontSize: '20px'
                }}
              >
                Verifique os dados da cautela
              </h2>
            </div>

            <div
              style={{
                padding: '22px 24px',
                color: '#991b1b',
                fontWeight: 700,
                lineHeight: 1.55
              }}
            >
              {erroConfirmacao}
            </div>

            <footer
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                padding: '0 24px 22px'
              }}
            >
              <button
                type="button"
                autoFocus
                onClick={() => setErroConfirmacao('')}
                style={{
                  minWidth: '100px',
                  minHeight: '42px',
                  padding: '9px 16px',
                  border: 0,
                  borderRadius: '10px',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontWeight: 850,
                  cursor: 'pointer'
                }}
              >
                Entendi
              </button>
            </footer>
          </section>
        </div>
      )}

      <QrScanner open={scannerAberto} onRead={handleQrRead} onClose={() => setScannerAberto(false)} />
    </main>
  )
}
