import { useEffect, useMemo, useState } from 'react'

import {
  criarSolicitacaoManutencaoExterna,
  listarHTsElegiveisManutencaoExterna,
  listarManutencoesExternas
} from '../../../services/manutencoesExternasService'

import '../styles/HTManutencaoExternaModal.css'

function textoMaiusculo(valor) {
  return String(valor || '').toUpperCase()
}

function formatarTelefone(valor) {
  const numeros = String(valor || '').replace(/\D/g, '').slice(0, 11)

  if (!numeros) return ''
  if (numeros.length <= 2) return `(${numeros}`
  if (numeros.length <= 6) return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`
  if (numeros.length <= 10) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`
  }

  return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`
}

export default function HTManutencaoExternaModal({
  user = null,
  manutencaoInicial = null,
  onClose,
  onCreated
}) {
  const [manutencoes, setManutencoes] = useState([])
  const [selecionados, setSelecionados] = useState([])
  const [pesquisa, setPesquisa] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const [destinoNome, setDestinoNome] = useState('')
  const [destinoTipo, setDestinoTipo] = useState('ASSISTÊNCIA TÉCNICA')
  const [destinoEndereco, setDestinoEndereco] = useState('')
  const [destinoContato, setDestinoContato] = useState('')
  const [tipoDocumento, setTipoDocumento] = useState('OFÍCIO')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [dataDocumento, setDataDocumento] = useState('')
  const [motivo, setMotivo] = useState('')
  const [servicoSolicitado, setServicoSolicitado] = useState('')
  const [previsaoRetorno, setPrevisaoRetorno] = useState('')
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        setCarregando(true)
        setErro('')
        const [itens, externasResposta] = await Promise.all([
          listarHTsElegiveisManutencaoExterna(),
          listarManutencoesExternas({
            modulo: 'HT',
            pagina: 1,
            limite: 5000
          })
        ])

        const externas =
          externasResposta?.data ||
          externasResposta?.itens ||
          externasResposta ||
          []

        const manutencoesExternasAtivas = new Set()

        for (const externa of externas) {
          const status = textoMaiusculo(externa?.status).trim()

          if (['CONCLUIDA', 'CANCELADA', 'REPROVADA'].includes(status)) {
            continue
          }

          const itensExternos = [
            externa,
            ...(externa?.itens || []),
            ...(externa?.sigmo_manutencoes_externas_itens || [])
          ]

          for (const itemExterno of itensExternos) {
            const manutencaoId =
              itemExterno?.manutencao_id ||
              itemExterno?.manutencao_interna_id ||
              null

            if (manutencaoId) {
              manutencoesExternasAtivas.add(String(manutencaoId))
            }
          }
        }

        const elegiveis = (itens || []).filter(
          (item) => !manutencoesExternasAtivas.has(String(item?.id || ''))
        )

        if (ativo) {
          setManutencoes(elegiveis)

          if (manutencaoInicial?.id) {
            const idInicial = String(manutencaoInicial.id)
            const estaElegivel = elegiveis.some(
              (item) => String(item?.id || '') === idInicial
            )

            setSelecionados(estaElegivel ? [manutencaoInicial.id] : [])
          }
        }
      } catch (error) {
        if (ativo) setErro(error?.message || 'Não foi possível carregar os HTs em manutenção.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [manutencaoInicial?.id])

  const filtradas = useMemo(() => {
    const termo = textoMaiusculo(pesquisa).trim()
    if (!termo) return manutencoes

    return manutencoes.filter((item) =>
      [
        item.patrimonio,
        item.numero_serie,
        item.marca,
        item.modelo,
        item.tipo_novidade,
        item.descricao
      ]
        .filter(Boolean)
        .some((valor) => textoMaiusculo(valor).includes(termo))
    )
  }, [manutencoes, pesquisa])

  function alternar(id) {
    setSelecionados((atuais) =>
      atuais.includes(id)
        ? atuais.filter((item) => item !== id)
        : [...atuais, id]
    )
  }

  function selecionarVisiveis() {
    const ids = filtradas.map((item) => item.id)
    setSelecionados((atuais) => [...new Set([...atuais, ...ids])])
  }

  async function confirmar(event) {
    event.preventDefault()

    const itens = manutencoes.filter((item) => selecionados.includes(item.id))

    if (itens.length === 0) {
      setErro('Selecione ao menos um HT.')
      return
    }

    if (!destinoNome.trim()) {
      setErro('Informe a assistência ou local de destino.')
      return
    }

    if (!servicoSolicitado.trim() && !motivo.trim()) {
      setErro('Informe o motivo ou o serviço solicitado.')
      return
    }

    try {
      setSalvando(true)
      setErro('')

      const solicitacao = await criarSolicitacaoManutencaoExterna({
        manutencoes: itens,
        destinoNome,
        destinoTipo,
        destinoEndereco,
        destinoContato,
        tipoDocumento,
        numeroDocumento,
        dataDocumento: dataDocumento || null,
        motivo,
        servicoSolicitado,
        observacoesSaida: observacoes,
        previsaoRetorno: previsaoRetorno
          ? new Date(previsaoRetorno).toISOString()
          : null,
        user
      })

      await onCreated?.(solicitacao)
      onClose?.()
    } catch (error) {
      setErro(error?.message || 'Não foi possível criar a solicitação.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div
      className="ht-modal-backdrop ht-external-maintenance-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !salvando) onClose?.()
      }}
    >
      <form className="ht-external-maintenance-modal" onSubmit={confirmar}>
        <header>
          <div>
            <span>MANUTENÇÃO EXTERNA</span>
            <h2>Enviar HTs para assistência externa</h2>
            <p>
              O material permanece em manutenção interna até a aprovação do Cmt de Cia.
            </p>
          </div>

          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            disabled={salvando}
          >
            ×
          </button>
        </header>

        <div className="ht-external-maintenance-body">
          {erro && <div className="ht-alert-error">{erro}</div>}

          <section className="ht-external-section">
            <div className="ht-external-section-title">
              <span>1</span>
              <div>
                <strong>Destino da assistência</strong>
                <small>Informe para onde os equipamentos serão encaminhados.</small>
              </div>
            </div>

            <div className="ht-external-fields-grid">
              <label className="ht-external-field ht-external-field-wide">
                <span>Assistência / destino *</span>
                <input
                  value={destinoNome}
                  onChange={(event) => setDestinoNome(textoMaiusculo(event.target.value))}
                  placeholder="NOME DA EMPRESA, ÓRGÃO OU ASSISTÊNCIA"
                  disabled={salvando}
                />
              </label>

              <label className="ht-external-field">
                <span>Tipo de destino</span>
                <input
                  value={destinoTipo}
                  onChange={(event) => setDestinoTipo(textoMaiusculo(event.target.value))}
                  disabled={salvando}
                />
              </label>

              <label className="ht-external-field">
                <span>Contato</span>
                <input
                  value={destinoContato}
                  onChange={(event) => setDestinoContato(formatarTelefone(event.target.value))}
                  inputMode="numeric"
                  maxLength={15}
                  placeholder="(11) 99999-9999"
                  disabled={salvando}
                />
              </label>

              <label className="ht-external-field ht-external-field-wide">
                <span>Endereço</span>
                <input
                  value={destinoEndereco}
                  onChange={(event) => setDestinoEndereco(textoMaiusculo(event.target.value))}
                  disabled={salvando}
                />
              </label>
            </div>
          </section>

          <section className="ht-external-section">
            <div className="ht-external-section-title">
              <span>2</span>
              <div>
                <strong>Documento de encaminhamento</strong>
                <small>Registre o documento relacionado à saída.</small>
              </div>
            </div>

            <div className="ht-external-fields-grid ht-external-document-grid">
              <label className="ht-external-field">
                <span>Tipo de documento</span>
                <select
                  value={tipoDocumento}
                  onChange={(event) => setTipoDocumento(event.target.value)}
                  disabled={salvando}
                >
                  <option value="OFÍCIO">OFÍCIO</option>
                  <option value="MEMORANDO">MEMORANDO</option>
                  <option value="GUIA">GUIA</option>
                  <option value="OUTRO">OUTRO</option>
                </select>
              </label>

              <label className="ht-external-field">
                <span>Número do documento</span>
                <input
                  value={numeroDocumento}
                  onChange={(event) => setNumeroDocumento(textoMaiusculo(event.target.value))}
                  disabled={salvando}
                />
              </label>

              <label className="ht-external-field">
                <span>Data do documento</span>
                <input
                  type="date"
                  value={dataDocumento}
                  onChange={(event) => setDataDocumento(event.target.value)}
                  disabled={salvando}
                />
              </label>

              <label className="ht-external-field">
                <span>Previsão de retorno</span>
                <input
                  type="datetime-local"
                  value={previsaoRetorno}
                  onChange={(event) => setPrevisaoRetorno(event.target.value)}
                  disabled={salvando}
                />
              </label>
            </div>
          </section>

          <section className="ht-external-section">
            <div className="ht-external-section-title">
              <span>3</span>
              <div>
                <strong>Solicitação técnica</strong>
                <small>Descreva o motivo e o serviço que deverá ser realizado.</small>
              </div>
            </div>

            <div className="ht-external-textareas">
              <label className="ht-external-field">
                <span>Motivo</span>
                <textarea
                  rows="3"
                  value={motivo}
                  onChange={(event) => setMotivo(textoMaiusculo(event.target.value))}
                  disabled={salvando}
                />
              </label>

              <label className="ht-external-field">
                <span>Serviço solicitado *</span>
                <textarea
                  rows="3"
                  value={servicoSolicitado}
                  onChange={(event) => setServicoSolicitado(textoMaiusculo(event.target.value))}
                  placeholder="DESCREVA O SERVIÇO SOLICITADO À ASSISTÊNCIA."
                  disabled={salvando}
                />
              </label>

              <label className="ht-external-field">
                <span>Observações da saída</span>
                <textarea
                  rows="3"
                  value={observacoes}
                  onChange={(event) => setObservacoes(textoMaiusculo(event.target.value))}
                  disabled={salvando}
                />
              </label>
            </div>
          </section>

          <section className="ht-external-section ht-external-materials-section">
            <div className="ht-external-materials-head">
              <div className="ht-external-section-title">
                <span>4</span>
                <div>
                  <strong>HTs em manutenção no P4</strong>
                  <small>Selecione um ou vários equipamentos para este envio.</small>
                </div>
              </div>

              <button
                type="button"
                className="ht-btn-secondary"
                onClick={selecionarVisiveis}
                disabled={salvando || filtradas.length === 0}
              >
                Selecionar visíveis
              </button>
            </div>

            <input
              className="ht-external-search"
              type="search"
              value={pesquisa}
              onChange={(event) => setPesquisa(event.target.value)}
              placeholder="Pesquisar patrimônio, série, marca, modelo ou defeito"
              disabled={salvando}
            />

            <div className="ht-external-materials-list">
              {carregando ? (
                <div className="ht-transfer-empty">Carregando HTs em manutenção...</div>
              ) : filtradas.length === 0 ? (
                <div className="ht-transfer-empty">
                  Nenhum HT do P4 está elegível para manutenção externa.
                </div>
              ) : (
                filtradas.map((item) => (
                  <label key={item.id} className="ht-external-material-item">
                    <input
                      type="checkbox"
                      checked={selecionados.includes(item.id)}
                      onChange={() => alternar(item.id)}
                      disabled={salvando}
                    />

                    <div>
                      <strong>{item.patrimonio || item.numero_serie || 'HT'}</strong>
                      <span>
                        {[item.marca, item.modelo].filter(Boolean).join(' ') || 'RÁDIO HT'}
                      </span>
                      <small>
                        Série: {item.numero_serie || '—'} · Defeito:{' '}
                        {item.descricao || item.tipo_novidade || '—'}
                      </small>
                    </div>
                  </label>
                ))
              )}
            </div>
          </section>
        </div>

        <footer>
          <span>{selecionados.length} selecionado(s)</span>

          <button
            type="button"
            className="ht-btn-secondary"
            onClick={onClose}
            disabled={salvando}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="ht-btn-primary"
            disabled={salvando || selecionados.length === 0}
          >
            {salvando ? 'Enviando...' : 'Enviar para aprovação do Cmt de Cia'}
          </button>
        </footer>
      </form>
    </div>
  )
}
