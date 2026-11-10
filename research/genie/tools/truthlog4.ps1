# Read-only ground-truth logger for AoE2DE_s.exe 101.103.57257.0 (#188329).
# Reads each player's live objects (the same fields WorldPlayerBase::create_checksum sums) once per world-time change.
# v4: units (type 70) also get, for the first 180 s: plain position/forward/right (+0x3bc..+0x3e0), velocity data (+0x400), path state (+0x3f0, 0x48 bytes) and up to 8 waypoints of its path (+0x18 -> +0x438).
param([string]$Out = "$PSScriptRoot\truth4.jsonl", [int]$MaxSeconds = 3600, [int]$MaxWorldMs = 900000)
Add-Type -TypeDefinition @"
using System; using System.IO; using System.Text; using System.Diagnostics; using System.Runtime.InteropServices; using System.Globalization;
public static class Truth4 {
 [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint a, bool b, int pid);
 [DllImport("kernel32.dll", SetLastError=true)] static extern bool ReadProcessMemory(IntPtr h, IntPtr addr, byte[] buf, IntPtr n, out IntPtr got);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
 static IntPtr H; static byte[] B8 = new byte[8];
 static bool Rd(long a, byte[] b, int n) { IntPtr g; return a > 0x10000 && ReadProcessMemory(H, new IntPtr(a), b, new IntPtr(n), out g) && g.ToInt64() == n; }
 static long Q(long a) { return Rd(a, B8, 8) ? BitConverter.ToInt64(B8, 0) : 0; }
 static int D(long a) { return Rd(a, B8, 4) ? BitConverter.ToInt32(B8, 0) : 0; }
 static float F32(uint bits) { return BitConverter.ToSingle(BitConverter.GetBytes(bits), 0); }
 public static string Run(string outPath, int maxSeconds, int maxWorldMs) {
  var sw = Stopwatch.StartNew(); Process p = null;
  while (p == null && sw.Elapsed.TotalSeconds < maxSeconds) { var ps = Process.GetProcessesByName("AoE2DE_s"); if (ps.Length > 0) p = ps[0]; else System.Threading.Thread.Sleep(1000); }
  if (p == null) return "no game";
  H = OpenProcess(0x0410, false, p.Id); if (H == IntPtr.Zero) return "OpenProcess failed " + Marshal.GetLastWin32Error();
  long b = 0; while (b == 0 && sw.Elapsed.TotalSeconds < maxSeconds) { try { b = p.MainModule.BaseAddress.ToInt64(); } catch { System.Threading.Thread.Sleep(500); } }
  if (D(b + 0x3c) == 0) return "cannot read image";
  int pe = D(b + 0x3c); if (D(b + pe + 8) != 0x6acf93a9 || D(b + pe + 0x50) != 0x4f24000) return "wrong build";
  var ci = CultureInfo.InvariantCulture; long lines = 0; int last = -1; byte[] ob = new byte[0x420]; byte[] psb = new byte[0x48]; byte[] wpb = new byte[96]; byte[] vb = new byte[0x18]; byte[] ab = new byte[0x70]; byte[] rb = new byte[0x60]; int lastLogged = -100000; var sb = new StringBuilder(65536);
  using (var w = new StreamWriter(outPath, false, new UTF8Encoding(false))) {
   while (sw.Elapsed.TotalSeconds < maxSeconds && !p.HasExited) {
    long game = Q(b + 0x43552b8); long world = game == 0 ? 0 : Q(game + 0x5c0);
    if (world == 0) { System.Threading.Thread.Sleep(200); continue; }
    long clock = Q(world + 0x228); int t1 = clock == 0 ? -1 : D(clock + 0x18);
    if (t1 < 0 || t1 == last) { System.Threading.Thread.Sleep(0); continue; }
    if (t1 > 120000 && t1 - lastLogged < 200 && t1 >= lastLogged) { last = t1; continue; }
    if (t1 > maxWorldMs) break;
    long pb = Q(world + 0x770), pend = Q(world + 0x778); long np = (pend - pb) / 16; if (pb == 0 || np < 2 || np > 16) { System.Threading.Thread.Sleep(50); continue; }
    sb.Length = 0; sb.Append("{\"ms\":").Append(t1); if (Rd(b + 0x4354d00, rb, 0x60)) sb.Append(",\"airng\":\"").Append(BitConverter.ToString(rb).Replace("-", "")).Append("\""); sb.Append(",\"players\":["); bool ok = true;
    for (int i = 0; i < np && ok; i++) {
     long pl = Q(pb + 16 * i); if (pl == 0) { ok = false; break; }
     long list = Q(pl + 0x30); long arr = Q(list + 8); int n = D(list + 0x10); if (n < 0 || n > 5000) { ok = false; break; }
     if (i > 0) sb.Append(','); sb.Append("{\"p\":").Append(D(pl + 0x648)).Append(",\"sleep\":").Append(D(Q(pl + 0x38) + 0x10)).Append(",\"res\":["); long ra = Q(pl + 0x98); for (int r = 0; r < 4; r++) { ulong e = unchecked((ulong)Q(ra + 8L * r)); uint lo = unchecked((uint)(((e ^ 0xa8cf267a3f737c66UL) + 0xfbd53bd68903310bUL) ^ 0xa9834b738a7dd167UL)); if (r > 0) sb.Append(','); sb.Append(F32(lo).ToString("R", ci)); } sb.Append("],\"o\":[");
     int wrote = 0; for (int k = 0; k < n; k++) {
      long o = Q(arr + 8L * k); if (!Rd(o, ob, 0x420)) { ok = false; break; }
      int id = BitConverter.ToInt32(ob, 8);
      long mp = unchecked(BitConverter.ToInt64(ob, 0x10) - 0x4ef290fb1bb31c56L);
      ulong mq = unchecked((ulong)Q(mp + 0x18)); short mid = unchecked((short)((mq ^ 0xab0318a63f13e48fUL) + 0x8843e0230f22648dUL));
      float held = BitConverter.ToSingle(ob, 0x168);
      float x = F32(unchecked((uint)(BitConverter.ToUInt64(ob, 0x170) + 0x4d086415325b1a2bUL)));
      float y = F32(unchecked((uint)((BitConverter.ToUInt64(ob, 0x178) ^ 0xbbadc6d6e9b81de2UL) + 0x3c682b96db105333UL)));
      long ai = BitConverter.ToInt64(ob, 0x1f0); int timer = -1, t174 = -1, t178 = -1, t17c = -1;
      if (ai != 0 && Rd(ai + 0x170, ab, 0x70)) { timer = BitConverter.ToInt32(ab, 0x64); t174 = BitConverter.ToInt32(ab, 4); t178 = BitConverter.ToInt32(ab, 8); t17c = BitConverter.ToInt32(ab, 0xc); }
      if (wrote > 0) sb.Append(','); wrote++;
      sb.Append('[').Append(id).Append(',').Append(mid).Append(',').Append(ob[0x188]).Append(',').Append(held.ToString("R", ci)).Append(',').Append(x.ToString("R", ci)).Append(',').Append(y.ToString("R", ci)).Append(',').Append(timer).Append(',').Append(t174).Append(',').Append(t178).Append(',').Append(t17c); if (held != 0f) sb.Append(",\"").Append(BitConverter.ToString(ob, 0x150, 0x40).Replace("-", "")).Append('"');
      if (ob[0xf] == 70 && t1 <= 180000) { long ps = BitConverter.ToInt64(ob, 0x3f0); long vp = BitConverter.ToInt64(ob, 0x400);
       sb.Append(",{\"m\":\"").Append(BitConverter.ToString(ob, 0x3bc, 0x24).Replace("-", "")).Append('"');
       if (vp != 0 && Rd(vp, vb, 0x18)) sb.Append(",\"v\":\"").Append(BitConverter.ToString(vb).Replace("-", "")).Append('"');
       if (ps != 0 && Rd(ps, psb, 0x48)) { sb.Append(",\"ps\":\"").Append(BitConverter.ToString(psb).Replace("-", "")).Append('"');
        long path = BitConverter.ToInt64(psb, 0x18); long wb = Q(path + 0x438), we = Q(path + 0x440); long nw = (we - wb) / 12;
        if (wb != 0 && nw > 0 && nw < 4096) { int take = (int)Math.Min(nw, 8); if (Rd(wb, wpb, take * 12)) sb.Append(",\"nw\":").Append(nw).Append(",\"wp\":\"").Append(BitConverter.ToString(wpb, 0, take * 12).Replace("-", "")).Append('"'); } }
       sb.Append('}'); }
      sb.Append(']');
     }
     sb.Append("]}");
    }
    int t2 = D(clock + 0x18);
    if (ok && t2 == t1) { sb.Append("]}"); w.WriteLine(sb.ToString()); lines++; last = t1; lastLogged = t1; if ((lines & 63) == 0) w.Flush(); }
   }
  }
  CloseHandle(H); return "lines=" + lines + " last_ms=" + last;
 }
}
"@
[Truth4]::Run($Out, $MaxSeconds, $MaxWorldMs) | Out-File "$PSScriptRoot\truthlog4.status" -Encoding ascii
