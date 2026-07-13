import { useEffect, useMemo, useRef, useState } from 'react'
import {
  buscarPatrimonioOperacional,
  conferirPatrimonio,
  criarConferencia,
  finalizarConferencia,
  listarItensConferencia,
  marcarDivergenciaConferencia,
  obterConferenciaAtiva
} from '../../../services/CentralOperacionalEngine'
import StatusOperacionalBadge from './StatusOperacionalBadge'

export default function ConferenciaPatrimonial({
  aberto,
  categoria,
  onFechar,
  onConferenciaAlterada
}) {
  const inputRef = useRef(null)

  const [conferencia, setConferencia] = useState(null)
  const [itens, setItens] = useState([])
  const [codigo, setCodigo] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  const totais = useMemo(() => {
    return {
      esperado: itens.length,
      encontrado: itens.filter(
        (item) => item.status_conferencia === 'ENCONTRADO'
      ).length,
      divergente: itens.filter(
        (item) => item.status_conferencia === 'DIVERGENTE'
      ).length,
      pendente: itens.filter(
        (item) => item.status_conferencia === 'PENDENTE'
      ).length
    }
  }, [itens])

  useEffect(() => {
    if (!aberto || !categoria?.categoria) {
      return
    }

    carregarConferencia()
  }, [aberto, categoria?.categoria])

  useEffect(() => {
    if (aberto) {
      window.setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [aberto, conferencia])

  async function carregarItens(conferenciaId) {
    const dados = await listarItensConferencia(conferenciaId)
    setItens(dados)
  }

  async function carregarConferencia() {
    try {
      setCarregando(true)
      setErro('')
      setMensagem('')

      const ativa = await obterConferenciaAtiva(categoria.categoria)

      setConferencia(ativa)

      if (ativa?.id) {
        await carregarItens(ativa.id)
      } else {
        setItens([])
      }
    } catch (error) {
      setErro(
        error?.message || 'Não foi possível carregar a conferência.'
      )
    } finally {
      setCarregando(false)
    }
  }

  async function iniciarConferencia() {
    try {
      setProcessando(true)
      setErro('')
      setMensagem('')

      const nova = await criarConferencia({
        categoria: categoria.categoria,
        nome: `CONFERÊNCIA ${categoria.categoria}`
      })

      setConferencia(nova)
      await carregarItens(nova.id)

      setMensagem('Conferência iniciada com sucesso.')
      onConferenciaAlterada?.()
    } catch (error) {
      setErro(
        error?.message || 'Não foi possível iniciar a conferência.'
      )
    } finally {
      setProcessando(false)
      inputRef.current?.focus()
    }
  }

  async function processarCodigo(event) {
    event?.preventDefault()

    const busca = codigo.trim()

    if (!busca || !conferencia?.id) {
      return
    }

    try {
      setProcessando(true)
      setErro('')
      setMensagem('')

      const patrimonio = await buscarPatrimonioOperacional(busca)

      if (!patrimonio) {
        setErro(`Patrimônio ${busca.toUpperCase()} não localizado.`)
        return
      }

      if (patrimonio.categoria !== categoria.categoria) {
        setErro(
          `O patrimônio pertence à categoria ${patrimonio.categoria}.`
        )
        return
      }

      const itemConferencia = itens.find(
        (item) => item.patrimonio_id === patrimonio.id
      )

      if (!itemConferencia) {
        setErro('O patrimônio não faz parte desta conferência.')
        return
      }

      if (itemConferencia.status_conferencia === 'ENCONTRADO') {
        setMensagem(
          `${patrimonio.identificador} já havia sido conferido.`
        )
        return
      }

      await conferirPatrimonio({
        conferenciaId: conferencia.id,
        patrimonio
      })

      await carregarItens(conferencia.id)

      setCodigo('')
      setMensagem(`${patrimonio.identificador} encontrado e conferido.`)
      onConferenciaAlterada?.()
    } catch (error) {
      setErro(
        error?.message || 'Não foi possível conferir o patrimônio.'
      )
    } finally {
      setProcessando(false)
      inputRef.current?.focus()
    }
  }

  async function marcarNaoLocalizado(item) {
    try {
      setProcessando(true)
      setErro('')
      setMensagem('')

      await marcarDivergenciaConferencia({
        conferenciaId: conferencia.id,
        itemId: item.id,
        tipoDivergencia: 'NÃO LOCALIZADO'
      })

      await carregarItens(conferencia.id)

      setMensagem(`${item.identificador} marcado como não localizado.`)
      onConferenciaAlterada?.()
    } catch (error) {
      setErro(
        error?.message || 'Não foi possível registrar a divergência.'
      )
    } finally {
      setProcessando(false)
    }
  }

  async function concluirConferencia() {
    const confirmar = window.confirm(
      `Finalizar a conferência?\n\n` +
        `${totais.encontrado} encontrados\n` +
        `${totais.pendente} pendentes\n` +
        `${totais.divergente} divergentes\n\n` +
        `Os itens pendentes serão marcados como não localizados.`
    )

    if (!confirmar) {
      return
    }

    try {
      setProcessando(true)
      setErro('')
      setMensagem('')

      await finalizarConferencia({
        conferenciaId: conferencia.id
      })

      setMensagem('Conferência finalizada com sucesso.')
      setConferencia(null)
      setItens([])

      onConferenciaAlterada?.()
    } catch (error) {
      setErro(
        error?.message || 'Não foi possível finalizar a conferência.'
      )
    } finally {
      setProcessando(false)
    }
  }

  if (!aberto || !categoria) {
    return null
  }

  return (
    <div
      className="central-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onFechar?.()
        }
      }}
    >
      <div
        className="central-modal central-modal-full"
        role="dialog"
        aria-modal="true"
        aria-label={`Conferência de ${categoria.categoria}`}
      >
        <header className="central-modal-header">
          <div>
            <span className="central-section-eyebrow">
              Conferência física
            </span>

            <h2>{categoria.categoria}</h2>

            <p>
              Escaneie o QR Code ou digite o número do patrimônio.
            </p>
          </div>

          <button
            type="button"
            className="central-modal-close"
            onClick={onFechar}
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        <div className="central-modal-body">
          {carregando ? (
            <div className="central-loading">
              Carregando conferência...
            </div>
          ) : !conferencia ? (
            <div className="central-conferencia-inicio">
              <div className="central-conferencia-icon">✓</div>

              <h3>Nenhuma conferência em andamento</h3>

              <p>
                Será criada uma relação com todos os patrimônios ativos da
                categoria {categoria.categoria}.
              </p>

              <button
                type="button"
                className="central-button central-button-primary"
                onClick={iniciarConferencia}
                disabled={processando}
              >
                {processando
                  ? 'Preparando conferência...'
                  : 'Iniciar nova conferência'}
              </button>
            </div>
          ) : (
            <>
              <div className="central-conferencia-resumo">
                <div>
                  <span>Esperado</span>
                  <strong>{totais.esperado}</strong>
                </div>

                <div>
                  <span>Encontrado</span>
                  <strong>{totais.encontrado}</strong>
                </div>

                <div>
                  <span>Pendente</span>
                  <strong>{totais.pendente}</strong>
                </div>

                <div>
                  <span>Divergente</span>
                  <strong>{totais.divergente}</strong>
                </div>
              </div>

              <form
                className="central-scanner-form"
                onSubmit={processarCodigo}
              >
                <label>
                  Patrimônio ou QR Code

                  <input
                    ref={inputRef}
                    type="text"
                    value={codigo}
                    onChange={(event) =>
                      setCodigo(event.target.value.toUpperCase())
                    }
                    placeholder="ESCANEIE OU DIGITE"
                    autoComplete="off"
                    disabled={processando}
                  />
                </label>

                <button
                  type="submit"
                  className="central-button central-button-primary"
                  disabled={processando || !codigo.trim()}
                >
                  Conferir
                </button>
              </form>

              {erro && (
                <div className="central-alert central-alert-error">
                  {erro}
                </div>
              )}

              {mensagem && (
                <div className="central-alert central-alert-success">
                  {mensagem}
                </div>
              )}

              <div className="central-table-wrapper">
                <table className="central-table">
                  <thead>
                    <tr>
                      <th>Patrimônio</th>
                      <th>Responsável esperado</th>
                      <th>Local esperado</th>
                      <th>Conferência</th>
                      <th>Ação</th>
                    </tr>
                  </thead>

                  <tbody>
                    {itens.map((item) => (
                      <tr key={item.id}>
                        <td data-label="Patrimônio">
                          <strong>{item.identificador}</strong>
                        </td>

                        <td data-label="Responsável esperado">
                          {item.responsavel_re_esperado && (
                            <strong>
                              RE {item.responsavel_re_esperado}
                            </strong>
                          )}

                          <div>
                            {item.responsavel_nome_esperado || '—'}
                          </div>
                        </td>

                        <td data-label="Local esperado">
                          {item.local_esperado || '—'}
                        </td>

                        <td data-label="Conferência">
                          <StatusOperacionalBadge
                            status={item.status_conferencia}
                          />
                        </td>

                        <td data-label="Ação">
                          {item.status_conferencia !== 'ENCONTRADO' && (
                            <button
                              type="button"
                              className="central-button central-button-danger-outline"
                              onClick={() => marcarNaoLocalizado(item)}
                              disabled={processando}
                            >
                              Não localizado
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="central-conferencia-footer">
                <button
                  type="button"
                  className="central-button central-button-secondary"
                  onClick={onFechar}
                >
                  Continuar depois
                </button>

                <button
                  type="button"
                  className="central-button central-button-danger"
                  onClick={concluirConferencia}
                  disabled={processando}
                >
                  Finalizar conferência
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}