import { useEffect, useMemo, useState } from 'react'

import './Locais.css'

import PageHeader from '../../components/ui/PageHeader/PageHeader'
import Section from '../../components/ui/Section/Section'
import Card from '../../components/ui/Card/Card'
import Button from '../../components/ui/Button/Button'
import Input from '../../components/ui/Input/Input'
import Table from '../../components/ui/Table/Table'
import Empty from '../../components/ui/Empty/Empty'

import {
  listarLocais,
  cadastrarLocal,
  atualizarLocal,
  excluirLocal
} from '../../services/locaisService'
const FORM_INICIAL = {
  nome: '',
  tipo: 'GUARDA',
  descricao: '',
  ativo: true,
  permite_receber: true,
  permite_entregar: true,
}

const TIPOS_LOCAL = [
  'GUARDA',
  'PESSOA',
  'VIATURA',
  'UNIDADE',
  'MANUTENCAO',
  'EXTERNO',
  'BAIXA',
]

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
    setErro('')
    setModalAberto(true)
  }

  function editar(local) {
    setEditandoId(local.id)

    setForm({
      nome: local.nome || '',
      tipo: local.tipo || 'GUARDA',
      descricao: local.descricao || '',
      ativo: local.ativo ?? true,
      permite_receber: local.permite_receber ?? true,
      permite_entregar: local.permite_entregar ?? true,
    })

    setErro('')
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
      const termo = busca.toLowerCase()

      const okBusca =
        local.nome?.toLowerCase().includes(termo) ||
        local.tipo?.toLowerCase().includes(termo) ||
        (local.descricao || '').toLowerCase().includes(termo)

      const okTipo =
        tipoFiltro === 'TODOS' ||
        local.tipo === tipoFiltro

      return okBusca && okTipo
    })
  }, [locais, busca, tipoFiltro])

  return (
    <main className="locais-page">

      <PageHeader
        title="Locais"
        subtitle={`${lista.length} local(is) cadastrado(s)`}
      >
        <Button onClick={abrirNovo}>
          Novo Local
        </Button>
      </PageHeader>

      <Section
        title="Consulta de locais"
        subtitle="Pesquise, filtre, edite e gerencie os locais patrimoniais."
      >
        <Card>
          <div className="locais-filtros">

            <Input
              label="Pesquisar"
              placeholder="Pesquisar por nome, tipo ou descrição..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />

            <label className="locais-select">
              <span>Tipo</span>

              <select
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value)}
              >
                <option value="TODOS">Todos</option>

                {TIPOS_LOCAL.map(tipo => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </label>

          </div>
        </Card>

        <Card>
          {carregando ? (
            <Empty
              title="Carregando locais..."
              description="Aguarde enquanto os dados são carregados."
            />
          ) : lista.length === 0 ? (
            <Empty
              title="Nenhum local encontrado"
              description="Cadastre um novo local ou ajuste os filtros da consulta."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th>Status</th>
                  <th>Recebe</th>
                  <th>Entrega</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {lista.map(local => (
                  <tr key={local.id}>
                    <td>{local.nome}</td>
                    <td>
                      <span className="local-badge">
                        {local.tipo}
                      </span>
                    </td>
                    <td>{local.descricao || '-'}</td>
                    <td>
                      <span className={local.ativo ? 'status ativo' : 'status inativo'}>
                        {local.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>{local.permite_receber ? 'Sim' : 'Não'}</td>
                    <td>{local.permite_entregar ? 'Sim' : 'Não'}</td>
                    <td>
                      <div className="locais-acoes">
                        <Button variant="secondary" onClick={() => editar(local)}>
                          Editar
                        </Button>

                        <Button variant="secondary" onClick={() => duplicar(local)}>
                          Duplicar
                        </Button>

                        <Button variant="secondary" onClick={() => alterarStatus(local)}>
                          {local.ativo ? 'Desativar' : 'Ativar'}
                        </Button>

                        <Button variant="danger" onClick={() => excluir(local)}>
                          Excluir
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </Section>

      {modalAberto && (
        <div className="locais-modal-backdrop">
          <Card className="locais-modal">

            <div className="locais-modal-header">
              <div>
                <h2>{editandoId ? 'Editar Local' : 'Novo Local'}</h2>
                <p>Preencha os dados do local.</p>
              </div>
            </div>

            {erro && (
              <div className="locais-alerta">
                {erro}
              </div>
            )}

            <div className="locais-form">

              <Input
                label="Nome"
                value={form.nome}
                onChange={(e) => alterarCampo('nome', e.target.value)}
                placeholder="Ex: Guarda do Quartel"
              />

              <label className="locais-select">
                <span>Tipo</span>

                <select
                  value={form.tipo}
                  onChange={(e) => alterarCampo('tipo', e.target.value)}
                >
                  {TIPOS_LOCAL.map(tipo => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </label>

              <label className="locais-textarea">
                <span>Descrição</span>

                <textarea
                  value={form.descricao}
                  onChange={(e) => alterarCampo('descricao', e.target.value)}
                  placeholder="Descrição opcional"
                />
              </label>

              <div className="locais-checks">
                <label>
                  <input
                    type="checkbox"
                    checked={form.ativo}
                    onChange={(e) => alterarCampo('ativo', e.target.checked)}
                  />
                  Ativo
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={form.permite_receber}
                    onChange={(e) => alterarCampo('permite_receber', e.target.checked)}
                  />
                  Permite receber
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={form.permite_entregar}
                    onChange={(e) => alterarCampo('permite_entregar', e.target.checked)}
                  />
                  Permite entregar
                </label>
              </div>

            </div>

            <div className="locais-modal-actions">
              <Button variant="secondary" onClick={fecharModal}>
                Cancelar
              </Button>

              <Button onClick={salvar}>
                Salvar
              </Button>
            </div>

          </Card>
        </div>
      )}

    </main>
  )
}