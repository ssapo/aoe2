# Offline check of truthlog8.ps1 (no game needed): compiles its C#, feeds Tick() a fake memory image
# (two players, one tracked unit in group 7, one other group 9), and checks the line shape against
# truth\truth8.jsonl (v7 format). Prints PASS/FAIL lines; exit code 0 only when all pass.
$ErrorActionPreference = 'Stop'
$env:TRUTHLOG8_SOURCE_ONLY = '1'
$src = & "$PSScriptRoot\truthlog8.ps1"
Remove-Item Env:TRUTHLOG8_SOURCE_ONLY
$fake = @"
public static class Fake {
 public static System.Collections.Generic.Dictionary<long, byte[]> R = new System.Collections.Generic.Dictionary<long, byte[]>();
 public static bool Read(long a, byte[] b, int n) { foreach (var kv in R) if (a >= kv.Key && a + n <= kv.Key + kv.Value.Length) { System.Buffer.BlockCopy(kv.Value, (int)(a - kv.Key), b, 0, n); return true; } return false; }
 static byte[] Reg(long a, int n) { var x = new byte[n]; R[a] = x; return x; }
 static void P64(byte[] r, int o, long v) { System.BitConverter.GetBytes(v).CopyTo(r, o); }
 static void P32(byte[] r, int o, int v) { System.BitConverter.GetBytes(v).CopyTo(r, o); }
 static void PF(byte[] r, int o, float v) { System.BitConverter.GetBytes(v).CopyTo(r, o); }
 static uint Bits(float f) { return System.BitConverter.ToUInt32(System.BitConverter.GetBytes(f), 0); }
 public const long B = 0x140000000, W = 0x200000000, MGR = 0x300000000;
 static long next = 0x400000000; static long Alloc() { next += 0x10000; return next; }
 static long Obj(int id, int type, short master, float x, float y, bool unit, int gid) {
  long o = Alloc(); var ob = Reg(o, 0x430); P32(ob, 8, id); ob[0xf] = (byte)type; ob[0x188] = 2;
  long mp = Alloc(); var m = Reg(mp, 0x20); P64(m, 0x18, unchecked((long)(((ulong)(ushort)master - 0x8843e0230f22648dUL) ^ 0xab0318a63f13e48fUL)));
  P64(ob, 0x10, unchecked(mp + 0x4ef290fb1bb31c56L));
  P64(ob, 0x170, unchecked((long)((ulong)Bits(x) - 0x4d086415325b1a2bUL)));
  P64(ob, 0x178, unchecked((long)(((ulong)Bits(y) - 0x3c682b96db105333UL) ^ 0xbbadc6d6e9b81de2UL)));
  P32(ob, 0x210, gid);
  if (!unit) return o;
  long ai = Alloc(); var a = Reg(ai, 0x200); P32(a, 0x38, 0x2bd); P32(a, 0x170 + 0x64, 1234); P64(ob, 0x1f0, ai);
  long vp = Alloc(); Reg(vp, 0x18); P64(ob, 0x400, vp);
  PF(ob, 0x3bc, x); PF(ob, 0x3c4, y);
  long ao = Alloc(); var act = Reg(ao, 0x100); P32(act, 8, 5); act[0x6c] = 3; act[0x6d] = 2; PF(act, 0x70, 0.45f); PF(act, 0x74, 0.46f);
  long nd = Alloc(); var node = Reg(nd, 0x30); P64(node, 0, ao);
  long al = Alloc(); var l = Reg(al, 0x18); P64(l, 0x10, nd); P64(ob, 0x420, al);
  long ps = Alloc(); var p = Reg(ps, 0x48); P64(p, 0x18, Path(10, x, y)); P64(ob, 0x3f0, ps);
  return o;
 }
 static long Path(int n, float x, float y) {
  long path = Alloc(); var pa = Reg(path, 0x450); long wb = Alloc(); var w = Reg(wb, n * 12);
  for (int i = 0; i < n; i++) { PF(w, i * 12, x - i); PF(w, i * 12 + 8, y); }
  P64(pa, 0x438, wb); P64(pa, 0x440, wb + n * 12); return path;
 }
 static long Player(int num, long[] objs) {
  long pl = Alloc(); var p = Reg(pl, 0x700); P32(p, 0x648, num);
  long sl = Alloc(); var s = Reg(sl, 0x20); P32(s, 0x10, 77); P64(p, 0x38, sl);
  long ra = Alloc(); var r = Reg(ra, 0x20); float[] res = { 200f, 150.5f, 100f, 0f };
  for (int i = 0; i < 4; i++) P64(r, 8 * i, unchecked((long)((((ulong)Bits(res[i]) ^ 0xa9834b738a7dd167UL) - 0xfbd53bd68903310bUL) ^ 0xa8cf267a3f737c66UL)));
  P64(p, 0x98, ra);
  long arr = Alloc(); var ar = Reg(arr, 8 * objs.Length); for (int i = 0; i < objs.Length; i++) P64(ar, 8 * i, objs[i]);
  long list = Alloc(); var li = Reg(list, 0x18); P64(li, 8, arr); P32(li, 0x10, objs.Length); P64(p, 0x30, list);
  return pl;
 }
 static long Group(int id, int[] mem, long nextNode) {
  long g = Alloc(); var gb = Reg(g, 0x5d0); P32(gb, 0xd8, id); P32(gb, 0xe4, mem.Length); P64(gb, 0xc8, nextNode);
  PF(gb, 8, 47.243f); PF(gb, 0x10, 73.811f); PF(gb, 0x144, 48.879f); PF(gb, 0x14c, 73.25f); gb[0x5cc] = 0;
  long m = Alloc(); var mb = Reg(m, mem.Length * 4); for (int i = 0; i < mem.Length; i++) P32(mb, i * 4, mem[i]); P64(gb, 0xf0, m);
  long mv = Alloc(); var v = Reg(mv, mem.Length * 0x30); for (int i = 0; i < mem.Length; i++) P32(v, i * 0x30, 1); P64(gb, 0xf8, mv);
  long fm = Alloc(); var f = Reg(fm, 0x40); P32(f, 4, mem.Length); long sl = Alloc(); var s = Reg(sl, mem.Length * 0x3c);
  for (int i = 0; i < mem.Length; i++) { P32(s, i * 0x3c, mem[i]); PF(s, i * 0x3c + 0x14, 47.221f); PF(s, i * 0x3c + 0x18, 73.186f + 0.625f * i); }
  P64(f, 0x10, sl); P64(gb, 0x128, fm);
  long lv2 = Alloc(); var l2 = Reg(lv2, 0x30); l2[0x14] = 1; P64(l2, 0x18, Path(2, 47f, 73f)); P32(l2, 0x24, 1);
  long lv1 = Alloc(); var l1 = Reg(lv1, 0x30); l1[0x14] = 0; P64(l1, 8, lv2); P64(l1, 0x18, Path(12, 46f, 72f)); P32(l1, 0x24, 0);
  P64(gb, 0xb0, lv1);
  return g;
 }
 public static void Build() {
  var w = Reg(W, 0x800); Reg(B + 0x4354d00, 0x60)[0] = 0x50;
  long pb = Alloc(); var pv = Reg(pb, 32);
  P64(pv, 0, Player(0, new[] { Obj(2309, 30, 1902, 77f, 67f, false, -1) }));
  P64(pv, 16, Player(2, new[] { Obj(3430, 70, 448, 50.138f, 71.75f, true, 7), Obj(4464, 70, 448, 48.75f, 75.25f, true, 7), Obj(5000, 70, 83, 10f, 10f, true, -1) }));
  P64(w, 0x770, pb); P64(w, 0x778, pb + 32);
  var mgr = Reg(MGR, 0x100); P64(w, 0x50, MGR);
  long g7 = Group(7, new[] { 3430, 4464, 4472 }, MGR);
  long g9 = Group(9, new[] { 99 }, g7);
  P64(mgr, 0xc8, g9);
 }
}
"@
Add-Type -TypeDefinition ($src + "`n" + $fake)
[Fake]::Build(); [Truth8]::Mem = [Truth8+Reader]{ param($a, $b, $n) [Fake]::Read($a, $b, $n) }
$fail = 0
function Check($name, $cond) { if ($cond) { "PASS $name" } else { "FAIL $name"; $script:fail++ } }
$sb = New-Object System.Text.StringBuilder
$units = New-Object 'System.Collections.Generic.HashSet[int]'; [void]$units.Add(3430); [void]$units.Add(4464)

# 1) outside the dense window: same shape as v7
$r = [Truth8]::Tick([Fake]::B, [Fake]::W, 800000, 694000, 703500, $units, $sb); $plain = $sb.ToString()
Check 'plain tick ok' ($r -eq 1)
$j = $plain | ConvertFrom-Json
Check 'plain has no g' ($null -eq $j.PSObject.Properties['g'])
Check 'plain has no v8 unit keys' (-not ($plain -match '"(gid|ax|wpx|nwx)"'))
Check 'plain top keys = ms,airng,players' ((($j.PSObject.Properties.Name) -join ',') -eq 'ms,airng,players')
Check 'plain res decodes' (($j.players[1].res -join ',') -eq '200,150.5,100,0')
Check 'plain x/y decode' ([single]$j.players[1].o[0][4] -eq [single]50.138 -and [single]$j.players[1].o[0][5] -eq [single]71.75)
Check 'plain master decodes' ($j.players[1].o[0][1] -eq 448)
$u = $j.players[1].o[0][10]
Check 'plain unit keys = k,ai,an,ao,ps,nw,wp' ((($u.PSObject.Properties.Name) -join ',') -eq 'k,ai,an,ao,ps,nw,wp')

# 2) shape against a real v7 line (truth8.jsonl first line)
$realPath = if ($env:TRUTH8_JSONL) { $env:TRUTH8_JSONL } else { "$PSScriptRoot\..\truth\truth8.jsonl" }
if (-not (Test-Path $realPath)) { $realPath = 'C:\Users\ssapo\genie-replays\truth\truth8.jsonl' }
if (-not (Test-Path $realPath)) { "SKIP real-line checks (no truth8.jsonl; set TRUTH8_JSONL)" } else {
$real = Get-Content $realPath -TotalCount 400 | Where-Object { $_ -match '"k":5' } | Select-Object -First 1
$rj = $real | ConvertFrom-Json
Check 'real top keys match' ((($rj.PSObject.Properties.Name) -join ',') -eq (($j.PSObject.Properties.Name) -join ','))
Check 'real player keys match' ((($rj.players[0].PSObject.Properties.Name) -join ',') -eq (($j.players[0].PSObject.Properties.Name) -join ','))
$ru = ($rj.players | ForEach-Object { $_.o } | Where-Object { $_.Count -ge 11 -and $_[10].k -eq 5 } | Select-Object -First 1)[10]
$order = 'k','m','v','ai','an','ao','ps','nw','wp'
$rk = @($ru.PSObject.Properties.Name)
Check "real unit keys are in v8 order ($($rk -join ','))" ((($rk | ForEach-Object { $order.IndexOf($_) }) -join ',') -eq ((($rk | ForEach-Object { $order.IndexOf($_) }) | Sort-Object) -join ',') -and -not ($rk | Where-Object { $order -notcontains $_ }))
}

# 3) inside the dense window
$r = [Truth8]::Tick([Fake]::B, [Fake]::W, 695000, 694000, 703500, $units, $sb); $dense = $sb.ToString()
Check 'dense tick ok' ($r -eq 1)
$d = $dense | ConvertFrom-Json
Check 'dense top keys = ms,airng,players,g' ((($d.PSObject.Properties.Name) -join ',') -eq 'ms,airng,players,g')
Check 'only group 7 logged' ($d.g.Count -eq 1 -and $d.g[0].id -eq 7)
$g = $d.g[0]
Check 'group raw 0x5d0 bytes' ($g.raw.Length -eq 0x5d0 * 2)
Check 'group members' (($g.mem -join ',') -eq '3430,4464,4472')
Check 'group mv 3 x 0x30' ($g.mv.Length -eq 3 * 0x30 * 2)
Check 'group fm/sl' ($g.fm.Length -eq 0x80 -and $g.sl.Length -eq 3 * 0x3c * 2)
Check 'group two levels, 12 + 2 points' ($g.lv.Count -eq 2 -and $g.lv[0].n -eq 12 -and $g.lv[1].n -eq 2 -and $g.lv[0].pts.Length -eq 12 * 24)
$t = $d.players[1].o[0][10]; $o = $d.players[1].o[2][10]
Check 'tracked unit has gid 7, ax, wpx' ($t.gid -eq 7 -and $t.ax.Length -eq 0x200 -and $t.nwx -eq 10 -and $t.wpx.Length -eq 10 * 24 -and $t.m.Length -eq 0x48)
Check 'ax holds Gather +0x6c..+0x77' ($t.ax.Substring(0x6c * 2, 24) -eq '0302' + '0000' + ([BitConverter]::ToString([BitConverter]::GetBytes([single]0.45)) -replace '-') + ([BitConverter]::ToString([BitConverter]::GetBytes([single]0.46)) -replace '-'))
Check 'untracked unit has no v8 keys' ($null -eq $o.PSObject.Properties['gid'] -and $null -eq $o.PSObject.Properties['ax'])
$strip = ($dense -replace ',"g":\[.*\]\}$', '}') -replace ',"(ax|wpx)":"[0-9A-F]*"', '' -replace ',"(gid|nwx)":-?\d+', '' -replace ',"(m|v)":"[0-9A-F]*"', '' -replace '^\{"ms":\d+', ''
$plainStrip = ($plain -replace ',"(m|v)":"[0-9A-F]*"', '') -replace '^\{"ms":\d+', ''
Check 'dense line minus v8 keys and m/v equals plain line' ($strip -eq $plainStrip)

# 4) empty -Units = every unit and every group
$none = New-Object 'System.Collections.Generic.HashSet[int]'
$r = [Truth8]::Tick([Fake]::B, [Fake]::W, 695000, 694000, 703500, $none, $sb); $e = $sb.ToString() | ConvertFrom-Json
Check 'empty -Units: both groups, gid on every unit' ($e.g.Count -eq 2 -and $e.players[1].o[2][10].gid -eq -1)

"lengths: plain $($plain.Length) dense $($dense.Length)"
if ($fail -gt 0) { "FAILED $fail"; exit 1 } else { "ALL PASS"; exit 0 }
