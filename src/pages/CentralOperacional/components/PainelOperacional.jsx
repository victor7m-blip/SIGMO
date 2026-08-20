import { useMemo, useState } from 'react'

import {
  confirmarRecebimentoMovimentacao
} from '../../../services/movimentacoesService'

import {
  finalizarDevolucaoCargaP4
} from '../../../services/armasService'

function texto(valor) {
  return String(valor ?? '').trim()
}

function formatarData(valor) {
  if (!valor) return ''
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return ''
  return data.toLocaleString('pt-BR')
}

function tempoPendente(valor) {
  if (!valor) return ''

  const data = new Date(valor)

  if (Number.isNaN(data.getTime())) {
    return ''
  }

  const agora = new Date()

  const diferencaMs =
    Math.max(
      0,
      agora.getTime() -
      data.getTime()
    )

  const minutos =
    Math.floor(
      diferencaMs /
      (1000 * 60)
    )

  const horas =
    Math.floor(
      diferencaMs /
      (1000 * 60 * 60)
    )

  const dias =
    Math.floor(
      diferencaMs /
      (1000 * 60 * 60 * 24)
    )

  if (dias > 0) {
    return `Pendente há ${dias} ${dias === 1 ? 'dia' : 'dias'}`
  }

  if (horas > 0) {
    return `Pendente há ${horas} ${horas === 1 ? 'hora' : 'horas'}`
  }

  if (minutos > 0) {
    return `Pendente há ${minutos} min`
  }

  return 'Registrada agora'
}

function ehRecebimentoUsuario(secao) {
  return secao?.key === 'recebimentos'
}

function normalizarOperacional(valor) {
  return String(valor ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

function ehRecebimentoP4(item, secao) {
  if (!ehRecebimentoUsuario(secao)) return false

  const status = normalizarOperacional(item?.status)
    .replace(/ /g, '_')

  const destino = normalizarOperacional(
    item?.destino_local ||
    item?.destino_nome ||
    item?.destino_codigo
  )

  const tipo = normalizarOperacional(
    item?.tipo_movimentacao ||
    item?.tipo
  )

  return (
    status === 'AGUARDANDO_RECEBIMENTO' &&
    (
      destino.includes('P4') ||
      destino.includes('DEPOSITO DO P4')
    ) &&
    (
      tipo.includes('TRANSFERENCIA PARA O P4') ||
      tipo.includes('DEVOLUCAO') ||
      tipo.includes('TRANSFERENCIA')
    )
  )
}

function ehTransferencia(secao) {
  return secao?.key === 'transferencias'
}

function ehAprovacao(secao) {
  return secao?.key === 'aprovacoes'
}

function ehNovidade(secao) {
  return secao?.key === 'novidades'
}

function ehIndicadorPatrimonio(secao) {
  return ['nao-localizados', 'baixados'].includes(secao?.key)
}

function tituloItem(item, secao) {
  if (ehRecebimentoUsuario(secao)) {
    return (
      item?.recebedor_nome ||
      item?.policial_nome ||
      'Usuário destinatário'
    )
  }

  if (ehTransferencia(secao)) {
    return item?.protocolo || `${item?.origem_codigo || 'Origem'} → ${item?.destino_codigo || 'Destino'}`
  }

  if (ehAprovacao(secao) && item?.origem_aprovacao === 'BAIXA_PATRIMONIAL') {
    return `Baixa de ${item?.modulo || 'patrimônio'} — ${item?.patrimonio || item?.numero_serie || 'item'}`
  }

  if (ehNovidade(secao)) {
    const identificador =
      item?.patrimonio ||
      item?.numero_patrimonio ||
      item?.numero_serie ||
      item?.identificador ||
      item?.referencia ||
      ''

    const patrimonio =
      [
        item?.especie ||
        item?.especie_patrimonio ||
        item?.tipo_especifico ||
        item?.tipo_patrimonio ||
        'Patrimônio',
        identificador
      ]
        .map(texto)
        .filter(Boolean)
        .join(' — ')

    return `${patrimonio} — ${item?.titulo || 'Novidade patrimonial'}`
  }

  if (ehIndicadorPatrimonio(secao)) {
    return (
      item?.identificador ||
      item?.patrimonio ||
      item?.numero_serie ||
      item?.descricao ||
      `${item?.tipo || 'Patrimônio'}`
    )
  }

  return (
    item?.titulo ||
    item?.tipo_movimentacao ||
    item?.tipo ||
    item?.descricao ||
    item?.protocolo ||
    item?.identificador ||
    item?.numero_patrimonio ||
    'Registro operacional'
  )
}

function resumirItens(item) {
  const itens = Array.isArray(item?.itens) ? item.itens : []
  if (itens.length === 0) return ''

  const descricoes = itens.map((registro) => {
    const nome =
      registro?.descricao ||
      registro?.tipo_patrimonio ||
      registro?.patrimonio ||
      'Material'
    const quantidade = Number(registro?.quantidade || 1)
    return `${nome}${quantidade > 1 ? ` (${quantidade})` : ''}`
  })

  return descricoes.join(', ')
}

function obterFotosNovidade(item) {
  const fotos =
    Array.isArray(item?.fotos)
      ? item.fotos
      : []

  if (fotos.length > 0) {
    return fotos
      .map((foto) => ({
        ...foto,
        foto_url:
          foto?.foto_url ||
          foto?.url ||
          null
      }))
      .filter(
        (foto) =>
          Boolean(foto?.foto_url)
      )
  }

  if (item?.foto_url) {
    return [
      {
        foto_url:
          item.foto_url,
        principal: true,
        ordem: 1
      }
    ]
  }

  return []
}

function detalheItem(item, secao) {
  if (ehIndicadorPatrimonio(secao)) {
    return [
      item?.tipo,
      item?.status_operacional || item?.status,
      item?.local_atual,
      item?.responsavel_atual_nome || item?.responsavel_nome
    ].map(texto).filter(Boolean).join(' • ')
  }

  if (ehNovidade(secao)) {
    return [
      item?.descricao,
      item?.providencia || item?.providencia_sugerida
        ? `PROVIDÊNCIA SUGERIDA: ${item?.providencia || item?.providencia_sugerida}`
        : '',
      item?.gravidade,
      item?.status,
      item?.registrado_por_nome
    ].map(texto).filter(Boolean).join(' • ')
  }

  if (ehAprovacao(secao) && item?.origem_aprovacao === 'BAIXA_PATRIMONIAL') {
    return [
      item?.motivo,
      item?.solicitada_por_nome,
      item?.observacoes
    ].map(texto).filter(Boolean).join(' • ')
  }

  if (ehTransferencia(secao)) {
    const metadata = item?.metadata && typeof item.metadata === 'object' ? item.metadata : {}
    const material =
      metadata?.descricao_arma ||
      metadata?.patrimonio_arma ||
      item?.categoria ||
      'Patrimônio'

    return [
      material,
      item?.quantidade ? `${item.quantidade} un.` : '',
      item?.origem_nome && item?.destino_nome ? `${item.origem_nome} → ${item.destino_nome}` : '',
      item?.enviado_por_nome
    ].map(texto).filter(Boolean).join(' • ')
  }

  if (ehRecebimentoUsuario(secao)) {
    const materiais = resumirItens(item)
    const partes = [
      item?.recebedor_re ? `RE ${item.recebedor_re}` : '',
      materiais || 'Materiais aguardando confirmação',
      item?.origem_local && item?.destino_local
        ? `${item.origem_local} → ${item.destino_local}`
        : ''
    ].map(texto).filter(Boolean)

    return partes.join(' • ')
  }

  const partes = [
    item?.descricao,
    item?.status,
    item?.origem_local && item?.destino_local
      ? `${item.origem_local} → ${item.destino_local}`
      : item?.local_atual,
    item?.registrado_por_nome || item?.solicitante_nome
  ].map(texto).filter(Boolean)

  return [...new Set(partes)].join(' • ')
}

export default function PainelOperacional({ dados, carregando, user, onAtualizar }) {
  const [selecionado, setSelecionado] = useState(null)
  const [registroAberto, setRegistroAberto] = useState(null)
  const [recebendoId, setRecebendoId] = useState(null)
  const [fotoAmpliada, setFotoAmpliada] = useState(null)
  const secoes = useMemo(
    () => [...(dados?.alertas ?? []), ...(dados?.indicadores ?? [])],
    [dados]
  )

  async function receberNoP4(item) {
    if (!item?.id || recebendoId) return

    const confirmou = window.confirm(
      'Confirmar o recebimento desta devolução no P4?'
    )

    if (!confirmou) return

    try {
      setRecebendoId(item.id)

      await confirmarRecebimentoMovimentacao({
        movimentacao_id: item.id,
        recebedor: user,
        observacao:
          'Recebimento confirmado pelo P4 na Central Operacional.'
      })

      const origem = normalizarOperacional(
        item?.origem_local
      )

      if (origem === 'CARGA PERMANENTE') {
        await finalizarDevolucaoCargaP4({
          itens: item?.itens || []
        })
      }

      setSelecionado(null)
      setRegistroAberto(null)

      if (typeof onAtualizar === 'function') {
        await onAtualizar()
      }
    } catch (error) {
      console.error(
        'Erro ao confirmar recebimento no P4:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível confirmar o recebimento no P4.'
      )
    } finally {
      setRecebendoId(null)
    }
  }

  if (carregando && !dados) {
    return <section className="central-operacional-loading">Carregando situação operacional...</section>
  }

  return (
    <>
      <section className="central-prioridades">
        <header className="central-section-header">
          <div>
            <span className="central-section-eyebrow">Situação operacional</span>
            <h2>Pendências e ações</h2>
            <p>Visão consolidada das ocorrências que exigem acompanhamento.</p>
          </div>
          {dados?.perfil && <span className="central-perfil-chip">{dados.perfil}</span>}
        </header>

        <div className="central-operacional-grid central-operacional-grid-principal">
          {(dados?.alertas ?? []).map((card) => (
            <button
              type="button"
              key={card.key}
              className={`central-operacional-card central-operacional-card-${card.tom || 'neutro'}`}
              onClick={() => { setSelecionado(card); setRegistroAberto(null) }}
            >
              <div className="central-card-topo">
                <span>{card.titulo}</span>
                {card.total > 0 && <b className="central-card-alerta">Pendente</b>}
              </div>
              <strong>{card.total}</strong>
              <small>{card.total > 0 ? 'Abrir pendências' : 'Nenhuma pendência'}</small>
            </button>
          ))}
        </div>

        <div className="central-operacional-grid central-operacional-grid-secundario">
          {(dados?.indicadores ?? []).map((card) => (
            <button
              type="button"
              key={card.key}
              className="central-operacional-card central-operacional-card-secundario"
              onClick={() => { setSelecionado(card); setRegistroAberto(null) }}
            >
              <div className="central-card-topo">
                <span>{card.titulo}</span>
              </div>
              <strong>{card.total}</strong>
              <small>{card.total > 0 ? 'Ver detalhes' : 'Sem registros'}</small>
            </button>
          ))}
        </div>
      </section>

      {selecionado && (
        <div className="central-modal-backdrop" onMouseDown={() => setSelecionado(null)}>
          <section className="central-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header className="central-modal-header">
              <div>
                <span className="central-section-eyebrow">Central Operacional</span>
                <h3>{selecionado.titulo}</h3>
              </div>
              <button type="button" className="central-link-button" onClick={() => setSelecionado(null)}>
                Fechar
              </button>
            </header>

            <div className="central-modal-body">
              {(selecionado.itens ?? []).length === 0 ? (
                <div className="central-empty">Nenhum registro pendente nesta situação.</div>
              ) : (
                (selecionado.itens ?? []).map((item, index) => (
                  <article className="central-registro-operacional" key={item?.id || `${selecionado.key}-${index}`}>
                    <div className="central-registro-conteudo">
                      <strong>{tituloItem(item, selecionado)}</strong>
                      <p>{detalheItem(item, selecionado) || 'Sem informações complementares.'}</p>

                      {ehNovidade(selecionado) && (
                        <div
                          style={{
                            marginTop: '6px',
                            fontWeight: 800,
                            color: '#dc2626'
                          }}
                        >
                          {tempoPendente(
                            item?.created_at ||
                            item?.updated_at
                          )}
                        </div>
                      )}

                      {registroAberto === (item?.id || index) && (
                        <div className="central-registro-detalhes">
                          {ehIndicadorPatrimonio(selecionado) ? (
                            <>
                              <div><span>Tipo</span><strong>{item?.tipo || 'Não informado'}</strong></div>
                              <div><span>Status</span><strong>{item?.status_operacional || item?.status || 'Não informado'}</strong></div>
                              <div><span>Patrimônio</span><strong>{item?.patrimonio || item?.identificador || 'Não informado'}</strong></div>
                              <div><span>Nº de série</span><strong>{item?.numero_serie || 'Não informado'}</strong></div>
                              <div><span>Local atual</span><strong>{item?.local_atual || 'Sem localização'}</strong></div>
                              <div><span>Responsável</span><strong>{item?.responsavel_atual_nome || item?.responsavel_nome || 'Não informado'}</strong></div>
                            </>
                          ) : ehNovidade(selecionado) ? (
                            <>
                              <div><span>Tipo de patrimônio</span><strong>{item?.especie || item?.especie_patrimonio || item?.tipo_especifico || item?.tipo_patrimonio || 'Não informado'}</strong></div>
                              <div><span>Patrimônio / Nº de série</span><strong>{item?.patrimonio || item?.numero_patrimonio || item?.numero_serie || item?.identificador || item?.referencia || 'Não informado'}</strong></div>
                              <div><span>Ocorrência</span><strong>{item?.titulo || 'Novidade patrimonial'}</strong></div>
                              <div><span>Gravidade</span><strong>{item?.gravidade || 'Não informada'}</strong></div>
                              <div><span>Status</span><strong>{item?.status || 'Registrada'}</strong></div>
                              <div><span>Registrado por</span><strong>{item?.registrado_por_nome || 'Não informado'}</strong></div>
                              <div><span>Data / hora</span><strong>{formatarData(item?.created_at)}</strong></div>
                              <div>
                                <span>Tempo aguardando providência</span>
                                <strong style={{ color: '#dc2626', fontWeight: 800 }}>
                                  {tempoPendente(item?.created_at || item?.updated_at) || 'Não informado'}
                                </strong>
                              </div>
                              <div className="central-registro-itens"><span>Descrição</span><strong>{item?.descricao || 'Sem descrição.'}</strong></div>
                              {(item?.providencia || item?.providencia_sugerida) && (
                                <div className="central-registro-itens"><span>Providência sugerida</span><strong>{item?.providencia || item?.providencia_sugerida}</strong></div>
                              )}

                              {obterFotosNovidade(item).length > 0 && (
                                <div
                                  className="central-registro-itens"
                                  style={{
                                    gridColumn:
                                      '1 / -1'
                                  }}
                                >
                                  <span>Fotos anexadas</span>

                                  <div
                                    style={{
                                      display:
                                        'grid',
                                      gridTemplateColumns:
                                        'repeat(auto-fit, minmax(120px, 160px))',
                                      gap: 12,
                                      marginTop: 8
                                    }}
                                  >
                                    {obterFotosNovidade(item).map(
                                      (foto, fotoIndex) => (
                                        <button
                                          key={
                                            foto?.id ||
                                            foto?.foto_url ||
                                            fotoIndex
                                          }
                                          type="button"
                                          onClick={() =>
                                            setFotoAmpliada({
                                              ...foto,
                                              indice:
                                                fotoIndex + 1
                                            })
                                          }
                                          title="Clique para ampliar a foto"
                                          style={{
                                            display:
                                              'block',
                                            width:
                                              '100%',
                                            padding:
                                              0,
                                            borderRadius:
                                              12,
                                            overflow:
                                              'hidden',
                                            border:
                                              '1px solid rgba(255,255,255,.18)',
                                            background:
                                              'rgba(255,255,255,.04)',
                                            cursor:
                                              'zoom-in'
                                          }}
                                        >
                                          <img
                                            src={
                                              foto.foto_url
                                            }
                                            alt={`Foto ${fotoIndex + 1} da novidade`}
                                            style={{
                                              display:
                                                'block',
                                              width:
                                                '100%',
                                              height:
                                                120,
                                              objectFit:
                                                'cover'
                                            }}
                                          />
                                        </button>
                                      )
                                    )}
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div><span>Status</span><strong>{item?.status || 'Não informado'}</strong></div>
                              <div><span>Tipo</span><strong>{item?.tipo_movimentacao || item?.tipo || item?.categoria || 'Não informado'}</strong></div>
                              <div><span>Solicitante</span><strong>{item?.solicitante_nome || item?.enviado_por_nome || 'Não informado'}</strong></div>
                              <div><span>Destinatário</span><strong>{item?.recebedor_nome || item?.destino_codigo || item?.destino_nome || 'Não informado'}</strong></div>
                              <div><span>Origem</span><strong>{item?.origem_local || item?.origem_nome || item?.origem_codigo || 'Não informada'}</strong></div>
                              <div><span>Destino</span><strong>{item?.destino_local || item?.destino_nome || item?.destino_codigo || 'Não informado'}</strong></div>
                            </>
                          )}
                          {Array.isArray(item?.itens) && item.itens.length > 0 && (
                            <div className="central-registro-itens">
                              <span>Materiais</span>
                              {item.itens.map((registro, itemIndex) => (
                                <strong key={registro?.id || itemIndex}>
                                  {registro?.descricao || registro?.tipo_patrimonio || 'Material'}
                                  {Number(registro?.quantidade || 1) > 1 ? ` — ${registro.quantidade} un.` : ''}
                                </strong>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="central-registro-acoes">
                      <time>{formatarData(item?.created_at || item?.updated_at)}</time>
                      <button
                        type="button"
                        className="central-detalhe-button"
                        onClick={() => setRegistroAberto(
                          registroAberto === (item?.id || index) ? null : (item?.id || index)
                        )}
                      >
                        {registroAberto === (item?.id || index) ? 'Ocultar' : 'Ver detalhes'}
                      </button>
                      {ehRecebimentoP4(item, selecionado) && (
                        <button
                          type="button"
                          className="central-button central-button-primary"
                          disabled={Boolean(recebendoId)}
                          onClick={() => receberNoP4(item)}
                        >
                          {recebendoId === item.id
                            ? 'Recebendo...'
                            : 'Receber'}
                        </button>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {fotoAmpliada?.foto_url && (
        <div
          className="central-modal-backdrop"
          style={{
            zIndex: 10050
          }}
          onMouseDown={() =>
            setFotoAmpliada(null)
          }
        >
          <section
            className="central-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
            style={{
              width:
                'min(980px, calc(100vw - 48px))',
              maxHeight:
                'calc(100vh - 48px)'
            }}
          >
            <header className="central-modal-header">
              <div>
                <span className="central-section-eyebrow">
                  FOTO DA NOVIDADE
                </span>
                <h3>
                  Foto {fotoAmpliada.indice || 1}
                </h3>
              </div>

              <button
                type="button"
                className="central-link-button"
                onClick={() =>
                  setFotoAmpliada(null)
                }
              >
                Fechar
              </button>
            </header>

            <div
              className="central-modal-body"
              style={{
                display:
                  'grid',
                placeItems:
                  'center',
                padding:
                  18,
                background:
                  '#08111f'
              }}
            >
              <img
                src={fotoAmpliada.foto_url}
                alt={`Foto ${fotoAmpliada.indice || 1} da novidade`}
                style={{
                  display:
                    'block',
                  maxWidth:
                    '100%',
                  maxHeight:
                    '72vh',
                  width:
                    'auto',
                  height:
                    'auto',
                  objectFit:
                    'contain',
                  borderRadius:
                    14
                }}
              />
            </div>
          </section>
        </div>
      )}
    </>
  )
}
