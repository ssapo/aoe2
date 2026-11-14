# ENG-12: builds census (log runs\E12_build.log), then freezes a copy runs\census_<Tag>.exe; .done at the end
param([string]$Tag='E12a')
$d="$env:USERPROFILE\genie-replays"
Remove-Item "$d\runs\E12_build.done" -ErrorAction SilentlyContinue
Set-Location "$d\genie"
$p = Start-Process "$env:USERPROFILE\.cargo\bin\cargo.exe" -ArgumentList 'build','--release','-p','genie-oracle','--example','census' -NoNewWindow -Wait -PassThru -RedirectStandardError "$d\runs\E12_build.log" -RedirectStandardOutput "$d\runs\E12_build.out"
if ($p.ExitCode -eq 0) { Copy-Item "$d\genie\target\release\examples\census.exe" "$d\runs\census_$Tag.exe" -Force }
"exit=$($p.ExitCode)" | Out-File "$d\runs\E12_build.done" -Encoding ascii
