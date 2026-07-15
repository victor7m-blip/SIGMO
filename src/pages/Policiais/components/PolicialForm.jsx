import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  cadastrarPolicial,
  atualizarPolicial
} from '../../../services/policiaisService'

import {
  registerAudit
} from '../../../services/auditoriaService'

import PolicialFotos from './PolicialFotos'

const initialForm = {
  nome: '',
  nome_guerra: '',
  re: '',
  posto_graduacao: '',
  companhia: '',
  pelotao: '',
  equipe: '',
  funcao: '',
  telefone: '',
  email: '',
  cpf: '',
  rg: '',
  perfil: '',
  situacao: 'ATIVO',
  observacoes: '',
  foto_url: '',
  qr_code: ''
}

const postosGraduacoes = [
  'SD PM',
  'CB PM',
  '3º SGT PM',
  '2º SGT PM',
  '1º SGT PM',
  'SUBTEN PM',
  'ASP OF PM',
  '2º TEN PM',
  '1º TEN PM',
  'CAP PM',
  'MAJ PM',
  'TEN CEL PM',
  'CEL PM'
]

const companhias = [
  '1ª CIA',
  '2ª CIA',
  '3ª CIA',
  '4ª CIA',
  '5ª CIA',
  '6ª CIA',
  'FT',
  'BTL'
]

const pelotoes = [
  'A',
  'B',
  'C',
  'D',
  'POP',
  'ESCOLAR',
  'ADM'
]

const perfis = [
  'ADMINISTRADOR',
  'COMANDANTE DE CIA',
  'ENCARREGADO DO SVDD',
  'AUXILIAR DO SVDD',
  'USUÁRIO'
]

const situacoes = [
  'ATIVO',
  'AFASTADO',
  'FÉRIAS',
  'LICENÇA',
  'TRANSFERIDO',
  'INATIVO'
]

const CAMPOS_AUDITAVEIS = [
  {
    campo: 'nome',
    label: 'Nome completo'
  },
  {
    campo: 'nome_guerra',
    label: 'Nome de guerra'
  },
  {
    campo: 're',
    label: 'RE'
  },
  {
    campo: 'posto_graduacao',
    label: 'Posto/Graduação'
  },
  {
    campo: 'companhia',
    label: 'Companhia'
  },
  {
    campo: 'pelotao',
    label: 'Pelotão'
  },
  {
    campo: 'equipe',
    label: 'Equipe'
  },
  {
    campo: 'funcao',
    label: 'Função'
  },
  {
    campo: 'perfil',
    label: 'Perfil'
  },
  {
    campo: 'situacao',
    label: 'Situação'
  },
  {
    campo: 'rg',
    label: 'RG',
    ocultarValores: true
  },
  {
    campo: 'cpf',
    label: 'CPF',
    ocultarValores: true
  },
  {
    campo: 'telefone',
    label: 'Telefone',
    ocultarValores: true
  },
  {
    campo: 'email',
    label: 'E-mail',
    ocultarValores: true
  },
  {
    campo: 'observacoes',
    label: 'Observações',
    ocultarValores: true
  }
]

function upper(value) {
  return String(value || '')
    .toUpperCase()
}

function clean(value) {
  return String(value || '')
    .trim()
}

function somenteNumeros(value) {
  return String(value || '')
    .replace(/\D/g, '')
}

function maskRE(value) {
  const raw = String(value || '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')

  const numeros = raw
    .replace(/\D/g, '')
    .slice(0, 6)

  const digito = raw
    .slice(6)
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, 1)

  if (
    numeros.length === 6 &&
    !digito
  ) {
    return `${numeros}-`
  }

  if (
    numeros.length === 6 &&
    digito
  ) {
    return `${numeros}-${digito}`
  }

  return numeros
}

function maskTelefone(value) {
  const numeros =
    somenteNumeros(value)
      .slice(0, 11)

  if (numeros.length <= 2) {
    return numeros
  }

  if (numeros.length <= 7) {
    return (
      `${numeros.slice(0, 2)}-` +
      `${numeros.slice(2)}`
    )
  }

  return (
    `${numeros.slice(0, 2)}-` +
    `${numeros.slice(2, 7)}-` +
    `${numeros.slice(7, 11)}`
  )
}

function maskCPF(value) {
  const numeros =
    somenteNumeros(value)
      .slice(0, 11)

  if (numeros.length <= 3) {
    return numeros
  }

  if (numeros.length <= 6) {
    return (
      `${numeros.slice(0, 3)}.` +
      `${numeros.slice(3)}`
    )
  }

  if (numeros.length <= 9) {
    return (
      `${numeros.slice(0, 3)}.` +
      `${numeros.slice(3, 6)}.` +
      `${numeros.slice(6)}`
    )
  }

  return (
    `${numeros.slice(0, 3)}.` +
    `${numeros.slice(3, 6)}.` +
    `${numeros.slice(6, 9)}-` +
    `${numeros.slice(9, 11)}`
  )
}

function gerarQrCodePolicial() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return (
      `SIGMO-POLICIAL-` +
      `${crypto.randomUUID()}`
    )
  }

  return (
    `SIGMO-POLICIAL-` +
    `${Date.now()}-` +
    `${Math.random()
      .toString(36)
      .slice(2, 12)
      .toUpperCase()}`
  )
}

function montarPayload(form) {
  const payload = {
    nome:
      upper(form.nome).trim(),

    nome_guerra:
      upper(
        form.nome_guerra
      ).trim(),

    re:
      maskRE(form.re),

    posto_graduacao:
      upper(
        form.posto_graduacao
      ).trim(),

    companhia:
      upper(
        form.companhia
      ).trim(),

    pelotao:
      upper(
        form.pelotao
      ).trim(),

    equipe:
      upper(
        form.equipe
      ).trim(),

    funcao:
      upper(
        form.funcao
      ).trim(),

    telefone:
      maskTelefone(
        form.telefone
      ),

    email:
      clean(form.email),

    cpf:
      maskCPF(form.cpf),

    rg:
      upper(
        form.rg
      ).trim(),

    perfil:
      upper(
        form.perfil
      ).trim(),

    situacao:
      upper(
        form.situacao ||
        'ATIVO'
      ),

    observacoes:
      upper(
        form.observacoes
      ).trim(),

    foto_url:
      clean(
        form.foto_url
      ),

    qr_code:
      clean(
        form.qr_code
      )
  }

  if (!payload.qr_code) {
    payload.qr_code =
      gerarQrCodePolicial()
  }

  return payload
}
function transformarPolicialEmForm(
  policial
) {
  if (!policial) {
    return initialForm
  }

  return {
    nome:
      upper(
        policial.nome
      ),

    nome_guerra:
      upper(
        policial.nome_guerra
      ),

    re:
      maskRE(
        policial.re
      ),

    posto_graduacao:
      upper(
        policial.posto_graduacao
      ),

    companhia:
      upper(
        policial.companhia
      ),

    pelotao:
      upper(
        policial.pelotao
      ),

    equipe:
      upper(
        policial.equipe
      ),

    funcao:
      upper(
        policial.funcao
      ),

    telefone:
      maskTelefone(
        policial.telefone
      ),

    email:
      policial.email || '',

    cpf:
      maskCPF(
        policial.cpf
      ),

    rg:
      upper(
        policial.rg
      ),

    perfil:
      upper(
        policial.perfil
      ),

    situacao:
      upper(
        policial.situacao ||
        'ATIVO'
      ),

    observacoes:
      upper(
        policial.observacoes
      ),

    foto_url:
      policial.foto_url || '',

    qr_code:
      policial.qr_code || ''
  }
}

function normalizarValorComparacao(
  valor
) {
  return String(
    valor ?? ''
  ).trim()
}

function valorExibicao(
  valor
) {
  const texto =
    normalizarValorComparacao(
      valor
    )

  return texto || 'NÃO INFORMADO'
}

function montarIdentificacaoPolicial(
  dados
) {
  const posto =
    normalizarValorComparacao(
      dados?.posto_graduacao
    )

  const nome =
    normalizarValorComparacao(
      dados?.nome_guerra ||
      dados?.nome
    ) ||
    'POLICIAL'

  const re =
    normalizarValorComparacao(
      dados?.re
    )

  const identificacao =
    [
      posto,
      nome
    ]
      .filter(Boolean)
      .join(' ')

  if (re) {
    return (
      `${identificacao} — RE ${re}`
    )
  }

  return identificacao
}

function compararAlteracoes(
  anterior,
  atual
) {
  const alteracoes = []

  for (
    const configuracao
    of CAMPOS_AUDITAVEIS
  ) {
    const valorAnterior =
      normalizarValorComparacao(
        anterior?.[
          configuracao.campo
        ]
      )

    const valorAtual =
      normalizarValorComparacao(
        atual?.[
          configuracao.campo
        ]
      )

    if (
      valorAnterior ===
      valorAtual
    ) {
      continue
    }

    alteracoes.push({
      campo:
        configuracao.campo,

      label:
        configuracao.label,

      valorAnterior,

      valorAtual,

      ocultarValores:
        Boolean(
          configuracao
            .ocultarValores
        )
    })
  }

  return alteracoes
}

function montarResumoAlteracoes(
  alteracoes
) {
  if (
    !Array.isArray(
      alteracoes
    ) ||
    alteracoes.length === 0
  ) {
    return (
      'Nenhuma alteração de campo identificada.'
    )
  }

  return alteracoes
    .map(
      (alteracao) => {
        if (
          alteracao
            .ocultarValores
        ) {
          return (
            `${alteracao.label}: ` +
            `informação atualizada`
          )
        }

        return (
          `${alteracao.label}: ` +
          `${valorExibicao(
            alteracao.valorAnterior
          )} → ` +
          `${valorExibicao(
            alteracao.valorAtual
          )}`
        )
      }
    )
    .join(' | ')
}

function obterNomeUsuario(
  user
) {
  return (
    user?.nome ||
    user?.nome_guerra ||
    user?.nome_completo ||
    user?.name ||
    user?.email ||
    'SIGMO'
  )
}

function montarDescricaoAtualizacao({
  user,
  anterior,
  atual,
  alteracoes
}) {
  const ator =
    obterNomeUsuario(
      user
    )

  const identificacao =
    montarIdentificacaoPolicial(
      atual ||
      anterior
    )

  const resumo =
    montarResumoAlteracoes(
      alteracoes
    )

  return (
    `${ator} alterou o cadastro de ` +
    `${identificacao}. ` +
    `Alterações: ${resumo}.`
  )
}

function montarDescricaoCadastro({
  user,
  policial
}) {
  const ator =
    obterNomeUsuario(
      user
    )

  const identificacao =
    montarIdentificacaoPolicial(
      policial
    )

  return (
    `${ator} cadastrou ` +
    `${identificacao}.`
  )
}

function PinTemporarioModal({
  policial,
  pin,
  onConcluir
}) {
  const [
    copiado,
    setCopiado
  ] = useState(false)

  async function copiarPin() {
    try {
      await navigator.clipboard.writeText(
        pin
      )

      setCopiado(true)

      setTimeout(() => {
        setCopiado(false)
      }, 2000)
    } catch {
      window.prompt(
        'Copie o PIN temporário:',
        pin
      )
    }
  }

  return (
    <div className="policial-pin-overlay">
      <section className="policial-pin-modal">
        <span className="policial-pin-kicker">
          CADASTRO CONCLUÍDO
        </span>

        <h2>
          Policial cadastrado
        </h2>

        <p>
          Anote o PIN temporário. Ele será
          utilizado para acessar o SIGMO.
        </p>

        <div className="policial-pin-identificacao">
          <span>
            Policial
          </span>

          <strong>
            {policial?.nome_guerra ||
              policial?.nome ||
              'POLICIAL'}
          </strong>
        </div>

        <div className="policial-pin-identificacao">
          <span>
            RE
          </span>

          <strong>
            {policial?.re ||
              'NÃO INFORMADO'}
          </strong>
        </div>

        <div className="policial-pin-codigo">
          <span>
            PIN TEMPORÁRIO
          </span>

          <strong>
            {pin}
          </strong>
        </div>

        <div className="policial-pin-aviso">
          Este PIN será exibido somente
          neste momento. Anote ou copie
          antes de concluir.
        </div>

        <div className="policial-pin-acoes">
          <button
            type="button"
            className="btn-secondary"
            onClick={
              copiarPin
            }
          >
            {copiado
              ? 'PIN copiado'
              : 'Copiar PIN'}
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={
              onConcluir
            }
          >
            Concluir cadastro
          </button>
        </div>
      </section>
    </div>
  )
}
export default function PolicialForm({
  user,
  policialEditando,
  onCancel,
  onSaved
}) {
  const [
    form,
    setForm
  ] = useState(initialForm)

  const [
    saving,
    setSaving
  ] = useState(false)

  const [
    erro,
    setErro
  ] = useState('')

  const [
    sucesso,
    setSucesso
  ] = useState('')

  const [
    pinTemporario,
    setPinTemporario
  ] = useState('')

  const [
    policialCriado,
    setPolicialCriado
  ] = useState(null)

  const isEditing =
    Boolean(
      policialEditando?.id
    )

  const policialId =
    useMemo(
      () =>
        policialEditando?.id ||
        null,
      [
        policialEditando
      ]
    )

  useEffect(() => {
    setPinTemporario('')
    setPolicialCriado(null)
    setErro('')
    setSucesso('')

    setForm(
      transformarPolicialEmForm(
        policialEditando
      )
    )
  }, [
    policialEditando
  ])

  function handleChange(
    event
  ) {
    const {
      name,
      value
    } = event.target

    if (name === 're') {
      setForm(
        (prev) => ({
          ...prev,

          re:
            maskRE(
              value
            )
        })
      )

      return
    }

    if (
      name ===
      'telefone'
    ) {
      setForm(
        (prev) => ({
          ...prev,

          telefone:
            maskTelefone(
              value
            )
        })
      )

      return
    }

    if (name === 'cpf') {
      setForm(
        (prev) => ({
          ...prev,

          cpf:
            maskCPF(
              value
            )
        })
      )

      return
    }

    if (
      name ===
      'email'
    ) {
      setForm(
        (prev) => ({
          ...prev,

          email:
            value
        })
      )

      return
    }

    setForm(
      (prev) => ({
        ...prev,

        [name]:
          upper(
            value
          )
      })
    )
  }

  async function registrarAuditoriaSegura({
    acao,
    descricao,
    modulo = 'Policiais',
    severidade = 'Informativo'
  }) {
    try {
      await registerAudit(
        acao,
        descricao,
        user,
        modulo,
        severidade
      )
    } catch (error) {
      console.error(
        'Erro ao registrar auditoria:',
        error
      )
    }
  }

  function validarPayload(
    payload
  ) {
    if (!payload.nome) {
      throw new Error(
        'Informe o nome do policial.'
      )
    }

    if (
      !payload.nome_guerra
    ) {
      throw new Error(
        'Informe o nome de guerra.'
      )
    }

    if (
      !/^\d{6}-[0-9A-Z]$/.test(
        payload.re
      )
    ) {
      throw new Error(
        'Informe o RE no padrão 123456-A ou 123456-7.'
      )
    }

    if (
      payload.telefone &&
      !/^\d{2}-\d{5}-\d{4}$/.test(
        payload.telefone
      )
    ) {
      throw new Error(
        'Informe o telefone no padrão 11-11111-1111.'
      )
    }

    if (
      payload.cpf &&
      !/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(
        payload.cpf
      )
    ) {
      throw new Error(
        'Informe o CPF no padrão 111.111.111-11.'
      )
    }
  }

  async function handleSubmit(
    event
  ) {
    event.preventDefault()

    setSaving(true)
    setErro('')
    setSucesso('')

    try {
      const payload =
        montarPayload(
          form
        )

      validarPayload(
        payload
      )

      if (isEditing) {
        const dadosAnteriores =
          montarPayload(
            transformarPolicialEmForm(
              policialEditando
            )
          )

        const alteracoes =
          compararAlteracoes(
            dadosAnteriores,
            payload
          )

        const policialAtualizado =
          await atualizarPolicial(
            policialEditando.id,
            payload
          )

        if (
          alteracoes.length >
          0
        ) {
          await registrarAuditoriaSegura({
            acao:
              'ATUALIZAR',

            descricao:
              montarDescricaoAtualizacao({
                user,

                anterior:
                  dadosAnteriores,

                atual:
                  payload,

                alteracoes
              }),

            modulo:
              'Policiais',

            severidade:
              'Informativo'
          })
        }

        setForm(
          transformarPolicialEmForm(
            policialAtualizado
          )
        )

        setSucesso(
          alteracoes.length > 0
            ? 'Dados do policial atualizados com sucesso.'
            : 'Nenhuma alteração foi identificada.'
        )

        onSaved?.(
          policialAtualizado,
          {
            manterAberto: true
          }
        )

        return
      }

      const novoPolicial =
        await cadastrarPolicial(
          payload
        )

      await registrarAuditoriaSegura({
        acao:
          'CADASTRAR',

        descricao:
          montarDescricaoCadastro({
            user,

            policial:
              novoPolicial ||
              payload
          }),

        modulo:
          'Policiais',

        severidade:
          'Informativo'
      })

      setPolicialCriado(
        novoPolicial
      )

      setPinTemporario(
        novoPolicial
          ?.pinTemporario ||
        novoPolicial
          ?.pin ||
        ''
      )
    } catch (error) {
      console.error(
        'Erro ao salvar policial:',
        error
      )

      setErro(
        error?.message ||
        error?.details ||
        'Erro ao salvar policial.'
      )
    } finally {
      setSaving(false)
    }
  }

  function concluirCadastro() {
    const resultado =
      policialCriado

    setPinTemporario('')
    setPolicialCriado(null)
    setForm(initialForm)

    onSaved?.(
      resultado
    )
  }

  return (
    <>
      <form
        className="policial-form"
        onSubmit={
          handleSubmit
        }
      >
        <div className="form-header">
          <div>
            <h3>
              {isEditing
                ? 'Editar policial'
                : 'Cadastrar policial'}
            </h3>

            <p>
              Preencha os dados funcionais e administrativos do policial.
            </p>
          </div>

          <div className="form-actions-top">
            <button
              type="button"
              className="btn-secondary"
              onClick={
                onCancel
              }
              disabled={
                saving
              }
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="btn-primary"
              disabled={
                saving
              }
            >
              {saving
                ? 'Salvando...'
                : isEditing
                  ? 'Atualizar'
                  : 'Salvar'}
            </button>
          </div>
        </div>

        {erro && (
          <div className="form-error">
            {erro}
          </div>
        )}

        {sucesso && (
          <div className="form-success">
            {sucesso}
          </div>
        )}

        <div className="form-grid">
          <label>
            Nome completo

            <input
              name="nome"
              value={
                form.nome
              }
              onChange={
                handleChange
              }
              required
            />
          </label>

          <label>
            Nome de guerra

            <input
              name="nome_guerra"
              value={
                form.nome_guerra
              }
              onChange={
                handleChange
              }
              required
            />
          </label>

          <label>
            RE

            <input
              name="re"
              value={
                form.re
              }
              onChange={
                handleChange
              }
              placeholder="123456-A"
              maxLength={8}
              required
            />
          </label>

          <label>
            Posto / graduação

            <select
              name="posto_graduacao"
              value={
                form.posto_graduacao
              }
              onChange={
                handleChange
              }
            >
              <option value="">
                SELECIONE
              </option>

              {postosGraduacoes.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                )
              )}
            </select>
          </label>
                  <label>
            Companhia

            <select
              name="companhia"
              value={
                form.companhia
              }
              onChange={
                handleChange
              }
            >
              <option value="">
                SELECIONE
              </option>

              {companhias.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            Pelotão

            <select
              name="pelotao"
              value={
                form.pelotao
              }
              onChange={
                handleChange
              }
            >
              <option value="">
                SELECIONE
              </option>

              {pelotoes.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            Equipe

            <input
              name="equipe"
              value={
                form.equipe
              }
              onChange={
                handleChange
              }
            />
          </label>

          <label>
            Função

            <input
              name="funcao"
              value={
                form.funcao
              }
              onChange={
                handleChange
              }
            />
          </label>

          <label>
            Telefone

            <input
              name="telefone"
              value={
                form.telefone
              }
              onChange={
                handleChange
              }
              inputMode="numeric"
              placeholder="11-11111-1111"
              maxLength={13}
            />
          </label>

          <label>
            E-mail

            <input
              name="email"
              type="email"
              value={
                form.email
              }
              onChange={
                handleChange
              }
            />
          </label>

          <label>
            CPF

            <input
              name="cpf"
              value={
                form.cpf
              }
              onChange={
                handleChange
              }
              inputMode="numeric"
              placeholder="111.111.111-11"
              maxLength={14}
            />
          </label>

          <label>
            RG

            <input
              name="rg"
              value={
                form.rg
              }
              onChange={
                handleChange
              }
            />
          </label>

          <label>
            Perfil

            <select
              name="perfil"
              value={
                form.perfil
              }
              onChange={
                handleChange
              }
            >
              <option value="">
                SELECIONE
              </option>

              {perfis.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            Situação

            <select
              name="situacao"
              value={
                form.situacao
              }
              onChange={
                handleChange
              }
            >
              {situacoes.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                )
              )}
            </select>
          </label>
        </div>

        <label className="form-full">
          Observações

          <textarea
            name="observacoes"
            value={
              form.observacoes
            }
            onChange={
              handleChange
            }
            rows={4}
          />
        </label>

        {isEditing && (
          <PolicialFotos
            policialId={
              policialId
            }
            user={
              user
            }
          />
        )}

        {!isEditing && (
          <div className="form-info">
            Salve o cadastro primeiro para liberar o envio de fotos.
          </div>
        )}

        <div className="form-actions-bottom">
          <button
            type="button"
            className="btn-secondary"
            onClick={
              onCancel
            }
            disabled={
              saving
            }
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="btn-primary"
            disabled={
              saving
            }
          >
            {saving
              ? 'Salvando...'
              : isEditing
                ? 'Atualizar policial'
                : 'Salvar policial'}
          </button>
        </div>
      </form>

      {pinTemporario && (
        <PinTemporarioModal
          policial={
            policialCriado
          }
          pin={
            pinTemporario
          }
          onConcluir={
            concluirCadastro
          }
        />
      )}
    </>
  )
}  