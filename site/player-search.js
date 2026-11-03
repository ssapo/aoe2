(function(root){
 'use strict';
 const DEFAULT=26260702,HERA=199325;
 function profileId(value){const s=String(value??'').trim();return /^[1-9]\d{0,14}$/.test(s)&&Number.isSafeInteger(Number(s))?Number(s):null;}
 const normalize=s=>String(s??'').normalize('NFKC').toLocaleLowerCase().trim();
 function search(players,query){
  const q=normalize(query);if(!q)return [];
  const id=profileId(q),hera=['hera','헤라'].includes(q);
  return players.filter(p=>id?p.id===id:(hera&&p.id===HERA)||normalize(p.name).includes(q)).sort((a,b)=>(normalize(b.name)===q)-(normalize(a.name)===q)||(a.rank||100001)-(b.rank||100001)).slice(0,20);
 }
 const api={DEFAULT,HERA,profileId,search};if(typeof module==='object'&&module.exports)module.exports=api;else root.SSAPOPlayers=api;
})(typeof window==='undefined'?globalThis:window);
