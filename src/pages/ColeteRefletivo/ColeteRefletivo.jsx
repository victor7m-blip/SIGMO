import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  cancelarTransferenciaColeteRefletivo,
  devolverColeteRefletivoAoP4,
  listarEstoqueColetesRefletivos,
  listarTransferenciasPendentesColetesRefletivos,
  receberTransferenciaColeteRefletivo,
  registrarEntradaColeteRefletivoP4,
  TAMANHOS,
  transferirColeteRefletivoParaSvdd
} from '../../services/coletesRefletivosService'

import '../ColeteBalistico/ColeteBalistico.css'
import '../Municoes/Municoes.css'

function numero(valor) {
  const convertido =
    Number(valor)

  return Number.isFinite(
    convertido
  )
    ? convertido
    : 0
}


function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

function dataHora(valor) {
  if (!valor) return '—'

  const data = new Date(valor)

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return '—'
  }

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      dateStyle: 'short',
      timeStyle: 'short'
    }
  ).format(data)
}

function CardResumo({
  titulo,
  valor,
  subtitulo
}) {
  return (
    <article className="municoes-resumo-card">
      <span>{titulo}</span>

      <strong>
        {numero(valor).toLocaleString(
          'pt-BR'
        )}
      </strong>

      {subtitulo && (
        <small>{subtitulo}</small>
      )}
    </article>
  )
}

function CardDistribuicao({
  titulo,
  itens,
  subtitulo = ''
}) {
  const total =
    (itens || []).reduce(
      (soma, item) =>
        soma +
        numero(
          item?.quantidade
        ),
      0
    )

  return (
    <article className="municoes-resumo-card">
      <span>{titulo}</span>

      <strong>
        {total.toLocaleString(
          'pt-BR'
        )}
      </strong>

      {subtitulo && (
        <small>{subtitulo}</small>
      )}

      <div
        style={{
          width: '100%',
          display: 'grid',
          gap: '5px',
          marginTop: '12px',
          paddingTop: '10px',
          borderTop:
            '1px solid #e5eaf1'
        }}
      >
        {(itens || []).length === 0 ? (
          <div
            style={{
              color: '#98a2b3',
              fontSize: '0.72rem'
            }}
          >
            Sem saldo
          </div>
        ) : (
          itens.map(
            (item) => (
              <div
                key={`${titulo}-${item.tamanho}`}
                style={{
                  display: 'flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'space-between',
                  gap: '10px',
                  color: '#475467',
                  fontSize: '0.72rem'
                }}
              >
                <span>
                  {item.tamanho}
                </span>

                <strong
                  style={{
                    color: '#172033',
                    fontSize:
                      '0.76rem'
                  }}
                >
                  {numero(
                    item.quantidade
                  ).toLocaleString(
                    'pt-BR'
                  )}
                </strong>
              </div>
            )
          )
        )}
      </div>
    </article>
  )
}

function CardTamanho({
  item,
  selecionado,
  onSelecionar,
  visaoSvdd = false
}) {
  const total =
    numero(
      item?.quantidade_total
    )

  const p4 =
    numero(
      item?.quantidade_p4
    )

  const svdd =
    numero(
      item?.quantidade_svdd
    )

  const emServico =
    numero(
      item?.quantidade_em_servico
    )

  const manutencao =
    numero(
      item?.quantidade_manutencao
    )

  return (
    <button
      type="button"
      className="coletes-resumo-card"
      onClick={onSelecionar}
      style={{
        width: '100%',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        borderColor: selecionado
          ? '#1d5a9e'
          : undefined,
        boxShadow: selecionado
          ? '0 0 0 2px rgba(29, 90, 158, .14), 0 8px 20px rgba(15, 23, 42, .08)'
          : undefined
      }}
    >
      <span>
        TAMANHO
      </span>

      <strong>
        {item?.tamanho || '—'}
      </strong>

      <small>
        {visaoSvdd
          ? `${svdd} disponível no Cofre do SVDD`
          : `${total} no total`}
      </small>

      <div
        style={{
          display: 'grid',
          gap: '5px',
          marginTop: '12px',
          color: '#475467',
          fontSize: '0.74rem',
          fontWeight: 700
        }}
      >
        {!visaoSvdd && (
          <span>
            P4: {p4}
          </span>
        )}

        <span>
          {visaoSvdd
            ? `Cofre do SVDD: ${svdd}`
            : `SVDD: ${svdd}`}
        </span>

        <span>
          {visaoSvdd
            ? `Cautelas ativas: ${emServico}`
            : `Em serviço: ${emServico}`}
        </span>

        <span>
          Manutenção: {manutencao}
        </span>
      </div>
    </button>
  )
}

function GrupoOperacao({
  icone,
  titulo,
  descricao,
  children
}) {
  return (
    <section className="coletes-operation-group">
      <div className="coletes-operation-group-header">
        <span className="coletes-operation-group-icon">
          {icone}
        </span>

        <div>
          <h3>
            {titulo}
          </h3>

          <p>
            {descricao}
          </p>
        </div>
      </div>

      <div className="coletes-operation-actions">
        {children}
      </div>
    </section>
  )
}


function ModalEntradaMaterial({
  tamanhoInicial,
  user,
  onFechar,
  onConcluido
}) {
  const [
    tamanho,
    setTamanho
  ] = useState(
    tamanhoInicial &&
    tamanhoInicial !== 'TODOS'
      ? tamanhoInicial
      : 'P'
  )

  const [
    quantidade,
    setQuantidade
  ] = useState(1)

  const [
    observacoes,
    setObservacoes
  ] = useState('')

  const [
    salvando,
    setSalvando
  ] = useState(false)

  const [
    erro,
    setErro
  ] = useState('')

  async function confirmar() {
    const qtd =
      Number(quantidade)

    if (
      !Number.isInteger(qtd) ||
      qtd <= 0
    ) {
      setErro(
        'Informe uma quantidade inteira maior que zero.'
      )
      return
    }

    try {
      setSalvando(true)
      setErro('')

      await registrarEntradaColeteRefletivoP4({
        tamanho,
        quantidade: qtd,
        observacoes,
        user
      })

      await onConcluido?.({
        tamanho,
        quantidade: qtd
      })
    } catch (error) {
      console.error(
        'Erro ao registrar entrada de Colete Refletivo:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível registrar a entrada de material.'
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div
      role="presentation"
      onClick={
        salvando
          ? undefined
          : onFechar
      }
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10040,
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background:
          'rgba(3, 15, 32, .72)'
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Entrada de Colete Refletivo"
        onClick={(event) =>
          event.stopPropagation()
        }
        style={{
          width:
            'min(560px, 100%)',
          borderRadius: '20px',
          border:
            '1px solid rgba(30, 92, 153, .28)',
          background: '#ffffff',
          boxShadow:
            '0 28px 70px rgba(0, 0, 0, .30)',
          overflow: 'hidden'
        }}
      >
        <header
          style={{
            padding: '22px 24px',
            color: '#ffffff',
            background:
              'linear-gradient(135deg, #071d39 0%, #0b315a 100%)'
          }}
        >
          <span
            style={{
              display: 'block',
              marginBottom: '5px',
              color: '#8fc8ff',
              fontSize: '12px',
              fontWeight: 900,
              letterSpacing: '.1em'
            }}
          >
            ENTRADA DE ESTOQUE
          </span>

          <h2
            style={{
              margin: 0,
              fontSize: '22px'
            }}
          >
            Receber Colete Refletivo no P4
          </h2>

          <p
            style={{
              margin: '7px 0 0',
              opacity: .88,
              lineHeight: 1.45
            }}
          >
            Informe o tamanho e a quantidade recebida.
          </p>
        </header>

        <div
          style={{
            display: 'grid',
            gap: '16px',
            padding: '22px 24px'
          }}
        >
          <label>
            <span
              style={{
                display: 'block',
                marginBottom: '7px',
                color: '#344054',
                fontSize: '12px',
                fontWeight: 850,
                textTransform: 'uppercase'
              }}
            >
              Tamanho
            </span>

            <select
              value={tamanho}
              onChange={(event) => {
                setTamanho(
                  event.target.value
                )
                setErro('')
              }}
              disabled={salvando}
              style={{
                width: '100%',
                minHeight: '44px',
                border:
                  '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '0 12px',
                background: '#ffffff',
                font: 'inherit',
                fontWeight: 750
              }}
            >
              {TAMANHOS.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            <span
              style={{
                display: 'block',
                marginBottom: '7px',
                color: '#344054',
                fontSize: '12px',
                fontWeight: 850,
                textTransform: 'uppercase'
              }}
            >
              Quantidade
            </span>

            <input
              type="number"
              min="1"
              step="1"
              value={quantidade}
              onChange={(event) =>
                setQuantidade(
                  event.target.value
                )
              }
              disabled={salvando}
              style={{
                width: '100%',
                minHeight: '44px',
                boxSizing: 'border-box',
                border:
                  '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '0 12px',
                font: 'inherit',
                fontWeight: 750
              }}
            />
          </label>

          <label>
            <span
              style={{
                display: 'block',
                marginBottom: '7px',
                color: '#344054',
                fontSize: '12px',
                fontWeight: 850,
                textTransform: 'uppercase'
              }}
            >
              Observação
            </span>

            <textarea
              rows={3}
              maxLength={500}
              value={observacoes}
              onChange={(event) =>
                setObservacoes(
                  event.target.value
                    .toUpperCase()
                )
              }
              disabled={salvando}
              placeholder="Opcional"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                resize: 'vertical',
                border:
                  '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '11px 12px',
                font: 'inherit'
              }}
            />
          </label>

          {erro && (
            <div
              style={{
                padding: '11px 12px',
                borderRadius: '10px',
                border:
                  '1px solid #efb4b4',
                background: '#fff1f1',
                color: '#9f1c1c',
                fontWeight: 750
              }}
            >
              {erro}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '2px'
            }}
          >
            <button
              type="button"
              className="coletes-btn-secondary"
              onClick={onFechar}
              disabled={salvando}
            >
              Cancelar
            </button>

            <button
              type="button"
              className="coletes-btn-primary"
              onClick={confirmar}
              disabled={salvando}
            >
              {salvando
                ? 'Registrando...'
                : 'Confirmar entrada'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}


function ModalTransferencia({
  operacao,
  estoque,
  pendentes,
  tamanhoInicial,
  user,
  onFechar,
  onConcluido
}) {
  const [
    tamanho,
    setTamanho
  ] = useState(
    tamanhoInicial &&
    tamanhoInicial !== 'TODOS'
      ? tamanhoInicial
      : 'P'
  )

  const [
    quantidade,
    setQuantidade
  ] = useState(1)

  const [
    observacoes,
    setObservacoes
  ] = useState('')

  const [
    salvando,
    setSalvando
  ] = useState(false)

  const [
    erro,
    setErro
  ] = useState('')

  const itemSelecionado =
    estoque.find(
      (item) =>
        String(
          item?.tamanho || ''
        ).toUpperCase() ===
        tamanho
    )

  const origem =
    operacao === 'P4_SVDD'
      ? 'P4'
      : 'SVDD'

  const destino =
    operacao === 'P4_SVDD'
      ? 'SVDD'
      : 'P4'

  const disponivelBruto =
    operacao === 'P4_SVDD'
      ? numero(
          itemSelecionado
            ?.quantidade_p4
        )
      : numero(
          itemSelecionado
            ?.quantidade_svdd
        )

  const reservadoPendente =
    (pendentes || [])
      .filter(
        (item) =>
          normalizarTexto(
            item?.origem
          ) === origem &&
          normalizarTexto(
            item?.tamanho
          ) === tamanho &&
          item?.status ===
            'PENDENTE_RECEBIMENTO'
      )
      .reduce(
        (total, item) =>
          total +
          numero(
            item?.quantidade
          ),
        0
      )

  const disponivel =
    Math.max(
      0,
      disponivelBruto -
        reservadoPendente
    )

  async function confirmar() {
    const qtd =
      Number(quantidade)

    if (
      !Number.isInteger(qtd) ||
      qtd <= 0
    ) {
      setErro(
        'Informe uma quantidade inteira maior que zero.'
      )
      return
    }

    if (qtd > disponivel) {
      setErro(
        `Quantidade insuficiente em ${origem}. Disponível: ${disponivel}.`
      )
      return
    }

    try {
      setSalvando(true)
      setErro('')

      if (
        operacao === 'P4_SVDD'
      ) {
        await transferirColeteRefletivoParaSvdd({
          tamanho,
          quantidade: qtd,
          user,
          observacoes
        })
      } else {
        await devolverColeteRefletivoAoP4({
          tamanho,
          quantidade: qtd,
          user,
          observacoes
        })
      }

      await onConcluido?.({
        origem,
        destino,
        tamanho,
        quantidade: qtd
      })
    } catch (error) {
      console.error(
        'Erro ao movimentar colete refletivo:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível concluir a movimentação.'
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div
      role="presentation"
      onClick={
        salvando
          ? undefined
          : onFechar
      }
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10020,
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background:
          'rgba(3, 15, 32, .72)'
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Movimentar colete refletivo"
        onClick={(event) =>
          event.stopPropagation()
        }
        style={{
          width:
            'min(560px, 100%)',
          borderRadius: '20px',
          border:
            '1px solid rgba(30, 92, 153, .28)',
          background: '#ffffff',
          boxShadow:
            '0 28px 70px rgba(0, 0, 0, .30)',
          overflow: 'hidden'
        }}
      >
        <header
          style={{
            padding: '22px 24px',
            color: '#ffffff',
            background:
              'linear-gradient(135deg, #071d39 0%, #0b315a 100%)'
          }}
        >
          <span
            style={{
              display: 'block',
              marginBottom: '5px',
              color: '#8fc8ff',
              fontSize: '12px',
              fontWeight: 900,
              letterSpacing: '.1em'
            }}
          >
            MOVIMENTAÇÃO DE ESTOQUE
          </span>

          <h2
            style={{
              margin: 0,
              fontSize: '22px'
            }}
          >
            {origem} → {destino}
          </h2>

          <p
            style={{
              margin: '7px 0 0',
              opacity: .88,
              lineHeight: 1.45
            }}
          >
            Informe o tamanho e a quantidade de coletes refletivos.
          </p>
        </header>

        <div
          style={{
            display: 'grid',
            gap: '16px',
            padding: '22px 24px'
          }}
        >
          <label>
            <span
              style={{
                display: 'block',
                marginBottom: '7px',
                color: '#344054',
                fontSize: '12px',
                fontWeight: 850,
                textTransform: 'uppercase'
              }}
            >
              Tamanho
            </span>

            <select
              value={tamanho}
              onChange={(event) => {
                setTamanho(
                  event.target.value
                )
                setQuantidade(1)
                setErro('')
              }}
              disabled={salvando}
              style={{
                width: '100%',
                minHeight: '44px',
                border:
                  '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '0 12px',
                background: '#ffffff',
                font: 'inherit',
                fontWeight: 750
              }}
            >
              {TAMANHOS.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                )
              )}
            </select>
          </label>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'minmax(0, 1fr) minmax(0, 1fr)',
              gap: '12px'
            }}
          >
            <label>
              <span
                style={{
                  display: 'block',
                  marginBottom: '7px',
                  color: '#344054',
                  fontSize: '12px',
                  fontWeight: 850,
                  textTransform: 'uppercase'
                }}
              >
                Quantidade
              </span>

              <input
                type="number"
                min="1"
                max={disponivel}
                step="1"
                value={quantidade}
                onChange={(event) =>
                  setQuantidade(
                    event.target.value
                  )
                }
                disabled={
                  salvando ||
                  disponivel <= 0
                }
                style={{
                  width: '100%',
                  minHeight: '44px',
                  boxSizing: 'border-box',
                  border:
                    '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '0 12px',
                  font: 'inherit',
                  fontWeight: 750
                }}
              />
            </label>

            <div>
              <span
                style={{
                  display: 'block',
                  marginBottom: '7px',
                  color: '#344054',
                  fontSize: '12px',
                  fontWeight: 850,
                  textTransform: 'uppercase'
                }}
              >
                Disponível em {origem}
              </span>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  minHeight: '44px',
                  boxSizing: 'border-box',
                  border:
                    '1px solid #d8e1ec',
                  borderRadius: '10px',
                  padding: '0 12px',
                  background: '#f8fafc',
                  color: '#0b315a',
                  fontWeight: 900
                }}
              >
                {disponivel}
              </div>
            </div>
          </div>

          <label>
            <span
              style={{
                display: 'block',
                marginBottom: '7px',
                color: '#344054',
                fontSize: '12px',
                fontWeight: 850,
                textTransform: 'uppercase'
              }}
            >
              Observação
            </span>

            <textarea
              rows={3}
              maxLength={500}
              value={observacoes}
              onChange={(event) =>
                setObservacoes(
                  event.target.value
                    .toUpperCase()
                )
              }
              disabled={salvando}
              placeholder="Opcional"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                resize: 'vertical',
                border:
                  '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '11px 12px',
                font: 'inherit'
              }}
            />
          </label>

          {disponivel <= 0 && (
            <div
              style={{
                padding: '11px 12px',
                borderRadius: '10px',
                border:
                  '1px solid #f1d29a',
                background: '#fff8e8',
                color: '#7a4b00',
                fontWeight: 750
              }}
            >
              Não há unidades do tamanho {tamanho} disponíveis em {origem}.
            </div>
          )}

          {erro && (
            <div
              style={{
                padding: '11px 12px',
                borderRadius: '10px',
                border:
                  '1px solid #efb4b4',
                background: '#fff1f1',
                color: '#9f1c1c',
                fontWeight: 750
              }}
            >
              {erro}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '2px'
            }}
          >
            <button
              type="button"
              className="coletes-btn-secondary"
              onClick={onFechar}
              disabled={salvando}
            >
              Cancelar
            </button>

            <button
              type="button"
              className="coletes-btn-primary"
              onClick={confirmar}
              disabled={
                salvando ||
                disponivel <= 0
              }
            >
              {salvando
                ? 'Registrando...'
                : `Enviar ${origem} → ${destino}`}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}


function ModalPendencias({
  modo,
  itens,
  user,
  onFechar,
  onConcluido
}) {
  const [
    processandoId,
    setProcessandoId
  ] = useState(null)

  const [
    cancelarId,
    setCancelarId
  ] = useState(null)

  const [
    motivo,
    setMotivo
  ] = useState('')

  const [
    erro,
    setErro
  ] = useState('')

  const recebimento =
    modo === 'receber'

  async function confirmarRecebimento(
    item
  ) {
    try {
      setProcessandoId(
        item.id
      )
      setErro('')

      await receberTransferenciaColeteRefletivo({
        movimentacaoId:
          item.id,
        user
      })

      await onConcluido?.(
        `${item.quantidade} colete(s) tamanho ${item.tamanho} recebido(s) de ${item.origem}.`
      )
    } catch (error) {
      console.error(
        'Erro ao receber transferência de colete refletivo:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível confirmar o recebimento.'
      )
    } finally {
      setProcessandoId(null)
    }
  }

  async function confirmarCancelamento(
    item
  ) {
    const motivoNormalizado =
      String(
        motivo || ''
      )
        .trim()
        .toUpperCase()

    if (!motivoNormalizado) {
      setErro(
        'Informe o motivo do cancelamento.'
      )
      return
    }

    try {
      setProcessandoId(
        item.id
      )
      setErro('')

      await cancelarTransferenciaColeteRefletivo({
        movimentacaoId:
          item.id,
        user,
        motivo:
          motivoNormalizado
      })

      await onConcluido?.(
        `Movimentação de ${item.quantidade} colete(s) tamanho ${item.tamanho} cancelada.`
      )
    } catch (error) {
      console.error(
        'Erro ao cancelar transferência de colete refletivo:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível cancelar a movimentação.'
      )
    } finally {
      setProcessandoId(null)
    }
  }

  return (
    <div
      role="presentation"
      onClick={
        processandoId
          ? undefined
          : onFechar
      }
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10030,
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background:
          'rgba(3, 15, 32, .72)'
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={
          recebimento
            ? 'Receber coletes refletivos'
            : 'Cancelar movimentação de coletes refletivos'
        }
        onClick={(event) =>
          event.stopPropagation()
        }
        style={{
          width:
            'min(720px, 100%)',
          maxHeight:
            'min(78vh, 760px)',
          display: 'grid',
          gridTemplateRows:
            'auto minmax(0, 1fr)',
          borderRadius: '20px',
          border:
            '1px solid rgba(30, 92, 153, .28)',
          background: '#ffffff',
          boxShadow:
            '0 28px 70px rgba(0, 0, 0, .30)',
          overflow: 'hidden'
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems:
              'flex-start',
            justifyContent:
              'space-between',
            gap: '16px',
            padding: '22px 24px',
            color: '#ffffff',
            background:
              'linear-gradient(135deg, #071d39 0%, #0b315a 100%)'
          }}
        >
          <div>
            <span
              style={{
                display: 'block',
                marginBottom: '5px',
                color: '#8fc8ff',
                fontSize: '12px',
                fontWeight: 900,
                letterSpacing: '.1em'
              }}
            >
              {recebimento
                ? 'ENTRADAS E RECEBIMENTOS'
                : 'SAÍDAS E MOVIMENTAÇÕES'}
            </span>

            <h2
              style={{
                margin: 0,
                fontSize: '22px'
              }}
            >
              {recebimento
                ? 'Receber transferência'
                : 'Cancelar movimentação'}
            </h2>
          </div>

          <button
            type="button"
            className="coletes-btn-secondary"
            onClick={onFechar}
            disabled={
              Boolean(
                processandoId
              )
            }
          >
            Fechar
          </button>
        </header>

        <div
          style={{
            overflowY: 'auto',
            padding: '20px 24px'
          }}
        >
          {erro && (
            <div
              style={{
                marginBottom: '14px',
                padding: '11px 12px',
                borderRadius: '10px',
                border:
                  '1px solid #efb4b4',
                background: '#fff1f1',
                color: '#9f1c1c',
                fontWeight: 750
              }}
            >
              {erro}
            </div>
          )}

          {itens.length === 0 ? (
            <div className="coletes-empty">
              Nenhuma movimentação pendente.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: '12px'
              }}
            >
              {itens.map(
                (item) => {
                  const selecionado =
                    cancelarId ===
                    item.id

                  return (
                    <article
                      key={item.id}
                      style={{
                        border:
                          '1px solid #d8e1ec',
                        borderRadius:
                          '14px',
                        padding:
                          '15px 16px',
                        background:
                          '#f8fafc'
                      }}
                    >
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            'minmax(0, 1fr) auto',
                          alignItems:
                            'start',
                          gap: '16px'
                        }}
                      >
                        <div>
                          <span
                            style={{
                              display:
                                'block',
                              color:
                                '#667085',
                              fontSize:
                                '11px',
                              fontWeight:
                                850,
                              letterSpacing:
                                '.06em'
                            }}
                          >
                            {item.origem} → {item.destino}
                          </span>

                          <strong
                            style={{
                              display:
                                'block',
                              marginTop:
                                '5px',
                              color:
                                '#0b315a',
                              fontSize:
                                '17px'
                            }}
                          >
                            Tamanho {item.tamanho} • {item.quantidade} un.
                          </strong>

                          <small
                            style={{
                              display:
                                'block',
                              marginTop:
                                '5px',
                              color:
                                '#667085'
                            }}
                          >
                            Solicitado por {item.registrado_por_nome || 'Não informado'} • {dataHora(item.criado_em)}
                          </small>

                          {item.observacoes && (
                            <small
                              style={{
                                display:
                                  'block',
                                marginTop:
                                  '6px',
                                color:
                                  '#475467'
                              }}
                            >
                              Observação: {item.observacoes}
                            </small>
                          )}
                        </div>

                        {recebimento ? (
                          <button
                            type="button"
                            className="coletes-btn-primary"
                            onClick={() =>
                              confirmarRecebimento(
                                item
                              )
                            }
                            disabled={
                              Boolean(
                                processandoId
                              )
                            }
                          >
                            {processandoId ===
                            item.id
                              ? 'Recebendo...'
                              : 'Receber'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={
                              selecionado
                                ? 'coletes-btn-primary'
                                : 'coletes-btn-secondary'
                            }
                            onClick={() => {
                              setCancelarId(
                                selecionado
                                  ? null
                                  : item.id
                              )
                              setMotivo('')
                              setErro('')
                            }}
                            disabled={
                              Boolean(
                                processandoId
                              )
                            }
                          >
                            {selecionado
                              ? 'Fechar'
                              : 'Cancelar'}
                          </button>
                        )}
                      </div>

                      {!recebimento &&
                        selecionado && (
                          <div
                            style={{
                              display:
                                'grid',
                              gap: '10px',
                              marginTop:
                                '14px',
                              paddingTop:
                                '14px',
                              borderTop:
                                '1px solid #e4e7ec'
                            }}
                          >
                            <label>
                              <span
                                style={{
                                  display:
                                    'block',
                                  marginBottom:
                                    '6px',
                                  color:
                                    '#344054',
                                  fontSize:
                                    '12px',
                                  fontWeight:
                                    850,
                                  textTransform:
                                    'uppercase'
                                }}
                              >
                                Motivo do cancelamento
                              </span>

                              <textarea
                                rows={2}
                                maxLength={500}
                                value={motivo}
                                onChange={(event) =>
                                  setMotivo(
                                    event.target.value
                                      .toUpperCase()
                                  )
                                }
                                placeholder="Informe o motivo"
                                disabled={
                                  Boolean(
                                    processandoId
                                  )
                                }
                                style={{
                                  width:
                                    '100%',
                                  boxSizing:
                                    'border-box',
                                  resize:
                                    'vertical',
                                  border:
                                    '1px solid #cbd5e1',
                                  borderRadius:
                                    '10px',
                                  padding:
                                    '10px 12px',
                                  font:
                                    'inherit'
                                }}
                              />
                            </label>

                            <div
                              style={{
                                display:
                                  'flex',
                                justifyContent:
                                  'flex-end'
                              }}
                            >
                              <button
                                type="button"
                                className="coletes-btn-primary"
                                onClick={() =>
                                  confirmarCancelamento(
                                    item
                                  )
                                }
                                disabled={
                                  Boolean(
                                    processandoId
                                  )
                                }
                              >
                                {processandoId ===
                                item.id
                                  ? 'Cancelando...'
                                  : 'Confirmar cancelamento'}
                              </button>
                            </div>
                          </div>
                        )}
                    </article>
                  )
                }
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default function ColeteRefletivo({
  user,
  onVoltar
}) {
  const [
    estoque,
    setEstoque
  ] = useState([])

  const [
    pendentes,
    setPendentes
  ] = useState([])

  const [
    loading,
    setLoading
  ] = useState(true)

  const [
    erro,
    setErro
  ] = useState('')

  const [
    tamanhoSelecionado,
    setTamanhoSelecionado
  ] = useState('TODOS')

  const [
    operacaoEstoque,
    setOperacaoEstoque
  ] = useState(null)

  const [
    modalPendencias,
    setModalPendencias
  ] = useState(null)

  const [
    mensagem,
    setMensagem
  ] = useState('')

  const [
    modalEntrada,
    setModalEntrada
  ] = useState(false)

  const carregar =
    useCallback(
      async () => {
        try {
          setLoading(true)
          setErro('')

          const [
            dataEstoque,
            dataPendentes
          ] =
            await Promise.all([
              listarEstoqueColetesRefletivos(),
              listarTransferenciasPendentesColetesRefletivos()
            ])

          setEstoque(
            dataEstoque || []
          )

          setPendentes(
            dataPendentes || []
          )
        } catch (error) {
          console.error(
            'Erro ao carregar coletes refletivos:',
            error
          )

          setErro(
            error?.message ||
            'Não foi possível carregar o estoque de coletes refletivos.'
          )
        } finally {
          setLoading(false)
        }
      },
      []
    )

  useEffect(() => {
    carregar()
  }, [carregar])

  const resumo =
    useMemo(
      () =>
        estoque.reduce(
          (acumulado, item) => {
            acumulado.total +=
              numero(
                item?.quantidade_total
              )

            acumulado.p4 +=
              numero(
                item?.quantidade_p4
              )

            acumulado.svdd +=
              numero(
                item?.quantidade_svdd
              )

            acumulado.emServico +=
              numero(
                item?.quantidade_em_servico
              )

            return acumulado
          },
          {
            total: 0,
            p4: 0,
            svdd: 0,
            emServico: 0
          }
        ),
      [estoque]
    )

  const distribuicaoPorLocal =
    useMemo(
      () => {
        function porCampo(
          campo
        ) {
          return estoque
            .map(
              (item) => ({
                tamanho:
                  String(
                    item?.tamanho ||
                    ''
                  )
                    .trim()
                    .toUpperCase(),

                quantidade:
                  numero(
                    item?.[campo]
                  )
              })
            )
            .filter(
              (item) =>
                item.tamanho &&
                item.quantidade > 0
            )
        }

        return {
          p4:
            porCampo(
              'quantidade_p4'
            ),

          svdd:
            porCampo(
              'quantidade_svdd'
            ),

          cautela:
            porCampo(
              'quantidade_em_servico'
            ),

          /*
           * Estes destinos seguem o padrão visual do módulo Munições.
           * Manutenção já possui controle quantitativo próprio por tamanho.
           */
          cargaPermanente: [],

          manutencao:
            porCampo(
              'quantidade_manutencao'
            ),

          outrasCias: [],
          batalhao: [],
          baixados: [],
          outros: []
        }
      },
      [estoque]
    )

  const estoqueFiltrado =
    useMemo(
      () =>
        tamanhoSelecionado ===
        'TODOS'
          ? estoque
          : estoque.filter(
              (item) =>
                String(
                  item?.tamanho ||
                  ''
                ).toUpperCase() ===
                tamanhoSelecionado
            ),
      [
        estoque,
        tamanhoSelecionado
      ]
    )

  const perfilOperacional =
    normalizarTexto(
      user?.perfil_temporario_ativo
        ? (
            user?.perfil_temporario ||
            user?.perfil
          )
        : user?.perfil
    )

  const visaoSvdd =
    perfilOperacional ===
      'ENCARREGADO DO SVDD' ||
    perfilOperacional ===
      'AUXILIAR DO SVDD' ||
    perfilOperacional ===
      'AUXILIAR SVDD'

  const visaoP4 =
    perfilOperacional ===
      'P4' ||
    perfilOperacional ===
      'ADMINISTRADOR'

  const localOperacional =
    visaoSvdd
      ? 'SVDD'
      : visaoP4
      ? 'P4'
      : null

  const pendentesSaida =
    useMemo(
      () =>
        localOperacional
          ? pendentes.filter(
              (item) =>
                normalizarTexto(
                  item?.origem
                ) ===
                localOperacional
            )
          : [],
      [
        pendentes,
        localOperacional
      ]
    )

  const pendentesEntrada =
    useMemo(
      () =>
        localOperacional
          ? pendentes.filter(
              (item) =>
                normalizarTexto(
                  item?.destino
                ) ===
                localOperacional
            )
          : [],
      [
        pendentes,
        localOperacional
      ]
    )

  function abrirOperacaoEstoque(
    operacao
  ) {
    setMensagem('')
    setErro('')
    setOperacaoEstoque(
      operacao
    )
  }

  async function concluirOperacaoEstoque({
    origem,
    destino,
    tamanho,
    quantidade
  }) {
    setOperacaoEstoque(null)

    setMensagem(
      `Movimentação registrada: ${quantidade} colete(s) tamanho ${tamanho} de ${origem} para ${destino}. Aguardando recebimento em ${destino}.`
    )

    await carregar()
  }

  async function concluirEntrada({
    tamanho,
    quantidade
  }) {
    setModalEntrada(false)

    setMensagem(
      `Entrada registrada no P4: ${quantidade} colete(s) refletivo(s) tamanho ${tamanho}.`
    )

    await carregar()
  }

  async function concluirPendencia(
    mensagemConcluida
  ) {
    setModalPendencias(null)
    setMensagem(
      mensagemConcluida
    )
    await carregar()
  }

  return (
    <main className="coletes-page">
      <header className="coletes-header">
        <div>
          <span className="coletes-eyebrow">
            SIGMO • EQUIPAMENTO OPERACIONAL
          </span>

          <h1>
            Coletes Refletivos
          </h1>

          <p>
            Controle quantitativo de coletes refletivos por tamanho, sem patrimônio ou identificação individual.
          </p>
        </div>

        <div className="coletes-header-actions">
          {typeof onVoltar ===
            'function' && (
            <button
              type="button"
              className="coletes-btn-secondary"
              onClick={onVoltar}
            >
              ← Voltar
            </button>
          )}

          <button
            type="button"
            className="coletes-btn-secondary"
            onClick={carregar}
            disabled={loading}
          >
            {loading
              ? 'Atualizando...'
              : 'Atualizar'}
          </button>
        </div>
      </header>

      {erro && (
        <div className="coletes-alert coletes-alert-error">
          {erro}
        </div>
      )}

      {mensagem && (
        <div
          className="coletes-alert"
          style={{
            border:
              '1px solid #99d6b4',
            background: '#ecfdf3',
            color: '#136c3b'
          }}
        >
          {mensagem}
        </div>
      )}

      <section className="municoes-resumo-grid">
        {visaoP4 && (
          <CardResumo
            titulo="TOTAL CONTROLADO"
            valor={resumo.total}
            subtitulo="Cofre P4 + Cofre SVDD + cautelas"
          />
        )}

        {visaoP4 && (
          <CardDistribuicao
            titulo="COFRE DO P4"
            itens={
              distribuicaoPorLocal.p4
            }
            subtitulo="Saldo por tamanho"
          />
        )}

        <CardDistribuicao
          titulo="COFRE DO SVDD"
          itens={
            distribuicaoPorLocal.svdd
          }
          subtitulo="Saldo por tamanho"
        />

        {visaoP4 && (
          <CardDistribuicao
            titulo="CARGA PERMANENTE"
            itens={
              distribuicaoPorLocal.cargaPermanente
            }
            subtitulo="Saldo por tamanho"
          />
        )}

        <CardDistribuicao
          titulo="CAUTELAS ATIVAS"
          itens={
            distribuicaoPorLocal.cautela
          }
          subtitulo="Com policiais"
        />

        <CardDistribuicao
          titulo="MANUTENÇÃO"
          itens={
            distribuicaoPorLocal.manutencao
          }
          subtitulo="Material indisponível"
        />

        {visaoP4 && (
          <CardDistribuicao
            titulo="OUTRAS CIAS"
            itens={
              distribuicaoPorLocal.outrasCias
            }
            subtitulo="Outras companhias"
          />
        )}

        {visaoP4 && (
          <CardDistribuicao
            titulo="BATALHÃO"
            itens={
              distribuicaoPorLocal.batalhao
            }
            subtitulo="Carga do batalhão"
          />
        )}

        {visaoP4 && (
          <CardDistribuicao
            titulo="BAIXADOS"
            itens={
              distribuicaoPorLocal.baixados
            }
            subtitulo="Baixas registradas"
          />
        )}

        {visaoP4 && (
          <CardDistribuicao
            titulo="OUTROS"
            itens={
              distribuicaoPorLocal.outros
            }
            subtitulo="Outra unidade ou destino"
          />
        )}
      </section>

      <section className="coletes-chart-card">
        <div className="coletes-chart-header">
          <div>
            <span>
              Grade de tamanhos
            </span>

            <h2>
              Distribuição do estoque
            </h2>
          </div>

          <small
            style={{
              color: '#667085',
              fontWeight: 700
            }}
          >
            P • M • G • GG • XG
          </small>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '18px'
          }}
        >
          <button
            type="button"
            className={
              tamanhoSelecionado ===
              'TODOS'
                ? 'coletes-btn-primary coletes-btn-small'
                : 'coletes-btn-secondary coletes-btn-small'
            }
            onClick={() =>
              setTamanhoSelecionado(
                'TODOS'
              )
            }
          >
            Todos
          </button>

          {TAMANHOS.map(
            (tamanho) => (
              <button
                key={tamanho}
                type="button"
                className={
                  tamanhoSelecionado ===
                  tamanho
                    ? 'coletes-btn-primary coletes-btn-small'
                    : 'coletes-btn-secondary coletes-btn-small'
                }
                onClick={() =>
                  setTamanhoSelecionado(
                    tamanho
                  )
                }
              >
                {tamanho}
              </button>
            )
          )}
        </div>

        {loading ? (
          <div className="coletes-empty">
            Carregando estoque...
          </div>
        ) : estoque.length === 0 ? (
          <div className="coletes-empty">
            Nenhum tamanho cadastrado.
          </div>
        ) : (
          <div className="coletes-resumo-grid">
            {estoqueFiltrado.map(
              (item) => (
                <CardTamanho
                  key={item.id}
                  item={item}
                  selecionado={
                    tamanhoSelecionado ===
                    String(
                      item?.tamanho ||
                      ''
                    ).toUpperCase()
                  }
                  onSelecionar={() =>
                    setTamanhoSelecionado(
                      String(
                        item?.tamanho ||
                        ''
                      ).toUpperCase()
                    )
                  }
                  visaoSvdd={visaoSvdd}
                />
              )
            )}
          </div>
        )}
      </section>

      <section className="coletes-operations-section">
        <div className="coletes-operations-title">
          <div>
            <span>
              Operações
            </span>

            <h2>
              Movimentações por quantidade
            </h2>
          </div>
        </div>

        <div className="coletes-operation-groups">
          {localOperacional ? (
            <>
              <GrupoOperacao
                icone="📦"
                titulo="Saídas e movimentações"
                descricao={
                  visaoSvdd
                    ? 'Distribuição e devolução de coletes refletivos.'
                    : 'Distribuição e movimentação de coletes refletivos.'
                }
              >
                <button
                  type="button"
                  onClick={() =>
                    abrirOperacaoEstoque(
                      visaoSvdd
                        ? 'SVDD_P4'
                        : 'P4_SVDD'
                    )
                  }
                  disabled={
                    loading ||
                    (
                      visaoSvdd
                        ? resumo.svdd <= 0
                        : resumo.p4 <= 0
                    )
                  }
                >
                  <strong>
                    {visaoSvdd
                      ? 'Devolver ao P4'
                      : 'Transferir para SVDD'}
                  </strong>

                  <span>
                    {visaoSvdd
                      ? 'Selecionar tamanho e quantidade e devolver ao P4'
                      : 'Selecionar tamanho e quantidade e enviar ao SVDD'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setModalPendencias(
                      'cancelar'
                    )
                  }
                  disabled={loading}
                >
                  <strong>
                    Cancelar movimentação
                  </strong>

                  <span>
                    {pendentesSaida.length > 0
                      ? `${pendentesSaida.length} movimentação(ões) aguardando recebimento`
                      : 'Nenhuma movimentação pendente'}
                  </span>
                </button>
              </GrupoOperacao>

              <GrupoOperacao
                icone="📥"
                titulo="Entradas e recebimentos"
                descricao="Recebimento de coletes refletivos enviados pelo outro setor."
              >
                <button
                  type="button"
                  onClick={() =>
                    setModalPendencias(
                      'receber'
                    )
                  }
                  disabled={loading}
                >
                  <strong>
                    {visaoSvdd
                      ? 'Receber do P4'
                      : 'Receber do SVDD'}
                  </strong>

                  <span>
                    {pendentesEntrada.length > 0
                      ? `${pendentesEntrada.length} movimentação(ões) aguardando recebimento`
                      : 'Nenhuma entrada pendente'}
                  </span>
                </button>
              </GrupoOperacao>
            </>
          ) : (
            <GrupoOperacao
              icone="📦"
              titulo="Movimentações"
              descricao="Consulta do estoque de coletes refletivos."
            >
              <button
                type="button"
                disabled
              >
                <strong>
                  Consulta
                </strong>

                <span>
                  Perfil sem operação direta de estoque
                </span>
              </button>
            </GrupoOperacao>
          )}

          {visaoSvdd && (
            <GrupoOperacao
            icone="👮"
            titulo="Cautelas"
            descricao="Entrega temporária ao policial sem identificação individual do colete."
          >
            <button
              type="button"
              disabled
              title="Será integrado ao fluxo Pagar Material."
            >
              <strong>
                Pagar material
              </strong>

              <span>
                Selecionar tamanho e quantidade
              </span>
            </button>

            <button
              type="button"
              disabled
              title="Será integrado ao fluxo de devolução."
            >
              <strong>
                Receber devolução
              </strong>

              <span>
                Retornar quantidade ao estoque
              </span>
            </button>
          </GrupoOperacao>
          )}

          <GrupoOperacao
            icone="🗂️"
            titulo="Controle"
            descricao="Entrada, baixa, ajustes e histórico do estoque."
          >
            <button
              type="button"
              onClick={() => {
                setMensagem('')
                setErro('')
                setModalEntrada(true)
              }}
              disabled={
                loading ||
                !visaoP4
              }
              title={
                visaoP4
                  ? 'Registrar entrada de novos coletes refletivos no estoque do P4.'
                  : 'Operação restrita ao P4.'
              }
            >
              <strong>
                Entrada de material
              </strong>

              <span>
                Acrescentar quantidade por tamanho
              </span>
            </button>

            <button
              type="button"
              disabled
              title="Será habilitado na etapa de movimentações."
            >
              <strong>
                Baixa / ajuste
              </strong>

              <span>
                Registrar redução ou correção com histórico
              </span>
            </button>
          </GrupoOperacao>
        </div>
      </section>

      <section className="coletes-estoque-section">
        <div className="coletes-section-header">
          <div>
            <span className="coletes-eyebrow">
              Estoque
            </span>

            <h2>
              Quantidade por tamanho
            </h2>
          </div>

          <small>
            {estoqueFiltrado.length}{' '}
            tamanho(s)
          </small>
        </div>

        <div className="coletes-table-wrap">
          <table className="coletes-table">
            <thead>
              <tr>
                {(
                  visaoSvdd
                    ? [
                        'Tamanho',
                        'Cofre do SVDD',
                        'Cautelas ativas',
                        'Situação'
                      ]
                    : [
                        'Tamanho',
                        'Total',
                        'P4',
                        'SVDD',
                        'Em serviço',
                        'Situação'
                      ]
                ).map(
                  (titulo) => (
                    <th key={titulo}>
                      {titulo}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {estoqueFiltrado.map(
                (item) => (
                  <tr key={item.id}>
                    <td>
                      {item.tamanho}
                    </td>

                    {visaoSvdd ? (
                      <>
                        <td>
                          {numero(
                            item.quantidade_svdd
                          )}
                        </td>

                        <td>
                          {numero(
                            item.quantidade_em_servico
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        <td>
                          {numero(
                            item.quantidade_total
                          )}
                        </td>

                        <td>
                          {numero(
                            item.quantidade_p4
                          )}
                        </td>

                        <td>
                          {numero(
                            item.quantidade_svdd
                          )}
                        </td>

                        <td>
                          {numero(
                            item.quantidade_em_servico
                          )}
                        </td>
                      </>
                    )}

                    <td>
                      {item.status_operacional ||
                        'RESERVA'}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalEntrada && (
        <ModalEntradaMaterial
          tamanhoInicial={
            tamanhoSelecionado
          }
          user={user}
          onFechar={() =>
            setModalEntrada(false)
          }
          onConcluido={
            concluirEntrada
          }
        />
      )}

      {operacaoEstoque && (
        <ModalTransferencia
          operacao={operacaoEstoque}
          estoque={estoque}
          pendentes={pendentes}
          tamanhoInicial={
            tamanhoSelecionado
          }
          user={user}
          onFechar={() =>
            setOperacaoEstoque(null)
          }
          onConcluido={
            concluirOperacaoEstoque
          }
        />
      )}

      {modalPendencias && (
        <ModalPendencias
          modo={modalPendencias}
          itens={
            modalPendencias ===
            'receber'
              ? pendentesEntrada
              : pendentesSaida
          }
          user={user}
          onFechar={() =>
            setModalPendencias(null)
          }
          onConcluido={
            concluirPendencia
          }
        />
      )}

      <footer
        style={{
          marginTop: '18px',
          color: '#667085',
          fontSize: '0.74rem',
          fontWeight: 650
        }}
      >
        Usuário:{' '}
        {user?.nome_guerra ||
          user?.nome ||
          '—'}
      </footer>
    </main>
  )
}
