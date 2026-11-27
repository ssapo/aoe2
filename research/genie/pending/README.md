Engine patches built but not yet verified (rule: AGENTS.md "멈출 때 인계").
Each is a full diff from engine base 91d81be4, like sorted-lists-and-truth-trace.patch.
R65t = R65s + B66a-j; R65u = R65t + C10 + D6; R65v = R65u + D7. See CONTINUE.md top paragraph and findings 231.
Delete a file here once its check is done (verified one becomes sorted-lists-and-truth-trace.patch).
- D8_gateparts_on_R65v.diff, D9_carrynothing_missiledone_on_R65v.diff (lane D, 2026-11-28): incremental on R65v (not full
  diffs). D8: a gate part's reach also measures its main and the main's other part (GENIE_EXPERIMENT_GATEPARTS_188329).
  D9: a gatherer's drop-off carrying nothing searches (CARRYNOTHING), a missile action's update in state 1 does nothing
  (MISSILEDONE). Checked: G8/G9 75 matches only (D8); three stop matches only (D9). Notes PC runs\D\eng-laneD.md.
