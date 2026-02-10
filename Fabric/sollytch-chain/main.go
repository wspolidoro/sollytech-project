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

type ModelBytes struct {
	//trackers
	UpdatedAt  string `json:"updated_at"`
	Version    int    `json:"version"`
	
	//chave de busca
	ModelKey   string `json:"modelKey"`

	//conteudo
	ModelData  string `json:"modelData"`
}

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

func (c *SmartContract) StorePlanilha(ctx contractapi.TransactionContextInterface, casseteLot string, hashPlanilha string) error {
	if casseteLot == "" || hashPlanilha == "" {
		return fmt.Errorf("casseteLot e hashPlanilha são obrigatórios")
	}
	planilhaKey := hashPlanilha

	txTime, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return err
	}

	formattedTime := time.Unix(
		txTime.Seconds,
		int64(txTime.Nanos),
	).UTC().Format(time.RFC3339)

	exists, err := c.PlanilhaExists(ctx, planilhaKey)
	if err != nil {
		return err
	}

	var asset LoteRecord

	if exists {
		assetBytes, err := ctx.GetStub().GetState(planilhaKey)
		if err != nil {
			return err
		}
		if assetBytes == nil {
			return fmt.Errorf("falha ao carregar planilha existente %s", hashPlanilha)
		}

		if err := json.Unmarshal(assetBytes, &asset); err != nil {
			return err
		}

		asset.Version++
		asset.LastUpdatedAt = formattedTime

	} else {
		asset = LoteRecord{
			CasseteLot:   casseteLot,
			HashPlanilha: hashPlanilha,
			Timestamp:   formattedTime,
			Version:     0,
			LastUpdatedAt: formattedTime,
		}

		indexKey, err := ctx.GetStub().CreateCompositeKey(
			"lote~planilha",
			[]string{casseteLot, hashPlanilha},
		)
		if err != nil {
			return err
		}

		if err := ctx.GetStub().PutState(indexKey, []byte{0x00}); err != nil {
			return err
		}
	}

	assetBytes, err := json.Marshal(asset)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(planilhaKey, assetBytes)
}

func (c *SmartContract) GetPlanilhasByLote(ctx contractapi.TransactionContextInterface, casseteLot string) ([]*LoteRecord, error) {
	if casseteLot == "" {
		return nil, fmt.Errorf("casseteLot não pode ser vazio")
	}

	iterator, err := ctx.GetStub().GetStateByPartialCompositeKey(
		"lote~planilha",
		[]string{casseteLot},
	)
	if err != nil {
		return nil, err
	}
	defer iterator.Close()

	var results []*LoteRecord

	for iterator.HasNext() {
		response, err := iterator.Next()
		if err != nil {
			return nil, err
		}

		_, parts, err := ctx.GetStub().SplitCompositeKey(response.Key)
		if err != nil {
			return nil, err
		}

		hashPlanilha := parts[1]

		planilha, err := c.GetPlanilhaByHash(ctx, hashPlanilha)
		if err != nil {
			return nil, err
		}

		results = append(results, planilha)
	}

	return results, nil
}

func (c *SmartContract) GetPlanilhaByHash(ctx contractapi.TransactionContextInterface, hashPlanilha string) (*LoteRecord, error) {
	if hashPlanilha == "" {
		return nil, fmt.Errorf("hashPlanilha não pode ser vazio")
	}

	data, err := ctx.GetStub().GetState(hashPlanilha)
	if err != nil {
		return nil, fmt.Errorf("erro ao acessar o ledger: %v", err)
	}
	if data == nil {
		return nil, fmt.Errorf("planilha %s não encontrada", hashPlanilha)
	}

	var asset LoteRecord
	if err := json.Unmarshal(data, &asset); err != nil {
		return nil, fmt.Errorf("erro ao deserializar planilha: %v", err)
	}

	return &asset, nil
}

func (c *SmartContract) PlanilhaExists(ctx contractapi.TransactionContextInterface, planilhaKey string) (bool, error) {
	data, err := ctx.GetStub().GetState(planilhaKey)
	if err != nil {
		return false, err
	}
	return data != nil, nil
}

func (s *SmartContract) StoreModel(ctx contractapi.TransactionContextInterface, modelKey string, modelBase64 string) error {
	if modelKey == "" || modelBase64 == "" {
		return fmt.Errorf("modelKey e modelData nao podem ser vazios")
	}

	switch modelKey {
	case "acao_recomendada", "result_class", "qc_status":
		// ok
	default:
		return fmt.Errorf("modelKey invalido")
	}
	stub := ctx.GetStub()

	existingBytes, err := stub.GetState(modelKey)
	if err != nil {
		return fmt.Errorf("erro ao buscar modelo existente: %v", err)
	}
	version := 1

	if existingBytes != nil {
		var existingModel ModelBytes
		err = json.Unmarshal(existingBytes, &existingModel)
		if err != nil {
			return fmt.Errorf("erro ao decodificar modelo existente: %v", err)
		}
		version = existingModel.Version + 1
	}

	txTime, err := ctx.GetStub().GetTxTimestamp()
    if err != nil {
        return err
    }
    
	model := ModelBytes{
        ModelKey:  modelKey,
        ModelData: modelBase64,
        Version:   version,
        UpdatedAt: time.Unix(
            txTime.Seconds,
            int64(txTime.Nanos),
        ).UTC().Format(time.RFC3339),
    }

	bytes, err := json.Marshal(model)
	if err != nil {
		return err
	}

	return stub.PutState(modelKey, bytes)
}

func (s *SmartContract) getModelBytes(ctx contractapi.TransactionContextInterface, modelKey string) ([]byte, error) {
	data, err := ctx.GetStub().GetState(modelKey)
	if err != nil {
		return nil, err
	}
	if data == nil {
		return nil, fmt.Errorf("modelo %s nao encontrado", modelKey)
	}

	var stored ModelBytes
	if err := json.Unmarshal(data, &stored); err != nil {
		return nil, err
	}

	return base64.StdEncoding.DecodeString(stored.ModelData)
}

func loadID3ModelFromLedger(ctx contractapi.TransactionContextInterface, s *SmartContract, modelKey string) (*trees.ID3DecisionTree, error) {
	bytes, err := s.getModelBytes(ctx, modelKey)
	if err != nil {
		return nil, err
	}

	path := filepath.Join(os.TempDir(), modelKey)
	if err := os.WriteFile(path, bytes, 0600); err != nil {
		return nil, err
	}

	model := trees.NewID3DecisionTree(0.1)
	if err := model.Load(path); err != nil {
		return nil, err
	}

	return model, nil
}

func loadDataset(csvData string) (*base.DenseInstances, error) {
	reader := strings.NewReader(csvData)

	data, err := base.ParseCSVToInstancesFromReader(reader, true)
	if err != nil {
		return nil, fmt.Errorf("erro ao carregar dataset: %v", err)
	}

	return data, nil
}

var baseHeader =
	"lat,lon,expiry_days_left,distance_mm,time_to_migrate_s," +
		"sample_volume_uL,sample_pH,sample_turbidity_NTU,sample_temp_C," +
		"ambient_T_C,ambient_RH_pct,lighting_lux,tilt_deg," +
		"preincubation_time_s,time_since_sampling_min,image_blur_score," +
		"tempo_transporte_horas,estimated_concentration_ppb," +
		"incerteza_estimativa_ppb,control_line_ok,controle_interno_result"

func predictFromCSV(model *trees.ID3DecisionTree, target string, csvRow string) (string, error) {
	header := baseHeader + "," + target
	csv := header + "\n" + csvRow + ",?"

	data, err := loadDataset(csv)
	if err != nil {
		return "", err
	}

	res, err := model.Predict(data)
	if err != nil {
		return "", err
	}

	return res.RowString(0), nil
}

func (s *SmartContract) StoreTest(ctx contractapi.TransactionContextInterface, testID string, jsonStr string, predictStr string) error {
	existing, err := ctx.GetStub().GetState(testID)
	if err != nil {
		return err
	}
	if existing != nil {
		return fmt.Errorf("teste %s ja existe", testID)
	}

	var record TestRecord
	if err := json.Unmarshal([]byte(jsonStr), &record); err != nil {
		return fmt.Errorf("erro ao decodificar JSON: %v", err)
	}

	record.TestID = testID

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

	txTime, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return err
	}

	timestamp := time.Unix(
		txTime.Seconds,
		int64(txTime.Nanos),
	).UTC().Format(time.RFC3339)

	record.Version = 0
	record.CreatedAt = timestamp
	record.LastUpdatedAt = timestamp

	bytes, err := json.Marshal(record)
	if err != nil {
		return err
	}

	if err := ctx.GetStub().PutState(testID, bytes); err != nil {
		return err
	}

	indexKey, err := ctx.GetStub().CreateCompositeKey(
		"lote~teste",
		[]string{record.CassetteLot, testID},
	)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(indexKey, []byte{0x00})
}

func (s *SmartContract) GetTestByID(ctx contractapi.TransactionContextInterface, testID string,) (*TestRecord, error) {
	if testID == "" {
		return nil, fmt.Errorf("testID não pode ser vazio")
	}

	data, err := ctx.GetStub().GetState(testID)
	if err != nil {
		return nil, err
	}
	if data == nil {
		return nil, fmt.Errorf("teste %s não encontrado", testID)
	}

	var record TestRecord
	if err := json.Unmarshal(data, &record); err != nil {
		return nil, err
	}

	return &record, nil
}

func (s *SmartContract) GetTestsByLote(ctx contractapi.TransactionContextInterface, cassetteLot string) ([]*TestRecord, error) {
	if cassetteLot == "" {
		return nil, fmt.Errorf("cassetteLot não pode ser vazio")
	}

	iterator, err := ctx.GetStub().GetStateByPartialCompositeKey(
		"lote~teste",
		[]string{cassetteLot},
	)
	if err != nil {
		return nil, err
	}
	defer iterator.Close()

	var results []*TestRecord

	for iterator.HasNext() {
		response, err := iterator.Next()
		if err != nil {
			return nil, err
		}

		_, parts, err := ctx.GetStub().SplitCompositeKey(response.Key)
		if err != nil {
			return nil, err
		}

		testID := parts[1]

		test, err := s.GetTestByID(ctx, testID)
		if err != nil {
			return nil, err
		}

		results = append(results, test)
	}

	return results, nil
}

func (s *SmartContract) UpdateTest(ctx contractapi.TransactionContextInterface, testID string, fullJSON string) error {
	existingBytes, err := ctx.GetStub().GetState(testID)
	if err != nil {
		return err
	}
	if existingBytes == nil {
		return fmt.Errorf("teste %s nao encontrado", testID)
	}

	var existing TestRecord
	if err := json.Unmarshal(existingBytes, &existing); err != nil {
		return err
	}

	var updated TestRecord
	if err := json.Unmarshal([]byte(fullJSON), &updated); err != nil {
		return fmt.Errorf("json invalido: %v", err)
	}

	txTime, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return err
	}

	now := time.Unix(
		txTime.Seconds,
		int64(txTime.Nanos),
	).UTC().Format(time.RFC3339)

	updated.TestID = testID
	updated.Version = existing.Version + 1
	updated.CreatedAt = existing.CreatedAt
	updated.LastUpdatedAt = now

	if existing.CassetteLot != updated.CassetteLot {
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

	bytes, err := json.Marshal(updated)
	if err != nil {
		return err
	}

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