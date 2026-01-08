
/**
 * Servidor Express com gravação de dados em arquivos (JSONL e CSV).
 * - Recebe { nome, email } via POST /api/enviar
 * - Valida o payload
 * - Grava cada submissão em:
 *     data/submissoes.jsonl  (JSON Lines)
 *     data/submissoes.csv    (Comma-Separated Values)
 * - Responde com confirmação e eco dos dados
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');                // Versão callback/sync
const fsp = require('fs/promises');      // Versão assíncrona (promises)
const path = require('path');

const app = express();
const PORT = 3000;

// === Configurações de caminho ===
const DATA_DIR = path.join(__dirname, '..', 'data'); // pasta "data" ao lado de backend/
const JSONL_PATH = path.join(DATA_DIR, 'submissoes.jsonl');
const CSV_PATH   = path.join(DATA_DIR, 'submissoes.csv');

// === Middlewares globais ===
app.use(cors());            // Habilita CORS para o front-end
app.use(express.json());    // Parseia JSON no corpo das requisições

// Middleware de log simples
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// === Funções utilitárias ===

/**
 * Garante que a pasta e os arquivos existam.
 * - Cria a pasta data/
 * - Cria JSONL vazio (se não existir)
 * - Cria CSV com cabeçalho (se não existir)
 */
async function ensureStorage() {
  try {
    await fsp.mkdir(DATA_DIR, { recursive: true });

    // Cria o arquivo JSONL se não existir
    try {
      await fsp.access(JSONL_PATH, fs.constants.F_OK);
    } catch {
      await fsp.writeFile(JSONL_PATH, '', 'utf8'); // vazio
      console.log(`Criado: ${JSONL_PATH}`);
    }

    // Cria o arquivo CSV com cabeçalho se não existir
    try {
      await fsp.access(CSV_PATH, fs.constants.F_OK);
    } catch {
      const header = 'timestamp,nome,email\n';
      await fsp.writeFile(CSV_PATH, header, 'utf8');
      console.log(`Criado: ${CSV_PATH}`);
    }
  } catch (err) {
    console.error('Falha ao preparar armazenamento:', err);
    throw err;
  }
}

/**
 * Valida o payload recebido.
 * Retorna um objeto { ok: boolean, message?: string }
 */
function validatePayload(body) {
  const { nome, email } = body;

  if (!nome || typeof nome !== 'string' || nome.trim().length < 2) {
    return { ok: false, message: 'Nome inválido. Use ao menos 2 caracteres.' };
  }

  const emailRegex = /^\S+@\S+\.\S+$/;
  if (!email || typeof email !== 'string' || !emailRegex.test(email)) {
    return { ok: false, message: 'Email inválido.' };
  }

  return { ok: true };
}

/**
 * Escapa valores para CSV (lida com vírgulas, aspas e quebras de linha).
 */
function toCSVCell(value) {
  if (value == null) return '';
  const str = String(value);
  // Se contiver vírgula, aspas ou quebra de linha, envolve em aspas e escapa aspas internas
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Persiste a submissão em JSONL e CSV.
 * - JSONL: uma linha JSON por submissão
 * - CSV: adiciona linha com timestamp, nome, email
 */
async function persistSubmission({ nome, email }) {
  const timestamp = new Date().toISOString();

  // Monta objeto para JSONL
  const record = { timestamp, nome, email };
  const jsonlLine = JSON.stringify(record) + '\n';

  // Monta linha CSV
  const csvLine = [
    toCSVCell(timestamp),
    toCSVCell(nome),
    toCSVCell(email)
  ].join(',') + '\n';

  // Append nos dois arquivos
  await fsp.appendFile(JSONL_PATH, jsonlLine, 'utf8');
  await fsp.appendFile(CSV_PATH, csvLine, 'utf8');

  return record;
}

// === Rotas ===

// Saúde da API
app.get('/api/status', (req, res) => {
  res.json({ message: 'API está funcionando!', time: new Date().toISOString() });
});

// Recebe e grava dados

app.post('/api/enviar', async (req, res, next) => {
  try {
    // 1) Validação
    const check = validatePayload(req.body);
    if (!check.ok) {
      console.log("❌ Payload inválido recebido:", req.body);  // <-- LOG DO ERRO
      return res.status(400).json({ status: 'erro', message: check.message });
    }

    const { nome, email } = req.body;

    // 2) LOG BONITO NO CONSOLE
    console.log("📩 Dados recebidos do Front-end:");
    console.log("------------------------------------");
    console.log("Nome :", nome);
    console.log("Email:", email);
    console.log("Data :", new Date().toLocaleString());
    console.log("------------------------------------\n");

    // 3) Garante diretórios/arquivos
    await ensureStorage();

    // 4) Persiste dados
    const saved = await persistSubmission({ nome, email });

    // 5) Responde
    res.json({
      status: 'sucesso',
      mensagem: 'Dados gravados com sucesso.',
      dadosRecebidos: saved
    });
  } catch (err) {
    next(err);
  }
});

// === Middleware de erro (sempre por último) ===
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({
    status: 'erro',
    message: 'Erro interno ao processar a requisição.'
  });
});

// === Inicializa servidor ===
app.listen(PORT, async () => {
  try {
    await ensureStorage();
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`JSONL: ${JSONL_PATH}`);
    console.log(`CSV  : ${CSV_PATH}`);
  } catch (err) {
    console.error('Falha ao iniciar armazenamento. O servidor ainda está ativo, mas gravações podem falhar.');
  }
});