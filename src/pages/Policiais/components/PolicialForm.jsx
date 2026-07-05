import { useEffect, useMemo, useState } from 'react'

import { cadastrarPolicial, atualizarPolicial } from '../../../services/policiaisService'
import {
  uploadFotoPolicial,
  listarFotosPolicial,
  excluirFotoPolicial
} from '../../../services/policiaisFotosService'
import { registerAudit } from '../../../services/auditoriaService'

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

const situacoes = ['ATIVO', 'AFASTADO', 'FÉRIAS', 'LICENÇA', 'INATIVO']

function upper(value) {
  return String(value || '').toUpperCase()
}

function clean(value) {
  return String(value || '').trim()
}

function maskRE(value) {
  const raw = String(value || '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')

  const numeros = raw.replace(/[^0-9]/g, '').slice(0, 6)
  const digito = raw.slice(6).replace(/[^0-9A-Z]/g, '').slice(0, 1)

  if (numeros.length === 6 && !digito) return `${numeros}-`
  if (numeros.length === 6 && digito) return `${numeros}-${digito}`

  return numeros
}

function gerarTextoQrCode(form) {
  return JSON.stringify({
    modulo: 'POLICIAIS',
    nome: form.nome,
    nome_guerra: form.nome_guerra,
    re: form.re,
    posto_graduacao: form.posto_graduacao,
    companhia: form.companhia,
    pelotao: form.pelotao,
    equipe: form.equipe,
    situacao: form.situacao
  })
}

function montarPayload(form) {
  const payload = {
    nome: upper(form.nome).trim(),
    nome_guerra: upper(form.nome_guerra).trim(),
    re: maskRE(form.re),
    posto_graduacao: upper(form.posto_graduacao).trim(),
    companhia: upper(form.companhia).trim(),
    pelotao: upper(form.pelotao).trim(),
    equipe: upper(form.equipe).trim(),
    funcao: upper(form.funcao).trim(),
    telefone: upper(form.telefone).trim(),
    email: clean(form.email),
    cpf: upper(form.cpf).trim(),
    rg: upper(form.rg).trim(),
    perfil: upper(form.perfil).trim(),
    situacao: upper(form.situacao || 'ATIVO'),
    observacoes: upper(form.observacoes).trim(),
    foto_url: clean(form.foto_url),
    qr_code: clean(form.qr_code)
  }

  if (!payload.qr_code) {
    payload.qr_code = gerarTextoQrCode(payload)
  }

  return payload
}

export default function PolicialForm({
  user,
  policialEditando,
  onCancel,
  onSaved
}) {
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [fotos, setFotos] = useState([])
  const [uploadingFoto, setUploadingFoto] = useState(false)

  const isEditing = Boolean(policialEditando?.id)
 console.log('POLICIAL EDITANDO:', policialEditando)
  const policialId = useMemo(() => policialEditando?.id || null, [policialEditando])

  useEffect(() => {
    if (policialEditando) {
      setForm({
        nome: upper(policialEditando.nome),
        nome_guerra: upper(policialEditando.nome_guerra),
        re: maskRE(policialEditando.re),
        posto_graduacao: upper(policialEditando.posto_graduacao),
        companhia: upper(policialEditando.companhia),
        pelotao: upper(policialEditando.pelotao),
        equipe: upper(policialEditando.equipe),
        funcao: upper(policialEditando.funcao),
        telefone: upper(policialEditando.telefone),
        email: policialEditando.email || '',
        cpf: upper(policialEditando.cpf),
        rg: upper(policialEditando.rg),
        perfil: upper(policialEditando.perfil),
        situacao: upper(policialEditando.situacao || 'ATIVO'),
        observacoes: upper(policialEditando.observacoes),
        foto_url: policialEditando.foto_url || '',
        qr_code: policialEditando.qr_code || ''
      })
    } else {
      setForm(initialForm)
      setFotos([])
    }
  }, [policialEditando])

  useEffect(() => {
    async function carregarFotos() {
      if (!policialId) return

      try {
        const lista = await listarFotosPolicial(policialId)
        setFotos(lista || [])
      } catch (error) {
        console.error(error)
      }
    }

    carregarFotos()
  }, [policialId])

  function handleChange(e) {
    const { name, value } = e.target

    if (name === 're') {
      setForm((prev) => ({ ...prev, re: maskRE(value) }))
      return
    }

    if (name === 'email') {
      setForm((prev) => ({ ...prev, email: value }))
      return
    }

    setForm((prev) => ({
      ...prev,
      [name]: upper(value)
    }))
  }

  function gerarQrCode() {
    setForm((prev) => ({
      ...prev,
      qr_code: gerarTextoQrCode(montarPayload(prev))
    }))
  }

  async function registrarAuditoriaSegura(dados) {
    try {
      await registerAudit(dados)
    } catch (error) {
      console.error('Erro ao registrar auditoria:', error)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setErro('')

    try {
      const payload = montarPayload(form)

      if (!payload.nome) {
        throw new Error('Informe o nome do policial.')
      }

      if (!payload.nome_guerra) {
        throw new Error('Informe o nome de guerra.')
      }

      if (!/^\d{6}-[0-9A-Z]$/.test(payload.re)) {
        throw new Error('Informe o RE no padrão 123456-A ou 123456-7.')
      }

      if (isEditing) {
        await atualizarPolicial(policialEditando.id, payload)

        await registrarAuditoriaSegura({
          acao: 'ATUALIZAR',
          descricao: `Policial atualizado: ${payload.nome_guerra} - RE ${payload.re}`,
          ator_id: user?.id,
          ator_nome: user?.nome,
          perfil: user?.perfil,
          modulo: 'POLICIAIS',
          severidade: 'INFO'
        })
      } else {
        await cadastrarPolicial(payload)

        await registrarAuditoriaSegura({
          acao: 'CADASTRAR',
          descricao: `Policial cadastrado: ${payload.nome_guerra} - RE ${payload.re}`,
          ator_id: user?.id,
          ator_nome: user?.nome,
          perfil: user?.perfil,
          modulo: 'POLICIAIS',
          severidade: 'INFO'
        })
      }

      setForm(initialForm)
      onSaved?.()
    } catch (error) {
      console.error('Erro ao salvar policial:', error)
      setErro(error.message || error.details || 'Erro ao salvar policial.')
    } finally {
      setSaving(false)
    }
  }

  async function handleUploadFoto(e) {
    const file = e.target.files?.[0]
    if (!file || !policialId) return

    setUploadingFoto(true)
    setErro('')

    try {
      const url = await uploadFotoPolicial(file, policialId, user)

      const lista = await listarFotosPolicial(policialId)
      setFotos(lista || [])

      setForm((prev) => ({
        ...prev,
        foto_url: prev.foto_url || url
      }))

      await atualizarPolicial(policialId, {
        ...montarPayload(form),
        foto_url: form.foto_url || url
      })

      await registrarAuditoriaSegura({
        acao: 'UPLOAD_FOTO',
        descricao: `Foto adicionada ao policial: ${form.nome_guerra || form.nome} - RE ${form.re}`,
        ator_id: user?.id,
        ator_nome: user?.nome,
        perfil: user?.perfil,
        modulo: 'POLICIAIS',
        severidade: 'INFO'
      })
    } catch (error) {
      console.error('Erro ao enviar foto:', error)
      setErro(error.message || 'Erro ao enviar foto.')
    } finally {
      setUploadingFoto(false)
      e.target.value = ''
    }
  }

  async function handleExcluirFoto(foto) {
    if (!foto?.id) return

    try {
      await excluirFotoPolicial(foto)

      const lista = await listarFotosPolicial(policialId)
      setFotos(lista || [])

      await registrarAuditoriaSegura({
        acao: 'EXCLUIR_FOTO',
        descricao: `Foto removida do policial: ${form.nome_guerra || form.nome} - RE ${form.re}`,
        ator_id: user?.id,
        ator_nome: user?.nome,
        perfil: user?.perfil,
        modulo: 'POLICIAIS',
        severidade: 'ATENÇÃO'
      })
    } catch (error) {
      console.error('Erro ao excluir foto:', error)
      setErro(error.message || 'Erro ao excluir foto.')
    }
  }

  return (
    <form className="policial-form" onSubmit={handleSubmit}>
      <div className="form-header">
        <div>
          <h3>{isEditing ? 'Editar policial' : 'Cadastrar policial'}</h3>
          <p>Preencha os dados funcionais e administrativos do policial.</p>
        </div>

        <div className="form-actions-top">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancelar
          </button>

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {erro && <div className="form-error">{erro}</div>}

      <div className="form-grid">
        <label>
          Nome completo
          <input name="nome" value={form.nome} onChange={handleChange} required />
        </label>

        <label>
          Nome de guerra
          <input name="nome_guerra" value={form.nome_guerra} onChange={handleChange} required />
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
          <select name="posto_graduacao" value={form.posto_graduacao} onChange={handleChange}>
            <option value="">SELECIONE</option>
            {postosGraduacoes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          Companhia
          <input name="companhia" value={form.companhia} onChange={handleChange} />
        </label>

        <label>
          Pelotão
          <input name="pelotao" value={form.pelotao} onChange={handleChange} />
        </label>

        <label>
          Equipe
          <input name="equipe" value={form.equipe} onChange={handleChange} />
        </label>

        <label>
          Função
          <input name="funcao" value={form.funcao} onChange={handleChange} />
        </label>

        <label>
          Telefone
          <input name="telefone" value={form.telefone} onChange={handleChange} />
        </label>

        <label>
          E-mail
          <input name="email" type="email" value={form.email} onChange={handleChange} />
        </label>

        <label>
          CPF
          <input name="cpf" value={form.cpf} onChange={handleChange} />
        </label>

        <label>
          RG
          <input name="rg" value={form.rg} onChange={handleChange} />
        </label>

        <label>
          Perfil
          <input name="perfil" value={form.perfil} onChange={handleChange} />
        </label>

        <label>
          Situação
          <select name="situacao" value={form.situacao} onChange={handleChange}>
            {situacoes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
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
          <strong>QR Code</strong>
          <p>Gere o conteúdo do QR Code para identificação do policial.</p>
        </div>

        <button type="button" className="btn-secondary" onClick={gerarQrCode}>
          Gerar QR
        </button>
      </div>

      {form.qr_code && (
        <div className="qr-preview">
          <textarea value={form.qr_code} readOnly rows={4} />
        </div>
      )}

      {isEditing && (
        <div className="fotos-card">
          <div className="fotos-card-header">
            <div>
              <strong>Fotos</strong>
              <p>Gerencie as fotos vinculadas ao policial.</p>
            </div>

            <label className="btn-secondary upload-label">
              {uploadingFoto ? 'Enviando...' : 'Adicionar foto'}
              <input
                type="file"
                accept="image/*"
                onChange={handleUploadFoto}
                disabled={uploadingFoto}
                hidden
              />
            </label>
          </div>

          <PolicialFotos policialId={policialId} user={user} />
        </div>
      )}

      {!isEditing && (
        <div className="form-info">
          Salve o cadastro primeiro para liberar o envio de fotos.
        </div>
      )}

      <div className="form-actions-bottom">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancelar
        </button>

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar policial'}
        </button>
      </div>
    </form>
  )
}