// ══ STATUS (with caching + limit 10) ══════════════════════════════
let lStatuses=null;
function loadStatuses(){
  fetchAndRenderStatuses();
  if(!lStatuses&&me){
    // We can only safely keep a LIVE listener on our OWN statuses list.
    // A single always-on listener at the top-level `statuses` node (the
    // old approach) would be denied outright once per-status privacy
    // rules are enforced server-side, since a bulk read can't be
    // partially filtered by deeper rules. Everyone else's statuses are
    // refreshed fresh each time this runs (e.g. opening the Updates tab).
    lStatuses=db.ref(`statuses/${me.uid}`).on('value',()=>fetchAndRenderStatuses());
  }
}
async function fetchAndRenderStatuses(){
  if(!me)return;
  const usersSnap=await db.ref('users').once('value');
  const allUsers=usersSnap.val()||{};
  const otherUids=Object.keys(allUsers).filter(uid=>uid!==me.uid);
  const data={};
  const mySnap=await db.ref(`statuses/${me.uid}`).once('value');
  data[me.uid]=mySnap.val()||{};
  // Fetching each other user's statuses individually (rather than one bulk
  // read of the whole tree) is what actually lets Firebase rules enforce
  // per-status privacy — a request for the whole `statuses` node can't be
  // partially granted based on rules deeper inside it.
  await Promise.all(otherUids.map(async uid=>{
    try{
      const snap=await db.ref(`statuses/${uid}`).once('value');
      const val=snap.val();
      if(val)data[uid]=val;
    }catch(e){ /* no read access to this user's statuses (or none exist) — just skip them */ }
  }));
  statusCache={data,ts:Date.now()};
  renderStatuses(data,allUsers);
}
function canSeeStatus(s){
  // A status with no privacy field, or privacy:'everyone', is visible to all.
  // Anything else is only visible if the poster explicitly listed us —
  // that list (visibleTo) was computed by the poster themselves at post
  // time from their own private contacts, so we never need to read
  // anyone else's contacts list to work this out.
  if(!s.privacy||s.privacy==='everyone')return true;
  return !!(s.visibleTo&&me&&s.visibleTo[me.uid]);
}
function renderStatuses(data,allUsers){
  const list=$('status-list');if(!list)return;
  list.innerHTML='';let newCount=0;
  const now=Date.now();
  const allUids=Object.keys(data).filter(uid=>uid!==me?.uid);
  // Own status avatar
  const myItems=Object.values(data[me?.uid]||{}).filter(s=>now-s.timestamp<86400000);
  const myAv=$('my-sv-av');if(myAv)myAv.src=me?.photoURL||avUrl(me?.username||'U');
  const myHint=$('my-status-hint');if(myHint)myHint.textContent=myItems.length?`${myItems.length} update${myItems.length>1?'s':''} · Tap to view`:'Tap to add a status update';
  if(!allUids.length){const ns=$('no-status');if(ns)ns.style.display='block';return;}
  let anyVisible=false;
  allUids.forEach(uid=>{
    const u=(allUsers&&allUsers[uid])||{};
    const items=Object.values(data[uid]||{})
      .filter(s=>now-s.timestamp<86400000&&canSeeStatus(s))
      .sort((a,b)=>b.timestamp-a.timestamp);
    if(!items.length)return;
    anyVisible=true;
    const displayName=getDisplayName(uid,u.username);
    const seen=localStorage.getItem(`sv_${uid}`);
    const isNew=!seen||parseInt(seen)<items[0].timestamp;
    if(isNew)newCount++;
    const div=document.createElement('div');div.className='ci';div.style.cursor='pointer';
    div.innerHTML=`<div style="position:relative;flex-shrink:0;">
      <img src="${esc(u.photoURL||avUrl(u.username||'U'))}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:3px solid ${isNew?'var(--g)':'rgba(255,255,255,.2)'};">
      ${isNew?'<div style="position:absolute;top:0;right:0;width:14px;height:14px;background:var(--g);border-radius:50%;border:2px solid var(--bg);"></div>':''}
    </div>
    <div style="flex:1;min-width:0;">
      <div style="font-weight:600;color:var(--t1);font-size:14px;">${esc(displayName)}</div>
      <div style="font-size:12px;color:var(--t2);margin-top:2px;">${items.length} update${items.length>1?'s':''} · ${ago(items[0].timestamp)}</div>
    </div>`;
    div.onclick=()=>viewStatus(uid,{...u,username:displayName},items);
    list.appendChild(div);
  });
  const ns=$('no-status');if(ns)ns.style.display=anyVisible?'none':'block';
  if(newCount>0){const nb=$('status-nb');if(nb){nb.textContent=newCount;nb.classList.remove('hidden');}}
}
let svItems=[],svIdx=0,svUid=null,svTimer=null,svMusicAudio=null;
function viewStatus(uid,u,items){
  svItems=items;svIdx=0;svUid=uid;$('status-viewer').classList.remove('hidden');
  $('sv-av').src=u.photoURL||avUrl(u.username);$('sv-name').textContent=u.username||'User';
  $('sv-views-btn').classList.toggle('hidden',uid!==me?.uid);
  localStorage.setItem(`sv_${uid}`,Date.now());
  db.ref(`statuses/${uid}/${items[0].key||''}/views/${me?.uid}`).set(true);
  renderSV(0);
}
function renderSV(idx){
  clearTimeout(svTimer);if(!svItems[idx])return closeStatusViewer();
  if(svMusicAudio){svMusicAudio.pause();svMusicAudio.src='';svMusicAudio=null;}
  const s=svItems[idx];$('sv-time').textContent=ago(s.timestamp);$('sv-caption').textContent=s.caption||'';
  const c=$('sv-content');c.innerHTML='';
  if(s.type==='photo')c.innerHTML=`<img src="${esc(s.url)}" style="max-width:100%;max-height:100%;object-fit:contain;">`;
  else if(s.type==='video'){c.innerHTML=`<video controls autoplay style="max-width:100%;max-height:100%;"><source src="${esc(s.url)}"></video>`;const vid=c.querySelector('video');if(vid){vid.addEventListener('ended',()=>nextStatus());vid.addEventListener('error',()=>nextStatus());}}
  else if(s.type==='voice')c.innerHTML=`<audio controls autoplay src="${esc(s.url)}" style="width:90%;"></audio>`;
  if(s.music?.url&&s.type!=='voice'){
    svMusicAudio=new Audio(s.music.url);svMusicAudio.loop=true;svMusicAudio.volume=0.8;
    svMusicAudio.play().catch(()=>{}); // browser may block until user has interacted with the page — non-fatal
    const badge=document.createElement('div');
    badge.style.cssText='position:absolute;top:14px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.5);color:#fff;font-size:12px;padding:5px 12px;border-radius:20px;display:flex;align-items:center;gap:6px;z-index:3;';
    badge.innerHTML=`<i class="fa-solid fa-music"></i> ${esc(s.music.title||'Music')}`;
    c.appendChild(badge);
  }
  const bars=$('sv-bars');bars.innerHTML='';
  svItems.forEach((_,i)=>{const seg=document.createElement('div');seg.className='sv-seg';const fill=document.createElement('div');fill.className='sv-seg-fill';if(i<idx)fill.style.width='100%';seg.appendChild(fill);bars.appendChild(seg);if(i===idx)setTimeout(()=>fill.style.width='100%',50);});
  svTimer=setTimeout(()=>nextStatus(),s.type==='video'?30000:5000);// video fallback 30s; ended event fires first
  if(svUid===me?.uid){$('sv-vc').textContent=Object.keys(s.views||{}).length;$('sv-views-btn').classList.remove('hidden');
    // Load viewer names
    const vl=$('status-viewers-list');if(vl){vl.innerHTML='';Object.keys(s.views||{}).forEach(uid=>{db.ref(`users/${uid}`).once('value').then(us=>{const u2=us.val()||{};const d=document.createElement('div');d.className='ci';d.innerHTML=`<img src="${esc(u2.photoURL||avUrl(u2.username))}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;"><div style="font-weight:600;color:var(--t1);">${esc(u2.username||'User')}</div>`;vl.appendChild(d);});});}
  }
}
function nextStatus(){if(svIdx<svItems.length-1){svIdx++;renderSV(svIdx);}else closeStatusViewer();}
function prevStatus(){if(svIdx>0){svIdx--;renderSV(svIdx);}}
function closeStatusViewer(){clearTimeout(svTimer);if(svMusicAudio){svMusicAudio.pause();svMusicAudio.src='';svMusicAudio=null;}$('status-viewer').classList.add('hidden');}
function openMyStatus(){
  const myItems=Object.values(statusCache.data?.[me?.uid]||{}).filter(s=>Date.now()-s.timestamp<86400000);
  if(myItems.length)viewStatus(me.uid,me,myItems);else openStatusCreator();
}
let _statusPrivacy={mode:'everyone',selected:new Set()};
function resetStatusPrivacyUI(){
  _statusPrivacy={mode:'everyone',selected:new Set()};
  const pl=$('status-privacy-picklist');if(pl){pl.classList.add('hidden');pl.innerHTML='';}
  updateStatusPrivacyButtons();
}
function updateStatusPrivacyButtons(){
  const map={everyone:'sp-everyone',contacts:'sp-contacts',contacts_except:'sp-except',only_these:'sp-only'};
  Object.values(map).forEach(id=>{
    const btn=$(id);if(!btn)return;
    btn.style.background='var(--s2)';btn.style.color='var(--t1)';btn.style.border='none';
  });
  const activeBtn=$(map[_statusPrivacy.mode]);
  if(activeBtn){activeBtn.style.background='rgba(0,168,132,.15)';activeBtn.style.color='var(--g)';activeBtn.style.border='1px solid var(--g)';}
}
function setStatusPrivacy(mode){
  _statusPrivacy.mode=mode;_statusPrivacy.selected=new Set();
  updateStatusPrivacyButtons();
  const pl=$('status-privacy-picklist');if(!pl)return;
  if(mode!=='contacts_except'&&mode!=='only_these'){pl.classList.add('hidden');pl.innerHTML='';return;}
  const entries=Object.entries(_contacts);
  if(!entries.length){
    pl.classList.remove('hidden');
    pl.innerHTML='<div style="font-size:12px;color:var(--t2);padding:8px;">You have no saved contacts yet. Save some from their profile first.</div>';
    return;
  }
  pl.classList.remove('hidden');pl.innerHTML='';
  const hint=document.createElement('div');
  hint.style.cssText='font-size:11px;color:var(--t2);margin-bottom:6px;';
  hint.textContent=mode==='contacts_except'?'Tap to exclude from your contacts:':'Tap to choose who can see it:';
  pl.appendChild(hint);
  entries.forEach(([uid,c])=>{
    const row=document.createElement('label');
    row.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 4px;font-size:13px;color:var(--t1);cursor:pointer;';
    const cb=document.createElement('input');cb.type='checkbox';
    cb.onchange=()=>{if(cb.checked)_statusPrivacy.selected.add(uid);else _statusPrivacy.selected.delete(uid);};
    row.appendChild(cb);
    const span=document.createElement('span');span.textContent=c.savedName||c.username||'User';
    row.appendChild(span);
    pl.appendChild(row);
  });
}
function openStatusCreator(){statusFile_=null;statusType__=null;statusRecBlob=null;$('status-prev-box').classList.add('hidden');$('voice-status-ui').classList.add('hidden');$('post-status-btn').classList.add('hidden');clearStatusMusic();resetStatusPrivacyUI();openModal('status-creator-modal');}
function closeStatusCreator(){closeModal('status-creator-modal');}
function statusType_pick(t){
  statusType__=t;
  if(t==='voice'){$('voice-status-ui').classList.remove('hidden');$('status-prev-box').classList.add('hidden');return;}
  $('voice-status-ui').classList.add('hidden');
  const inp=document.createElement('input');inp.type='file';inp.accept=t==='photo'?'image/*':'video/*';
  inp.onchange=e=>{statusFile_=e.target.files[0];if(!statusFile_)return;const url=URL.createObjectURL(statusFile_);const p=$('status-prev-box');p.classList.remove('hidden');p.innerHTML=t==='photo'?`<img src="${esc(url)}" style="max-height:200px;border-radius:12px;display:block;margin:0 auto;">`:`<video controls src="${esc(url)}" style="max-height:200px;border-radius:12px;"></video>`;$('post-status-btn').classList.remove('hidden');};inp.click();
}
async function toggleStatusVoice(){
  if(statusIsRec){statusMRec?.stop();return;}
  try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});statusAChunks=[];statusMRec=new MediaRecorder(stream);statusIsRec=true;
    $('rec-status-btn').style.background='var(--g)';$('rec-status-lbl').textContent='Recording… tap to stop';
    statusMRec.ondataavailable=e=>statusAChunks.push(e.data);
    statusMRec.onstop=()=>{statusIsRec=false;stream.getTracks().forEach(t=>t.stop());statusRecBlob=new Blob(statusAChunks,{type:'audio/webm'});$('rec-status-btn').innerHTML='<i class="fa-solid fa-play" style="color:#fff;font-size:28px;"></i>';$('rec-status-lbl').textContent='Voice recorded ✓';$('post-status-btn').classList.remove('hidden');};
    statusMRec.start();
  }catch{statusIsRec=false;toast('Mic access denied','error');}
}
async function postStatusCore(){
  if(!me)return;const btn=$('post-status-btn');btn.disabled=true;btn.textContent='Posting…';
  toast('Uploading… please wait','info');
  const pendingMusic=window._pendingStatusMusic; // captured before any await — postStatus() clears the global right after calling this (fire-and-forget), so this must happen first
  const privacyMode=_statusPrivacy.mode;
  const excludedOrIncluded=new Set(_statusPrivacy.selected);
  try{
    let url='';const t=statusType__;
    if(t==='voice'&&statusRecBlob)url=await uploadCld(new File([statusRecBlob],'status.webm',{type:'audio/webm'}));
    else if(statusFile_)url=await uploadCld(statusFile_);
    const key=db.ref(`statuses/${me.uid}`).push().key;
    const payload={type:t==='photo'?'photo':t==='video'?'video':'voice',url,caption:$('status-caption-inp').value.trim(),timestamp:Date.now(),views:{},key,privacy:privacyMode};
    if(pendingMusic?.url)payload.music={url:pendingMusic.url,title:pendingMusic.title||'Music'};
    // We (the poster) compute exactly who's allowed to see this, using our
    // own private contacts list, and publish only that resulting uid list —
    // never the contacts list itself. That's what a viewer's read gets
    // checked against, so nobody else ever needs read access to our contacts.
    if(privacyMode==='contacts'){
      const visibleTo={};Object.keys(_contacts).forEach(uid=>visibleTo[uid]=true);
      if(Object.keys(visibleTo).length)payload.visibleTo=visibleTo;
      else toast('Heads up: you have no saved contacts, so nobody will see this status.','info');
    }else if(privacyMode==='contacts_except'){
      const visibleTo={};Object.keys(_contacts).forEach(uid=>{if(!excludedOrIncluded.has(uid))visibleTo[uid]=true;});
      if(Object.keys(visibleTo).length)payload.visibleTo=visibleTo;
      else toast('Heads up: excluding everyone means nobody will see this status.','info');
    }else if(privacyMode==='only_these'){
      const visibleTo={};excludedOrIncluded.forEach(uid=>visibleTo[uid]=true);
      if(Object.keys(visibleTo).length)payload.visibleTo=visibleTo;
      else toast('Heads up: you didn\'t pick anyone, so nobody will see this status.','info');
    }
    await db.ref(`statuses/${me.uid}/${key}`).set(payload);
    statusCache={data:null,ts:0};// invalidate cache
    toast('✅ Status posted!','success');closeStatusCreator();
  }catch{toast('Failed to post','error');}
  finally{btn.disabled=false;btn.textContent='Post Status ✓';}
}

// ══ MKJ SEARCH ════════════════════════════════════════════════════
function openSearch(){openModal('search-modal');setTimeout(()=>$('ph-inp')?.focus(),150);}
function closeSearch(){closeModal('search-modal');if($('ph-inp'))$('ph-inp').value='';if($('ph-result'))$('ph-result').innerHTML='';}
async function searchMKJ(){
  let q=($('ph-inp').value||'').trim();const res=$('ph-result');
  if(!q)return toast('Enter MKJ number or username','error');
  q=q.replace(/^#/,'');
  res.innerHTML='<div style="text-align:center;color:var(--t2);padding:16px;">Searching…</div>';
  try{
    let snap=await db.ref('users').orderByChild('mkjNumber').equalTo(q).once('value');
    if(!snap.val())snap=await db.ref('users').orderByChild('username').equalTo(q).once('value');
    if(!snap.val())snap=await db.ref('users').orderByChild('username').equalTo(q.toLowerCase()).once('value');
    if(!snap.val())snap=await db.ref('users').orderByChild('username').equalTo(q.charAt(0).toUpperCase()+q.slice(1).toLowerCase()).once('value');
    const users=snap.val();
    if(!users){res.innerHTML='<div style="text-align:center;color:var(--red);padding:16px;">❌ No user found with that MKJ number or username</div>';return;}
    res.innerHTML='';
    Object.entries(users).forEach(([uid,u])=>{
      if(uid===me.uid){res.innerHTML='<div style="text-align:center;color:var(--t2);padding:12px;">That\'s your own account 😊</div>';return;}
      recordProfileView(uid);
      const div=document.createElement('div');div.style.cssText='display:flex;align-items:center;gap:12px;padding:14px;background:var(--s2);border-radius:14px;cursor:pointer;';
      div.innerHTML=`<img src="${esc(u.photoURL||avUrl(u.username))}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;flex-shrink:0;">
        <div style="flex:1;min-width:0;"><div style="font-weight:700;color:var(--t1);font-size:16px;">${esc(getDisplayName(uid,u.username))}</div>
        <div style="font-size:12px;color:var(--blue);margin-top:2px;">#${esc(u.mkjNumber||'')}</div>
        <div style="font-size:12px;color:var(--t2);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(u.bio||'')}</div></div>
        <button style="padding:9px 16px;background:var(--g);border-radius:10px;color:#fff;font-weight:700;font-size:13px;flex-shrink:0;">Chat</button>`;
      div.addEventListener('click',()=>openPrivate(uid,u.username,u.mkjNumber||'',u.photoURL||''));
      res.appendChild(div);
    });
  }catch(e){res.innerHTML=`<div style="text-align:center;color:var(--red);padding:16px;">Error: ${esc(e.message)}</div>`;}
}

// ══ SEARCH MESSAGES ═══════════════════════════════════════════════
function searchMessages(q){
  const res=$('msg-search-results');if(!q){res.innerHTML='';return;}
  res.innerHTML='<div style="color:var(--t2);text-align:center;padding:12px;">Searching…</div>';
  const refs=[db.ref('global_chat').orderByChild('text').startAt(q).endAt(q+'\uf8ff').limitToFirst(10)];
  if(chatId)refs.push(db.ref(`private_chats/${chatId}`).orderByChild('text').startAt(q).endAt(q+'\uf8ff').limitToFirst(10));
  Promise.all(refs.map(r=>r.once('value'))).then(snaps=>{
    res.innerHTML='';let total=0;
    snaps.forEach(snap=>{snap.forEach(child=>{
      const m=child.val();if(!m.text||!m.text.toLowerCase().includes(q.toLowerCase()))return;
      const div=document.createElement('div');div.style.cssText='background:var(--s2);border-radius:12px;padding:12px;margin-bottom:8px;';
      div.innerHTML=`<div style="font-size:12px;color:var(--g);font-weight:600;margin-bottom:4px;">${esc(m.username||'')}</div>
        <div style="color:var(--t1);font-size:14px;">${highlightText(m.text,q)}</div>
        <div style="font-size:11px;color:var(--t2);margin-top:4px;">${ago(m.timestamp)}</div>`;
      res.appendChild(div);total++;
    });});
    if(!total)res.innerHTML='<div style="color:var(--t2);text-align:center;padding:12px;">No results found</div>';
  });
}

// ══ NAVIGATION ════════════════════════════════════════════════════
function showView(v){
  curView=v;
  ['chats','feed','global','private','group','channel','status','profile'].forEach(x=>{
    const el=$(`v-${x}`);if(!el)return;
    el.classList.remove('show');
    // feed uses CSS class only (position:fixed) - don't set inline style or it breaks positioning
    if(x!=='feed')el.style.display='none';
  });
  const el=$(`v-${v}`);if(el){
    el.classList.add('show');
    if(v!=='feed'){el.style.display='flex';el.style.flexDirection='column';}
    // feed visibility is handled purely by CSS: #v-feed{display:none} / #v-feed.show{display:flex}
  }
  $('bottom-nav').style.display=['private','group','channel','feed'].includes(v)?'none':'flex';
  if(v==='global'){gUnread=0;[$('g-badge'),$('g-nb')].forEach(b=>{if(b){b.classList.add('hidden');b.textContent='0';}});scrollBottom('global-msgs');applyCommunityMode();}
  if(v==='profile'){loadPrivToggles();updateProfileCompletion();buildFAQ();renderProfileCEOBtn();renderProfileHighlights();try{initTranslationUI();}catch(e){console.error('Translation UI init failed:',e);}}
}
function switchTab(tab){
  curTab=tab;
  ['chats','feed','global','status','profile'].forEach(t=>{
    const btn=$(`nav-${t}`);if(btn)btn.classList.toggle('active',t===tab);
  });
  // Hide bottom nav in feed (TikTok style - full immersive), show it otherwise
  const nav=$('bottom-nav');
  if(nav)nav.style.display=tab==='feed'?'none':'flex';
  if(tab==='chats')showView('chats');
  else if(tab==='global')showView('global');
  else if(tab==='feed'){showView('feed');loadFeed();}
  else if(tab==='status'){showView('status');loadStatuses();}
  else if(tab==='profile')showView('profile');
}
function goBack(to){
  showView(to);
  ['chats','feed','global','status','profile'].forEach(t=>{const b=$(`nav-${t}`);if(b)b.classList.toggle('active',t===to);});
  curTab=to;
}

// ══ AUTH ══════════════════════════════════════════════════════════
function authTab(t){
  const isLogin=t==='login';
  $('login-panel').classList.toggle('hidden',!isLogin);$('reg-panel').classList.toggle('hidden',isLogin);
  const base='flex:1;padding:12px;font-weight:700;font-size:15px;background:none;';
  $('tab-si').style.cssText=base+(isLogin?'color:var(--g);border-bottom:2.5px solid var(--g);':'color:var(--t2);border-bottom:2.5px solid transparent;');
  $('tab-re').style.cssText=base+(!isLogin?'color:var(--g);border-bottom:2.5px solid var(--g);':'color:var(--t2);border-bottom:2.5px solid transparent;');
}
function previewPic(inp){const f=inp.files[0];if(!f)return;$('av-prev').src=URL.createObjectURL(f);}

async function doRegister(){
  const name=$('rn').value.trim(),email=$('re').value.trim(),pass=$('rp').value;
  if(!name)return toast('Enter your name','error');
  if(!email||!email.includes('@'))return toast('Enter a valid email','error');
  if(pass.length<6)return toast('Password must be at least 6 characters','error');
  const btn=$('reg-btn');btn.textContent='Creating…';btn.disabled=true;
  let uid=null;
  try{const cred=await auth.createUserWithEmailAndPassword(email,pass);uid=cred.user.uid;}
  catch(err){btn.textContent='Create Account';btn.disabled=false;
    const msgs={'auth/email-already-in-use':'Email already registered — go to Sign In.','auth/weak-password':'Password too weak.','auth/invalid-email':'Invalid email.'};
    return toast(msgs[err.code]||`Error: ${err.message}`,'error');}
  try{
    let photoURL=avUrl(name);
    const pic=$('pic-inp').files[0];if(pic){try{const c=await compressImage(pic,512,0.85);photoURL=await uploadCld(c);}catch(e){}}
    const mkjNumber=await getUniqueMKJ();
    await db.ref(`users/${uid}`).set({username:name,email,photoURL,mkjNumber,bio:'Hey there! I am using MKJ Chat.',online:true,lastSeen:Date.now(),createdAt:Date.now(),twoFA:false});
    toast(`Welcome to MKJ Chat! Your number: #${mkjNumber} 🎉`,'success');
  }catch(err2){toast('Account created! Setting up profile…','info');}
  finally{btn.textContent='Create Account';btn.disabled=false;}
}

async function doLogin(){
  const email=$('le').value.trim(),pass=$('lp').value;
  if(!email||!pass)return toast('Enter email and password','error');
  const btn=$('login-btn');btn.textContent='Signing in…';btn.disabled=true;
  try{await auth.signInWithEmailAndPassword(email,pass);}
  catch(err){btn.textContent='Sign In';btn.disabled=false;
    const msgs={'auth/user-not-found':'No account with this email.','auth/wrong-password':'Incorrect password.','auth/invalid-email':'Invalid email.','auth/too-many-requests':'Too many attempts. Try later.','auth/invalid-credential':'Wrong email or password.'};
    toast(msgs[err.code]||`Login error: ${err.message}`,'error');}
}

async function doGoogleAuth(){
  const btns=document.querySelectorAll('.google-btn');btns.forEach(b=>{b.disabled=true;b.style.opacity='.6';});
  try{
    const result=await auth.signInWithPopup(GP);
    await handleGoogleUser(result.user);
  }catch(err){
    if(err.code==='auth/popup-blocked')toast('Allow popups for this site in browser settings','error');
    else if(err.code==='auth/unauthorized-domain')toast('Add your Netlify domain to Firebase → Auth → Sign-in method → Authorized domains','error');
    else if(err.code!=='auth/popup-closed-by-user')toast(`Google: ${err.message||err.code}`,'error');
  }finally{btns.forEach(b=>{b.disabled=false;b.style.opacity='1';});}
}
async function handleGoogleUser(gUser){
  if(!gUser)return;
  const snap=await db.ref(`users/${gUser.uid}`).once('value');
  if(!snap.val()){
    const mkjNumber=await getUniqueMKJ();
    await db.ref(`users/${gUser.uid}`).set({username:gUser.displayName||gUser.email?.split('@')[0]||'User',email:gUser.email||'',photoURL:gUser.photoURL||avUrl(gUser.displayName||'User'),mkjNumber,bio:'Hey there! I am using MKJ Chat.',online:true,lastSeen:Date.now(),createdAt:Date.now(),twoFA:false});
    toast(`Welcome! Your MKJ number: #${mkjNumber} 🎉`,'success');
  }
}
auth.getRedirectResult().then(async r=>{if(r&&r.user)await handleGoogleUser(r.user);}).catch(()=>{});

// ══ AUTH STATE — FIXED MKJ NUMBER (NEVER REGENERATE) ═══════════════
auth.onAuthStateChanged(async user=>{
  if(user){
    let data=null;
    try{const snap=await db.ref(`users/${user.uid}`).once('value');data=snap.val();}catch(e){}
    if(!data){
      // Profile missing — create it once using existing mkjNumber if any, else generate new
      try{
        // Check if MKJ was already stored under this UID key (in case of partial write)
        const mkjSnap=await db.ref(`users/${user.uid}/mkjNumber`).once('value');
        const existingMKJ=mkjSnap.val();
        const mkjNumber=existingMKJ||await getUniqueMKJ();
        data={username:user.displayName||user.email?.split('@')[0]||'User',email:user.email||'',photoURL:user.photoURL||avUrl(user.displayName||'User'),mkjNumber,bio:'Hey there! I am using MKJ Chat.',online:true,lastSeen:Date.now(),createdAt:Date.now(),twoFA:false};
        await db.ref(`users/${user.uid}`).set(data);
        toast(`Setup complete! MKJ number: #${data.mkjNumber} 🎉`,'success');
      }catch(e){toast('Setup error. Check internet & Firebase rules.','error');return;}
    }
    // ALWAYS use the existing mkjNumber from database — NEVER generate a new one
    me={uid:user.uid,...data};
    // Apply saved settings
    const fs=localStorage.getItem('font_size')||'15';document.documentElement.style.setProperty('--fs',fs+'px');
    if(localStorage.getItem('theme')==='light')document.body.classList.add('light');else document.body.classList.remove('light');
    $('tog-theme')?.classList.toggle('on',!document.body.classList.contains('light'));
    // Show app
    $('session-check-screen').style.display='none';
    $('auth-screen').style.display='none';$('app').classList.remove('hidden');$('app').style.display='flex';
    // Update profile UI
    $('prof-img').src=me.photoURL;$('prof-name').textContent=me.username;$('prof-email').textContent=me.email||'';
    $('prof-mkj').textContent=`#${me.mkjNumber||''}`;$('prof-bio-show').textContent=me.bio||'Hey there! I am using MKJ Chat.';
    $('my-sv-av').src=me.photoURL;$('tog-2fa').classList.toggle('on',me.twoFA||false);
    // Bio link preview
    if(data.bioLink){me.bioLink=data.bioLink;const blp=$('bio-link-preview');if(blp)blp.textContent=data.bioLink;
      const blRow=$('prof-bio-link-row');const blA=$('prof-bio-link-a');const blTxt=$('prof-bio-link-txt');
      if(blRow)blRow.style.display='block';if(blA)blA.href=data.bioLink;if(blTxt)blTxt.textContent=data.bioLink.replace(/^https?:\/\//,'');
    }
    if(data.birthday){const bi=$('birthday-inp');if(bi)bi.value=data.birthday;}
    // Load followers/following counts into profile hero
    getFollowCounts(user.uid).then(fc=>{const fc_el=$('prof-followers-count');const ff_el=$('prof-following-count');if(fc_el)fc_el.textContent=fc.followers;if(ff_el)ff_el.textContent=fc.following;});
    // Render highlight rings
    setTimeout(renderProfileHighlights,400);
    // Presence
    db.ref('.info/connected').on('value',s=>{
      if(s.val()&&me&&localStorage.getItem('priv_online')!=='true'){
        db.ref(`users/${me.uid}/online`).set(true);
        db.ref(`users/${me.uid}/online`).onDisconnect().set(false);
        db.ref(`users/${me.uid}/lastSeen`).onDisconnect().set(firebase.database.ServerValue.TIMESTAMP);
      }
    });
    try{initTranslationUI();}catch(e){console.error('Translation UI init failed:',e);} // isolated so nothing else can silently block it
    buildEmojiGrid();buildFAQ();buildBgSwatches();loadPrivToggles();updateProfileCompletion();setVH();
    loadContacts();loadConvs();loadGlobal();loadStatuses();loadGroups();loadChannels();applyCommunityMode();checkInviteParam();
    startOnlineCounter();updateStreak();checkBirthdays();startNotifListener();checkDeepLinkParam();listenIncomingCalls();
    earnPoints(5,'daily_login');addSpacesBtn();watchSpacesStatus();
    db.ref(`users/${user.uid}/weekMsgCount`).transaction(n=>(n||0));
    initFCM();setTimeout(cleanupOld,10000);
    applyWallpaper('global');showLockIfNeeded();checkGroupInvite();resetInactTimer();
    switchTab('chats');
  }else{
    me=null;$('session-check-screen').style.display='none';$('auth-screen').style.display='flex';$('app').classList.add('hidden');$('app').style.display='none';
  }
});

// ══ LOGOUT ════════════════════════════════════════════════════════
function doLogout(){
  if(!confirm('Log out?'))return;
  if(lGlobal)db.ref('global_chat').off();
  if(lPrivate&&chatId)db.ref(`private_chats/${chatId}`).off();
  if(lConvs&&me)db.ref(`conversations/${me.uid}`).off();
  if(lGroup&&curGid)db.ref(`group_messages/${curGid}`).off();
  if(lGroups)db.ref('groups').off('value',lGroups);lGroups=null;
  if(lStatuses&&me)db.ref(`statuses/${me.uid}`).off('value',lStatuses);lStatuses=null;
  if(me)db.ref(`contacts/${me.uid}`).off('value');_contacts={};
  if(lChannel&&curChannelId)db.ref(`channel_posts/${curChannelId}`).off();lChannel=null;curChannelId=null;
  if(lFeed)db.ref('feed_posts').off();lFeed=null;
  if(_notifRef)_notifRef.off();_notifRef=null;
  if(_incomingCallRef){_incomingCallRef.off();_incomingCallRef=null;}
  if(_callId||_callPC||_callStream)closeCallUI();
  if(_gcallRoom)leaveGroupCall();
  stopWatchingGroupCallBanner();
  if(_collabNoteRef)_collabNoteRef.off();_collabNoteRef=null;
  if(_spacesRoom)leaveSpacesSession();
  stopWatchingSpaces();
  if(_onlineLRef){_onlineLRef.off('value');_onlineLRef=null;}
  Object.values(_convOnlineRefs).forEach(r=>r.off('value'));
  Object.keys(_convOnlineRefs).forEach(k=>delete _convOnlineRefs[k]);
  if(me){db.ref(`users/${me.uid}/online`).set(false);db.ref(`users/${me.uid}/lastSeen`).set(Date.now());}
  auth.signOut();me=null;chatId=null;chatTarget=null;curGid=null;
  $('app').classList.add('hidden');$('app').style.display='none';$('auth-screen').style.display='flex';
  $('le').value='';$('lp').value='';toast('Signed out');clearTimeout(inactTimer);
}
// ══ FEATURE 1: ONLINE COUNTER ══════════════════════════════════════
function startOnlineCounter(){
  db.ref('users').orderByChild('online').equalTo(true).on('value',snap=>{
    const count=Object.keys(snap.val()||{}).length;
    const el=$('online-count');const wrap=$('online-counter');
    if(el)el.textContent=count;
    if(wrap)wrap.style.display=count>0?'block':'none';
  });
}

// ══ FEATURE 2: REACTION ANIMATIONS ════════════════════════════════
function animateReact(em,x,y){
  const div=document.createElement('div');div.className='reaction-anim';div.textContent=em;
  div.style.left=(x-20)+'px';div.style.top=(y-20)+'px';
  document.body.appendChild(div);
  setTimeout(()=>div.remove(),900);
}
// Patch doReact to animate
function doReact(key,chatType,em){
  doReactCore(key,chatType,em);
  const el=document.getElementById('emoji-picker');
  if(el){const r=el.getBoundingClientRect();animateReact(em,r.left+r.width/2,r.top);}
}

// ══ FEATURE 3: MESSAGE TRANSLATOR (new modal approach) ════════════
let _xlateMsg='';
function openTranslatorModal(text){
  _xlateMsg=text;
  const ob=$('orig-text-box');if(ob)ob.textContent=text;
  const xr=$('translator-result-box');if(xr)xr.textContent='';
  openModal('translator-modal');
}
async function runTranslate(){
  if(!_xlateMsg)return;
  const lang=$('translator-lang-sel').value;
  const xr=$('translator-result-box');if(xr)xr.textContent='Translating…';
  try{
    // Calls our own Netlify Function, now backed by the MyMemory Translation API for full
    // Source language is guessed from the message sender's saved preference (falls back to English).
    // Uses the message's own stamped language (set by the sender's client from their own setting)
    // instead of reading another user's profile out of Firebase, which requires cross-user read
    // permissions that may not be granted by the app's security rules.
    const sourceLang=pickerMsg?.lang||await getUserPreferredLanguage(pickerMsg?.uid);
    if(xr)xr.textContent=await callTranslateFunction(_xlateMsg,sourceLang,lang);
  }catch(e){if(xr)xr.textContent='Translation unavailable.';}
}
// NOTE: the old "patch ep-xlate on DOMContentLoaded" block that used to live here has been removed.
// It only ever ran once at page load, so showPicker() (which re-assigns ep-xlate's handler on
// EVERY long-press, in chat-messaging.js) would silently undo it after the first use — that was
// the root cause of the Translate button not working. The fix now lives directly inside showPicker().
document.addEventListener('DOMContentLoaded',()=>{
  initFeedPullToRefresh();
});
function initFeedPullToRefresh(){
  const list=$('feed-list');if(!list)return;
  const THRESHOLD=70;
  let startY=0,dy=0,pulling=false,indicator=null;
  function ensureIndicator(){
    if(indicator)return indicator;
    indicator=document.createElement('div');
    indicator.id='feed-pull-indicator';
    indicator.style.cssText='position:absolute;top:10px;left:50%;transform:translateX(-50%) scale(.6);width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.15);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;z-index:11;opacity:0;transition:opacity .15s,transform .15s;pointer-events:none;';
    indicator.innerHTML='<i class="fa-solid fa-arrow-down"></i>';
    (list.parentElement||list).appendChild(indicator);
    return indicator;
  }
  list.addEventListener('touchstart',e=>{
    pulling=list.scrollTop<=0;
    startY=e.touches[0].clientY;dy=0;
  },{passive:true});
  list.addEventListener('touchmove',e=>{
    if(!pulling)return;
    dy=e.touches[0].clientY-startY;
    if(dy<=0){if(indicator)indicator.style.opacity=0;return;}
    const ind=ensureIndicator();
    const pull=Math.min(dy,110);
    ind.style.opacity=Math.min(pull/THRESHOLD,1);
    ind.style.transform=`translateX(-50%) scale(${0.6+Math.min(pull/THRESHOLD,1)*0.4})`;
    ind.innerHTML=pull>=THRESHOLD?'<i class="fa-solid fa-rotate"></i>':'<i class="fa-solid fa-arrow-down"></i>';
  },{passive:true});
  list.addEventListener('touchend',()=>{
    if(!pulling)return;
    pulling=false;
    if(dy>=THRESHOLD&&indicator){
      indicator.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i>';
      indicator.style.opacity=1;
      Promise.resolve(loadFeed()).finally(()=>{
        if(indicator)indicator.style.opacity=0;
      });
    }else if(indicator){
      indicator.style.opacity=0;
    }
    dy=0;
  },{passive:true});
}

// ══ FEATURE 4: GLOBAL SEARCH ACROSS CHATS ═════════════════════════
async function globalSearch(q){
  if(!q||!me)return;
  const results=[];
  // Search global chat
  const gs=await db.ref('global_chat').orderByChild('text').startAt(q).endAt(q+'\uf8ff').limitToFirst(5).once('value');
  gs.forEach(s=>{const m=s.val();if(m.text?.toLowerCase().includes(q.toLowerCase()))results.push({...m,_src:'Community',_key:s.key});});
  // Search conversations
  const cs=await db.ref(`conversations/${me.uid}`).once('value');
  const convData=cs.val()||{};
  await Promise.all(Object.keys(convData).slice(0,10).map(async cid=>{
    const ps=await db.ref(`private_chats/${cid}`).orderByChild('text').limitToLast(50).once('value');
    ps.forEach(s=>{const m=s.val();if(m.text?.toLowerCase().includes(q.toLowerCase()))results.push({...m,_src:convData[cid]?.targetUsername||'Chat',_key:s.key});});
  }));
  const list=$('global-search-results');if(!list)return;
  list.innerHTML='';
  if(!results.length){list.innerHTML='<div style="color:var(--t2);font-size:13px;text-align:center;padding:16px;">No results found</div>';return;}
  results.slice(0,20).forEach(m=>{
    const div=document.createElement('div');div.className='ci';div.style.cssText='border-radius:10px;margin-bottom:6px;flex-direction:column;align-items:flex-start;';
    div.innerHTML=`<div style="font-size:11px;color:var(--g);font-weight:600;margin-bottom:2px;">${esc(m._src)}</div><div style="font-size:14px;color:var(--t1);">${esc(m.text||'[media]')}</div><div style="font-size:11px;color:var(--t2);">${esc(m.username||'')} · ${esc(m.time||'')}</div>`;
    list.appendChild(div);
  });
}

// ══ FEATURE 5: CONTACT SHARING ════════════════════════════════════
function openContactShare(){
  const contacts=[];
  db.ref(`conversations/${me.uid}`).orderByChild('timestamp').limitToLast(20).once('value').then(snap=>{
    const data=snap.val()||{};const modal=document.createElement('div');modal.className='modal-bg';
    modal.style.zIndex='500';
    let html=`<div class="modal-box"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;"><span style="font-size:17px;font-weight:700;color:var(--t1);">Share Contact</span><button onclick="this.closest('.modal-bg').remove()" style="color:var(--t2);font-size:26px;">×</button></div><div style="display:grid;gap:8px;">`;
    Object.values(data).forEach(c=>{
      html+=`<div class="ci" style="border-radius:12px;cursor:pointer;" onclick="sendContact('${esc(c.targetUid)}','${esc(c.targetUsername)}','${esc(c.targetMKJ||'')}','${esc(c.targetPhoto||'')}');this.closest('.modal-bg').remove()">
        <img src="${esc(c.targetPhoto||avUrl(c.targetUsername))}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">
        <div><div style="color:var(--t1);font-weight:600;font-size:14px;">${esc(c.targetUsername||'')}</div><div style="font-size:12px;color:var(--blue);">#${esc(c.targetMKJ||'')}</div></div>
      </div>`;
    });
    html+=`</div></div>`;modal.innerHTML=html;document.body.appendChild(modal);
  });
}
function sendContact(uid,username,mkj,photo){
  if(!_attachChat||!me)return;
  const msg={uid:me.uid,username:me.username,mkjNumber:me.mkjNumber,photoURL:me.photoURL,type:'contact',contactUid:uid,contactUsername:username,contactMKJ:mkj,contactPhoto:photo,time:ts(),timestamp:Date.now()};
  if(_attachChat==='global')db.ref('global_chat').push(msg);
  else if(_attachChat==='private'&&chatId)db.ref(`private_chats/${chatId}`).push(msg);
  else if(_attachChat==='group'&&curGid)db.ref(`group_messages/${curGid}`).push(msg);
  toast('Contact shared ✓','success');
}

// ══ FEATURE 6: FOLDERS / LABELS ═══════════════════════════════════
let activeFolder='all';
function setFolder(folder,btn){
  activeFolder=folder;
  document.querySelectorAll('.folder-chip').forEach(c=>c.classList.remove('active'));
  if(btn)btn.classList.add('active');
  filterByFolder();
}
function filterByFolder(){
  const items=document.querySelectorAll('#convs-list .ci');
  items.forEach(item=>{
    const isGroup=item.dataset.isGroup==='true';
    const unread=parseInt(item.dataset.unread||'0');
    const isSaved=item.dataset.isSaved==='true';
    let show=true;
    if(activeFolder==='groups')show=isGroup;
    else if(activeFolder==='unread')show=unread>0;
    else if(activeFolder==='saved')show=isSaved;
    item.style.display=show?'':'none';
  });
}

// ══ FEATURE 7: DAILY STREAK ════════════════════════════════════════
function updateStreak(){
  if(!me)return;
  const today=new Date().toDateString();
  const last=localStorage.getItem(`streak_last_${me.uid}`);
  const count=parseInt(localStorage.getItem(`streak_count_${me.uid}`)||'0');
  let newCount=count;
  if(last===today){newCount=count;}
  else if(last===new Date(Date.now()-86400000).toDateString()){newCount=count+1;}
  else{newCount=1;}
  localStorage.setItem(`streak_last_${me.uid}`,today);
  localStorage.setItem(`streak_count_${me.uid}`,newCount);
  db.ref(`users/${me.uid}/streak`).set(newCount);
  const el=$('streak-display');
  if(el&&newCount>0)el.innerHTML=`<span class="streak-badge">🔥 ${newCount} day${newCount!==1?'s':''} streak</span>`;
}

// ══ FEATURE 8: VOICE TRANSCRIPTION ════════════════════════════════
function transcribeAudio(url,key){
  const box=$(`tr-${key}`);if(!box)return;
  if(box.textContent&&!box.classList.contains('hidden')){box.classList.add('hidden');return;}
  if(!('webkitSpeechRecognition' in window||'SpeechRecognition' in window)){
    box.textContent='Speech recognition not supported on this browser.';box.classList.remove('hidden');return;
  }
  box.textContent='Listening… play the audio above first.';box.classList.remove('hidden');
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  const r=new SR();r.continuous=false;r.interimResults=false;r.lang='en-US';
  r.onresult=e=>{box.textContent='"'+e.results[0][0].transcript+'"';};
  r.onerror=()=>{box.textContent='Could not transcribe. Try playing the audio and try again.';};
  r.start();
}

// ══ FEATURE 9: SAVED MESSAGES ══════════════════════════════════════
function openSavedMessages(){
  openModal('saved-modal');
  const list=$('saved-list');if(!list)return;list.innerHTML='';
  const saved=JSON.parse(localStorage.getItem(`saved_msgs_${me?.uid}`)||'[]');
  if(!saved.length){list.innerHTML='<div style="color:var(--t2);font-size:13px;text-align:center;padding:16px;">No saved messages yet.<br>Long press any message and tap ⭐ to save.</div>';return;}
  saved.slice().reverse().forEach((s,i)=>{
    const div=document.createElement('div');div.style.cssText='background:var(--s2);border-radius:12px;padding:12px;margin-bottom:8px;';
    div.innerHTML=`<div style="font-size:12px;color:var(--t2);margin-bottom:4px;">${esc(s.from||'Saved')} · ${esc(s.time||'')}</div><div style="font-size:14px;color:var(--t1);line-height:1.5;">${esc(s.text||'[media]')}</div><button onclick="deleteSaved(${saved.length-1-i})" style="font-size:11px;color:var(--red);margin-top:6px;">Remove</button>`;
    list.appendChild(div);
  });
}
function saveMsg(msg){
  if(!me)return;
  const key=`saved_msgs_${me.uid}`;
  const saved=JSON.parse(localStorage.getItem(key)||'[]');
  saved.push({text:msg.text,from:msg.username,time:msg.time,ts:Date.now()});
  if(saved.length>100)saved.shift();
  localStorage.setItem(key,JSON.stringify(saved));
  toast('Message saved 🔖','success');
}
function saveSelfNote(){
  const inp=$('saved-note-inp');if(!inp||!inp.value.trim())return;
  saveMsg({text:inp.value.trim(),username:'You',time:ts()});
  inp.value='';openSavedMessages();
}
function deleteSaved(idx){
  const key=`saved_msgs_${me?.uid}`;
  const saved=JSON.parse(localStorage.getItem(key)||'[]');
  saved.splice(idx,1);
  localStorage.setItem(key,JSON.stringify(saved));
  openSavedMessages();
}

// ══ FEATURE 10: ANONYMOUS CONFESSION ══════════════════════════════
function sendAnonPost(){
  const text=$('anon-inp')?.value.trim();
  if(!text)return toast('Write something first','error');
  if(!me)return toast('Not logged in','error');
  const msg={uid:me.uid,username:'Anonymous 🎭',mkjNumber:'',photoURL:'https://ui-avatars.com/api/?background=7C3AED&color=fff&bold=true&size=128&name=?',text,time:ts(),timestamp:Date.now(),type:'text',isAnon:true,realUid:me.uid,lang:getMyPreferredLanguage()};
  db.ref('global_chat').push(msg);
  $('anon-inp').value='';closeModal('anon-modal');
  toast('Posted anonymously 🎭','success');
}

// ══ FEATURE 11: POLLS EVERYWHERE ══════════════════════════════════
function openPollModal(){
  $('poll-chat-type').value=_attachChat||'global';
  closeModal('attach-modal');openModal('poll-everywhere-modal');
}
function addPollOpt(){
  const wrap=$('poll-opts-wrap');if(!wrap)return;
  const count=wrap.querySelectorAll('.poll-opt-inp').length;
  if(count>=6)return toast('Max 6 options','info');
  const inp=document.createElement('input');
  inp.placeholder=`Option ${count+1}`;inp.className='poll-opt-inp';
  inp.style.cssText='width:100%;padding:10px 12px;background:var(--s2);border-radius:10px;font-size:13px;color:var(--t1);margin-bottom:8px;';
  wrap.appendChild(inp);
}
function sendPollEverywhere(){
  const q=$('poll-q-inp')?.value.trim();
  const opts=[...(document.querySelectorAll('.poll-opt-inp')||[])].map(i=>i.value.trim()).filter(Boolean);
  if(!q||opts.length<2)return toast('Question and at least 2 options needed','error');
  const anon=$('anon-vote-tog')?.classList.contains('on')||false;
  const ct=$('poll-chat-type')?.value||_attachChat||'global';
  const msg={uid:me.uid,username:me.username,mkjNumber:me.mkjNumber,photoURL:me.photoURL,type:'poll',question:q,options:opts.map(o=>({option:o,votes:[]})),anonymous:anon,time:ts(),timestamp:Date.now()};
  if(ct==='global')db.ref('global_chat').push(msg);
  else if(ct==='private'&&chatId)db.ref(`private_chats/${chatId}`).push(msg);
  else if(ct==='group'&&curGid)db.ref(`group_messages/${curGid}`).push(msg);
  closeModal('poll-everywhere-modal');
  $('poll-q-inp').value='';
  document.querySelectorAll('.poll-opt-inp').forEach((inp,i)=>{if(i>1)inp.remove();else inp.value='';});
  toast('Poll sent 📊','success');
}

// ══ FEATURE 12: STATUS REACTIONS ══════════════════════════════════
function sendStatusReact(){
  if(!svUid||!svItems[svIdx]||!me)return;
  const statusKey=svItems[svIdx].key;
  const emojis=['❤️','🔥','😂','😮','👍','🙏'];
  const picker=document.createElement('div');
  picker.style.cssText='position:fixed;bottom:140px;left:50%;transform:translateX(-50%);z-index:9999;background:var(--s1);border-radius:16px;padding:12px;display:flex;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,.5);';
  emojis.forEach(em=>{
    const b=document.createElement('button');b.textContent=em;b.style.fontSize='26px';
    b.onclick=()=>{
      db.ref(`status_reactions/${svUid}/${statusKey}/${me.uid}`).set(em);
      // Notify status owner
      if(svUid!==me.uid)db.ref(`notifications/${svUid}`).push({type:'status_react',from:me.uid,fromName:me.username,emoji:em,timestamp:Date.now()});
      toast(`Reacted ${em} to status`,'success');
      picker.remove();
      renderStatusReacts(svUid,statusKey);
      // Open private chat
      setTimeout(()=>{const s=svItems[svIdx];if(s&&svUid!==me.uid){closeStatusViewer();db.ref(`users/${svUid}`).once('value').then(u=>{const ud=u.val()||{};openPrivate(svUid,ud.username||'User',ud.mkjNumber||'',ud.photoURL||'');});}},800);
    };
    picker.appendChild(b);
  });
  document.body.appendChild(picker);
  setTimeout(()=>picker.remove(),5000);
}
function renderStatusReacts(uid,statusKey){
  const row=$('sv-react-row');if(!row)return;row.innerHTML='';
  db.ref(`status_reactions/${uid}/${statusKey}`).once('value').then(snap=>{
    const data=snap.val()||{};
    const counts={};Object.values(data).forEach(e=>{counts[e]=(counts[e]||0)+1;});
    Object.entries(counts).forEach(([em,cnt])=>{
      const chip=document.createElement('div');chip.style.cssText='background:rgba(255,255,255,.2);border-radius:20px;padding:4px 10px;font-size:14px;color:#fff;';
      chip.textContent=`${em} ${cnt}`;row.appendChild(chip);
    });
  });
}

// ══ FEATURE 13: BIRTHDAY REMINDERS ════════════════════════════════
function saveBirthday(val){
  if(!me||!val)return;
  db.ref(`users/${me.uid}/birthday`).set(val);
  toast('Birthday saved 🎂','success');
  checkBirthdays();
}
function checkBirthdays(){
  if(!me)return;
  const today=new Date();const mm=String(today.getMonth()+1).padStart(2,'0');const dd=String(today.getDate()).padStart(2,'0');
  const todayMMDD=`${mm}-${dd}`;
  db.ref('users').once('value').then(snap=>{
    snap.forEach(s=>{
      const u=s.val();if(!u.birthday||s.key===me.uid)return;
      const bMMDD=u.birthday?.slice(5);
      if(bMMDD===todayMMDD){
        toast(`🎂 Today is ${u.username}'s birthday! Send them a wish!`,'success');
        // Show birthday banner in their chat header if open
        if(chatTarget?.uid===s.key){const sub=$('p-sub');if(sub)sub.textContent='🎂 Birthday today!';}
      }
    });
    // Check own birthday
    if(me.birthday){
      const myMMDD=me.birthday?.slice(5);
      if(myMMDD===todayMMDD)toast(`🎂 Happy Birthday to you! Have a great day!`,'success');
    }
  });
}

// ══ FEATURE 14: LEADERBOARD ════════════════════════════════════════
async function loadLeaderboard(){
  const list=$('leaderboard-list');if(!list)return;
  list.innerHTML='<div style="color:var(--t2);font-size:13px;text-align:center;padding:16px;">Loading…</div>';
  const snap=await db.ref('global_chat').orderByChild('timestamp').limitToLast(500).once('value');
  const counts={};const names={};const photos={};
  snap.forEach(s=>{
    const m=s.val();if(!m.uid||m.isAnon)return;
    counts[m.uid]=(counts[m.uid]||0)+1;
    names[m.uid]=m.username||'User';
    photos[m.uid]=m.photoURL||'';
  });
  const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10);
  list.innerHTML='';
  const medals=['🥇','🥈','🥉'];
  sorted.forEach(([uid,count],i)=>{
    const row=document.createElement('div');row.className='leaderboard-row';
    row.innerHTML=`<span style="font-size:22px;width:32px;">${medals[i]||`${i+1}`}</span>
      <img src="${esc(photos[uid]||avUrl(names[uid]))}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">
      <div style="flex:1;"><div style="color:var(--t1);font-weight:600;font-size:14px;">${esc(names[uid])}</div><div style="font-size:12px;color:var(--t2);">${count} messages this week</div></div>
      ${uid===me?.uid?'<span style="font-size:11px;color:var(--g);padding:2px 8px;background:rgba(0,168,132,.1);border-radius:10px;">You</span>':''}`;
    list.appendChild(row);
  });
  if(!sorted.length)list.innerHTML='<div style="color:var(--t2);font-size:13px;text-align:center;padding:16px;">No activity yet this week</div>';
}

// ══ FEATURE 15: GROUP READ RECEIPTS ═══════════════════════════════
function markGroupRead(msgKey){
  if(!curGid||!me||!msgKey)return;
  db.ref(`group_read/${curGid}/${msgKey}/${me.uid}`).set(true);
}
function renderGroupReadReceipts(el,msgKey){
  if(!curGid||!el)return;
  const readWrap=document.createElement('div');readWrap.style.cssText='font-size:10px;color:var(--t2);margin-top:2px;cursor:pointer;';
  readWrap.textContent='Seen by 0';
  readWrap.onclick=()=>{
    db.ref(`group_read/${curGid}/${msgKey}`).once('value').then(snap=>{
      const readers=Object.keys(snap.val()||{});
      const modal=document.createElement('div');modal.className='modal-bg';modal.style.zIndex='500';
      modal.onclick=e=>{if(e.target===modal)modal.remove();};
      let html=`<div class="modal-box"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;"><span style="font-weight:700;color:var(--t1);">Seen by ${readers.length}</span><button onclick="this.closest('.modal-bg').remove()" style="color:var(--t2);font-size:26px;">×</button></div>`;
      Promise.all(readers.map(uid=>db.ref(`users/${uid}/username`).once('value').then(s=>({uid,name:s.val()||'User'})))).then(users=>{
        users.forEach(u=>{html+=`<div class="ci" style="border-radius:10px;"><span style="color:var(--t1);font-size:14px;">${esc(u.name)}</span></div>`;});
        modal.innerHTML=html+'</div>';document.body.appendChild(modal);
      });
    });
  };
  db.ref(`group_read/${curGid}/${msgKey}`).on('value',snap=>{
    const count=Object.keys(snap.val()||{}).length;
    readWrap.textContent=count>0?`Seen by ${count}`:'';
  });
  el.appendChild(readWrap);
}

// ══ CONTACT CARD RENDERING (in makeMsg) ═══════════════════════════
// Patch makeMsg to handle contact type — done via contact-card div
// makeMsg already handles unknown types gracefully
