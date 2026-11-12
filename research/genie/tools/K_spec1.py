EDITS=[
("""        let old_hp = unit.life.hp;
        unit.life.hp = HitPoints::new(f32::from(hp as i32 as i16));
        // FUN_1411859a0: the damage share picks the damage sprites; one that stays keeps them
        // (the object's `+0xd`, not held, taken to be the old master's share)
        if (old.has_damage_sprites() || next.has_damage_sprites())
            && (damage_share(old_hp, old.hit_points, old.class, roles)?
                != damage_share(unit.life.hp, next.hit_points, next.class, roles)?)
        {
""",
"""        let old_hp = unit.life.hp;
        // 188329 (0x1266b90: 0x1266ccc..0x1266d3d): the share goes to the hit points (`+0x130`) as
        // the float it is, within 1 and the new master's; nothing makes it whole
        let masterhp_188329 = std::env::var_os("GENIE_EXPERIMENT_MASTERHP_188329").is_some();
        unit.life.hp = if masterhp_188329 {
            HitPoints::new(hp)
        } else {
            HitPoints::new(f32::from(hp as i32 as i16))
        };
        // FUN_1411859a0: the damage share picks the damage sprites; one that stays keeps them
        // (the object's `+0xd`, not held, taken to be the old master's share)
        let sprites_change = if masterhp_188329 {
            // 188329 (0x12429c0, CheckDamageSprites, which 0x1266b90 runs in state 2 with the new
            // master set): a new master without damage sprites leaves the share; a share that
            // stays, one of 100 or more, and one that stays at the same entry (the last whose
            // percent lies below the share) only write the share (`+0xd`). A move to another
            // entry (attachments, two draws of the Object stream for mode 1, slot 0x70 for mode
            // 2) is not modelled here.
            if next.has_damage_sprites() {
                let was = HpPercent::of_data(damage_share(
                    old_hp,
                    old.hit_points,
                    old.class,
                    roles,
                )?);
                let now = HpPercent::of_data(damage_share(
                    unit.life.hp,
                    next.hit_points,
                    next.class,
                    roles,
                )?);
                let entry =
                    |s: HpPercent| next.damage_graphics.iter().rposition(|e| e.percent < s);
                now != was && now < HpPercent::WHOLE && entry(now) != entry(was)
            } else {
                false
            }
        } else {
            (old.has_damage_sprites() || next.has_damage_sprites())
                && (damage_share(old_hp, old.hit_points, old.class, roles)?
                    != damage_share(unit.life.hp, next.hit_points, next.class, roles)?)
        };
        if sprites_change {
"""),
("""use crate::objects::masters::Master;
use crate::objects::masters::MasterId;
""","""use crate::objects::masters::HpPercent;
use crate::objects::masters::Master;
use crate::objects::masters::MasterId;
"""),
]
