import '../styles/HTDados.css'

import SigmoInput from '../../../ui/components/SigmoInput'
import SigmoSelect from '../../../ui/components/SigmoSelect'
import SigmoTextarea from '../../../ui/components/SigmoTextarea'

import PatrimonioFormGrid from '../../../components/Patrimonio/PatrimonioFormGrid'

import {
  LOCAIS_HT,
  MARCAS_HT,
  MODELOS_HT,
  STATUS_HT,
  TIPOS_HT
} from '../../../constants/hts'

import {
  UNIDADES_27_BPMM
} from '../../../constants/unidades'

function padronizarTexto(valor) {
  return String(valor ?? '')
    .toUpperCase()
    .replace(/\s{2,}/g, ' ')
}

function padronizarIdentificador(valor) {
  return String(valor ?? '')
    .toUpperCase()
    .replace(/\s+/g, '')
}

export default function HTDados({
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

  function handleCampoPadronizado(event) {
    const {
      name,
      value
    } = event.target

    let novoValor = value

    if (
      name === 'patrimonio' ||
      name === 'numero_serie'
    ) {
      novoValor =
        padronizarIdentificador(value)
    }

    if (
      name === 'marca' ||
      name === 'modelo' ||
      name === 'equipe_vinculada' ||
      name === 'viatura_vinculada'
    ) {
      novoValor =
        padronizarTexto(value)
    }

    onChange?.({
      target: {
        name,
        value: novoValor
      }
    })
  }

  return (
    <div className="ht-dados">
      <section className="ht-dados-section">
        <div className="ht-dados-section-header">
          <div>
            <h3>
              Identificação do equipamento
            </h3>

            <p>
              Informe os dados patrimoniais e
              técnicos do HT.
            </p>
          </div>
        </div>

        <PatrimonioFormGrid>
          <SigmoInput
            label="Patrimônio"
            name="patrimonio"
            value={form.patrimonio}
            onChange={handleCampoPadronizado}
            disabled={disabled}
            placeholder="Ex.: 123456"
          />

          <SigmoInput
            label="Número de série"
            name="numero_serie"
            value={form.numero_serie}
            onChange={handleCampoPadronizado}
            required
            disabled={disabled}
            placeholder="Número de série do HT"
          />

          <SigmoSelect
            label="Tipo"
            name="tipo_ht"
            value={form.tipo_ht}
            onChange={onChange}
            required
            disabled={disabled}
            options={TIPOS_HT}
          />

          <SigmoInput
            label="Marca"
            name="marca"
            value={form.marca}
            onChange={handleCampoPadronizado}
            required
            disabled={disabled}
            placeholder="Digite ou selecione a marca"
            list="ht-marcas"
          />

          <datalist id="ht-marcas">
            {MARCAS_HT.map(
              (opcao, index) => {
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
              }
            )}
          </datalist>

          <SigmoInput
            label="Modelo"
            name="modelo"
            value={form.modelo}
            onChange={handleCampoPadronizado}
            required
            disabled={disabled}
            placeholder="Digite ou selecione o modelo"
            list="ht-modelos"
          />

          <datalist id="ht-modelos">
            {MODELOS_HT.map(
              (opcao, index) => {
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
              }
            )}
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

      <section className="ht-dados-section">
        <div className="ht-dados-section-header">
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
            options={STATUS_HT}
          />

          <SigmoSelect
            label="Local atual"
            name="local_atual"
            value={form.local_atual}
            onChange={onChange}
            disabled={disabled}
            options={LOCAIS_HT}
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
        <section className="ht-dados-section ht-dados-highlight">
          <div className="ht-dados-section-header">
            <div>
              <span className="ht-dados-badge">
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
              onChange={handleCampoPadronizado}
              disabled={disabled}
              placeholder="Ex.: EQUIPE A"
            />

            <SigmoInput
              label="Viatura vinculada"
              name="viatura_vinculada"
              value={form.viatura_vinculada}
              onChange={handleCampoPadronizado}
              disabled={disabled}
              placeholder="Ex.: M-27005"
            />
          </PatrimonioFormGrid>

          <div className="ht-dados-notice">
            Para colocar o HT em serviço,
            pelo menos uma equipe ou uma
            viatura deve ser informada.
          </div>
        </section>
      )}

      {emManutencao && (
        <section className="ht-dados-section ht-dados-warning">
          <div className="ht-dados-section-header">
            <div>
              <span className="ht-dados-badge">
                Manutenção
              </span>

              <h3>
                Equipamento indisponível
              </h3>

              <p>
                Registre nas observações o
                defeito, o responsável e o
                local para onde o equipamento
                foi encaminhado.
              </p>
            </div>
          </div>
        </section>
      )}

      {recolhido && (
        <section className="ht-dados-section ht-dados-warning">
          <div className="ht-dados-section-header">
            <div>
              <span className="ht-dados-badge">
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
        <section className="ht-dados-section ht-dados-danger">
          <div className="ht-dados-section-header">
            <div>
              <span className="ht-dados-badge">
                Baixa patrimonial
              </span>

              <h3>
                Equipamento baixado
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

      <section className="ht-dados-section">
        <div className="ht-dados-section-header">
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
          placeholder="Digite as observações do HT"
        />
      </section>
    </div>
  )
}