function createGopayQrisApi({ axios, getApiKey, baseUrl }) {
  async function fetchTransactions() {
    const gopayApiKey = getApiKey();
    if (!gopayApiKey) {
      throw new Error('GOPAY_API_KEY belum diisi di .vars.json');
    }

    const res = await axios.post(
      `${baseUrl}/transactions`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${gopayApiKey}`,
        },
        timeout: 15000,
      }
    );

    if (!res.data?.success) {
      throw new Error(res.data?.message || 'Gagal mengambil transaksi GoPay');
    }

    return Array.isArray(res.data?.data?.transactions)
      ? res.data.data.transactions
      : [];
  }

  async function generateQris(amount) {
    const gopayApiKey = getApiKey();
    if (!gopayApiKey) {
      throw new Error('GOPAY_API_KEY belum diisi di .vars.json');
    }

    const nominal = Number(amount || 0);
    if (!Number.isFinite(nominal) || nominal <= 0) {
      throw new Error('Nominal QRIS tidak valid');
    }

    const res = await axios.post(
      `${baseUrl}/qris/generate`,
      { amount: nominal },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${gopayApiKey}`,
        },
        timeout: 15000,
      }
    );

    if (!res.data?.success || !res.data?.data?.transaction_id) {
      throw new Error(res.data?.message || 'Gagal membuat QRIS GoPay');
    }

    return res.data.data;
  }

  async function fetchQrisStatus(transactionId) {
    const gopayApiKey = getApiKey();
    if (!gopayApiKey) {
      throw new Error('GOPAY_API_KEY belum diisi di .vars.json');
    }

    const txid = String(transactionId || '').trim();
    if (!txid) {
      throw new Error('transaction_id kosong');
    }

    const res = await axios.post(
      `${baseUrl}/qris/status`,
      { transaction_id: txid },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${gopayApiKey}`,
        },
        timeout: 15000,
      }
    );

    if (!res.data?.data) {
      throw new Error(res.data?.message || 'Gagal mengecek status QRIS');
    }

    return res.data;
  }

  return {
    fetchTransactions,
    generateQris,
    fetchQrisStatus,
  };
}

module.exports = { createGopayQrisApi };
