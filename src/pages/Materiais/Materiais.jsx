import './Materiais.css'

const categorias = [
  {
    id: 'armas',
    rota: 'armas',
    icone: '🔫',
    titulo: 'Armas',
    descricao:
      'Cadastre, consulte e gerencie pistolas, revólveres, carabinas, fuzis e espingardas.',
    status: 'disponivel',
    destaque: 'verde'
  },
  {
    id: 'coletes',
    icone: '🦺',
    titulo: 'Coletes Balísticos',
    descricao:
      'Gerencie coletes, placas balísticas, níveis de proteção, tamanhos e validades.',
    status: 'em-breve',
    destaque: 'vermelho'
  },
  {
  id: 'ht',
  rota: 'ht',
  icone: '📻',
  titulo: 'HT',
  descricao:
    'Gerencie rádios portáteis, números de série, patrimônios, status, fotos e responsáveis.',
  status: 'disponivel',
  destaque: 'azul'
},
  {
  id: 'tpd',
  titulo: 'TPD',
  descricao: 'Terminal Portátil de Dados',
  icone: '📱',
  status: 'disponivel',
  rota: 'tpd'
},
 {
  id: 'tasers',
  rota: 'tasers',
  icone: '⚡',
  titulo: 'Taser',
  descricao:
    'Gerencie dispositivos de incapacitação neuromuscular, cartuchos e acessórios.',
  status: 'disponivel',
  destaque: 'roxo'
},
  {
    id: 'cop',
    icone: '📹',
    titulo: 'COP (Câmera Corporal)',
    descricao:
      'Controle câmeras operacionais portáteis, bases, baterias e informações de uso.',
    status: 'ativo',
    destaque: 'ciano'
  },
  {
    id: 'municoes',
    rota: 'municoes',
    icone: '▥',
    titulo: 'Munições',
    descricao:
      'Cadastre e consulte munições por calibre, lote, quantidade, validade e destinação.',
    status: 'disponivel',
    destaque: 'laranja'
  },

  {
  id: 'tonfas',
  rota: 'tonfas',
  icone: '┠',
  titulo: 'Tonfa',
  descricao:
    'Controle a quantidade de tonfas e cassetetes disponíveis, em uso e armazenados.',
  status: 'disponivel',
  destaque: 'amarelo'
},

  {
    id: 'outros',
    icone: '📦',
    titulo: 'Outros Materiais',
    descricao:
      'Gerencie acessórios, antenas, algemas, lanternas, ferramentas e demais itens.',
    status: 'em-breve',
    destaque: 'cinza'
  }
]

const atalhos = [
  {
    icone: '🏷️',
    titulo: 'Categorias',
    descricao: 'Gerenciar categorias patrimoniais'
  },
  {
    icone: '👥',
    titulo: 'Fornecedores',
    descricao: 'Gerenciar fornecedores cadastrados'
  },
  {
    icone: '📏',
    titulo: 'Unidades',
    descricao: 'Gerenciar unidades de medida'
  },
  {
    icone: '🔖',
    titulo: 'Etiquetas',
    descricao: 'Imprimir etiquetas e códigos QR'
  },
  {
    icone: '⬇️',
    titulo: 'Importar dados',
    descricao: 'Importar patrimônio por planilha'
  },
  {
    icone: '📄',
    titulo: 'Relatórios',
    descricao: 'Gerar relatórios patrimoniais'
  }
]

export default function Materiais({
  user,
  onNavegar
}) {

  function abrirCategoria(categoria) {
  console.log('Categoria clicada:', categoria)

  if (
    categoria.status !== 'disponivel' ||
    !categoria.rota
  ) {
    return
  }

  onNavegar?.(categoria.rota)
}

  return (
    <main className="gestao-patrimonial">
      <header className="gestao-patrimonial__header">
        <div>
          <span className="gestao-patrimonial__kicker">
            SIGMO
          </span>

          <h1>Gestão Patrimonial</h1>

          <p>
            Gerencie todo o patrimônio operacional da
            companhia em um único ambiente.
          </p>
        </div>

        <div className="gestao-patrimonial__usuario">
          <span>Usuário logado</span>
          <strong>
            {user?.nome_guerra ||
              user?.nome ||
              'Usuário'}
          </strong>
          <small>
            Perfil: {user?.perfil || '—'}
          </small>
        </div>
      </header>

      <section
        className="gestao-patrimonial__indicadores"
        aria-label="Resumo patrimonial"
      >
        <article>
          <span className="indicador-icone">📦</span>
          <div>
            <small>Patrimônios cadastrados</small>
            <strong>—</strong>
            <span>Ativos</span>
          </div>
        </article>

        <article>
          <span className="indicador-icone">🏷️</span>
          <div>
            <small>Categorias</small>
            <strong>{categorias.length}</strong>
            <span>Disponíveis</span>
          </div>
        </article>

        <article>
          <span className="indicador-icone">🔄</span>
          <div>
            <small>Movimentações pendentes</small>
            <strong>—</strong>
            <span>Aguardando aceite</span>
          </div>
        </article>

        <article>
          <span className="indicador-icone">⚠️</span>
          <div>
            <small>Alertas patrimoniais</small>
            <strong>—</strong>
            <span>Itens</span>
          </div>
        </article>

        <article>
          <span className="indicador-icone">📅</span>
          <div>
            <small>Última atualização</small>
            <strong>—</strong>
            <span>Sincronização</span>
          </div>
        </article>
      </section>

      <div className="gestao-patrimonial__conteudo">
        <section className="gestao-patrimonial__categorias">
          <div className="gestao-patrimonial__titulo-secao">
            <span>◈</span>
            <h2>
              Selecione a categoria patrimonial
            </h2>
          </div>

          <div className="gestao-patrimonial__grid">
            {categorias.map((categoria) => {
              const disponivel =
                categoria.status === 'disponivel'

              return (
                <article
                  key={categoria.id}
                  className={`categoria-patrimonial categoria-patrimonial--${categoria.destaque}`}
                >
                  <div className="categoria-patrimonial__icone">
                    {categoria.icone}
                  </div>

                  <h3>{categoria.titulo}</h3>

                  <p>{categoria.descricao}</p>

                  <button
                    type="button"
                    onClick={() =>
                      abrirCategoria(categoria)
                    }
                    disabled={!disponivel}
                  >
                    {disponivel
                      ? 'Acessar'
                      : 'Em breve'}

                    <span aria-hidden="true">
                      {disponivel ? '→' : '•'}
                    </span>
                  </button>
                </article>
              )
            })}
          </div>
        </section>

        <aside className="gestao-patrimonial__lateral">
          <section className="painel-patrimonial">
            <h2>Informações importantes</h2>

            <div className="painel-patrimonial__item">
              <span>🛡️</span>
              <div>
                <strong>Controle e segurança</strong>
                <p>
                  Cadastros e movimentações ficam
                  registrados para rastreabilidade.
                </p>
              </div>
            </div>

            <div className="painel-patrimonial__item">
              <span>👤</span>
              <div>
                <strong>Responsabilidade</strong>
                <p>
                  Cada patrimônio mantém seu local e
                  responsável atualizados.
                </p>
              </div>
            </div>

            <div className="painel-patrimonial__item">
              <span>↶</span>
              <div>
                <strong>Histórico permanente</strong>
                <p>
                  Alterações ficam registradas com data,
                  hora, usuário e motivo.
                </p>
              </div>
            </div>

            <div className="painel-patrimonial__item">
              <span>🔒</span>
              <div>
                <strong>Integridade dos dados</strong>
                <p>
                  Campos críticos são protegidos por
                  regras de acesso e auditoria.
                </p>
              </div>
            </div>
          </section>

          <section className="painel-patrimonial">
            <h2>Resumo patrimonial</h2>

            <div className="resumo-patrimonial">
              {categorias.map((categoria) => (
                <div key={categoria.id}>
                  <span>{categoria.titulo}</span>
                  <strong>—</strong>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="painel-patrimonial__relatorio"
              disabled
            >
              Ver relatório patrimonial
            </button>
          </section>
        </aside>
      </div>

      <section className="gestao-patrimonial__atalhos">
        {atalhos.map((atalho) => (
          <button
            key={atalho.titulo}
            type="button"
            disabled
          >
            <span>{atalho.icone}</span>

            <div>
              <strong>{atalho.titulo}</strong>
              <small>{atalho.descricao}</small>
            </div>

            <b>→</b>
          </button>
        ))}
      </section>

      <footer className="gestao-patrimonial__footer">
        SIGMO — Gestão, controle e rastreabilidade do
        patrimônio operacional.
      </footer>
    </main>
  )
}
