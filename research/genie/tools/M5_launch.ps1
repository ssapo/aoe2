# Starts the eleven default runs (p, n, q = the five newest games) with a prefix: <Prefix>_p_239/161/097 and <Prefix>_n_894/090/670 (envs = file line + Extra).
param([string]$Prefix='M5',[string]$EnvFile='M5_envs.txt',[string]$Extra='',[string]$Which='p,n,q')
$d="$env:USERPROFILE\genie-replays"
$a=(Get-Content "$d\runs\$EnvFile" -Raw).Trim()
if ($Extra) { $a="$a;$Extra" }
$runs=New-Object System.Collections.ArrayList
if ($Which -match 'p') { foreach ($x in 'p_239 518239882 41600','p_161 518470161 75000','p_097 517426097 75000') { [void]$runs.Add($x.Split(' ')) } }
if ($Which -match 'n') { foreach ($x in 'n_894 516956894 75000','n_090 519686090 75000','n_670 519700670 75000') { [void]$runs.Add($x.Split(' ')) } }
if ($Which -match 'q') { foreach ($x in 'q_411 520397411 75000','q_236 520394236 75000','q_901 520386901 75000','q_921 520596921 75000','q_057 520592057 75000') { [void]$runs.Add($x.Split(' ')) } }
foreach ($r in $runs) {
  Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',"$d\runs\go.ps1",'-Name',"$($Prefix)_$($r[0])",'-Replay',$r[1],'-Updates',$r[2],'-Envs',$a -WindowStyle Hidden
}
