param([string]$Name,[string]$Updates='41600',[string]$Envs='',[switch]$Build,[string]$Replay='518239882')
$d="$env:USERPROFILE\genie-replays"
Remove-Item "$d\runs\$Name.done" -ErrorAction SilentlyContinue
if ($Build) {
  Remove-Item "$d\build7.err" -ErrorAction SilentlyContinue
  $env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
  $b = Start-Process -FilePath "$env:USERPROFILE\.cargo\bin\cargo.exe" -ArgumentList 'build','--release','-p','genie-oracle','--example','census' -WorkingDirectory "$d\genie" -RedirectStandardOutput "$d\build7.out" -RedirectStandardError "$d\build7.err" -WindowStyle Hidden -PassThru -Wait
  if ($b.ExitCode -ne 0) { "build=$($b.ExitCode)" | Out-File "$d\runs\$Name.done" -Encoding ascii; exit }
}
$env:GENIE_CORRECT='ids'; $env:GENIE_EXPERIMENT_SEARCH_CLEAR='unit'; $env:GENIE_EXPERIMENT_CAPTURE_SETUP='1'; $env:GENIE_NO_STOP='1'; $env:GENIE_PRINT_CHECKPOINTS='1'
$env:GENIE_EXPERIMENT_SORT_LISTS='1'; $env:GENIE_EXPERIMENT_SHORT_188329='1'; $env:GENIE_EXPERIMENT_SPAWN_188329='1'
foreach ($kv in $Envs.Split(';')) { if ($kv) { $k,$v = $kv.Split('=',2); Set-Item "env:$k" $v } }
$rep=(Get-ChildItem "$d\$Replay\*.aoe2record" | Select-Object -First 1).FullName
$p = Start-Process -FilePath "$d\genie\target\release\examples\census.exe" -ArgumentList "`"$rep`"","`"$d\data\empires2_x2_p1.dat`"",$Updates -RedirectStandardOutput "$d\runs\$Name.out" -RedirectStandardError "$d\runs\$Name.err" -WindowStyle Hidden -PassThru -Wait
"run=$($p.ExitCode)" | Out-File "$d\runs\$Name.done" -Encoding ascii
