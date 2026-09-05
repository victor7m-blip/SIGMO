import './COPDados.css'

import SigmoInput from '../../../ui/components/SigmoInput'
import SigmoSelect from '../../../ui/components/SigmoSelect'
import SigmoTextarea from '../../../ui/components/SigmoTextarea'

import PatrimonioFormGrid from '../../../components/Patrimonio/PatrimonioFormGrid'

import {
  LOCAIS_COP,
  MARCAS_COP,
  STATUS_COP
} from '../../../constants/cops'

export default function COPDados({
  form,
  onChange,
  disabled = false
}) {
  const emManutencao =
    form.status_operacional ===
    'MANUTENCAO'

  const baixada =
    form.status_operacional ===
    'BAIXADA'

  return (
    <div className="cop-dados">
      <section className="cop-dados-section">
        <div className="cop-dados-section-header">
          <div>
            <h3>
              Identificação da câmera
            </h3>

            <p>
              Informe o número utilizado no livro
              e, quando disponível, o ID físico da
              Câmera Operacional Portátil.
            </p>
          </div>
        </div>

        <PatrimonioFormGrid>
          <SigmoInput
            label="Número da COP"
            name="numero"
            value={form.numero}
            onChange={onChange}
            required
            disabled={disabled}
            placeholder="Ex.: 01"
          />

          <SigmoInput
            label="ID da câmera"
            name="identificacao_equipamento"
            value={
              form.identificacao_equipamento
            }
            onChange={onChange}
            disabled={disabled}
            placeholder="Ainda não informado"
          />

          <SigmoSelect
            label="Marca"
            name="marca"
            value={form.marca}
            onChange={onChange}
            required
            disabled={disabled}
            options={MARCAS_COP}
          />
        </PatrimonioFormGrid>
      </section>

      <section className="cop-dados-section">
        <div className="cop-dados-section-header">
          <div>
            <h3>
              Controle operacional
            </h3>

            <p>
              Consulte ou atualize a situação e a
              localização atual da COP.
            </p>
          </div>
        </div>

        <PatrimonioFormGrid>
          <SigmoSelect
            label="Status operacional"
            name="status_operacional"
            value={form.status_operacional}
            onChange={onChange}
            required
            disabled={disabled}
            options={STATUS_COP}
          />

          <SigmoSelect
            label="Local atual"
            name="local_atual"
            value={form.local_atual}
            onChange={onChange}
            disabled={disabled}
            options={LOCAIS_COP}
          />

          <SigmoSelect
            label="Situação do cadastro"
            name="ativo"
            value={
              form.ativo === false
                ? 'false'
                : 'true'
            }
            onChange={onChange}
            disabled={disabled}
            options={[
              {
                value: 'true',
                label: 'ATIVA'
              },
              {
                value: 'false',
                label: 'INATIVA'
              }
            ]}
          />
        </PatrimonioFormGrid>
      </section>

      {emManutencao && (
        <section className="cop-dados-section cop-dados-warning">
          <div className="cop-dados-section-header">
            <div>
              <span className="cop-dados-badge">
                Manutenção
              </span>

              <h3>
                COP indisponível
              </h3>

              <p>
                A câmera não ficará disponível
                para pagamento enquanto estiver
                em manutenção. Registre nas
                observações os dados relevantes.
              </p>
            </div>
          </div>
        </section>
      )}

      {baixada && (
        <section className="cop-dados-section cop-dados-danger">
          <div className="cop-dados-section-header">
            <div>
              <span className="cop-dados-badge">
                Baixa patrimonial
              </span>

              <h3>
                COP baixada
              </h3>

              <p>
                Registre nas observações o motivo
                e os dados do documento que
                autorizou a baixa.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="cop-dados-section">
        <div className="cop-dados-section-header">
          <div>
            <h3>
              Informações complementares
            </h3>

            <p>
              Registre detalhes importantes sobre
              identificação, conservação ou
              movimentação da câmera.
            </p>
          </div>
        </div>

        <SigmoTextarea
          label="Observações"
          name="observacoes"
          value={form.observacoes}
          onChange={onChange}
          disabled={disabled}
          rows={5}
          placeholder="Digite as observações da COP"
        />
      </section>
    </div>
  )
}
