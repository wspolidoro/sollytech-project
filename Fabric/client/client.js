/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const grpc = require('@grpc/grpc-js');
const readline = require('readline');
const { connect, hash, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('node:crypto');
const fsRead = require('fs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { TextDecoder } = require('node:util');

const channelName = 'mainchannel';
const chaincodeName = 'sollytch-chain';
const mspId = 'org1MSP';

const cryptoPath = path.resolve(__dirname, '..','fabric','organizations','peerOrganizations','org1.example.com');

const keyDirectoryPath = path.resolve(
    cryptoPath,
    'users',
    'User1@org1.example.com',
    'msp',
    'keystore'
);

const certDirectoryPath = path.resolve(
    cryptoPath,
    'users',
    'User1@org1.example.com',
    'msp',
    'signcerts'
);

const tlsCertPath = path.resolve(
    cryptoPath,
    'peers',
    'peer0.org1.example.com',
    'tls',
    'ca.crt'
);

const peerEndpoint = 'localhost:7051';
const peerHostAlias = 'peer0.org1.example.com';

const utf8Decoder = new TextDecoder();

const controleInternoEncoder = {
    'ok': 2,
    'fail': 1,
    'invalid': 0
};

function setNestedField(obj, path, value) {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
        if (!(keys[i] in current)) {
            throw new Error(`campo inexistente: ${keys.slice(0, i + 1).join('.')}`);
        }
        current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
}


function preprocessForPrediction(testData) {
    console.log("Processando dados para predição...");
    
    // 1. IDENTIFICAR FEATURES (igual ao Python)
    const numericFeatures = [
        'expiry_days_left', 'distance_mm', 'time_to_migrate_s', 'sample_volume_uL',
        'sample_pH', 'sample_turbidity_NTU', 'sample_temp_C', 'ambient_T_C',
        'ambient_RH_pct', 'lighting_lux', 'tilt_deg', 'preincubation_time_s',
        'time_since_sampling_min', 'tempo_transporte_horas', 'estimated_concentration_ppb',
        'incerteza_estimativa_ppb'
    ];
    
    const categoricalFeatures = ['control_line_ok', 'controle_interno_result'];
    const allFeatures = [...numericFeatures, ...categoricalFeatures];
    
    const processedData = {...testData};
    
    if (typeof processedData.control_line_ok === 'boolean') {
        processedData.control_line_ok = processedData.control_line_ok ? 1 : 0;
        console.log(`Booleano convertido: control_line_ok → ${processedData.control_line_ok}`);
    }
    
    if (processedData.controle_interno_result in controleInternoEncoder) {
        processedData.controle_interno_result = controleInternoEncoder[processedData.controle_interno_result];
        console.log(`Codificada 'controle_interno_result': ${testData.controle_interno_result} → ${processedData.controle_interno_result}`);
    } else {
        processedData.controle_interno_result = 0; // valor padrão
        console.log(`Valor desconhecido 'controle_interno_result': ${testData.controle_interno_result} → 0`);
    }
    
    allFeatures.forEach(feature => {
        if (processedData[feature] === null || processedData[feature] === undefined) {
            processedData[feature] = 0;
            console.log(`Preenchido valor nulo: ${feature} → 0`);
        }
    });
    
    if (processedData.image_blur_score === null || processedData.image_blur_score === undefined) {
        processedData.image_blur_score = 0.0;
    }
    
    const csvData = [
        processedData.lat,
        processedData.lon,
        processedData.expiry_days_left,
        processedData.distance_mm,
        processedData.time_to_migrate_s,
        processedData.sample_volume_uL,
        processedData.sample_pH,
        processedData.sample_turbidity_NTU,
        processedData.sample_temp_C,
        processedData.ambient_T_C,
        processedData.ambient_RH_pct,
        processedData.lighting_lux,
        processedData.tilt_deg,
        processedData.preincubation_time_s,
        processedData.time_since_sampling_min,
        processedData.image_blur_score,
        processedData.tempo_transporte_horas,
        processedData.estimated_concentration_ppb,
        processedData.incerteza_estimativa_ppb,
        processedData.control_line_ok,
        processedData.controle_interno_result
    ].join(',');
    
    console.log("Dados pré-processados com sucesso");
    console.log(`CSV gerado: ${csvData}`);
    
    return csvData;
}

async function newGrpcConnection() {
    const tlsRootCert = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
    });
}

async function getFirstDirFileName(dirPath) {
    const files = await fs.readdir(dirPath);
    const file = files[0];
    if (!file) {
        throw new Error(`No files in directory: ${dirPath}`);
    }
    return path.join(dirPath, file);
}

async function newIdentity() {
    const certPath = await getFirstDirFileName(certDirectoryPath);
    const credentials = await fs.readFile(certPath);
    return { mspId, credentials };
}

async function newSigner() {
    const keyPath = await getFirstDirFileName(keyDirectoryPath);
    const privateKeyPem = await fs.readFile(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
}

async function invoke(contract) {
    const jsonFilePath = require('path').join(__dirname, 'test.json');
    const testData = JSON.parse(fsRead.readFileSync(jsonFilePath, 'utf8'));
    const testID = testData.test_id;
    console.log(testID)
    
    // Pré-processar os dados
    const predictStr = preprocessForPrediction(testData);
    
    // String JSON original
    const jsonStr = JSON.stringify(testData);

    try {
        await contract.submitTransaction("StoreTest", testID, jsonStr, predictStr);
        console.log("Teste armazenado com sucesso");
    } catch (error) {
        console.error("Erro:", error);
    }
}

async function getTestByID(contract,testID) {
    try {
        const rawResult = await contract.evaluateTransaction("GetTestByID", testID);
        
        let jsonString = "";
        for (const byte of rawResult) {
            jsonString += String.fromCharCode(byte);
        }
        
        const result = JSON.parse(jsonString);
        console.log(result)
        return result.HashData;
        
    } catch (error) {
        console.error("Erro:", error);
        return null;
    }
}

async function getTestByLote(contract,lote) {
    try {
        const rawResult = await contract.evaluateTransaction("GetTestsByLote", lote);
        
        let jsonString = "";
        for (const byte of rawResult) {
            jsonString += String.fromCharCode(byte);
        }
         
        const result = JSON.parse(jsonString);
        console.log(result)
        return result;
        
    } catch (error) {
        console.error("Erro:", error);
        return null;
    }
}

function hashImage(path) {
  const fileBuffer = fsRead.readFileSync(path);
  const hash = crypto.createHash("sha512").update(fileBuffer).digest("hex");
  return hash;
}

async function getImageByID(contract,imageID) {
    try {
        const rawResult = await contract.evaluateTransaction("GetImageByID", imageID);
        
        let jsonString = "";
        for (const byte of rawResult) {
            jsonString += String.fromCharCode(byte);
        }
        
        const result = JSON.parse(jsonString);
        console.log(result)
        return result.HashData;
        
    } catch (error) {
        console.error("Erro:", error);
        return null;
    }
}

async function getImagesByKit(contract,kitID) {
    try {
        const rawResult = await contract.evaluateTransaction("GetImagesByKit", kitID);
        
        let jsonString = "";
        for (const byte of rawResult) {
            jsonString += String.fromCharCode(byte);
        }
         
        const result = JSON.parse(jsonString);
        console.log(result)
        return result;
        
    } catch (error) {
        console.error("Erro:", error);
        return null;
    }
}

async function storeImage(contract,imagePath) {
    const kitID = 'teste2'
    const imageHash = hashImage(imagePath)
    await contract.submitTransaction(
        "StoreImage",
        kitID,
        imageHash
    );

    console.log("Imagem armazenada com sucesso!");
}

async function storePlanilha(contract, planilhaPath) {
    const lote = 'C23017'
    const planilhaHash = hashImage(planilhaPath)
    await contract.submitTransaction(
        "StorePlanilha",
        lote,
        planilhaHash
    );

    console.log("planilha armazenada com sucesso!");
}

async function getPlanilhaByHash(contract,planilhaHash) {
    try {
        const rawResult = await contract.evaluateTransaction("GetPlanilhaByHash", planilhaHash);
        
        let jsonString = "";
        for (const byte of rawResult) {
            jsonString += String.fromCharCode(byte);
        }
        
        const result = JSON.parse(jsonString);
        console.log(result)
        return result.HashData;
        
    } catch (error) {
        console.error("Erro:", error);
        return null;
    }
}

async function getPlanilhasByLote(contract,lote) {
    try {
        const rawResult = await contract.evaluateTransaction("GetPlanilhasByLote", lote);
        
        let jsonString = "";
        for (const byte of rawResult) {
            jsonString += String.fromCharCode(byte);
        }
         
        const result = JSON.parse(jsonString);
        console.log(result)
        return result;
        
    } catch (error) {
        console.error("Erro:", error);
        return null;
    }
}

async function editTest(contract) {
    const testID = (await askQuestion('testID do teste: ')).trim();

    const testData = await query(contract, testID);
    if (!testData) return;

    console.log('\nJSON atual:\n');
    console.log(JSON.stringify(testData, null, 2));

    const fieldPath = (await askQuestion(
        '\nCampo a editar (ex: sample_pH ou predictions.qc_status): '
    )).trim();

    const rawValue = (await askQuestion(
        'Novo valor: '
    )).trim();

    let newValue;
    if (rawValue === 'true') newValue = true;
    else if (rawValue === 'false') newValue = false;
    else if (!isNaN(rawValue)) newValue = Number(rawValue);
    else newValue = rawValue;

    try {
        setNestedField(testData, fieldPath, newValue);
    } catch (err) {
        console.error('erro ao editar campo:', err.message);
        return;
    }

    console.log('\nJSON atualizado:\n');
    console.log(JSON.stringify(testData, null, 2));

    const confirm = (await askQuestion('\nConfirmar update? (y/n): ')).trim().toLowerCase();
    if (confirm !== 'y') {
        console.log('operacao cancelada');
        return;
    }

    await contract.submitTransaction(
        'UpdateTest',
        testID,
        JSON.stringify(testData)
    );

    console.log('teste atualizado com sucesso');
}

async function storeModel(contract) {
    const modelKey = (await askQuestion(
        'modelKey (acao_recomendada | result_class | qc_status): '
    )).trim();

    const filePath = (await askQuestion(
        'caminho do arquivo do modelo (.model): '
    )).trim();

    // Lê o arquivo como binário
    const modelBuffer = await fs.readFile(filePath);

    // Converte para base64
    const modelBase64 = modelBuffer.toString('base64');

    await contract.submitTransaction(
        'StoreModel',
        modelKey,
        modelBase64
    );

    console.log(`modelo "${modelKey}" armazenado com sucesso no ledger`);
}

function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve =>
        rl.question(query, ans => {
            rl.close();
            resolve(ans);
        })
    );
}

function displayInputParameters() {
    console.log(`channelName:       ${channelName}`);
    console.log(`chaincodeName:     ${chaincodeName}`);
    console.log(`mspId:             ${mspId}`);
    console.log(`cryptoPath:        ${cryptoPath}`);
}

async function main() {
    displayInputParameters();

    const client = await newGrpcConnection();
    const gateway = connect({
        client,
        identity: await newIdentity(),
        signer: await newSigner(),
        hash: hash.sha256,
    });

    try {
        const network = gateway.getNetwork(channelName);
        const sollytchImageContract = network.getContract("sollytch-image");
        const sollytchChainContract = network.getContract("sollytch-chain");

        const action = (await askQuestion(
            'acao (store_test | query_test | edit_test | storemodel | store_image | query_image | store_planilha | query_planilha): '
        )).trim().toLowerCase();

        if (action === 'store_test') {
            await invoke(sollytchChainContract);

        } else if (action === 'query_test') {
            const whichQuery = (await askQuestion("Buscar pelo lote ou por TEST-ID? (lote | id) ")).trim();
            if (whichQuery === "lote"){
                const lote = await askQuestion('Insira o numero do lote: ')
                await getTestByLote(sollytchChainContract, lote)
            } else if (whichQuery === "id"){
                const testID = await askQuestion('Insira o id do teste (ex TEST-00001): ')
                await getTestByID(sollytchChainContract,testID)
            }else{
                console.log("opcao invalida")
            }

        } else if (action === 'storemodel') {
            await storeModel(sollytchChainContract);

        } else if (action === 'edit_test') {
            await editTest(sollytchChainContract);

        } else if (action === 'store_image') {
            // const imageID = (await askQuestion('imageID: ')).trim();
            const imagePath = "./imagem.jpg" 
            await storeImage(sollytchImageContract,imagePath);

        } else if (action === 'query_image') {
            const whichQuery = (await askQuestion("Buscar pelo kit ou por imagem individual? (kit | imagem) ")).trim();
            if (whichQuery === "kit"){
                const kitID = await askQuestion('Insira o id do kit: ')
                await getImagesByKit(sollytchImageContract, kitID)
            } else if (whichQuery === "imagem"){
                const imgID = await askQuestion('Insira o hash da imagem: ')
                await getImageByID(sollytchImageContract,imgID)
            }else{
                console.log("opcao invalida")
            }
        } else if (action === 'store_planilha'){
            const imagePath = "./examples/testesAfericao.xlsx" 
            await storePlanilha(sollytchChainContract,imagePath);
        } else if (action === 'query_planilha'){
            const whichQuery = (await askQuestion("Buscar pelo lote ou por planilha individual? (lote | planilha) ")).trim();
            if (whichQuery === "lote"){
                const lote = await askQuestion('Insira o numero do lote: ')
                await getPlanilhasByLote(sollytchChainContract, lote)
            } else if (whichQuery === "planilha"){
                const planilhaHash = await askQuestion('Insira o hash da planilha: ')
                await getPlanilhaByHash(sollytchChainContract,planilhaHash)
            }else{
                console.log("opcao invalida")
            }
        }else {
            console.log('acao invalida');
        }

    } finally {
        gateway.close();
        client.close();
    }
}

main().catch(err => {
    console.error('******** FAILED to run the application:', err);
    process.exitCode = 1;
});
