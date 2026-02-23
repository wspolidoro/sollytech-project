package main

import (
    "encoding/json"
    "fmt"
    "time"

    "github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// struct para armezenamento do hash da imagem
type ImageAsset struct {
    // trackers
    Version       int    `json:"version"`
    LastUpdatedAt string `json:"lastUpdatedAt"`
    Timestamp     string `json:"timestamp"`

    // chave de busca
    IDKit         string `json:"idKit"`
    HashData      string `json:"hashData"`
}

type SmartContract struct {
    contractapi.Contract
}

/*
	Função responsável por armazenar ou atualizar o hash de uma imagem no ledger. Recebe hashData como
    chave principal e idKit como indice secundário por meio de chave composta
*/
func (c *SmartContract) StoreImage(ctx contractapi.TransactionContextInterface, idKit string, hashData string) error {
	// Valida se recebeu o hash da imagem e o id do kit
	if hashData == "" || idKit == "" {
		return fmt.Errorf("hashData e idKit são obrigatórios")
	}

	// Define hash como chave principal
	imageKey := hashData

	// Obtém timestamp da transação
	txTime, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return err
	}

	formattedTime := time.Unix(
		txTime.Seconds,
		int64(txTime.Nanos),
	).UTC().Format(time.RFC3339)

	// Verifica se a imagem já existe
	exists, err := c.ImageExists(ctx, imageKey)
	if err != nil {
		return err
	}

	var asset ImageAsset

    // caso exista
	if exists {
		// Carrega imagem existente para atualização
		assetBytes, err := ctx.GetStub().GetState(imageKey)
		if err != nil {
			return err
		}
		if assetBytes == nil {
			return fmt.Errorf("falha ao carregar imagem existente com hash %s", hashData)
		}

		// Desserializa dados existentes
		if err := json.Unmarshal(assetBytes, &asset); err != nil {
			return err
		}

		// Incrementa versão e atualiza timestamp
		asset.HashData = hashData
		asset.Version++
		asset.LastUpdatedAt = formattedTime

    // Se não existe
	} else {
		// Cria novo registro de imagem
		asset = ImageAsset{
			IDKit:         idKit,
			Timestamp:     formattedTime,
			HashData:      hashData,
			Version:       0,
			LastUpdatedAt: formattedTime,
		}

		// Cria chave composta para indexação por kit
		indexKey, err := ctx.GetStub().CreateCompositeKey(
			"kit~hashImagem",
			[]string{idKit, hashData},
		)
		if err != nil {
			return err
		}

		// Armazena índice no ledger
		if err := ctx.GetStub().PutState(indexKey, []byte{0x00}); err != nil {
			return err
		}
	}

	// Serializa objeto
	assetBytes, err := json.Marshal(asset)
	if err != nil {
		return err
	}

	// Salva o hash como chave principal
	return ctx.GetStub().PutState(imageKey, assetBytes)
}

/*
	Função que retorna todos os hashes de imagens atrelados a um unico kit. Retorna uma lista com todos os itens inclusos
*/
func (c *SmartContract) GetImagesByKit(ctx contractapi.TransactionContextInterface, idKit string,) ([]*ImageAsset, error) {
    // Valida se recebeu o id do kit
    if idKit==""{
        return nil, fmt.Errorf("idKit não pode ser vazio")
    }

	// Busca todas as chaves compostas associadas ao kit
    iterator, err := ctx.GetStub().GetStateByPartialCompositeKey(
        "kit~hashImagem",
        []string{idKit},
    )
    if err != nil {
        return nil, err
    }
    defer iterator.Close()

    var results []*ImageAsset

	// Itera sobre todos os hashes encontrados
    for iterator.HasNext() {
        response, err := iterator.Next()
        if err != nil {
            return nil, err
        }

		// Separa atributos da chave composta
        _, parts, err := ctx.GetStub().SplitCompositeKey(response.Key)
        if err != nil {
            return nil, err
        }

        hashImagem := parts[1]

		// Recupera imagem individual pelo hash
        image, err := c.GetImageByID(ctx, hashImagem)
        if err != nil {
            return nil, err
        }

        results = append(results, image)
    }

    return results, nil
}


/*
	Função que recupera uma imagem específica a partir do seu hash.
	Realiza busca direta no ledger usando o hash como chave principal
	e retorna um único objeto ImageAsset
*/
func (c *SmartContract) GetImageByID(ctx contractapi.TransactionContextInterface, hashImagem string,) (*ImageAsset, error) {
	// Valida se recebeu o hashImagem
    if hashImagem == "" {
        return nil, fmt.Errorf("hashImagem não pode ser vazio")
    }

    imageKey := hashImagem

	// Consulta estado no ledger
    data, err := ctx.GetStub().GetState(imageKey)
    if err != nil {
        return nil, fmt.Errorf("erro ao acessar o ledger: %v", err)
    }
    if data == nil {
        return nil, fmt.Errorf("imagem %s não encontrada", hashImagem)
    }

	// Desserializa objeto armazenado
    var asset ImageAsset
    if err := json.Unmarshal(data, &asset); err != nil {
        return nil, fmt.Errorf("erro ao deserializar imagem: %v", err)
    }

    return &asset, nil
}

// Função para verificar se já existe registro de um hash recebido
func (c *SmartContract) ImageExists(ctx contractapi.TransactionContextInterface, key string,) (bool, error) {
    data, err := ctx.GetStub().GetState(key)
    if err != nil {
        return false, fmt.Errorf("erro ao verificar estado: %v", err)
    }
    return data != nil, nil
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