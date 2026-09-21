import { useEffect, useMemo, useState } from 'react'

import { listarFotosTaser } from '../../../services/tasersFotosService'
import {
  listarFotosManutencao,
  listarManutencoes
} from '../../../services/manutencoesService'

import '../styles/TaserManutencaoModal.css'

const TIPOS_NOVIDADE = [
  'MANUTENÇÃO PREVENTIVA',
  'MANUTENÇÃO CORRETIVA',
  'DEFEITO NO ÁUDIO',
  'DEFEITO NA TRANSMISSÃO',
  'DEFEITO NA RECEPÇÃO',
  'BATERIA / ALIMENTAÇÃO',
  'DANO FÍSICO',
  'OUTRA NOVIDADE'
]

function formatarData(valor) {
  if (!valor) return '—'

  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return '—'

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(data)
}

export default function TaserManutencaoModal({
  taser,
  salvando = false,
  onClose,
  onConfirm
}) {
  const [tipoNovidade, setTipoNovidade] = useState('MANUTENÇÃO CORRETIVA')
  const [descricao, setDescricao] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [fotos, setFotos] = useState([])
  const [erro, setErro] = useState('')

  const [fotosCadastro, setFotosCadastro] = useState([])
  const [historico, setHistorico] = useState([])
  const [fotosUltimaManutencao, setFotosUltimaManutencao] = useState([])
  const [carregandoContexto, setCarregandoContexto] = useState(false)

  useEffect(() => {
    if (!taser?.id) return

    let ativo = true

    async function carregarContexto() {
      try {
        setCarregandoContexto(true)

        const [fotosCadastrais, manutencoesResultado] = await Promise.all([
          listarFotosTaser(taser.id),
          listarManutencoes({
            modulo: 'TASER',
            status: null,
            referenciaId: taser.id,
            pagina: 1,
            limite: 50
          })
        ])

        if (!ativo) return

        const manutencoes = manutencoesResultado?.data || []
        setFotosCadastro(Array.isArray(fotosCadastrais) ? fotosCadastrais : [])
        setHistorico(manutencoes)

        if (manutencoes[0]?.id) {
          const fotosUltima = await listarFotosManutencao(manutencoes[0].id)
          if (ativo) setFotosUltimaManutencao(fotosUltima || [])
        } else {
          setFotosUltimaManutencao([])
        }
      } catch (error) {
        console.warn('Não foi possível carregar o contexto de manutenção do Taser:', error)
      } finally {
        if (ativo) setCarregandoContexto(false)
      }
    }

    setTipoNovidade('MANUTENÇÃO CORRETIVA')
    setDescricao('')
    setObservacoes('')
    setFotos([])
    setErro('')
    setFotosCadastro([])
    setHistorico([])
    setFotosUltimaManutencao([])
    carregarContexto()

    return () => {
      ativo = false
    }
  }, [taser?.id])

  const ultimaManutencao = historico[0] || null

  const fotoCadastroPrincipal = useMemo(
    () => fotosCadastro.find((foto) => foto.principal) || fotosCadastro[0] || null,
    [fotosCadastro]
  )

  if (!taser) return null

  function selecionarFotos(event) {
    const arquivos = Array.from(event.target.files || [])
    const invalidos = arquivos.filter((arquivo) => !arquivo.type?.startsWith('image/'))

    if (invalidos.length) {
      setErro('Selecione apenas arquivos de imagem.')
      event.target.value = ''
      return
    }

    const grandes = arquivos.filter(
      (arquivo) => Number(arquivo.size || 0) > 5 * 1024 * 1024
    )

    if (grandes.length) {
      setErro('Cada foto deve possuir no máximo 5 MB.')
      event.target.value = ''
      return
    }

    setErro('')
    setFotos(arquivos.slice(0, 6))
  }

  async function confirmar(event) {
    event.preventDefault()

    if (!descricao.trim()) {
      setErro('Informe a descrição da novidade ou do defeito.')
      return
    }

    setErro('')

    await onConfirm?.({
      tipoNovidade,
      descricao: descricao.trim(),
      observacoes: observacoes.trim(),
      fotos
    })
  }

  const identificacao = taser.patrimonio || taser.numero_serie || 'TASER'

  return (
    <div
      className="taser-manutencao-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !salvando) onClose?.()
      }}
    >
      <form className="taser-manutencao-modal" onSubmit={confirmar}>
        <header>
          <div>
            <span>CONTROLE DE MANUTENÇÃO</span>
            <h2>Enviar Taser para manutenção</h2>
            <p>
              {identificacao} ·{' '}
              {[taser.marca, taser.modelo].filter(Boolean).join(' ') || 'Dispositivo Taser'}
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

        <div className="taser-manutencao-corpo">
          <section className="taser-manutencao-contexto">
            <div className="taser-manutencao-identificacao">
              <div>
                <span>Patrimônio</span>
                <strong>{taser.patrimonio || '—'}</strong>
              </div>
              <div>
                <span>Número de série</span>
                <strong>{taser.numero_serie || '—'}</strong>
              </div>
              <div>
                <span>Status atual</span>
                <strong>{taser.status_operacional || '—'}</strong>
              </div>
              <div>
                <span>Local atual</span>
                <strong>{taser.local_atual || '—'}</strong>
              </div>
            </div>

            <div className="taser-manutencao-contexto-grid">
              <article className="taser-manutencao-contexto-card">
                <span>Foto cadastral</span>
                {fotoCadastroPrincipal ? (
                  <img
                    src={fotoCadastroPrincipal.url}
                    alt={`Foto cadastral do Taser ${identificacao}`}
                  />
                ) : (
                  <div className="taser-manutencao-sem-foto">Sem foto cadastral</div>
                )}
              </article>

              <article className="taser-manutencao-contexto-card taser-manutencao-ultima">
                <span>Última manutenção</span>

                {carregandoContexto ? (
                  <div className="taser-manutencao-sem-historico">Carregando histórico...</div>
                ) : ultimaManutencao ? (
                  <>
                    <strong>{ultimaManutencao.tipo_novidade || 'MANUTENÇÃO'}</strong>
                    <p>{ultimaManutencao.descricao || 'Sem descrição registrada.'}</p>
                    <small>
                      Entrada: {formatarData(ultimaManutencao.registrada_em)} ·{' '}
                      Status: {ultimaManutencao.status || '—'}
                    </small>

                    {fotosUltimaManutencao.length > 0 && (
                      <div className="taser-manutencao-fotos-anteriores">
                        {fotosUltimaManutencao.slice(0, 4).map((foto) => (
                          <img
                            key={foto.id}
                            src={foto.foto_url}
                            alt="Foto da última manutenção"
                          />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="taser-manutencao-sem-historico">
                    Este Taser ainda não possui manutenção registrada.
                  </div>
                )}
              </article>
            </div>
          </section>

          <div className="taser-manutencao-aviso">
            <strong>Nova ocorrência independente</strong>
            <span>
              As informações e fotos abaixo serão salvas no histórico da manutenção.
              Elas não alteram as observações nem as fotos cadastrais do Taser.
            </span>
          </div>

          {erro && <div className="taser-manutencao-erro">{erro}</div>}

          <label>
            <span>Tipo de novidade</span>
            <select
              value={tipoNovidade}
              onChange={(event) => setTipoNovidade(event.target.value)}
              disabled={salvando}
            >
              {TIPOS_NOVIDADE.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Descrição do defeito *</span>
            <textarea
              rows="4"
              value={descricao}
              onChange={(event) => setDescricao(event.target.value.toUpperCase())}
              placeholder="Descreva o defeito, dano ou motivo do envio."
              disabled={salvando}
            />
          </label>

          <label>
            <span>Observações desta manutenção</span>
            <textarea
              rows="3"
              value={observacoes}
              onChange={(event) => setObservacoes(event.target.value.toUpperCase())}
              placeholder="Acessórios entregues, condição do equipamento ou informação complementar desta ocorrência."
              disabled={salvando}
            />
          </label>

          <label className="taser-manutencao-fotos">
            <span>Fotos desta ocorrência</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={selecionarFotos}
              disabled={salvando}
            />
            <small>
              Essas imagens serão salvas somente na manutenção. Até 6 fotos, com no
              máximo 5 MB cada.
            </small>
          </label>

          {fotos.length > 0 && (
            <div className="taser-manutencao-arquivos">
              {fotos.map((foto) => (
                <span key={`${foto.name}-${foto.size}`}>{foto.name}</span>
              ))}
            </div>
          )}
        </div>

        <footer>
          <button
            type="button"
            className="taser-btn-secondary"
            onClick={onClose}
            disabled={salvando}
          >
            Cancelar
          </button>
          <button type="submit" className="taser-btn-primary" disabled={salvando}>
            {salvando ? 'Enviando...' : 'Confirmar envio para manutenção'}
          </button>
        </footer>
      </form>
    </div>
  )
}
