async function handleTextAccountExpFlow(ctx, deps) {
  const {
    state,
    userState,
    db,
    logger,
    bot,
    GROUP_ID,
    isUserReseller,
    RESELLER_DISCOUNT,
    getUserFlagStatus,
    getCreateUsageToday,
    startWaiting,
    executeAccountServiceAction,
    processAccountPayment,
    upsertAccount,
    incrementServerCreateCount,
    sendAccountPurchaseGroupNotif,
    createvmess,
    createvless,
    createtrojan,
    createshadowsocks,
    createssh,
    renewvmess,
    renewvless,
    renewtrojan,
    renewshadowsocks,
    renewssh,
    runAccountPurchasePrecheck,
    resolveAccountServerQuota,
  } = deps;

  if (!state.step.startsWith('exp_')) return false;

  const quotaResult = await resolveAccountServerQuota(ctx, { state, db, logger });
  if (!quotaResult.ok) return true;

  const { username, password, exp, quota, iplimit, serverId, type, action } = state;

  const precheck = await runAccountPurchasePrecheck(ctx, {
    state,
    db,
    logger,
    isUserReseller,
    RESELLER_DISCOUNT,
    getUserFlagStatus,
    getCreateUsageToday,
  });
  if (!precheck.ok) return true;

  const { totalHarga } = precheck;
  let waitCtrl = null;
  let msg = '';

  waitCtrl = await startWaiting(ctx, '⏳ Sedang membuat akun...');
  msg = await executeAccountServiceAction({
    action,
    type,
    username,
    password,
    exp,
    quota,
    iplimit,
    serverId,
    createvmess,
    createvless,
    createtrojan,
    createshadowsocks,
    createssh,
    renewvmess,
    renewvless,
    renewtrojan,
    renewshadowsocks,
    renewssh,
  });

  if (action === 'create') {
    logger.info(`Account created and transaction recorded for user ${ctx.from.id}, type: ${type}`);
  } else if (action === 'renew') {
    logger.info(`Account renewed and transaction recorded for user ${ctx.from.id}, type: ${type}`);
  }

  if (msg.includes('❌')) {
    logger.error(`💤 Rollback saldo user ${ctx.from.id}, type: ${type}, server: ${serverId}, respon: ${msg}`);
    try { if (waitCtrl) await waitCtrl.stop('❌ Gagal membuat akun. Coba lagi ya.', true); } catch (_) {}
    await ctx.reply(msg, { parse_mode: 'Markdown' });
    return true;
  }

  logger.info(`✅ Transaksi sukses untuk user ${ctx.from.id}, type: ${type}, server: ${serverId}`);

  try {
    await processAccountPayment(ctx.from.id, totalHarga, type, action, serverId, username);
    upsertAccount(ctx.from.id, username, type, serverId, exp);
  } catch (err) {
    logger.error('⚠️ Gagal memproses pengurangan saldo & transaksi pembelian:', err.message);
  }

  await incrementServerCreateCount(db, logger, serverId);
  await sendAccountPurchaseGroupNotif(ctx, {
    bot,
    GROUP_ID,
    db,
    logger,
    isUserReseller,
    action,
    username,
    type,
    exp,
    serverId,
  });

  if (waitCtrl) await waitCtrl.stop('✅ Akun berhasil dibuat.', true);
  await ctx.reply(msg, { parse_mode: 'Markdown' });
  delete userState[ctx.chat.id];
  return true;
}

module.exports = { handleTextAccountExpFlow };
