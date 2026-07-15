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

const situacoes = [
  'ATIVO',
  'AFASTADO',
  'FÉRIAS',
  'LICENÇA',
  'INATIVO'
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

const perfis = [
  'COMANDANTE DE CIA',
  'ENCARREGADO DO SVDD',
  'AUXILIAR DO SVDD',
  'USUÁRIO'
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
    .replace(/[^0-9]/g, '')
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
    return `${numeros.slice(
      0,
      2
    )}-${numeros.slice(2)}`
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

function gerarTextoQrCode(form) {
  return JSON.stringify({
    modulo: 'POLICIAIS',
    nome: form.nome,
    nome_guerra: form.nome_guerra,
    re: form.re,
    posto_graduacao:
      form.posto_graduacao,
    companhia: form.companhia,
    pelotao: form.pelotao,
    equipe: form.equipe,
    situacao: form.situacao
  })
}

function montarPayload(form) {
  const payload = {
    nome:
      upper(form.nome).trim(),

    nome_guerra:
      upper(form.nome_guerra).trim(),

    re:
      maskRE(form.re),

    posto_graduacao:
      upper(
        form.posto_graduacao
      ).trim(),

    companhia:
      upper(form.companhia).trim(),

    pelotao:
      upper(form.pelotao).trim(),

    equipe:
      upper(form.equipe).trim(),

    funcao:
      upper(form.funcao).trim(),

    telefone:
      maskTelefone(form.telefone),

    email:
      clean(form.email),

    cpf:
      maskCPF(form.cpf),

    rg:
      upper(form.rg).trim(),

    perfil:
      upper(form.perfil).trim(),

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
      clean(form.foto_url),

    qr_code:
      clean(form.qr_code)
  }

  if (!payload.qr_code) {
    payload.qr_code =
      gerarTextoQrCode(payload)
  }

  return payload
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
            onClick={copiarPin}
          >
            {copiado
              ? 'PIN copiado'
              : 'Copiar PIN'}
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={onConcluir}
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
      [policialEditando]
    )

  useEffect(() => {
    setPinTemporario('')
    setPolicialCriado(null)

    if (policialEditando) {
      setForm({
        nome:
          upper(
            policialEditando.nome
          ),

        nome_guerra:
          upper(
            policialEditando.nome_guerra
          ),

        re:
          maskRE(
            policialEditando.re
          ),

        posto_graduacao:
          upper(
            policialEditando
              .posto_graduacao
          ),

        companhia:
          upper(
            policialEditando.companhia
          ),

        pelotao:
          upper(
            policialEditando.pelotao
          ),

        equipe:
          upper(
            policialEditando.equipe
          ),

        funcao:
          upper(
            policialEditando.funcao
          ),

        telefone:
          maskTelefone(
            policialEditando.telefone
          ),

        email:
          policialEditando.email ||
          '',

        cpf:
          maskCPF(
            policialEditando.cpf
          ),

        rg:
          upper(
            policialEditando.rg
          ),

        perfil:
          upper(
            policialEditando.perfil
          ),

        situacao:
          upper(
            policialEditando
              .situacao ||
            'ATIVO'
          ),

        observacoes:
          upper(
            policialEditando
              .observacoes
          ),

        foto_url:
          policialEditando
            .foto_url ||
          '',

        qr_code:
          policialEditando
            .qr_code ||
          ''
      })
    } else {
      setForm(initialForm)
    }
  }, [policialEditando])

  function handleChange(event) {
    const {
      name,
      value
    } = event.target

    if (name === 're') {
      setForm((prev) => ({
        ...prev,
        re: maskRE(value)
      }))

      return
    }

    if (name === 'telefone') {
      setForm((prev) => ({
        ...prev,
        telefone:
          maskTelefone(value)
      }))

      return
    }

    if (name === 'cpf') {
      setForm((prev) => ({
        ...prev,
        cpf:
          maskCPF(value)
      }))

      return
    }

    if (name === 'email') {
      setForm((prev) => ({
        ...prev,
        email: value
      }))

      return
    }

    setForm((prev) => ({
      ...prev,
      [name]:
        upper(value)
    }))
  }

  function gerarQrCode() {
    setForm((prev) => ({
      ...prev,

      qr_code:
        gerarTextoQrCode(
          montarPayload(prev)
        )
    }))
  }

  async function registrarAuditoriaSegura(
    dados
  ) {
    try {
      await registerAudit(dados)
    } catch (error) {
      console.error(
        'Erro ao registrar auditoria:',
        error
      )
    }
  }

  function validarPayload(payload) {
    if (!payload.nome) {
      throw new Error(
        'Informe o nome do policial.'
      )
    }

    if (!payload.nome_guerra) {
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
        montarPayload(form)

      validarPayload(payload)

      if (isEditing) {
  const policialAtualizado =
    await atualizarPolicial(
      policialEditando.id,
      payload
    )

  await registrarAuditoriaSegura({
    acao:
      'ATUALIZAR',

    descricao:
      `Policial atualizado: ${payload.nome_guerra} - RE ${payload.re}`,

    ator_id:
      user?.id,

    ator_nome:
      user?.nome,

    perfil:
      user?.perfil,

    modulo:
      'POLICIAIS',

    severidade:
      'INFO'
  })

  setForm({
    nome:
      upper(policialAtualizado.nome),

    nome_guerra:
      upper(
        policialAtualizado.nome_guerra
      ),

    re:
      maskRE(
        policialAtualizado.re
      ),

    posto_graduacao:
      upper(
        policialAtualizado.posto_graduacao
      ),

    companhia:
      upper(
        policialAtualizado.companhia
      ),

    pelotao:
      upper(
        policialAtualizado.pelotao
      ),

    equipe:
      upper(
        policialAtualizado.equipe
      ),

    funcao:
      upper(
        policialAtualizado.funcao
      ),

    telefone:
      maskTelefone(
        policialAtualizado.telefone
      ),

    email:
      policialAtualizado.email || '',

    cpf:
      maskCPF(
        policialAtualizado.cpf
      ),

    rg:
      upper(
        policialAtualizado.rg
      ),

    perfil:
      upper(
        policialAtualizado.perfil
      ),

    situacao:
      upper(
        policialAtualizado.situacao ||
        'ATIVO'
      ),

    observacoes:
      upper(
        policialAtualizado.observacoes
      ),

    foto_url:
      policialAtualizado.foto_url || '',

    qr_code:
      policialAtualizado.qr_code || ''
  })

  setSucesso(
    'Dados do policial atualizados com sucesso.'
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
          `Policial cadastrado: ${payload.nome_guerra} - RE ${payload.re}`,

        ator_id:
          user?.id,

        ator_nome:
          user?.nome,

        perfil:
          user?.perfil,

        modulo:
          'POLICIAIS',

        severidade:
          'INFO'
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
        onSubmit={handleSubmit}
      >
        <div className="form-header">
          <div>
            <h3>
              {isEditing
                ? 'Editar policial'
                : 'Cadastrar policial'}
            </h3>

            <p>
              Preencha os dados funcionais e
              administrativos do policial.
            </p>
          </div>

          <div className="form-actions-top">
            <button
              type="button"
              className="btn-secondary"
              onClick={onCancel}
              disabled={saving}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="btn-primary"
              disabled={saving}
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
              value={form.nome}
              onChange={handleChange}
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
              onChange={handleChange}
              required
            />
          </label>

          <label>
            RE

            <input
              name="re"
              value={form.re}
              onChange={handleChange}
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
              onChange={handleChange}
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
              value={form.companhia}
              onChange={handleChange}
            >
              <option value="">
                SELECIONE
              </option>

              {companhias.map(
                (companhia) => (
                  <option
                    key={companhia}
                    value={companhia}
                  >
                    {companhia}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            Pelotão

            <input
              name="pelotao"
              value={form.pelotao}
              onChange={handleChange}
            />
          </label>

          <label>
            Equipe

            <input
              name="equipe"
              value={form.equipe}
              onChange={handleChange}
            />
          </label>

          <label>
            Função

            <input
              name="funcao"
              value={form.funcao}
              onChange={handleChange}
            />
          </label>

          <label>
            Telefone

            <input
              name="telefone"
              value={form.telefone}
              onChange={handleChange}
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
              value={form.email}
              onChange={handleChange}
            />
          </label>

          <label>
            CPF

            <input
              name="cpf"
              value={form.cpf}
              onChange={handleChange}
              inputMode="numeric"
              placeholder="111.111.111-11"
              maxLength={14}
            />
          </label>

          <label>
            RG

            <input
              name="rg"
              value={form.rg}
              onChange={handleChange}
            />
          </label>

          <label>
            Perfil

            <select
              name="perfil"
              value={form.perfil}
              onChange={handleChange}
            >
              <option value="">
                SELECIONE
              </option>

              {perfis.map(
                (perfil) => (
                  <option
                    key={perfil}
                    value={perfil}
                  >
                    {perfil}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            Situação

            <select
              name="situacao"
              value={form.situacao}
              onChange={handleChange}
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
            value={form.observacoes}
            onChange={handleChange}
            rows={4}
          />
        </label>

        <div className="qr-card">
          <div>
            <strong>
              QR Code
            </strong>

            <p>
              Gere o conteúdo do QR Code para
              identificação do policial.
            </p>
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={gerarQrCode}
          >
            Gerar QR
          </button>
        </div>

        {form.qr_code && (
          <div className="qr-preview">
            <textarea
              value={form.qr_code}
              readOnly
              rows={4}
            />
          </div>
        )}

        {isEditing && (
          <PolicialFotos
            policialId={policialId}
            user={user}
          />
        )}

        {!isEditing && (
          <div className="form-info">
            Salve o cadastro primeiro para
            liberar o envio de fotos.
          </div>
        )}

        <div className="form-actions-bottom">
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={saving}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="btn-primary"
            disabled={saving}
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