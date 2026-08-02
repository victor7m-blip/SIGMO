export default function PatrimonioWizardSteps({ step }) {
  return (
    <div className="patrimonio-steps">
      <div className={step >= 1 ? 'active' : ''}>1. Dados</div>
      <div className={step >= 2 ? 'active' : ''}>2. Fotos</div>
      <div className={step >= 3 ? 'active' : ''}>3. Finalizar</div>
    </div>
  )
}