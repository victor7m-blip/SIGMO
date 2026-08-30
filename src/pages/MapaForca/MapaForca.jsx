import { useMemo, useState } from 'react'
import './MapaForca.css'

const GRUPOS_INICIAIS = [
  {
    id: 'cgp',
    titulo: 'CGP / SUPERVISÃO',
    subtitulo: 'Comando e supervisão do turno',
    tom: 'azul',
    unidades: [
      {
        id: 'cgp-01',
        prefixo: 'CGP',
        tipo: 'VIATURA',
        campos: ['CGP', 'MOTORISTA / AUXILIAR', 'COP']
      }
    ]
  },
  {
    id: 'servico-dia',
    titulo: 'SERVIÇO DE DIA',
    subtitulo: 'Equipe responsável pelo SVDD',
    tom: 'roxo',
    unidades: [
      {
        id: 'sd-27501',
        prefixo: 'SD27501',
        tipo: 'SERVIÇO',
        campos: ['ENCARREGADO', 'AUXILIAR']
      }
    ]
  },
  {
    id: 'radio-patrulhamento',
    titulo: 'RÁDIO PATRULHAMENTO',
    subtitulo: 'Viaturas de patrulhamento territorial',
    tom: 'ciano',
    unidades: [
      {
        id: 'rp-01',
        prefixo: 'RP',
        tipo: 'VIATURA',
        campos: ['ENCARREGADO', 'MOTORISTA / AUXILIAR']
      }
    ]
  },
  {
    id: 'ronda-escolar',
    titulo: 'RONDA ESCOLAR',
    subtitulo: 'Policiamento escolar',
    tom: 'verde',
    unidades: []
  },
  {
    id: 'base-comunitaria',
    titulo: 'BASE COMUNITÁRIA MÓVEL',
    subtitulo: 'Policiamento comunitário',
    tom: 'amarelo',
    unidades: []
  },
  {
    id: 'pop',
    titulo: 'POP',
    subtitulo: 'Postos e equipes operacionais',
    tom: 'laranja',
    unidades: [
      {
        id: 'pop-27501',
        prefixo: 'POP27501',
        tipo: 'EQUIPE',
        campos: ['ENCARREGADO', 'PARCEIRO']
      }
    ]
  },
  {
    id: 'rpm',
    titulo: 'RPM',
    subtitulo: 'Radiopatrulhamento com motocicletas',
    tom: 'vermelho',
    unidades: [
      {
        id: 'rpm-01',
        prefixo: 'M-27509-11',
        tipo: 'MOTOCICLETA',
        campos: ['POLICIAL']
      }
    ]
  }
]

function dataInput(data) {
  const local = new Date(data.getTime() - data.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function criarTurnoInicial() {
  const inicio = new Date()
  inicio.setHours(18, 0, 0, 0)

  const fim = new Date(inicio)
  fim.setDate(fim.getDate() + 1)
  fim.setHours(6, 0, 0, 0)

  return {
    inicio: dataInput(inicio),
    fim: dataInput(fim)
  }
}

function nomeUsuario(user) {
  return (
    user?.nome_guerra ||
    user?.nome ||
    user?.nome_completo ||
    user?.re ||
    'USUÁRIO'
  )
}

function CampoComposicao({ label }) {
  return (
    <button
      type="button"
      className="mapa-forca-slot"
      title="A seleção de policiais será conectada na próxima etapa"
    >
      <span className="mapa-forca-slot-icon">+</span>
      <span>
        <small>{label}</small>
        <strong>Selecionar policial</strong>
      </span>
    </button>
  )
}

function UnidadeServico({ unidade }) {
  return (
    <article className="mapa-forca-us">
      <div className="mapa-forca-us-head">
        <div className="mapa-forca-us-prefixo">
          <span>{unidade.tipo}</span>
          <strong>{unidade.prefixo}</strong>
        </div>

        <button
          type="button"
          className="mapa-forca-vtr"
          title="A seleção de viatura será conectada na próxima etapa"
        >
          <span>▱</span>
          <div>
            <small>VIATURA / RECURSO</small>
            <strong>Selecionar</strong>
          </div>
        </button>
      </div>

      <div className="mapa-forca-composicao">
        {unidade.campos.map((campo) => (
          <CampoComposicao
            key={`${unidade.id}-${campo}`}
            label={campo}
          />
        ))}
      </div>

      <div className="mapa-forca-equipamentos">
        <span>Equipamentos</span>
        {['ARMA', 'HT', 'TASER', 'TPD', 'TONFA'].map((item) => (
          <button type="button" key={item} disabled>
            + {item}
          </button>
        ))}
      </div>
    </article>
  )
}

export default function MapaForca({ user, onVoltar }) {
  const turnoInicial = useMemo(() => criarTurnoInicial(), [])
  const [inicio, setInicio] = useState(turnoInicial.inicio)
  const [fim, setFim] = useState(turnoInicial.fim)
  const [grupos, setGrupos] = useState(GRUPOS_INICIAIS)
  const [status, setStatus] = useState('EM ELABORAÇÃO')

  function adicionarUS(grupoId) {
    setGrupos((atuais) =>
      atuais.map((grupo) => {
        if (grupo.id !== grupoId) return grupo

        const numero = grupo.unidades.length + 1
        return {
          ...grupo,
          unidades: [
            ...grupo.unidades,
            {
              id: `${grupo.id}-${Date.now()}`,
              prefixo: `${grupo.titulo.split(' ')[0]} ${String(numero).padStart(2, '0')}`,
              tipo: 'EQUIPE',
              campos: ['ENCARREGADO', 'MOTORISTA / AUXILIAR']
            }
          ]
        }
      })
    )
  }

  return (
    <main className="mapa-forca-page">
      <header className="mapa-forca-hero">
        <div>
          <span>SIGMO • GESTÃO OPERACIONAL</span>
          <h1>MAPA FORÇA</h1>
          <p>Composição operacional, viaturas, efetivo e distribuição de materiais do turno.</p>
        </div>

        <div className="mapa-forca-hero-actions">
          <button type="button" className="mapa-forca-secondary" onClick={onVoltar}>
            ← Dashboard
          </button>
          <button
            type="button"
            className="mapa-forca-primary"
            onClick={() => setStatus('EM ELABORAÇÃO')}
          >
            + Novo mapa
          </button>
        </div>
      </header>

      <section className="mapa-forca-turno">
        <div className="mapa-forca-turno-title">
          <div>
            <span>MAPA DO TURNO</span>
            <strong>{status}</strong>
          </div>
          <small>Responsável: {nomeUsuario(user)}</small>
        </div>

        <label>
          <span>Início do turno</span>
          <input
            type="datetime-local"
            value={inicio}
            onChange={(event) => setInicio(event.target.value)}
          />
        </label>

        <div className="mapa-forca-seta">→</div>

        <label>
          <span>Término do turno</span>
          <input
            type="datetime-local"
            value={fim}
            onChange={(event) => setFim(event.target.value)}
          />
        </label>

        <div className="mapa-forca-turno-actions">
          <button type="button" disabled>Salvar mapa</button>
          <button type="button" disabled>Encerrar mapa</button>
        </div>
      </section>

      <section className="mapa-forca-legenda">
        <div><i className="ok" /> Disponível para composição</div>
        <div><i className="warn" /> Pendente de composição</div>
        <div><i className="info" /> Materiais serão integrados ao SVDD</div>
      </section>

      <section className="mapa-forca-arvore">
        {grupos.map((grupo) => (
          <section
            className={`mapa-forca-grupo mapa-forca-${grupo.tom}`}
            key={grupo.id}
          >
            <header>
              <div className="mapa-forca-grupo-identidade">
                <span className="mapa-forca-grupo-icon">▦</span>
                <div>
                  <h2>{grupo.titulo}</h2>
                  <p>{grupo.subtitulo}</p>
                </div>
              </div>

              <div className="mapa-forca-grupo-meta">
                <span>{grupo.unidades.length} US</span>
                <button type="button" onClick={() => adicionarUS(grupo.id)}>
                  + Adicionar US
                </button>
              </div>
            </header>

            {grupo.unidades.length > 0 ? (
              <div className="mapa-forca-us-grid">
                {grupo.unidades.map((unidade) => (
                  <UnidadeServico key={unidade.id} unidade={unidade} />
                ))}
              </div>
            ) : (
              <button
                type="button"
                className="mapa-forca-empty"
                onClick={() => adicionarUS(grupo.id)}
              >
                <span>+</span>
                <strong>Adicionar primeira US</strong>
                <small>Nenhuma unidade configurada nesta fileira.</small>
              </button>
            )}
          </section>
        ))}
      </section>

      <footer className="mapa-forca-footer">
        <div>
          <strong>ETAPA 1 • ESTRUTURA DO MAPA</strong>
          <span>Policiais, viaturas e cautelas serão conectados nas próximas etapas.</span>
        </div>
        <span>Mapa Força • SIGMO</span>
      </footer>
    </main>
  )
}
