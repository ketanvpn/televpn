async function logAdminAction(db, payload) {
  const {
    adminUserId,
    action,
    targetUserId = null,
    targetRef = null,
    detail = null,
  } = payload;

  return db.run(
    `INSERT INTO admin_audit_logs (
      admin_user_id, action, target_user_id, target_ref, detail, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      Number(adminUserId || 0),
      String(action || '').trim(),
      targetUserId ? Number(targetUserId) : null,
      targetRef ? String(targetRef) : null,
      detail ? String(detail) : null,
      Date.now(),
    ]
  );
}

async function listRecentAdminLogs(db, limit = 30) {
  return db.all(
    `SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT ?`,
    [Number(limit || 30)]
  );
}

module.exports = {
  logAdminAction,
  listRecentAdminLogs,
};
