import struct,sys
h=open(sys.argv[1] if len(sys.argv)>1 else 'AgeIIDE_Replay_518239882.hdr','rb').read()
RC=[('formation_id','B'),('formation_row','B'),('formation_col','B'),('attack_timer','f'),('reload_worldtime','I'),('capture_flag','B'),('multi_unified_points','B'),('large_object_radius','B'),('attack_count','i'),('hit_something','B'),('num_kill_rewards','cnt12'),('object_trigger_flags_bits','I'),('previous_master_id','H'),('transform_back_timer_ms','I'),('special_ability_duration_ms','I'),('ability_activated_time_ms','I'),('processed_kill','B'),
('next_volley','B'),('using_special_attack_animation','B'),('attr_amt','6h'),('decay_timer','h'),('raider_build_countdown','i'),('locked_down_count','i'),('inside_garrison_count','B'),('need_unit_ai','AI')]
AI=[('mood','i'),('cur_order','i'),('cur_order_prio','i'),('cur_action','i'),('cur_target','i'),('cur_target_kind','i'),('ctx','f'),('cty','f'),('ctz','f'),('desired_dist','f'),('last_action','i'),('last_order','i'),('last_target','i'),('last_target_kind','i'),('last_update_time','I'),('idle_timer','I'),('idle_timeout','I'),('adj_idle_timeout','I'),('secondary_timer','I'),('look_around_timer','I'),('look_around_timeout','I'),('defend_target','i'),('defense_buffer','f'),('last_world_pos','4f'),('number_orders','cnt52'),('number_notifies','cnt24'),('number_units','cnt4'),('stop_after_kill','B'),('state','B'),('state_x','f'),('state_y','f'),('time_since_enemy','f'),('alert_mode','B'),('alert_obj','i'),('has_patrol','I'),('patrol_wp','i'),('oh_count','cnt48'),('last_retarget','I'),('rand_retarget','I'),('n_retarget','cnt8'),('best_unit','i'),('formation_kind','B'),('time_since_search','I'),('disable_retargeting','B')]
TAIL=[('town_bell_flag','B'),('btw1_id','i'),('btw1_x','f'),('btw1_y','f'),('btw1_id2','i'),('btw1_kind','i'),('btw1_action','i'),('btw2_id','i'),('btw2_x','f'),('btw2_y','f'),('btw2_id2','i'),('btw2_kind','i'),('btw2_action','i'),('berserker_timer','f'),('num_builders','B'),('num_healers','B'),('charge','f'),('melee_removed','h'),('pierce_removed','h'),('movement_damage_timer','f'),('attack_powerup','f'),('reload_powerup','f'),('powerup_update_offset','I'),('speed_powerup','f'),('work_rate_powerup','f'),('regen_powerup','f'),('speed_stinger','f'),('regen_stinger','f'),('reload_stinger','f'),('active_stinger_count','cnt32'),('hp_powerup','f'),('hp_max_powerup','f'),('max_range_powerup','f'),('melee_armor_powerup','i'),('pierce_armor_powerup','i'),('local_store','ucnt6'),('conversion_rate','f'),('skip_volley','B')]
def run(p, fields, extra=None, out=None, depth=0):
    for i,(n,f) in enumerate(fields):
        if extra and extra[0]==(depth,i):
            out.append(('EXTRA',h[p:p+extra[1]].hex(),hex(p))); p+=extra[1]
        if f.startswith('cnt') or f.startswith('ucnt'):
            c=struct.unpack_from('<I' if f[0]=='u' else '<i',h,p)[0]; out.append((n,c,hex(p))); p+=4
            sz=int(f.lstrip('uc').lstrip('nt'))
            if c<0 or c>1000: raise ValueError('bad count %s=%d'%(n,c))
            p+=c*sz; continue
        if f=='AI':
            v=struct.unpack_from('<i',h,p)[0]; out.append((n,v,hex(p))); p+=4
            if v==1 or v>=2: p=run(p,AI,extra,out,1)
            p=run(p,TAIL,extra,out,2); continue
        v=struct.unpack_from('<'+f,h,p); out.append((n,v[0] if len(v)==1 else v,hex(p))); p+=struct.calcsize('<'+f)
    return p
if __name__=='__main__':
    start=0x1d6502; target=0x1d66a2
    base=[]; 
    try: e=run(start,RC,None,base); print('no extra end',hex(e))
    except Exception as ex: print('no extra err',ex)
    allf=[(0,i) for i in range(len(RC))]+[(1,i) for i in range(len(AI))]+[(2,i) for i in range(len(TAIL))]
    for k in range(1,9):
        for pos in allf:
            out=[]
            try: e=run(start,RC,(pos,k),out)
            except Exception as ex: continue
            if e+0==target-1 or e==target:
                print('k',k,'pos',pos,[x for x in out if x[0] in('EXTRA','need_unit_ai','idle_timeout','state_x','state_y','town_bell_flag','skip_volley')], hex(e))
