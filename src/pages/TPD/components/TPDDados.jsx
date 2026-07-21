import './TPDDados.css'

import SigmoInput from '../../../ui/components/SigmoInput'
import SigmoSelect from '../../../ui/components/SigmoSelect'
import SigmoTextarea from '../../../ui/components/SigmoTextarea'

import PatrimonioFormGrid from '../../../components/Patrimonio/PatrimonioFormGrid'

import {
  LOCAIS_TPD,
  MARCAS_TPD,
  MODELOS_TPD,
  STATUS_TPD,
  TIPOS_TPD
} from '../../../constants/tpds'

import {
  UNIDADES_27_BPMM
} from '../../../constants/unidades'

export default function TPDDados({
  form,
  onChange,
  disabled = false
}) {
  const emServico =
    form.status_operacional ===
    'EM_SERVICO'

  const emManutencao =
    form.status_operacional ===
    'MANUTENCAO'

  const recolhido =
    form.status_operacional ===
    'RECOLHIDO'

  const baixado =
    form.status_operacional ===
    'BAIXADO'

  return (
    <div className="tpd-dados">
      <section className="tpd-dados-section">
        <div className="tpd-dados-section-header">
          <div>
            <h3>
              Identificação do equipamento
            </h3>

            <p>
              Informe os dados patrimoniais e
              técnicos do Terminal Portátil de
              Dados.
            </p>
          </div>
        </div>

        <PatrimonioFormGrid>
          <SigmoInput
            label="Patrimônio"
            name="patrimonio"
            value={form.patrimonio}
            onChange={onChange}
            disabled={disabled}
            placeholder="Ex.: 123456"
          />

          <SigmoInput
            label="Número de série"
            name="numero_serie"
            value={form.numero_serie}
            onChange={onChange}
            required
            disabled={disabled}
            placeholder="Número de série do aparelho"
          />

          <SigmoSelect
            label="Tipo de equipamento"
            name="tipo_equipamento"
            value={form.tipo_equipamento}
            onChange={onChange}
            required
            disabled={disabled}
            options={TIPOS_TPD}
          />

          <SigmoInput
  label="Marca"
  name="marca"
  value={form.marca}
  onChange={onChange}
  required
  disabled={disabled}
  placeholder="Digite ou selecione a marca"
  list="tpd-marcas"
/>

<datalist id="tpd-marcas">
  {MARCAS_TPD.map((opcao, index) => {
    const valor =
      typeof opcao === 'string'
        ? opcao
        : opcao.value

    return (
      <option
        key={`marca-${valor}-${index}`}
        value={valor}
      />
    )
  })}
</datalist>

<SigmoInput
  label="Modelo"
  name="modelo"
  value={form.modelo}
  onChange={onChange}
  required
  disabled={disabled}
  placeholder="Digite ou selecione o modelo"
  list="tpd-modelos"
/>

<datalist id="tpd-modelos">
  {MODELOS_TPD.map((opcao, index) => {
    const valor =
      typeof opcao === 'string'
        ? opcao
        : opcao.value

    return (
      <option
        key={`modelo-${valor}-${index}`}
        value={valor}
      />
    )
  })}
</datalist>

          <SigmoInput
  label="QR Code"
  name="qr_code"
  value={form.qr_code}
  disabled
  placeholder="GERADO AUTOMATICAMENTE AO SALVAR"
/>
        </PatrimonioFormGrid>
      </section>

      <section className="tpd-dados-section">
        <div className="tpd-dados-section-header">
          <div>
            <h3>
              Controle operacional
            </h3>

            <p>
              Informe a unidade, o status e a
              localização atual do equipamento.
            </p>
          </div>
        </div>

        <PatrimonioFormGrid>
          <SigmoSelect
            label="Unidade"
            name="unidade"
            value={form.unidade}
            onChange={onChange}
            required
            disabled={disabled}
            options={UNIDADES_27_BPMM}
          />

          <SigmoSelect
            label="Status operacional"
            name="status_operacional"
            value={form.status_operacional}
            onChange={onChange}
            required
            disabled={disabled}
            options={STATUS_TPD}
          />

          <SigmoSelect
            label="Local atual"
            name="local_atual"
            value={form.local_atual}
            onChange={onChange}
            disabled={disabled}
            options={LOCAIS_TPD}
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
                label: 'ATIVO'
              },
              {
                value: 'false',
                label: 'INATIVO'
              }
            ]}
          />
        </PatrimonioFormGrid>
      </section>

      {emServico && (
        <section className="tpd-dados-section tpd-dados-highlight">
          <div className="tpd-dados-section-header">
            <div>
              <span className="tpd-dados-badge">
                Material em serviço
              </span>

              <h3>
                Vinculação operacional
              </h3>

              <p>
                Informe a equipe ou a viatura que
                está utilizando o equipamento.
              </p>
            </div>
          </div>

          <PatrimonioFormGrid>
            <SigmoInput
              label="Equipe vinculada"
              name="equipe_vinculada"
              value={form.equipe_vinculada}
              onChange={onChange}
              disabled={disabled}
              placeholder="Ex.: EQUIPE A"
            />

            <SigmoInput
              label="Viatura vinculada"
              name="viatura_vinculada"
              value={form.viatura_vinculada}
              onChange={onChange}
              disabled={disabled}
              placeholder="Ex.: M-27005"
            />
          </PatrimonioFormGrid>

          <div className="tpd-dados-notice">
            Para colocar o TPD em serviço, pelo
            menos uma equipe ou uma viatura deve
            ser informada.
          </div>
        </section>
      )}

      {emManutencao && (
        <section className="tpd-dados-section tpd-dados-warning">
          <div className="tpd-dados-section-header">
            <div>
              <span className="tpd-dados-badge">
                Manutenção
              </span>

              <h3>
                Equipamento indisponível
              </h3>

              <p>
                Registre nas observações o defeito,
                o responsável e o local para onde o
                equipamento foi encaminhado.
              </p>
            </div>
          </div>
        </section>
      )}

      {recolhido && (
        <section className="tpd-dados-section tpd-dados-warning">
          <div className="tpd-dados-section-header">
            <div>
              <span className="tpd-dados-badge">
                Recolhido
              </span>

              <h3>
                Equipamento fora de serviço
              </h3>

              <p>
                Informe nas observações o motivo
                do recolhimento e o local onde o
                equipamento permanecerá guardado.
              </p>
            </div>
          </div>
        </section>
      )}

      {baixado && (
        <section className="tpd-dados-section tpd-dados-danger">
          <div className="tpd-dados-section-header">
            <div>
              <span className="tpd-dados-badge">
                Baixa patrimonial
              </span>

              <h3>
                Equipamento baixado
              </h3>

              <p>
                Registre nas observações o motivo e
                os dados do documento que autorizou
                a baixa.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="tpd-dados-section">
        <div className="tpd-dados-section-header">
          <div>
            <h3>
              Informações complementares
            </h3>

            <p>
              Registre detalhes importantes sobre
              utilização, conservação ou
              movimentação.
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
          placeholder="Digite as observações do TPD"
        />
      </section>
    </div>
  )
}