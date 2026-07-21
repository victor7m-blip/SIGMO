import {
  useEffect,
  useState
} from 'react'

import SigmoButton from '../../../ui/components/SigmoButton'
import SigmoCard from '../../../ui/components/SigmoCard'

import TPDDados from './TPDDados'
import TPDFotos from './TPDFotos'

import {
  atualizarTPD,
  cadastrarTPD
} from '../../../services/tpdsService'

import {
  registerAudit
} from '../../../services/auditoriaService'

import '../../../ui/patrimonio/PatrimonioForm.css'

const initialForm = {
  patrimonio: '',
  numero_serie: '',
  marca: '',
  modelo: '',
  tipo_equipamento: 'SMARTPHONE',
  unidade: '',
  status_operacional: 'RESERVA',
  local_atual: '',
  equipe_vinculada: '',
  viatura_vinculada: '',
  observacoes: '',
  qr_code: '',
  foto_url: '',
  ativo: true
}

export default function TPDForm({
  user,
  tpdEditando,
  onCancel,
  onSaved
}) {
  const [form, setForm] =
    useState(initialForm)

  const [tpdSalvo, setTPDSalvo] =
    useState(null)

  const [saving, setSaving] =
    useState(false)

  const [erro, setErro] =
    useState('')

  const [etapa, setEtapa] =
    useState('dados')

  const isEditing =
    Boolean(tpdEditando?.id)

  const tpdAtual =
    tpdSalvo || tpdEditando

  useEffect(() => {
    if (tpdEditando) {
      setForm({
        patrimonio:
          tpdEditando.patrimonio || '',

        numero_serie:
          tpdEditando.numero_serie || '',

        marca:
          tpdEditando.marca || '',

        modelo:
          tpdEditando.modelo || '',

        tipo_equipamento:
          tpdEditando.tipo_equipamento ||
          'SMARTPHONE',

        unidade:
          tpdEditando.unidade || '',

        status_operacional:
          tpdEditando.status_operacional ||
          'RESERVA',

        local_atual:
          tpdEditando.local_atual || '',

        equipe_vinculada:
          tpdEditando.equipe_vinculada ||
          '',

        viatura_vinculada:
          tpdEditando.viatura_vinculada ||
          '',

        observacoes:
          tpdEditando.observacoes || '',

        qr_code:
          tpdEditando.qr_code || '',

        foto_url:
          tpdEditando.foto_url || '',

        ativo:
          tpdEditando.ativo !== false
      })

      setTPDSalvo(tpdEditando)
    } else {
      setForm(initialForm)
      setTPDSalvo(null)
    }

    setErro('')
    setEtapa('dados')
  }, [tpdEditando])

  function handleChange(event) {
    const {
      name,
      value,
      type,
      checked
    } = event.target

    if (name === 'ativo') {
      setForm((prev) => ({
        ...prev,
        ativo:
          type === 'checkbox'
            ? checked
            : value === 'true'
      }))

      return
    }

    if (
      name === 'tipo_equipamento' ||
      name === 'status_operacional'
    ) {
      setForm((prev) => ({
        ...prev,
        [name]: String(value || '')
          .trim()
          .toUpperCase()
      }))

      return
    }

    setForm((prev) => ({
      ...prev,
      [name]: String(value || '')
        .toUpperCase()
    }))
  }

  function validarFormulario() {
  const numeroSerie =
    String(
      form.numero_serie || ''
    ).trim()

  if (!numeroSerie) {
    throw new Error(
      'Informe o número de série do TPD.'
    )
  }

  if (!form.marca?.trim()) {
    throw new Error(
      'Informe a marca do TPD.'
    )
  }

  if (!form.modelo?.trim()) {
    throw new Error(
      'Informe o modelo do TPD.'
    )
  }

  if (!form.tipo_equipamento) {
    throw new Error(
      'Informe o tipo do equipamento.'
    )
  }

  if (!form.unidade) {
    throw new Error(
      'Informe a unidade do TPD.'
    )
  }

  if (!form.status_operacional) {
    throw new Error(
      'Informe o status operacional.'
    )
  }

  if (
    form.status_operacional ===
      'EM_SERVICO' &&
    !form.equipe_vinculada?.trim() &&
    !form.viatura_vinculada?.trim()
  ) {
    throw new Error(
      'Para colocar o TPD em serviço, informe a equipe ou a viatura vinculada.'
    )
  }
}

  function montarPayload() {
    const status =
      String(
        form.status_operacional ||
        'RESERVA'
      )
        .trim()
        .toUpperCase()

    const emServico =
      status === 'EM_SERVICO'

    return {
      patrimonio:
        String(
          form.patrimonio || ''
        )
          .trim()
          .toUpperCase(),

      numero_serie:
        String(
          form.numero_serie || ''
        )
          .trim()
          .toUpperCase(),

      marca:
        String(
          form.marca || ''
        )
          .trim()
          .toUpperCase(),

      modelo:
        String(
          form.modelo || ''
        )
          .trim()
          .toUpperCase(),

      tipo_equipamento:
        String(
          form.tipo_equipamento ||
          'SMARTPHONE'
        )
          .trim()
          .toUpperCase(),

      unidade:
        String(
          form.unidade || ''
        )
          .trim()
          .toUpperCase(),

      status_operacional: status,

      local_atual:
        String(
          form.local_atual || ''
        )
          .trim()
          .toUpperCase() ||
        null,

      equipe_vinculada:
        emServico
          ? String(
              form.equipe_vinculada ||
              ''
            )
              .trim()
              .toUpperCase() ||
            null
          : null,

      viatura_vinculada:
        emServico
          ? String(
              form.viatura_vinculada ||
              ''
            )
              .trim()
              .toUpperCase() ||
            null
          : null,

      observacoes:
        String(
          form.observacoes || ''
        )
          .trim()
          .toUpperCase() ||
        null,

      qr_code:
  String(form.qr_code || '').trim() ||
  `SIGMO:TPD:${String(
    form.numero_serie || ''
  )
    .trim()
    .toUpperCase()}`,

      foto_url:
        String(
          form.foto_url || ''
        ).trim() || null,

      ativo:
        form.ativo !== false
    }
  }

  async function handleSalvarDados(event) {
    event?.preventDefault()

    setSaving(true)
    setErro('')

    try {
      validarFormulario()

      const payload =
        montarPayload()

      let data

      if (
        isEditing ||
        tpdSalvo?.id
      ) {
        data = await atualizarTPD(
          tpdAtual.id,
          payload,
          user
        )

        await registerAudit({
          user,
          action: 'ATUALIZAR_TPD',
          tableName: 'sigmo_tpds',
          recordId: tpdAtual.id,

          description:
            `Atualizou TPD ${
              payload.patrimonio ||
              payload.numero_serie
            }`
        })
      } else {
        data = await cadastrarTPD(
          payload,
          user
        )

        await registerAudit({
          user,
          action: 'CADASTRAR_TPD',
          tableName: 'sigmo_tpds',
          recordId: data?.id,

          description:
            `Cadastrou TPD ${
              payload.patrimonio ||
              payload.numero_serie
            }`
        })
      }

      const salvo =
        data || {
          ...tpdAtual,
          ...payload
        }

      setTPDSalvo(salvo)

      setForm((prev) => ({
        ...prev,
        foto_url:
          salvo?.foto_url ||
          prev.foto_url
      }))

      setEtapa('fotos')
    } catch (error) {
      console.error(error)

      setErro(
        error.message ||
        'Erro ao salvar o TPD.'
      )
    } finally {
      setSaving(false)
    }
  }

  function handleFotoPrincipalAlterada(
    fotoUrl
  ) {
    setForm((prev) => ({
      ...prev,
      foto_url: fotoUrl || ''
    }))

    setTPDSalvo((prev) => {
      if (!prev) return prev

      return {
        ...prev,
        foto_url: fotoUrl || null
      }
    })
  }

  function handleFinalizar() {
    onSaved?.()
  }

  return (
    <SigmoCard className="patrimonio-form-card">
      <form onSubmit={handleSalvarDados}>
        <div className="patrimonio-form-header">
          <div>
            <h2>
              {isEditing
                ? 'Editar TPD'
                : 'Novo TPD'}
            </h2>

            <p>
              {etapa === 'dados'
                ? 'Preencha os dados principais do Terminal Portátil de Dados.'
                : 'Adicione fotos, confira os dados e finalize o cadastro.'}
            </p>
          </div>

          <div className="patrimonio-form-steps">
            <span
              className={
                etapa === 'dados'
                  ? 'active'
                  : ''
              }
            >
              1 Dados
            </span>

            <span
              className={
                etapa === 'fotos'
                  ? 'active'
                  : ''
              }
            >
              2 Fotos
            </span>
          </div>
        </div>

        {erro && (
          <div className="patrimonio-form-error">
            {erro}
          </div>
        )}

        {etapa === 'dados' && (
          <>
            <TPDDados
              form={form}
              onChange={handleChange}
              disabled={saving}
            />

            <div className="patrimonio-form-actions">
              <SigmoButton
                type="button"
                variant="secondary"
                onClick={onCancel}
                disabled={saving}
              >
                Cancelar
              </SigmoButton>

              <SigmoButton
                type="submit"
                disabled={saving}
              >
                {saving
                  ? 'Salvando...'
                  : 'Seguinte'}
              </SigmoButton>
            </div>
          </>
        )}

        {etapa === 'fotos' && (
          <>
            <TPDFotos
              user={user}
              tpdId={tpdAtual?.id}
              fotoPrincipalAtual={
                form.foto_url
              }
              onFotoPrincipalAlterada={
                handleFotoPrincipalAlterada
              }
            />

            <div className="patrimonio-form-actions">
              <SigmoButton
                type="button"
                variant="secondary"
                onClick={() =>
                  setEtapa('dados')
                }
                disabled={saving}
              >
                Voltar aos dados
              </SigmoButton>

              <SigmoButton
                type="button"
                variant="success"
                onClick={handleFinalizar}
                disabled={saving}
              >
                Finalizar
              </SigmoButton>
            </div>
          </>
        )}
      </form>
    </SigmoCard>
  )
}