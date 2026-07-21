import {
  useEffect,
  useState
} from 'react'

import SigmoButton from '../../../ui/components/SigmoButton'
import SigmoCard from '../../../ui/components/SigmoCard'

import TaserDados from './TaserDados'
import TaserFotos from './TaserFotos'

import {
  atualizarTaser,
  cadastrarTaser
} from '../../../services/tasersService'

import {
  registerAudit
} from '../../../services/auditoriaService'

import '../../../ui/patrimonio/PatrimonioForm.css'

const initialForm = {
  patrimonio: '',
  numero_serie: '',
  marca: '',
  modelo: '',
  tipo_taser: 'TASER 7',
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

export default function TaserForm({
  user,
  taserEditando,
  onCancel,
  onSaved
}) {
  const [form, setForm] =
    useState(initialForm)

  const [taserSalvo, setTaserSalvo] =
    useState(null)

  const [saving, setSaving] =
    useState(false)

  const [erro, setErro] =
    useState('')

  const [etapa, setEtapa] =
    useState('dados')

  const isEditing =
    Boolean(taserEditando?.id)

  const taserAtual =
    taserSalvo || taserEditando

  useEffect(() => {
    if (taserEditando) {
      setForm({
        patrimonio:
          taserEditando.patrimonio || '',

        numero_serie:
          taserEditando.numero_serie || '',

        marca:
          taserEditando.marca || '',

        modelo:
          taserEditando.modelo || '',

        tipo_taser:
          taserEditando.tipo_taser ||
          'TASER 7',

        unidade:
          taserEditando.unidade || '',

        status_operacional:
          taserEditando.status_operacional ||
          'RESERVA',

        local_atual:
          taserEditando.local_atual || '',

        equipe_vinculada:
          taserEditando.equipe_vinculada ||
          '',

        viatura_vinculada:
          taserEditando.viatura_vinculada ||
          '',

        observacoes:
          taserEditando.observacoes || '',

        qr_code:
          taserEditando.qr_code || '',

        foto_url:
          taserEditando.foto_url || '',

        ativo:
          taserEditando.ativo !== false
      })

      setTaserSalvo(taserEditando)
    } else {
      setForm(initialForm)
      setTaserSalvo(null)
    }

    setErro('')
    setEtapa('dados')
  }, [taserEditando])

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
      name === 'tipo_taser' ||
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
        'Informe o número de série do Taser.'
      )
    }

    if (!form.marca?.trim()) {
      throw new Error(
        'Informe a marca do Taser.'
      )
    }

    if (!form.modelo?.trim()) {
      throw new Error(
        'Informe o modelo do Taser.'
      )
    }

    if (!form.tipo_taser) {
      throw new Error(
        'Informe o tipo do Taser.'
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
        'Para colocar o Taser em serviço, informe a equipe ou a viatura vinculada.'
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

      tipo_taser:
        String(
          form.tipo_taser ||
          'TASER 7'
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
        `SIGMO:Taser:${String(
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
        taserSalvo?.id
      ) {
        data =
          await atualizarTaser(
            taserAtual.id,
            payload,
            user
          )

        await registerAudit({
          user,
          action: 'ATUALIZAR_TASER',
          tableName: 'sigmo_tasers',
          recordId: taserAtual.id,

          description:
            `Atualizou Taser ${
              payload.patrimonio ||
              payload.numero_serie
            }`
        })
      } else {
        data =
          await cadastrarTaser(
            payload,
            user
          )

        await registerAudit({
          user,
          action: 'CADASTRAR_TASER',
          tableName: 'sigmo_tasers',
          recordId: data?.id,

          description:
            `Cadastrou Taser ${
              payload.patrimonio ||
              payload.numero_serie
            }`
        })
      }

      const salvo =
        data || {
          ...taserAtual,
          ...payload
        }

      setTaserSalvo(salvo)

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
        'Erro ao salvar o Taser.'
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

    setTaserSalvo((prev) => {
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
                ? 'Editar Taser'
                : 'Novo Taser'}
            </h2>

            <p>
              {etapa === 'dados'
                ? 'Preencha os dados principais do Taser.'
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
            <TaserDados
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
            <TaserFotos
              user={user}
              taserId={taserAtual?.id}
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