package main

import (
	"bufio"
	"encoding/csv"
	"fmt"
	"html/template"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/sjwhitworth/golearn/base"
	"github.com/sjwhitworth/golearn/evaluation"
	"github.com/sjwhitworth/golearn/knn"
	"github.com/sjwhitworth/golearn/trees"
)

/*
Carregamento global dos templates HTML.

O template.ParseGlob realiza o parsing de todos os arquivos HTML
presentes no diretório "templates". O uso de template.Must garante
que a aplicação será interrompida imediatamente caso ocorra erro
no carregamento dos templates, evitando execução em estado inválido.
*/
var templates = template.Must(template.ParseGlob("templates/*.html"))

/*
ClassMetrics representa as métricas de avaliação para uma classe específica
em um problema de classificação.

Campos:
- Class: nome da classe.
- Precision: precisão (TP / (TP + FP)).
- Recall: sensibilidade (TP / (TP + FN)).
- F1: média harmônica entre precisão e recall.
- TP: verdadeiros positivos.
- FP: falsos positivos.
- FN: falsos negativos.
*/
type ClassMetrics struct {
	Class     string
	Precision float64
	Recall    float64
	F1        float64
	TP        int
	FP        int
	FN        int
}

/*
ModelResult encapsula o resultado completo de treinamento e avaliação
de um modelo de machine learning.

Campos:
- ModelName: nome do algoritmo treinado.
- Accuracy: acurácia global do modelo.
- Labels: lista ordenada das classes.
- Matrix: matriz de confusão em formato bidimensional.
- Metrics: métricas detalhadas por classe.
- ModelFile: nome do arquivo do modelo salvo.
*/
type ModelResult struct {
	ModelName string
	Accuracy  float64
	Labels    []string
	Matrix    [][]int
	Metrics   []ClassMetrics
	ModelFile string
}

/*
ResultPage representa o objeto enviado ao template HTML da página de resultados.

Campos:
- Results: lista de resultados de modelos treinados.
- Error: mensagem de erro caso nenhum modelo seja treinado com sucesso.
*/
type ResultPage struct {
	Results []ModelResult
	Error   string
}

// Adicione/atualize estas structs no início do arquivo

/*
TargetPage representa o objeto enviado ao template HTML da página de configuração.

Campos:
- CSVName: nome do arquivo CSV carregado.
- Columns: lista de colunas do CSV.
- Models: lista de modelos disponíveis para seleção.
*/
type TargetPage struct {
	CSVName string
	Columns []string
	Models  []ModelOption
}

/*
TrainConfig representa a configuração completa para treinamento.
*/
type TrainConfig struct {
	CSVName        string
	Features       []string
	TargetColumns  []string
	PredictTarget  string
	SelectedModels []string
}

/*
ModelOption representa uma opção de modelo na interface.

Campos:
- Name: nome do modelo.
- ID: identificador único para o checkbox.
- Checked: se o modelo vem selecionado por padrão.
- HasConfig: se o modelo tem configurações adicionais.
*/
type ModelOption struct {
	Name      string
	ID        string
	Checked   bool
	HasConfig bool
}

/*
ModelTrainer abstrai a definição de um algoritmo de treinamento.

Permite registrar múltiplos modelos de forma genérica através de uma função
de treinamento associada ao nome do modelo.
*/
type ModelTrainer struct {
	Name       string
	Train      func(base.FixedDataGrid) (base.Classifier, error)
	HasConfig  bool
	ConfigHTML string
}

/*
Função principal da aplicação.

Responsabilidades:
- Criar diretórios necessários.
- Registrar rotas HTTP.
- Servir arquivos estáticos.
- Inicializar o servidor web.
*/
func main() {

	// Criação dos diretórios para armazenamento de uploads e modelos treinados.
	os.MkdirAll("uploads", 0755)
	os.MkdirAll("models", 0755)

	// Registro das rotas HTTP.
	http.HandleFunc("/", uploadPage)
	http.HandleFunc("/upload", uploadCSV)
	http.HandleFunc("/train", trainModel)
	http.HandleFunc("/download", downloadModel)

	// Servidor de arquivos estáticos (CSS, JS, imagens).
	http.Handle("/static/", http.StripPrefix("/static/",
		http.FileServer(http.Dir("static"))))

	log.Println("Servidor em http://localhost:8080")

	// Inicialização do servidor HTTP.
	log.Fatal(http.ListenAndServe(":8080", nil))
}

/*
uploadPage renderiza a página inicial de upload de CSV.
*/
func uploadPage(w http.ResponseWriter, r *http.Request) {
	templates.ExecuteTemplate(w, "index.html", nil)
}

/*
uploadCSV recebe o arquivo CSV enviado pelo usuário,
armazena no servidor e extrai os nomes das colunas.
*/
func uploadCSV(w http.ResponseWriter, r *http.Request) {

	// Recuperação do arquivo enviado via formulário.
	file, header, err := r.FormFile("csvfile")
	if err != nil {
		http.Error(w, "Erro ao receber CSV", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Geração de nome único para evitar colisões.
	filename := fmt.Sprintf("%d_%s", time.Now().Unix(), header.Filename)
	path := filepath.Join("uploads", filename)

	// Salvamento do arquivo no sistema.
	out, _ := os.Create(path)
	io.Copy(out, file)
	out.Close()

	// Extração dos cabeçalhos do CSV.
	headers, err := getCSVHeaders(path)
	if err != nil {
		http.Error(w, "Erro ao ler CSV", http.StatusInternalServerError)
		return
	}

	// Lista de modelos disponíveis (mantida aqui)
	models := []ModelOption{
		{Name: "ID3 Decision Tree", ID: "model_id3", Checked: true, HasConfig: false},
		{Name: "Random Tree", ID: "model_random", Checked: false, HasConfig: false},
		{Name: "KNN (Manhattan, k=7)", ID: "model_knn_manhattan_7", Checked: true, HasConfig: true},
		{Name: "KNN (Manhattan, k=5)", ID: "model_knn_manhattan_5", Checked: false, HasConfig: true},
		{Name: "KNN (Manhattan, k=9)", ID: "model_knn_manhattan_9", Checked: false, HasConfig: true},
		{Name: "KNN (Euclidean, k=7)", ID: "model_knn_euclidean_7", Checked: false, HasConfig: true},
	}

	// Estrutura enviada ao template.
	data := TargetPage{
		CSVName: filename,
		Columns: headers,
		Models:  models,
	}

	templates.ExecuteTemplate(w, "target.html", data)
}

/*
trainModel executa todo o pipeline de treinamento de modelos.

Fluxo:
1. Recebe parâmetros do formulário.
2. Carrega dataset.
3. Filtra features e targets.
4. Codifica variáveis categóricas em números.
5. Define variável target para predição.
6. Divide dados em treino e teste.
7. Treina múltiplos modelos.
8. Avalia desempenho.
9. Salva modelos.
10. Renderiza página de resultados.
*/
func trainModel(w http.ResponseWriter, r *http.Request) {

	// Parse do formulário
	err := r.ParseForm()
	if err != nil {
		http.Error(w, "Erro ao processar formulário", http.StatusBadRequest)
		return
	}

	csvName := r.FormValue("csv")
	features := r.Form["features"]                 // Colunas selecionadas como features
	targetColumns := r.Form["target_columns"]      // Todas as colunas target
	predictTarget := r.FormValue("predict_target") // Coluna target para predição
	selectedModels := r.Form["models"]             // Modelos selecionados

	// Validações
	if len(features) == 0 {
		http.Error(w, "Selecione pelo menos uma feature", http.StatusBadRequest)
		return
	}
	if len(targetColumns) == 0 {
		http.Error(w, "Selecione pelo menos uma coluna target", http.StatusBadRequest)
		return
	}
	if predictTarget == "" {
		http.Error(w, "Selecione qual target deseja prever", http.StatusBadRequest)
		return
	}

	// Verifica se o target de predição está na lista de targets
	targetValid := false
	for _, target := range targetColumns {
		if target == predictTarget {
			targetValid = true
			break
		}
	}
	if !targetValid {
		http.Error(w, "O target para predição deve estar entre as colunas target selecionadas", http.StatusBadRequest)
		return
	}

	log.Println("CSV:", csvName)
	log.Println("Features:", features)
	log.Println("Target Columns:", targetColumns)
	log.Println("Predict Target:", predictTarget)
	log.Println("Modelos selecionados:", selectedModels)

	csvPath := filepath.Join("uploads", csvName)

	// CONVERSÃO DO CSV - AGORA COM DETECÇÃO DE SEPARADOR, CONVERSÃO DE VÍRGULAS DECIMAIS E CODIFICAÇÃO CATEGÓRICA

	// Abre o arquivo CSV original
	originalFile, err := os.Open(csvPath)
	if err != nil {
		http.Error(w, "Erro ao abrir CSV original", http.StatusInternalServerError)
		return
	}
	defer originalFile.Close()

	// Detecta o separador do arquivo original
	reader := bufio.NewReader(originalFile)
	firstLine, err := reader.ReadString('\n')
	if err != nil {
		http.Error(w, "Erro ao ler CSV original", http.StatusInternalServerError)
		return
	}

	// Define o separador baseado na primeira linha
	var separator rune
	if strings.Contains(firstLine, ";") {
		separator = ';'
		log.Println("Separador detectado: ponto e vírgula (;)")
	} else {
		separator = ','
		log.Println("Separador detectado: vírgula (,)")
	}

	// Volta ao início do arquivo
	originalFile.Seek(0, 0)

	// Cria um leitor CSV com o separador correto
	csvReader := csv.NewReader(originalFile)
	csvReader.Comma = separator
	csvReader.LazyQuotes = true
	csvReader.TrimLeadingSpace = true

	// Lê o cabeçalho
	header, err := csvReader.Read()
	if err != nil {
		http.Error(w, "Erro ao ler cabeçalho do CSV", http.StatusInternalServerError)
		return
	}

	// CRÍTICO: Remove as colunas target (exceto o target de predição) das features
	// Isso evita data leakage
	cleanFeatures := make([]string, 0)
	for _, feat := range features {
		// Se a feature é uma coluna target MAS NÃO É o target de predição, NÃO incluir
		isTarget := false
		for _, target := range targetColumns {
			if feat == target && feat != predictTarget {
				isTarget = true
				log.Printf("Removendo target '%s' das features (data leakage prevention)", feat)
				break
			}
		}
		if !isTarget {
			cleanFeatures = append(cleanFeatures, feat)
		}
	}

	// Cria um mapa das colunas a manter (cleanFeatures + target de predição)
	keepSet := make(map[string]bool)
	for _, feat := range cleanFeatures {
		keepSet[feat] = true
	}
	keepSet[predictTarget] = true

	// Mapeia índices das colunas a manter
	indicesToKeep := []int{}
	newHeader := []string{}
	for i, colName := range header {
		if keepSet[colName] {
			indicesToKeep = append(indicesToKeep, i)
			newHeader = append(newHeader, colName)
		}
	}

	// Cria um arquivo temporário para o CSV filtrado (sempre com vírgula como separador)
	tempCSV, err := os.CreateTemp("uploads", "temp_*.csv")
	if err != nil {
		http.Error(w, "Erro ao criar arquivo temporário", http.StatusInternalServerError)
		return
	}
	tempPath := tempCSV.Name()
	defer tempCSV.Close()
	defer os.Remove(tempPath) // Limpa o arquivo temporário depois

	// Cria um escritor CSV com vírgula como separador (formato que o GoLearn espera)
	csvWriter := csv.NewWriter(tempCSV)
	csvWriter.Comma = ',' // Força vírgula como separador na saída
	defer csvWriter.Flush()

	// Escreve o novo cabeçalho
	if err := csvWriter.Write(newHeader); err != nil {
		http.Error(w, "Erro ao escrever cabeçalho", http.StatusInternalServerError)
		return
	}

	// MAPAS PARA CODIFICAÇÃO DE VARIÁVEIS CATEGÓRICAS
	// Vamos criar um mapa para cada coluna categórica que queremos codificar
	categoricalMaps := make(map[string]map[string]int)

	// Lista de colunas categóricas que queremos codificar
	// Baseado no seu dataset, estas são colunas com valores textuais fixos
	categoricalColumns := map[string]bool{
		"control_line_ok":         true,  // TRUE/FALSE
		"storage_condition":       true,  // ambiente, refrigerado, térmico, protegido
		"prefilter_used":          true,  // TRUE/FALSE
		"image_taken":             true,  // TRUE/FALSE
		"controle_interno_result": true,  // ok, falha_controle_negativo, falha_controle_positivo
		"cadeia_frio_status":      true,  // TRUE/FALSE
		"condicao_transporte":     true,  // refrigerado, ambiente, protegido
		"acao_recomendada":        false, // retestar_e_confirmar_amostragem, liberar, bloquear_lote_e_confirmar_laboratorio, retestar
		"result_class":            false, // negative, positive, invalid
		"qc_status":               false, // ok, warn, fail
		"matrix_type":             true,  // efluente, agua, extrato_foliar, extrato_solo, calda
		"operator_id":             true,  // OP01, OP02, etc.
		"produto_id":              true,  // SOJA_GRÃO, HORTI_TOMATE, CAFÉ_ARABICA, etc.
		"kit_calibration_id":      true,  // CAL1001, CAL1002, etc.
		"device_fw_version":       true,  // 1.0.3, 1.1.0, etc.
		"geo_hash":                true,  // 75cmbj, 75cmbq, etc.
	}

	// Inicializa os mapas para cada coluna categórica
	for colName := range categoricalColumns {
		categoricalMaps[colName] = make(map[string]int)
	}

	// Primeiro, vamos ler todo o arquivo para construir os mapas de codificação
	// Precisamos resetar o leitor
	originalFile.Seek(0, 0)
	csvReader = csv.NewReader(originalFile)
	csvReader.Comma = separator
	csvReader.LazyQuotes = true
	csvReader.TrimLeadingSpace = true

	// Pula o cabeçalho
	_, err = csvReader.Read()
	if err != nil {
		http.Error(w, "Erro ao ler cabeçalho", http.StatusInternalServerError)
		return
	}

	// Primeira passagem: constrói os mapas de codificação
	for {
		record, err := csvReader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			http.Error(w, "Erro ao ler linha do CSV para codificação", http.StatusInternalServerError)
			return
		}

		// Para cada coluna que estamos mantendo
		for j, idx := range indicesToKeep {
			colName := newHeader[j]

			// Se é uma coluna categórica, adiciona ao mapa
			if categoricalColumns[colName] {
				value := record[idx]
				value = strings.TrimSpace(value)

				// Se o valor não está no mapa, adiciona com um novo ID
				if _, exists := categoricalMaps[colName][value]; !exists && value != "" {
					categoricalMaps[colName][value] = len(categoricalMaps[colName])
				}
			}
		}
	}

	// Log dos mapas criados
	for colName, mapping := range categoricalMaps {
		log.Printf("Coluna categórica '%s' mapeada: %d valores únicos", colName, len(mapping))
		for valor, codigo := range mapping {
			log.Printf("  %s -> %d", valor, codigo)
		}
	}

	// Segunda passagem: processa as linhas e aplica a codificação
	// Reseta o leitor novamente
	originalFile.Seek(0, 0)
	csvReader = csv.NewReader(originalFile)
	csvReader.Comma = separator
	csvReader.LazyQuotes = true
	csvReader.TrimLeadingSpace = true

	// Pula o cabeçalho
	_, err = csvReader.Read()
	if err != nil {
		http.Error(w, "Erro ao ler cabeçalho", http.StatusInternalServerError)
		return
	}

	// Processa cada linha do arquivo original
	lineCount := 0
	for {
		record, err := csvReader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			http.Error(w, "Erro ao ler linha do CSV", http.StatusInternalServerError)
			return
		}
		lineCount++

		// Cria nova linha apenas com as colunas selecionadas
		newRecord := make([]string, len(indicesToKeep))
		for j, idx := range indicesToKeep {
			colName := newHeader[j]
			value := record[idx]
			value = strings.TrimSpace(value)

			// Se é uma coluna categórica, aplica a codificação
			if categoricalColumns[colName] {
				if code, exists := categoricalMaps[colName][value]; exists {
					// Converte para string (o GoLearn espera string)
					newRecord[j] = fmt.Sprintf("%d", code)
					log.Printf("Linha %d - Codificando '%s': '%s' -> %d", lineCount, colName, value, code)
				} else {
					// Valor não encontrado no mapa (provavelmente vazio)
					newRecord[j] = "-1" // Código para valor desconhecido
				}
			} else {
				// Coluna numérica - faz a conversão de vírgula decimal
				if strings.Contains(value, ",") && !strings.Contains(value, ";") {
					// Verifica se é um número (formato brasileiro)
					// Remove espaços
					value = strings.TrimSpace(value)

					// Se tiver padrão como "1.234,56", remove os pontos primeiro
					if strings.Contains(value, ".") && strings.Contains(value, ",") {
						value = strings.ReplaceAll(value, ".", "")
					}

					// Converte a vírgula decimal para ponto
					value = strings.Replace(value, ",", ".", 1)
				}
				newRecord[j] = value
			}
		}

		if err := csvWriter.Write(newRecord); err != nil {
			http.Error(w, "Erro ao escrever linha", http.StatusInternalServerError)
			return
		}
	}

	csvWriter.Flush()
	tempCSV.Close()

	log.Printf("Arquivo temporário criado com %d linhas e valores convertidos: %s", lineCount, tempPath)

	// Agora carrega o CSV filtrado usando o GoLearn
	data, err := base.ParseCSVToInstances(tempPath, true)
	if err != nil {
		http.Error(w, "Erro ao carregar dados filtrados: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Verifica se o target de predição está presente
	var found bool
	for _, attr := range data.AllAttributes() {
		if attr.GetName() == predictTarget {
			data.AddClassAttribute(attr)
			found = true
			log.Printf("Target '%s' configurado como classe", predictTarget)
			break
		}
	}

	if !found {
		http.Error(w, "Target para predição não encontrado após filtro", http.StatusBadRequest)
		return
	}

	// Mostra informações sobre os atributos
	log.Println("Atributos no dataset filtrado:")
	for _, attr := range data.AllAttributes() {
		isClass := false
		for _, classAttr := range data.AllClassAttributes() {
			if attr == classAttr {
				isClass = true
				break
			}
		}
		if isClass {
			log.Printf("  - %s (CLASSE)", attr.GetName())
		} else {
			log.Printf("  - %s (feature)", attr.GetName())
		}
	}

	// Divisão em conjunto de treino e teste.
	trainData, testData := base.InstancesTrainTestSplit(data, 0.7)

	// Cálculo do número de atributos preditores.
	numAttrs := len(trainData.AllAttributes()) - 1
	if numAttrs < 1 {
		numAttrs = 1
	}

	log.Println("Número de atributos preditores:", numAttrs)

	// Definição dos modelos que serão treinados.
	allModels := []ModelTrainer{
		{
			Name: "ID3 Decision Tree",
			Train: func(train base.FixedDataGrid) (base.Classifier, error) {
				m := trees.NewID3DecisionTree(0.1)
				err := m.Fit(train)
				return m, err
			},
		},
		{
			Name: "Random Tree",
			Train: func(train base.FixedDataGrid) (base.Classifier, error) {

				// Seleção segura do número de atributos aleatórios.
				features := int(float64(numAttrs) / 2)
				if features < 1 {
					features = 1
				}

				m := trees.NewRandomTree(features)
				err := m.Fit(train)
				return m, err
			},
		},
		{
			Name: "KNN (Manhattan, k=5)",
			Train: func(train base.FixedDataGrid) (base.Classifier, error) {
				m := knn.NewKnnClassifier("manhattan", "linear", 5)
				err := m.Fit(train)
				return m, err
			},
		},
		{
			Name: "KNN (Manhattan, k=7)",
			Train: func(train base.FixedDataGrid) (base.Classifier, error) {
				m := knn.NewKnnClassifier("manhattan", "linear", 7)
				err := m.Fit(train)
				return m, err
			},
		},
		{
			Name: "KNN (Manhattan, k=9)",
			Train: func(train base.FixedDataGrid) (base.Classifier, error) {
				m := knn.NewKnnClassifier("manhattan", "linear", 9)
				err := m.Fit(train)
				return m, err
			},
		},
		{
			Name: "KNN (Euclidean, k=7)",
			Train: func(train base.FixedDataGrid) (base.Classifier, error) {
				m := knn.NewKnnClassifier("euclidean", "linear", 7)
				err := m.Fit(train)
				return m, err
			},
		},
	}

	// Mapeamento de IDs para nomes de modelos
	modelIDToName := map[string]string{
		"model_id3":             "ID3 Decision Tree",
		"model_random":          "Random Tree",
		"model_knn_manhattan_5": "KNN (Manhattan, k=5)",
		"model_knn_manhattan_7": "KNN (Manhattan, k=7)",
		"model_knn_manhattan_9": "KNN (Manhattan, k=9)",
		"model_knn_euclidean_7": "KNN (Euclidean, k=7)",
	}

	// Filtra apenas os modelos selecionados
	var modelsToTrain []ModelTrainer
	for _, trainer := range allModels {
		for _, selectedID := range selectedModels {
			if modelName, exists := modelIDToName[selectedID]; exists && modelName == trainer.Name {
				modelsToTrain = append(modelsToTrain, trainer)
				break
			}
		}
	}

	var results []ModelResult

	// Treinamento iterativo dos modelos.
	for _, trainer := range modelsToTrain {

		log.Println("Treinando:", trainer.Name)

		model, err := safeTrain(trainer, trainData)
		if err != nil {
			log.Println("Erro treino:", err)
			continue
		}

		// Geração de previsões no conjunto de teste.
		predictions, err := model.Predict(testData)
		if err != nil {
			log.Println("Erro previsão:", err)
			continue
		}

		// Construção da matriz de confusão.
		confusion, err := evaluation.GetConfusionMatrix(testData, predictions)
		if err != nil {
			log.Println("Erro matriz:", err)
			continue
		}

		labels, matrix := buildMatrix(confusion)
		metrics, accuracy := computeMetrics(confusion, labels)

		// Nome do arquivo de modelo salvo.
		modelNameSafe := strings.ReplaceAll(strings.ReplaceAll(trainer.Name, " ", "_"), ",", "")
		modelNameSafe = strings.ReplaceAll(modelNameSafe, "(", "")
		modelNameSafe = strings.ReplaceAll(modelNameSafe, ")", "")
		modelNameSafe = strings.ReplaceAll(modelNameSafe, "=", "")

		modelFile := fmt.Sprintf(
			"%s_%s.model",
			strings.TrimSuffix(csvName, ".csv"),
			modelNameSafe,
		)

		modelPath := filepath.Join("models", modelFile)

		// Persistência do modelo treinado
		err = model.Save(modelPath)
		if err != nil {
			log.Println("Erro ao salvar modelo:", err)
		}

		results = append(results, ModelResult{
			ModelName: trainer.Name,
			Accuracy:  accuracy,
			Labels:    labels,
			Matrix:    matrix,
			Metrics:   metrics,
			ModelFile: modelFile,
		})
	}

	page := ResultPage{
		Results: results,
	}

	if len(results) == 0 {
		page.Error = "Nenhum modelo conseguiu treinar. Verifique seu CSV."
	}

	templates.ExecuteTemplate(w, "result.html", page)
}

/*
downloadModel serve o arquivo do modelo para download.
*/
func downloadModel(w http.ResponseWriter, r *http.Request) {
	modelFile := r.URL.Query().Get("file")
	if modelFile == "" {
		http.Error(w, "Arquivo não especificado", http.StatusBadRequest)
		return
	}

	// Previne path traversal
	modelFile = filepath.Base(modelFile)
	modelPath := filepath.Join("models", modelFile)

	// Verifica se o arquivo existe
	if _, err := os.Stat(modelPath); os.IsNotExist(err) {
		http.Error(w, "Arquivo não encontrado", http.StatusNotFound)
		return
	}

	// Configura headers para download
	w.Header().Set("Content-Disposition", "attachment; filename="+modelFile)
	w.Header().Set("Content-Type", "application/octet-stream")
	http.ServeFile(w, r, modelPath)
}

/*
safeTrain executa o treinamento de forma protegida contra panics.

Isso evita que falhas internas de bibliotecas interrompam
a execução de toda a aplicação.
*/
func safeTrain(trainer ModelTrainer, train base.FixedDataGrid) (model base.Classifier, err error) {

	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("panic no modelo: %v", r)
		}
	}()

	return trainer.Train(train)
}

/*
buildMatrix converte a matriz de confusão do GoLearn
em uma representação estruturada com labels ordenados.
*/
func buildMatrix(confusion map[string]map[string]int) ([]string, [][]int) {

	labelSet := make(map[string]bool)

	for real, preds := range confusion {
		labelSet[real] = true
		for pred := range preds {
			labelSet[pred] = true
		}
	}

	labels := make([]string, 0, len(labelSet))
	for l := range labelSet {
		labels = append(labels, l)
	}
	sort.Strings(labels)

	matrix := make([][]int, len(labels))

	for i, real := range labels {
		matrix[i] = make([]int, len(labels))
		for j, pred := range labels {
			if confusion[real] != nil {
				matrix[i][j] = confusion[real][pred]
			}
		}
	}

	return labels, matrix
}

/*
computeMetrics calcula métricas de classificação para cada classe
e a acurácia global do modelo.
*/
func computeMetrics(confusion map[string]map[string]int, labels []string) ([]ClassMetrics, float64) {

	total := 0
	correct := 0

	var metrics []ClassMetrics

	for _, classe := range labels {

		tp := confusion[classe][classe]

		fp := 0
		for _, outra := range labels {
			if outra != classe {
				fp += confusion[outra][classe]
			}
		}

		fn := 0
		for _, outra := range labels {
			if outra != classe {
				fn += confusion[classe][outra]
			}
		}

		precision := safeDiv(float64(tp), float64(tp+fp))
		recall := safeDiv(float64(tp), float64(tp+fn))
		f1 := safeDiv(2*precision*recall, precision+recall)

		metrics = append(metrics, ClassMetrics{
			Class:     classe,
			Precision: precision,
			Recall:    recall,
			F1:        f1,
			TP:        tp,
			FP:        fp,
			FN:        fn,
		})
	}

	for r, preds := range confusion {
		for p, c := range preds {
			total += c
			if r == p {
				correct += c
			}
		}
	}

	accuracy := safeDiv(float64(correct), float64(total))

	return metrics, accuracy
}

// Versão corrigida - detecta automaticamente o separador igual ao trainModel
func getCSVHeaders(path string) ([]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	// Lê a primeira linha para detectar o separador
	reader := bufio.NewReader(f)
	firstLine, err := reader.ReadString('\n')
	if err != nil {
		return nil, err
	}

	// Detecta o separador baseado na primeira linha
	var separator rune
	if strings.Contains(firstLine, ";") {
		separator = ';'
	} else {
		separator = ','
	}

	// Volta ao início do arquivo
	f.Seek(0, 0)

	// Cria um leitor CSV com o separador detectado
	csvReader := csv.NewReader(f)
	csvReader.Comma = separator
	csvReader.LazyQuotes = true
	csvReader.TrimLeadingSpace = true

	return csvReader.Read()
}

/*
safeDiv executa divisão protegida contra divisão por zero.
*/
func safeDiv(a, b float64) float64 {
	if b == 0 {
		return 0
	}
	return a / b
}

/*
parseKNNConfig parseia a string de configuração do KNN.
Formato esperado: "knn_{distance}_k{value}"
Exemplo: "knn_manhattan_k7"
*/
func parseKNNConfig(config string) (distance string, k int, err error) {
	parts := strings.Split(config, "_")
	if len(parts) != 3 {
		return "", 0, fmt.Errorf("formato inválido: %s", config)
	}

	distance = parts[1]

	// Extrai o valor de k (formato: "k7" -> 7)
	kStr := strings.TrimPrefix(parts[2], "k")
	k, err = strconv.Atoi(kStr)
	if err != nil {
		return "", 0, fmt.Errorf("valor de k inválido: %s", kStr)
	}

	return distance, k, nil
}
