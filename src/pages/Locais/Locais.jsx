import { useEffect, useMemo, useState } from 'react'

import {
  listarLocais,
  cadastrarLocal,
  atualizarLocal,
  excluirLocal,
} from '../../services/locaisService'

import LocalForm from './components/LocalForm'
import LocalTabela from './components/LocalTabela'

import './Locais.css'

const FORM_INICIAL = {
  nome: '',
  tipo: 'GUARDA',
  descricao: '',
  ativo: true,
  permite_receber: true,
  permite_entregar: true,
}

export default function Locais() {

  const [locais, setLocais] = useState([])
  const [carregando, setCarregando] = useState(false)

  const [busca, setBusca] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('TODOS')

  const [modalAberto, setModalAberto] = useState(false)
  const [editandoId, setEditandoId] = useState(null)

  const [erro, setErro] = useState('')
  const [form, setForm] = useState(FORM_INICIAL)

  useEffect(() => {
    carregarLocais()
  }, [])

  async function carregarLocais() {

    setCarregando(true)

    const dados = await listarLocais()

    setLocais(dados)

    setCarregando(false)

  }

  function abrirNovo() {

    setForm(FORM_INICIAL)

    setEditandoId(null)

    setModalAberto(true)

  }

  function editar(local) {

    setEditandoId(local.id)

    setForm({
      nome: local.nome,
      tipo: local.tipo,
      descricao: local.descricao || '',
      ativo: local.ativo,
      permite_receber: local.permite_receber,
      permite_entregar: local.permite_entregar,
    })

    setModalAberto(true)

  }

  function fecharModal() {

    setModalAberto(false)

    setEditandoId(null)

    setErro('')

    setForm(FORM_INICIAL)

  }

  function alterarCampo(campo, valor) {

    setForm(atual => ({
      ...atual,
      [campo]: valor
    }))

  }

  async function salvar() {

    if (!form.nome.trim()) {

      setErro('Informe o nome.')

      return

    }

    if (editandoId) {

      await atualizarLocal(editandoId, form)

    } else {

      await cadastrarLocal(form)

    }

    fecharModal()

    carregarLocais()

  }

  async function alterarStatus(local) {

    await atualizarLocal(local.id, {

      ...local,

      ativo: !local.ativo

    })

    carregarLocais()

  }

  async function excluir(local) {

    if (!window.confirm(`Excluir ${local.nome}?`)) return

    await excluirLocal(local.id)

    carregarLocais()

  }

  async function duplicar(local) {

    const copia = {

      ...local,

      nome: `${local.nome} (Cópia)`

    }

    delete copia.id

    await cadastrarLocal(copia)

    carregarLocais()

  }

  const lista = useMemo(() => {

    return locais.filter(local => {

      const okBusca =

        local.nome.toLowerCase().includes(busca.toLowerCase()) ||

        local.tipo.toLowerCase().includes(busca.toLowerCase()) ||

        (local.descricao || '').toLowerCase().includes(busca.toLowerCase())

      const okTipo =

        tipoFiltro === 'TODOS' ||

        local.tipo === tipoFiltro

      return okBusca && okTipo

    })

  }, [locais, busca, tipoFiltro])

  return (

    <main className="locais-page">

      <div className="locais-header">

        <div>

          <h1>Locais</h1>

          <p>

            {lista.length} local(is) cadastrado(s)

          </p>

        </div>

        <button
          className="btn-primary"
          onClick={abrirNovo}
        >

          Novo Local

        </button>

      </div>

      {erro && (

        <div className="locais-alerta">

          {erro}

        </div>

      )}

      <div className="locais-filtros">

        <input

          placeholder="Pesquisar..."

          value={busca}

          onChange={(e)=>setBusca(e.target.value)}

        />

        <select

          value={tipoFiltro}

          onChange={(e)=>setTipoFiltro(e.target.value)}

        >

          <option value="TODOS">

            Todos

          </option>

          <option value="GUARDA">GUARDA</option>

          <option value="PESSOA">PESSOA</option>

          <option value="VIATURA">VIATURA</option>

          <option value="UNIDADE">UNIDADE</option>

          <option value="MANUTENCAO">MANUTENCAO</option>

          <option value="EXTERNO">EXTERNO</option>

          <option value="BAIXA">BAIXA</option>

        </select>

      </div>

      <div className="locais-card">

        <LocalTabela

          locais={lista}

          carregando={carregando}

          onEdit={editar}

          onToggleAtivo={alterarStatus}

          onDelete={excluir}

          onDuplicate={duplicar}

        />

      </div>

      {modalAberto && (

        <LocalForm

          form={form}

          editandoId={editandoId}

          onChange={alterarCampo}

          onCancel={fecharModal}

          onSave={salvar}

        />

      )}

    </main>

  )

}