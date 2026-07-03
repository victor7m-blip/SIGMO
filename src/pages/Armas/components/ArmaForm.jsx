import { useEffect, useState } from 'react'
import { cadastrarArma, atualizarArma } from '../../../services/armasService'
import {
  uploadFotoArma,
  listarFotosArma,
  excluirFotoArma
} from '../../../services/armasFotosService'
import { registerAudit } from '../../../services/auditoriaService'

const MAX_FOTOS = 5

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
  observacoes: '',
}

export default function ArmaForm({ user, armaEditando, onCancel, onSaved }) {
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [fotosSelecionadas, setFotosSelecionadas] = useState([])
  const [fotosExistentes, setFotosExistentes] = useState([])
  const [loadingFotos, setLoadingFotos] = useState(false)

  const isEditing = Boolean(armaEditando?.id)

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
        observacoes: armaEditando.observacoes || '',
      })

      carregarFotosExistentes(armaEditando.id)
    } else {
      setForm(initialForm)
      setFotosExistentes([])
    }

    setFotosSelecionadas([])
    setErro('')
  }, [armaEditando])

  async function carregarFotosExistentes(armaId) {
    try {
      setLoadingFotos(true)
      const fotos = await listarFotosArma(armaId)
      setFotosExistentes(fotos || [])
    } catch (error) {
      console.error(error)
      setErro('Erro ao carregar fotos da arma.')
    } finally {
      setLoadingFotos(false)
    }
  }

  function handleChange(event) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function handleSelecionarFotos(event) {
    const arquivos = Array.from(event.target.files || [])
    const totalFotos = fotosExistentes.length + arquivos.length

    if (totalFotos > MAX_FOTOS) {
      setErro(`A arma pode ter no máximo ${MAX_FOTOS} fotos.`)
      event.target.value = ''
      return
    }

    setErro('')
    setFotosSelecionadas(arquivos)
  }

  async function handleExcluirFoto(foto) {
    const confirmar = window.confirm('Deseja excluir esta foto?')
    if (!confirmar) return

    try {
      setSaving(true)
      setErro('')

      await excluirFotoArma(foto.id, foto.caminho)

      setFotosExistentes((prev) =>
        prev.filter((item) => item.id !== foto.id)
      )

      await registerAudit(
        'ARMA_FOTO_DELETE',
        `Foto removida da arma: ${armaEditando?.patrimonio || '-'}`,
        user,
        'Armas',
        'Informativo'
      )
    } catch (error) {
      console.error(error)
      setErro('Erro ao excluir foto.')
    } finally {
      setSaving(false)
    }
  }

  async function enviarFotosNovas(armaId) {
    for (const foto of fotosSelecionadas) {
      await uploadFotoArma(foto, armaId, user)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    try {
      setSaving(true)
      setErro('')

      let arma

      if (isEditing) {
        arma = await atualizarArma(armaEditando.id, form)

        if (fotosSelecionadas.length > 0) {
          await enviarFotosNovas(armaEditando.id)
        }

        await registerAudit(
          'ARMA_UPDATE',
          `Arma editada: ${arma.patrimonio} - ${arma.marca} ${arma.modelo}`,
          user,
          'Armas',
          'Informativo'
        )
      } else {
        arma = await cadastrarArma(form)

        if (fotosSelecionadas.length > 0) {
          await enviarFotosNovas(arma.id)
        }

        await registerAudit(
          'ARMA_CREATE',
          `Arma cadastrada: ${arma.patrimonio} - ${arma.marca} ${arma.modelo}`,
          user,
          'Armas',
          'Informativo'
        )
      }

      setForm(initialForm)
      setFotosSelecionadas([])
      setFotosExistentes([])
      onSaved()
    } catch (error) {
      console.error(error)
      setErro(
        isEditing
          ? 'Erro ao editar arma.'
          : 'Erro ao cadastrar arma. Verifique patrimônio, série e fotos.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="armas-form-card">
      <div className="armas-form-header">
        <div>
          <h2>{isEditing ? 'Editar Arma' : 'Nova Arma'}</h2>
          <p>
            {isEditing
              ? 'Atualize os dados, fotos e informações do armamento.'
              : 'Cadastre o armamento institucional.'}
          </p>
        </div>

        <button type="button" onClick={onCancel}>
          Fechar
        </button>
      </div>

      {erro && <p className="armas-feedback armas-feedback-error">{erro}</p>}

      <form className="armas-form" onSubmit={handleSubmit}>
        <input name="patrimonio" placeholder="Patrimônio" value={form.patrimonio} onChange={handleChange} required />
        <input name="numero_serie" placeholder="Número de série" value={form.numero_serie} onChange={handleChange} required />
        <input name="especie" placeholder="Espécie" value={form.especie} onChange={handleChange} required />
        <input name="marca" placeholder="Marca" value={form.marca} onChange={handleChange} required />
        <input name="modelo" placeholder="Modelo" value={form.modelo} onChange={handleChange} required />
        <input name="calibre" placeholder="Calibre" value={form.calibre} onChange={handleChange} required />
        <input name="acabamento" placeholder="Acabamento" value={form.acabamento} onChange={handleChange} />
        <input name="unidade" placeholder="Unidade atual" value={form.unidade} onChange={handleChange} />

        <select name="status" value={form.status} onChange={handleChange}>
          <option>Disponível</option>
          <option>Em uso</option>
          <option>Reserva</option>
          <option>Manutenção</option>
          <option>Extraviada</option>
          <option>Baixada</option>
        </select>

        <textarea name="observacoes" placeholder="Observações" value={form.observacoes} onChange={handleChange} />

        <div className="form-group">
          <label>Fotos da arma</label>

          {isEditing && loadingFotos && (
            <small>Carregando fotos cadastradas...</small>
          )}

          {isEditing && !loadingFotos && fotosExistentes.length > 0 && (
            <div className="fotos-existentes">
              {fotosExistentes.map((foto) => (
                <div key={foto.id} className="foto-existente-card">
                  <img src={foto.url} alt="Foto da arma" />

                  <button
                    type="button"
                    onClick={() => handleExcluirFoto(foto)}
                    disabled={saving}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}

          {isEditing && !loadingFotos && fotosExistentes.length === 0 && (
            <small>Nenhuma foto cadastrada ainda.</small>
          )}

          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleSelecionarFotos}
          />

          <small>
            Até {MAX_FOTOS} fotos no total. Novas fotos serão enviadas ao salvar.
          </small>

          {fotosSelecionadas.length > 0 && (
            <div className="fotos-selecionadas">
              {fotosSelecionadas.map((foto, index) => (
                <span key={`${foto.name}-${index}`}>{foto.name}</span>
              ))}
            </div>
          )}
        </div>

        <div className="armas-form-actions">
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>

          <button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Salvar arma'}
          </button>
        </div>
      </form>
    </section>
  )
}
