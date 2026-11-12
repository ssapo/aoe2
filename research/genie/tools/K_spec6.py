EDITS=[
("""        if roles
            .of_some_class(hunt.target_class)
            .contains(ClassRoles::PREDATOR)
        {
            // a human player's hunt is done (set_state 2), a computer player's ends (1)""","""        // 188329 (0xbb65b0 -> 0xbb7e86 set_state(3); case 3 at 0xbb4aec has no class test): a
        // hunt of class 10 searches like any other (notify 0x202, standing sprite, timer -10)
        if std::env::var_os("GENIE_EXPERIMENT_HUNT_188329").is_none()
            && roles
                .of_some_class(hunt.target_class)
                .contains(ClassRoles::PREDATOR)
        {
            // a human player's hunt is done (set_state 2), a computer player's ends (1)"""),
]
