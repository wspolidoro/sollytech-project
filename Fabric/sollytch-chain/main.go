package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
	"github.com/sjwhitworth/golearn/base"
	"github.com/sjwhitworth/golearn/trees"
)

type NullFloat64 float64

func (nf *NullFloat64) UnmarshalJSON(b []byte) error {
	if string(b) == "null" {
		*nf = 0
		return nil
	}
	var f float64
	if err := json.Unmarshal(b, &f); err != nil {
		return err
	}
	*nf = NullFloat64(f)
	return nil
}

// struct json dos modelos de machine learning
type ModelBytes struct {
	//trackers
	UpdatedAt  string `json:"updated_at"`
	Version    int    `json:"version"`
	
	//chave de busca
	ModelKey   string `json:"modelKey"`

	//conteudo
	ModelData  string `json:"modelData"`
}

// struct json do hash da planilha
type LoteRecord struct{
	//trackers
	Version       int    `json:"version"`
	LastUpdatedAt string `json:"last_updated_at"`
	Timestamp     string `json:"timestamp"`

	//chave de busca
	CasseteLot    string `json:"cassete_lot"`

	//conteudo
	HashPlanilha  string `json:"hash_planilha"`
}

// struct json dos testes
type TestRecord struct {
	//trackers
	Version 		          int         `json:"version"`
	LastUpdatedAt             string      `json:"last_updated_at"`
	CreatedAt                 string      `json:"created_at"`

	//chaves de busca
	TestID                    string      `json:"test_id"`
	CassetteLot               string      `json:"cassette_lot"`

	//conteudo
	Timestamp                 string      `json:"timestamp"`
	Lat                       float64     `json:"lat"`
	Lon                       float64     `json:"lon"`
	GeoHash                   string      `json:"geo_hash"`
	OperatorID                string      `json:"operator_id"`
	OperatorDID               string      `json:"operator_did"`
	MatrixType                string      `json:"matrix_type"`
	ReagentLot                string      `json:"reagent_lot"`
	ExpiryDaysLeft            int         `json:"expiry_days_left"`
	DistanceMM                float64     `json:"distance_mm"`
	TimeToMigrateS            float64     `json:"time_to_migrate_s"`
	ControlLineOK             bool        `json:"control_line_ok"`
	SampleVolumeUL            float64     `json:"sample_volume_uL"`
	SamplePH                  float64     `json:"sample_pH"`
	SampleTurbidityNTU        float64     `json:"sample_turbidity_NTU"`
	SampleTempC               float64     `json:"sample_temp_C"`
	AmbientTC                 float64     `json:"ambient_T_C"`
	AmbientRHPct              float64     `json:"ambient_RH_pct"`
	LightingLux               float64     `json:"lighting_lux"`
	TiltDeg                   float64     `json:"tilt_deg"`
	PreincubationTimeS        float64     `json:"preincubation_time_s"`
	TimeSinceSamplingMin      float64     `json:"time_since_sampling_min"`
	StorageCondition          string      `json:"storage_condition"`
	PrefilterUsed             bool        `json:"prefilter_used"`
	ImageTaken                bool        `json:"image_taken"`
	ImageBlurScore            NullFloat64 `json:"image_blur_score"`
	DeviceFWVersion           string      `json:"device_fw_version"`
	ProdutoID                 string      `json:"produto_id"`
	KitCalibrationID          string      `json:"kit_calibration_id"`
	ControleInternoResult     string      `json:"controle_interno_result"`
	CadeiaFrioStatus          bool        `json:"cadeia_frio_status"`
	TempoTransporteHoras      float64     `json:"tempo_transporte_horas"`
	CondicaoTransporte        string      `json:"condicao_transporte"`
	EstimatedConcentrationPpb float64     `json:"estimated_concentration_ppb"`
	IncertezaEstimativaPpb    float64     `json:"incerteza_estimativa_ppb"`
	AcaoRecomendada           string      `json:"acao_recomendada"`
	ResultClass               string      `json:"result_class"`
	QCStatus                  string      `json:"qc_status"`
}

type SmartContract struct {
	contractapi.Contract
}

/*
	Função responsável por armazenar ou atualizar o registro de uma planilha no ledger
	Utiliza o hash da planilha como chave principal (state key) e o lote (casseteLot)
	como parte de uma chave composta para indexação e busca
*/
func (c *SmartContract) StorePlanilha(ctx contractapi.TransactionContextInterface, casseteLot string, hashPlanilha string) error {
	// Valida se os parâmetros obrigatórios foram informados
	if casseteLot == "" || hashPlanilha == "" {
		return fmt.Errorf("casseteLot e hashPlanilha são obrigatórios")
	}

	// Define o hash como chave principal do estado
	planilhaKey := hashPlanilha

	// Obtém o timestamp da transação atual
	txTime, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return err
	}

	// Converte o timestamp para formato RFC3339 (UTC)
	formattedTime := time.Unix(
		txTime.Seconds,
		int64(txTime.Nanos),
	).UTC().Format(time.RFC3339)
	
	// Verifica se já existe um registro para esse hash no ledger
	exists, err := c.PlanilhaExists(ctx, planilhaKey)
	if err != nil {
		return err
	}

	var asset LoteRecord

	if exists {
		// Caso já exista, carrega o registro atual para atualização
		assetBytes, err := ctx.GetStub().GetState(planilhaKey)
		if err != nil {
			return err
		}
		if assetBytes == nil {
			return fmt.Errorf("falha ao carregar planilha existente %s", hashPlanilha)
		}

		// Desserializa os dados armazenados
		if err := json.Unmarshal(assetBytes, &asset); err != nil {
			return err
		}

		// Incrementa a versão e atualiza a data de modificação
		asset.Version++
		asset.LastUpdatedAt = formattedTime

	} else {
		// Caso não exista, cria um novo registro inicial
		asset = LoteRecord{
			CasseteLot:    casseteLot,
			HashPlanilha:  hashPlanilha,
			Timestamp:     formattedTime,
			Version:       0,
			LastUpdatedAt: formattedTime,
		}

		// Cria uma chave composta para indexar lote + hash
		indexKey, err := ctx.GetStub().CreateCompositeKey(
			"lote~planilha",
			[]string{casseteLot, hashPlanilha},
		)
		if err != nil {
			return err
		}

		// Armazena a chave composta como índice no ledger
		if err := ctx.GetStub().PutState(indexKey, []byte{0x00}); err != nil {
			return err
		}
	}

	// Serializa o objeto para armazenamento
	assetBytes, err := json.Marshal(asset)
	if err != nil {
		return err
	}

	// Persiste o registro usando o hash como chave principal
	return ctx.GetStub().PutState(planilhaKey, assetBytes)
}

/*
	Função que retorna todas as planilhas associadas a um determinado lote
	Recebe o número do lote (casseteLot) e, a partir da chave composta
	"lote~planilha", localiza todos os hashes vinculados a esse lote
*/
func (c *SmartContract) GetPlanilhasByLote(ctx contractapi.TransactionContextInterface, casseteLot string) ([]*LoteRecord, error) {
	// Valida se o número do lote foi informado
	if casseteLot == "" {
		return nil, fmt.Errorf("casseteLot não pode ser vazio")
	}

	// Obtém um iterador para todas as chaves compostas que iniciam com
	// "lote~planilha" e possuem o casseteLot como primeiro atributo
	iterator, err := ctx.GetStub().GetStateByPartialCompositeKey(
		"lote~planilha",
		[]string{casseteLot},
	)
	if err != nil {
		return nil, err
	}
	// Garante o fechamento do iterador ao final da execução
	defer iterator.Close()

	// Lista que armazenará as planilhas encontradas
	var results []*LoteRecord

	// Itera sobre todas as entradas encontradas para o lote informado
	for iterator.HasNext() {
		response, err := iterator.Next()
		if err != nil {
			return nil, err
		}

		// Separa a chave composta em seus atributos originais
		_, parts, err := ctx.GetStub().SplitCompositeKey(response.Key)
		if err != nil {
			return nil, err
		}

		// Recupera o hash da planilha (segunda parte da chave composta)
		hashPlanilha := parts[1]

		// Busca a planilha completa a partir do hash
		planilha, err := c.GetPlanilhaByHash(ctx, hashPlanilha)
		if err != nil {
			return nil, err
		}

		// Adiciona a planilha encontrada na lista de resultados
		results = append(results, planilha)
	}

	// Retorna todas as planilhas associadas ao lote
	return results, nil
}

/*
	Função que recupera uma planilha específica a partir do seu hash
	Busca diretamente no ledger pela chave principal (hashPlanilha)
	e retorna um único objeto LoteRecord
*/
func (c *SmartContract) GetPlanilhaByHash(ctx contractapi.TransactionContextInterface, hashPlanilha string) (*LoteRecord, error) {
	// Valida se o hash foi informado
	if hashPlanilha == "" {
		return nil, fmt.Errorf("hashPlanilha não pode ser vazio")
	}

	// Consulta o estado no ledger usando o hash como chave
	data, err := ctx.GetStub().GetState(hashPlanilha)
	if err != nil {
		return nil, fmt.Errorf("erro ao acessar o ledger: %v", err)
	}
	if data == nil {
		return nil, fmt.Errorf("planilha %s não encontrada", hashPlanilha)
	}

	// Desserializa os dados armazenados para a struct LoteRecord
	var asset LoteRecord
	if err := json.Unmarshal(data, &asset); err != nil {
		return nil, fmt.Errorf("erro ao deserializar planilha: %v", err)
	}

	// Retorna a planilha encontrada
	return &asset, nil
}

/*
	Função que verifica se já existe um registro de planilha no ledger
	Recebe a chave principal (hash da planilha) e retorna true caso exista
*/
func (c *SmartContract) PlanilhaExists(ctx contractapi.TransactionContextInterface, planilhaKey string) (bool, error) {
	// Consulta o estado no ledger
	data, err := ctx.GetStub().GetState(planilhaKey)
	if err != nil {
		return false, err
	}

	// Retorna true se os dados existirem (não forem nil)
	return data != nil, nil
}

/*
	Função responsável por armazenar ou atualizar um modelo de Machine Learning no ledger
	Armazena os bytes do modelo (em Base64), controla versionamento e registra
	a data de atualização para uso posterior em predições
*/
func (s *SmartContract) StoreModel(ctx contractapi.TransactionContextInterface, modelKey string, modelBase64 string) error {
	// Valida se os parâmetros obrigatórios foram informados
	if modelKey == "" || modelBase64 == "" {
		return fmt.Errorf("modelKey e modelData nao podem ser vazios")
	}

	// Permite apenas chaves de modelo previamente definidas
	switch modelKey {
	case "acao_recomendada", "result_class", "qc_status":
		// Chaves válidas
	default:
		return fmt.Errorf("modelKey invalido")
	}

	stub := ctx.GetStub()

	// Verifica se já existe um modelo armazenado com essa chave
	existingBytes, err := stub.GetState(modelKey)
	if err != nil {
		return fmt.Errorf("erro ao buscar modelo existente: %v", err)
	}

	// Define versão inicial como 1
	version := 1

	// Caso já exista, incrementa a versão com base na anterior
	if existingBytes != nil {
		var existingModel ModelBytes
		err = json.Unmarshal(existingBytes, &existingModel)
		if err != nil {
			return fmt.Errorf("erro ao decodificar modelo existente: %v", err)
		}
		version = existingModel.Version + 1
	}

	// Obtém o timestamp da transação atual
	txTime, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return err
	}
    
	// Cria a estrutura do modelo com versionamento e data de atualização
	model := ModelBytes{
		ModelKey:  modelKey,
		ModelData: modelBase64,
		Version:   version,
		UpdatedAt: time.Unix(
			txTime.Seconds,
			int64(txTime.Nanos),
		).UTC().Format(time.RFC3339),
	}

	// Serializa o modelo para armazenamento
	bytes, err := json.Marshal(model)
	if err != nil {
		return err
	}

	// Persiste o modelo no ledger usando modelKey como chave principal
	return stub.PutState(modelKey, bytes)
}

/*
	Função que recupera os bytes de um modelo armazenado no ledger
	Busca pelo modelKey, desserializa a estrutura ModelBytes e
	decodifica o conteúdo Base64 para retornar os bytes originais do modelo
*/
func (s *SmartContract) getModelBytes(ctx contractapi.TransactionContextInterface, modelKey string) ([]byte, error) {
	// Consulta o modelo no ledger pela chave
	data, err := ctx.GetStub().GetState(modelKey)
	if err != nil {
		return nil, err
	}
	if data == nil {
		return nil, fmt.Errorf("modelo %s nao encontrado", modelKey)
	}

	// Desserializa os dados armazenados
	var stored ModelBytes
	if err := json.Unmarshal(data, &stored); err != nil {
		return nil, err
	}

	// Decodifica o conteúdo Base64 para bytes binários originais
	return base64.StdEncoding.DecodeString(stored.ModelData)
}

/*
	Função que carrega um modelo ID3 armazenado no ledger
	Recupera os bytes do modelo, grava temporariamente no sistema
	de arquivos e utiliza o método Load para reconstruir o modelo
	em memória para uso em predições
*/
func loadID3ModelFromLedger(ctx contractapi.TransactionContextInterface, s *SmartContract, modelKey string) (*trees.ID3DecisionTree, error) {
	// Obtém os bytes do modelo armazenado
	bytes, err := s.getModelBytes(ctx, modelKey)
	if err != nil {
		return nil, err
	}

	// Cria um arquivo temporário para reconstrução do modelo
	path := filepath.Join(os.TempDir(), modelKey)
	if err := os.WriteFile(path, bytes, 0600); err != nil {
		return nil, err
	}

	// Instancia a estrutura do modelo ID3
	model := trees.NewID3DecisionTree(0.1)

	// Carrega o modelo a partir do arquivo temporário
	if err := model.Load(path); err != nil {
		return nil, err
	}

	return model, nil
}

/*
	Função que converte uma string CSV em uma estrutura DenseInstances.
	É utilizada para transformar a string recebida (linha de predição)
	em um mini dataset compatível com a biblioteca de ML
*/
func loadDataset(csvData string) (*base.DenseInstances, error) {
	// Cria um reader a partir da string CSV
	reader := strings.NewReader(csvData)

	// Faz o parse do CSV para o formato interno de instâncias
	data, err := base.ParseCSVToInstancesFromReader(reader, true)
	if err != nil {
		return nil, fmt.Errorf("erro ao carregar dataset: %v", err)
	}

	return data, nil
}

// Header usado na montagem do csv de predição
var baseHeader =
	"lat,lon,expiry_days_left,distance_mm,time_to_migrate_s," +
		"sample_volume_uL,sample_pH,sample_turbidity_NTU,sample_temp_C," +
		"ambient_T_C,ambient_RH_pct,lighting_lux,tilt_deg," +
		"preincubation_time_s,time_since_sampling_min,image_blur_score," +
		"tempo_transporte_horas,estimated_concentration_ppb," +
		"incerteza_estimativa_ppb,control_line_ok,controle_interno_result"

/*
	Função responsável por realizar a predição.
	Monta um CSV temporário contendo o cabeçalho completo + variável alvo,
	adiciona a linha de entrada com classe desconhecida ("?"),
	executa o Predict do modelo e retorna o resultado previsto
*/
func predictFromCSV(model *trees.ID3DecisionTree, target string, csvRow string) (string, error) {
	// Monta o cabeçalho incluindo a variável alvo
	header := baseHeader + "," + target

	// Cria um mini CSV com uma única linha para predição
	csv := header + "\n" + csvRow + ",?"

	// Converte o CSV em instâncias compatíveis com o modelo
	data, err := loadDataset(csv)
	if err != nil {
		return "", err
	}

	// Executa a predição
	res, err := model.Predict(data)
	if err != nil {
		return "", err
	}

	// Retorna o resultado da primeira (e única) linha
	return res.RowString(0), nil
}

/*
	Função responsável por registrar um novo teste no ledger
	Recebe:
	- testID: identificador único do teste
	- jsonStr: JSON com os dados estruturados do teste
	- predictStr: string CSV com os atributos necessários para predição

	A função:
	1) Valida se o teste já existe
	2) Converte o JSON em struct
	3) Carrega os 3 modelos de ML do ledger
	4) Executa as predições das três variáveis-alvo
	   (acao_recomendada, result_class e qc_status)
	5) Armazena o registro completo com versionamento e timestamp
	6) Cria uma chave composta para indexação por lote
*/
func (s *SmartContract) StoreTest(ctx contractapi.TransactionContextInterface, testID string, jsonStr string, predictStr string) error {
	// Verifica se já existe um teste com o mesmo ID
	existing, err := ctx.GetStub().GetState(testID)
	if err != nil {
		return err
	}
	if existing != nil {
		return fmt.Errorf("teste %s ja existe", testID)
	}

	// Converte o JSON recebido para struct
	var record TestRecord
	if err := json.Unmarshal([]byte(jsonStr), &record); err != nil {
		return fmt.Errorf("erro ao decodificar JSON: %v", err)
	}

	// Define explicitamente o ID do teste
	record.TestID = testID

	// Carrega os modelos de Machine Learning armazenados no ledger
	modeloAcao, err := loadID3ModelFromLedger(ctx, s, "acao_recomendada")
	if err != nil {
		return err
	}

	modeloResult, err := loadID3ModelFromLedger(ctx, s, "result_class")
	if err != nil {
		return err
	}

	modeloQc, err := loadID3ModelFromLedger(ctx, s, "qc_status")
	if err != nil {
		return err
	}

	// Executa as predições para as três últimas colunas da "planilha",
	// preenchendo automaticamente os campos derivados por ML
	record.AcaoRecomendada, err =
		predictFromCSV(modeloAcao, "acao_recomendada", predictStr)
	if err != nil {
		return err
	}

	record.ResultClass, err =
		predictFromCSV(modeloResult, "result_class", predictStr)
	if err != nil {
		return err
	}

	record.QCStatus, err =
		predictFromCSV(modeloQc, "qc_status", predictStr)
	if err != nil {
		return err
	}

	// Pega o timestamp da transação
	txTime, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return err
	}

	timestamp := time.Unix(
		txTime.Seconds,
		int64(txTime.Nanos),
	).UTC().Format(time.RFC3339)

	// Define controle de versão e datas
	record.Version = 0
	record.CreatedAt = timestamp
	record.LastUpdatedAt = timestamp

	// Serializa o registro completo
	bytes, err := json.Marshal(record)
	if err != nil {
		return err
	}

	// Armazena o teste usando testID como chave principal
	if err := ctx.GetStub().PutState(testID, bytes); err != nil {
		return err
	}

	// Cria chave composta para permitir consulta por lote
	indexKey, err := ctx.GetStub().CreateCompositeKey(
		"lote~teste",
		[]string{record.CassetteLot, testID},
	)
	if err != nil {
		return err
	}

	// Armazena o indice no ledger
	return ctx.GetStub().PutState(indexKey, []byte{0x00})
}

/*
	Função que consulta um teste específico pelo seu ID
	Realiza busca no ledger utilizando a chave principal (testID)
	retorna um unico objeto TestRecord
*/
func (s *SmartContract) GetTestByID(ctx contractapi.TransactionContextInterface, testID string,) (*TestRecord, error) {
	// Valida o testID obrigatório
	if testID == "" {
		return nil, fmt.Errorf("testID não pode ser vazio")
	}

	// Busca o teste no ledger
	data, err := ctx.GetStub().GetState(testID)
	if err != nil {
		return nil, err
	}
	if data == nil {
		return nil, fmt.Errorf("teste %s não encontrado", testID)
	}

	// Desserializa os dados armazenados
	var record TestRecord
	if err := json.Unmarshal(data, &record); err != nil {
		return nil, err
	}

	return &record, nil
}

/*
	Função que retorna todos os testes associados a um determinado lote
	Utiliza chave composta "lote~teste" para localizar todos os testIDs
	vinculados ao cassetteLot e, para cada um, realiza a consulta individual
*/
func (s *SmartContract) GetTestsByLote(ctx contractapi.TransactionContextInterface, cassetteLot string) ([]*TestRecord, error) {
	// Valida se o lote foi informado
	if cassetteLot == "" {
		return nil, fmt.Errorf("cassetteLot não pode ser vazio")
	}

	// Busca todas as chaves compostas associadas ao lote
	iterator, err := ctx.GetStub().GetStateByPartialCompositeKey(
		"lote~teste",
		[]string{cassetteLot},
	)
	if err != nil {
		return nil, err
	}
	defer iterator.Close()

	var results []*TestRecord

	// Itera sobre todos os testes vinculados ao lote
	for iterator.HasNext() {
		response, err := iterator.Next()
		if err != nil {
			return nil, err
		}

		// Separa os atributos da chave composta
		_, parts, err := ctx.GetStub().SplitCompositeKey(response.Key)
		if err != nil {
			return nil, err
		}

		testID := parts[1]

		// Recupera o teste individual pelo ID
		test, err := s.GetTestByID(ctx, testID)
		if err != nil {
			return nil, err
		}

		results = append(results, test)
	}

	return results, nil
}

/*
	Função responsável por atualizar um teste já existente no ledger
	esta função NÃO executa novamente as predições
	com os modelos de Machine Learning, apenas atualiza o teste com a string json recebida
*/
func (s *SmartContract) UpdateTest(ctx contractapi.TransactionContextInterface, testID string, fullJSON string) error {
	// Busca o teste existente no ledger
	existingBytes, err := ctx.GetStub().GetState(testID)
	if err != nil {
		return err
	}
	if existingBytes == nil {
		return fmt.Errorf("teste %s nao encontrado", testID)
	}

	// Desserializa o registro atual armazenado
	var existing TestRecord
	if err := json.Unmarshal(existingBytes, &existing); err != nil {
		return err
	}

	// Desserializa o novo JSON completo recebido para atualização
	var updated TestRecord
	if err := json.Unmarshal([]byte(fullJSON), &updated); err != nil {
		return fmt.Errorf("json invalido: %v", err)
	}

	// Obtém timestamp da transação atual
	txTime, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return err
	}

	now := time.Unix(
		txTime.Seconds,
		int64(txTime.Nanos),
	).UTC().Format(time.RFC3339)

	// Mantém integridade dos metadados controlados pelo ledger
	updated.TestID = testID
	updated.Version = existing.Version + 1           // Incrementa versão
	updated.CreatedAt = existing.CreatedAt           // Preserva data original
	updated.LastUpdatedAt = now                      // Atualiza data de modificação

	// Caso o lote tenha sido alterado, atualiza o índice composto
	if existing.CassetteLot != updated.CassetteLot {
		// Remove índice antigo
		oldIndexKey, err := ctx.GetStub().CreateCompositeKey(
			"lote~teste",
			[]string{existing.CassetteLot, testID},
		)
		if err != nil {
			return err
		}

		if err := ctx.GetStub().DelState(oldIndexKey); err != nil {
			return err
		}

		// Cria novo índice com o lote atualizado
		newIndexKey, err := ctx.GetStub().CreateCompositeKey(
			"lote~teste",
			[]string{updated.CassetteLot, testID},
		)
		if err != nil {
			return err
		}

		if err := ctx.GetStub().PutState(newIndexKey, []byte{0x00}); err != nil {
			return err
		}
	}

	// Serializa o registro atualizado
	bytes, err := json.Marshal(updated)
	if err != nil {
		return err
	}

	// Persiste o novo estado do teste no ledger
	return ctx.GetStub().PutState(testID, bytes)
}

// main inicia a execução do chaincode no blockchain
func main() {
	// Cria uma nova instância do chaincode
	chaincode, err := contractapi.NewChaincode(new(SmartContract))
	if err != nil {
		panic(fmt.Sprintf("erro criando chaincode: %v", err))
	}
	
	// Inicia o chaincode e aguarda por transações
	if err := chaincode.Start(); err != nil {
		panic(fmt.Sprintf("erro iniciando chaincode: %v", err))
	}
}