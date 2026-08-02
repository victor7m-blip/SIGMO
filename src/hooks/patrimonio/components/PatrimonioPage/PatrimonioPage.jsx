import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  listarPatrimoniosEngine,
  cadastrarPatrimonioEngine,
  atualizarPatrimonioEngine,
  excluirPatrimonioEngine,
} from '../../../../services/patrimonioEngineService'

import PatrimonioToolbar from '../PatrimonioToolbar/PatrimonioToolbar'
import PatrimonioLista from '../PatrimonioLista/PatrimonioLista'
import PatrimonioDetails from '../PatrimonioDetails/PatrimonioDetails'
import PatrimonioFotos from '../PatrimonioFotos/PatrimonioFotos'
import PatrimonioQRCode from '../PatrimonioQRCode/PatrimonioQRCode'
import PatrimonioMovimentacoes from '../PatrimonioMovimentacoes/PatrimonioMovimentacoes'

import './PatrimonioPage.css'

export default function PatrimonioPage({
  config,
  user,
}) {
  const {
    titulo = 'Motor Patrimonial',
    subtitulo = 'Gestão patrimonial integrada',
    modulo = 'patrimonio',
  } = config || {}

  const [itens, setItens] = useState([])
  const [carregando, setCarregando] =
    useState(true)
  const [salvando, setSalvando] =
    useState(false)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [statusAtivo, setStatusAtivo] =
    useState('todos')
  const [
    itemSelecionado,
    setItemSelecionado,
  ] = useState(null)
  const [abaAtiva, setAbaAtiva] =
    useState('dados')
  const [modo, setModo] =
    useState('detalhes')
  const [form, setForm] = useState({})

  useEffect(() => {
    carregarItens()
  }, [config])

  async function carregarItens() {
    if (!config?.tabela) {
      setItens([])
      setCarregando(false)
      setErro(
        'Configuração patrimonial inválida.'
      )
      return
    }

    try {
      setCarregando(true)
      setErro('')

      const dados =
        await listarPatrimoniosEngine(config)

      setItens(
        Array.isArray(dados) ? dados : []
      )
    } catch (error) {
      console.error(error)
      setErro(
        'Erro ao carregar dados patrimoniais.'
      )
      setItens([])
    } finally {
      setCarregando(false)
    }
  }

  const itensFiltrados = useMemo(() => {
    const termo = busca
      .trim()
      .toLowerCase()

    return itens.filter((item) => {
      const status = String(
        item.status ||
          item.status_operacional ||
          ''
      ).toLowerCase()

      const passaStatus =
        statusAtivo === 'todos' ||
        status ===
          statusAtivo.toLowerCase()

      if (!passaStatus) {
        return false
      }

      if (!termo) {
        return true
      }

      return JSON.stringify(item)
        .toLowerCase()
        .includes(termo)
    })
  }, [
    busca,
    statusAtivo,
    itens,
  ])

  function selecionarItem(item) {
    setItemSelecionado(item)
    setAbaAtiva('dados')
    setModo('detalhes')
  }

  function criarFormularioInicial() {
    const inicial = {}

    config?.campos?.forEach((campo) => {
      inicial[campo.name] =
        campo.defaultValue ?? ''
    })

    return inicial
  }

  function novoItem() {
    setForm(criarFormularioInicial())
    setItemSelecionado(null)
    setAbaAtiva('dados')
    setModo('form')

    window.requestAnimationFrame(() => {
      document
        .querySelector(
          '.patrimonio-details'
        )
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
    })
  }

  function editarItem(item) {
    setForm({
      ...(item || {}),
    })
    setItemSelecionado(item)
    setAbaAtiva('dados')
    setModo('form')

    window.requestAnimationFrame(() => {
      document
        .querySelector(
          '.patrimonio-details'
        )
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
    })
  }

  async function excluirItem(item) {
    if (!item?.id) {
      return
    }

    const confirmado = window.confirm(
      'Deseja realmente excluir este registro?'
    )

    if (!confirmado) {
      return
    }

    try {
      setErro('')

      await excluirPatrimonioEngine(
        config,
        item.id,
        user
      )

      setItemSelecionado(null)
      setModo('detalhes')
      setAbaAtiva('dados')

      await carregarItens()
    } catch (error) {
      console.error(error)
      setErro(
        'Erro ao excluir registro.'
      )
    }
  }

  function alterarCampo(event) {
    const {
      name,
      value,
    } = event.target

    setForm((anterior) => ({
      ...anterior,
      [name]: value,
    }))
  }

  async function salvarFormulario(event) {
    event.preventDefault()

    try {
      setSalvando(true)
      setErro('')

      let salvo

      if (itemSelecionado?.id) {
        salvo =
          await atualizarPatrimonioEngine(
            config,
            itemSelecionado.id,
            form,
            user
          )
      } else {
        salvo =
          await cadastrarPatrimonioEngine(
            config,
            form,
            user
          )
      }

      await carregarItens()

      setItemSelecionado(salvo)
      setModo('detalhes')
      setAbaAtiva('dados')
    } catch (error) {
      console.error(error)
      setErro(
        'Erro ao salvar registro.'
      )
    } finally {
      setSalvando(false)
    }
  }

  function cancelarFormulario() {
    setModo('detalhes')

    if (!itemSelecionado?.id) {
      setForm({})
    }
  }

  function renderFormulario() {
    return (
      <form
        className="patrimonio-form-card"
        onSubmit={salvarFormulario}
      >
        <div className="patrimonio-form-header">
          <div>
            <h3>
              {itemSelecionado?.id
                ? 'Editar registro'
                : 'Novo registro'}
            </h3>

            <p>
              Preencha os dados patrimoniais.
            </p>
          </div>

          <button
            type="button"
            onClick={cancelarFormulario}
          >
            Cancelar
          </button>
        </div>

        <div className="patrimonio-form-grid">
          {config?.campos?.map(
            (campo) => (
              <label key={campo.name}>
                <span>{campo.label}</span>

                {campo.type ===
                'textarea' ? (
                  <textarea
                    name={campo.name}
                    value={
                      form[campo.name] || ''
                    }
                    onChange={
                      alterarCampo
                    }
                    required={
                      campo.required
                    }
                  />
                ) : campo.type ===
                  'select' ? (
                  <select
                    name={campo.name}
                    value={
                      form[campo.name] || ''
                    }
                    onChange={
                      alterarCampo
                    }
                    required={
                      campo.required
                    }
                  >
                    <option value="">
                      Selecione
                    </option>

                    {campo.options?.map(
                      (opcao) => (
                        <option
                          key={opcao}
                          value={opcao}
                        >
                          {opcao}
                        </option>
                      )
                    )}
                  </select>
                ) : (
                  <input
                    type={
                      campo.type ||
                      'text'
                    }
                    name={campo.name}
                    value={
                      form[campo.name] || ''
                    }
                    onChange={
                      alterarCampo
                    }
                    required={
                      campo.required
                    }
                  />
                )}
              </label>
            )
          )}
        </div>

        <div className="patrimonio-form-actions">
          <button
            type="button"
            onClick={cancelarFormulario}
          >
            Voltar
          </button>

          <button
            type="submit"
            disabled={salvando}
          >
            {salvando
              ? 'Salvando...'
              : 'Salvar'}
          </button>
        </div>
      </form>
    )
  }

  function renderConteudo() {
    if (modo === 'form') {
      return renderFormulario()
    }

    if (!itemSelecionado) {
      return (
        <div className="patrimonio-dados">
          <h3>Dados principais</h3>

          <p>
            Selecione um item para visualizar
            os dados completos.
          </p>
        </div>
      )
    }

    if (abaAtiva === 'fotos') {
      return (
        <PatrimonioFotos
          config={config}
          item={itemSelecionado}
          user={user}
        />
      )
    }

    if (abaAtiva === 'qrcode') {
      return (
        <PatrimonioQRCode
          config={config}
          item={itemSelecionado}
          user={user}
        />
      )
    }

    if (
      abaAtiva === 'movimentacoes'
    ) {
      return (
        <PatrimonioMovimentacoes
          config={config}
          item={itemSelecionado}
          user={user}
        />
      )
    }

    return (
      <div className="patrimonio-dados">
        <h3>Dados principais</h3>

        <div className="patrimonio-dados-grid">
          {Object.entries(
            itemSelecionado
          ).map(([chave, valor]) => {
            if (
              [
                'fotos',
                'qrCode',
                'movimentacoes',
              ].includes(chave)
            ) {
              return null
            }

            return (
              <div
                key={chave}
                className="patrimonio-dado-item"
              >
                <span>{chave}</span>

                <strong>
                  {String(valor ?? '-')}
                </strong>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <main
      className="patrimonio-page"
      data-modulo={modulo}
    >
      <section className="patrimonio-shell">
        <header className="patrimonio-header">
          <div>
            <span className="patrimonio-eyebrow">
              SIGMO Patrimônio
            </span>

            <h1>{titulo}</h1>

            <p>{subtitulo}</p>
          </div>

          <button
            type="button"
            className="patrimonio-novo-btn"
            onClick={novoItem}
          >
            Novo
          </button>
        </header>

        {erro && (
          <div className="patrimonio-alert">
            {erro}
          </div>
        )}

        <PatrimonioToolbar
          busca={busca}
          onBuscaChange={setBusca}
          statusAtivo={statusAtivo}
          onStatusChange={
            setStatusAtivo
          }
          onNovo={novoItem}
        />

        {carregando ? (
          <div className="patrimonio-loading">
            Carregando dados...
          </div>
        ) : (
          <section className="patrimonio-grid">
            <PatrimonioLista
              itens={itensFiltrados}
              itemSelecionado={
                itemSelecionado
              }
              onSelect={
                selecionarItem
              }
            />

            <PatrimonioDetails
              item={itemSelecionado}
              abaAtiva={abaAtiva}
              onAbaChange={
                setAbaAtiva
              }
              onEdit={editarItem}
              onDelete={
                excluirItem
              }
            >
              {renderConteudo()}
            </PatrimonioDetails>
          </section>
        )}
      </section>
    </main>
  )
}