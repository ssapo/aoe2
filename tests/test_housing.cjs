const {test}=require('node:test'),assert=require('node:assert/strict');
const H=require('../site/housing.js');
const h={min_block_seconds:10,own:{blocks:[{from_seconds:282.6,to_seconds:331.8,seconds:49.2,population:'14/15'}],blocked_seconds:49.2},opponent:{blocks:[],blocked_seconds:0}};
const none={own:{blocks:[],blocked_seconds:0},opponent:{blocks:[],blocked_seconds:0}};
test('own block shows a must-fix warning with the lost villager time and a fix',()=>{
 const html=H.warning(h);
 assert.match(html,/꼭 고칠 점 · 봉건 전 인구 막힘/);
 assert.match(html,/<strong>0:49<\/strong> 동안 생산이 멈췄어요/);
 assert.match(html,/주민 약 2명분 생산 시간을 잃었어요\. 상대는 막힘이 없었어요\./);
 assert.match(html,/4:42~5:31<\/time> 인구 14\/15 · 0:49/);
 assert.match(html,/상한보다 3 적을 때/);
 assert.match(html,/data-open-age="봉건"/);
 assert.equal(H.warning(none),'');assert.equal(H.warning(null),'');
 assert.equal(H.warning({...h,own:null}),'');
});
test('short blocks name a share of one villager and escape population text',()=>{
 const html=H.warning({own:{blocks:[{from_seconds:10,to_seconds:22,seconds:12,population:'<b>'}],blocked_seconds:12},opponent:{blocks:[{from_seconds:1,to_seconds:21,seconds:20,population:'5/5'}],blocked_seconds:20}});
 assert.match(html,/주민 1명분 시간의 48%/);
 assert.match(html,/상대도 0:20 막혔어요/);
 assert.doesNotMatch(html,/<b>/);
});
test('match list badge only for own blocks',()=>{
 assert.equal(H.badge(h),'<span class="housing-badge" title="봉건 전 인구 막힘 · 추정">인구 막힘 0:49</span>');
 assert.equal(H.badge(none),'');assert.equal(H.badge(undefined),'');
 assert.equal(H.badge({own:none.own,opponent:h.own}),'');
});
test('summary card is left for an opponent-only block',()=>{
 assert.equal(H.highlight(h),'');
 const theirs=H.highlight({own:none.own,opponent:h.own});
 assert.match(theirs,/class="highlight ahead"/);assert.match(theirs,/<strong>없음<\/strong>/);assert.match(theirs,/상대 0:49/);
 assert.equal(H.highlight(none),'');
});
test('feudal rows list intervals and missing sides',()=>{
 assert.deepEqual(H.rows(h),[['봉건 전 인구 막힘 · 추정','0:49 (4:42~5:31 14/15)','없음']]);
 assert.deepEqual(H.rows({own:null,opponent:h.opponent}),[['봉건 전 인구 막힘 · 추정','—','없음']]);
 assert.deepEqual(H.rows({}),[]);
 assert.match(H.note(h),/10초보다 짧은/);
});
