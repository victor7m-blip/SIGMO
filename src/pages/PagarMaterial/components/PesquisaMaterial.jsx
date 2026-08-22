import { useEffect, useMemo, useState } from 'react'

import {
  listarPatrimoniosParaEntrega
} from '../../../services/pagarMaterialService'

import {
  buscarArmaPorId
} from '../../../services/armasService'

import {
  listarFotosArma
} from '../../../services/armasFotosService'

import {
  buscarHTPorId
} from '../../../services/htsService'

import {
  listarFotosHT
} from '../../../services/htsFotosService'

import {
  buscarTaserPorId
} from '../../../services/tasersService'

import {
  listarFotosTaser
} from '../../../services/tasersFotosService'

import {
  buscarTPDPorId
} from '../../../services/tpdsService'

import {
  listarFotosTPD
} from '../../../services/tpdsFotosService'

import ArmaViewModal
  from '../../Armas/components/ArmaViewModal'

import HTDetalhesModal
  from '../../HT/components/HTDetalhesModal'

import TaserDetalhesModal
  from '../../Taser/components/TaserDetalhesModal'

import TPDDetalhesModal
  from '../../TPD/components/TPDDetalhesModal'

const MOSTRAR_COLUNA_PATRIMONIO = false

function normalizarTexto(valor) {
  return String(valor || '').trim().toUpperCase()
}

function ehArma(material) {
  return (
    normalizarTexto(material?.modulo) === 'ARMAS' ||
    normalizarTexto(material?.categoria) === 'ARMA' ||
    normalizarTexto(material?.tabela_origem) === 'SIGMO_ARMAS'
  )
}

function ehHT(material) {
  return (
    normalizarTexto(material?.modulo) === 'HT' ||
    normalizarTexto(material?.categoria) === 'HT' ||
    normalizarTexto(material?.tipo) === 'HT' ||
    normalizarTexto(material?.tabela_origem) === 'SIGMO_HTS'
  )
}

function ehTaser(material) {
  const campos = [
    material?.modulo,
    material?.categoria,
    material?.tipo,
    material?.tipo_patrimonio,
    material?.tipo_material,
    material?.tabela_origem
  ].map(normalizarTexto)

  const descricao = normalizarTexto(material?.descricao)

  return (
    campos.includes('TASER') ||
    campos.includes('TASERS') ||
    campos.includes('SIGMO_TASERS') ||
    descricao === 'TASER' ||
    descricao.startsWith('TASER ') ||
    descricao.startsWith('TASER •') ||
    descricao.includes(' TASER ')
  )
}

function ehTPD(material) {
  const campos = [
    material?.modulo,
    material?.categoria,
    material?.tipo,
    material?.tipo_patrimonio,
    material?.tipo_material,
    material?.tabela_origem
  ].map(normalizarTexto)

  const descricao = normalizarTexto(material?.descricao)

  return (
    campos.includes('TPD') ||
    campos.includes('TPDS') ||
    campos.includes('SIGMO_TPDS') ||
    descricao === 'TPD' ||
    descricao.startsWith('TPD ') ||
    descricao.startsWith('TPD •') ||
    descricao.includes(' TPD ')
  )
}

function ehTonfa(material) {
  const campos = [
    material?.modulo,
    material?.categoria,
    material?.tipo,
    material?.tipo_patrimonio,
    material?.tipo_material,
    material?.descricao
  ].map(normalizarTexto)

  return campos.some((valor) => valor.includes('TONFA'))
}

function ehCassetete(material) {
  const campos = [
    material?.modulo,
    material?.categoria,
    material?.tipo,
    material?.tipo_patrimonio,
    material?.tipo_material,
    material?.descricao
  ].map(normalizarTexto)

  return campos.some((valor) => valor.includes('CASSETETE'))
}

function correspondeFiltro(material, filtro) {
  switch (filtro) {
    case 'ARMAS':
      return ehArma(material)
    case 'HT':
      return ehHT(material)
    case 'TASER':
      return ehTaser(material)
    case 'TPD':
      return ehTPD(material)
    case 'TONFA':
      return ehTonfa(material)
    case 'CASSETETE':
      return ehCassetete(material)
    default:
      return true
  }
}

function descricaoResumida(material) {
  if (!ehArma(material)) {
    return material?.descricao || material?.categoria || 'MATERIAL'
  }

  const partes = [
    material?.especie || 'ARMA',
    material?.marca,
    material?.patrimonio || material?.numero_serie
  ]
    .map(normalizarTexto)
    .filter(Boolean)

  return [...new Set(partes)].join(' • ')
}

export default function PesquisaMaterial({
  origemLocal,
  itensSelecionados = [],
  onAdicionar,
  onAbrirQrCode,
  atualizarEm = 0
}) {
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('TODOS')
  const [materiais, setMateriais] = useState([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const [armaVisualizando, setArmaVisualizando] = useState(null)
  const [fotosArma, setFotosArma] = useState([])
  const [htVisualizando, setHTVisualizando] = useState(null)
  const [fotosHT, setFotosHT] = useState([])
  const [taserVisualizando, setTaserVisualizando] = useState(null)
  const [fotosTaser, setFotosTaser] = useState([])
  const [tpdVisualizando, setTPDVisualizando] = useState(null)
  const [fotosTPD, setFotosTPD] = useState([])
  const [carregandoVisualizacao, setCarregandoVisualizacao] = useState(false)
  const [erroVisualizacao, setErroVisualizacao] = useState('')

  useEffect(() => {
    carregarMateriais()
  }, [atualizarEm, origemLocal])

  async function carregarMateriais() {
    try {
      setLoading(true)
      setErro('')
      const resultado = await listarPatrimoniosParaEntrega({ origemLocal })
      setMateriais(resultado)
    } catch (error) {
      console.error(error)
      setErro('Não foi possível carregar os materiais.')
    } finally {
      setLoading(false)
    }
  }

  const resultados = useMemo(() => {
    const termo = normalizarTexto(busca)

    return materiais.filter((material) => {
      if (!correspondeFiltro(material, filtroTipo)) {
        return false
      }

      if (!termo) {
        return true
      }

      return [
        material.patrimonio,
        material.descricao,
        descricaoResumida(material),
        material.local_atual,
        material.status,
        material.numero_serie,
        material.qr_code,
        material.especie,
        material.marca,
        material.modelo
      ].some((valor) => normalizarTexto(valor).includes(termo))
    })
  }, [busca, filtroTipo, materiais])

  function estaSelecionado(material) {
    return itensSelecionados.some(
      (item) =>
        item.id === material.id &&
        item.tabela_origem === material.tabela_origem
    )
  }

  async function visualizarMaterial(material) {
    const tabelaOrigem = normalizarTexto(material?.tabela_origem)

    const referenciaId =
      material?.referencia_id ||
      (
        ['SIGMO_ARMAS', 'SIGMO_HTS', 'SIGMO_TASERS', 'SIGMO_TPDS'].includes(tabelaOrigem)
          ? material?.id
          : null
      )

    if (!referenciaId) {
      setErro('Não foi possível identificar o material para visualização.')
      return
    }

    try {
      setCarregandoVisualizacao(true)
      setErroVisualizacao('')

      if (ehArma(material)) {
        setFotosArma([])

        const [armaCompleta, fotos] = await Promise.all([
          buscarArmaPorId(referenciaId),
          listarFotosArma(referenciaId)
        ])

        setHTVisualizando(null)
        setFotosHT([])
        setTaserVisualizando(null)
        setFotosTaser([])
        setTPDVisualizando(null)
        setFotosTPD([])
        setArmaVisualizando(armaCompleta)
        setFotosArma(fotos || [])
        return
      }

      if (ehHT(material)) {
        setFotosHT([])

        const [htCompleto, fotos] = await Promise.all([
          buscarHTPorId(referenciaId),
          listarFotosHT(referenciaId)
        ])

        setArmaVisualizando(null)
        setFotosArma([])
        setTaserVisualizando(null)
        setFotosTaser([])
        setTPDVisualizando(null)
        setFotosTPD([])
        setHTVisualizando(htCompleto)
        setFotosHT(Array.isArray(fotos) ? fotos : [])
        return
      }

      if (ehTaser(material)) {
        setFotosTaser([])

        const [taserCompleto, fotos] = await Promise.all([
          buscarTaserPorId(referenciaId),
          listarFotosTaser(referenciaId)
        ])

        setArmaVisualizando(null)
        setFotosArma([])
        setHTVisualizando(null)
        setFotosHT([])
        setTPDVisualizando(null)
        setFotosTPD([])
        setTaserVisualizando(taserCompleto)
        setFotosTaser(Array.isArray(fotos) ? fotos : [])
        return
      }

      if (ehTPD(material)) {
        setFotosTPD([])

        const [tpdCompleto, fotos] = await Promise.all([
          buscarTPDPorId(referenciaId),
          listarFotosTPD(referenciaId)
        ])

        setArmaVisualizando(null)
        setFotosArma([])
        setHTVisualizando(null)
        setFotosHT([])
        setTaserVisualizando(null)
        setFotosTaser([])
        setTPDVisualizando(tpdCompleto)
        setFotosTPD(Array.isArray(fotos) ? fotos : [])
        return
      }
    } catch (error) {
      console.error('Erro ao visualizar material:', error)
      setErro(
        error?.message ||
        'Não foi possível abrir os detalhes do material.'
      )
      setArmaVisualizando(null)
      setFotosArma([])
      setHTVisualizando(null)
      setFotosHT([])
      setTaserVisualizando(null)
      setFotosTaser([])
      setTPDVisualizando(null)
      setFotosTPD([])
    } finally {
      setCarregandoVisualizacao(false)
    }
  }

  function fecharVisualizacao() {
    setArmaVisualizando(null)
    setFotosArma([])
    setHTVisualizando(null)
    setFotosHT([])
    setTaserVisualizando(null)
    setFotosTaser([])
    setTPDVisualizando(null)
    setFotosTPD([])
    setErroVisualizacao('')
  }

  return (
    <>
      <section className="pagar-material-card">
        <div className="pagar-material-card-header">
          <div>
            <span>ETAPA 2</span>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap'
              }}
            >
              <h2 style={{ margin: 0 }}>Selecionar materiais</h2>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  flexWrap: 'wrap'
                }}
                aria-label="Filtrar materiais por tipo"
              >
                {[
                  ['TODOS', 'Todos'],
                  ['ARMAS', 'Armas'],
                  ['HT', 'HT'],
                  ['TASER', 'Taser'],
                  ['TPD', 'TPD'],
                  ['TONFA', 'Tonfa'],
                  ['CASSETETE', 'Cassetete']
                ].map(([valor, rotulo]) => {
                  const ativo = filtroTipo === valor

                  return (
                    <button
                      key={valor}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() => setFiltroTipo(valor)}
                      style={{
                        minHeight: '28px',
                        padding: '4px 9px',
                        borderRadius: '8px',
                        border: ativo
                          ? '1px solid #155eef'
                          : '1px solid #cbd5e1',
                        background: ativo ? '#155eef' : '#ffffff',
                        color: ativo ? '#ffffff' : '#334155',
                        fontSize: '12px',
                        fontWeight: 700,
                        lineHeight: 1,
                        cursor: 'pointer'
                      }}
                    >
                      {rotulo}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="pagar-material-results-head">
            <strong className="pagar-material-count">
              {resultados.length} encontrados
            </strong>

            <button
              type="button"
              className="pagar-material-refresh"
              disabled={loading}
              onClick={carregarMateriais}
            >
              {loading ? 'Atualizando...' : 'Atualizar'}
            </button>
          </div>
        </div>

        <div className="pagar-material-search">
          <input
            value={busca}
            onChange={(event) =>
              setBusca(event.target.value.toUpperCase())
            }
            placeholder="Pesquisar patrimônio, série, descrição ou local"
          />

          <button type="button" onClick={onAbrirQrCode}>
            Ler QR Code
          </button>
        </div>

        {erro && (
          <div className="pagar-material-inline-error">
            {erro}
          </div>
        )}

        <div className="pagar-material-table-wrap">
          <table className="pagar-material-table">
            <thead>
              <tr>
                {MOSTRAR_COLUNA_PATRIMONIO && (
                  <th>Patrimônio / Material</th>
                )}
                <th>Descrição</th>
                <th>Local</th>
                <th>Disponível</th>
                <th>Status</th>
                <th aria-label="Ações" />
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={MOSTRAR_COLUNA_PATRIMONIO ? 6 : 5}
                    className="pagar-material-table-empty"
                  >
                    Carregando materiais...
                  </td>
                </tr>
              ) : resultados.map((material) => {
                const selecionado = estaSelecionado(material)
                const permiteVisualizar = ehArma(material) || ehHT(material) || ehTaser(material) || ehTPD(material)

                return (
                  <tr
                    key={[
                      material.tabela_origem,
                      material.id
                    ].join('-')}
                  >
                    {MOSTRAR_COLUNA_PATRIMONIO && (
                      <td>
                        <strong>{material.patrimonio}</strong>
                      </td>
                    )}

                    <td>{descricaoResumida(material)}</td>

                    <td>{material.local_atual}</td>

                    <td>
                      {material.controla_quantidade
                        ? `${material.quantidade_disponivel} UN`
                        : '1 UN'}
                    </td>

                    <td>
                      <span
                        className={[
                          'pagar-material-badge',
                          material.disponivel
                            ? 'is-success'
                            : 'is-warning'
                        ].join(' ')}
                      >
                        {material.status}
                      </span>
                    </td>

                    <td>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: '8px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {permiteVisualizar && (
                          <button
                            type="button"
                            className="pagar-material-refresh"
                            disabled={carregandoVisualizacao}
                            onClick={() => visualizarMaterial(material)}
                          >
                            {carregandoVisualizacao
                              ? 'Abrindo...'
                              : 'Visualizar'}
                          </button>
                        )}

                        <button
                          type="button"
                          className="pagar-material-add"
                          disabled={
                            selecionado ||
                            !material.disponivel
                          }
                          onClick={() => onAdicionar(material)}
                        >
                          {selecionado
                            ? 'Adicionado'
                            : 'Adicionar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {!loading && resultados.length === 0 && (
                <tr>
                  <td
                    colSpan={MOSTRAR_COLUNA_PATRIMONIO ? 6 : 5}
                    className="pagar-material-table-empty"
                  >
                    Nenhum material encontrado nesta origem.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {armaVisualizando && (
        <ArmaViewModal
          arma={armaVisualizando}
          fotos={fotosArma}
          carregandoFotos={false}
          erroFotos={erroVisualizacao}
          onClose={fecharVisualizacao}
        />
      )}

      {htVisualizando && (
        <HTDetalhesModal
          ht={htVisualizando}
          fotos={fotosHT}
          carregandoFotos={false}
          erroFotos={erroVisualizacao}
          onClose={fecharVisualizacao}
        />
      )}

      {taserVisualizando && (
        <TaserDetalhesModal
          taser={taserVisualizando}
          fotos={fotosTaser}
          carregandoFotos={false}
          erroFotos={erroVisualizacao}
          onClose={fecharVisualizacao}
        />
      )}

      {tpdVisualizando && (
        <TPDDetalhesModal
          tpd={tpdVisualizando}
          fotos={fotosTPD}
          carregandoFotos={false}
          erroFotos={erroVisualizacao}
          onClose={fecharVisualizacao}
        />
      )}
    </>
  )
}
