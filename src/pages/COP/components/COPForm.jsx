import {
  useEffect,
  useState
} from 'react'

import SigmoButton from '../../../ui/components/SigmoButton'
import SigmoCard from '../../../ui/components/SigmoCard'

import COPDados from './COPDados'
import COPFotos from './COPFotos'

import {
  atualizarCOP,
  cadastrarCOP
} from '../../../services/copsService'

import {
  registerAudit
} from '../../../services/auditoriaService'

import '../../../ui/patrimonio/PatrimonioForm.css'

const initialForm = {
  numero: '',
  identificacao_equipamento: '',
  marca: 'MOTOROLA',
  status_operacional: 'RESERVA',
  local_atual: 'SVDD',
  observacoes: '',
  foto_url: '',
  ativo: true
}

export default function COPForm({
  user,
  copEditando,
  onCancel,
  onSaved
}) {
  const [form, setForm] =
    useState(initialForm)

  const [copSalva, setCOPSalva] =
    useState(null)

  const [saving, setSaving] =
    useState(false)

  const [erro, setErro] =
    useState('')

  const [etapa, setEtapa] =
    useState('dados')

  const isEditing =
    Boolean(copEditando?.id)

  const copAtual =
    copSalva || copEditando

  useEffect(() => {
    if (copEditando) {
      setForm({
        numero:
          copEditando.numero || '',

        identificacao_equipamento:
          copEditando
            .identificacao_equipamento || '',

        marca:
          copEditando.marca ||
          'MOTOROLA',

        status_operacional:
          copEditando.status_operacional ||
          'RESERVA',

        local_atual:
          copEditando.local_atual ||
          'SVDD',

        observacoes:
          copEditando.observacoes || '',

        foto_url:
          copEditando.foto_url || '',

        ativo:
          copEditando.ativo !== false
      })

      setCOPSalva(copEditando)
    } else {
      setForm(initialForm)
      setCOPSalva(null)
    }

    setErro('')
    setEtapa('dados')
  }, [copEditando])

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

    if (name === 'numero') {
      setForm((prev) => ({
        ...prev,
        numero: String(value || '')
          .replace(/\D/g, '')
          .slice(0, 2)
      }))

      return
    }

    if (
      name === 'status_operacional' ||
      name === 'marca'
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
    const numero = String(
      form.numero || ''
    )
      .trim()
      .padStart(2, '0')

    if (!/^(0[1-9]|[1-9][0-9])$/.test(
      numero
    )) {
      throw new Error(
        'Informe um número de COP válido com dois dígitos.'
      )
    }

    if (!form.marca?.trim()) {
      throw new Error(
        'Informe a marca da COP.'
      )
    }

    if (!form.status_operacional) {
      throw new Error(
        'Informe o status operacional da COP.'
      )
    }
  }

  function montarPayload() {
    const numero = String(
      form.numero || ''
    )
      .trim()
      .padStart(2, '0')

    return {
      numero,

      identificacao_equipamento:
        String(
          form.identificacao_equipamento ||
          ''
        )
          .trim()
          .toUpperCase() || null,

      marca:
        String(
          form.marca || 'MOTOROLA'
        )
          .trim()
          .toUpperCase(),

      status_operacional:
        String(
          form.status_operacional ||
          'RESERVA'
        )
          .trim()
          .toUpperCase(),

      local_atual:
        String(
          form.local_atual || 'SVDD'
        )
          .trim()
          .toUpperCase() || 'SVDD',

      observacoes:
        String(
          form.observacoes || ''
        )
          .trim()
          .toUpperCase() || null,

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

      const payload = montarPayload()
      let data

      if (isEditing || copSalva?.id) {
        data = await atualizarCOP(
          copAtual.id,
          payload,
          user
        )

        await registerAudit({
          user,
          action: 'ATUALIZAR_COP',
          tableName: 'sigmo_cops',
          recordId: copAtual.id,
          description:
            `Atualizou COP nº ${payload.numero}`
        })
      } else {
        data = await cadastrarCOP(
          payload,
          user
        )

        await registerAudit({
          user,
          action: 'CADASTRAR_COP',
          tableName: 'sigmo_cops',
          recordId: data?.id,
          description:
            `Cadastrou COP nº ${payload.numero}`
        })
      }

      const salva = data || {
        ...copAtual,
        ...payload
      }

      setCOPSalva(salva)

      setForm((prev) => ({
        ...prev,
        numero: salva.numero || prev.numero,
        foto_url:
          salva.foto_url ||
          prev.foto_url
      }))

      setEtapa('fotos')
    } catch (error) {
      console.error(error)

      setErro(
        error.message ||
        'Erro ao salvar a COP.'
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

    setCOPSalva((prev) => {
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
                ? 'Editar COP'
                : 'Nova COP'}
            </h2>

            <p>
              {etapa === 'dados'
                ? 'Preencha os dados básicos da Câmera Operacional Portátil.'
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
            <COPDados
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
            <COPFotos
              user={user}
              copId={copAtual?.id}
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
