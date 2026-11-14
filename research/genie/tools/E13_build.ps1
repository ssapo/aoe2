# ENG-06 (E13): builds census (log runs\E13_build.log), then freezes a copy runs\census_<Tag>.exe; .done at the end
param([string]$Tag='E13a')
$d="$env:USERPROFILE\genie-replays"
Remove-Item "$d\runs\E13_build.done" -ErrorAction SilentlyContinue
Set-Location "$d\genie"
cmd /c "`"$env:USERPROFILE\.cargo\bin\cargo.exe`" build --release -p genie-oracle --example census > `"$d\runs\E13_build.log`" 2>&1"
$e=$LASTEXITCODE
if ($e -eq 0) { Copy-Item "$d\genie\target\release\examples\census.exe" "$d\runs\census_$Tag.exe" -Force }
"exit=$e" | Out-File "$d\runs\E13_build.done" -Encoding ascii
