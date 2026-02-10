// train_original_salvar.go
package main

import (
    "fmt"
    "log"
    "os"
    "strings"
    
    "github.com/sjwhitworth/golearn/base"
    "github.com/sjwhitworth/golearn/evaluation"
    "github.com/sjwhitworth/golearn/trees"
)

func loadDataset(csvData string) (*base.DenseInstances, error) {
    reader := strings.NewReader(csvData)
    
    data, err := base.ParseCSVToInstancesFromReader(reader, true)
    if err != nil {
        return nil, fmt.Errorf("erro ao carregar dataset: %v", err)
    }
    
    return data, nil
}

// SEU CÓDIGO ORIGINAL EXATO
func trainModel(csvData string) (*trees.ID3DecisionTree, error) {
    data, err := loadDataset(csvData)
    if err != nil {
        return nil, err
    }
    
    trainData, testData := base.InstancesTrainTestSplit(data, 0.7)
    
    model := trees.NewID3DecisionTree(0.1)
    err = model.Fit(trainData)
    if err != nil {
        return nil, fmt.Errorf("erro ao treinar modelo: %v", err)
    }
    
    predictions, err := model.Predict(testData)
    if err != nil {
        return nil, fmt.Errorf("erro ao fazer previsões: %v", err)
    }
    
    confMat, err := evaluation.GetConfusionMatrix(testData, predictions)
    if err != nil {
        return nil, fmt.Errorf("erro ao calcular matriz de confusão: %v", err)
    }
    
    accuracy := evaluation.GetAccuracy(confMat)
    fmt.Printf("Acurácia do modelo: %.2f%%\n", accuracy*100)
    
    return model, nil
}

func main() {
    if len(os.Args) != 3 {
        log.Fatal("Uso: go run train_original_salvar.go <caminho_do_csv> <modelo_output.gob>")
    }
    
    csvFile := os.Args[1]
    modelFile := os.Args[2]
    
    // Ler arquivo como string (igual seu código original)
    content, err := os.ReadFile(csvFile)
    if err != nil {
        log.Fatal(err)
    }
    
    csvData := string(content)
    
    // Chamar SUA função original
    model, err := trainModel(csvData)
    if err != nil {
        log.Fatalf("Erro no treinamento: %v", err)
    }
    
    // Apenas adicionar o Save()
    err = model.Save(modelFile)
    if err != nil {
        log.Fatalf("Erro ao salvar modelo: %v", err)
    }
    
    fmt.Printf("Modelo salvo com sucesso em: %s\n", modelFile)
}