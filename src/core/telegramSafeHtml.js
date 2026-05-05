function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function mdToHtml(text) {
  if (text == null) return '';

  let escaped = escapeHtml(text);
  escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
  escaped = escaped.replace(/\*([^*]+)\*/g, '<b>$1</b>');

  return escaped;
}

module.exports = {
  escapeHtml,
  mdToHtml,
};
