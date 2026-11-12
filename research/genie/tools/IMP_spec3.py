OLD1 = r'''                        &mut plan,
                        id,
                        Distance::ZERO,
                        master_id,'''
NEW1 = r'''                        &mut plan,
                        id,
                        gather_search::reach_range(),
                        master_id,'''
EDITS = [(OLD1, NEW1)]
