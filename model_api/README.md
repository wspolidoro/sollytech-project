# ML Web Trainer with GoLearn

Aplicação web em Go para **treinar modelos de Machine Learning a partir de arquivos CSV**, permitindo que o usuário escolha a **coluna target diretamente pelo frontend** e faça o **download do modelo treinado**.

O projeto utiliza a biblioteca **GoLearn** e o algoritmo **ID3 Decision Tree**.

---

## 🚀 Funcionalidades

* Upload de arquivo CSV via navegador
* Listagem automática das colunas do CSV
* Escolha da coluna **target** no frontend
* Treinamento do modelo ID3
* Download do modelo treinado (`.model`)
* Interface web simples e estilizada

---

## 🧠 Tecnologias utilizadas

* Go (Golang)
* net/http (servidor web)
* GoLearn (`github.com/sjwhitworth/golearn`)
* HTML + CSS

---

## 📁 Estrutura do projeto

```
ml-web/
│
├── main.go
├── templates/
│   └── index.html
├── static/
│   └── style.css
├── uploads/
├── models/
└── go.mod
```

---

## ▶️ Como executar

### 1. Clonar o repositório

```bash
git clone https://github.com/seu-usuario/ml-web.git
cd ml-web
```

### 2. Inicializar o módulo Go

```bash
go mod init ml-web
go get github.com/sjwhitworth/golearn
```

### 3. Executar o servidor

```bash
go run main.go
```

### 4. Acessar no navegador

```
http://localhost:8080
```

---

## 📊 Formato esperado do CSV

* Deve conter **cabeçalho**
* As colunas devem ser categóricas ou discretizadas
* A coluna escolhida como *target* será usada como variável de saída

Exemplo:

```csv
idade,sexo,renda,classe
25,M,3000,A
40,F,5000,B
```

---

## 🔐 Observações

* O modelo é salvo localmente na pasta `models/`
* Cada upload gera um novo modelo
* O nome do arquivo do modelo é baseado no CSV enviado

---

## ✨ Possíveis melhorias futuras

* Exibir métricas (accuracy, matriz de confusão)
* Suporte a múltiplos algoritmos
* Download de metadata do treinamento
* API REST
* Autenticação de usuários
* Dockerização

---

## 👤 Autor

**Carlos Augusto R. de Oliveira**
📧 Email: [caruviaro@outlook.com](mailto:caruviaro@outlook.com)

---

## 📄 Licença

Este projeto é distribuído sob a licença MIT.
