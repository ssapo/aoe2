EDITS=[
("""    if !matches!(state, ExploreState::Wait | ExploreState::Walk { .. }) {
        return Err(GenieError::unsupported(
            "a saved Explore in a state the slice does not model",
        ));
    }
    actions.list.set_explore(Some(ExploreAction {
        state,
        point: saved.point(),
    }));""","""    // 188329's state 2 (the wait's countdown): `GENIE_EXPERIMENT_EXPLORE_WAIT_188329`
    let stopped_ok = matches!(state, ExploreState::Stopped)
        && std::env::var_os("GENIE_EXPERIMENT_EXPLORE_WAIT_188329").is_some();
    if !stopped_ok && !matches!(state, ExploreState::Wait | ExploreState::Walk { .. }) {
        return Err(GenieError::unsupported(
            "a saved Explore in a state the slice does not model",
        ));
    }
    actions.list.set_explore(Some(ExploreAction {
        state,
        point: saved.point(),
        wait: 0.0,
    }));"""),
]
