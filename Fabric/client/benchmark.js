// benchmark.js
const grpc = require('@grpc/grpc-js');
const { connect, hash, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

// Configurações da rede Fabric
const channelName = 'mainchannel';
const chaincodeName = 'sollytch-chain';
const mspId = 'org1MSP';

const controleInternoEncoder = {
    'ok': 2,
    'fail': 1,
    'invalid': 0
};

const cryptoPath = path.resolve(__dirname,'..','fabric','organizations','peerOrganizations','org1.example.com');

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

// Configurações do benchmark
const NUM_EXECUTIONS = 1000;
const TEST_JSON_PATH = path.join(__dirname, 'test.json');
const FULL_TEST_JSON_PATH = path.join(__dirname, 'full_test.json');

// Criar pasta benchmarks
const BENCHMARK_DIR = path.join(__dirname, 'benchmarks');
if (!fs.existsSync(BENCHMARK_DIR)) {
    fs.mkdirSync(BENCHMARK_DIR, { recursive: true });
}

const timestamp = Date.now();
const LOG_FILE = path.join(BENCHMARK_DIR, `benchmark_log_${timestamp}.txt`);
const RESULTS_FILE = path.join(BENCHMARK_DIR, `benchmark_results_${timestamp}.json`);
const PROGRESS_FILE = path.join(BENCHMARK_DIR, `benchmark_progress_${timestamp}.json`);

// Estruturas para métricas
const metrics = {
    storeTest: {
        chaincodeTimes: [],      // Tempo do chaincode (dos logs)
        transactionTimes: [],     // Tempo do submitTransaction
        errors: 0,
        success: 0,
        details: []
    },
    updateTest: {
        chaincodeTimes: [],
        transactionTimes: [],
        errors: 0,
        success: 0,
        details: []
    }
};

// Variáveis globais de conexão
let client, gateway, contract;

// Funções de conexão
async function getFirstDirFileName(dirPath) {
    const files = await fsPromises.readdir(dirPath);
    return path.join(dirPath, files[0]);
}

async function newGrpcConnection() {
    const tlsRootCert = await fsPromises.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
    });
}

async function newIdentity() {
    const certPath = await getFirstDirFileName(certDirectoryPath);
    const credentials = await fsPromises.readFile(certPath);
    return { mspId, credentials };
}

async function newSigner() {
    const keyPath = await getFirstDirFileName(keyDirectoryPath);
    const privateKeyPem = await fsPromises.readFile(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
}

async function initialize() {
    client = await newGrpcConnection();
    gateway = connect({
        client,
        identity: await newIdentity(),
        signer: await newSigner(),
        hash: hash.sha256,
    });

    const network = gateway.getNetwork(channelName);
    contract = network.getContract(chaincodeName);
}

async function disconnect() {
    gateway.close();
    client.close();
}

// Função para capturar logs do container
function startLogMonitor() {
    console.log('Iniciando monitor de logs...');
    
    const containers = [
        'sollytch-chain.org1.example.com',
        'sollytch-chain.org2.example.com', 
        'sollytch-chain.org3.example.com'
    ];
    
    const processes = [];
    
    containers.forEach(containerName => {
        try {
            const logProcess = spawn('docker', ['logs', '-f', containerName]);
            
            logProcess.stdout.on('data', (data) => {
                const lines = data.toString().split('\n');
                lines.forEach(line => {
                    if (line.includes('BENCHMARK_METRIC')) {
                        try {
                            const match = line.match(/BENCHMARK_METRIC: (\{.*\})/);
                            if (match) {
                                const metric = JSON.parse(match[1]);
                                
                                if (metric.function === 'StoreTest') {
                                    metrics.storeTest.chaincodeTimes.push({
                                        testId: metric.testId,
                                        time: metric.executionTime,
                                        peer: containerName
                                    });
                                } else if (metric.function === 'UpdateTest') {
                                    metrics.updateTest.chaincodeTimes.push({
                                        testId: metric.testId,
                                        time: metric.executionTime,
                                        peer: containerName
                                    });
                                }
                                
                                console.log(`[LOG] ${metric.function} - ${metric.testId}: ${metric.executionTime}s`);
                            }
                        } catch (e) {
                            // Ignora erro de parsing
                        }
                    }
                });
            });
            
            processes.push(logProcess);
            
        } catch (error) {
            console.log(`Aviso: Não foi possível monitorar ${containerName}`);
        }
    });
    
    return processes;
}

// Função para gerar próximo test_id
function generateNextTestId(baseId, iteration) {
    const match = baseId.match(/(TEST-)(\d+)/);
    if (!match) return `${baseId}-${iteration}`;
    
    const prefix = match[1];
    const num = parseInt(match[2], 10);
    const newNum = num + iteration;
    return `${prefix}${String(newNum).padStart(5, '0')}`;
}

// Função para criar cópia do JSON
function createTestDataWithNewId(originalJson, newId) {
    const testData = JSON.parse(originalJson);
    testData.test_id = newId;
    return JSON.stringify(testData);
}

// Função para executar StoreTest (medindo apenas submitTransaction)
async function runStoreTest(testData, testId, iteration) {
    const parsedData = JSON.parse(testData);
    
    // Preparar predictStr (mas não medir este tempo)
    const predictStr = [
        parsedData.lat, parsedData.lon, parsedData.expiry_days_left,
        parsedData.distance_mm, parsedData.time_to_migrate_s, parsedData.sample_volume_uL,
        parsedData.sample_pH, parsedData.sample_turbidity_NTU, parsedData.sample_temp_C,
        parsedData.ambient_T_C, parsedData.ambient_RH_pct, parsedData.lighting_lux,
        parsedData.tilt_deg, parsedData.preincubation_time_s, parsedData.time_since_sampling_min,
        parsedData.image_blur_score || 0, parsedData.tempo_transporte_horas,
        parsedData.estimated_concentration_ppb, parsedData.incerteza_estimativa_ppb,
        parsedData.control_line_ok ? 1 : 0,
        controleInternoEncoder[parsedData.controle_interno_result] || 0
    ].join(',');
    
    // MEDIR APENAS O SUBMIT TRANSACTION
    const startTime = Date.now();
    
    try {
        await contract.submitTransaction(
            "StoreTest",
            testId,
            testData,
            predictStr
        );
        
        const endTime = Date.now();
        const transactionTime = (endTime - startTime) / 1000;
        
        metrics.storeTest.transactionTimes.push(transactionTime);
        metrics.storeTest.success++;
        
        metrics.storeTest.details.push({
            iteration,
            testId,
            success: true,
            transactionTime,
            timestamp: new Date().toISOString()
        });
        
        console.log(`[StoreTest-${iteration}] ✓ ${testId} - Transação: ${transactionTime.toFixed(4)}s`);
        
        return { success: true, transactionTime };
        
    } catch (error) {
        const endTime = Date.now();
        const transactionTime = (endTime - startTime) / 1000;
        
        metrics.storeTest.transactionTimes.push(transactionTime);
        metrics.storeTest.errors++;
        
        console.log(`\n[StoreTest-${iteration}] ✗ ERRO: ${testId}`);
        console.log('Mensagem:', error.message);
        if (error.details) console.log('Detalhes:', error.details);
        console.log('');
        
        metrics.storeTest.details.push({
            iteration,
            testId,
            success: false,
            transactionTime,
            error: {
                message: error.message,
                details: error.details,
                code: error.code
            },
            timestamp: new Date().toISOString()
        });
        
        return { success: false, transactionTime, error };
    }
}

// Função para executar UpdateTest (medindo apenas submitTransaction)
async function runUpdateTest(testData, testId, iteration) {
    // MEDIR APENAS O SUBMIT TRANSACTION
    const startTime = Date.now();
    
    try {
        await contract.submitTransaction(
            'UpdateTest',
            testId,
            testData
        );
        
        const endTime = Date.now();
        const transactionTime = (endTime - startTime) / 1000;
        
        metrics.updateTest.transactionTimes.push(transactionTime);
        metrics.updateTest.success++;
        
        metrics.updateTest.details.push({
            iteration,
            testId,
            success: true,
            transactionTime,
            timestamp: new Date().toISOString()
        });
        
        console.log(`[UpdateTest-${iteration}] ✓ ${testId} - Transação: ${transactionTime.toFixed(4)}s`);
        
        return { success: true, transactionTime };
        
    } catch (error) {
        const endTime = Date.now();
        const transactionTime = (endTime - startTime) / 1000;
        
        metrics.updateTest.transactionTimes.push(transactionTime);
        metrics.updateTest.errors++;
        
        console.log(`\n[UpdateTest-${iteration}] ✗ ERRO: ${testId}`);
        console.log('Mensagem:', error.message);
        if (error.details) console.log('Detalhes:', error.details);
        console.log('');
        
        metrics.updateTest.details.push({
            iteration,
            testId,
            success: false,
            transactionTime,
            error: {
                message: error.message,
                details: error.details,
                code: error.code
            },
            timestamp: new Date().toISOString()
        });
        
        return { success: false, transactionTime, error };
    }
}

// Função para salvar progresso
function saveProgress() {
    const progress = {
        timestamp: new Date().toISOString(),
        metrics: {
            storeTest: {
                transactionTimes: metrics.storeTest.transactionTimes,
                chaincodeTimes: metrics.storeTest.chaincodeTimes.slice(-10),
                success: metrics.storeTest.success,
                errors: metrics.storeTest.errors,
                details: metrics.storeTest.details.slice(-5)
            },
            updateTest: {
                transactionTimes: metrics.updateTest.transactionTimes,
                chaincodeTimes: metrics.updateTest.chaincodeTimes.slice(-10),
                success: metrics.updateTest.success,
                errors: metrics.updateTest.errors,
                details: metrics.updateTest.details.slice(-5)
            }
        }
    };
    
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
    console.log(`Progresso salvo em: ${PROGRESS_FILE}`);
}

// Função para calcular estatísticas
function calculateStats(values) {
    if (values.length === 0) return { mean: 0, stdDev: 0, min: 0, max: 0, median: 0, p95: 0 };
    
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    const stdDev = Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    
    return { mean, stdDev, min, max, median, p95 };
}

// Função para formatar tempo
function formatTime(seconds) {
    if (seconds < 0.001) {
        return `${(seconds * 1000000).toFixed(2)} µs`;
    } else if (seconds < 1) {
        return `${(seconds * 1000).toFixed(3)} ms`;
    } else {
        return `${seconds.toFixed(4)} s`;
    }
}

// Função para imprimir resultados
function printResults() {
    console.log('\n' + '='.repeat(80));
    console.log('RESULTADOS DO BENCHMARK');
    console.log('='.repeat(80));
    
    // StoreTest
    console.log('\nSTORE TEST (COM MACHINE LEARNING):');
    console.log('-'.repeat(40));
    
    const storeTransactionStats = calculateStats(metrics.storeTest.transactionTimes);
    const storeChaincodeTimes = metrics.storeTest.chaincodeTimes.map(t => t.time);
    const storeChaincodeStats = calculateStats(storeChaincodeTimes);
    const storeSuccessRate = (metrics.storeTest.success / NUM_EXECUTIONS * 100).toFixed(2);
    
    console.log(`Execuções: ${NUM_EXECUTIONS}`);
    console.log(`✓ Sucesso: ${metrics.storeTest.success}`);
    console.log(`✗ Erros: ${metrics.storeTest.errors}`);
    console.log(`Taxa de sucesso: ${storeSuccessRate}%`);
    
    console.log(`\n📊 Tempo de transação (submitTransaction):`);
    console.log(`  Média: ${formatTime(storeTransactionStats.mean)}`);
    console.log(`  ├─ Desvio: ±${formatTime(storeTransactionStats.stdDev)}`);
    console.log(`  ├─ Mediana: ${formatTime(storeTransactionStats.median)}`);
    console.log(`  ├─ P95: ${formatTime(storeTransactionStats.p95)}`);
    console.log(`  └─ Min: ${formatTime(storeTransactionStats.min)} | Max: ${formatTime(storeTransactionStats.max)}`);
    
    if (storeChaincodeTimes.length > 0) {
        console.log(`\n⏱️  Tempo no chaincode (dos logs):`);
        console.log(`  Média: ${formatTime(storeChaincodeStats.mean)}`);
        console.log(`  ├─ Desvio: ±${formatTime(storeChaincodeStats.stdDev)}`);
        console.log(`  ├─ Mediana: ${formatTime(storeChaincodeStats.median)}`);
        console.log(`  ├─ P95: ${formatTime(storeChaincodeStats.p95)}`);
        console.log(`  └─ Min: ${formatTime(storeChaincodeStats.min)} | Max: ${formatTime(storeChaincodeStats.max)}`);
        console.log(`  Amostras: ${storeChaincodeTimes.length}`);
    }
    
    // UpdateTest
    console.log('\nUPDATE TEST (SEM MACHINE LEARNING):');
    console.log('-'.repeat(40));
    
    const updateTransactionStats = calculateStats(metrics.updateTest.transactionTimes);
    const updateChaincodeTimes = metrics.updateTest.chaincodeTimes.map(t => t.time);
    const updateChaincodeStats = calculateStats(updateChaincodeTimes);
    const updateSuccessRate = (metrics.updateTest.success / NUM_EXECUTIONS * 100).toFixed(2);
    
    console.log(`Execuções: ${NUM_EXECUTIONS}`);
    console.log(`✓ Sucesso: ${metrics.updateTest.success}`);
    console.log(`✗ Erros: ${metrics.updateTest.errors}`);
    console.log(`Taxa de sucesso: ${updateSuccessRate}%`);
    
    console.log(`\n📊 Tempo de transação (submitTransaction):`);
    console.log(`  Média: ${formatTime(updateTransactionStats.mean)}`);
    console.log(`  ├─ Desvio: ±${formatTime(updateTransactionStats.stdDev)}`);
    console.log(`  ├─ Mediana: ${formatTime(updateTransactionStats.median)}`);
    console.log(`  ├─ P95: ${formatTime(updateTransactionStats.p95)}`);
    console.log(`  └─ Min: ${formatTime(updateTransactionStats.min)} | Max: ${formatTime(updateTransactionStats.max)}`);
    
    if (updateChaincodeTimes.length > 0) {
        console.log(`\n⏱️  Tempo no chaincode (dos logs):`);
        console.log(`  Média: ${formatTime(updateChaincodeStats.mean)}`);
        console.log(`  ├─ Desvio: ±${formatTime(updateChaincodeStats.stdDev)}`);
        console.log(`  ├─ Mediana: ${formatTime(updateChaincodeStats.median)}`);
        console.log(`  ├─ P95: ${formatTime(updateChaincodeStats.p95)}`);
        console.log(`  └─ Min: ${formatTime(updateChaincodeStats.min)} | Max: ${formatTime(updateChaincodeStats.max)}`);
        console.log(`  Amostras: ${updateChaincodeTimes.length}`);
    }
    
    // Comparativo
    if (updateTransactionStats.mean > 0 && storeTransactionStats.mean > 0) {
        console.log('\nCOMPARATIVO:');
        console.log('-'.repeat(40));
        
        const transDiff = storeTransactionStats.mean - updateTransactionStats.mean;
        const transDiffPercent = (transDiff / updateTransactionStats.mean * 100).toFixed(2);
        
        console.log(`Tempo de transação (com ML vs sem ML):`);
        console.log(`  Diferença: ${formatTime(transDiff)} (${transDiffPercent}%)`);
        
        if (storeChaincodeStats.mean > 0 && updateChaincodeStats.mean > 0) {
            const chainDiff = storeChaincodeStats.mean - updateChaincodeStats.mean;
            const chainDiffPercent = (chainDiff / updateChaincodeStats.mean * 100).toFixed(2);
            
            console.log(`\nTempo no chaincode (com ML vs sem ML):`);
            console.log(`  Diferença: ${formatTime(chainDiff)} (${chainDiffPercent}%)`);
        }
    }
    
    // Salvar resultados
    const results = {
        timestamp: new Date().toISOString(),
        config: { numExecutions: NUM_EXECUTIONS },
        storeTest: {
            success: metrics.storeTest.success,
            errors: metrics.storeTest.errors,
            successRate: `${storeSuccessRate}%`,
            transactionTime: {
                mean: storeTransactionStats.mean,
                stdDev: storeTransactionStats.stdDev,
                min: storeTransactionStats.min,
                max: storeTransactionStats.max,
                median: storeTransactionStats.median,
                p95: storeTransactionStats.p95
            },
            chaincodeTime: storeChaincodeTimes.length > 0 ? {
                mean: storeChaincodeStats.mean,
                stdDev: storeChaincodeStats.stdDev,
                min: storeChaincodeStats.min,
                max: storeChaincodeStats.max,
                median: storeChaincodeStats.median,
                p95: storeChaincodeStats.p95
            } : null
        },
        updateTest: {
            success: metrics.updateTest.success,
            errors: metrics.updateTest.errors,
            successRate: `${updateSuccessRate}%`,
            transactionTime: {
                mean: updateTransactionStats.mean,
                stdDev: updateTransactionStats.stdDev,
                min: updateTransactionStats.min,
                max: updateTransactionStats.max,
                median: updateTransactionStats.median,
                p95: updateTransactionStats.p95
            },
            chaincodeTime: updateChaincodeTimes.length > 0 ? {
                mean: updateChaincodeStats.mean,
                stdDev: updateChaincodeStats.stdDev,
                min: updateChaincodeStats.min,
                max: updateChaincodeStats.max,
                median: updateChaincodeStats.median,
                p95: updateChaincodeStats.p95
            } : null
        }
    };
    
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    console.log(`\nResultados salvos em: ${RESULTS_FILE}`);
    console.log(`Log salvo em: ${LOG_FILE}`);
}

// Função principal
async function runBenchmark() {
    console.log('Iniciando benchmark...');
    console.log(`Número de execuções: ${NUM_EXECUTIONS}`);
    
    // Verificar JSONs
    if (!fs.existsSync(TEST_JSON_PATH)) {
        console.log(`Erro: ${TEST_JSON_PATH} não encontrado`);
        return;
    }
    if (!fs.existsSync(FULL_TEST_JSON_PATH)) {
        console.log(`Erro: ${FULL_TEST_JSON_PATH} não encontrado`);
        return;
    }
    
    // Iniciar monitor de logs
    const logProcesses = startLogMonitor();
    
    // Ler JSONs
    const originalTestJson = fs.readFileSync(TEST_JSON_PATH, 'utf8');
    const originalFullTestJson = fs.readFileSync(FULL_TEST_JSON_PATH, 'utf8');
    const baseTestId = JSON.parse(originalTestJson).test_id;
    
    console.log(`Test ID base: ${baseTestId}`);
    
    // Inicializar conexão Fabric
    console.log('Conectando ao Fabric...');
    try {
        await initialize();
        console.log('Conectado com sucesso');
    } catch (error) {
        console.log('Erro na conexão:', error.message);
        logProcesses.forEach(p => p.kill());
        return;
    }
    
    // Executar benchmark
    for (let i = 1; i <= NUM_EXECUTIONS; i++) {
        console.log(`\n--- Execução ${i}/${NUM_EXECUTIONS} ---`);
        
        const storeTestId = generateNextTestId(baseTestId, i - 1);
        const updateTestId = generateNextTestId(baseTestId, i - 1);
        
        const storeTestData = createTestDataWithNewId(originalTestJson, storeTestId);
        const updateTestData = createTestDataWithNewId(originalFullTestJson, updateTestId);
        
        await runStoreTest(storeTestData, storeTestId, i);
        await new Promise(resolve => setTimeout(resolve, 500));
        await runUpdateTest(updateTestData, updateTestId, i);
        
        if (i % 2 === 0) {
            saveProgress();
        }
    }
    
    // Aguardar últimos logs
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Resultados
    printResults();
    
    // Limpeza
    logProcesses.forEach(p => p.kill());
    await disconnect();
    console.log('\nBenchmark concluído!');
}

// Tratamento de interrupção
process.on('SIGINT', async () => {
    console.log('\n\nBenchmark interrompido pelo usuário');
    saveProgress();
    await disconnect();
    process.exit(0);
});

// Executar
if (require.main === module) {
    runBenchmark().catch(console.error);
}