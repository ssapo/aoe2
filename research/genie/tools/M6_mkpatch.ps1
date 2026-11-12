# Regenerates the engine patch: tracked changes + untracked crates/**/*.rs as new files (CONTINUE 13.2 step 5).
# Output: genie-replays\<Name>.raw (strip CR afterwards: python3 runs/M3_striplf.py <Name>)
param([string]$Name='patch-2026-11-13-M3')
$d="$env:USERPROFILE\genie-replays"
$env:GIT_OPTIONAL_LOCKS='0'
Set-Location "$d\genie"
cmd /c "git diff --ignore-cr-at-eol > `"$d\$Name.raw`""
$u = git status --short --untracked-files=all | Where-Object { $_ -match '^\?\? crates/.*\.rs$' } | ForEach-Object { $_.Substring(3) }
foreach ($f in $u) { cmd /c "git diff --no-index /dev/null `"$f`" >> `"$d\$Name.raw`"" }
"files=$($u.Count)" | Out-File "$d\runs\M6_mkpatch.done" -Encoding ascii
