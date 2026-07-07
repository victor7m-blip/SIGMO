import { useEffect, useState } from 'react'
import SigmoButton from '../../../ui/components/SigmoButton'
import SigmoCard from '../../../ui/components/SigmoCard'
import ArmaDados from './ArmaDados'
import ArmaFotos from './ArmaFotos'
import { cadastrarArma, atualizarArma } from '../../../services/armasService'
import { registerAudit } from '../../../services/auditoriaService'
import './ArmaForm.css'

const initialForm = {
  patrimonio: '',
  numero_serie: '',
  especie: '',
  marca: '',
  modelo: '',
  calibre: '',
  acabamento: '',
  unidade: '',
  status: 'Disponível',
  observacoes: ''
}

export default function ArmaForm({ user, armaEditando, onCancel, onSaved }) {
  const [form, setForm] = useState(initialForm)
  const [armaSalva, setArmaSalva] = useState(null)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [etapa, setEtapa] = useState('dados')

  const isEditing = Boolean(armaEditando?.id)
  const armaAtual = armaSalva || armaEditando

  useEffect(() => {
    if (armaEditando) {
      setForm({
        patrimonio: armaEditando.patrimonio || '',
        numero_serie: armaEditando.numero_serie || '',
        especie: armaEditando.especie || '',
        marca: armaEditando.marca || '',
        modelo: armaEditando.modelo || '',
        calibre: armaEditando.calibre || '',
        acabamento: armaEditando.acabamento || '',
        unidade: armaEditando.unidade || '',
        status: armaEditando.status || 'Disponível',
        observacoes: armaEditando.observacoes || ''
      })

      setArmaSalva(armaEditando)
    } else {
      setForm(initialForm)
      setArmaSalva(null)
    }

    setErro('')
    setEtapa('dados')
  }, [armaEditando])

  function handleChange(e) {
    const { name, value } = e.target

    setForm((prev) => ({
      ...prev,
      [name]: value.toUpperCase()
    }))
  }

  async function handleSalvarDados(e) {
    e?.preventDefault()
    setSaving(true)
    setErro('')

    try {
      let data

      if (isEditing || armaSalva?.id) {
        data = await atualizarArma(armaAtual.id, form, user)

        await registerAudit({
          user,
          action: 'ATUALIZAR_ARMA',
          tableName: 'armas',
          recordId: armaAtual.id,
          description: `Atualizou arma ${form.patrimonio || form.numero_serie}`
        })
      } else {
        data = await cadastrarArma(form, user)

        await registerAudit({
          user,
          action: 'CADASTRAR_ARMA',
          tableName: 'armas',
          recordId: data?.id,
          description: `Cadastrou arma ${form.patrimonio || form.numero_serie}`
        })
      }

      const salva = data || armaAtual
      setArmaSalva(salva)
      setEtapa('fotos')
    } catch (error) {
      console.error(error)
      setErro(error.message || 'Erro ao salvar arma.')
    } finally {
      setSaving(false)
    }
  }

  function handleFinalizar() {
    onSaved?.()
  }

  return (
    <SigmoCard className="arma-form-card">
      <form onSubmit={handleSalvarDados}>
        <div className="arma-form-header">
          <div>
            <h2>{isEditing ? 'Editar arma' : 'Nova arma'}</h2>
            <p>
              {etapa === 'dados'
                ? 'Preencha os dados principais da arma.'
                : 'Adicione fotos, confira os dados e finalize o cadastro.'}
            </p>
          </div>

          <div className="arma-form-steps">
            <span className={etapa === 'dados' ? 'active' : ''}>1 Dados</span>
            <span className={etapa === 'fotos' ? 'active' : ''}>2 Fotos</span>
          </div>
        </div>

        {erro && <div className="arma-form-error">{erro}</div>}

        {etapa === 'dados' && (
          <>
            <ArmaDados
              form={form}
              onChange={handleChange}
              disabled={saving}
            />

            <div className="arma-form-actions">
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
                {saving ? 'Salvando...' : 'Seguinte'}
              </SigmoButton>
            </div>
          </>
        )}

        {etapa === 'fotos' && (
          <>
            <ArmaFotos
              user={user}
              armaId={armaAtual?.id}
            />

            <div className="arma-form-actions">
              <SigmoButton
                type="button"
                variant="secondary"
                onClick={() => setEtapa('dados')}
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