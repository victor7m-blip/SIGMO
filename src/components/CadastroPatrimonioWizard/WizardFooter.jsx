export default function WizardFooter({
  etapaAtual,
  total,
  onBack,
  onNext
}) {
  return (
    <footer className="cadastro-wizard-footer">

      <button
        type="button"
        onClick={onBack}
        disabled={etapaAtual === 0}
      >
        Voltar
      </button>

      <button
        type="button"
        onClick={onNext}
      >
        {etapaAtual === total - 1
          ? 'Finalizar'
          : 'Próximo'}
      </button>

    </footer>
  )
}