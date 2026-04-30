export default async function handler(req, res) {

  try {

    let cep;

    // aceita GET ou POST
    if (req.method === 'GET') {
      cep = req.query.cep;
    }

    if (req.method === 'POST') {
      cep = req.body?.cep;
    }

    if (!cep) {
      return res.status(400).json({ error: 'CEP obrigatório' });
    }

    return res.status(200).json({
      success: true,
      cep,
      message: 'API funcionando 🚀'
    });

  } catch (error) {
    return res.status(500).json({ error: 'Erro interno' });
  }

}