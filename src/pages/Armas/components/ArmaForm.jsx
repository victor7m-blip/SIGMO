import { useEffect, useState } from 'react'

import CadastroPatrimonioWizard from '../../../components/CadastroPatrimonioWizard/CadastroPatrimonioWizard'
import ArmaDados from './ArmaDados'
import ArmaFotos from './ArmaFotos'

import { cadastrarArma, atualizarArma } from '../../../services/armasService'
import {
  uploadFotoArma,
  listarFotosArma,
  excluirFotoArma
} from '../../../services/armasFotosService'
import { registerAudit } from '../../../services/auditoriaService'

const initialForm = {
  patrimonio: '',
  numero_serie: '',
  especie: '',
  marca: '',
  modelo: '',
  calibre: '',
  acabamento: '',
  unidade: '',
  local_atual: 'COFRE DA RESERVA',
  local_atual_id: null,
  responsavel_atual: '',
  responsavel_atual_id: null,
  status_operacional: 'RESERVA',
  observacoes: '',
  qr_code: ''
}

function normalizarStatusOperacional(status) {
  if (!status) return 'RESERVA'

  const valor = String(status).trim().toUpperCase()

  if (valor === 'DISPONÍVEL' || valor === 'DISPONIVEL') {
    return 'RESERVA'
  }

  return valor
}

export default function ArmaForm({ user, armaEditando, onCancel, onSaved }) {
  const [form, setForm] = useState(initialForm)
  const [armaSalva, setArmaSalva] = useState(null)
  const [fotos, setFotos] = useState([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [erro, setErro] = useState('')

  const isEditing = Boolean(armaEditando?.id)

  useEffect(() => {
    if (armaEditando?.id) {
      setForm({
        patrimonio: armaEditando.patrimonio || '',
        numero_serie: armaEditando.numero_serie || '',
        especie: armaEditando.especie || '',
        marca: armaEditando.marca || '',
        modelo: armaEditando.modelo || '',
        calibre: armaEditando.calibre || '',
        acabamento: armaEditando.acabamento || '',
        unidade: armaEditando.unidade || '',
        local_atual: armaEditando.local_atual || 'COFRE DA RESERVA',
        local_atual_id: armaEditando.local_atual_id || null,
        responsavel_atual: armaEditando.responsavel_atual || '',
        responsavel_atual_id: armaEditando.responsavel_atual_id || null,
        status_operacional: normalizarStatusOperacional(
          armaEditando.status_operacional || armaEditando.status
        ),
        observacoes: armaEditando.observacoes || '',
        qr_code: armaEditando.qr_code || ''
      })

      setArmaSalva(armaEditando)
      carregarFotos(armaEditando.id)
      return
    }

    setForm(initialForm)
    setArmaSalva(null)
    setFotos([])
    setErro('')
  }, [armaEditando])

  function handleChange(e) {
    const { name, value } = e.target

    setForm((prev) => ({
      ...prev,
      [name]: value.toUpperCase()
    }))
  }

  function gerarQrCodeAutomatico() {
    const base = form.patrimonio || form.numero_serie || Date.now()
    return `SIGMO-ARMA-${base}`.toUpperCase()
  }

  async function carregarFotos(armaId) {
    if (!armaId) return

    try {
      const lista = await listarFotosArma(armaId)
      setFotos(lista || [])
    } catch (error) {
      console.error(error)
    }
  }

  async function handleSalvarDados() {
    if (saving) return null

    setErro('')
    setSaving(true)

    try {
      const payload = {
  patrimonio: form.patrimonio.trim(),
  numero_serie: form.numero_serie.trim(),
  especie: form.especie.trim(),
  marca: form.marca.trim(),
  modelo: form.modelo.trim(),
  calibre: form.calibre.trim(),
  acabamento: form.acabamento.trim(),
  unidade: form.unidade.trim(),
  local_atual: form.local_atual.trim(),
  status: normalizarStatusOperacional(form.status_operacional),
  observacoes: form.observacoes.trim(),
  qr_code: form.qr_code?.trim() || gerarQrCodeAutomatico()
}

      let arma

      if (isEditing) {
        arma = await atualizarArma(armaEditando.id, payload, user)

        await registerAudit({
          user,
          action: 'ATUALIZAR',
          table_name: 'armas',
          record_id: armaEditando.id,
          description: `Arma atualizada: ${payload.patrimonio || payload.numero_serie}`
        })
      } else {
        arma = await cadastrarArma(payload, user)

        await registerAudit({
          user,
          action: 'CADASTRAR',
          table_name: 'armas',
          record_id: arma?.id,
          description: `Arma cadastrada: ${payload.patrimonio || payload.numero_serie}`
        })
      }

      setArmaSalva(arma)
      await carregarFotos(arma.id)

      return arma
    } catch (error) {
      console.error(error)
      setErro(error.message || 'Erro ao salvar arma.')
      return null
    } finally {
      setSaving(false)
    }
  }

  async function handleUploadFoto(file) {
    const armaAtual = armaSalva || armaEditando

    if (!file || !armaAtual?.id) return

    setUploading(true)
    setErro('')

    try {
      await uploadFotoArma(file, armaAtual.id, user)
      await carregarFotos(armaAtual.id)
    } catch (error) {
      console.error(error)
      setErro(error.message || 'Erro ao enviar foto.')
    } finally {
      setUploading(false)
    }
  }

  async function handleExcluirFoto(foto) {
    const armaAtual = armaSalva || armaEditando

    if (!foto || !armaAtual?.id) return

    const confirmar = window.confirm('Deseja excluir esta foto?')
    if (!confirmar) return

    try {
      await excluirFotoArma(foto)
      await carregarFotos(armaAtual.id)
    } catch (error) {
      console.error(error)
      setErro(error.message || 'Erro ao excluir foto.')
    }
  }

  function handleConcluir() {
    if (onSaved) onSaved()
  }

  const etapaDados = (
    <ArmaDados
      form={form}
      erro={erro}
      onChange={handleChange}
      onCancel={onCancel}
    />
  )

  function renderEtapaFotos(armaWizard) {
    const armaAtual = armaWizard || armaSalva

    return (
      <div>
        {erro && <div className="form-error">{erro}</div>}

        {armaAtual?.id && (
          <div className="form-info">
            Arma salva com sucesso. Agora você pode adicionar as fotos.
          </div>
        )}

        {armaAtual?.qr_code && (
          <div className="form-info">
            <strong>QR Code:</strong> {armaAtual.qr_code}
          </div>
        )}

        <ArmaFotos
          arma={armaAtual}
          fotos={fotos}
          uploading={uploading}
          onUpload={handleUploadFoto}
          onExcluir={handleExcluirFoto}
          disabled={!armaAtual?.id}
        />
      </div>
    )
  }

  return (
    <CadastroPatrimonioWizard
      titulo={isEditing ? 'Editar Arma' : 'Cadastrar Arma'}
      etapaDados={etapaDados}
      etapaFotos={renderEtapaFotos}
      onSalvarDados={handleSalvarDados}
      onConcluir={handleConcluir}
      salvando={saving}
    />
  )
}