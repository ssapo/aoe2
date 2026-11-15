#!/bin/bash
# ENG-25: 519700670 and 519002991 with M6_envs minus MEMBERHIT/CROWDEND plus ANIMALREACT (the old combination with missed-missile stops), exe $E5_EXE, prefix $1
d="$(cd "$(dirname "$0")" && pwd)"
export E5_ENVFILE=J25_envs_old.txt
bash "$d/E5_go.sh" "${1}_old_670" 519700670 75000 "GENIE_EXPERIMENT_ANIMALREACT_188329=1" &
bash "$d/E5_go.sh" "${1}_old_991" 519002991 75000 "" &
bash "$d/E5_go.sh" "${1}_old_239" 518239882 41600 "GENIE_EXPERIMENT_ANIMALREACT_188329=1" &
wait
