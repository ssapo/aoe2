# Read-only ground-truth logger for AoE2DE_s.exe 101.103.57257.0 (#188329).
# Reads each player's live objects (the same fields WorldPlayerBase::create_checksum sums) once per world-time change.
# v8 (2026-11-16, ENG-06): v7 lines unchanged; inside the dense window -DenseFromMs..-DenseUntilMs it also writes
#   - per unit (only -Units, or every unit when -Units is empty), inside the {"k":5,...} object:
#       "gid" = obj+0x210 (group id; -1 = none), "ax" = head action object 0x100 bytes (covers Gather +0x6c..+0x74),
#       "nwx"/"wpx" = up to 64 waypoints of the unit path (v7 "wp" keeps 8)
#   - per group whose members include a -Units id (every group when -Units is empty), once per line, as ,"g":[...]
#     after "players": {"id","raw" (group 0x5d0 bytes),"mem":[ids],"mv" (+0xf8 table, 0x30 per member),
#     "fm" (+0x128 formation header 0x40),"sl" (its slots, 0x3c each),"lv":[{"h" (level node 0x30),"n","pts"}]}
#   -FromMs: write nothing before this world time (smaller files). Status goes to <Out>.status (not a fixed name).
# Offsets added in v8 (188329; tools re-kit\re\dz.py and the decompiles named here):
#   unit obj+0x210 = group id: AddUnit 0x10d3c50 writes `*(lVar4+0x210) = *(group+0xd8)` (re\out_p20\d1.c 226..).
#   group lookup 0x16027d0: world = game+0x5c0 (0xd6c9e0); mgr = [world+0x50]; node = [mgr+0xc8]; loop while node != mgr:
#     [node+0xd8] == id -> found; node = [node+0xc8]. Group object size 0x5d0 (memset in 0x1601b10, findings "group-forming-lead").
#   group +0xe4 member count, +0xf0 member id array (int), +0xf8 self-move table 0x30 per member (AddUnit clears
#     +0,+4,+0xc..+0x2c; 0x1107710 writes +0 = 1, +4 path id, +8 reason, +0xc..+0x14 goal, +0x18 time, +0x20 distance,
#     +0x24 place; findings 87, 96).
#   group +0x128 = formation: [F+4] slot count, [F+0x10] slots, 0x3c each, slot +0 unit id, +0x14/+0x18 slot x/y
#     (0x10dd1e0 and 0x110b43e..0x110b475; findings 86/87).
#   group +0xb0 = path level node: node+8 next (parent) level, byte node+0x14 level, node+0x18 path, int node+0x24 current
#     point index (0x10ef4e7..0x10ef5e0); path points [path+0x438]..[path+0x440], 12 bytes each (0x1072970, 0x1076260).
#   group +0x8/+0x10 place, +0x14 forward (findings 86, 0x110a516), +0x144/+0x14c centroid (0x10ef69f), +0x174/+0x178
#     speeds/budget, +0x3e0 goal range, +0x5cc formed flag: all inside "raw".
#   Gather action +0x6c/+0x6d/+0x70/+0x74 (0xb800b0 state 7, findings 83) = bytes 0x6c..0x77 of "ax" when the head action
#     is the Gather (v7 "ao" stopped at 0x70).
# NOT yet checked against a live game (written 2026-11-16 with the game idle): the group list walk and the head action
#   being the Gather on 9387 - confirm on the first real run that "g" is non-empty and "gid" matches g.id.
# v7 (2026-11-15): v5 + dense window -DenseFromMs..-DenseUntilMs (also forward/plain position inside it), unit AI ai+0x38..0x60.
# v5: path state and waypoints for the whole run, the unit AI's order/action/target (ai+0x38..0x50), the head action node and object (obj+0x420 -> list+0x10); dense sampling until -DenseUntilMs.
# v4: units (type 70) also get, for the first 180 s: plain position/forward/right (+0x3bc..+0x3e0), velocity data (+0x400), path state (+0x3f0, 0x48 bytes) and up to 8 waypoints of its path (+0x18 -> +0x438).
param([string]$Out = "$PSScriptRoot\truth10.jsonl", [int]$MaxSeconds = 3600, [int]$MaxWorldMs = 1200000, [int]$DenseUntilMs = 120000, [int]$DenseFromMs = 0, [string]$Units = "", [int]$FromMs = 0)
$src = @"
using System; using System.IO; using System.Text; using System.Diagnostics; using System.Runtime.InteropServices; using System.Globalization; using System.Collections.Generic;
public static class Truth8 {
 [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint a, bool b, int pid);
 [DllImport("kernel32.dll", SetLastError=true)] static extern bool ReadProcessMemory(IntPtr h, IntPtr addr, byte[] buf, IntPtr n, out IntPtr got);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
 public delegate bool Reader(long a, byte[] b, int n);
 public static Reader Mem; // offline test hook: when set, every read comes from here instead of the game
 static IntPtr H; static byte[] B8 = new byte[8];
 static bool Rd(long a, byte[] b, int n) { if (a <= 0x10000) return false; if (Mem != null) return Mem(a, b, n); IntPtr g; return ReadProcessMemory(H, new IntPtr(a), b, new IntPtr(n), out g) && g.ToInt64() == n; }
 static long Q(long a) { return Rd(a, B8, 8) ? BitConverter.ToInt64(B8, 0) : 0; }
 static int D(long a) { return Rd(a, B8, 4) ? BitConverter.ToInt32(B8, 0) : 0; }
 static float F32(uint bits) { return BitConverter.ToSingle(BitConverter.GetBytes(bits), 0); }
 static string Hx(byte[] b, int o, int n) { return BitConverter.ToString(b, o, n).Replace("-", ""); }
 static CultureInfo ci = CultureInfo.InvariantCulture;
 static byte[] ob = new byte[0x430], aib = new byte[0x28], anb = new byte[0x30], aob = new byte[0x70], psb = new byte[0x48], wpb = new byte[96], vb = new byte[0x18], ab = new byte[0x70], rb = new byte[0x60];
 static byte[] axb = new byte[0x100], wpx = new byte[64 * 12], gb = new byte[0x5d0], gmb = new byte[0x8c * 4], gmv = new byte[0x8c * 0x30], fmb = new byte[0x40], slb = new byte[0x8c * 0x3c], lvb = new byte[0x30];
 public static int Groups;
 // One line for world time t1. Returns -1 when the player list is not ready, 0 when a read failed, 1 when sb holds the line.
 public static int Tick(long b, long world, int t1, int denseFromMs, int denseUntilMs, HashSet<int> units, StringBuilder sb) {
  long pb = Q(world + 0x770), pend = Q(world + 0x778); long np = (pend - pb) / 16; if (pb == 0 || np < 2 || np > 16) return -1;
  bool dense = t1 >= denseFromMs && t1 <= denseUntilMs; bool all = units.Count == 0;
  sb.Length = 0; sb.Append("{\"ms\":").Append(t1); if (Rd(b + 0x4354d00, rb, 0x60)) sb.Append(",\"airng\":\"").Append(Hx(rb, 0, 0x60)).Append("\""); sb.Append(",\"players\":["); bool ok = true;
  for (int i = 0; i < np && ok; i++) {
   long pl = Q(pb + 16 * i); if (pl == 0) { ok = false; break; }
   long list = Q(pl + 0x30); long arr = Q(list + 8); int n = D(list + 0x10); if (n < 0 || n > 5000) { ok = false; break; }
   if (i > 0) sb.Append(','); sb.Append("{\"p\":").Append(D(pl + 0x648)).Append(",\"sleep\":").Append(D(Q(pl + 0x38) + 0x10)).Append(",\"res\":["); long ra = Q(pl + 0x98); for (int r = 0; r < 4; r++) { ulong e = unchecked((ulong)Q(ra + 8L * r)); uint lo = unchecked((uint)(((e ^ 0xa8cf267a3f737c66UL) + 0xfbd53bd68903310bUL) ^ 0xa9834b738a7dd167UL)); if (r > 0) sb.Append(','); sb.Append(F32(lo).ToString("R", ci)); } sb.Append("],\"o\":[");
   int wrote = 0; for (int k = 0; k < n; k++) {
    long o = Q(arr + 8L * k); if (!Rd(o, ob, 0x430)) { ok = false; break; }
    int id = BitConverter.ToInt32(ob, 8);
    long mp = unchecked(BitConverter.ToInt64(ob, 0x10) - 0x4ef290fb1bb31c56L);
    ulong mq = unchecked((ulong)Q(mp + 0x18)); short mid = unchecked((short)((mq ^ 0xab0318a63f13e48fUL) + 0x8843e0230f22648dUL));
    float held = BitConverter.ToSingle(ob, 0x168);
    float x = F32(unchecked((uint)(BitConverter.ToUInt64(ob, 0x170) + 0x4d086415325b1a2bUL)));
    float y = F32(unchecked((uint)((BitConverter.ToUInt64(ob, 0x178) ^ 0xbbadc6d6e9b81de2UL) + 0x3c682b96db105333UL)));
    long ai = BitConverter.ToInt64(ob, 0x1f0); int timer = -1, t174 = -1, t178 = -1, t17c = -1;
    if (ai != 0 && Rd(ai + 0x170, ab, 0x70)) { timer = BitConverter.ToInt32(ab, 0x64); t174 = BitConverter.ToInt32(ab, 4); t178 = BitConverter.ToInt32(ab, 8); t17c = BitConverter.ToInt32(ab, 0xc); }
    if (wrote > 0) sb.Append(','); wrote++;
    sb.Append('[').Append(id).Append(',').Append(mid).Append(',').Append(ob[0x188]).Append(',').Append(held.ToString("R", ci)).Append(',').Append(x.ToString("R", ci)).Append(',').Append(y.ToString("R", ci)).Append(',').Append(timer).Append(',').Append(t174).Append(',').Append(t178).Append(',').Append(t17c); if (held != 0f) sb.Append(",\"").Append(Hx(ob, 0x150, 0x40)).Append('"');
    if (ob[0xf] == 70) { long ps = BitConverter.ToInt64(ob, 0x3f0); long vp = BitConverter.ToInt64(ob, 0x400);
     bool extra = dense && (all || units.Contains(id));
     sb.Append(",{\"k\":5");
     if (t1 <= 180000 || dense) { sb.Append(",\"m\":\"").Append(Hx(ob, 0x3bc, 0x24)).Append('"');
      if (vp != 0 && Rd(vp, vb, 0x18)) sb.Append(",\"v\":\"").Append(Hx(vb, 0, 0x18)).Append('"'); }
     if (ai != 0 && Rd(ai + 0x38, aib, 0x28)) sb.Append(",\"ai\":\"").Append(Hx(aib, 0, 0x28)).Append('"');
     long al = BitConverter.ToInt64(ob, 0x420); long ah = al == 0 ? 0 : Q(al + 0x10);
     if (ah != 0 && Rd(ah, anb, 0x30)) { sb.Append(",\"an\":\"").Append(Hx(anb, 0, 0x30)).Append('"');
      long ao = BitConverter.ToInt64(anb, 0); if (ao != 0 && Rd(ao, aob, 0x70)) sb.Append(",\"ao\":\"").Append(Hx(aob, 0, 0x70)).Append('"');
      if (extra && ao != 0 && Rd(ao, axb, 0x100)) sb.Append(",\"ax\":\"").Append(Hx(axb, 0, 0x100)).Append('"'); }
     if (ps != 0 && Rd(ps, psb, 0x48)) { sb.Append(",\"ps\":\"").Append(Hx(psb, 0, 0x48)).Append('"');
      long path = BitConverter.ToInt64(psb, 0x18); long wb = Q(path + 0x438), we = Q(path + 0x440); long nw = (we - wb) / 12;
      if (wb != 0 && nw > 0 && nw < 4096) { int take = (int)Math.Min(nw, 8); if (Rd(wb, wpb, take * 12)) sb.Append(",\"nw\":").Append(nw).Append(",\"wp\":\"").Append(Hx(wpb, 0, take * 12)).Append('"');
       if (extra && nw > 8) { int tx = (int)Math.Min(nw, 64); if (Rd(wb, wpx, tx * 12)) sb.Append(",\"nwx\":").Append(nw).Append(",\"wpx\":\"").Append(Hx(wpx, 0, tx * 12)).Append('"'); } } }
     if (extra) sb.Append(",\"gid\":").Append(BitConverter.ToInt32(ob, 0x210));
     sb.Append('}'); }
    sb.Append(']');
   }
   sb.Append("]}");
  }
  if (!ok) return 0;
  sb.Append(']');
  if (dense) AppendGroups(world, units, all, sb);
  sb.Append('}');
  return 1;
 }
 // Group list 0x16027d0: mgr = [world+0x50], first = [mgr+0xc8], next = [node+0xc8], ends back at mgr.
 static void AppendGroups(long world, HashSet<int> units, bool all, StringBuilder sb) {
  long mgr = Q(world + 0x50); if (mgr == 0) return;
  long node = Q(mgr + 0xc8); int seen = 0, wrote = 0;
  while (node != 0 && node != mgr && seen++ < 4096) {
   long next = Q(node + 0xc8);
   if (Rd(node, gb, 0x5d0)) {
    int gid = BitConverter.ToInt32(gb, 0xd8); int nm = BitConverter.ToInt32(gb, 0xe4); long mem = BitConverter.ToInt64(gb, 0xf0);
    if (nm >= 0 && nm <= 0x8c && (nm == 0 || Rd(mem, gmb, nm * 4))) {
     bool want = all; for (int i = 0; i < nm && !want; i++) if (units.Contains(BitConverter.ToInt32(gmb, i * 4))) want = true;
     if (want) {
      sb.Append(wrote == 0 ? ",\"g\":[" : ","); wrote++; Groups++;
      sb.Append("{\"id\":").Append(gid).Append(",\"raw\":\"").Append(Hx(gb, 0, 0x5d0)).Append("\",\"mem\":[");
      for (int i = 0; i < nm; i++) { if (i > 0) sb.Append(','); sb.Append(BitConverter.ToInt32(gmb, i * 4)); } sb.Append(']');
      long mv = BitConverter.ToInt64(gb, 0xf8); if (nm > 0 && mv != 0 && Rd(mv, gmv, nm * 0x30)) sb.Append(",\"mv\":\"").Append(Hx(gmv, 0, nm * 0x30)).Append('"');
      long fm = BitConverter.ToInt64(gb, 0x128); if (fm != 0 && Rd(fm, fmb, 0x40)) { sb.Append(",\"fm\":\"").Append(Hx(fmb, 0, 0x40)).Append('"');
       int ns = BitConverter.ToInt32(fmb, 4); long sp = BitConverter.ToInt64(fmb, 0x10); if (ns > 0 && ns <= 0x8c && sp != 0 && Rd(sp, slb, ns * 0x3c)) sb.Append(",\"sl\":\"").Append(Hx(slb, 0, ns * 0x3c)).Append('"'); }
      long lv = BitConverter.ToInt64(gb, 0xb0); int lc = 0; sb.Append(",\"lv\":[");
      while (lv != 0 && lc < 8 && Rd(lv, lvb, 0x30)) {
       if (lc > 0) sb.Append(','); lc++; sb.Append("{\"h\":\"").Append(Hx(lvb, 0, 0x30)).Append('"');
       long path = BitConverter.ToInt64(lvb, 0x18); long wb = Q(path + 0x438), we = Q(path + 0x440); long nw = (we - wb) / 12;
       if (path != 0 && wb != 0 && nw > 0 && nw < 4096) { int tx = (int)Math.Min(nw, 64); sb.Append(",\"n\":").Append(nw); if (Rd(wb, wpx, tx * 12)) sb.Append(",\"pts\":\"").Append(Hx(wpx, 0, tx * 12)).Append('"'); }
       sb.Append('}'); long up = BitConverter.ToInt64(lvb, 8); if (up == lv) break; lv = up; }
      sb.Append("]}");
     }
    }
   }
   node = next;
  }
  if (wrote > 0) sb.Append(']');
 }
 public static string Run(string outPath, int maxSeconds, int maxWorldMs, int denseUntilMs, int denseFromMs, string unitList, int fromMs) {
  var units = new HashSet<int>(); foreach (var s in (unitList ?? "").Split(new[] { ',', ' ' }, StringSplitOptions.RemoveEmptyEntries)) units.Add(int.Parse(s, ci));
  var sw = Stopwatch.StartNew(); Process p = null;
  while (p == null && sw.Elapsed.TotalSeconds < maxSeconds) { var ps = Process.GetProcessesByName("AoE2DE_s"); if (ps.Length > 0) p = ps[0]; else System.Threading.Thread.Sleep(1000); }
  if (p == null) return "no game";
  H = OpenProcess(0x0410, false, p.Id); if (H == IntPtr.Zero) return "OpenProcess failed " + Marshal.GetLastWin32Error();
  long b = 0; while (b == 0 && sw.Elapsed.TotalSeconds < maxSeconds) { try { b = p.MainModule.BaseAddress.ToInt64(); } catch { System.Threading.Thread.Sleep(500); } }
  if (D(b + 0x3c) == 0) return "cannot read image";
  int pe = D(b + 0x3c); if (D(b + pe + 8) != 0x6acf93a9 || D(b + pe + 0x50) != 0x4f24000) return "wrong build";
  long lines = 0, denseLines = 0; int last = -1, lastDense = -1, maxGap = 0; int lastLogged = -100000; var gaps = new List<int>(); var sb = new StringBuilder(1 << 20);
  using (var w = new StreamWriter(outPath, false, new UTF8Encoding(false))) {
   while (sw.Elapsed.TotalSeconds < maxSeconds && !p.HasExited) {
    long game = Q(b + 0x43552b8); long world = game == 0 ? 0 : Q(game + 0x5c0);
    if (world == 0) { System.Threading.Thread.Sleep(200); continue; }
    long clock = Q(world + 0x228); int t1 = clock == 0 ? -1 : D(clock + 0x18);
    if (t1 < 0 || t1 == last) { System.Threading.Thread.Sleep(0); continue; }
    if (t1 < fromMs) { last = t1; System.Threading.Thread.Sleep(0); continue; }
    if ((t1 > denseUntilMs || t1 < denseFromMs) && t1 - lastLogged < 200 && t1 >= lastLogged) { last = t1; continue; }
    if (t1 > maxWorldMs) break;
    int r = Tick(b, world, t1, denseFromMs, denseUntilMs, units, sb); if (r < 0) { System.Threading.Thread.Sleep(50); continue; }
    int t2 = D(clock + 0x18);
    if (r == 1 && t2 == t1) { w.WriteLine(sb.ToString()); lines++; last = t1; lastLogged = t1; if ((lines & 63) == 0) w.Flush();
     if (t1 >= denseFromMs && t1 <= denseUntilMs) { if (lastDense >= 0) { gaps.Add(t1 - lastDense); if (t1 - lastDense > maxGap) maxGap = t1 - lastDense; } lastDense = t1; denseLines++; } }
   }
  }
  // a dense gap longer than 1.5 x the shortest one means at least one world tick was not written (play slower)
  int minGap = int.MaxValue, missed = 0; foreach (int g in gaps) if (g > 0 && g < minGap) minGap = g; foreach (int g in gaps) if (g * 2 > minGap * 3) missed++;
  CloseHandle(H); return "lines=" + lines + " last_ms=" + last + " dense_lines=" + denseLines + " dense_min_gap_ms=" + (gaps.Count == 0 ? 0 : minGap) + " dense_max_gap_ms=" + maxGap + " dense_gaps_missed=" + missed + " groups=" + Groups;
 }
}
"@
if ($env:TRUTHLOG8_SOURCE_ONLY) { return $src }   # used by truthlog8_selftest.ps1
Add-Type -TypeDefinition $src
$status = [IO.Path]::ChangeExtension($Out, ".status")
[Truth8]::Run($Out, $MaxSeconds, $MaxWorldMs, $DenseUntilMs, $DenseFromMs, $Units, $FromMs) | Out-File $status -Encoding ascii
