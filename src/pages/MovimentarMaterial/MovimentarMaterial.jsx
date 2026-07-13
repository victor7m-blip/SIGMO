import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  listarMateriais
} from '../../services/materiaisService'

import {
  listarPoliciais
} from '../../services/policiaisService'

import {
  receberMaterial
} from '../../services/recebimentoService'

import {
  transferirMaterial
} from '../../services/transferenciaService'

import {
  baixarMaterial
} from '../../services/baixaService'

import './MovimentarMaterial.css'

const MODOS = Object.freeze({
  RECEBER: 'RECEBER',
  TRANSFERIR: 'TRANSFERIR',
  BAIXAR: 'BAIXAR'
})

function somenteNumeros(valor) {
  return String(valor ?? '').replace(/\D/g, '')
}

function maiusculo(valor) {
  return String(valor ?? '').toUpperCase()
}

function obterNomePolicial(policial) {
  return (
    policial?.nome_guerra ||
    policial?.nome ||
    policial?.nome_completo ||
    ''
  )
}

function obterTituloMaterial(material) {
  return (
    material?.patrimonio ||
    material?.numero_patrimonio ||
    material?.descricao ||
    material?.numero_serie ||
    material?.modelo ||
    'MATERIAL'
  )
}

function obterSubtituloMaterial(material) {
  return [
    material?.categoria,
    material?.marca,
    material?.modelo,
    material?.numero_serie
  ]
    .filter(Boolean)
    .join(' • ')
}

function obterConfiguracao(modo) {
  if (modo === MODOS.TRANSFERIR) {
    return {
      titulo: 'Transferir Material',
      subtitulo:
        'Transfira o material para outra unidade ou local.',
      acao: 'Confirmar transferência',
      classe: 'transferencia'
    }
  }

  if (modo === MODOS.BAIXAR) {
    return {
      titulo: 'Baixar Material',
      subtitulo:
        'Registre a baixa patrimonial do material.',
      acao: 'Confirmar baixa',
      classe: 'baixa'
    }
  }

  return {
    titulo: 'Receber Material',
    subtitulo:
      'Confirme o recebimento e o novo responsável pelo material.',
    acao: 'Confirmar recebimento',
    classe: 'recebimento'
  }
}

const FORM_INICIAL = {
  recebedorRE: '',
  recebedorNome: '',
  localDestino: '',
  unidadeDestino: '',
  documento: '',
  motivo: '',
  observacao: ''
}

export default function MovimentarMaterial({
  user,
  modo = MODOS.RECEBER,
  onVoltar = null,
  onConcluido = null
}) {
  const config = useMemo(
    () => obterConfiguracao(modo),
    [modo]
  )

  const [busca, setBusca] =
    useState('')

  const [materiais, setMateriais] =
    useState([])

  const [
    materialSelecionado,
    setMaterialSelecionado
  ] = useState(null)

  const [carregando, setCarregando] =
    useState(false)

  const [salvando, setSalvando] =
    useState(false)

  const [erro, setErro] =
    useState('')

  const [sucesso, setSucesso] =
    useState('')

  const [form, setForm] =
    useState(FORM_INICIAL)

  const [
    pesquisandoRecebedor,
    setPesquisandoRecebedor
  ] = useState(false)

  const [
    erroRecebedor,
    setErroRecebedor
  ] = useState('')

  const [
    policialRecebedor,
    setPolicialRecebedor
  ] = useState(null)

  const precisaRecebedor =
    modo === MODOS.RECEBER ||
    modo === MODOS.TRANSFERIR

  const precisaDestino =
    modo === MODOS.RECEBER ||
    modo === MODOS.TRANSFERIR

  const precisaUnidade =
    modo === MODOS.TRANSFERIR

  const precisaMotivo =
    modo === MODOS.BAIXAR

  useEffect(() => {
    const termo = busca.trim()

    if (termo.length < 2) {
      setMateriais([])
      setCarregando(false)
      return
    }

    let ativo = true

    const timer = setTimeout(async () => {
      try {
        setCarregando(true)
        setErro('')

        const resposta =
          await listarMateriais({
            filtros: {
              patrimonio: termo
            },
            pagina: 1,
            limite: 10,
            sortBy: 'created_at',
            sortDirection: 'desc'
          })

        let encontrados =
          resposta?.data ?? []

        if (encontrados.length === 0) {
          const porDescricao =
            await listarMateriais({
              filtros: {
                descricao: termo
              },
              pagina: 1,
              limite: 10,
              sortBy: 'created_at',
              sortDirection: 'desc'
            })

          encontrados =
            porDescricao?.data ?? []
        }

        if (ativo) {
          setMateriais(encontrados)
        }
      } catch (error) {
        if (ativo) {
          setErro(
            error?.message ||
            'Não foi possível pesquisar os materiais.'
          )

          setMateriais([])
        }
      } finally {
        if (ativo) {
          setCarregando(false)
        }
      }
    }, 300)

    return () => {
      ativo = false
      clearTimeout(timer)
    }
  }, [busca])

  useEffect(() => {
    if (!precisaRecebedor) {
      return
    }

    const re = somenteNumeros(
      form.recebedorRE
    )

    if (re.length !== 6) {
      setPesquisandoRecebedor(false)
      setErroRecebedor('')
      setPolicialRecebedor(null)

      setForm((anterior) => ({
        ...anterior,
        recebedorNome: ''
      }))

      return
    }

    let ativo = true

    const timer = setTimeout(async () => {
      try {
        setPesquisandoRecebedor(true)
        setErroRecebedor('')
        setPolicialRecebedor(null)

        const resultado =
          await listarPoliciais({
            filtros: {
              re
            },
            pagina: 1,
            limite: 20
          })

        const lista =
          resultado?.data ?? []

        const encontrado =
          lista.find((policial) => {
            const rePolicial =
              somenteNumeros(policial?.re)

            return rePolicial === re
          }) ?? null

        if (!ativo) {
          return
        }

        if (!encontrado) {
          setForm((anterior) => ({
            ...anterior,
            recebedorNome: ''
          }))

          setErroRecebedor(
            'Policial não encontrado para este RE.'
          )

          return
        }

        const nome =
          obterNomePolicial(encontrado)

        setPolicialRecebedor(encontrado)

        setForm((anterior) => ({
          ...anterior,
          recebedorNome:
            maiusculo(nome)
        }))
      } catch (error) {
        if (!ativo) {
          return
        }

        console.error(
          'Erro ao pesquisar recebedor:',
          error
        )

        setPolicialRecebedor(null)

        setForm((anterior) => ({
          ...anterior,
          recebedorNome: ''
        }))

        setErroRecebedor(
          error?.message ||
          'Não foi possível pesquisar o policial.'
        )
      } finally {
        if (ativo) {
          setPesquisandoRecebedor(false)
        }
      }
    }, 300)

    return () => {
      ativo = false
      clearTimeout(timer)
    }
  }, [
    form.recebedorRE,
    precisaRecebedor
  ])

  function atualizarCampo(event) {
    const {
      name,
      value
    } = event.target

    let novoValor = value

    if (name === 'recebedorRE') {
      novoValor =
        somenteNumeros(value).slice(0, 6)

      setErroRecebedor('')
      setPolicialRecebedor(null)
    }

    if (
      name === 'localDestino' ||
      name === 'unidadeDestino' ||
      name === 'motivo'
    ) {
      novoValor = maiusculo(value)
    }

    setForm((anterior) => ({
      ...anterior,
      [name]: novoValor,

      ...(name === 'recebedorRE'
        ? {
            recebedorNome: ''
          }
        : {})
    }))

    setErro('')
    setSucesso('')
  }

  function selecionarMaterial(material) {
    setMaterialSelecionado(material)
    setBusca(
      obterTituloMaterial(material)
    )
    setMateriais([])
    setErro('')
    setSucesso('')

    setForm((anterior) => ({
      ...anterior,

      localDestino:
        modo === MODOS.RECEBER
          ? material.local_atual ||
            'GUARDA DO QUARTEL'
          : anterior.localDestino,

      unidadeDestino:
        modo === MODOS.RECEBER
          ? material.unidade || ''
          : anterior.unidadeDestino
    }))
  }

  function limparMaterial() {
    setMaterialSelecionado(null)
    setBusca('')
    setMateriais([])
    setErro('')
    setSucesso('')
  }

  function limparFormulario() {
    limparMaterial()
    setForm(FORM_INICIAL)
    setPolicialRecebedor(null)
    setPesquisandoRecebedor(false)
    setErroRecebedor('')
  }

  function validar() {
    if (!materialSelecionado?.id) {
      throw new Error(
        'Selecione o material.'
      )
    }

    if (precisaRecebedor) {
      if (
        form.recebedorRE.length !== 6
      ) {
        throw new Error(
          'O RE do recebedor deve possuir 6 dígitos.'
        )
      }

      if (pesquisandoRecebedor) {
        throw new Error(
          'Aguarde a pesquisa do recebedor.'
        )
      }

      if (!policialRecebedor) {
        throw new Error(
          'Informe um RE válido e cadastrado.'
        )
      }

      if (
        !form.recebedorNome.trim()
      ) {
        throw new Error(
          'O nome do recebedor não foi localizado.'
        )
      }
    }

    if (
      precisaDestino &&
      !form.localDestino.trim()
    ) {
      throw new Error(
        'Informe o local de destino.'
      )
    }

    if (
      precisaUnidade &&
      !form.unidadeDestino.trim()
    ) {
      throw new Error(
        'Informe a unidade de destino.'
      )
    }

    if (
      precisaMotivo &&
      !form.motivo.trim()
    ) {
      throw new Error(
        'Informe o motivo da baixa.'
      )
    }
  }

  async function salvar(event) {
    event.preventDefault()

    try {
      setSalvando(true)
      setErro('')
      setSucesso('')

      validar()

      let resultado

      if (
        modo === MODOS.TRANSFERIR
      ) {
        resultado =
          await transferirMaterial({
            materialId:
              materialSelecionado.id,

            localDestino:
              form.localDestino,

            unidadeDestino:
              form.unidadeDestino,

            recebedorRE:
              form.recebedorRE,

            recebedorNome:
              form.recebedorNome,

            documento:
              form.documento,

            motivo:
              form.motivo ||
              'TRANSFERÊNCIA DE MATERIAL',

            observacao:
              form.observacao,

            user
          })
      } else if (
        modo === MODOS.BAIXAR
      ) {
        resultado =
          await baixarMaterial({
            materialId:
              materialSelecionado.id,

            motivo:
              form.motivo,

            documento:
              form.documento,

            observacao:
              form.observacao,

            user
          })
      } else {
        resultado =
          await receberMaterial({
            materialId:
              materialSelecionado.id,

            recebedorRE:
              form.recebedorRE,

            recebedorNome:
              form.recebedorNome,

            localDestino:
              form.localDestino,

            unidadeDestino:
              form.unidadeDestino,

            documento:
              form.documento,

            observacao:
              form.observacao,

            user
          })
      }

      setSucesso(
        modo === MODOS.TRANSFERIR
          ? 'Transferência registrada com sucesso.'
          : modo === MODOS.BAIXAR
            ? 'Baixa registrada com sucesso.'
            : 'Recebimento registrado com sucesso.'
      )

      if (
        typeof onConcluido ===
        'function'
      ) {
        onConcluido(resultado)
      }

      setForm(FORM_INICIAL)
      setPolicialRecebedor(null)
      setErroRecebedor('')
      setMaterialSelecionado(null)
      setBusca('')
      setMateriais([])
    } catch (error) {
      setErro(
        error?.message ||
        'Não foi possível concluir a operação.'
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <main
      className={`mov-material-page mov-material-${config.classe}`}
    >
      <section className="mov-material-shell">
        <header className="mov-material-header">
          <div>
            <span className="mov-material-kicker">
              SIGMO • CENTRAL PATRIMONIAL
            </span>

            <h1>{config.titulo}</h1>

            <p>{config.subtitulo}</p>
          </div>

          {typeof onVoltar ===
            'function' && (
            <button
              type="button"
              className="mov-material-btn mov-material-btn-secondary"
              onClick={onVoltar}
              disabled={salvando}
            >
              Voltar
            </button>
          )}
        </header>

        <form
          className="mov-material-card"
          onSubmit={salvar}
        >
          <section className="mov-material-section">
            <div className="mov-material-section-title">
              <span>1</span>

              <div>
                <h2>
                  Selecionar material
                </h2>

                <p>
                  Pesquise pelo patrimônio ou
                  descrição.
                </p>
              </div>
            </div>

            {!materialSelecionado ? (
              <div className="mov-material-search">
                <label htmlFor="busca-material">
                  Material
                </label>

                <input
                  id="busca-material"
                  type="text"
                  value={busca}
                  onChange={(event) => {
                    setBusca(
                      maiusculo(
                        event.target.value
                      )
                    )

                    setMaterialSelecionado(
                      null
                    )

                    setErro('')
                    setSucesso('')
                  }}
                  placeholder="DIGITE O PATRIMÔNIO OU DESCRIÇÃO"
                  autoComplete="off"
                  autoFocus
                />

                {carregando && (
                  <div className="mov-material-search-state">
                    Pesquisando...
                  </div>
                )}

                {!carregando &&
                  busca.trim().length >= 2 &&
                  materiais.length === 0 && (
                    <div className="mov-material-search-state">
                      Nenhum material encontrado.
                    </div>
                  )}

                {materiais.length > 0 && (
                  <div className="mov-material-results">
                    {materiais.map(
                      (material) => (
                        <button
                          key={material.id}
                          type="button"
                          className="mov-material-result"
                          onClick={() =>
                            selecionarMaterial(
                              material
                            )
                          }
                        >
                          <strong>
                            {obterTituloMaterial(
                              material
                            )}
                          </strong>

                          <span>
                            {obterSubtituloMaterial(
                              material
                            ) ||
                              'SEM INFORMAÇÕES COMPLEMENTARES'}
                          </span>

                          <small>
                            STATUS:{' '}
                            {material.status ||
                              'SEM STATUS'}
                          </small>
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            ) : (
              <article className="mov-material-selected">
                <div>
                  <span>
                    Material selecionado
                  </span>

                  <strong>
                    {obterTituloMaterial(
                      materialSelecionado
                    )}
                  </strong>

                  <p>
                    {obterSubtituloMaterial(
                      materialSelecionado
                    ) ||
                      'Sem informações complementares'}
                  </p>
                </div>

                <div className="mov-material-selected-meta">
                  <span>
                    Status

                    <strong>
                      {materialSelecionado.status ||
                        'SEM STATUS'}
                    </strong>
                  </span>

                  <span>
                    Unidade

                    <strong>
                      {materialSelecionado.unidade ||
                        'NÃO INFORMADA'}
                    </strong>
                  </span>
                </div>

                <button
                  type="button"
                  className="mov-material-change"
                  onClick={limparMaterial}
                  disabled={salvando}
                >
                  Trocar material
                </button>
              </article>
            )}
          </section>

          <section className="mov-material-section">
            <div className="mov-material-section-title">
              <span>2</span>

              <div>
                <h2>
                  Dados da operação
                </h2>

                <p>
                  Preencha os dados obrigatórios.
                </p>
              </div>
            </div>

            <div className="mov-material-grid">
              {precisaRecebedor && (
                <>
                  <div className="mov-material-field">
                    <label htmlFor="recebedorRE">
                      RE do recebedor
                    </label>

                    <input
                      id="recebedorRE"
                      name="recebedorRE"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={
                        form.recebedorRE
                      }
                      onChange={
                        atualizarCampo
                      }
                      placeholder="000000"
                      autoComplete="off"
                    />

                    {pesquisandoRecebedor && (
                      <div className="mov-material-search-state">
                        Pesquisando policial...
                      </div>
                    )}

                    {erroRecebedor && (
                      <div className="mov-material-message mov-material-message-error">
                        {erroRecebedor}
                      </div>
                    )}
                  </div>

                  <div className="mov-material-field mov-material-field-wide">
                    <label htmlFor="recebedorNome">
                      Nome do recebedor
                    </label>

                    <input
                      id="recebedorNome"
                      name="recebedorNome"
                      type="text"
                      value={
                        form.recebedorNome
                      }
                      placeholder={
                        pesquisandoRecebedor
                          ? 'PESQUISANDO...'
                          : 'NOME PREENCHIDO AUTOMATICAMENTE'
                      }
                      readOnly
                    />

                    {policialRecebedor && (
                      <div className="mov-material-search-state">
                        {[
                          policialRecebedor
                            .posto_graduacao,
                          policialRecebedor
                            .companhia,
                          policialRecebedor
                            .pelotao
                        ]
                          .filter(Boolean)
                          .join(' • ')}
                      </div>
                    )}
                  </div>
                </>
              )}

              {precisaDestino && (
                <div className="mov-material-field mov-material-field-wide">
                  <label htmlFor="localDestino">
                    Local de destino
                  </label>

                  <input
                    id="localDestino"
                    name="localDestino"
                    type="text"
                    value={
                      form.localDestino
                    }
                    onChange={
                      atualizarCampo
                    }
                    placeholder="LOCAL DE DESTINO"
                  />
                </div>
              )}

              {(precisaUnidade ||
                modo ===
                  MODOS.RECEBER) && (
                <div className="mov-material-field">
                  <label htmlFor="unidadeDestino">
                    Unidade de destino
                  </label>

                  <input
                    id="unidadeDestino"
                    name="unidadeDestino"
                    type="text"
                    value={
                      form.unidadeDestino
                    }
                    onChange={
                      atualizarCampo
                    }
                    placeholder="UNIDADE"
                  />
                </div>
              )}

              {precisaMotivo && (
                <div className="mov-material-field mov-material-field-full">
                  <label htmlFor="motivo">
                    Motivo da baixa
                  </label>

                  <input
                    id="motivo"
                    name="motivo"
                    type="text"
                    value={form.motivo}
                    onChange={
                      atualizarCampo
                    }
                    placeholder="INFORME O MOTIVO DA BAIXA"
                  />
                </div>
              )}

              <div className="mov-material-field">
                <label htmlFor="documento">
                  Documento
                </label>

                <input
                  id="documento"
                  name="documento"
                  type="text"
                  value={form.documento}
                  onChange={atualizarCampo}
                  placeholder="NÚMERO OU REFERÊNCIA"
                />
              </div>

              <div className="mov-material-field mov-material-field-full">
                <label htmlFor="observacao">
                  Observação
                </label>

                <textarea
                  id="observacao"
                  name="observacao"
                  rows={4}
                  value={form.observacao}
                  onChange={atualizarCampo}
                  placeholder="OBSERVAÇÕES COMPLEMENTARES"
                />
              </div>
            </div>
          </section>

          {erro && (
            <div className="mov-material-message mov-material-message-error">
              {erro}
            </div>
          )}

          {sucesso && (
            <div className="mov-material-message mov-material-message-success">
              {sucesso}
            </div>
          )}

          <footer className="mov-material-footer">
            <button
              type="button"
              className="mov-material-btn mov-material-btn-secondary"
              onClick={limparFormulario}
              disabled={salvando}
            >
              Limpar
            </button>

            <button
              type="submit"
              className="mov-material-btn mov-material-btn-primary"
              disabled={
                salvando ||
                pesquisandoRecebedor ||
                !materialSelecionado
              }
            >
              {salvando
                ? 'Processando...'
                : config.acao}
            </button>
          </footer>
        </form>
      </section>
    </main>
  )
}

export {
  MODOS
}