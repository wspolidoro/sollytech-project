const bodyParser = require('body-parser');
const express = require('express');
const path = require('path');
const cors = require('cors');
const fsRead = require('fs');
const multer = require('multer');
const crypto = require('crypto');

const upload = multer({ dest: 'uploads/' });

const {
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
} = require('./resources/standalone_client.js');

const app = express();
const port = 3000;

// middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(bodyParser.json());

app.use('/resources', express.static(path.join(__dirname, 'resources')));
app.use(express.static(path.join(__dirname, 'views')));

// Helper function para gerenciar conexão com Fabric
async function withFabric(operation) {
  try {
    await initialize();
    const result = await operation();
    await disconnect();
    return result;
  } catch (err) {
    await disconnect();
    throw err;
  }
}

// Rota inicial
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// ============= ROTAS DE STORE/ARMAZENAMENTO =============

// Grupo: Store Test
app.post('/store/test', async (req, res) => {
  let { testID, data } = req.body;
  console.log("Recebendo dados para store/test:", testID, data);

  try {
    if (!Array.isArray(data)) data = [data];

    const results = [];

    await withFabric(async () => {
      for (let i = 0; i < data.length; i++) {
        const item = data[i];

        const id =
          item.test_id ||
          item.testID ||
          item.TestID ||
          testID;

        if (!id) {
          throw new Error(`TestID ausente no item ${i}`);
        }

        item.test_id = id;
        await storeTest(JSON.stringify(item));

        results.push({ index: i, testID: id, status: "ok" });
      }
    });

    res.json({
      message: "Testes armazenados com sucesso",
      total: results.length,
      detalhes: results
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Grupo: Store Image
app.post('/store/image', upload.single('image'), async (req, res) => {
  const { kitID } = req.body;
  const filePath = req.file?.path;

  if (!kitID) {
    return res.status(400).json({ error: "kitID é obrigatório" });
  }

  if (!filePath) {
    return res.status(400).json({ error: "Imagem não enviada" });
  }

  try {
    const buffer = fsRead.readFileSync(filePath);
    const hash = crypto
      .createHash("sha512")
      .update(buffer)
      .digest("hex");

    await withFabric(() => storeImage(hash, kitID));

    res.json({
      message: "Imagem armazenada com sucesso",
      kitID,
      imageHash: hash
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    // Limpar arquivo temporário
    if (filePath && fsRead.existsSync(filePath)) {
      fsRead.unlinkSync(filePath);
    }
  }
});

// Grupo: Store Model
app.post('/store/model', upload.single('model'), async (req, res) => {
  const { modelKey } = req.body;
  const filePath = req.file?.path;

  if (!modelKey) {
    return res.status(400).json({ error: "modelKey é obrigatório" });
  }

  if (!filePath) {
    return res.status(400).json({ error: "Arquivo de modelo não enviado" });
  }

  try {
    const buffer = fsRead.readFileSync(filePath);
    const base64 = buffer.toString('base64');

    await withFabric(() => storeModel(base64, modelKey));

    res.json({
      message: "Modelo armazenado com sucesso",
      modelKey
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    // Limpar arquivo temporário
    if (filePath && fsRead.existsSync(filePath)) {
      fsRead.unlinkSync(filePath);
    }
  }
});

// Grupo: Store Planilha
app.post('/store/planilha', async (req, res) => {
  const { lote, planilhaHash } = req.body;

  if (!lote || !planilhaHash) {
    return res.status(400).json({ 
      error: "lote e planilhaHash são obrigatórios" 
    });
  }

  try {
    await withFabric(() => storePlanilha(lote, planilhaHash));

    res.json({
      message: "Planilha armazenada com sucesso",
      lote,
      planilhaHash
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ============= ROTAS DE QUERY/CONSULTA =============

// Grupo: Query Test - por ID
app.get('/query/test/id/:testID', async (req, res) => {
  const { testID } = req.params;

  if (!testID) {
    return res.status(400).json({ error: "testID é obrigatório" });
  }

  try {
    const result = await withFabric(() => queryTestByID(testID));
    
    if (!result) {
      return res.status(404).json({ error: "Teste não encontrado" });
    }
    
    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Grupo: Query Test - por Lote
app.get('/query/test/lote/:lote', async (req, res) => {
  const { lote } = req.params;

  if (!lote) {
    return res.status(400).json({ error: "lote é obrigatório" });
  }

  try {
    const result = await withFabric(() => queryTestByLote(lote));
    
    if (!result) {
      return res.status(404).json({ error: "Lote não encontrado" });
    }
    
    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Grupo: Query Image - por Hash
app.get('/query/image/hash/:imageHash', async (req, res) => {
  const { imageHash } = req.params;

  if (!imageHash) {
    return res.status(400).json({ error: "imageHash é obrigatório" });
  }

  try {
    const result = await withFabric(() => queryImageByHash(imageHash));
    
    if (!result) {
      return res.status(404).json({ error: "Imagem não encontrada" });
    }
    
    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Grupo: Query Image - por Kit ID (Nota: função queryImageByKit requer parâmetro)
app.get('/query/image/kit/:kitID', async (req, res) => {
  const { kitID } = req.params;

  if (!kitID) {
    return res.status(400).json({ error: "kitID é obrigatório" });
  }

  try {
    // Nota: Você precisa ajustar a função queryImageByKit para receber kitID como parâmetro
    const result = await withFabric(() => queryImageByKit(kitID));
    
    if (!result) {
      return res.status(404).json({ error: "Imagem não encontrada para este kit" });
    }
    
    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Grupo: Query Planilha - por Hash
app.get('/query/planilha/hash/:planilhaHash', async (req, res) => {
  const { planilhaHash } = req.params;

  if (!planilhaHash) {
    return res.status(400).json({ error: "planilhaHash é obrigatório" });
  }

  try {
    const result = await withFabric(() => queryPlanilhaByHash(planilhaHash));
    
    if (!result) {
      return res.status(404).json({ error: "Planilha não encontrada" });
    }
    
    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Grupo: Query Planilha - por Lote
app.get('/query/planilha/lote/:lote', async (req, res) => {
  const { lote } = req.params;

  if (!lote) {
    return res.status(400).json({ error: "lote é obrigatório" });
  }

  try {
    const result = await withFabric(() => queryPlanilhaByLote(lote));
    
    if (!result) {
      return res.status(404).json({ error: "Planilhas não encontradas para este lote" });
    }
    
    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ============= ROTAS DE UPDATE/ATUALIZAÇÃO =============

// Grupo: Update Test
app.put('/update/test', async (req, res) => {
  const { testID, data } = req.body;

  if (!testID || !data) {
    return res.status(400).json({
      error: "testID e data são obrigatórios"
    });
  }

  try {
    await withFabric(() => updateTest(JSON.stringify(data), testID));

    res.json({
      message: "Teste atualizado com sucesso",
      testID
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ============= ROTAS ADICIONAIS (Legacy/Compatibilidade) =============

// Rota POST para query/test (mantida para compatibilidade)
app.post('/query/test', async (req, res) => {
  const { testID } = req.body;

  if (!testID) {
    return res.status(400).json({ error: "testID é obrigatório" });
  }

  try {
    const result = await withFabric(() => queryTestByID(testID));

    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Rota POST para query/image (mantida para compatibilidade)
app.post('/query/image', async (req, res) => {
  const { imageHash } = req.body;

  if (!imageHash) {
    return res.status(400).json({ error: "imageHash é obrigatório" });
  }

  try {
    const result = await withFabric(() => queryImageByHash(imageHash));

    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ============= ROTA DE HEALTH CHECK =============

app.get('/health', async (req, res) => {
  try {
    await withFabric(async () => {
      // Apenas inicializa e desconecta para testar conexão
      console.log("Conexão com Fabric testada com sucesso");
    });
    
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        fabric: "connected",
        server: "running"
      }
    });
  } catch (err) {
    res.status(500).json({
      status: "unhealthy",
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Inicialização do servidor
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});