import { useEffect, useMemo, useState } from 'react'

import {
  alterarStatusOcorrenciaRiv,
  concluirAvariaRiv,
  reabrirAvariaRiv,
  calcularStatusManutencao,
  corrigirQuilometragem,
  ITENS_MANUTENCAO_RIV,
  podeCorrigirQuilometragem,
  obterRivResumo,
  registrarOcorrenciaRiv,
  registrarQuilometragem,
  salvarManutencaoRiv,
  enviarFotosOcorrenciaRiv,
  obterFotosRivPorViatura,
  concluirManutencaoRiv,
  obterHistoricoOcorrenciaRiv,
  podeReabrirManutencaoRiv,
  reabrirManutencaoRiv
} from '../../services/viaturasRivService'

const OCORRENCIA_VAZIA = {
  tipo: 'AVARIA',
  titulo: '',
  descricao: ''
}

function formatarData(valor) {
  if (!valor) return '—'
  return new Date(`${valor}T00:00:00`).toLocaleDateString('pt-BR')
}

function formatarKm(valor) {
  if (valor == null || valor === '') return '—'
  return `${Number(valor).toLocaleString('pt-BR')} km`
}

export default function ViaturaRiv({ user, viatura, onUpdated }) {
  const [dados, setDados] = useState({
    quilometragemAtual: Number(viatura.quilometragem_atual || 0),
    historicoKm: [],
    manutencoes: [],
    ocorrencias: []
  })
  const [km, setKm] = useState(String(viatura.quilometragem_atual || ''))
  const [kmObs, setKmObs] = useState('')
  const [ocorrencia, setOcorrencia] = useState(OCORRENCIA_VAZIA)
  const [editandoItem, setEditandoItem] = useState(null)
  const [formManut, setFormManut] = useState(null)
  const [correcaoKm, setCorrecaoKm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [fotosNovaOcorrencia, setFotosNovaOcorrencia] = useState([])
  const [fotosRiv, setFotosRiv] = useState([])
  const [fotoAmpliada, setFotoAmpliada] = useState(null)
  const [visualizandoRegistro, setVisualizandoRegistro] = useState(null)
  const [historicoRegistro, setHistoricoRegistro] = useState([])
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)
  const [reabrindoManutencao, setReabrindoManutencao] = useState(null)
  const [fechandoAvaria, setFechandoAvaria] = useState(null)
  const [reabrindoAvaria, setReabrindoAvaria] = useState(null)
  const [erroFechamentoAvaria, setErroFechamentoAvaria] = useState('')

  async function carregar() {
    try {
      setLoading(true)
      setErro('')
      const [resumo, fotos] = await Promise.all([
        obterRivResumo(viatura.id),
        obterFotosRivPorViatura(viatura.id)
      ])
      setDados(resumo)
      setFotosRiv(fotos)
      setKm(String(resumo.quilometragemAtual || ''))
    } catch (error) {
      setErro(error?.message || 'Não foi possível carregar o RIV.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [viatura.id])

  const alertas = useMemo(() => {
    const padroes = ITENS_MANUTENCAO_RIV.map((item) => {
      const registro = dados.manutencoes.find((m) => m.item === item.value)
      return { ...item, registro, status: calcularStatusManutencao(registro, dados.quilometragemAtual) }
    })

    const personalizados = dados.manutencoes
      .filter((m) => m.item_personalizado)
      .map((registro) => ({
        value: registro.item,
        label: registro.nome_item || registro.item,
        margemKmPadrao: registro.margem_alerta_km ?? 1000,
        margemDiasPadrao: registro.margem_alerta_dias ?? 30,
        personalizado: true,
        registro,
        status: calcularStatusManutencao(registro, dados.quilometragemAtual)
      }))

    return [...padroes, ...personalizados]
  }, [dados.manutencoes, dados.quilometragemAtual])

  const podeCorrigirKm = podeCorrigirQuilometragem(user)
  const podeReabrirManutencao = podeReabrirManutencaoRiv(user)

  async function salvarKm(event) {
    event.preventDefault()

    try {
      setOcupado(true)
      setErro('')

      await registrarQuilometragem({
        viatura: {
          ...viatura,
          quilometragem_atual: dados.quilometragemAtual
        },
        quilometragem: km,
        observacao: kmObs,
        user
      })

      setKmObs('')
      await carregar()
      await onUpdated?.()
    } catch (error) {
      setErro(error?.message || 'Não foi possível registrar a quilometragem.')
    } finally {
      setOcupado(false)
    }
  }

  function abrirManutencao(item) {
    const registro = dados.manutencoes.find((m) => m.item === item.value)

    setEditandoItem(item)
    setFormManut({
      nomeItem: registro?.nome_item || item.label,
      ultimaData: registro?.ultima_data || '',
      ultimaKm: registro?.ultima_km ?? dados.quilometragemAtual ?? '',
      proximaData: registro?.proxima_data || '',
      proximaKm: registro?.proxima_km ?? '',
      margemAlertaKm:
        registro?.margem_alerta_km ?? item.margemKmPadrao,
      margemAlertaDias:
        registro?.margem_alerta_dias ?? item.margemDiasPadrao,
      observacoes: registro?.observacoes || ''
    })
  }


  function novaManutencaoPersonalizada() {
    const codigo = `CUSTOM_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`}`
    setEditandoItem({ value: codigo, label: 'Novo item', personalizado: true, novo: true, margemKmPadrao: 1000, margemDiasPadrao: 30 })
    setFormManut({ nomeItem: '', ultimaData: '', ultimaKm: dados.quilometragemAtual ?? '', proximaData: '', proximaKm: '', margemAlertaKm: 1000, margemAlertaDias: 30, observacoes: '' })
  }

  async function salvarCorrecaoKm(event) {
    event.preventDefault()
    try {
      setOcupado(true)
      setErro('')
      await corrigirQuilometragem({ viaturaId: viatura.id, novaQuilometragem: correcaoKm.quilometragem, justificativa: correcaoKm.justificativa, user })
      setCorrecaoKm(null)
      await carregar()
      await onUpdated?.()
    } catch (error) {
      setErro(error?.message || 'Não foi possível corrigir a quilometragem.')
    } finally {
      setOcupado(false)
    }
  }

  async function salvarManut(event) {
    event.preventDefault()

    try {
      setOcupado(true)
      setErro('')

      await salvarManutencaoRiv({
        viaturaId: viatura.id,
        item: editandoItem.value,
        nomeItem: formManut.nomeItem || editandoItem.label,
        itemPersonalizado: Boolean(editandoItem.personalizado),
        ...formManut,
        user
      })

      setEditandoItem(null)
      setFormManut(null)
      await carregar()
    } catch (error) {
      setErro(error?.message || 'Não foi possível salvar a manutenção.')
    } finally {
      setOcupado(false)
    }
  }

  async function salvarOcorrencia(event) {
    event.preventDefault()

    try {
      setOcupado(true)
      setErro('')

      const registro = await registrarOcorrenciaRiv({
        viatura: {
          ...viatura,
          quilometragem_atual: dados.quilometragemAtual
        },
        ...ocorrencia,
        user
      })

      if (fotosNovaOcorrencia.length > 0) {
        await enviarFotosOcorrenciaRiv({
          viaturaId: viatura.id,
          ocorrenciaId: registro.id,
          tipo: ocorrencia.tipo,
          fase: 'ANTES',
          arquivos: fotosNovaOcorrencia,
          user
        })
      }

      setOcorrencia(OCORRENCIA_VAZIA)
      setFotosNovaOcorrencia([])
      await carregar()
    } catch (error) {
      setErro(error?.message || 'Não foi possível registrar a ocorrência.')
    } finally {
      setOcupado(false)
    }
  }

  async function adicionarFotosRegistro(item, arquivos, fase = 'ANTES') {
    const lista = Array.from(arquivos || [])
    if (!lista.length) return
    try {
      setOcupado(true)
      setErro('')
      await enviarFotosOcorrenciaRiv({
        viaturaId: viatura.id,
        ocorrenciaId: item.id,
        tipo: item.tipo,
        fase,
        arquivos: lista,
        user
      })
      await carregar()
    } catch (error) {
      setErro(error?.message || 'Não foi possível adicionar as fotos.')
    } finally {
      setOcupado(false)
    }
  }

  async function visualizarRegistro(item) {
    try {
      setVisualizandoRegistro(item)
      setHistoricoRegistro([])
      setCarregandoHistorico(true)
      setErro('')
      setHistoricoRegistro(await obterHistoricoOcorrenciaRiv(item.id))
    } catch (error) {
      setErro(error?.message || 'Não foi possível carregar o histórico do registro.')
    } finally {
      setCarregandoHistorico(false)
    }
  }

  async function concluirManutencao(item) {
    if (!window.confirm('Concluir esta manutenção? Depois de concluída, ela ficará bloqueada para alterações.')) return
    try {
      setOcupado(true)
      setErro('')
      await concluirManutencaoRiv(item, user)
      await carregar()
    } catch (error) {
      setErro(error?.message || 'Não foi possível concluir a manutenção.')
    } finally {
      setOcupado(false)
    }
  }

  async function confirmarReabertura(event) {
    event.preventDefault()
    try {
      setOcupado(true)
      setErro('')
      await reabrirManutencaoRiv(reabrindoManutencao.item, reabrindoManutencao.justificativa, user)
      setReabrindoManutencao(null)
      setVisualizandoRegistro(null)
      await carregar()
    } catch (error) {
      setErro(error?.message || 'Não foi possível reabrir a manutenção.')
    } finally {
      setOcupado(false)
    }
  }

  function abrirFechamentoAvaria(item) {
    setErroFechamentoAvaria('')
    setFechandoAvaria({ item, providencia: '', observacoes: '' })
  }

  async function confirmarFechamentoAvaria(event) {
    event.preventDefault()
    try {
      setOcupado(true)
      setErro('')
      await concluirAvariaRiv({
        item: fechandoAvaria.item,
        providencia: fechandoAvaria.providencia,
        observacoes: fechandoAvaria.observacoes,
        user
      })
      setFechandoAvaria(null)
      await carregar()
    } catch (error) {
      const mensagem = error?.message || 'Não foi possível concluir a avaria.'
      setErro(mensagem)
      setErroFechamentoAvaria(mensagem)
    } finally {
      setOcupado(false)
    }
  }

  async function confirmarReaberturaAvaria(event) {
    event.preventDefault()
    try {
      setOcupado(true)
      setErro('')
      await reabrirAvariaRiv({
        item: reabrindoAvaria.item,
        justificativa: reabrindoAvaria.justificativa,
        user
      })
      setReabrindoAvaria(null)
      setVisualizandoRegistro(null)
      await carregar()
    } catch (error) {
      setErro(error?.message || 'Não foi possível reabrir a avaria.')
    } finally {
      setOcupado(false)
    }
  }

  if (loading) {
    return <div className="viaturas-vazio">Carregando RIV...</div>
  }

  return (
    <div className="riv">
      {erro && <div className="viaturas-erro">{erro}</div>}

      <section className="riv__topo">
        <div>
          <small>QUILOMETRAGEM ATUAL</small>
          <strong>{formatarKm(dados.quilometragemAtual)}</strong>
        </div>

        <form className="riv__km-form" onSubmit={salvarKm}>
          <input
            type="number"
            min={dados.quilometragemAtual}
            value={km}
            onChange={(event) => setKm(event.target.value)}
            placeholder="Quilometragem"
            required
          />
          <input
            value={kmObs}
            onChange={(event) => setKmObs(event.target.value.toUpperCase())}
            placeholder="Observação opcional"
          />
          <button type="submit" disabled={ocupado}>
            Registrar km
          </button>
          {podeCorrigirKm && (
            <button type="button" className="riv__btn-correcao" disabled={ocupado} onClick={() => setCorrecaoKm({ quilometragem: String(dados.quilometragemAtual), justificativa: '' })}>
              Corrigir quilometragem
            </button>
          )}
        </form>
      </section>

      <section className="riv__secao">
        <div className="riv__secao-titulo">
          <div>
            <small>MANUTENÇÃO PREVENTIVA</small>
            <h3>Itens programados</h3>
          </div>
          <button type="button" disabled={ocupado} onClick={novaManutencaoPersonalizada}>
            + Adicionar manutenção preventiva
          </button>
        </div>

        <div className="riv__manut-grid">
          {alertas.map((item) => (
            <article className="riv__manut-card" key={item.value}>
              <div className="riv__manut-card-topo">
                <div>
                  <small>{item.label}</small>
                  <h4>{item.status.label}</h4>
                </div>
                <span
                  className={`riv__alerta riv__alerta--${item.status.nivel.toLowerCase()}`}
                >
                  {item.status.nivel === 'VENCIDO'
                    ? 'VENCIDO'
                    : item.status.nivel === 'ATENCAO'
                    ? 'ATENÇÃO'
                    : item.status.nivel === 'OK'
                    ? 'EM DIA'
                    : 'SEM REGISTRO'}
                </span>
              </div>

              <dl>
                <div>
                  <dt>Última execução</dt>
                  <dd>
                    {formatarData(item.registro?.ultima_data)}
                    {' · '}
                    {formatarKm(item.registro?.ultima_km)}
                  </dd>
                </div>
                <div>
                  <dt>Próxima</dt>
                  <dd>
                    {formatarData(item.registro?.proxima_data)}
                    {' · '}
                    {formatarKm(item.registro?.proxima_km)}
                  </dd>
                </div>
                <div>
                  <dt>Restante</dt>
                  <dd>
                    {item.status.kmRestantes != null
                      ? `${item.status.kmRestantes.toLocaleString('pt-BR')} km`
                      : '—'}
                    {' · '}
                    {item.status.diasRestantes != null
                      ? `${item.status.diasRestantes} dias`
                      : '—'}
                  </dd>
                </div>
              </dl>

              <button
                type="button"
                disabled={ocupado}
                onClick={() => abrirManutencao(item)}
              >
                {item.registro ? 'Atualizar programação' : 'Programar'}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="riv__secao">
        <div className="riv__secao-titulo">
          <div>
            <small>REGISTROS OPERACIONAIS</small>
            <h3>Avarias e manutenções</h3>
          </div>
        </div>

        <form className="riv__ocorrencia-form" onSubmit={salvarOcorrencia}>
          <select
            value={ocorrencia.tipo}
            onChange={(event) =>
              setOcorrencia((atual) => ({
                ...atual,
                tipo: event.target.value
              }))
            }
          >
            <option value="AVARIA">Avaria</option>
            <option value="MANUTENCAO">Manutenção</option>
            <option value="OBSERVACAO">Observação</option>
          </select>

          <input
            value={ocorrencia.titulo}
            onChange={(event) =>
              setOcorrencia((atual) => ({
                ...atual,
                titulo: event.target.value.toUpperCase()
              }))
            }
            placeholder="Título"
            required
          />

          <input
            value={ocorrencia.descricao}
            onChange={(event) =>
              setOcorrencia((atual) => ({
                ...atual,
                descricao: event.target.value.toUpperCase()
              }))
            }
            placeholder="Descrição"
          />

          <label className="riv__foto-btn">
            📷 Fotos
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => setFotosNovaOcorrencia(Array.from(event.target.files || []))}
            />
          </label>

          {fotosNovaOcorrencia.length > 0 && (
            <small className="riv__foto-contagem">{fotosNovaOcorrencia.length} foto(s)</small>
          )}

          <button type="submit" disabled={ocupado}>
            Registrar
          </button>
        </form>

        <div className="riv__timeline">
          {dados.ocorrencias.length === 0 ? (
            <div className="viaturas-vazio">
              Nenhuma ocorrência registrada.
            </div>
          ) : (
            dados.ocorrencias.map((item) => (
              <article
                key={item.id}
                className={[
                  'riv__timeline-item',
                  item.resolvida ? 'is-resolvida' : ''
                ].join(' ')}
              >
                <div>
                  <small>
                    {item.tipo} · {formatarKm(item.quilometragem)}
                  </small>
                  {item.tipo === 'MANUTENCAO' && (
                    <span className={`riv__status-manut ${item.resolvida ? 'is-fechada' : 'is-aberta'}`}>
                      {item.resolvida ? 'CONCLUÍDA 🔒' : 'ABERTA'}
                    </span>
                  )}
                  <h4>{item.titulo}</h4>
                  {item.descricao && <p>{item.descricao}</p>}
                  {item.tipo === 'AVARIA' && item.resolvida && item.providencia_fechamento && (
                    <div className="riv__fechamento-resumo">
                      <strong>FECHAMENTO</strong>
                      <p>{item.providencia_fechamento}</p>
                      {item.observacoes_fechamento && <small>{item.observacoes_fechamento}</small>}
                    </div>
                  )}
                  <span>
                    {new Date(item.created_at).toLocaleString('pt-BR')}
                    {item.criado_por_nome
                      ? ` · ${item.criado_por_nome}`
                      : ''}
                  </span>
                </div>

                <div className="riv__registro-fotos">
                  {fotosRiv.filter((foto) => foto.riv_ocorrencia_id === item.id).map((foto) => (
                    <button type="button" className="riv__foto-thumb" key={foto.id} onClick={() => setFotoAmpliada(foto)}>
                      <img src={foto.url} alt="Registro do RIV" />
                      <span>{foto.fase_riv === 'DEPOIS' ? 'DEPOIS' : 'ANTES'}</span>
                    </button>
                  ))}
                </div>

                <div className="riv__registro-acoes">
                  <button type="button" disabled={ocupado} onClick={() => visualizarRegistro(item)}>
                    👁 Visualizar {item.tipo === 'MANUTENCAO' ? 'manutenção' : 'registro'}
                  </button>

                  {!item.resolvida && (
                    <>
                      <label className="riv__foto-btn">
                        📷 Adicionar foto
                        <input type="file" accept="image/*" multiple onChange={(event) => adicionarFotosRegistro(item, event.target.files, 'ANTES')} />
                      </label>
                      {(item.tipo === 'AVARIA' || item.tipo === 'MANUTENCAO') && (
                        <label className="riv__foto-btn riv__foto-btn--depois">
                          📷 Foto após reparo
                          <input type="file" accept="image/*" multiple onChange={(event) => adicionarFotosRegistro(item, event.target.files, 'DEPOIS')} />
                        </label>
                      )}
                    </>
                  )}

                  {item.tipo === 'MANUTENCAO' && !item.resolvida && (
                    <button type="button" className="riv__btn-concluir" disabled={ocupado} onClick={() => concluirManutencao(item)}>
                      ✓ Concluir manutenção
                    </button>
                  )}

                  {item.tipo === 'MANUTENCAO' && item.resolvida && podeReabrirManutencao && (
                    <button type="button" className="riv__btn-reabrir" disabled={ocupado} onClick={() => setReabrindoManutencao({ item, justificativa: '' })}>
                      Reabrir manutenção
                    </button>
                  )}

                  {item.tipo === 'AVARIA' && !item.resolvida && (
                    <button type="button" disabled={ocupado} onClick={() => abrirFechamentoAvaria(item)}>
                      Marcar resolvida
                    </button>
                  )}

                  {item.tipo === 'AVARIA' && item.resolvida && (
                    <button type="button" className="riv__btn-reabrir" disabled={ocupado} onClick={() => setReabrindoAvaria({ item, justificativa: '' })}>
                      Reabrir
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="riv__secao">
        <div className="riv__secao-titulo">
          <div>
            <small>HISTÓRICO</small>
            <h3>Quilometragem</h3>
          </div>
        </div>

        <div className="riv__km-historico">
          {dados.historicoKm.length === 0 ? (
            <div className="viaturas-vazio">
              Nenhuma quilometragem registrada.
            </div>
          ) : (
            dados.historicoKm.map((item) => (
              <div key={item.id} className={[item.tipo_lancamento === 'CORRECAO' ? 'is-correcao' : '', item.corrigido ? 'is-corrigido' : ''].join(' ')}>
                <div>
                  <strong>{item.tipo_lancamento === 'CORRECAO' ? 'CORREÇÃO: ' : ''}{formatarKm(item.quilometragem)}</strong>
                  {item.corrigido && <small className="riv__km-corrigido">REGISTRO CORRIGIDO</small>}
                  {item.tipo_lancamento === 'CORRECAO' && item.quilometragem_anterior != null && (
                    <small>Anterior: {formatarKm(item.quilometragem_anterior)} · Motivo: {item.justificativa_correcao}</small>
                  )}
                </div>
                <span>{new Date(item.created_at).toLocaleString('pt-BR')}{item.criado_por_nome ? ` · ${item.criado_por_nome}` : ''}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {fechandoAvaria && (
        <div className="riv__modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !ocupado) setFechandoAvaria(null) }}>
          <form className="riv__modal" onSubmit={confirmarFechamentoAvaria}>
            <div className="riv__modal-header">
              <div>
                <small>FECHAMENTO DA AVARIA</small>
                <h3>{fechandoAvaria.item.titulo}</h3>
              </div>
              <button type="button" onClick={() => setFechandoAvaria(null)}>×</button>
            </div>

            <p className="riv__correcao-aviso">
              {fechandoAvaria.item.reaberta_em
                ? 'Esta avaria já foi reaberta. O novo fechamento é exclusivo do Comandante de Cia e ficará registrado no histórico.'
                : 'Registre a providência adotada. Ao confirmar, a avaria será fechada e o evento ficará no histórico.'}
            </p>

            <label className="riv__modal-full">
              <span>Providência / solução adotada *</span>
              <textarea
                rows="4"
                required
                value={fechandoAvaria.providencia}
                onChange={(event) => setFechandoAvaria((atual) => ({ ...atual, providencia: event.target.value.toUpperCase() }))}
              />
            </label>

            <label className="riv__modal-full">
              <span>Observações do fechamento</span>
              <textarea
                rows="3"
                value={fechandoAvaria.observacoes}
                onChange={(event) => setFechandoAvaria((atual) => ({ ...atual, observacoes: event.target.value.toUpperCase() }))}
              />
            </label>

            {erroFechamentoAvaria && (
              <div className="riv__erro-modal">{erroFechamentoAvaria}</div>
            )}

            <div className="riv__modal-actions">
              <button type="button" onClick={() => { setErroFechamentoAvaria(''); setFechandoAvaria(null) }}>Cancelar</button>
              {fechandoAvaria.item.reaberta_em && !podeReabrirManutencao ? (
                <div className="riv__aguardando-cmt">🔒 Aguardando fechamento pelo Cmt de Cia</div>
              ) : (
                <button type="submit" disabled={ocupado}>Finalizar avaria</button>
              )}
            </div>
          </form>
        </div>
      )}

      {reabrindoAvaria && (
        <div className="riv__modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !ocupado) setReabrindoAvaria(null) }}>
          <form className="riv__modal" onSubmit={confirmarReaberturaAvaria}>
            <div className="riv__modal-header">
              <div><small>REABERTURA DA AVARIA</small><h3>{reabrindoAvaria.item.titulo}</h3></div>
              <button type="button" onClick={() => setReabrindoAvaria(null)}>×</button>
            </div>
            <label className="riv__modal-full">
              <span>Justificativa da reabertura *</span>
              <textarea
                rows="4"
                required
                value={reabrindoAvaria.justificativa}
                onChange={(event) => setReabrindoAvaria((atual) => ({ ...atual, justificativa: event.target.value.toUpperCase() }))}
              />
            </label>
            <div className="riv__modal-actions">
              <button type="button" onClick={() => setReabrindoAvaria(null)}>Cancelar</button>
              <button type="submit" className="riv__btn-reabrir" disabled={ocupado}>Confirmar reabertura</button>
            </div>
          </form>
        </div>
      )}

      {visualizandoRegistro && (
        <div className="riv__modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !ocupado) setVisualizandoRegistro(null) }}>
          <section className="riv__modal riv__modal--visualizar">
            <div className="riv__modal-header">
              <div>
                <small>{visualizandoRegistro.tipo}</small>
                <h3>{visualizandoRegistro.titulo}</h3>
              </div>
              <button type="button" onClick={() => setVisualizandoRegistro(null)}>×</button>
            </div>

            <div className="riv__visualizar-grid">
              <div><small>SITUAÇÃO</small><strong>{visualizandoRegistro.resolvida ? 'CONCLUÍDA / FECHADA' : 'ABERTA'}</strong></div>
              <div><small>QUILOMETRAGEM</small><strong>{formatarKm(visualizandoRegistro.quilometragem)}</strong></div>
              <div><small>REGISTRADA EM</small><strong>{new Date(visualizandoRegistro.created_at).toLocaleString('pt-BR')}</strong></div>
              <div><small>REGISTRADA POR</small><strong>{visualizandoRegistro.criado_por_nome || '—'}</strong></div>
              {visualizandoRegistro.resolvida_em && <div><small>CONCLUÍDA EM</small><strong>{new Date(visualizandoRegistro.resolvida_em).toLocaleString('pt-BR')}</strong></div>}
              {visualizandoRegistro.encerrada_por_nome && <div><small>CONCLUÍDA POR</small><strong>{visualizandoRegistro.encerrada_por_nome}</strong></div>}
            </div>

            {visualizandoRegistro.descricao && (
              <div className="riv__visualizar-descricao">
                <small>DESCRIÇÃO</small>
                <p>{visualizandoRegistro.descricao}</p>
              </div>
            )}

            {visualizandoRegistro.tipo === 'AVARIA' && visualizandoRegistro.providencia_fechamento && (
              <div className="riv__visualizar-descricao riv__visualizar-fechamento">
                <small>PROVIDÊNCIA / SOLUÇÃO DO FECHAMENTO</small>
                <p>{visualizandoRegistro.providencia_fechamento}</p>
                {visualizandoRegistro.observacoes_fechamento && (
                  <>
                    <small>OBSERVAÇÕES DO FECHAMENTO</small>
                    <p>{visualizandoRegistro.observacoes_fechamento}</p>
                  </>
                )}
              </div>
            )}

            <div className="riv__visualizar-fotos">
              <small>FOTOS DO REGISTRO</small>
              <div className="riv__registro-fotos">
                {fotosRiv.filter((foto) => foto.riv_ocorrencia_id === visualizandoRegistro.id).map((foto) => (
                  <button type="button" className="riv__foto-thumb" key={foto.id} onClick={() => setFotoAmpliada(foto)}>
                    <img src={foto.url} alt="Registro do RIV" />
                    <span>{foto.fase_riv === 'DEPOIS' ? 'DEPOIS' : 'ANTES'}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="riv__historico-manut">
              <small>HISTÓRICO DO REGISTRO</small>
              {carregandoHistorico ? (
                <div className="viaturas-vazio">Carregando histórico...</div>
              ) : historicoRegistro.length === 0 ? (
                <div className="viaturas-vazio">Nenhuma alteração de fechamento/reabertura registrada ainda.</div>
              ) : (
                historicoRegistro.map((evento) => (
                  <div className="riv__historico-evento" key={evento.id}>
                    <div><strong>{evento.acao}</strong>{evento.descricao && <p>{evento.descricao}</p>}</div>
                    <span>{new Date(evento.created_at).toLocaleString('pt-BR')}{evento.criado_por_nome ? ` · ${evento.criado_por_nome}` : ''}</span>
                  </div>
                ))
              )}
            </div>

            <div className="riv__modal-actions">
              {visualizandoRegistro.tipo === 'MANUTENCAO' && visualizandoRegistro.resolvida && podeReabrirManutencao && (
                <button type="button" className="riv__btn-reabrir" onClick={() => setReabrindoManutencao({ item: visualizandoRegistro, justificativa: '' })}>
                  Reabrir manutenção
                </button>
              )}
              {visualizandoRegistro.tipo === 'AVARIA' && visualizandoRegistro.resolvida && (
                <button type="button" className="riv__btn-reabrir" onClick={() => setReabrindoAvaria({ item: visualizandoRegistro, justificativa: '' })}>
                  Reabrir avaria
                </button>
              )}
              <button type="button" onClick={() => setVisualizandoRegistro(null)}>Fechar</button>
            </div>
          </section>
        </div>
      )}

      {reabrindoManutencao && (
        <div className="riv__modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !ocupado) setReabrindoManutencao(null) }}>
          <form className="riv__modal" onSubmit={confirmarReabertura}>
            <div className="riv__modal-header">
              <div><small>AUDITORIA DO RIV</small><h3>Reabrir manutenção</h3></div>
              <button type="button" onClick={() => setReabrindoManutencao(null)}>×</button>
            </div>
            <p className="riv__correcao-aviso">A manutenção concluída é um registro bloqueado. A reabertura ficará registrada no histórico e exige justificativa do Comandante de Cia.</p>
            <label className="riv__modal-full">
              <span>Justificativa da reabertura *</span>
              <textarea rows="4" required value={reabrindoManutencao.justificativa} onChange={(event) => setReabrindoManutencao((atual) => ({ ...atual, justificativa: event.target.value.toUpperCase() }))} />
            </label>
            <div className="riv__modal-actions">
              <button type="button" onClick={() => setReabrindoManutencao(null)}>Cancelar</button>
              <button type="submit" className="riv__btn-reabrir" disabled={ocupado}>Confirmar reabertura</button>
            </div>
          </form>
        </div>
      )}

      {fotoAmpliada && (
        <div className="riv__foto-modal" onMouseDown={(event) => { if (event.target === event.currentTarget) setFotoAmpliada(null) }}>
          <button type="button" onClick={() => setFotoAmpliada(null)}>×</button>
          <img src={fotoAmpliada.url} alt="Foto do registro do RIV" />
          <span>{fotoAmpliada.fase_riv === 'DEPOIS' ? 'DEPOIS DO REPARO' : 'REGISTRO / ANTES'}</span>
        </div>
      )}

      {correcaoKm && (
        <div className="riv__modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !ocupado) setCorrecaoKm(null) }}>
          <form className="riv__modal" onSubmit={salvarCorrecaoKm}>
            <div className="riv__modal-header">
              <div><small>AUDITORIA DO RIV</small><h3>Corrigir quilometragem</h3></div>
              <button type="button" onClick={() => setCorrecaoKm(null)}>×</button>
            </div>
            <p className="riv__correcao-aviso">O lançamento anterior não será apagado. A correção ficará registrada permanentemente no histórico.</p>
            <div className="riv__modal-grid">
              <label><span>KM atual</span><input value={dados.quilometragemAtual} disabled /></label>
              <label><span>KM correto</span><input type="number" min="0" required value={correcaoKm.quilometragem} onChange={(event) => setCorrecaoKm((atual) => ({ ...atual, quilometragem: event.target.value }))} /></label>
            </div>
            <label className="riv__modal-full"><span>Motivo da correção *</span><textarea rows="3" required value={correcaoKm.justificativa} onChange={(event) => setCorrecaoKm((atual) => ({ ...atual, justificativa: event.target.value.toUpperCase() }))} placeholder="Ex.: zero digitado a mais" /></label>
            <div className="riv__modal-actions"><button type="button" onClick={() => setCorrecaoKm(null)}>Cancelar</button><button type="submit" disabled={ocupado}>Confirmar correção</button></div>
          </form>
        </div>
      )}

      {editandoItem && formManut && (
        <div
          className="riv__modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !ocupado) {
              setEditandoItem(null)
              setFormManut(null)
            }
          }}
        >
          <form className="riv__modal" onSubmit={salvarManut}>
            <div className="riv__modal-header">
              <div>
                <small>MANUTENÇÃO PREVENTIVA</small>
                <h3>{editandoItem.label}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditandoItem(null)
                  setFormManut(null)
                }}
              >
                ×
              </button>
            </div>

            {editandoItem.personalizado && (
              <label className="riv__modal-full">
                <span>Nome do item</span>
                <input required value={formManut.nomeItem} onChange={(event) => setFormManut((atual) => ({ ...atual, nomeItem: event.target.value.toUpperCase() }))} placeholder="Ex.: Pneus, correia, filtro de combustível" />
              </label>
            )}

            <div className="riv__modal-grid">
              <label>
                <span>Última data</span>
                <input
                  type="date"
                  value={formManut.ultimaData}
                  onChange={(event) =>
                    setFormManut((atual) => ({
                      ...atual,
                      ultimaData: event.target.value
                    }))
                  }
                />
              </label>

              <label>
                <span>Última km</span>
                <input
                  type="number"
                  min="0"
                  value={formManut.ultimaKm}
                  onChange={(event) =>
                    setFormManut((atual) => ({
                      ...atual,
                      ultimaKm: event.target.value
                    }))
                  }
                />
              </label>

              <label>
                <span>Próxima data</span>
                <input
                  type="date"
                  value={formManut.proximaData}
                  onChange={(event) =>
                    setFormManut((atual) => ({
                      ...atual,
                      proximaData: event.target.value
                    }))
                  }
                />
              </label>

              <label>
                <span>Próxima km</span>
                <input
                  type="number"
                  min="0"
                  value={formManut.proximaKm}
                  onChange={(event) =>
                    setFormManut((atual) => ({
                      ...atual,
                      proximaKm: event.target.value
                    }))
                  }
                />
              </label>

              <label>
                <span>Alertar faltando km</span>
                <input
                  type="number"
                  min="0"
                  value={formManut.margemAlertaKm}
                  onChange={(event) =>
                    setFormManut((atual) => ({
                      ...atual,
                      margemAlertaKm: event.target.value
                    }))
                  }
                />
              </label>

              <label>
                <span>Alertar faltando dias</span>
                <input
                  type="number"
                  min="0"
                  value={formManut.margemAlertaDias}
                  onChange={(event) =>
                    setFormManut((atual) => ({
                      ...atual,
                      margemAlertaDias: event.target.value
                    }))
                  }
                />
              </label>
            </div>

            <label className="riv__modal-full">
              <span>Observações</span>
              <textarea
                rows="3"
                value={formManut.observacoes}
                onChange={(event) =>
                  setFormManut((atual) => ({
                    ...atual,
                    observacoes: event.target.value.toUpperCase()
                  }))
                }
              />
            </label>

            <div className="riv__modal-actions">
              <button
                type="button"
                onClick={() => {
                  setEditandoItem(null)
                  setFormManut(null)
                }}
              >
                Cancelar
              </button>
              <button type="submit" disabled={ocupado}>
                Salvar programação
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
