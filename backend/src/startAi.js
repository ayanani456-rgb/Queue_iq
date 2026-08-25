// -----------------------------------------------------------------------------
// Auto-start the AI microservice alongside the Node server.
// -----------------------------------------------------------------------------
// When the backend boots, it also launches the FastAPI AI service (queueiq-ai)
// so you only run one command. It's best-effort:
//   • no Python / uvicorn installed  -> logs a note, backend keeps running with
//     local-fallback wait estimates (nothing breaks).
//   • START_AI=false                 -> skip auto-start entirely.
//   • AI_DIR / AI_SERVICE_URL        -> override the folder / port.
// The AI child is stopped when the backend exits.
// -----------------------------------------------------------------------------
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function startAi() {
  if (String(process.env.START_AI).toLowerCase() === 'false') {
    console.log('[ai] auto-start disabled (START_AI=false)');
    return;
  }

  // Find the AI service folder: AI_DIR wins, else look for a sibling folder
  // named "ai-microservice" (this layout) or "queueiq-ai" (older layout).
  const aiDir = process.env.AI_DIR
    || [
      path.resolve(__dirname, '..', '..', 'ai-microservice'),
      path.resolve(__dirname, '..', '..', 'queueiq-ai'),
    ].find((p) => fs.existsSync(path.join(p, 'main.py')))
    || path.resolve(__dirname, '..', '..', 'ai-microservice');
  if (!fs.existsSync(path.join(aiDir, 'main.py'))) {
    console.log(`[ai] AI service (main.py) not found at ${aiDir} — skipping (AI is optional).`);
    return;
  }

  const port = ((process.env.AI_SERVICE_URL || 'http://localhost:8000').match(/(\d+)\s*$/) || [])[1] || '8000';

  // Launchers to try, in order. AI_PYTHON (an absolute python.exe path) wins when
  // set — the reliable choice on Windows, where `python` may be the Store stub.
  const uviArgs = ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', port];
  const attempts = [];
  if (process.env.AI_PYTHON) attempts.push({ cmd: process.env.AI_PYTHON, args: uviArgs });
  attempts.push(
    { cmd: process.platform === 'win32' ? 'py' : 'python3', args: uviArgs },
    { cmd: 'python', args: uviArgs },
    { cmd: 'uvicorn', args: ['main:app', '--host', '127.0.0.1', '--port', port] },
  );

  let child = null;

  function tryNext(i) {
    if (i >= attempts.length) {
      console.log('[ai] could not start the AI service (Python/uvicorn not found or deps missing).');
      console.log('[ai] backend runs fine with local-fallback estimates. To enable AI:');
      console.log('[ai]   cd queueiq-ai && pip install -r requirements.txt   (one time)');
      return;
    }
    const a = attempts[i];
    let settled = false;
    let c;
    try {
      c = spawn(a.cmd, a.args, { cwd: aiDir, stdio: 'ignore' });
    } catch (e) {
      return tryNext(i + 1);
    }
    // command not found on this system -> try the next launcher
    c.on('error', () => { if (!settled) { settled = true; tryNext(i + 1); } });
    // exited before it could get going (e.g. missing python deps) -> try next
    c.on('exit', () => { if (!settled) { settled = true; tryNext(i + 1); } });
    // survived the startup window -> assume it's up
    setTimeout(() => {
      if (!settled) {
        settled = true;
        child = c;
        console.log(`[ai] AI service auto-started via "${a.cmd}" on http://127.0.0.1:${port}`);
      }
    }, 2500);
  }
  tryNext(0);

  // stop the AI child when the backend stops
  const stop = () => { if (child && !child.killed) { try { child.kill(); } catch (e) { /* ignore */ } } };
  process.on('exit', stop);
  process.on('SIGINT', () => { stop(); process.exit(0); });
  process.on('SIGTERM', () => { stop(); process.exit(0); });
}

module.exports = { startAi };
