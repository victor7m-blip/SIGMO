import { useState, useEffect } from 'react'
import WizardHeader from './WizardHeader'
import WizardProgress from './WizardProgress'
import WizardFooter from './WizardFooter'
import './CadastroPatrimonioWizard.css'

export default function CadastroPatrimonioWizard({
  titulo,
  subtitulo,
  etapas = [],
  children,
  etapaInicial = 0,
  onStepChange,
  onNext,
  onPrevious,
  onFinish,
  podeAvancar = () => true,
  podeVoltar = () => true
}) {
  const [etapaAtual, setEtapaAtual] = useState(etapaInicial)

  const total = etapas.length

  useEffect(() => {
    onStepChange?.(etapaAtual)
  }, [etapaAtual])

  function voltar() {
    if (!podeVoltar(etapaAtual)) return

    onPrevious?.(etapaAtual)

    if (etapaAtual > 0) {
      setEtapaAtual(etapaAtual - 1)
    }
  }

  async function avancar() {
    if (!podeAvancar(etapaAtual)) return

    if (onNext) {
      const resultado = await onNext(etapaAtual)

      if (resultado === false) return
    }

    if (etapaAtual < total - 1) {
      setEtapaAtual(etapaAtual + 1)
      return
    }

    if (onFinish) {
      await onFinish()
    }
  }

  return (
    <main className="cadastro-wizard-page">

      <section className="cadastro-wizard-card">

        <WizardHeader
          titulo={titulo}
          subtitulo={subtitulo}
          etapa={etapaAtual + 1}
          total={total}
        />

        <WizardProgress
          etapas={etapas}
          etapaAtual={etapaAtual}
          onSelect={setEtapaAtual}
        />

        <div className="cadastro-wizard-content">
          {Array.isArray(children)
            ? children[etapaAtual]
            : children}
        </div>

        <WizardFooter
          etapaAtual={etapaAtual}
          total={total}
          onBack={voltar}
          onNext={avancar}
        />

      </section>

    </main>
  )
}