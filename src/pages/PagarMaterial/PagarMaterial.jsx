import { useState } from 'react'

import QrScanner from '../../components/QrScanner/QrScanner'

import {
  criarMovimentacaoCompleta
} from '../../services/movimentacaoEngine'

import {
  buscarPatrimonioPorQrCode
} from '../../services/pagarMaterialService'

import {
  LOCAL_DESTINO_PADRAO,
  LOCAIS_DESTINO,
  TIPOS_MOVIMENTACAO
} from '../../config/movimentacoesConfig'

import RecebedorCard from './components/RecebedorCard'
import PesquisaMaterial from './components/PesquisaMaterial'
import ResumoEntrega from './components/ResumoEntrega'

import './PagarMaterial.css'

const LOCAL_ORIGEM =
  'RESERVA DE MATERIAL'

function obterNomeUsuario(user) {
  return (
    user?.nome ||
    user?.nome_guerra ||
    user?.nome_completo ||
    user?.email ||
    'USUÁRIO SIGMO'
  )
}

function criarChaveMaterial(material) {
  return [
    material?.tabela_origem ||
      'patrimonio',
    material?.id
  ].join(':')
}

export default function PagarMaterial({
  user,
  onVoltar = null,
  onConcluido = null
}) {
  const [reRecebedor, setReRecebedor] =
    useState('')

  const [
    policialRecebedor,
    setPolicialRecebedor
  ] = useState(null)

  const [
    tipoMovimentacao,
    setTipoMovimentacao
  ] = useState(
    TIPOS_MOVIMENTACAO.CAUTELA
  )

  const [
    localDestino,
    setLocalDestino
  ] = useState(
    LOCAL_DESTINO_PADRAO
  )

  const [
    observacoes,
    setObservacoes
  ] = useState('')

  const [
    itensSelecionados,
    setItensSelecionados
  ] = useState([])

  const [mensagem, setMensagem] =
    useState('')

  const [erro, setErro] =
    useState('')

  const [salvando, setSalvando] =
    useState(false)

  const [
    scannerAberto,
    setScannerAberto
  ] = useState(false)

  const [
    buscandoQrCode,
    setBuscandoQrCode
  ] = useState(false)

  const [
    atualizarPesquisaEm,
    setAtualizarPesquisaEm
  ] = useState(0)

  function adicionarMaterial(material) {
    if (!material?.disponivel) {
      setErro(
        'Este patrimônio não está disponível.'
      )
      return
    }

    const chave =
      criarChaveMaterial(material)

    const jaSelecionado =
      itensSelecionados.some(
        (item) =>
          criarChaveMaterial(item) ===
          chave
      )

    if (jaSelecionado) {
      setErro(
        'Este patrimônio já foi adicionado.'
      )
      return
    }

    setItensSelecionados(
      (listaAtual) => [
        ...listaAtual,
        {
          ...material,
          patrimonio_id:
            material.patrimonio_id ||
            material.id,
          quantidade: 1
        }
      ]
    )

    setErro('')
    setMensagem('')
  }

  function removerMaterial(materialId) {
    setItensSelecionados(
      (listaAtual) =>
        listaAtual.filter(
          (item) =>
            item.id !== materialId
        )
    )
  }

  function limparMovimentacao() {
    setReRecebedor('')
    setPolicialRecebedor(null)

    setTipoMovimentacao(
      TIPOS_MOVIMENTACAO.CAUTELA
    )

    setLocalDestino(
      LOCAL_DESTINO_PADRAO
    )

    setObservacoes('')
    setItensSelecionados([])
    setMensagem('')
    setErro('')
  }

  async function handleQrRead(valor) {
    try {
      setScannerAberto(false)
      setBuscandoQrCode(true)
      setErro('')
      setMensagem('')

      const material =
        await buscarPatrimonioPorQrCode(
          valor
        )

      if (!material) {
        setErro(
          `Nenhum patrimônio encontrado para o QR Code: ${valor}`
        )
        return
      }

      if (!material.disponivel) {
        setErro(
          `${material.patrimonio} foi localizado, mas não está disponível.`
        )
        return
      }

      adicionarMaterial(material)

      setMensagem(
        `${material.patrimonio} adicionado pelo QR Code.`
      )
    } catch (error) {
      console.error(error)

      setErro(
        'Não foi possível consultar o QR Code.'
      )
    } finally {
      setBuscandoQrCode(false)
    }
  }

  async function confirmarEntrega() {
    if (!policialRecebedor) {
      setErro(
        'Informe um RE válido.'
      )
      return
    }

    if (!localDestino) {
      setErro(
        'Informe o local de destino.'
      )
      return
    }

    if (
      itensSelecionados.length === 0
    ) {
      setErro(
        'Adicione pelo menos um patrimônio.'
      )
      return
    }

    try {
      setSalvando(true)
      setErro('')
      setMensagem('')

      const resultado =
        await criarMovimentacaoCompleta({
          tipo:
            tipoMovimentacao,

          origemLocal:
            LOCAL_ORIGEM,

          destinoLocal:
            localDestino,

          solicitante:
            user,

          recebedor:
            policialRecebedor,

          observacoes,

          itens:
            itensSelecionados,

          aprovarAutomaticamente:
            true
        })

      setMensagem(
        `Movimentação registrada com sucesso. Protocolo: ${resultado.movimentacaoId}`
      )

      setItensSelecionados([])
      setObservacoes('')

      setAtualizarPesquisaEm(
        Date.now()
      )

      await onConcluido?.(resultado)
    } catch (error) {
      console.error(error)

      setErro(
        error?.message ||
        'Não foi possível registrar a movimentação.'
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <main className="pagar-material-page">
      <header className="pagar-material-header">
        <div>
          <span className="pagar-material-kicker">
            SIGMO • MOVIMENTAÇÃO
          </span>

          <h1>Pagar Material</h1>

          <p>
            Registre a entrega de materiais,
            equipamentos ou armamentos ao
            policial responsável.
          </p>
        </div>

        <div className="pagar-material-operador">
          <span>Operador</span>

          <strong>
            {obterNomeUsuario(user)}
          </strong>
        </div>
      </header>

      {typeof onVoltar === 'function' && (
        <div className="pagar-material-top-actions">
          <button
            type="button"
            className="pagar-material-refresh"
            onClick={onVoltar}
            disabled={salvando}
          >
            Voltar
          </button>
        </div>
      )}

      {buscandoQrCode && (
        <div className="pagar-material-feedback">
          Consultando QR Code...
        </div>
      )}

      {erro && (
        <div className="pagar-material-feedback pagar-material-feedback-error">
          {erro}
        </div>
      )}

      {mensagem && (
        <div className="pagar-material-feedback pagar-material-feedback-success">
          {mensagem}
        </div>
      )}

      <section className="pagar-material-layout">
        <div className="pagar-material-main">
          <section className="pagar-material-card">
            <div className="pagar-material-card-header">
              <div>
                <span>ETAPA 1</span>

                <h2>
                  Identificar recebedor
                </h2>
              </div>

              <span className="pagar-material-status">
                RASCUNHO
              </span>
            </div>

            <RecebedorCard
              re={reRecebedor}
              onChangeRE={
                setReRecebedor
              }
              onSelecionado={
                setPolicialRecebedor
              }
            />

            <div className="pagar-material-form-grid pagar-material-form-grid-spaced">
              <label>
                Tipo de movimentação

                <select
                  value={
                    tipoMovimentacao
                  }
                  onChange={(event) =>
                    setTipoMovimentacao(
                      event.target.value
                    )
                  }
                >
                  <option
                    value={
                      TIPOS_MOVIMENTACAO
                        .CAUTELA
                    }
                  >
                    CAUTELA
                  </option>

                  <option
                    value={
                      TIPOS_MOVIMENTACAO
                        .TRANSFERENCIA
                    }
                  >
                    TRANSFERÊNCIA
                  </option>

                  <option
                    value={
                      TIPOS_MOVIMENTACAO
                        .ENTREGA
                    }
                  >
                    ENTREGA
                  </option>
                </select>
              </label>

              <label>
                Local de origem

                <input
                  value={LOCAL_ORIGEM}
                  readOnly
                />
              </label>

              <label>
                Local de destino

                <select
                  value={localDestino}
                  onChange={(event) =>
                    setLocalDestino(
                      event.target.value
                    )
                  }
                >
                  {LOCAIS_DESTINO.map(
                    (local) => (
                      <option
                        key={local}
                        value={local}
                      >
                        {local}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="pagar-material-field-full">
                Observações

                <textarea
                  value={observacoes}
                  onChange={(event) =>
                    setObservacoes(
                      event.target.value
                        .toUpperCase()
                    )
                  }
                  placeholder="Informações adicionais sobre a entrega"
                />
              </label>
            </div>
          </section>

          <PesquisaMaterial
            itensSelecionados={
              itensSelecionados
            }
            onAdicionar={
              adicionarMaterial
            }
            onAbrirQrCode={() =>
              setScannerAberto(true)
            }
            atualizarEm={
              atualizarPesquisaEm
            }
          />
        </div>

        <ResumoEntrega
          policial={
            policialRecebedor
          }
          re={reRecebedor}
          destino={localDestino}
          itens={itensSelecionados}
          salvando={salvando}
          onRemover={
            removerMaterial
          }
          onLimpar={
            limparMovimentacao
          }
          onConfirmar={
            confirmarEntrega
          }
        />
      </section>

      <QrScanner
        open={scannerAberto}
        onRead={handleQrRead}
        onClose={() =>
          setScannerAberto(false)
        }
      />
    </main>
  )
}