
const grpc = require('@grpc/grpc-js');
const readline = require('readline');
const { connect, hash, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('node:crypto');
const fsRead = require('fs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { TextDecoder } = require('node:util');

let network, gateway, sollytchChainContract, sollytchImageContract, client

const channelName = 'mainchannel';
const mspId = 'org1MSP';

const cryptoPath = path.resolve(__dirname, '..','..','fabric','organizations','peerOrganizations','org1.example.com');

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

function preprocessForPrediction(testData) {
    console.log("Processando dados para predição...");
    
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

async function storeTest(jsonStr) {
    const testData = JSON.parse(jsonStr);
    const testID = testData.test_id;
    console.log(testID)
    
    const predictStr = preprocessForPrediction(testData);
    try {
        await sollytchChainContract.submitTransaction(
            "StoreTest",
            testID,
            jsonStr,
            predictStr
        );
        console.log(`Teste ${testID} armazenado com sucesso`)
    } catch (err) {
        console.error(`Falha ao armazenar teste ${testID}: ${err}`)
    }
}

async function updateTest(jsonStr, testID) {
    try{
        await sollytchChainContract.submitTransaction(
            'UpdateTest',
            testID,
            jsonStr
        );
        console.log(`teste ${testID} atualizado com sucesso`);
    }catch(err){
        console.error(`Falha ao atualizar teste ${testID}: ${err}`)
    }
}

async function storeModel(modelBase64, modelKey) {
    try{
        await sollytchChainContract.submitTransaction(
            'StoreModel',
            modelKey,
            modelBase64
        );
        console.log(`Modelo ${modelKey} armazenado com sucesso`)
    } catch(err){
        console.error(`Erro ao armazenar modelo ${modelKey}: ${err}`)
    }
}

async function queryTestByID(testID){
    try{
        const rawResult = await sollytchChainContract.evaluateTransaction(
            'GetTestByID',
            testID
        );

        let jsonString = ""
        for (const byte of rawResult){
            jsonString += String.fromCharCode(byte)
        }

        const result = JSON.parse(jsonString)
        console.log("Resultado do query por ID do teste:")
        console.log(result)
        return result
    }catch(err){
        console.error("Erro ao buscar teste por id: ", err)
    }
}

async function queryTestByLote(lote){
    try{
        const rawResult = await sollytchChainContract.evaluateTransaction(
            'GetTestsByLote',
            lote
        );

        let jsonString = ""
        for (const byte of rawResult){
            jsonString += String.fromCharCode(byte)
        }

        const result = JSON.parse(jsonString)
        console.log("Resultado do query por lote:")
        console.log(result)
        return result
    }catch(err){
        console.error(`Erro ao buscar pelo lote ${lote}: ${err}`)
    }
}

async function storePlanilha(lote,planilhaHash){
    try{
        await sollytchChainContract.submitTransaction(
            "StorePlanilha",
            lote,
            planilhaHash
        );
        console.log(`Planilha ${planilhaHash} armazenada com sucesso`)
    }catch(err){
        console.error(`Erro ao armazenar planilha ${planilhaHash}: ${err}`);
    }
}

async function queryPlanilhaByHash(planilhaHash){
    try {
        const rawResult = await sollytchChainContract.evaluateTransaction(
            "GetPlanilhaByHash",
            planilhaHash
        );
        
        let jsonString = "";
        for (const byte of rawResult) {
            jsonString += String.fromCharCode(byte);
        }
        
        const result = JSON.parse(jsonString);
        console.log("Resultado do query da planilha por hash:")
        console.log(result)
        return result
    } catch (err){
        console.error("Erro: ", err);
    }   
}

async function queryPlanilhaByLote(lote){
    try {
        const rawResult = await sollytchChainContract.evaluateTransaction(
            "GetPlanilhasByLote",
            lote
        );
        
        let jsonString = "";
        for (const byte of rawResult) {
            jsonString += String.fromCharCode(byte);
        }
        
        const result = JSON.parse(jsonString);
        console.log("Resultado do query da planilha por lote:")
        console.log(result)
        return result
    } catch (err){
        console.error("Erro:", err)
    }   
}

async function storeImage(imageHash, kitID) {
    try{
        await sollytchImageContract.submitTransaction(
            "StoreImage",
            kitID,
            imageHash
        );
        console.log("Imagem armazenada com sucesso!");
    } catch(err){
        console.error("erro ao armazenar hash de imagem: ", err)
    }
}

async function queryImageByHash(imageHash){
    try {
        const rawResult = await sollytchImageContract.evaluateTransaction(
            "GetImageByID",
            imageHash);
        
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

async function queryImageByKit(kitID){
    try {
        const rawResult = await sollytchImageContract.evaluateTransaction(
            "GetImagesByKit",
            kitID);
        
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

async function initialize() {
    client = await newGrpcConnection();
    gateway = connect({
        client,
        identity: await newIdentity(),
        signer: await newSigner(),
        hash: hash.sha256,
    });

    try {
        network = gateway.getNetwork(channelName);
        sollytchImageContract = network.getContract("sollytch-image");
        sollytchChainContract = network.getContract("sollytch-chain");
    } catch (err){
        console.error("Erro na inicialização: ", err)
    } 
}

async function disconnect(){
    try{
        gateway.close();
        client.close();
    } catch(err){
        console.error('Erro na desconexão')
    }
}

module.exports={
    initialize,
    disconnect,
    storeTest,
    queryTestByID,
    queryTestByLote,
    storeModel,
    updateTest,
    storeImage,
    queryImageByHash,
    queryImageByKit,
    storePlanilha,
    queryPlanilhaByHash,
    queryPlanilhaByLote
}