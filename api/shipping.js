export default async function handler(req, res) {

  // =========================
  // CORS
  // =========================
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // =========================
  // INPUT
  // =========================
  const cep = req.method === 'POST' ? req.body?.cep : req.query?.cep;
  const items = req.method === 'POST' ? req.body?.items : [];

  if (!cep) {
    return res.status(400).json({ error: 'CEP obrigatório' });
  }

  const cepLimpo = cep.replace(/\D/g, '');
  const cepNum = parseInt(cepLimpo);

  try {

    // =========================
    // RETIRADA
    // =========================
    let retirada = null;
    if (cepNum >= 80000000 && cepNum <= 83800999) {
      retirada = {
        nome: "Retirada na Loja",
        preco: 0,
        prazo: "Imediato"
      };
    }

    // =========================
    // MOTOBOY
    // =========================
    const faixasMotoboy = [
      { nome: "Curitiba", inicio: 80000000, fim: 82999999, valor: 9.90 },
      { nome: "São José dos Pinhais", inicio: 83000001, fim: 83189999, valor: 13.90 },
      { nome: "Pinhais", inicio: 83320001, fim: 83349999, valor: 14.90 },
      { nome: "Piraquara", inicio: 83300001, fim: 83319999, valor: 14.90 },
      { nome: "Colombo", inicio: 83400001, fim: 83419999, valor: 14.90 },
      { nome: "Almirante Tamandaré", inicio: 83500001, fim: 83534999, valor: 14.90 },
      { nome: "Araucária", inicio: 83700001, fim: 83729999, valor: 14.90 }
    ];

    const motoboyMatch = faixasMotoboy.find(f => cepNum >= f.inicio && cepNum <= f.fim) || null;

    // =========================
    // PRODUTOS (DEFAULT SE NÃO VIER)
    // =========================
    const listaProdutos = (items && items.length > 0)
      ? items.map(item => ({
          Weight: parseFloat(item.Weight) || 0.5,
          Length: parseFloat(item.Length) || 16,
          Height: parseFloat(item.Height) || 11,
          Width: parseFloat(item.Width) || 11,
          Quantity: parseInt(item.Quantity) || 1,
          Category: "Default"
        }))
      : [{
          Weight: 0.5,
          Length: 16,
          Height: 11,
          Width: 11,
          Quantity: 1,
          Category: "Default"
        }];

    // =========================
    // CHAMADA FRENET (CORRIGIDA)
    // =========================
    const frenetRes = await fetch('https://api.frenet.com.br/shipping/quote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'token': process.env.FRENET_TOKEN
      },
      body: JSON.stringify({
        SellerCEP: "81450-420",
        RecipientCEP: cepLimpo,
        ShipmentInvoiceValue: 100,
        ShippingItemArray: listaProdutos
      })
    });

    if (!frenetRes.ok) {
      const text = await frenetRes.text();
      return res.status(500).json({
        error: 'Erro na Frenet',
        detalhe: text
      });
    }

    const data = await frenetRes.json();

    // =========================
    // DEBUG (pode remover depois)
    // =========================
    console.log("FRENET RAW:", JSON.stringify(data));

    // =========================
    // TRATAMENTO DOS FRETES
    // =========================
    let fretesFrenet = [];

    if (data && data.ShippingSevicesArray) {
      fretesFrenet = data.ShippingSevicesArray
        .filter(s => !s.Error && parseFloat(s.ShippingPrice) > 0)
        .map(s => ({
          nome: s.ServiceDescription,
          preco: parseFloat(s.ShippingPrice),
          prazo: parseInt(s.DeliveryTime) || null
        }));
    }

    // =========================
    // FALLBACK SE NÃO VIER NADA
    // =========================
    if (fretesFrenet.length === 0) {
      console.warn("Nenhum frete válido retornado da Frenet");
    }

    // =========================
    // RESPOSTA FINAL
    // =========================
    return res.status(200).json({
      success: true,
      cep: cepLimpo,
      retirada,
      motoboy: motoboyMatch,
      fretes: fretesFrenet
    });

  } catch (error) {
    console.error("ERRO API:", error);

    return res.status(500).json({
      error: 'Erro ao calcular frete',
      detalhe: error.message
    });
  }
}