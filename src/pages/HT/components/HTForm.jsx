import {
  useEffect,
  useState
} from 'react'

import SigmoButton from '../../../ui/components/SigmoButton'
import SigmoCard from '../../../ui/components/SigmoCard'

import HTDados from './HTDados'
import HTFotos from './HTFotos'

import {
  atualizarHT,
  cadastrarHT
} from '../../../services/htsService'

import {
  registerAudit
} from '../../../services/auditoriaService'

import '../../../ui/patrimonio/PatrimonioForm.css'

const initialForm = {
  patrimonio: '',
  numero_serie: '',
  marca: '',
  modelo: '',
  tipo_ht: 'PORTATIL',
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

export default function HTForm({
  user,
  htEditando,
  onCancel,
  onSaved
}) {
  const [form, setForm] =
    useState(initialForm)

  const [htSalvo, setHTSalvo] =
    useState(null)

  const [saving, setSaving] =
    useState(false)

  const [erro, setErro] =
    useState('')

  const [etapa, setEtapa] =
    useState('dados')

  const isEditing =
    Boolean(htEditando?.id)

  const htAtual =
    htSalvo || htEditando

  useEffect(() => {
    if (htEditando) {
      setForm({
        patrimonio:
          htEditando.patrimonio || '',

        numero_serie:
          htEditando.numero_serie || '',

        marca:
          htEditando.marca || '',

        modelo:
          htEditando.modelo || '',

        tipo_ht:
          htEditando.tipo_ht ||
          'PORTATIL',

        unidade:
          htEditando.unidade || '',

        status_operacional:
          htEditando.status_operacional ||
          'RESERVA',

        local_atual:
          htEditando.local_atual || '',

        equipe_vinculada:
          htEditando.equipe_vinculada ||
          '',

        viatura_vinculada:
          htEditando.viatura_vinculada ||
          '',

        observacoes:
          htEditando.observacoes || '',

        qr_code:
          htEditando.qr_code || '',

        foto_url:
          htEditando.foto_url || '',

        ativo:
          htEditando.ativo !== false
      })

      setHTSalvo(htEditando)
    } else {
      setForm(initialForm)
      setHTSalvo(null)
    }

    setErro('')
    setEtapa('dados')
  }, [htEditando])

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
      name === 'tipo_ht' ||
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
        'Informe o número de série do HT.'
      )
    }

    if (!form.marca?.trim()) {
      throw new Error(
        'Informe a marca do HT.'
      )
    }

    if (!form.modelo?.trim()) {
      throw new Error(
        'Informe o modelo do HT.'
      )
    }

    if (!form.tipo_ht) {
      throw new Error(
        'Informe o tipo do HT.'
      )
    }

    if (!form.unidade) {
      throw new Error(
        'Informe a unidade.'
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
        'Para colocar o HT em serviço, informe a equipe ou a viatura vinculada.'
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
        String(form.patrimonio || '')
          .trim()
          .toUpperCase(),

      numero_serie:
        String(form.numero_serie || '')
          .trim()
          .toUpperCase(),

      marca:
        String(form.marca || '')
          .trim()
          .toUpperCase(),

      modelo:
        String(form.modelo || '')
          .trim()
          .toUpperCase(),

      tipo_ht:
        String(
          form.tipo_ht ||
          'PORTATIL'
        )
          .trim()
          .toUpperCase(),

      unidade:
        String(form.unidade || '')
          .trim()
          .toUpperCase(),

      status_operacional:
        status,

      local_atual:
        String(form.local_atual || '')
          .trim()
          .toUpperCase() ||
        null,

      equipe_vinculada:
        emServico
          ? String(form.equipe_vinculada || '')
              .trim()
              .toUpperCase() || null
          : null,

      viatura_vinculada:
        emServico
          ? String(form.viatura_vinculada || '')
              .trim()
              .toUpperCase() || null
          : null,

      observacoes:
        String(form.observacoes || '')
          .trim()
          .toUpperCase() ||
        null,

      qr_code:
        String(form.qr_code || '').trim() ||
        `SIGMO:HT:${String(
          form.numero_serie || ''
        )
          .trim()
          .toUpperCase()}`,

      foto_url:
        String(form.foto_url || '')
          .trim() || null,

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
        htSalvo?.id
      ) {
        data =
          await atualizarHT(
            htAtual.id,
            payload,
            user
          )

        await registerAudit({
          user,
          action: 'ATUALIZAR_HT',
          tableName: 'sigmo_hts',
          recordId: htAtual.id,

          description:
            `Atualizou HT ${
              payload.patrimonio ||
              payload.numero_serie
            }`
        })
      } else {
        data =
          await cadastrarHT(
            payload,
            user
          )

        await registerAudit({
          user,
          action: 'CADASTRAR_HT',
          tableName: 'sigmo_hts',
          recordId: data?.id,

          description:
            `Cadastrou HT ${
              payload.patrimonio ||
              payload.numero_serie
            }`
        })
      }

      const salvo =
        data || {
          ...htAtual,
          ...payload
        }

      setHTSalvo(salvo)

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
        'Erro ao salvar o HT.'
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

    setHTSalvo((prev) => {
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
                ? 'Editar HT'
                : 'Novo HT'}
            </h2>

            <p>
              {etapa === 'dados'
                ? 'Preencha os dados principais do HT.'
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
            <HTDados
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
            <HTFotos
              user={user}
              htId={htAtual?.id}
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