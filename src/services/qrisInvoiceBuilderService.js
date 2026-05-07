function createQrisInvoiceBuilderService({
  getGopayApiKey,
  generateUniqueSuffix,
  generateGopayQris,
  parseProviderTransactionTime,
  qrisAutoTopupMax,
  qrisPaymentTimeoutMin,
}) {
  async function createQrisInvoice(baseAmount, noteOrReference, forcedUniqueSuffix = null) {
    const base_amount = Number(baseAmount);
    if (!Number.isFinite(base_amount) || base_amount <= 0) {
      throw new Error('Nominal baseAmount tidak valid');
    }

    const gopayApiKey = getGopayApiKey();
    if (!gopayApiKey) {
      throw new Error('GOPAY_API_KEY belum diisi di .vars.json');
    }

    let unique_suffix = Number.isFinite(Number(forcedUniqueSuffix))
      ? Number(forcedUniqueSuffix)
      : generateUniqueSuffix(50, 200);
    let amount = base_amount + unique_suffix;

    if (typeof qrisAutoTopupMax !== 'undefined') {
      const max = Number(qrisAutoTopupMax);
      if (Number.isFinite(max) && amount > max) {
        const diff = max - base_amount;
        if (diff >= 50) {
          unique_suffix = Math.min(diff, 200);
          amount = base_amount + unique_suffix;
        } else {
          unique_suffix = 0;
          amount = base_amount;
        }
      }
    }

    const generated = await generateGopayQris(amount);
    const invoice_id = String(generated.order_id || `GOPAY-${Date.now()}`);
    const qris_image_url = String(generated.qr_url || '').trim() || null;
    const qris_text = String(generated.qr_string || '').trim() || null;

    return {
      invoice_id,
      amount,
      base_amount,
      unique_suffix,
      qris_image_url,
      qris_image_path: null,
      payment_link: null,
      qris_text,
      expired:
        parseProviderTransactionTime(generated.expiry_time) ||
        (Date.now() + Number(qrisPaymentTimeoutMin || 10) * 60 * 1000),
      provider_transaction_id: generated.transaction_id || null,
      provider_transaction_time: generated.transaction_time || null,
      provider_status: generated.transaction_status || 'pending',
      provider_payment_type: 'qris',
      provider_issuer: 'gopay',
      raw: {
        provider: 'gopay_sawargipay',
        note: String(noteOrReference || ''),
        response: generated,
      },
    };
  }

  return { createQrisInvoice };
}

module.exports = { createQrisInvoiceBuilderService };
