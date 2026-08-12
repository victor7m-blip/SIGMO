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
  criarSolicitacao
} from '../../../services/solicitacoesCadastroService'

import {
  registerAudit
} from '../../../services/auditoriaService'

import PolicialFotos from './PolicialFotos'

const initialForm = {
  tipo_cadastro: 'POLICIAL_27_BPM',
  orgao_origem: 'POLÍCIA MILITAR DO ESTADO DE SÃO PAULO',
  unidade_origem: '27º BPM/M',
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
  arma_somente_cautela: false,
  arma_sem_cautela: false,
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

const tiposCadastro = [
  { valor: 'POLICIAL_27_BPM', label: 'Policial do 27º BPM/M' },
  { valor: 'POLICIAL_OUTRA_OPM', label: 'Policial de outra OPM' },
  { valor: 'OUTRO_ORGAO', label: 'Integrante de outro órgão' },
  { valor: 'CIVIL_AUTORIZADO', label: 'Civil autorizado' }
]

const perfis = [
  'ADMINISTRADOR',
  'P4',
  'COMANDANTE DE CIA',
  'ENCARREGADO DO SVDD',
  'AUXILIAR DO SVDD',
  'USUÁRIO',
  'USUARIO EXTERNO'
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
  { campo: 'tipo_cadastro', label: 'Tipo de cadastro' },
  { campo: 'orgao_origem', label: 'Órgão de origem' },
  { campo: 'unidade_origem', label: 'Unidade de origem' },
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
  },
  {
    campo: 'arma_somente_cautela',
    label: 'Arma: somente cautela'
  },
  {
    campo: 'arma_sem_cautela',
    label: 'Arma: sem cautela'
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
  const tipoCadastro = upper(form.tipo_cadastro || 'POLICIAL_27_BPM').trim()
  const externo = tipoCadastro !== 'POLICIAL_27_BPM'

  const payload = {
    tipo_cadastro: tipoCadastro,
    orgao_origem: upper(form.orgao_origem).trim(),
    unidade_origem: upper(form.unidade_origem).trim(),
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

    companhia: externo ? '' : upper(form.companhia).trim(),

    pelotao: externo ? '' : upper(form.pelotao).trim(),

    equipe: externo ? '' : upper(form.equipe).trim(),

    funcao: externo ? '' : upper(form.funcao).trim(),

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

    perfil: externo ? 'USUARIO EXTERNO' : upper(form.perfil).trim(),

    situacao:
      upper(
        form.situacao ||
        'ATIVO'
      ),

    observacoes:
      upper(
        form.observacoes
      ).trim(),

    arma_somente_cautela:
      Boolean(form.arma_somente_cautela),

    arma_sem_cautela:
      Boolean(form.arma_sem_cautela),

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
    return { ...initialForm }
  }

  return {
    tipo_cadastro: upper(policial.tipo_cadastro || 'POLICIAL_27_BPM'),
    orgao_origem: upper(policial.orgao_origem || 'POLÍCIA MILITAR DO ESTADO DE SÃO PAULO'),
    unidade_origem: upper(policial.unidade_origem || '27º BPM/M'),
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

    arma_somente_cautela:
      Boolean(policial.arma_somente_cautela),

    arma_sem_cautela:
      Boolean(policial.arma_sem_cautela),

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
    'USUÁRIO'

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
          Cadastro concluído
        </h2>

        <p>
          Anote o PIN temporário. Ele será
          utilizado para acessar o SIGMO.
        </p>

        <div className="policial-pin-identificacao">
          <span>
            Pessoa
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
            Concluir
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

  const perfilUsuario =
    String(user?.perfil || '')
      .trim()
      .toUpperCase()

  const usuarioEhAuxiliar =
    ['AUXILIAR DO SVDD', 'AUXILIAR SVDD'].includes(perfilUsuario)

  const cadastroExterno =
    form.tipo_cadastro !== 'POLICIAL_27_BPM'

  const usuarioPolicialId =
    user?.policial_id ||
    user?.id_policial ||
    user?.id ||
    null

  const reUsuario =
    String(
      user?.re ||
      user?.policial?.re ||
      ''
    )
      .trim()
      .toUpperCase()

  const editandoProprioCadastro =
    Boolean(
      isEditing &&
      (
        (
          usuarioPolicialId &&
          String(policialEditando?.id) ===
            String(usuarioPolicialId)
        ) ||
        (
          reUsuario &&
          String(policialEditando?.re || '')
            .trim()
            .toUpperCase() ===
            reUsuario
        )
      )
    )

  const somenteCadastroProprio =
    ['USUÁRIO', 'USUARIO EXTERNO'].includes(perfilUsuario) &&
    editandoProprioCadastro

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

    const proximoForm = transformarPolicialEmForm(policialEditando)

    if (!policialEditando && usuarioEhAuxiliar) {
      proximoForm.tipo_cadastro = 'POLICIAL_OUTRA_OPM'
      proximoForm.orgao_origem = 'POLÍCIA MILITAR DO ESTADO DE SÃO PAULO'
      proximoForm.unidade_origem = ''
      proximoForm.perfil = 'USUARIO EXTERNO'
    }

    setForm(proximoForm)
  }, [
    policialEditando,
    usuarioEhAuxiliar
  ])

  function handleChange(
    event
  ) {
    const {
      name,
      value,
      type,
      checked
    } = event.target

    if (
      somenteCadastroProprio &&
      !['nome_guerra', 'telefone', 'email', 'pelotao'].includes(name)
    ) {
      return
    }

    if (type === 'checkbox') {
      setForm((prev) => ({
        ...prev,
        [name]: checked
      }))
      return
    }

    if (name === 'tipo_cadastro') {
      const tipo = upper(value)
      const externo = tipo !== 'POLICIAL_27_BPM'

      setForm((prev) => ({
        ...prev,
        tipo_cadastro: tipo,
        perfil: externo ? 'USUARIO EXTERNO' : (prev.perfil === 'USUARIO EXTERNO' ? 'USUÁRIO' : prev.perfil),
        orgao_origem: tipo === 'POLICIAL_27_BPM'
          ? 'POLÍCIA MILITAR DO ESTADO DE SÃO PAULO'
          : prev.orgao_origem,
        unidade_origem: tipo === 'POLICIAL_27_BPM'
          ? '27º BPM/M'
          : (prev.unidade_origem === '27º BPM/M' ? '' : prev.unidade_origem),
        companhia: externo ? '' : prev.companhia,
        pelotao: externo ? '' : prev.pelotao,
        equipe: externo ? '' : prev.equipe,
        funcao: externo ? '' : prev.funcao
      }))
      return
    }

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
    if (!payload.tipo_cadastro) {
      throw new Error('Informe o tipo de cadastro.')
    }

    if (payload.tipo_cadastro !== 'POLICIAL_27_BPM') {
      if (!payload.orgao_origem) {
        throw new Error('Informe o órgão de origem.')
      }
      if (!payload.unidade_origem) {
        throw new Error('Informe a unidade de origem.')
      }
      if (payload.perfil !== 'USUARIO EXTERNO') {
        throw new Error('O cadastro externo deve usar o perfil USUARIO EXTERNO.')
      }
    }

    if (usuarioEhAuxiliar && payload.tipo_cadastro === 'POLICIAL_27_BPM') {
      throw new Error('O Auxiliar do SVDD pode cadastrar somente público externo.')
    }

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

        let policialAtualizado

        if (somenteCadastroProprio) {
          const alterouPelotao =
            String(payload.pelotao || '') !==
            String(dadosAnteriores.pelotao || '')

          const payloadDireto = {
            ...dadosAnteriores,
            nome_guerra: payload.nome_guerra,
            telefone: payload.telefone,
            email: payload.email,
            pelotao: dadosAnteriores.pelotao
          }

          const alteracoesDiretas = compararAlteracoes(
            dadosAnteriores,
            payloadDireto
          )

          let cadastroAtual = policialEditando

          if (alteracoesDiretas.length > 0) {
            cadastroAtual = await atualizarPolicial(
              policialEditando.id,
              payloadDireto,
              user
            )

            await registrarAuditoriaSegura({
              acao: 'ATUALIZAR_PROPRIO_CADASTRO',
              descricao: montarDescricaoAtualizacao({
                user,
                anterior: dadosAnteriores,
                atual: payloadDireto,
                alteracoes: alteracoesDiretas
              }),
              modulo: 'Policiais',
              severidade: 'Informativo'
            })
          }

          if (alterouPelotao) {
            await criarSolicitacao({
              policialId: policialEditando.id,
              solicitadoPor: policialEditando.id,
              dadosAtuais: cadastroAtual,
              dadosNovos: {
                ...payloadDireto,
                pelotao: payload.pelotao
              }
            })

            await registrarAuditoriaSegura({
              acao: 'SOLICITACAO_CADASTRAL',
              descricao:
                `${obterNomeUsuario(user)} solicitou alteração de pelotão.`,
              modulo: 'Policiais',
              severidade: 'Informativo'
            })
          }

          setForm(
            transformarPolicialEmForm(cadastroAtual)
          )

          setSucesso(
            alterouPelotao
              ? 'Dados permitidos atualizados. A alteração de pelotão foi enviada para aprovação.'
              : alteracoesDiretas.length > 0
                ? 'Cadastro atualizado com sucesso.'
                : 'Nenhuma alteração foi identificada.'
          )

          onSaved?.(cadastroAtual, {
            manterAberto: true
          })
          return
        }

        policialAtualizado =
          await atualizarPolicial(
  policialEditando.id,
  payload,
  user
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
  payload,
  user
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
    setForm(usuarioEhAuxiliar
      ? {
          ...initialForm,
          tipo_cadastro: 'POLICIAL_OUTRA_OPM',
          unidade_origem: '',
          perfil: 'USUARIO EXTERNO'
        }
      : initialForm)

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
                ? 'Editar cadastro'
                : 'Cadastrar pessoa'}
            </h3>

            <p>
              Preencha os dados de identificação, origem e acesso ao SIGMO.
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
          <label className="form-wide">
            Tipo de cadastro

            <select
              name="tipo_cadastro"
              value={form.tipo_cadastro}
              onChange={handleChange}
              disabled={somenteCadastroProprio || (usuarioEhAuxiliar && !cadastroExterno)}
              required
            >
              {tiposCadastro
                .filter((item) => !usuarioEhAuxiliar || item.valor !== 'POLICIAL_27_BPM')
                .map((item) => (
                  <option key={item.valor} value={item.valor}>
                    {item.label}
                  </option>
                ))}
            </select>
          </label>

          {cadastroExterno && (
            <>
              <label>
                Órgão de origem
                <input
                  name="orgao_origem"
                  value={form.orgao_origem}
                  onChange={handleChange}
                  placeholder="EX.: POLÍCIA MILITAR"
                  required
                
              disabled={somenteCadastroProprio}/>
              </label>

              <label>
                Unidade de origem
                <input
                  name="unidade_origem"
                  value={form.unidade_origem}
                  onChange={handleChange}
                  placeholder="EX.: 10º BPM/M - 2ª CIA"
                  required
                
              disabled={somenteCadastroProprio}/>
              </label>
            </>
          )}

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
            
              disabled={somenteCadastroProprio}/>
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
            
              disabled={somenteCadastroProprio}/>
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
              disabled={somenteCadastroProprio}
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
          {!cadastroExterno && (
            <>
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
              disabled={somenteCadastroProprio}
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
            
              disabled={somenteCadastroProprio}/>
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
            
              disabled={somenteCadastroProprio}/>
          </label>

            </>
          )}

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
            
              disabled={somenteCadastroProprio}/>
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
            
              disabled={somenteCadastroProprio}/>
          </label>

          <label>
            Perfil

            <select
              name="perfil"
              value={form.perfil}
              onChange={handleChange}
              disabled={somenteCadastroProprio || cadastroExterno}
              required
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
              disabled={somenteCadastroProprio}
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
          
              disabled={somenteCadastroProprio}/>
        </label>

        {!somenteCadastroProprio && (
          <div className="form-full">
            <strong>Restrições de armamento</strong>

            <label>
              <input
                type="checkbox"
                name="arma_somente_cautela"
                checked={Boolean(form.arma_somente_cautela)}
                onChange={handleChange}
              />
              Somente cautela — não permite receber arma como carga permanente.
            </label>

            <label>
              <input
                type="checkbox"
                name="arma_sem_cautela"
                checked={Boolean(form.arma_sem_cautela)}
                onChange={handleChange}
              />
              Sem cautela de arma — não permite receber arma em cautela.
            </label>
          </div>
        )}

        {isEditing && !somenteCadastroProprio && (
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