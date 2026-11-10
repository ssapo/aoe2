# Read-only ground-truth logger for AoE2DE_s.exe 101.103.57257.0 (#188329).
# Reads each player's live objects (the same fields WorldPlayerBase::create_checksum sums) once per world-time change.
param([string]$Out = "$PSScriptRoot\truth2.jsonl", [int]$MaxSeconds = 3600, [int]$MaxWorldMs = 600000)
Add-Type -TypeDefinition @"
using System; using System.IO; using System.Text; using System.Diagnostics; using System.Runtime.InteropServices; using System.Globalization;
public static class Truth2 {
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
  var ci = CultureInfo.InvariantCulture; long lines = 0; int last = -1; byte[] ob = new byte[0x200]; byte[] ab = new byte[0x70]; byte[] rb = new byte[0x60]; int lastLogged = -100000; var sb = new StringBuilder(8192);
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
     if (i > 0) sb.Append(','); sb.Append("{\"p\":").Append(D(pl + 0x648)).Append(",\"sleep\":").Append(D(Q(pl + 0x38) + 0x10)).Append(",\"o\":[");
     int wrote = 0; for (int k = 0; k < n; k++) {
      long o = Q(arr + 8L * k); if (!Rd(o, ob, 0x200)) { ok = false; break; }
      int id = BitConverter.ToInt32(ob, 8);
      long mp = unchecked(BitConverter.ToInt64(ob, 0x10) - 0x4ef290fb1bb31c56L);
      ulong mq = unchecked((ulong)Q(mp + 0x18)); short mid = unchecked((short)((mq ^ 0xab0318a63f13e48fUL) + 0x8843e0230f22648dUL));
      float held = BitConverter.ToSingle(ob, 0x168);
      float x = F32(unchecked((uint)(BitConverter.ToUInt64(ob, 0x170) + 0x4d086415325b1a2bUL)));
      float y = F32(unchecked((uint)((BitConverter.ToUInt64(ob, 0x178) ^ 0xbbadc6d6e9b81de2UL) + 0x3c682b96db105333UL)));
      long ai = BitConverter.ToInt64(ob, 0x1f0); int timer = -1, t174 = -1, t178 = -1, t17c = -1;
      if (ai != 0 && Rd(ai + 0x170, ab, 0x70)) { timer = BitConverter.ToInt32(ab, 0x64); t174 = BitConverter.ToInt32(ab, 4); t178 = BitConverter.ToInt32(ab, 8); t17c = BitConverter.ToInt32(ab, 0xc); }
      if (i == 0 && ai == 0) continue;
      if (wrote > 0) sb.Append(','); wrote++;
      sb.Append('[').Append(id).Append(',').Append(mid).Append(',').Append(ob[0x188]).Append(',').Append(held.ToString("R", ci)).Append(',').Append(x.ToString("R", ci)).Append(',').Append(y.ToString("R", ci)).Append(',').Append(timer).Append(',').Append(t174).Append(',').Append(t178).Append(',').Append(t17c).Append(']');
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
[Truth2]::Run($Out, $MaxSeconds, $MaxWorldMs) | Out-File "$PSScriptRoot\truthlog2.status" -Encoding ascii
