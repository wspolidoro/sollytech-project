package main

import (
	"encoding/csv"
	"fmt"
	"html/template"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/sjwhitworth/golearn/base"
	"github.com/sjwhitworth/golearn/evaluation"
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
*/
type ModelResult struct {
	ModelName string
	Accuracy  float64
	Labels    []string
	Matrix    [][]int
	Metrics   []ClassMetrics
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

/*
ModelTrainer abstrai a definição de um algoritmo de treinamento.

Permite registrar múltiplos modelos de forma genérica através de uma função
de treinamento associada ao nome do modelo.
*/
type ModelTrainer struct {
	Name  string
	Train func(base.FixedDataGrid) (base.Classifier, error)
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
armazena no servidor e extrai os nomes das colunas
para permitir a escolha da variável target.
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

	// Estrutura enviada ao template.
	data := struct {
		CSVName string
		Columns []string
	}{
		filename,
		headers,
	}

	templates.ExecuteTemplate(w, "target.html", data)
}

/*
trainModel executa todo o pipeline de treinamento de modelos.

Fluxo:
1. Recebe parâmetros do formulário.
2. Carrega dataset.
3. Define variável target.
4. Divide dados em treino e teste.
5. Treina múltiplos modelos.
6. Avalia desempenho.
7. Salva modelos.
8. Renderiza página de resultados.
*/
func trainModel(w http.ResponseWriter, r *http.Request) {

	csvName := r.FormValue("csv")
	target := r.FormValue("target")

	log.Println("CSV:", csvName)
	log.Println("Target:", target)

	csvPath := filepath.Join("uploads", csvName)

	// Conversão do CSV em estrutura de instâncias do GoLearn.
	data, err := base.ParseCSVToInstances(csvPath, true)
	if err != nil {
		http.Error(w, "Erro ao carregar CSV", http.StatusInternalServerError)
		return
	}

	// Definição do atributo de classe.
	var found bool
	for _, attr := range data.AllAttributes() {
		if attr.GetName() == target {
			data.AddClassAttribute(attr)
			found = true
			break
		}
	}

	if !found {
		http.Error(w, "Coluna target não encontrada", http.StatusBadRequest)
		return
	}

	// Divisão em conjunto de treino e teste.
	trainData, testData := base.InstancesTrainTestSplit(data, 0.7)

	// Cálculo do número de atributos preditores.
	numAttrs := len(trainData.AllAttributes()) - 1
	if numAttrs < 1 {
		numAttrs = 1
	}

	log.Println("Número de atributos:", numAttrs)

	/*
		Definição dos modelos que serão treinados.
		A estrutura permite fácil extensão para novos algoritmos.
	*/
	models := []ModelTrainer{
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
	}

	var results []ModelResult

	// Treinamento iterativo dos modelos.
	for _, trainer := range models {

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
		modelFile := fmt.Sprintf(
			"%s_%s.model",
			strings.TrimSuffix(csvName, ".csv"),
			strings.ReplaceAll(trainer.Name, " ", "_"),
		)

		// Persistência do modelo treinado.
		model.Save(filepath.Join("models", modelFile))

		results = append(results, ModelResult{
			ModelName: trainer.Name,
			Accuracy:  accuracy,
			Labels:    labels,
			Matrix:    matrix,
			Metrics:   metrics,
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

/*
getCSVHeaders lê apenas a primeira linha do CSV,
retornando os nomes das colunas.
*/
func getCSVHeaders(path string) ([]string, error) {

	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	reader := csv.NewReader(f)
	return reader.Read()
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
