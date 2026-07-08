import { useState } from 'react'

import CadastroPatrimonioWizard from '../../components/CadastroPatrimonioWizard/CadastroPatrimonioWizard'
import PatrimonioForm from '../../components/Patrimonio/PatrimonioForm'
import { camposBasePatrimonio } from '../../config/patrimonioCampos'

import './Municoes.css'

const initialForm = {
  patrimonio: '',
  numero_lote: '',
  tipo: '',
  marca: '',
  modelo: '',
  calibre: '',
  estado: '',
  situacao: '',
  local: '',
  observacoes: ''
}

export default function Municoes() {
  const [form, setForm] = useState(initialForm)
  const [itemSalvo, setItemSalvo] = useState(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  function handleChange(event) {
    const { name, value } = event.target

    setForm((prev) => ({
      ...prev,
      [name]: value
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    try {
      setErro('')
      setSalvando(true)

      const payload = {
        ...form,
        categoria: 'MUNIÇÃO'
      }

      // Depois ligamos no Supabase:
      // const salvo = await cadastrarMunicao(payload)
const salvo = {
  id: `temp-${Date.now()}`,
  ...payload
}

      setItemSalvo(salvo)
    } catch (error) {
      console.error(error)
      setErro('Erro ao salvar munição.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <CadastroPatrimonioWizard
      titulo="Cadastro de Munições"
      subtitulo="Base patrimonial reutilizável do SIGMO"
    >
      <PatrimonioForm
        form={form}
        erro={erro}
        campos={camposBasePatrimonio}
        onChange={handleChange}
        onSubmit={handleSubmit}
        salvando={salvando}
      />

      <section className="municoes-step-box">
        {!itemSalvo ? (
          <p>Salve os dados da munição para liberar o envio de fotos.</p>
        ) : (
          <>
            <h2>Fotos da Munição</h2>
            <p>ID salvo: {itemSalvo.id}</p>
            <input type="file" accept="image/*" multiple />
          </>
        )}
      </section>

      <section className="municoes-step-box">
        {!itemSalvo ? (
          <p>Salve os dados da munição para gerar o QR Code.</p>
        ) : (
          <>
            <h2>QR Code</h2>
            <p>QR Code será gerado para o patrimônio: {itemSalvo.patrimonio}</p>
          </>
        )}
      </section>
    </CadastroPatrimonioWizard>
  )
}