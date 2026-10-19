// Local REPL helper. Receives an already documented public CDP capability;
// does not discover browsers, connect to ports, or choose/submit answers.
import fs from 'node:fs/promises';
import path from 'node:path';

export async function createCodexSession({ cdp, skillRoot, runDir, reserveMs = 50000, maxBudgetMs = 10000 }) {
  if (!cdp || typeof cdp.send !== 'function' || !Number.isInteger(reserveMs) || reserveMs < 5000 || reserveMs > 60000)
    throw new Error('A public CDP capability and a 5000..60000 ms reserve are required');
  if (!Number.isInteger(maxBudgetMs) || maxBudgetMs < 0 || maxBudgetMs > 20000)
    throw new Error('The verified per-command budget must be 0..20000 ms');
  const names = { observe: 'codex_observe_video.js', mute: 'codex_mute_video.js', quiz: 'codex_video_quiz.js' };
  const sources = Object.fromEntries(await Promise.all(Object.entries(names).map(async ([key, name]) =>
    [key, await fs.readFile(path.join(skillRoot, 'scripts', name), 'utf8')])));
  const transaction = await fs.readFile(path.join(skillRoot, 'scripts/codex_video_transaction.js'), 'utf8');
  await fs.mkdir(runDir, { recursive: true });
  let previous = null, sequence = 0;
  const overheads = [];
  return {
    async run(mode, identity, args = {}) {
      const reserve = Math.max(reserveMs, ...overheads.map(value => value + 5000));
      const budget = Math.max(0, Math.min(args.budget_ms ?? maxBudgetMs, maxBudgetMs, 60000 - reserve));
      const options = { ...args, ...identity, mode, budget_ms: Math.floor(budget), previous };
      const expression = '(' + transaction + ')({' + Object.entries(sources).map(([key, value]) => key + ':(' + value + ')').join(',') + '},' + JSON.stringify(options) + ')';
      const started = Date.now();
      let result, transport = 'ok';
      try {
        const reply = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true },
          { timeoutMs: Math.min(55000, budget + 5000) });
        result = reply?.result?.value;
        if (!result || reply.exceptionDetails) { result = { ok: false, reason: 'missing-runtime-result' }; transport = 'unconfirmed'; }
      } catch (error) {
        const message = String(error?.message || '');
        result = { ok: false, reason: 'transport-unconfirmed', action_may_have_occurred: mode !== 'watch',
          transport_error: /timeout|timed out/i.test(message) ? 'timeout' : /denied|not permitted|unsupported/i.test(message) ? 'unsupported-or-denied' : 'other' };
        transport = 'unconfirmed';
      }
      const elapsed = Date.now() - started;
      if (transport === 'ok' && Number.isFinite(result.elapsed_ms)) {
        overheads.push(Math.max(0, elapsed - result.elapsed_ms));
        if (overheads.length > 3) overheads.shift();
      }
      previous = result.observation?.ok ? result.observation : null;
      const record = { sequence: ++sequence, at: new Date().toISOString(), mode, transport,
        tool_calls: 1, elapsed_ms: elapsed, browser_elapsed_ms: result.elapsed_ms ?? null,
        budget_ms: budget, request_bytes: Buffer.byteLength(expression), response_bytes: Buffer.byteLength(JSON.stringify(result)),
        actual_tokens: null, result };
      const observation = result.observation;
      const summary = { ok: result.ok, reason: result.reason, elapsed_ms: elapsed, browser_elapsed_ms: result.elapsed_ms,
        from: result.from, to: result.to, duration: observation?.duration, checks: result.checks,
        ...(mode === 'answer' ? { answer_correct: result.answer_correct === true } : {}),
        ...(observation?.details ? { details: observation.details } : {}),
        ...(observation?.quiz?.visible ? { quiz: observation.quiz } : {}),
        ...(observation?.diagnostics ? { diagnostics: observation.diagnostics } : {}),
        ...(!result.ok ? { failure: {
          action_may_have_occurred: result.action_may_have_occurred ?? (mode !== 'watch' && !!result.receipts?.some(item => item.action_attempted)),
          transport_error: result.transport_error,
          guard_code: result.result?.error?.code ?? result.receipts?.at(-1)?.error?.code,
          last_state: result.result?.after?.state, last_verdict: result.result?.after?.verdict,
          result_trace: result.result_trace?.slice(-5)
        } } : {}) };
      record.summary_json_bytes = Buffer.byteLength(JSON.stringify(summary));
      await fs.appendFile(path.join(runDir, 'transactions.jsonl'), JSON.stringify(record) + '\n');
      return summary;
    }
  };
}
