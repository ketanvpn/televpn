async function executeAccountServiceAction(deps) {
  const {
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
  } = deps;

  if (action === 'create') {
    if (type === 'vmess') return createvmess(username, exp, quota, iplimit, serverId);
    if (type === 'vless') return createvless(username, exp, quota, iplimit, serverId);
    if (type === 'trojan') return createtrojan(username, exp, quota, iplimit, serverId);
    if (type === 'shadowsocks') return createshadowsocks(username, exp, quota, iplimit, serverId);
    if (type === 'ssh') return createssh(username, password, exp, iplimit, serverId);
  }

  if (action === 'renew') {
    if (type === 'vmess') return renewvmess(username, exp, quota, iplimit, serverId);
    if (type === 'vless') return renewvless(username, exp, quota, iplimit, serverId);
    if (type === 'trojan') return renewtrojan(username, exp, quota, iplimit, serverId);
    if (type === 'shadowsocks') return renewshadowsocks(username, exp, quota, iplimit, serverId);
    if (type === 'ssh') return renewssh(username, exp, iplimit, serverId);
  }

  return '';
}

module.exports = { executeAccountServiceAction };
