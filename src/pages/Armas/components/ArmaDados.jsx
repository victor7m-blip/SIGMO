import SigmoInput from '../../../ui/components/SigmoInput'
import SigmoSelect from '../../../ui/components/SigmoSelect'
import SigmoTextarea from '../../../ui/components/SigmoTextarea'
import PatrimonioFormGrid from '../../../components/Patrimonio/PatrimonioFormGrid'

import {
  ACABAMENTOS_ARMAS,
  CALIBRES_ARMAS,
  ESPECIES_ARMAS,
  PROPRIEDADES_ARMAS,
  SITUACOES_DOCUMENTAIS_ARMAS,
  STATUS_ARMAS
} from '../../../constants/armas'

import { UNIDADES_27_BPMM } from '../../../constants/unidades'


export default function ArmaDados({
  form,
  onChange,
  disabled = false
}) {
  const armaParticular =
    form.propriedade === 'PARTICULAR'

  return (
    <div className="arma-dados">
      <section className="arma-dados-section">
        <div className="arma-dados-section-header">
          <div>
            <h3>Identificação e propriedade</h3>

            <p>
              Informe a origem e os dados principais
              de identificação da arma.
            </p>
          </div>
        </div>

        <PatrimonioFormGrid>
          <SigmoSelect
  label="Propriedade"
  name="propriedade"
  value={form.propriedade}
  onChange={onChange}
  disabled={disabled}
  options={PROPRIEDADES_ARMAS}
/>

          <SigmoInput
            label="Patrimônio"
            name="patrimonio"
            value={form.patrimonio}
            onChange={onChange}
            required={!armaParticular}
            disabled={disabled}
            placeholder={
              armaParticular
                ? 'Opcional para arma particular'
                : 'Número patrimonial'
            }
          />

          <SigmoInput
            label="Número de série"
            name="numero_serie"
            value={form.numero_serie}
            onChange={onChange}
            required
            disabled={disabled}
          />

          <SigmoSelect
  label="Espécie"
  name="especie"
  value={form.especie}
  onChange={onChange}
  disabled={disabled}
  options={ESPECIES_ARMAS}
/>

          <SigmoInput
            label="Marca"
            name="marca"
            value={form.marca}
            onChange={onChange}
            required
            disabled={disabled}
          />

          <SigmoInput
            label="Modelo"
            name="modelo"
            value={form.modelo}
            onChange={onChange}
            disabled={disabled}
          />

          <SigmoSelect
  label="Calibre"
  name="calibre"
  value={form.calibre}
  onChange={onChange}
  required
  disabled={disabled}
  options={CALIBRES_ARMAS}
/>

          <SigmoSelect
  label="Acabamento"
  name="acabamento"
  value={form.acabamento}
  onChange={onChange}
  disabled={disabled}
  options={ACABAMENTOS_ARMAS}
/>
        </PatrimonioFormGrid>
      </section>

      <section className="arma-dados-section">
        <div className="arma-dados-section-header">
          <div>
            <h3>Controle operacional</h3>

            <p>
              Informe a unidade, a situação atual e
              demais dados de controle.
            </p>
          </div>
        </div>

        <PatrimonioFormGrid>
          <SigmoSelect
  label="Unidade"
  name="unidade"
  value={form.unidade}
  onChange={onChange}
  disabled={disabled}
  options={UNIDADES_27_BPMM}
/>

          <SigmoSelect
  label="Status"
  name="status"
  value={form.status}
  onChange={onChange}
  disabled={disabled}
  options={STATUS_ARMAS}
/>        </PatrimonioFormGrid>
      </section>

      {armaParticular && (
        <section className="arma-dados-section arma-dados-particular">
          <div className="arma-dados-section-header">
            <div>
              <span className="arma-dados-badge">
                Arma particular
              </span>

              <h3>Documentação da arma</h3>

              <p>
                Estes dados são obrigatórios para o
                controle de arma particular de policial.
              </p>
            </div>
          </div>

          <PatrimonioFormGrid>
            <SigmoInput
              label="Número SIGMA"
              name="numero_sigma"
              value={form.numero_sigma}
              onChange={onChange}
              required
              disabled={disabled}
            />

            <SigmoInput
              label="Número do registro"
              name="numero_registro"
              value={form.numero_registro}
              onChange={onChange}
              required
              disabled={disabled}
            />

            <SigmoInput
              label="Validade do registro"
              name="validade_registro"
              type="date"
              value={form.validade_registro}
              onChange={onChange}
              required
              disabled={disabled}
            />

            <SigmoSelect
  label="Situação documental"
  name="situacao_documental"
  value={form.situacao_documental}
  onChange={onChange}
  disabled={disabled}
  options={SITUACOES_DOCUMENTAIS_ARMAS}
/>

            <SigmoInput
              label="Comprimento do cano"
              name="comprimento_cano"
              value={form.comprimento_cano}
              onChange={onChange}
              required
              disabled={disabled}
              placeholder="Ex.: 102 mm"
            />

            <SigmoInput
              label="Capacidade"
              name="capacidade"
              type="number"
              min="1"
              value={form.capacidade}
              onChange={onChange}
              required
              disabled={disabled}
              placeholder="Quantidade de munições"
            />

            <SigmoInput
              label="País de fabricação"
              name="pais_fabricacao"
              value={form.pais_fabricacao}
              onChange={onChange}
              disabled={disabled}
            />

            <SigmoInput
              label="Ano de fabricação"
              name="ano_fabricacao"
              type="number"
              min="1800"
              max="2100"
              value={form.ano_fabricacao}
              onChange={onChange}
              disabled={disabled}
            />
          </PatrimonioFormGrid>
        </section>
      )}

      {armaParticular && (
        <section className="arma-dados-section arma-dados-particular">
          <div className="arma-dados-section-header">
            <div>
              <h3>Proprietário</h3>

              <p>
                Vincule a arma ao policial proprietário.
              </p>
            </div>
          </div>

          <PatrimonioFormGrid>
            <SigmoInput
              label="Nome do proprietário"
              name="proprietario_nome"
              value={form.proprietario_nome}
              onChange={onChange}
              required
              disabled={disabled}
            />

            <SigmoInput
              label="RE do proprietário"
              name="proprietario_re"
              value={form.proprietario_re}
              onChange={onChange}
              required
              disabled={disabled}
            />

            <SigmoInput
              label="ID do policial"
              name="proprietario_policial_id"
              value={form.proprietario_policial_id}
              onChange={onChange}
              disabled={disabled}
              placeholder="Preenchimento automático futuramente"
            />
          </PatrimonioFormGrid>

          <div className="arma-dados-aviso">
            Neste primeiro momento, o nome e o RE são
            preenchidos manualmente. Depois ligaremos esse
            campo diretamente ao cadastro de Policiais.
          </div>
        </section>
      )}

      <section className="arma-dados-section">
        <div className="arma-dados-section-header">
          <div>
            <h3>Observações</h3>

            <p>
              Registre informações complementares
              relevantes.
            </p>
          </div>
        </div>

        <SigmoTextarea
          label="Observações"
          name="observacoes"
          value={form.observacoes}
          onChange={onChange}
          disabled={disabled}
          placeholder="Digite observações sobre a arma..."
        />
      </section>
    </div>
  )
}