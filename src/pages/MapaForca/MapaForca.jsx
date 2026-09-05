import { useEffect, useMemo, useState } from 'react'
import './MapaForca.css'
import MapaForcaVisualizacao from './MapaForcaVisualizacao'

import { listarPoliciais } from '../../services/policiaisService'
import { listarViaturas } from '../../services/viaturasService'
import { listarMateriaisEmServicoUsuario } from '../../services/cautelasUsuarioService'
import {
  carregarMapaEmElaboracao,
  excluirUSMapaForca,
  salvarCabecalhoMapaForca,
  salvarUSMapaForca
} from '../../services/mapaForcaService'

const EQUIPES_SERVICO = ['A', 'B', 'C', 'D']
const SERVICOS_DIA = ['SD27501', 'SD27502', 'SD27503', 'SD27504', 'SD27505']

const TIPOS_US = [
  { id: 'comando-cia', titulo: 'COMANDO DE CIA', subtitulo: 'Comando da Companhia no turno', tom: 'dourado', prefixo: 'CMT DE CIA', tipo: 'VIATURA', campos: ['COMANDANTE', 'MOTORISTA', 'AUXILIAR'] },
  { id: 'cgp', titulo: 'CGP / SUPERVISÃO', subtitulo: 'Comando e supervisão do turno', tom: 'vermelho', prefixo: 'CGP', tipo: 'VIATURA', campos: ['CGP', 'MOTORISTA', 'AUXILIAR'] },
  { id: 'servico-dia', titulo: 'SERVIÇO DE DIA', subtitulo: 'Equipe responsável pelo SVDD', tom: 'roxo', prefixo: 'SD27501', tipo: 'SERVIÇO', campos: ['ENCARREGADO', 'AUXILIAR'] },
  { id: 'radio-patrulhamento', titulo: 'RÁDIO PATRULHAMENTO', subtitulo: 'Viaturas de patrulhamento territorial', tom: 'ciano', prefixo: 'RP', tipo: 'VIATURA', campos: ['ENCARREGADO', 'MOTORISTA / AUXILIAR'] },
  { id: 'ronda-escolar', titulo: 'RONDA ESCOLAR', subtitulo: 'Policiamento escolar', tom: 'verde', prefixo: 'RONDA ESCOLAR', tipo: 'VIATURA', campos: ['ENCARREGADO', 'MOTORISTA / AUXILIAR'] },
  { id: 'base-comunitaria', titulo: 'BASE COMUNITÁRIA MÓVEL', subtitulo: 'Policiamento comunitário', tom: 'amarelo', prefixo: 'BCM', tipo: 'VIATURA', campos: ['ENCARREGADO', 'MOTORISTA / AUXILIAR'] },
  { id: 'pop', titulo: 'POP', subtitulo: 'Postos e equipes operacionais', tom: 'laranja', prefixo: 'POP', tipo: 'EQUIPE', campos: ['ENCARREGADO', 'PARCEIRO'] },
  { id: 'rpm', titulo: 'RPM', subtitulo: 'Radiopatrulhamento com motocicletas', tom: 'vermelho', prefixo: 'M-27509-11', tipo: 'MOTOCICLETA', campos: ['POLICIAL'] }
]

function dataInput(data) {
  const local = new Date(data.getTime() - data.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function dataInputValor(valor) {
  if (!valor) return ''
  return dataInput(new Date(valor))
}

function criarTurnoInicial() {
  const inicio = new Date()
  inicio.setHours(18, 0, 0, 0)
  const fim = new Date(inicio)
  fim.setDate(fim.getDate() + 1)
  fim.setHours(6, 0, 0, 0)
  return { inicio: dataInput(inicio), fim: dataInput(fim) }
}

function nomeUsuario(user) {
  return user?.nome_guerra || user?.nome || user?.nome_completo || user?.re || 'USUÁRIO'
}

function nomePolicial(policial) {
  return [policial?.posto_graduacao, policial?.nome_guerra || policial?.nome]
    .filter(Boolean).join(' ')
}

function modeloTipo(id) {
  return TIPOS_US.find((item) => item.id === id) || null
}

function normalizarEquipamento(valor) {
  return String(valor || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function rotuloEquipamento(item) {
  const texto = normalizarEquipamento([
    item?.tipo,
    item?.tipo_patrimonio,
    item?.categoria,
    item?.descricao
  ].filter(Boolean).join(' '))

  if (texto.includes('CASSETETE')) return 'CASSETETE'
  if (texto.includes('TONFA')) return 'TONFA'
  if (texto.includes('TASER')) return 'TASER'
  if (texto.includes('TPD')) return 'TPD'
  if (texto.includes('HT') || texto.includes('RADIO')) return 'HT'
  if (
    texto.includes('ARMA') ||
    texto.includes('PISTOLA') ||
    texto.includes('REVOLVER') ||
    texto.includes('FUZIL') ||
    texto.includes('CARABINA')
  ) return 'ARMA'

  return item?.tipo ? normalizarEquipamento(item.tipo) : 'EQUIPAMENTO'
}

function resumirEquipamentos(itens = []) {
  return Array.from(new Set((itens || []).map(rotuloEquipamento).filter(Boolean)))
}

function proximoCampoExtra(campos = []) {
  let numero = 1

  while (campos.includes(`POLICIAL EXTRA ${numero}`)) {
    numero += 1
  }

  return `POLICIAL EXTRA ${numero}`
}

function ehCampoExtra(campo) {
  return /^POLICIAL EXTRA \d+$/.test(String(campo || ''))
}

function criarUnidade(tipo, inicio, fim) {
  return {
    id: `nova-${Date.now()}`,
    persistido: false,
    prefixo: tipo.prefixo,
    tipo: tipo.tipo,
    campos: [...tipo.campos],
    criadaManualmente: true,
    inicioUs: inicio,
    fimUs: fim,
    viatura: null,
    vtrDiferenteEscala: false,
    viaturaPrevista: null,
    motivoTrocaVtr: '',
    localPop: '',
    policiais: {}
  }
}

function reconstruirUnidades(unidades, efetivo, inicioPadrao, fimPadrao) {
  return (unidades || []).map((registro) => {
    const tipo = modeloTipo(registro.grupo_id) || {
      id: registro.grupo_id,
      titulo: registro.grupo_titulo || registro.grupo_id,
      subtitulo: '',
      tom: 'azul',
      tipo: registro.tipo,
      campos: []
    }
    const efetivoUs = (efetivo || []).filter((item) => item.us_id === registro.id)
    const policiais = {}
    efetivoUs.forEach((item) => {
      if (item.funcao && item.policial) policiais[item.funcao] = item.policial
    })
    const camposSalvos = efetivoUs.map((item) => item.funcao).filter(Boolean)

    return {
      grupo: tipo,
      unidade: {
        id: registro.id,
        persistido: true,
        prefixo: registro.prefixo,
        tipo: registro.tipo,
        campos: Array.from(new Set([
          ...(tipo.campos?.length
            ? tipo.campos
            : (camposSalvos.length ? camposSalvos : ['ENCARREGADO', 'MOTORISTA / AUXILIAR'])),
          ...camposSalvos
        ])),
        criadaManualmente: true,
        inicioUs: dataInputValor(registro.inicio_us) || inicioPadrao,
        fimUs: dataInputValor(registro.fim_us) || fimPadrao,
        viatura: registro.viatura || null,
        vtrDiferenteEscala: Boolean(registro.vtr_diferente_escala),
        viaturaPrevista: registro.viatura_prevista || null,
        motivoTrocaVtr: registro.motivo_troca_vtr || '',
        localPop: registro.local_pop || '',
        policiais
      },
      ordem: Number(registro.ordem || 0)
    }
  })
}

function CampoComposicao({ label, policial, onSelecionar, onRemover, somenteLeitura = false }) {
  if (policial) {
    return (
      <div className="mapa-forca-slot mapa-forca-selecionado">
        <div className="mapa-forca-mini-foto">
          {policial.foto_url ? <img src={policial.foto_url} alt={nomePolicial(policial)} /> : <span>👮</span>}
        </div>
        <button type="button" className="mapa-forca-dados-selecionados" onClick={somenteLeitura ? undefined : onSelecionar}>
          <small>{label}</small>
          <strong>{nomePolicial(policial)}</strong>
          <em>RE {policial.re || '—'}{somenteLeitura ? '' : ' • trocar'}</em>
        </button>
        {!somenteLeitura && <button type="button" className="mapa-forca-remover" onClick={onRemover}>×</button>}
      </div>
    )
  }

  if (somenteLeitura) {
    return <div className="mapa-forca-slot"><span><small>{label}</small><strong>Não definido</strong></span></div>
  }

  return (
    <button type="button" className="mapa-forca-slot" onClick={onSelecionar}>
      <span className="mapa-forca-slot-icon">+</span>
      <span><small>{label}</small><strong>Selecionar policial</strong></span>
    </button>
  )
}

function UnidadeServico({
  grupoId,
  unidade,
  onPolicial,
  onRemoverPolicial,
  onAdicionarPolicial,
  onViatura,
  onRemoverViatura,
  onVtrDiferenteEscala,
  onViaturaPrevista,
  onRemoverViaturaPrevista,
  onMotivoTrocaVtr,
  onHorario,
  onPrefixo,
  onLocalPop,
  onPagarMaterial,
  somenteLeitura = false
}) {
  return (
    <article className="mapa-forca-us">
      <div className="mapa-forca-us-head">
        <label className="mapa-forca-us-prefixo">
          <span>
            {grupoId === 'cgp'
              ? 'SUPERVISÃO'
              : grupoId === 'pop'
                ? 'POP'
                : unidade.tipo}
          </span>

          {somenteLeitura ? (
            <strong>{unidade.prefixo}</strong>
          ) : grupoId === 'servico-dia' ? (
            <select
              value={unidade.prefixo || 'SD27501'}
              onChange={(e) => onPrefixo(e.target.value)}
            >
              {SERVICOS_DIA.map((servico) => (
                <option key={servico} value={servico}>{servico}</option>
              ))}
            </select>
          ) : grupoId === 'pop' ? (
            <strong>POP</strong>
          ) : grupoId === 'cgp' ? (
            <strong>CGP</strong>
          ) : grupoId === 'radio-patrulhamento' ? (
            <strong>RP</strong>
          ) : (
            <input
              value={unidade.prefixo || ''}
              onChange={(e) => onPrefixo(e.target.value.toUpperCase())}
            />
          )}
        </label>

        {grupoId === 'pop' && (
          <label className="mapa-forca-us-prefixo">
            <span>LOCAL DO POP</span>
            {somenteLeitura
              ? <strong>{unidade.localPop || 'Não informado'}</strong>
              : (
                <input
                  value={unidade.localPop || ''}
                  onChange={(e) => onLocalPop?.(e.target.value.toUpperCase())}
                  placeholder="Ex.: RUA / PRAÇA / AVENIDA..."
                />
              )}
          </label>
        )}

        {!['servico-dia', 'pop'].includes(grupoId) && (
          unidade.viatura ? (
            <div className="mapa-forca-vtr mapa-forca-selecionado">
              <div className="mapa-forca-mini-vtr">
                {unidade.viatura.foto_principal_url
                  ? <img src={unidade.viatura.foto_principal_url} alt={unidade.viatura.prefixo} />
                  : <span>{unidade.viatura.tipo_veiculo === 'MOTOCICLETA' ? '🏍️' : '🚓'}</span>}
              </div>
              <button type="button" className="mapa-forca-dados-selecionados" onClick={somenteLeitura ? undefined : onViatura}>
                <small>VIATURA</small>
                <strong>{unidade.viatura.prefixo}</strong>
                {!somenteLeitura && <em>trocar</em>}
              </button>
              {!somenteLeitura && <button type="button" className="mapa-forca-remover" onClick={onRemoverViatura}>×</button>}
            </div>
          ) : somenteLeitura ? (
            <div className="mapa-forca-vtr"><span>▱</span><div><small>VIATURA</small><strong>Não definida</strong></div></div>
          ) : (
            <button type="button" className="mapa-forca-vtr" onClick={onViatura}>
              <span>{unidade.tipo === 'MOTOCICLETA' ? '🏍️' : '▱'}</span>
              <div><small>VIATURA</small><strong>Selecionar</strong></div>
            </button>
          )
        )}
      </div>

      {!['servico-dia', 'pop'].includes(grupoId) && unidade.viatura && (
        <div className={`mapa-forca-vtr-escala ${unidade.vtrDiferenteEscala ? 'ativo' : ''}`}>
          <label className="mapa-forca-vtr-escala-check">
            <input type="checkbox" checked={Boolean(unidade.vtrDiferenteEscala)} disabled={somenteLeitura}
              onChange={(e) => onVtrDiferenteEscala?.(e.target.checked)} />
            <span><strong>VTR diferente da escala</strong><small>Marque quando a viatura empregada for diferente da prevista na escala.</small></span>
          </label>
          {unidade.vtrDiferenteEscala && (
            <div className="mapa-forca-vtr-escala-detalhes">
              <div className="mapa-forca-vtr-prevista">
                <small>VIATURA PREVISTA NA ESCALA</small>
                {unidade.viaturaPrevista ? (
                  <div className="mapa-forca-vtr-prevista-selecionada">
                    <strong>{unidade.viaturaPrevista.prefixo}</strong>
                    {!somenteLeitura && <><button type="button" onClick={onViaturaPrevista}>Trocar</button><button type="button" className="remover" onClick={onRemoverViaturaPrevista}>×</button></>}
                  </div>
                ) : somenteLeitura ? <strong>Não informada</strong> : (
                  <button type="button" className="mapa-forca-vtr-prevista-btn" onClick={onViaturaPrevista}>Selecionar viatura prevista</button>
                )}
              </div>
              <label className="mapa-forca-vtr-motivo">
                <small>MOTIVO DA ALTERAÇÃO</small>
                {somenteLeitura ? <strong>{unidade.motivoTrocaVtr || 'Não informado'}</strong> : (
                  <textarea value={unidade.motivoTrocaVtr || ''} onChange={(e) => onMotivoTrocaVtr?.(e.target.value.toUpperCase())}
                    placeholder="Informe o motivo da troca da viatura..." rows={3} />
                )}
              </label>
            </div>
          )}
        </div>
      )}

      <div className="mapa-forca-composicao">
        {unidade.campos.map((campo) => (
          <CampoComposicao key={`${unidade.id}-${campo}`} label={campo} policial={unidade.policiais?.[campo]}
            onSelecionar={() => onPolicial?.(campo)} onRemover={() => onRemoverPolicial?.(campo)} somenteLeitura={somenteLeitura} />
        ))}

        {!somenteLeitura && (
          <button type="button" className="mapa-forca-slot mapa-forca-adicionar-policial" onClick={onAdicionarPolicial}>
            <span className="mapa-forca-slot-icon">+</span>
            <span><small>EFETIVO ADICIONAL</small><strong>Adicionar policial</strong></span>
          </button>
        )}
      </div>

      <div className="mapa-forca-equipamentos">
        <span>Equipamentos / cautelas</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {unidade.campos.map((campo) => {
            const policial = unidade.policiais?.[campo]
            if (!policial?.id) return null

            return (
              <button
                type="button"
                key={`equip-${unidade.id}-${campo}`}
                onClick={() => onPagarMaterial?.({
                  policial,
                  funcao: campo,
                  unidade: {
                    id: unidade.id,
                    prefixo: unidade.prefixo,
                    inicioUs: unidade.inicioUs,
                    fimUs: unidade.fimUs
                  }
                })}
                disabled={typeof onPagarMaterial !== 'function'}
              >
                + {policial.nome_guerra || policial.nome || policial.re || campo}
              </button>
            )
          })}
        </div>
      </div>
    </article>
  )
}

function resumoMapa(salvas) {
  const policiais = new Set()
  const viaturas = new Set()
  let pops = 0

  salvas.forEach((item) => {
    Object.values(item.unidade.policiais || {}).forEach((policial) => {
      if (policial?.id) policiais.add(String(policial.id))
    })
    if (item.unidade.viatura?.id) viaturas.add(String(item.unidade.viatura.id))
    if (item.grupo.id === 'pop') pops += 1
  })

  return {
    us: salvas.length,
    policiais: policiais.size,
    viaturas: viaturas.size,
    pops
  }
}

function CartaoPolicialCompacto({ funcao, policial, materiais = [] }) {
  const equipamentos = resumirEquipamentos(materiais)

  return (
    <div className="mapa-forca-compact-policial">
      <div className="mapa-forca-compact-foto">
        {policial?.foto_url ? <img src={policial.foto_url} alt={nomePolicial(policial)} /> : <span>👮</span>}
      </div>
      <div>
        <small>{funcao}</small>
        <strong>{policial ? nomePolicial(policial) : 'NÃO DEFINIDO'}</strong>
        {policial && <em>RE {policial.re || '—'}</em>}
        {policial && equipamentos.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '7px' }}>
            {equipamentos.map((equipamento) => (
              <span
                key={`${policial.id}-${equipamento}`}
                style={{
                  border: '1px solid rgba(56, 189, 248, .28)',
                  background: 'rgba(56, 189, 248, .08)',
                  borderRadius: '999px',
                  padding: '2px 7px',
                  fontSize: '10px',
                  fontStyle: 'normal',
                  fontWeight: 800,
                  letterSpacing: '.04em'
                }}
              >
                {equipamento}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function UnidadeCompacta({
  item,
  materiaisPorPolicial = {},
  onEditar = null,
  onExcluir = null
}) {
  const { unidade } = item
  return (
    <div
      className="mapa-forca-compact-us"
    >
      <div className="mapa-forca-compact-us-top">
        <div>
          <span className="mapa-forca-compact-prefixo">{unidade.prefixo}</span>
          {unidade.viatura && <small>VIATURA: {unidade.viatura.prefixo}</small>}
          {unidade.vtrDiferenteEscala && (
            <div className="mapa-forca-compact-vtr-alerta">
              <strong>⚠ VTR DIFERENTE DA ESCALA</strong>
              <span>Prevista: {unidade.viaturaPrevista?.prefixo || 'NÃO INFORMADA'}</span>
              <span>Motivo: {unidade.motivoTrocaVtr || 'NÃO INFORMADO'}</span>
            </div>
          )}
        </div>
        <span className="mapa-forca-compact-status">● EM ELABORAÇÃO</span>
      </div>

      <div className="mapa-forca-compact-efetivo">
        {unidade.campos.map((funcao) => (
          <CartaoPolicialCompacto
            key={`${unidade.id}-${funcao}`}
            funcao={funcao}
            policial={unidade.policiais?.[funcao]}
            materiais={materiaisPorPolicial[String(unidade.policiais?.[funcao]?.id || '')] || []}
          />
        ))}
      </div>

      <div className="mapa-forca-compact-rodape">
        <span>{dataInputValor(unidade.inicioUs).slice(11)} → {dataInputValor(unidade.fimUs).slice(11)}</span>
        <span className="mapa-forca-compact-acoes" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="mapa-forca-toolbar-btn"
            onClick={() => onEditar?.(item)}
            disabled={typeof onEditar !== 'function'}
          >
            ✎ EDITAR US
          </button>
          <button
            type="button"
            className="mapa-forca-toolbar-btn"
            onClick={() => onExcluir?.(item)}
            disabled={typeof onExcluir !== 'function'}
          >
            EXCLUIR
          </button>
        </span>
      </div>
    </div>
  )
}

function ModalSelecao({ selecao, itens, pesquisa, setPesquisa, loading, erro, ocupados, onClose, onSelecionar }) {
  const termo = String(pesquisa || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  const lista = itens.filter((item) => {
    const texto = selecao.tipo === 'POLICIAL'
      ? `${item.posto_graduacao || ''} ${item.nome_guerra || ''} ${item.nome || ''} ${item.re || ''}`
      : `${item.prefixo || ''} ${item.modelo || ''} ${item.placa || ''} ${item.ano || ''}`
    return !termo || texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().includes(termo)
  })

  return (
    <div className="mapa-forca-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="mapa-forca-modal">
        <header><div><small>MAPA FORÇA</small><h2>{selecao.tipo === 'POLICIAL' ? `Selecionar policial • ${selecao.campo}` : `Selecionar ${selecao.tipoVeiculo === 'MOTOCICLETA' ? 'motocicleta' : 'viatura'}`}</h2></div><button type="button" onClick={onClose}>×</button></header>
        <input
          autoFocus
          className="mapa-forca-modal-pesquisa"
          value={pesquisa}
          onChange={(e) => {
            const valor = e.target.value

            if (selecao.tipo === 'POLICIAL' && /^\d*$/.test(valor)) {
              setPesquisa(valor.slice(0, 6))
              return
            }

            setPesquisa(valor)
          }}
          inputMode={selecao.tipo === 'POLICIAL' && /^\d*$/.test(pesquisa || '') ? 'numeric' : undefined}
          placeholder={selecao.tipo === 'POLICIAL' ? 'Pesquisar nome, posto ou RE...' : 'Pesquisar prefixo, modelo ou placa...'}
        />
        {erro ? <div className="mapa-forca-modal-aviso erro">{erro}</div>
          : loading ? <div className="mapa-forca-modal-aviso">Carregando...</div>
          : lista.length === 0 ? <div className="mapa-forca-modal-aviso">Nenhum registro disponível.</div>
          : <div className="mapa-forca-modal-lista">{lista.map((item) => {
              const ocupado = ocupados.has(String(item.id))
              return <button type="button" key={item.id} className="mapa-forca-opcao" disabled={ocupado} onClick={() => onSelecionar(item)}>
                <div className="mapa-forca-opcao-foto">{selecao.tipo === 'POLICIAL'
                  ? (item.foto_url ? <img src={item.foto_url} alt={nomePolicial(item)} /> : <span>👮</span>)
                  : (item.foto_principal_url ? <img src={item.foto_principal_url} alt={item.prefixo} /> : <span>{item.tipo_veiculo === 'MOTOCICLETA' ? '🏍️' : '🚓'}</span>)}</div>
                <div><strong>{selecao.tipo === 'POLICIAL' ? nomePolicial(item) : item.prefixo}</strong>
                  <span>{selecao.tipo === 'POLICIAL' ? `RE ${item.re || '—'} • ${item.companhia || '—'}` : `${item.modelo || '—'} • ${item.placa || '—'} • ${item.ano || '—'}`}</span></div>
                <b>{ocupado ? 'JÁ ESCALADO' : 'SELECIONAR'}</b>
              </button>
            })}</div>}
      </section>
    </div>
  )
}

export default function MapaForca({
  user,
  onVoltar,
  onPagarMaterial = null,
  modoInicial = 'montagem',
  rascunhoInicial = null,
  onRascunhoChange = null,
  somenteLeitura = false
}) {
  const turnoInicial = useMemo(() => criarTurnoInicial(), [])
  const [inicio, setInicio] = useState(turnoInicial.inicio)
  const [fim, setFim] = useState(turnoInicial.fim)
  const [horarioPadraoInicio, setHorarioPadraoInicio] = useState(turnoInicial.inicio)
  const [horarioPadraoFim, setHorarioPadraoFim] = useState(turnoInicial.fim)
  const [status, setStatus] = useState('EM ELABORAÇÃO')
  const [equipeServico, setEquipeServico] = useState('')
  const [mapaId, setMapaId] = useState(null)
  const [salvas, setSalvas] = useState([])
  const [editor, setEditor] = useState(() => rascunhoInicial || null)
  const [modo, setModo] = useState(
    somenteLeitura || modoInicial === 'visualizacao' ? 'visualizacao' : 'montagem'
  )
  const [policiais, setPoliciais] = useState([])
  const [viaturas, setViaturas] = useState([])
  const [loadingPoliciais, setLoadingPoliciais] = useState(true)
  const [loadingViaturas, setLoadingViaturas] = useState(true)
  const [erroPoliciais, setErroPoliciais] = useState('')
  const [erroViaturas, setErroViaturas] = useState('')
  const [selecao, setSelecao] = useState(null)
  const [pesquisaSelecao, setPesquisaSelecao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [carregandoMapa, setCarregandoMapa] = useState(true)
  const [mensagemMapa, setMensagemMapa] = useState('')
  const [materiaisPorPolicial, setMateriaisPorPolicial] = useState({})

  useEffect(() => {
    onRascunhoChange?.(editor)
  }, [editor, onRascunhoChange])

  async function recarregarMapa() {
    const salvo = await carregarMapaEmElaboracao()
    if (!salvo?.mapa) {
      setMapaId(null)
      setSalvas([])
      return
    }
    const inicioMapa = dataInputValor(salvo.mapa.inicio_turno)
    const fimMapa = dataInputValor(salvo.mapa.fim_turno)
    setMapaId(salvo.mapa.id)
    setInicio(inicioMapa)
    setFim(fimMapa)
    setHorarioPadraoInicio(inicioMapa)
    setHorarioPadraoFim(fimMapa)
    setStatus(salvo.mapa.status || 'EM ELABORAÇÃO')
    setEquipeServico(salvo.mapa.equipe_servico || '')
    setSalvas(reconstruirUnidades(salvo.unidades, salvo.efetivo, inicioMapa, fimMapa))
  }

  useEffect(() => {
    let ativo = true
    async function carregarCadastros() {
      try {
        const resultado = await listarPoliciais({ filtros: { situacao: 'ATIVO' }, pagina: 1, limite: 1000, sortBy: 'nome_guerra', sortDirection: 'asc' })
        if (ativo) setPoliciais(resultado.data || [])
      } catch (error) {
        if (ativo) setErroPoliciais(error?.message || 'Não foi possível carregar os policiais.')
      } finally { if (ativo) setLoadingPoliciais(false) }

      try {
        const lista = await listarViaturas()
        if (ativo) setViaturas(lista || [])
      } catch (error) {
        if (ativo) setErroViaturas(error?.message || 'Não foi possível carregar as viaturas.')
      } finally { if (ativo) setLoadingViaturas(false) }
    }
    carregarCadastros()
    return () => { ativo = false }
  }, [])

  useEffect(() => {
    let ativo = true
    recarregarMapa()
      .then(() => { if (ativo) setMensagemMapa('Mapa em elaboração carregado.') })
      .catch((error) => { if (ativo) setMensagemMapa(error?.message || 'Não foi possível carregar o mapa salvo.') })
      .finally(() => { if (ativo) setCarregandoMapa(false) })
    return () => { ativo = false }
  }, [])

  useEffect(() => {
    let ativo = true
    const policiaisDoMapa = new Map()

    salvas.forEach((item) => {
      Object.values(item?.unidade?.policiais || {}).forEach((policial) => {
        if (policial?.id) policiaisDoMapa.set(String(policial.id), policial)
      })
    })

    Object.values(editor?.unidade?.policiais || {}).forEach((policial) => {
      if (policial?.id) policiaisDoMapa.set(String(policial.id), policial)
    })

    if (policiaisDoMapa.size === 0) {
      setMateriaisPorPolicial({})
      return () => { ativo = false }
    }

    Promise.all(
      Array.from(policiaisDoMapa.entries()).map(async ([id, policial]) => {
        try {
          const itens = await listarMateriaisEmServicoUsuario(policial)
          return [id, itens || []]
        } catch (error) {
          console.warn(`Não foi possível carregar cautelas do policial ${policial?.re || id}:`, error)
          return [id, []]
        }
      })
    ).then((registros) => {
      if (ativo) setMateriaisPorPolicial(Object.fromEntries(registros))
    })

    return () => { ativo = false }
  }, [salvas, editor])

  useEffect(() => {
    if (carregandoMapa || policiais.length === 0) return
    const porId = new Map(policiais.filter((p) => p?.id).map((p) => [String(p.id), p]))
    setSalvas((atuais) => atuais.map((item) => ({
      ...item,
      unidade: {
        ...item.unidade,
        policiais: Object.fromEntries(Object.entries(item.unidade.policiais || {}).map(([funcao, policial]) => {
          const atual = porId.get(String(policial?.id || ''))

          return [
            funcao,
            atual
              ? {
                  ...policial,
                  ...atual,
                  foto_url:
                    atual.foto_url ||
                    policial?.foto_url ||
                    null
                }
              : policial
          ]
        }))
      }
    })))
  }, [policiais, carregandoMapa])

  const policiaisOcupados = useMemo(() => {
    const ids = new Set()
    salvas.forEach((item) => {
      if (editor?.unidade?.persistido && item.unidade.id === editor.unidade.id) return
      Object.values(item.unidade.policiais || {}).forEach((p) => p?.id && ids.add(String(p.id)))
    })

    Object.entries(editor?.unidade?.policiais || {}).forEach(([campo, policial]) => {
      if (campo !== selecao?.campo && policial?.id) ids.add(String(policial.id))
    })

    return ids
  }, [salvas, editor, selecao])

  const viaturasOcupadas = useMemo(() => {
    const ids = new Set()
    salvas.forEach((item) => {
      if (editor?.unidade?.persistido && item.unidade.id === editor.unidade.id) return
      if (item.unidade.viatura?.id) ids.add(String(item.unidade.viatura.id))
    })
    return ids
  }, [salvas, editor])

  function iniciarNovaUS(tipoId) {
    const tipo = modeloTipo(tipoId)
    if (!tipo) return
    setEditor({ grupo: tipo, unidade: criarUnidade(tipo, horarioPadraoInicio, horarioPadraoFim) })
    setMensagemMapa('')
  }

  function atualizarEditor(fn) {
    setEditor((atual) => atual ? { ...atual, unidade: fn(atual.unidade) } : atual)
  }

  function abrirPolicial(campo) {
    if (!editor) return
    setPesquisaSelecao('')
    setSelecao({ tipo: 'POLICIAL', campo })
  }

  function abrirViatura() {
    if (!editor) return
    setPesquisaSelecao('')
    setSelecao({ tipo: 'VIATURA', tipoVeiculo: editor.grupo.id === 'rpm' ? 'MOTOCICLETA' : 'VIATURA' })
  }

  function selecionarPolicial(policial) {
    atualizarEditor((u) => ({
      ...u,
      campos: selecao?.novoExtra && !(u.campos || []).includes(selecao.campo)
        ? [...(u.campos || []), selecao.campo]
        : u.campos,
      policiais: { ...(u.policiais || {}), [selecao.campo]: policial }
    }))
    setSelecao(null)
  }

  function selecionarViatura(viatura) {
    atualizarEditor((u) => ({ ...u, viatura }))
    setSelecao(null)
  }

  function abrirViaturaPrevista() {
    if (!editor) return
    setPesquisaSelecao('')
    setSelecao({ tipo: 'VIATURA_PREVISTA', tipoVeiculo: editor.grupo.id === 'rpm' ? 'MOTOCICLETA' : 'VIATURA' })
  }

  function selecionarViaturaPrevista(viatura) {
    atualizarEditor((u) => ({ ...u, viaturaPrevista: viatura }))
    setSelecao(null)
  }

  function removerPolicial(campo) {
    atualizarEditor((u) => {
      const novos = { ...(u.policiais || {}) }
      delete novos[campo]
      return {
        ...u,
        policiais: novos,
        campos: ehCampoExtra(campo)
          ? (u.campos || []).filter((item) => item !== campo)
          : u.campos
      }
    })
  }

  function adicionarPolicialExtra() {
    if (!editor) return
    const campo = proximoCampoExtra(editor.unidade.campos || [])
    setPesquisaSelecao('')
    setSelecao({ tipo: 'POLICIAL', campo, novoExtra: true })
  }

  async function salvarCabecalho() {
    if (salvando) return
    setSalvando(true)
    setMensagemMapa('')
    try {
      const id = await salvarCabecalhoMapaForca({ mapaId, inicio, fim, user, equipeServico })
      setMapaId(id)
      setMensagemMapa('Horário do mapa salvo.')
    } catch (error) {
      setMensagemMapa(error?.message || 'Não foi possível salvar o mapa.')
    } finally { setSalvando(false) }
  }

  async function salvarUS() {
    if (!editor || salvando) return
    setSalvando(true)
    setMensagemMapa('')
    try {
      const prefixo = String(editor.unidade.prefixo || '').trim()
      if (!prefixo) throw new Error('Informe o prefixo/identificação da US.')

      if (editor.unidade.vtrDiferenteEscala) {
        if (!editor.unidade.viaturaPrevista?.id) throw new Error('Selecione a viatura prevista originalmente na escala.')
        if (!String(editor.unidade.motivoTrocaVtr || '').trim()) throw new Error('Informe o motivo da troca da viatura.')
      }

      const unidadeParaSalvar = {
        ...editor.unidade,
        inicioUs: inicio,
        fimUs: fim
      }

      const resultado = await salvarUSMapaForca({
        mapaId,
        inicio,
        fim,
        user,
        grupo: editor.grupo,
        unidade: unidadeParaSalvar,
        ordem: editor.unidade.persistido
          ? (salvas.find((item) => item.unidade.id === editor.unidade.id)?.ordem || 0)
          : (salvas.reduce((maior, item) => Math.max(maior, Number(item.ordem || 0)), -1) + 1)
      })

      setMapaId(resultado.mapaId)
      setHorarioPadraoInicio(inicio)
      setHorarioPadraoFim(fim)
      await recarregarMapa()
      setEditor(null)
      setMensagemMapa('US salva. A tela está pronta para montar a próxima equipe.')
    } catch (error) {
      console.error('Erro ao salvar US:', error)
      setMensagemMapa(error?.message || 'Não foi possível salvar a US.')
    } finally { setSalvando(false) }
  }

  function editarUS(item) {
    const inicioUs = item.unidade.inicioUs || inicio
    const fimUs = item.unidade.fimUs || fim

    setInicio(inicioUs)
    setFim(fimUs)
    setHorarioPadraoInicio(inicioUs)
    setHorarioPadraoFim(fimUs)
    setEditor({
      grupo: item.grupo,
      unidade: {
        ...item.unidade,
        inicioUs,
        fimUs,
        policiais: { ...(item.unidade.policiais || {}) }
      }
    })
    setModo('montagem')
    setMensagemMapa(`Editando ${item.unidade.prefixo}.`)
  }

  async function excluirUS(item) {
    if (!window.confirm(`Excluir a US "${item.unidade.prefixo}" do Mapa Força?`)) return
    try {
      await excluirUSMapaForca({ mapaId, usId: item.unidade.id })
      await recarregarMapa()
      setMensagemMapa('US excluída do Mapa Força.')
    } catch (error) {
      setMensagemMapa(error?.message || 'Não foi possível excluir a US.')
    }
  }

  function novoMapa() {
    if (!window.confirm('Limpar a tela de montagem e iniciar uma nova composição? O mapa já salvo no banco não será apagado.')) return
    const turno = criarTurnoInicial()
    setInicio(turno.inicio)
    setFim(turno.fim)
    setHorarioPadraoInicio(turno.inicio)
    setHorarioPadraoFim(turno.fim)
    setEquipeServico('')
    setEditor(null)
    setModo('montagem')
    setMensagemMapa('Tela de montagem limpa. O mapa salvo anteriormente foi preservado.')
  }

  if (modo === 'visualizacao') {
    return (
      <main className="mapa-forca-page mapa-forca-page-visualizacao">
        <MapaForcaVisualizacao
          salvas={salvas}
          policiaisCadastro={policiais}
          materiaisPorPolicial={materiaisPorPolicial}
          onVoltarMontagem={somenteLeitura ? onVoltar : () => setModo('montagem')}
        />
      </main>
    )
  }

  return (
    <main className="mapa-forca-page">
      <header className="mapa-forca-hero">
        <div><span>SIGMO • GESTÃO OPERACIONAL</span><h1>MAPA FORÇA</h1><p>Monte uma US por vez. As equipes salvas aparecem na visualização completa.</p></div>
        <div className="mapa-forca-hero-actions">
          <button type="button" className="mapa-forca-secondary" onClick={onVoltar}>← Dashboard</button>
          <button type="button" className="mapa-forca-primary" onClick={novoMapa}>+ Novo mapa</button>
        </div>
      </header>

      <section className="mapa-forca-topbar">
        <div className="mapa-forca-topbar-info">
          <span>MAPA DO TURNO</span>
          <strong>{status}</strong>
          <small>Responsável: {nomeUsuario(user)} • {salvas.length} US salva(s)</small>
        </div>

        <div
          className="mapa-forca-topbar-periodo"
          style={{
            display: 'grid',
            gridTemplateColumns: '58px 172px 16px 172px max-content max-content',
            alignItems: 'end',
            justifyContent: 'start',
            columnGap: '3px',
            rowGap: '0',
            flex: '0 0 auto',
            width: 'auto',
            minWidth: 0
          }}
        >
          <label
            style={{
              width: '58px',
              minWidth: '58px',
              maxWidth: '58px',
              flex: '0 0 58px',
              margin: 0,
              padding: 0
            }}
          >
            <span>EQUIPE DE SERVIÇO</span>
            <select
              value={equipeServico}
              onChange={(e) => setEquipeServico(e.target.value)}
              style={{
                width: '54px',
                minWidth: '54px',
                maxWidth: '54px',
                height: '38px',
                padding: '0 8px',
                background: '#0b3f75',
                color: '#ffffff',
                border: '1px solid #2b6ea6',
                borderRadius: '8px',
                fontWeight: 800,
                textAlign: 'center',
                textAlignLast: 'center'
              }}
            >
              <option value="">—</option>
              {EQUIPES_SERVICO.map((equipe) => (
                <option key={equipe} value={equipe}>{equipe}</option>
              ))}
            </select>
          </label>
          <label>
            <span>INÍCIO</span>
            <input
              type="datetime-local"
              value={inicio}
              style={{ width: '172px', minWidth: 0 }}
              onChange={(e) => { setInicio(e.target.value); setHorarioPadraoInicio(e.target.value) }}
            />
          </label>
          <span className="mapa-forca-periodo-seta">→</span>
          <label>
            <span>TÉRMINO</span>
            <input
              type="datetime-local"
              value={fim}
              style={{ width: '172px', minWidth: 0 }}
              onChange={(e) => { setFim(e.target.value); setHorarioPadraoFim(e.target.value) }}
            />
          </label>
          <button type="button" className="mapa-forca-toolbar-btn mapa-forca-toolbar-save" onClick={salvarCabecalho} disabled={salvando}>
            {salvando ? 'SALVANDO...' : 'SALVAR HORÁRIO'}
          </button>

          <button
            type="button"
            className={`mapa-forca-toolbar-btn mapa-forca-toolbar-view ${modo === 'visualizacao' ? 'ativo' : ''}`}
            onClick={() => setModo(modo === 'visualizacao' ? 'montagem' : 'visualizacao')}
            style={{ marginLeft: 0 }}
          >
            {modo === 'visualizacao' ? 'MONTAR US' : 'VISUALIZAR MAPA FORÇA'}
          </button>
        </div>
      </section>

      {mensagemMapa && <div className="mapa-forca-mensagem">{mensagemMapa}</div>}

      {(
        <section className="mapa-forca-montagem">
          {!editor ? (
            <div className="mapa-forca-nova-us">
              <div><span>NOVA EQUIPE / US</span><h2>Escolha o tipo da unidade de serviço</h2><p>A tela permanece vazia até você escolher uma equipe. Depois de salvar, ela volta a ficar em branco.</p></div>
              <div className="mapa-forca-tipos-us">
                {TIPOS_US.map((tipo) => (
                  <button type="button" key={tipo.id} className={`mapa-forca-tipo-card mapa-forca-${tipo.tom}`} onClick={() => iniciarNovaUS(tipo.id)}>
                    <strong>{tipo.titulo}</strong><small>{tipo.subtitulo}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <section className={`mapa-forca-grupo mapa-forca-${editor.grupo.tom}`}>
              <header><div className="mapa-forca-grupo-identidade"><span className="mapa-forca-grupo-icon">▦</span><div><h2>{editor.grupo.titulo}</h2><p>{editor.grupo.subtitulo}</p></div></div>
                <div className="mapa-forca-grupo-meta"><button type="button" onClick={() => setEditor(null)}>Cancelar</button></div></header>
              <div className="mapa-forca-editor-unico">
                <UnidadeServico
                  grupoId={editor.grupo.id}
                  unidade={{
                    ...editor.unidade,
                    inicioUs: inicio,
                    fimUs: fim
                  }}
                  onPolicial={abrirPolicial} onRemoverPolicial={removerPolicial}
                  onAdicionarPolicial={adicionarPolicialExtra}
                  onViatura={abrirViatura} onRemoverViatura={() => atualizarEditor((u) => ({ ...u, viatura: null }))}
                  onVtrDiferenteEscala={(marcado) => atualizarEditor((u) => ({ ...u, vtrDiferenteEscala: marcado, viaturaPrevista: marcado ? u.viaturaPrevista : null, motivoTrocaVtr: marcado ? u.motivoTrocaVtr : '' }))}
                  onViaturaPrevista={abrirViaturaPrevista}
                  onRemoverViaturaPrevista={() => atualizarEditor((u) => ({ ...u, viaturaPrevista: null }))}
                  onMotivoTrocaVtr={(valor) => atualizarEditor((u) => ({ ...u, motivoTrocaVtr: valor }))}
                  onHorario={(campo, valor) => atualizarEditor((u) => ({ ...u, [campo]: valor }))}
                  onPrefixo={(valor) => atualizarEditor((u) => ({ ...u, prefixo: valor }))}
                  onLocalPop={(valor) => atualizarEditor((u) => ({ ...u, localPop: valor }))}
                  onPagarMaterial={onPagarMaterial} />
                <div className="mapa-forca-editor-actions">
                  <button type="button" className="mapa-forca-secondary" onClick={() => setEditor(null)}>Cancelar</button>
                  <button type="button" className="mapa-forca-primary" onClick={salvarUS} disabled={salvando}>{salvando ? 'Salvando...' : editor.unidade.persistido ? 'Salvar alterações da US' : 'Salvar US'}</button>
                </div>
              </div>
            </section>
          )}
        </section>
      )}

      {salvas.length > 0 && (
        <section className="mapa-forca-montagem" style={{ marginBottom: '18px' }}>
          <div className="mapa-forca-nova-us">
            <div>
              <span>EQUIPES / US JÁ SALVAS</span>
              <h2>Gerenciar equipes do mapa atual</h2>
              <p>
                Selecione uma equipe para alterar policiais, viatura, horários, cautelas ou excluir a US.
                A visualização branca permanece separada no botão “Visualizar Mapa Força”.
              </p>
            </div>

            <div style={{ display: 'grid', gap: '14px', marginTop: '14px' }}>
              {salvas.map((item) => (
                <UnidadeCompacta
                  key={`salva-${item.unidade.id}`}
                  item={item}
                  materiaisPorPolicial={materiaisPorPolicial}
                  onEditar={editarUS}
                  onExcluir={excluirUS}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {selecao && <ModalSelecao selecao={selecao}
        itens={selecao.tipo === 'POLICIAL' ? policiais : viaturas.filter((v) => (selecao.tipo === 'VIATURA_PREVISTA' || v.situacao === 'DISPONIVEL') && v.tipo_veiculo === selecao.tipoVeiculo)}
        pesquisa={pesquisaSelecao} setPesquisa={setPesquisaSelecao}
        loading={selecao.tipo === 'POLICIAL' ? loadingPoliciais : loadingViaturas}
        erro={selecao.tipo === 'POLICIAL' ? erroPoliciais : erroViaturas}
        ocupados={selecao.tipo === 'POLICIAL' ? policiaisOcupados : (selecao.tipo === 'VIATURA_PREVISTA' ? new Set() : viaturasOcupadas)}
        onClose={() => setSelecao(null)}
        onSelecionar={selecao.tipo === 'POLICIAL' ? selecionarPolicial : (selecao.tipo === 'VIATURA_PREVISTA' ? selecionarViaturaPrevista : selecionarViatura)} />}

      <footer className="mapa-forca-footer"><div><strong>MAPA FORÇA • MONTAGEM POR US</strong><span>Uma equipe por vez. Cautelas e ativação operacional permanecem para a próxima etapa.</span></div><span>Mapa Força • SIGMO</span></footer>
    </main>
  )
}
