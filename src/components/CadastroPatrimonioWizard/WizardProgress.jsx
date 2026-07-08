export default function WizardProgress({
  etapas,
  etapaAtual,
  onSelect
}) {
  return (
    <div className="cadastro-wizard-steps">

      {etapas.map((item, index) => (

        <button
          key={item}
          type="button"
          className={
            index === etapaAtual
              ? 'step active'
              : index < etapaAtual
                ? 'step done'
                : 'step'
          }
          onClick={() => onSelect(index)}
        >

          <span>{index + 1}</span>

          {item}

        </button>

      ))}

    </div>
  )
}