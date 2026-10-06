// Copy, share and save — always by the visitor's own action, never automatically.

/** Copy text. Falls back to selecting `selectNode` so the visitor can copy manually. */
export async function copyText(text, selectNode = null) {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through */ }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:-1000px;opacity:0';
  document.body.append(area);
  area.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  area.remove();
  if (!ok && selectNode) {
    const range = document.createRange();
    range.selectNodeContents(selectNode);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
  return ok;
}

export function canShareText() { return typeof navigator.share === 'function'; }

/** Share plain text through the system sheet. Resolves 'shared' | 'cancelled' | 'unsupported'. */
export async function shareText({ title, text }) {
  if (!canShareText()) return 'unsupported';
  try { await navigator.share({ title, text }); return 'shared'; } catch (error) {
    return error?.name === 'AbortError' ? 'cancelled' : 'unsupported';
  }
}

/** Prepare a File ahead of the tap (iOS needs share() called synchronously in the gesture). */
export function fileFromBlob(blob, name) { return new File([blob], name, { type: blob.type || 'image/png' }); }

export function canShareFile(file) {
  try { return Boolean(navigator.canShare?.({ files: [file] })); } catch { return false; }
}

/** Call inside a click handler with a pre-made File. Falls back to a download. */
export function shareOrDownload(file, title = '') {
  if (canShareFile(file) && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
    return navigator.share({ files: [file], title }).then(() => 'shared').catch((error) => (error?.name === 'AbortError' ? 'cancelled' : download(file, file.name)));
  }
  return Promise.resolve(download(file, file.name));
}

export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return 'downloaded';
}

function wrapLines(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) { lines.push(line); line = word; } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

const FLOWER = new Path2D('M30 28C9 18 18 2 27 10c3 3 3 12 3 18Zm2 0C32 5 51 9 47 20c-2 4-9 7-15 8Zm1 3c20-12 27 6 16 10-5 2-11-5-16-10Zm-2 3c18 14 4 27-3 18-3-4 1-12 3-18Zm-4-1C23 54 5 45 13 36c3-3 9-3 14-3Zm-1-3C4 34 3 14 13 15c6 1 10 10 13 15Z');

/**
 * Render a calm phrase card as a PNG Blob.
 * renderCard({ text, caption, footer, theme: 'day' | 'night' | 'peach', size: 'story' | 'square' | 'phone' })
 * 'phone' is a lock-screen picture: tall, with the phrase below the middle so the clock does not cover it.
 */
export async function renderCard({ text, caption = '', footer = '', theme = 'day', size = 'story' } = {}) {
  const [width, height] = size === 'square' ? [1080, 1080] : size === 'phone' ? [1170, 2532] : [1080, 1350];
  const palettes = {
    day: { bg: '#f8f7f2', ink: '#2f3b31', accent: '#b47a60', soft: '#e5ebdb', line: '#6f8560' },
    night: { bg: '#171d19', ink: '#ece8dd', accent: '#dba486', soft: '#232c26', line: '#a9bea6' },
    peach: { bg: '#f2e8dd', ink: '#2f3b31', accent: '#8f5a43', soft: '#eadccd', line: '#b47a60' },
  };
  const p = palettes[theme] || palettes.day;
  try { await Promise.all([document.fonts.load('italic 400 72px Cormorant'), document.fonts.load('400 30px Inter')]); } catch { /* fallback fonts */ }
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = p.bg; ctx.fillRect(0, 0, width, height);
  // soft window light
  const glow = ctx.createRadialGradient(width * 0.78, height * 0.12, 40, width * 0.78, height * 0.12, width * 0.9);
  glow.addColorStop(0, theme === 'night' ? 'rgba(231,167,127,.22)' : 'rgba(255,246,220,.9)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
  // arch frame
  ctx.strokeStyle = p.line; ctx.globalAlpha = 0.35; ctx.lineWidth = 2;
  const ax = 90, ay = 90, aw = width - 180, ah = height - 180, r = aw / 2;
  ctx.beginPath(); ctx.moveTo(ax, ay + r); ctx.arc(ax + r, ay + r, r, Math.PI, 0); ctx.lineTo(ax + aw, ay + ah); ctx.lineTo(ax, ay + ah); ctx.closePath(); ctx.stroke();
  ctx.globalAlpha = 1;
  // flower
  ctx.save(); ctx.translate(width / 2 - 45, size === 'phone' ? height * 0.4 : ay + 150); ctx.scale(1.5, 1.5);
  ctx.strokeStyle = p.line; ctx.lineWidth = 1.4; ctx.stroke(FLOWER); ctx.restore();
  // phrase
  ctx.fillStyle = p.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  let fontSize = 76;
  let lines;
  do {
    ctx.font = `italic 400 ${fontSize}px Cormorant, Georgia, serif`;
    lines = wrapLines(ctx, text, aw - 120);
    fontSize -= 4;
  } while (lines.length * fontSize * 1.18 > (size === 'phone' ? 900 : ah - 420) && fontSize > 40);
  fontSize += 4;
  const lineHeight = fontSize * 1.18;
  const blockTop = size === 'phone'
    ? height * 0.56 - (lines.length * lineHeight) / 2
    : ay + 300 + Math.max(0, (ah - 420 - lines.length * lineHeight) / 2);
  lines.forEach((line, index) => ctx.fillText(line, width / 2, blockTop + (index + 1) * lineHeight));
  if (caption) {
    ctx.fillStyle = p.accent; ctx.font = '400 30px Inter, Arial, sans-serif';
    ctx.fillText(caption, width / 2, ay + ah - 70);
  }
  if (footer) {
    ctx.fillStyle = p.ink; ctx.globalAlpha = .55; ctx.font = '400 24px Inter, Arial, sans-serif';
    ctx.fillText(footer, width / 2, height - 44); ctx.globalAlpha = 1;
  }
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}
