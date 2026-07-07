import { useState } from 'react'
import './cadastroPatrimonioWizard.css'

export default function CadastroPatrimonioWizard({
  titulo = 'Cadastro de Patrimônio',
  etapaDados,
  etapaFotos,
  etapaDocumentos,
  onSalvarDados,
  onConcluir,
  salvando = false
}) {
  const [etapaAtual, setEtapaAtual] = useState(1)
  const [patrimonioSalvo, setPatrimonioSalvo] = useState(null)
  const temDocumentos = Boolean(etapaDocumentos)

  async function handleSeguinte() {
    if (salvando) return
    if (!onSalvarDados) return

    const resultado = await onSalvarDados()

    if (!resultado?.id) return

    setPatrimonioSalvo(resultado)
    setEtapaAtual(2)
  }

  function handleVoltar() {
    setEtapaAtual((prev) => Math.max(1, prev - 1))
  }

  function handleConcluirFotos() {
    if (!patrimonioSalvo?.id) return

    if (temDocumentos) {
      setEtapaAtual(3)
      return
    }

    if (onConcluir) onConcluir(patrimonioSalvo)
  }

  function handleConcluirFinal() {
    if (!patrimonioSalvo?.id) return
    if (onConcluir) onConcluir(patrimonioSalvo)
  }

  return (
    <div className="cadastro-wizard">
      <div className="cadastro-wizard-header">
        <div>
          <h2>{titulo}</h2>
          <p>Assistente de Cadastro de Patrimônio</p>
        </div>

        <div className="cadastro-wizard-steps">
          <span className={etapaAtual === 1 ? 'active' : ''}>1. Dados</span>
          <span className={etapaAtual === 2 ? 'active' : ''}>2. Fotos</span>

          {temDocumentos && (
            <span className={etapaAtual === 3 ? 'active' : ''}>
              3. Documentos
            </span>
          )}
        </div>
      </div>

      <div className="cadastro-wizard-body">
        {etapaAtual === 1 && etapaDados}

        {etapaAtual === 2 && (
          <>
            {typeof etapaFotos === 'function'
              ? etapaFotos(patrimonioSalvo)
              : etapaFotos}
          </>
        )}

        {etapaAtual === 3 && (
          <>
            {typeof etapaDocumentos === 'function'
              ? etapaDocumentos(patrimonioSalvo)
              : etapaDocumentos}
          </>
        )}
      </div>

      <div className="cadastro-wizard-footer">
        {etapaAtual > 1 && (
          <button
            type="button"
            className="btn-secondary"
            onClick={handleVoltar}
            disabled={salvando}
          >
            Voltar
          </button>
        )}

        {etapaAtual === 1 && (
          <button
            type="button"
            className="btn-primary"
            onClick={handleSeguinte}
            disabled={salvando}
          >
            {salvando ? 'Salvando...' : 'Seguinte'}
          </button>
        )}

        {etapaAtual === 2 && (
          <button
            type="button"
            className="btn-primary"
            onClick={handleConcluirFotos}
            disabled={!patrimonioSalvo?.id}
          >
            {temDocumentos ? 'Seguinte' : 'Concluir Cadastro'}
          </button>
        )}

        {etapaAtual === 3 && (
          <button
            type="button"
            className="btn-primary"
            onClick={handleConcluirFinal}
            disabled={!patrimonioSalvo?.id}
          >
            Concluir Cadastro
          </button>
        )}
      </div>
    </div>
  )
}