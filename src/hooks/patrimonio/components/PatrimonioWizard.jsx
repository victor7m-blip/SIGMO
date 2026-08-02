import { useState } from 'react'
import PatrimonioWizardSteps from './PatrimonioWizardSteps'
import PatrimonioDadosForm from './PatrimonioDadosForm'
import PatrimonioFotosStep from './PatrimonioFotosStep'
import PatrimonioResumoStep from './PatrimonioResumoStep'
import './PatrimonioWizard.css'

export default function PatrimonioWizard({
  titulo = 'Cadastro Patrimonial',
  subtitulo = 'Preencha os dados do patrimônio',
  form,
  erro,
  locais = [],
  camposExtras = null,
  fotos = [],
  salvando = false,
  itemSalvo = null,
  onChange,
  onSalvarDados,
  onAdicionarFoto,
  onRemoverFoto,
  onFinalizar,
  onCancelar
}) {
  const [step, setStep] = useState(1)

  async function avancarDados() {
    const ok = await onSalvarDados?.()

    if (ok !== false) {
      setStep(2)
    }
  }

  function voltar() {
    setStep((prev) => Math.max(1, prev - 1))
  }

  function avancar() {
    setStep((prev) => Math.min(3, prev + 1))
  }

  return (
    <section className="patrimonio-wizard">
      <header className="patrimonio-wizard-header">
        <div>
          <h1>{titulo}</h1>
          <p>{subtitulo}</p>
        </div>

        {onCancelar && (
          <button type="button" className="btn-secondary" onClick={onCancelar}>
            Cancelar
          </button>
        )}
      </header>

      <PatrimonioWizardSteps step={step} />

      {step === 1 && (
        <PatrimonioDadosForm
          form={form}
          erro={erro}
          locais={locais}
          camposExtras={camposExtras}
          salvando={salvando}
          onChange={onChange}
          onAvancar={avancarDados}
        />
      )}

      {step === 2 && (
        <PatrimonioFotosStep
          itemSalvo={itemSalvo}
          fotos={fotos}
          onAdicionarFoto={onAdicionarFoto}
          onRemoverFoto={onRemoverFoto}
          onVoltar={voltar}
          onAvancar={avancar}
        />
      )}

      {step === 3 && (
        <PatrimonioResumoStep
          itemSalvo={itemSalvo}
          fotos={fotos}
          onVoltar={voltar}
          onFinalizar={onFinalizar}
        />
      )}
    </section>
  )
}