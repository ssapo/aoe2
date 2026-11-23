// APP-22 local test page: runs genie-web.wasm (a wasm32-wasip1 command) in this worker with a
// minimal WASI shim. stdin = [every][piece count][len, bytes]...[rec len][rec]; stdout frames are posted to the
// page as they come: {tag, bytes}. The engine's switches are the census's defaults (env.txt).
'use strict';

class Exit extends Error { constructor(code) { super('exit ' + code); this.code = code; } }

const ERRNO = { SUCCESS: 0, BADF: 8, NOSYS: 52, SPIPE: 70 };

// pieces: the match data (one whole file, or the shared and civilization pieces, or the game's
// .dat and the four tables beside it); every 0 asks only for the match's civilizations
function run({ wasm, pieces, rec, every, env }) {
  const u32 = n => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; };
  const parts = [u32(every), u32(pieces.length), ...pieces.flatMap(p => [u32(p.byteLength), new Uint8Array(p)]), u32(rec.byteLength), new Uint8Array(rec)];
  const stdin = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  { let o = 0; for (const p of parts) { stdin.set(p, o); o += p.length; } }
  let stdinAt = 0;
  const enc = new TextEncoder();
  const envBytes = Object.entries(env).map(([k, v]) => enc.encode(k + '=' + v + '\0'));
  let out = new Uint8Array(1 << 20), outLen = 0;
  let errText = '';
  let memory;
  const view = () => new DataView(memory.buffer);
  const bytes = () => new Uint8Array(memory.buffer);
  const t0 = performance.now();

  function takeFrames() {
    let o = 0;
    while (outLen - o >= 8) {
      const dv = new DataView(out.buffer, out.byteOffset + o, 8);
      const tag = dv.getUint32(0, true), len = dv.getUint32(4, true);
      if (outLen - o - 8 < len) break;
      const payload = out.slice(o + 8, o + 8 + len);
      postMessage({ tag, bytes: payload.buffer, wall: performance.now() - t0 }, [payload.buffer]);
      o += 8 + len;
    }
    if (o) { out.copyWithin(0, o, outLen); outLen -= o; }
  }
  function appendOut(chunk) {
    if (outLen + chunk.length > out.length) {
      const bigger = new Uint8Array(Math.max(out.length * 2, outLen + chunk.length));
      bigger.set(out.subarray(0, outLen)); out = bigger;
    }
    out.set(chunk, outLen); outLen += chunk.length;
    takeFrames();
  }

  const wasi = {
    args_sizes_get(argc, size) { view().setUint32(argc, 0, true); view().setUint32(size, 0, true); return 0; },
    args_get() { return 0; },
    environ_sizes_get(count, size) {
      view().setUint32(count, envBytes.length, true);
      view().setUint32(size, envBytes.reduce((n, b) => n + b.length, 0), true); return 0;
    },
    environ_get(ptrs, buf) {
      for (const b of envBytes) { view().setUint32(ptrs, buf, true); ptrs += 4; bytes().set(b, buf); buf += b.length; }
      return 0;
    },
    fd_write(fd, iovs, n, written) {
      let total = 0;
      for (let i = 0; i < n; i++) {
        const p = view().getUint32(iovs + 8 * i, true), l = view().getUint32(iovs + 8 * i + 4, true);
        const chunk = bytes().slice(p, p + l); total += l;
        if (fd === 1) appendOut(chunk);
        else if (fd === 2) { errText += new TextDecoder().decode(chunk); if (errText.length > 200000) errText = errText.slice(-100000); }
      }
      view().setUint32(written, total, true); return 0;
    },
    fd_read(fd, iovs, n, read) {
      if (fd !== 0) return ERRNO.BADF;
      let total = 0;
      for (let i = 0; i < n; i++) {
        const p = view().getUint32(iovs + 8 * i, true), l = view().getUint32(iovs + 8 * i + 4, true);
        const take = Math.min(l, stdin.length - stdinAt);
        bytes().set(stdin.subarray(stdinAt, stdinAt + take), p); stdinAt += take; total += take;
        if (take < l) break;
      }
      view().setUint32(read, total, true); return 0;
    },
    fd_close() { return 0; },
    fd_seek() { return ERRNO.SPIPE; },
    fd_fdstat_get(fd, ptr) {
      if (fd > 2) return ERRNO.BADF;
      const dv = view(); dv.setUint8(ptr, 2); dv.setUint16(ptr + 2, 0, true);
      dv.setBigUint64(ptr + 8, 0xffffffffffffffffn, true); dv.setBigUint64(ptr + 16, 0xffffffffffffffffn, true);
      return 0;
    },
    fd_prestat_get() { return ERRNO.BADF; },
    fd_prestat_dir_name() { return ERRNO.BADF; },
    proc_exit(code) { throw new Exit(code); },
    clock_time_get(id, precision, ptr) {
      const ns = BigInt(Math.round((id === 0 ? Date.now() : performance.now()) * 1e6));
      view().setBigUint64(ptr, ns, true); return 0;
    },
    random_get(ptr, len) { crypto.getRandomValues(bytes().subarray(ptr, ptr + len)); return 0; },
    sched_yield() { return 0; },
  };
  const module = new WebAssembly.Module(wasm);
  const imports = { wasi_snapshot_preview1: {} };
  for (const imp of WebAssembly.Module.imports(module)) {
    if (imp.module !== 'wasi_snapshot_preview1') continue;
    imports.wasi_snapshot_preview1[imp.name] = wasi[imp.name] || (() => ERRNO.NOSYS);
  }
  const instance = new WebAssembly.Instance(module, imports);
  memory = instance.exports.memory;
  let code = 0;
  try { instance.exports._start(); } catch (e) { if (e instanceof Exit) code = e.code; else { postMessage({ crash: String(e), stderr: errText.slice(-4000) }); return; } }
  takeFrames();
  postMessage({ done: true, code, wall: performance.now() - t0, memory: memory.buffer.byteLength, stderr: errText.slice(-4000) });
}

onmessage = e => { try { run(e.data); } catch (err) { postMessage({ crash: String(err && err.stack || err) }); } };
