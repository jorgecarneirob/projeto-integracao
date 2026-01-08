
// Importa o framework Express para criar o servidor
const express = require('express');
const cors = require('cors'); // Permite requisições de outros domínios (Front-end)
const app = express();
const PORT = 3000;

// Middleware para permitir JSON no corpo das requisições
app.use(express.json());

// Middleware para habilitar CORS (necessário para comunicação com Front-end)
app.use(cors());

// Rota GET simples para teste
app.get('/api/status', (req, res) => {
    res.json({ message: 'API está funcionando!' });
});

// Rota POST para receber dados do Front-end
app.post('/api/enviar', (req, res) => {
    const { nome, email } = req.body; // Captura dados enviados pelo Front-end
    console.log(`Recebido: Nome=${nome}, Email=${email}`);

    // Simula processamento e retorna resposta
    res.json({
        status: 'sucesso',
        dadosRecebidos: { nome, email },
        mensagem: 'Dados recebidos com sucesso!'
    });
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
