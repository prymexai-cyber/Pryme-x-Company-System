/**
 * requireCEO — only the two master admin accounts (role === 'CEO') pass.
 */
function requireCEO(req, res, next) {
  if (!req.user || req.user.role !== 'CEO') {
    return res.status(403).json({ error: 'CEO & Founder access required for this action.' });
  }
  next();
}

/**
 * requireFullAccess — CEOs always pass. Staff must have accessLevel === 'FULL'.
 * Governs: editing metrics, modifying clocks, creating chat groups, starting meetings.
 */
function requireFullAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (req.user.role === 'CEO' || req.user.accessLevel === 'FULL') {
    return next();
  }
  return res.status(403).json({ error: 'Full System Access is required for this action. You are on Preview Only.' });
}

module.exports = { requireCEO, requireFullAccess };
