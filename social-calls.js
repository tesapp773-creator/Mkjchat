// ══ FEATURE 1: FOLLOW / FOLLOWING SYSTEM ════════════════════════
let curFeedTab='foryou';
function setFeedTab(tab){
  curFeedTab=tab;
  const fy=$('feed-tab-foryou');const fl=$('feed-tab-following');
  if(fy){fy.style.color=tab==='foryou'?'#fff':'rgba(255,255,255,.5)';fy.style.borderBottomColor=tab==='foryou'?'#fff':'transparent';}
  if(fl){fl.style.color=tab==='following'?'#fff':'rgba(255,255,255,.5)';fl.style.borderBottomColor=tab==='following'?'#fff':'transparent';}
  if(lFeed){db.ref('feed_posts').off();lFeed=null;}
  const list=$('feed-list');if(list)list.innerHTML='<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#666;">Loading…</div>';
  if(tab==='foryou'){loadFeed();}
  else{loadFollowingFeed();}
}
async function loadFollowingFeed(){
  const list=$('feed-list');if(!list||!me)return;
  list.innerHTML='';
  const followSnap=await db.ref(`follows/${me.uid}/following`).once('value');
  const following=Object.keys(followSnap.val()||{});
  if(!following.length){
    list.innerHTML='<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;"><div style="font-size:40px;">👥</div><div style="color:#888;font-size:15px;text-align:center;">No one to follow yet<br><span style="font-size:13px;color:#555;">Switch to For You to discover people</span></div></div>';
    return;
  }
  const snap=await db.ref('feed_posts').orderByChild('timestamp').limitToLast(100).once('value');
  const posts=[];
  snap.forEach(s=>{const p=s.val();if(following.includes(p.uid))posts.unshift({...p,key:s.key});});
  if(!posts.length){list.innerHTML='<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#888;font-size:14px;">No posts from people you follow yet</div>';return;}
  posts.forEach(p=>{
    try{list.appendChild(buildFeedPost(p));}
    catch(err){console.error('Feed post failed to render:',p.key,p.uid,err);}
  });
}
async function followUser(uid){
  if(!me||uid===me.uid)return;
  const ref=db.ref(`follows/${me.uid}/following/${uid}`);
  const snap=await ref.once('value');
  if(snap.val()){
    await ref.remove();
    await db.ref(`follows/${uid}/followers/${me.uid}`).remove();
    toast('Unfollowed','info');
  } else {
    await ref.set(true);
    await db.ref(`follows/${uid}/followers/${me.uid}`).set(true);
    db.ref(`notifications/${uid}`).push({type:'follow',fromUid:me.uid,fromName:me.username,fromPhoto:me.photoURL||'',timestamp:Date.now()});
    earnPoints(5,'follow');
    toast('Following ✓','success');
  }
  return !snap.val();
}
async function isFollowing(uid){
  if(!me)return false;
  const snap=await db.ref(`follows/${me.uid}/following/${uid}`).once('value');
  return !!snap.val();
}
async function getFollowCounts(uid){
  const [followers,following]=await Promise.all([
    db.ref(`follows/${uid}/followers`).once('value'),
    db.ref(`follows/${uid}/following`).once('value')
  ]);
  return{followers:Object.keys(followers.val()||{}).length,following:Object.keys(following.val()||{}).length};
}
async function openFollowList(uid,type){
  openModal('follow-modal');
  const title=$('follow-modal-title');const list=$('follow-list');
  if(title)title.textContent=type==='followers'?'Followers':'Following';
  if(list)list.innerHTML='<div style="color:var(--t2);text-align:center;padding:20px;">Loading…</div>';
  const snap=await db.ref(`follows/${uid}/${type}`).once('value');
  const uids=Object.keys(snap.val()||{});
  if(!uids.length){if(list)list.innerHTML='<div style="color:var(--t2);text-align:center;padding:20px;">None yet</div>';return;}
  if(list)list.innerHTML='';
  await Promise.all(uids.map(async uid2=>{
    const u=(await db.ref(`users/${uid2}`).once('value')).val()||{};
    const div=document.createElement('div');div.className='ci';div.style.cssText='border-radius:12px;margin-bottom:6px;cursor:pointer;';
    const following=await isFollowing(uid2);
    div.innerHTML=`<img src="${esc(u.photoURL||avUrl(u.username||'U'))}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;"><div style="flex:1;"><div style="font-weight:700;color:var(--t1);">${esc(getDisplayName(uid2,u.username))}</div><div style="font-size:12px;color:var(--blue);">#${esc(u.mkjNumber||'')}</div></div><button onclick="followUser('${uid2}').then(()=>openFollowList('${uid}','${type}'))" style="padding:6px 14px;background:${following?'var(--s2)':'var(--g)'};border-radius:20px;color:${following?'var(--t1)':'#fff'};font-size:13px;font-weight:600;">${following?'Following':'Follow'}</button>`;
    if(list)list.appendChild(div);
  }));
}

// ══ FEATURE 2: STORY HIGHLIGHTS ══════════════════════════════════
async function saveAsHighlight(statusKey,statusData){
  if(!me)return;
  await db.ref(`highlights/${me.uid}/${statusKey}`).set({...statusData,savedAt:Date.now()});
  toast('Saved as Highlight ✨','success');
  loadHighlights();
  renderProfileHighlights();
}
function loadHighlights(){
  if(!me)return;
  const list=$('highlights-list');if(!list)return;list.innerHTML='';
  db.ref(`highlights/${me.uid}`).once('value').then(snap=>{
    const data=snap.val()||{};const entries=Object.entries(data);
    if(!entries.length){list.innerHTML='<div style="color:var(--t2);font-size:13px;">No highlights yet. Long press a status to save it.</div>';return;}
    entries.forEach(([key,s])=>{
      const div=document.createElement('div');div.style.cssText='text-align:center;cursor:pointer;';
      const thumb=s.type==='photo'?`<img src="${esc(s.url)}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;border:2px solid var(--g);">`:`<div style="width:60px;height:60px;border-radius:50%;background:var(--s2);display:flex;align-items:center;justify-content:center;border:2px solid var(--g);font-size:20px;">🎬</div>`;
      div.innerHTML=`${thumb}<div style="font-size:11px;color:var(--t2);margin-top:4px;max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(s.caption||'Highlight')}</div><button onclick="deleteHighlight('${key}')" style="font-size:10px;color:var(--red);margin-top:2px;">Remove</button>`;
      div.onclick=e=>{if(e.target.tagName==='BUTTON')return;viewStatus(me.uid,me,[s]);};
      list.appendChild(div);
    });
  });
}
function renderProfileHighlights(){
  if(!me)return;
  const row=$('prof-highlights-row');if(!row)return;
  // Keep the "New" button
  const addBtn=$('prof-add-hl');
  row.innerHTML='';if(addBtn)row.appendChild(addBtn);
  db.ref(`highlights/${me.uid}`).once('value').then(snap=>{
    const entries=Object.entries(snap.val()||{});
    if(!entries.length)return;
    entries.forEach(([key,s])=>{
      const div=document.createElement('div');div.style.cssText='text-align:center;flex-shrink:0;cursor:pointer;';
      const thumb=s.type==='photo'
        ?`<img src="${esc(s.url)}" style="width:58px;height:58px;border-radius:50%;object-fit:cover;border:2.5px solid var(--g);">`
        :`<div style="width:58px;height:58px;border-radius:50%;background:var(--s2);display:flex;align-items:center;justify-content:center;border:2.5px solid var(--g);font-size:22px;">🎬</div>`;
      div.innerHTML=`${thumb}<div style="font-size:10px;color:var(--t2);margin-top:5px;max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(s.caption||'Highlight')}</div>`;
      div.onclick=()=>viewStatus(me.uid,me,[s]);
      row.appendChild(div);
    });
  });
}
function deleteHighlight(key){
  if(!me)return;
  db.ref(`highlights/${me.uid}/${key}`).remove().then(()=>{toast('Highlight removed','info');loadHighlights();});
}

// ══ FEATURE 3: LIVE TYPING IN CHAT LIST ══════════════════════════
const _chatListTyping={};
function watchChatListTyping(chatId2,uid){
  if(_chatListTyping[chatId2])return;
  _chatListTyping[chatId2]=true;
  db.ref(`typing/private/${chatId2}/${uid}`).on('value',snap=>{
    const el=document.querySelector(`[data-cid="${chatId2}"] .ci-sub`);
    if(!el)return;
    if(snap.val()&&Date.now()-snap.val()<3000){el.innerHTML='<span style="color:var(--g);font-size:12px;">typing…</span>';}
    else{el.textContent=el.dataset.orig||'';}
  });
}

// ══ FEATURE 4: MESSAGE SEARCH IN CURRENT CHAT ════════════════════
let _searchActive=false;
function openChatSearch(){
  _searchActive=!_searchActive;
  const bar=$('chat-search-bar');
  if(bar){
    bar.classList.toggle('hidden',!_searchActive);
    if(_searchActive)bar.querySelector('input')?.focus();
    else{bar.querySelector('input').value='';clearChatSearch();}
  }
}
function searchInChat(q){
  if(!q.trim()){clearChatSearch();return;}
  const container=curView==='private'?$('priv-msgs'):curView==='group'?$('group-msgs'):$('global-msgs');
  if(!container)return;
  const msgs=container.querySelectorAll('.msg-bubble');
  let found=0;
  msgs.forEach(el=>{
    const text=el.textContent||'';
    const match=text.toLowerCase().includes(q.toLowerCase());
    el.closest('[data-key]')?.style.setProperty('opacity',match?'1':'0.3');
    if(match){found++;el.style.background='rgba(0,168,132,.2)';}
    else{el.style.background='';}
  });
  toast(`${found} result${found!==1?'s':''} found`,'info');
}
function clearChatSearch(){
  const container=curView==='private'?$('priv-msgs'):curView==='group'?$('group-msgs'):$('global-msgs');
  if(!container)return;
  container.querySelectorAll('[data-key]').forEach(el=>el.style.opacity='1');
  container.querySelectorAll('.msg-bubble').forEach(el=>el.style.background='');
}

// ══ FEATURE 5: PROFILE BIO LINKS ═════════════════════════════════
function openBioLinkModal(){
  openModal('bio-link-modal');
  const inp=$('bio-link-inp');
  if(inp&&me?.bioLink)inp.value=me.bioLink;
}
async function saveBioLink(){
  const val=$('bio-link-inp')?.value.trim();
  if(!val||!val.startsWith('http'))return toast('Enter a valid URL starting with http','error');
  if(!me)return;
  await db.ref(`users/${me.uid}/bioLink`).set(val);
  me.bioLink=val;
  closeModal('bio-link-modal');toast('Profile link saved 🔗','success');
}

// ══ FEATURE 6: CHAT ARCHIVE ═══════════════════════════════════════
function archiveChat(chatId2,targetUid){
  if(!me)return;
  db.ref(`archived/${me.uid}/${chatId2}`).set({chatId:chatId2,targetUid,archivedAt:Date.now()});
  db.ref(`conversations/${me.uid}/${chatId2}/archived`).set(true);
  toast('Chat archived 📦','info');
}
function unarchiveChat(chatId2){
  if(!me)return;
  db.ref(`archived/${me.uid}/${chatId2}`).remove();
  db.ref(`conversations/${me.uid}/${chatId2}/archived`).remove();
  toast('Chat unarchived','info');
  closeModal('archive-modal');openArchive();
}
function openArchive(){
  openModal('archive-modal');
  const list=$('archive-list');if(!list||!me)return;
  list.innerHTML='<div style="color:var(--t2);text-align:center;padding:20px;">Loading…</div>';
  db.ref(`archived/${me.uid}`).once('value').then(async snap=>{
    const data=snap.val()||{};const entries=Object.entries(data);
    list.innerHTML='';
    if(!entries.length){list.innerHTML='<div style="color:var(--t2);text-align:center;padding:20px;">No archived chats</div>';return;}
    for(const [cid,arc] of entries){
      const convSnap=await db.ref(`conversations/${me.uid}/${cid}`).once('value');
      const c=convSnap.val()||{};
      const div=document.createElement('div');div.className='ci';div.style.cssText='border-radius:12px;margin-bottom:6px;';
      div.innerHTML=`<img src="${esc(c.targetPhoto||avUrl(c.targetUsername||'U'))}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;"><div style="flex:1;"><div style="color:var(--t1);font-weight:600;">${esc(c.targetUsername||'Chat')}</div><div style="font-size:12px;color:var(--t2);">${esc(c.lastMessage||'')}</div></div><button onclick="unarchiveChat('${cid}')" style="padding:6px 12px;background:var(--s2);border-radius:8px;color:var(--t2);font-size:12px;">Unarchive</button>`;
      div.addEventListener('click',e=>{if(e.target.tagName==='BUTTON')return;closeModal('archive-modal');openPrivate(c.targetUid,c.targetUsername,c.targetMKJ,c.targetPhoto);});
      list.appendChild(div);
    }
  });
}

// ══ FEATURE 7: STORY REPLIES ══════════════════════════════════════
function replyToStatus(uid,username,mkjNumber,photoURL){
  closeStatusViewer();
  setTimeout(()=>openPrivate(uid,username,mkjNumber,photoURL),300);
  setTimeout(()=>{const inp=$('p-inp');if(inp){inp.value='Replied to your status 📸 ';inp.focus();autoResize(inp);}},600);
}

// ══ SHARED WebRTC CONFIG (used by Spaces + 1:1 Calling) ═══════════
// STUN alone cannot traverse symmetric NAT / most mobile carrier networks.
// TURN relay is required or one side's audio/video never reaches the other.
//
// Dedicated Metered.ca TURN credentials (mkjchat project, 500MB/mo free
// tier). Replaces the shared public demo server that was unreliable
// across separate real-world networks.
const ICE_SERVERS=[
  {urls:'stun:stun.relay.metered.ca:80'},
  {urls:'turn:global.relay.metered.ca:80',username:'1476429da1b7df63e5c5fc68',credential:'U3C1CHH9R20nMqEg'},
  {urls:'turn:global.relay.metered.ca:80?transport=tcp',username:'1476429da1b7df63e5c5fc68',credential:'U3C1CHH9R20nMqEg'},
  {urls:'turn:global.relay.metered.ca:443',username:'1476429da1b7df63e5c5fc68',credential:'U3C1CHH9R20nMqEg'},
  {urls:'turns:global.relay.metered.ca:443?transport=tcp',username:'1476429da1b7df63e5c5fc68',credential:'U3C1CHH9R20nMqEg'}
];
function safeAddIce(pc,candidate){
  if(!pc||!candidate)return;
  if(pc.remoteDescription&&pc.remoteDescription.type){
    pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(()=>{});
  }else{
    (pc._pendingIce=pc._pendingIce||[]).push(candidate);
  }
}
function flushPendingIce(pc){
  if(!pc||!pc._pendingIce)return;
  pc._pendingIce.forEach(c=>pc.addIceCandidate(new RTCIceCandidate(c)).catch(()=>{}));
  pc._pendingIce=[];
}

// ══ 1:1 VOICE / VIDEO CALLING ═════════════════════════════════════
// Data model:
//   calls/{callId}                      -> {from,fromName,fromPhoto,to,type,status,createdAt}
//   calls/{callId}/signals/{targetUid}  -> pushed {type:offer|answer|ice,...}
//   incoming_calls/{uid}                -> current ringing invite for that user
let _callId=null,_callPC=null,_callStream=null,_callType=null,_callRole=null,_callTargetUid=null;
let _callTimer=null,_callSeconds=0,_callSignalRef=null,_callStatusRef=null,_incomingCallRef=null;
let _callMuted=false,_callCamOff=false,_ringAudio=null;

function listenIncomingCalls(){
  if(!me||_incomingCallRef)return;
  _incomingCallRef=db.ref(`incoming_calls/${me.uid}`);
  _incomingCallRef.on('value',snap=>{
    const call=snap.val();
    if(call&&!_callId)showIncomingCall(call);
  });
}
function showIncomingCall(call){
  _callId=call.callId;_callRole='callee';_callType=call.type;_callTargetUid=call.from;
  $('call-screen').classList.remove('hidden');
  $('call-remote-video').style.display='none';$('call-local-video').style.display='none';
  $('call-avatar').src=call.fromPhoto||avUrl(call.fromName||'U');
  $('call-name').textContent=call.fromName||'Unknown';
  $('call-status-text').textContent=`Incoming ${call.type==='video'?'video':'voice'} call…`;
  $('call-accept-btn').classList.remove('hidden');
  $('call-mute-btn').classList.add('hidden');$('call-cam-btn').classList.add('hidden');$('call-speaker-btn').classList.add('hidden');
  playRingtone();
  const myCallId=call.callId;
  setTimeout(()=>{
    if(_callId===myCallId&&!$('call-accept-btn').classList.contains('hidden')){
      toast('Missed call','info');declineCall();
    }
  },30000);
}
async function startCall(targetUid,type){
  if(!me||!targetUid)return;
  if(_callId)return toast('Already on a call','error');
  let stream;
  try{stream=await navigator.mediaDevices.getUserMedia({audio:true,video:type==='video'});}
  catch(e){return toast('Camera/microphone access denied','error');}
  _callStream=stream;
  const callId=db.ref('calls').push().key;
  _callId=callId;_callRole='caller';_callType=type;_callTargetUid=targetUid;
  const targetName=chatTarget?.username||'';const targetPhoto=chatTarget?.photoURL||'';
  await db.ref(`calls/${callId}`).set({from:me.uid,fromName:me.username,fromPhoto:me.photoURL||'',to:targetUid,type,status:'ringing',createdAt:Date.now()});
  await db.ref(`incoming_calls/${targetUid}`).set({callId,from:me.uid,fromName:me.username,fromPhoto:me.photoURL||'',type,createdAt:Date.now()});
  db.ref(`incoming_calls/${targetUid}`).onDisconnect().remove();
  db.ref(`calls/${callId}/status`).onDisconnect().set('ended');
  $('call-screen').classList.remove('hidden');
  $('call-remote-video').style.display='none';
  $('call-avatar').src=targetPhoto||avUrl(targetName);
  $('call-name').textContent=targetName;
  $('call-status-text').textContent='Calling…';
  $('call-accept-btn').classList.add('hidden');
  $('call-mute-btn').classList.remove('hidden');
  $('call-cam-btn').classList.toggle('hidden',type!=='video');
  $('call-speaker-btn').classList.remove('hidden');
  if(type==='video'){$('call-local-video').srcObject=stream;$('call-local-video').style.display='block';}
  let pc;
  try{pc=createCallPeerConn(targetUid);}
  catch(err){console.error('[call] peer connection setup failed:',err);toast('Call setup failed: '+err.message,'error');closeCallUI();return;}
  stream.getTracks().forEach(t=>pc.addTrack(t,stream));
  const offer=await pc.createOffer();
  await pc.setLocalDescription(offer);
  db.ref(`calls/${callId}/signals/${targetUid}`).push({type:'offer',from:me.uid,sdp:offer.sdp});
  watchCallSignals();watchCallStatus();
  setTimeout(()=>{
    if(_callId===callId&&_callRole==='caller'){
      db.ref(`calls/${callId}/status`).once('value').then(s=>{if(s.val()==='ringing'){toast('No answer','info');endCall();}});
    }
  },30000);
}
async function acceptIncomingCall(){
  if(!_callId||!me)return;
  stopRingtone();
  let stream;
  try{stream=await navigator.mediaDevices.getUserMedia({audio:true,video:_callType==='video'});}
  catch(e){toast('Camera/microphone access denied','error');return declineCall();}
  _callStream=stream;
  $('call-status-text').textContent=_callType==='video'?'Video call':'Voice call';
  $('call-accept-btn').classList.add('hidden');
  $('call-mute-btn').classList.remove('hidden');
  $('call-cam-btn').classList.toggle('hidden',_callType!=='video');
  $('call-speaker-btn').classList.remove('hidden');
  if(_callType==='video'){$('call-local-video').srcObject=stream;$('call-local-video').style.display='block';}
  let pc;
  try{pc=createCallPeerConn(_callTargetUid);}
  catch(err){console.error('[call] peer connection setup failed:',err);toast('Call setup failed: '+err.message,'error');closeCallUI();return;}
  stream.getTracks().forEach(t=>pc.addTrack(t,stream));
  watchCallSignals();
  await db.ref(`calls/${_callId}/status`).set('active');
  await db.ref(`incoming_calls/${me.uid}`).remove();
  startCallTimer();
}
function watchCallSignals(){
  if(!_callId||!me)return;
  _callSignalRef=db.ref(`calls/${_callId}/signals/${me.uid}`);
  _callSignalRef.on('child_added',snap=>{handleCallSignal(snap.val());snap.ref.remove();});
}
async function handleCallSignal(sig){
  if(!sig||!_callPC)return;
  const{type,sdp,candidate}=sig;
  if(type==='offer'){
    await _callPC.setRemoteDescription({type:'offer',sdp});
    flushPendingIce(_callPC);
    const answer=await _callPC.createAnswer();
    await _callPC.setLocalDescription(answer);
    db.ref(`calls/${_callId}/signals/${_callTargetUid}`).push({type:'answer',from:me.uid,sdp:answer.sdp});
  }else if(type==='answer'){
    await _callPC.setRemoteDescription({type:'answer',sdp});
    flushPendingIce(_callPC);
    $('call-status-text').textContent=_callType==='video'?'Video call':'Voice call';
    startCallTimer();
  }else if(type==='ice'){
    safeAddIce(_callPC,candidate);
  }
}
function watchCallStatus(){
  if(!_callId)return;
  _callStatusRef=db.ref(`calls/${_callId}/status`);
  _callStatusRef.on('value',snap=>{
    const st=snap.val();
    if(st==='declined'){toast('Call declined','info');closeCallUI();}
    else if(st==='ended'){toast('Call ended','info');closeCallUI();}
  });
}
function createCallPeerConn(remoteUid){
  const pc=new RTCPeerConnection({iceServers:ICE_SERVERS});
  _callPC=pc;
  pc.onicecandidate=e=>{if(e.candidate&&_callId)db.ref(`calls/${_callId}/signals/${remoteUid}`).push({type:'ice',from:me.uid,candidate:e.candidate.toJSON()});};
  pc.ontrack=e=>{
    if(_callType==='video'){const v=$('call-remote-video');v.srcObject=e.streams[0];v.style.display='block';}
    else{const a=$('call-remote-audio');a.srcObject=e.streams[0];}
  };
  pc.oniceconnectionstatechange=()=>{console.log('[call] iceConnectionState:',pc.iceConnectionState);};
  pc.onconnectionstatechange=()=>{
    console.log('[call] connectionState:',pc.connectionState);
    if(pc.connectionState==='failed'){
      toast('Call could not connect — check your network','error');
      endCall();
    }
  };
  return pc;
}
function toggleCallMute(){
  if(!_callStream)return;
  const track=_callStream.getAudioTracks()[0];if(!track)return;
  track.enabled=!track.enabled;_callMuted=!track.enabled;
  const btn=$('call-mute-btn');if(btn)btn.innerHTML=`<i class="fa-solid fa-microphone${_callMuted?'-slash':''}" style="color:#fff;font-size:20px;"></i>`;
}
function toggleCallCamera(){
  if(!_callStream)return;
  const track=_callStream.getVideoTracks()[0];if(!track)return;
  track.enabled=!track.enabled;_callCamOff=!track.enabled;
  const btn=$('call-cam-btn');if(btn)btn.innerHTML=`<i class="fa-solid fa-video${_callCamOff?'-slash':''}" style="color:#fff;font-size:20px;"></i>`;
}
function toggleCallSpeaker(){toast('Use your device volume buttons to adjust call volume','info');}
function startCallTimer(){
  _callSeconds=0;clearInterval(_callTimer);
  _callTimer=setInterval(()=>{
    _callSeconds++;const m=String(Math.floor(_callSeconds/60)).padStart(2,'0');const s=String(_callSeconds%60).padStart(2,'0');
    const el=$('call-status-text');if(el)el.textContent=`${m}:${s}`;
  },1000);
}
async function declineCall(){
  if(_callId)await db.ref(`calls/${_callId}/status`).set('declined');
  if(me)await db.ref(`incoming_calls/${me.uid}`).remove();
  stopRingtone();closeCallUI();
}
async function endCall(){
  if(_callId){
    await db.ref(`calls/${_callId}/status`).set('ended');
    if(_callRole==='caller'&&_callTargetUid)await db.ref(`incoming_calls/${_callTargetUid}`).remove();
  }
  stopRingtone();closeCallUI();
}
function closeCallUI(){
  // Always closes the screen, even if setup failed partway through —
  // an exit button must never be able to trap the user on a stuck screen.
  clearInterval(_callTimer);_callTimer=null;
  if(_callStream){_callStream.getTracks().forEach(t=>t.stop());_callStream=null;}
  if(_callPC){try{_callPC.close();}catch(e){}_callPC=null;}
  if(_callSignalRef){_callSignalRef.off();_callSignalRef=null;}
  if(_callStatusRef){_callStatusRef.off();_callStatusRef=null;}
  if(_callId&&me)db.ref(`calls/${_callId}/signals/${me.uid}`).remove();
  const rv=$('call-remote-video');if(rv){rv.srcObject=null;rv.style.display='none';}
  const lv=$('call-local-video');if(lv){lv.srcObject=null;lv.style.display='none';}
  const ra=$('call-remote-audio');if(ra)ra.srcObject=null;
  $('call-mute-btn').innerHTML='<i class="fa-solid fa-microphone" style="color:#fff;font-size:20px;"></i>';
  $('call-cam-btn').innerHTML='<i class="fa-solid fa-video" style="color:#fff;font-size:20px;"></i>';
  $('call-screen').classList.add('hidden');
  _callId=null;_callRole=null;_callType=null;_callTargetUid=null;_callMuted=false;_callCamOff=false;
}
function playRingtone(){
  try{_ringAudio=new Audio('https://actions.google.com/sounds/v1/alarms/phone_alerts_and_rings.ogg');_ringAudio.loop=true;_ringAudio.volume=0.6;_ringAudio.play().catch(()=>{});}catch(e){}
  if(navigator.vibrate)navigator.vibrate([500,300,500,300,500]);
}
function stopRingtone(){if(_ringAudio){_ringAudio.pause();_ringAudio=null;}}

// ══ GROUP VIDEO/AUDIO CALLS (LiveKit) ═══════════════════════════════
// Any group member can start or join, no host, no restrictions.
const LIVEKIT_URL='wss://mkj-ipdkjx0p.livekit.cloud';
const LIVEKIT_TOKEN_ENDPOINT='/.netlify/functions/livekit-token';

let _gcallRoom=null,_gcallGroupId=null,_gcallType=null,_gcallActiveRef=null;
let _gcallMuted=false,_gcallCamOff=false;

async function fetchLiveKitToken(room,identity,name,canPublish,canSubscribe){
  const res=await fetch(LIVEKIT_TOKEN_ENDPOINT,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({room,identity,name,canPublish,canSubscribe})
  });
  if(!res.ok){
    const err=await res.json().catch(()=>({error:'Unknown server error'}));
    throw new Error(err.error||`Token server returned ${res.status}`);
  }
  const data=await res.json();
  return data.token;
}

function watchGroupCallBanner(groupId){
  if(_gcallActiveRef)_gcallActiveRef.off();
  _gcallActiveRef=db.ref(`group_calls/${groupId}`);
  _gcallActiveRef.on('value',snap=>{
    const data=snap.val();
    const banner=$('gcall-banner');if(!banner)return;
    if(data&&data.active){
      banner.classList.remove('hidden');
      const count=data.participantCount||1;
      $('gcall-banner-text').textContent=`${data.type==='video'?'📹':'📞'} Call in progress · ${count} joined · tap to join`;
    }else{
      banner.classList.add('hidden');
    }
  });
}
function stopWatchingGroupCallBanner(){
  if(_gcallActiveRef){_gcallActiveRef.off();_gcallActiveRef=null;}
}

function openGroupCallMenu(){
  if(!curGid)return;
  db.ref(`group_calls/${curGid}`).once('value').then(snap=>{
    const data=snap.val();
    if(data&&data.active){joinGroupCall(data.type);return;}
    const modal=document.createElement('div');modal.className='modal-bg';modal.style.zIndex='600';
    modal.onclick=e=>{if(e.target===modal)modal.remove();};
    modal.innerHTML=`<div class="modal-box">
      <div style="font-size:17px;font-weight:700;color:var(--t1);margin-bottom:16px;">Start a group call</div>
      <button onclick="this.closest('.modal-bg').remove();startGroupCall('audio')" style="width:100%;padding:13px;background:var(--s2);border-radius:12px;color:var(--t1);font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:10px;"><i class="fa-solid fa-phone" style="color:var(--g);width:20px;"></i>Voice call</button>
      <button onclick="this.closest('.modal-bg').remove();startGroupCall('video')" style="width:100%;padding:13px;background:var(--s2);border-radius:12px;color:var(--t1);font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:10px;"><i class="fa-solid fa-video" style="color:var(--g);width:20px;"></i>Video call</button>
      <button onclick="this.closest('.modal-bg').remove()" style="width:100%;padding:12px;background:none;color:var(--t2);font-weight:600;">Cancel</button>
    </div>`;
    document.body.appendChild(modal);
  });
}

async function startGroupCall(type){
  if(!curGid||!me)return;
  await db.ref(`group_calls/${curGid}`).set({
    active:true,type,startedBy:me.uid,startedByName:me.username,startedAt:Date.now(),participantCount:1
  });
  joinGroupCall(type);
}

async function joinGroupCall(type){
  if(!curGid||!me||_gcallRoom)return;
  _gcallGroupId=curGid;_gcallType=type;

  let token;
  try{
    token=await fetchLiveKitToken(`group_${curGid}`,me.uid,me.username,true,true);
  }catch(err){
    console.error('[gcall] token fetch failed:',err);
    toast('Could not start call: '+err.message,'error');
    return;
  }

  let room;
  try{
    if(typeof LivekitClient==='undefined')throw new Error('Call service failed to load — check your connection and try again');
    room=new LivekitClient.Room({adaptiveStream:true,dynacast:true});
  }catch(err){
    console.error('[gcall] room setup failed:',err);
    toast('Could not start call: '+err.message,'error');
    return;
  }
  _gcallRoom=room;

  $('gcall-screen').classList.remove('hidden');
  $('gcall-title').textContent=curGData?.name||'Group Call';
  $('gcall-status').textContent='Connecting…';
  $('gcall-grid').innerHTML='';
  $('gcall-cam-btn').style.display=type==='video'?'flex':'none';

  room.on(LivekitClient.RoomEvent.TrackSubscribed,(track,pub,participant)=>{
    if(track.kind===LivekitClient.Track.Kind.Video||track.kind===LivekitClient.Track.Kind.Audio){
      addGCallTrack(participant.identity,participant.name||participant.identity,track);
    }
  });
  room.on(LivekitClient.RoomEvent.TrackUnsubscribed,(track)=>{track.detach().forEach(el=>el.remove());});
  room.on(LivekitClient.RoomEvent.ParticipantConnected,(p)=>{
    ensureGCallTile(p.identity,p.name||p.identity);
    updateGroupCallCount();
  });
  room.on(LivekitClient.RoomEvent.ParticipantDisconnected,(p)=>{
    removeGCallTile(p.identity);
    updateGroupCallCount();
  });
  room.on(LivekitClient.RoomEvent.Disconnected,()=>{closeGCallUI();});
  room.on(LivekitClient.RoomEvent.AudioPlaybackStatusChanged,()=>{
    const banner=$('gcall-audio-banner');
    if(!room.canPlaybackAudio){
      banner.classList.remove('hidden');
      banner.onclick=()=>{room.startAudio().then(()=>banner.classList.add('hidden'));};
    }else{banner.classList.add('hidden');}
  });

  try{
    await room.connect(LIVEKIT_URL,token);
  }catch(err){
    console.error('[gcall] connect failed:',err);
    toast('Could not connect to call: '+err.message,'error');
    closeGCallUI();
    return;
  }
  // Proactively try to unlock audio playback now, while we're still close
  // to the user's tap that started this call — mobile browsers block
  // autoplay audio unless it's tied closely to a real user action. Waiting
  // for the passive banner alone meant someone could join and simply hear
  // nothing without realizing why.
  try{await room.startAudio();}catch(e){}

  $('gcall-status').textContent='Connected';
  ensureGCallTile(me.uid,me.username,true);
  try{
    await room.localParticipant.setMicrophoneEnabled(true);
    if(type==='video')await room.localParticipant.setCameraEnabled(true);
  }catch(err){
    console.error('[gcall] mic/camera enable failed:',err);
    toast('Your microphone could not be turned on: '+err.message+' — others will not hear you','error');
  }

  if(type==='video'){
    const camPub=room.localParticipant.getTrackPublication(LivekitClient.Track.Source.Camera);
    if(camPub&&camPub.track){
      const el=camPub.track.attach();
      el.muted=true;
      const tile=document.getElementById(`gtile-${me.uid}`);
      if(tile){const holder=tile.querySelector('.gtile-media');holder.innerHTML='';holder.appendChild(el);}
    }
  }

  updateGroupCallCount();
}

function ensureGCallTile(identity,name,isLocal){
  if(document.getElementById(`gtile-${identity}`))return;
  const tile=document.createElement('div');
  tile.id=`gtile-${identity}`;
  tile.style.cssText='position:relative;background:#1F2C34;border-radius:14px;aspect-ratio:1;display:flex;align-items:center;justify-content:center;overflow:hidden;';
  tile.innerHTML=`
    <div class="gtile-media" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
      <img src="${avUrl(name)}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;">
    </div>
    <div style="position:absolute;bottom:6px;left:8px;color:#fff;font-size:11px;font-weight:600;background:rgba(0,0,0,.4);padding:2px 8px;border-radius:10px;">${esc(name)}${isLocal?' (You)':''}</div>
  `;
  $('gcall-grid').appendChild(tile);
}

function addGCallTrack(identity,name,track){
  ensureGCallTile(identity,name);
  const tile=document.getElementById(`gtile-${identity}`);
  if(!tile)return;
  const holder=tile.querySelector('.gtile-media');
  if(track.kind===LivekitClient.Track.Kind.Video){
    holder.innerHTML='';
    const el=track.attach();
    el.style.cssText='width:100%;height:100%;object-fit:cover;';
    holder.appendChild(el);
  }else{
    const el=track.attach();
    el.style.display='none';
    tile.appendChild(el);
  }
}

function removeGCallTile(identity){
  const tile=document.getElementById(`gtile-${identity}`);
  if(tile)tile.remove();
}

function updateGroupCallCount(){
  if(!_gcallRoom||!_gcallGroupId)return;
  const count=_gcallRoom.remoteParticipants.size+1;
  db.ref(`group_calls/${_gcallGroupId}/participantCount`).set(count);
  $('gcall-status').textContent=`${count} in call`;
}

function toggleGCallMute(){
  if(!_gcallRoom)return;
  _gcallMuted=!_gcallMuted;
  _gcallRoom.localParticipant.setMicrophoneEnabled(!_gcallMuted);
  const btn=$('gcall-mute-btn');
  btn.innerHTML=`<i class="fa-solid fa-microphone${_gcallMuted?'-slash':''}" style="color:#fff;font-size:19px;"></i>`;
}
function toggleGCallCamera(){
  if(!_gcallRoom||_gcallType!=='video')return;
  _gcallCamOff=!_gcallCamOff;
  _gcallRoom.localParticipant.setCameraEnabled(!_gcallCamOff);
  const btn=$('gcall-cam-btn');
  btn.innerHTML=`<i class="fa-solid fa-video${_gcallCamOff?'-slash':''}" style="color:#fff;font-size:19px;"></i>`;
}

async function leaveGroupCall(){
  // Always closes the UI, even if the room never actually connected —
  // this is the exit button, it must never be able to trap the user.
  const groupId=_gcallGroupId;
  const room=_gcallRoom;
  if(room){
    try{await room.disconnect();}catch(e){}
    if(groupId){
      try{
        const snap=await db.ref(`group_calls/${groupId}/participantCount`).once('value');
        const remaining=(snap.val()||1)-1;
        if(remaining<=0)await db.ref(`group_calls/${groupId}`).update({active:false});
        else await db.ref(`group_calls/${groupId}/participantCount`).set(remaining);
      }catch(e){}
    }
  }
  closeGCallUI();
}

function closeGCallUI(){
  $('gcall-screen').classList.add('hidden');
  $('gcall-grid').innerHTML='';
  _gcallRoom=null;_gcallGroupId=null;_gcallType=null;_gcallMuted=false;_gcallCamOff=false;
}

// ══ MKJ SPACES (LiveKit-based, host-controlled) ═══════════════════
// Replaces the old direct-connection mesh Spaces entirely.
// Only the CEO can schedule/start/end a Space and promote/demote speakers.
// Listeners join with tokens that literally cannot publish (canPublish:false)
// — promotion means a real reconnect with a fresh, elevated-permission token,
// not just a client-side mute flag that could be bypassed.
const SPACES_ROOM='spaces_main';
let _spacesRoom=null;
let _spacesStatusRef=null;
let _spacesParticipantsRef=null;
let _spacesCountdownTimer=null;
let _spacesData=null;
let _spacesMyRole=null;
let _spacesHandRaised=false;
let _spacesMuted=false;
let _spacesCamOff=false;
let _spacesScheduleType='audio';

function watchSpacesStatus(){
  if(_spacesStatusRef)return;
  _spacesStatusRef=db.ref('spaces/main');
  _spacesStatusRef.on('value',snap=>{
    const prevStatus=_spacesData?.status;
    _spacesData=snap.val();
    if(_spacesData&&_spacesData.status==='live'&&prevStatus!=='live'&&me&&_spacesData.hostUid!==me.uid){
      toast('🎙 MKJ Space is live now! Tap MKJ Spaces to join.','success');
    }
    if($('spaces-modal')&&!$('spaces-modal').classList.contains('hidden'))renderSpacesHub();
  });
}
function stopWatchingSpaces(){
  if(_spacesStatusRef){_spacesStatusRef.off();_spacesStatusRef=null;}
  clearInterval(_spacesCountdownTimer);_spacesCountdownTimer=null;
}

function openSpaces(){
  openModal('spaces-modal');
  renderSpacesHub();
}

function renderSpacesHub(){
  const el=$('spaces-hub-content');if(!el)return;
  const data=_spacesData;
  clearInterval(_spacesCountdownTimer);
  if(!data||data.status==='idle'||data.status==='ended'){
    el.innerHTML=`
      <div style="font-size:14px;color:var(--t2);margin-bottom:18px;">No Space scheduled right now.</div>
      ${isCEO()?`<button onclick="closeModal('spaces-modal');openModal('spaces-schedule-modal')" style="width:100%;padding:13px;background:var(--s2);border-radius:12px;color:var(--t1);font-weight:700;margin-bottom:8px;">Schedule a Space</button>
      <button onclick="closeModal('spaces-modal');startSpaceNow('audio')" style="width:100%;padding:13px;background:var(--g);border-radius:12px;color:#fff;font-weight:700;">Start Now (Audio)</button>`
      :''}
    `;
    return;
  }
  if(data.status==='scheduled'){
    const target=data.scheduledFor;
    const renderCountdown=()=>{
      const diff=target-Date.now();
      const cd=document.getElementById('sp-countdown');if(!cd)return;
      if(diff<=0){cd.textContent="It's time!";return;}
      const h=Math.floor(diff/3600000),m=Math.floor((diff%3600000)/60000),s=Math.floor((diff%60000)/1000);
      cd.textContent=`${h}h ${m}m ${s}s`;
    };
    el.innerHTML=`
      <div style="font-size:13px;color:var(--t2);margin-bottom:6px;">${data.type==='video'?'📹 Video':'📞 Audio'} Space scheduled</div>
      <div id="sp-countdown" style="font-size:32px;font-weight:800;color:var(--g);margin-bottom:6px;font-family:'Manrope',sans-serif;"></div>
      <div style="font-size:12px;color:var(--t2);margin-bottom:18px;">${new Date(target).toLocaleString()}</div>
      ${isCEO()?`<button onclick="closeModal('spaces-modal');startSpaceNow(_spacesData.type)" style="width:100%;padding:13px;background:var(--g);border-radius:12px;color:#fff;font-weight:700;">Start Now</button>`
      :`<div style="font-size:12px;color:var(--t2);">You'll be notified the moment it goes live.</div>`}
    `;
    renderCountdown();
    _spacesCountdownTimer=setInterval(renderCountdown,1000);
    return;
  }
  if(data.status==='live'){
    el.innerHTML=`
      <div style="font-size:32px;margin-bottom:10px;">🔴</div>
      <div style="font-size:15px;color:var(--t1);font-weight:700;margin-bottom:16px;">Space is live now</div>
      <button onclick="closeModal('spaces-modal');joinSpacesSession()" style="width:100%;padding:13px;background:var(--g);border-radius:12px;color:#fff;font-weight:700;">Join</button>
    `;
    return;
  }
}

function pickScheduleType(type){
  _spacesScheduleType=type;
  $('spaces-sched-audio').style.background=type==='audio'?'var(--g)':'var(--s2)';
  $('spaces-sched-audio').style.color=type==='audio'?'#fff':'var(--t1)';
  $('spaces-sched-video').style.background=type==='video'?'var(--g)':'var(--s2)';
  $('spaces-sched-video').style.color=type==='video'?'#fff':'var(--t1)';
}
async function scheduleSpace(){
  if(!isCEO())return toast('Only the CEO can schedule a Space','error');
  const timeVal=$('spaces-sched-time').value;
  if(!timeVal)return toast('Pick a date and time','error');
  const scheduledFor=new Date(timeVal).getTime();
  if(scheduledFor<=Date.now())return toast('Pick a future time','error');
  await db.ref('spaces/main').set({
    status:'scheduled',scheduledFor,type:_spacesScheduleType,hostUid:me.uid,hostName:me.username
  });
  closeModal('spaces-schedule-modal');
  toast('Space scheduled ✓','success');
}

async function startSpaceNow(type){
  if(!isCEO())return toast('Only the CEO can start a Space','error');
  await db.ref('spaces/main').set({
    status:'live',type:type||_spacesData?.type||'audio',hostUid:me.uid,hostName:me.username,startedAt:Date.now()
  });
  db.ref('global_chat').push({uid:me.uid,username:'MKJ Spaces',mkjNumber:'',photoURL:me.photoURL||'',text:'🎙 A MKJ Space just went live! Tap MKJ Spaces to join.',time:ts(),timestamp:Date.now(),type:'text',lang:'en'});
  joinSpacesSession();
}

async function joinSpacesSession(){
  if(!me||_spacesRoom)return;
  const isHost=isCEO();
  _spacesMyRole=isHost?'host':'listener';
  let token;
  try{
    token=await fetchLiveKitToken(SPACES_ROOM,me.uid,me.username,isHost,true);
  }catch(err){
    console.error('[spaces] token fetch failed:',err);
    toast('Could not join Space: '+err.message,'error');
    return;
  }
  let room;
  try{
    if(typeof LivekitClient==='undefined')throw new Error('Call service failed to load — check your connection and try again');
    room=new LivekitClient.Room({adaptiveStream:true,dynacast:true});
  }catch(err){
    console.error('[spaces] room setup failed:',err);
    toast('Could not join Space: '+err.message,'error');
    return;
  }
  _spacesRoom=room;

  $('spaces-live-screen').classList.remove('hidden');
  $('spaces-speakers-grid').innerHTML='';$('spaces-listeners-grid').innerHTML='';
  $('spaces-end-btn').classList.toggle('hidden',!isHost);
  $('spaces-type-toggle').classList.toggle('hidden',!isHost);
  $('spaces-mute-btn').classList.toggle('hidden',_spacesMyRole==='listener');
  $('spaces-raise-btn').classList.toggle('hidden',_spacesMyRole!=='listener');
  $('spaces-live-status').textContent=isHost?'You are hosting':'Listening';

  room.on(LivekitClient.RoomEvent.TrackSubscribed,(track,pub,participant)=>{addSpacesTrack(participant.identity,participant.name,track);});
  room.on(LivekitClient.RoomEvent.TrackUnsubscribed,(track)=>{track.detach().forEach(el=>el.remove());});
  room.on(LivekitClient.RoomEvent.Disconnected,()=>{closeSpacesLiveUI();});
  room.on(LivekitClient.RoomEvent.AudioPlaybackStatusChanged,()=>{
    const banner=$('spaces-audio-banner');
    if(!room.canPlaybackAudio){banner.classList.remove('hidden');banner.textContent='Tap here — audio is blocked until you tap';banner.onclick=()=>{room.startAudio().then(()=>banner.classList.add('hidden'));};}
    else banner.classList.add('hidden');
  });

  try{
    await room.connect(LIVEKIT_URL,token);
  }catch(err){
    console.error('[spaces] connect failed:',err);
    toast('Could not connect: '+err.message,'error');
    closeSpacesLiveUI();
    return;
  }
  // Proactively unlock audio playback while still close to the user's tap
  // that started this join — see same fix in joinGroupCall for why.
  try{await room.startAudio();}catch(e){}

  if(isHost){
    try{
      await room.localParticipant.setMicrophoneEnabled(true);
      if(_spacesData?.type==='video')await room.localParticipant.setCameraEnabled(true);
    }catch(err){
      console.error('[spaces] host mic/camera enable failed:',err);
      toast('Your microphone could not be turned on: '+err.message+' — the audience will not hear you','error');
    }
  }

  await db.ref(`spaces/main/participants/${me.uid}`).set({
    username:me.username,photoURL:me.photoURL||'',role:_spacesMyRole,handRaised:false,joinedAt:Date.now()
  });
  db.ref(`spaces/main/participants/${me.uid}`).onDisconnect().remove();

  watchSpacesParticipants();
  updateSpacesTypeToggleLabel();
}

function watchSpacesParticipants(){
  if(_spacesParticipantsRef)_spacesParticipantsRef.off();
  _spacesParticipantsRef=db.ref('spaces/main/participants');
  _spacesParticipantsRef.on('value',snap=>{
    const all=snap.val()||{};
    renderSpacesParticipants(all);
    const mine=all[me?.uid];
    if(mine&&_spacesMyRole&&_spacesMyRole!=='host'&&mine.role!==_spacesMyRole){
      _spacesMyRole=mine.role;
      reconnectSpacesWithRole(mine.role);
    }
  });
}

function renderSpacesParticipants(participants){
  const speakersGrid=$('spaces-speakers-grid');const listenersGrid=$('spaces-listeners-grid');
  if(!speakersGrid||!listenersGrid)return;
  speakersGrid.innerHTML='';listenersGrid.innerHTML='';
  const entries=Object.entries(participants);
  let listenerCount=0;
  const handQueue=[];
  entries.forEach(([uid,p])=>{
    if(p.role==='host'||p.role==='speaker'){
      const tile=document.createElement('div');tile.id=`sptile-${uid}`;
      tile.style.cssText='display:flex;flex-direction:column;align-items:center;gap:4px;';
      tile.innerHTML=`<div class="sptile-media" style="width:64px;height:64px;border-radius:50%;overflow:hidden;border:2px solid #33E0AC;display:flex;align-items:center;justify-content:center;background:#1F2C34;"><img src="${avUrl(p.username)}" style="width:100%;height:100%;object-fit:cover;"></div><span style="color:#fff;font-size:11px;font-weight:600;">${esc(getDisplayName(uid,p.username))}${p.role==='host'?' 👑':''}</span>`;
      speakersGrid.appendChild(tile);
    }else{
      listenerCount++;
      const tile=document.createElement('div');tile.id=`sptile-${uid}`;
      tile.style.cssText='display:flex;flex-direction:column;align-items:center;gap:3px;';
      tile.innerHTML=`<img src="${avUrl(p.username)}" style="width:42px;height:42px;border-radius:50%;object-fit:cover;"><span style="color:rgba(255,255,255,.7);font-size:10px;">${esc(getDisplayName(uid,p.username))}</span>`;
      listenersGrid.appendChild(tile);
      if(p.handRaised)handQueue.push({uid,...p});
    }
  });
  $('spaces-listener-count').textContent=`${listenerCount}`;

  const isHost=_spacesMyRole==='host';
  const qwrap=$('spaces-handqueue-wrap');const qlist=$('spaces-handqueue-list');
  if(isHost&&handQueue.length){
    qwrap.classList.remove('hidden');qlist.innerHTML='';
    handQueue.forEach(p=>{
      const row=document.createElement('div');
      row.style.cssText='display:flex;align-items:center;gap:10px;padding:6px 0;';
      row.innerHTML=`<img src="${avUrl(p.username)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;"><span style="flex:1;color:#EAF6F1;font-size:13px;">${esc(getDisplayName(p.uid,p.username))}</span><button onclick="promoteToSpeaker('${p.uid}')" style="padding:5px 12px;background:#33E0AC;border-radius:14px;color:#0D1512;font-size:11px;font-weight:700;">Bring up</button>`;
      qlist.appendChild(row);
    });
  }else if(qwrap){
    qwrap.classList.add('hidden');
  }

  if(isHost){
    entries.forEach(([uid,p])=>{
      if(p.role==='speaker'){
        const tile=document.getElementById(`sptile-${uid}`);
        if(tile){tile.style.cursor='pointer';tile.onclick=()=>{if(confirm(`Move ${getDisplayName(uid,p.username)} back to listening?`))demoteToListener(uid);};}
      }
    });
  }
}

function addSpacesTrack(identity,name,track){
  // Don't silently drop the track if Firebase's participant sync hasn't
  // created this tile yet — LiveKit can deliver tracks before that sync
  // completes, which was causing the host's audio/video to go missing
  // for listeners entirely, until something else forced a re-render.
  let tile=document.getElementById(`sptile-${identity}`);
  if(!tile){
    tile=document.createElement('div');tile.id=`sptile-${identity}`;
    tile.style.cssText='display:flex;flex-direction:column;align-items:center;gap:4px;';
    tile.innerHTML=`<div class="sptile-media" style="width:64px;height:64px;border-radius:50%;overflow:hidden;border:2px solid #33E0AC;display:flex;align-items:center;justify-content:center;background:#1F2C34;"><img src="${avUrl(name||identity)}" style="width:100%;height:100%;object-fit:cover;"></div><span style="color:#fff;font-size:11px;font-weight:600;">${esc(name||identity)}</span>`;
    const grid=$('spaces-speakers-grid');if(grid)grid.appendChild(tile);
  }
  if(track.kind===LivekitClient.Track.Kind.Video){
    const holder=tile.querySelector('.sptile-media');
    if(holder){holder.innerHTML='';const el=track.attach();el.style.cssText='width:100%;height:100%;object-fit:cover;';holder.appendChild(el);}
  }else{
    const el=track.attach();el.style.display='none';tile.appendChild(el);
  }
}

async function toggleRaiseHand(){
  if(!me||_spacesMyRole!=='listener')return;
  _spacesHandRaised=!_spacesHandRaised;
  await db.ref(`spaces/main/participants/${me.uid}/handRaised`).set(_spacesHandRaised);
  const btn=$('spaces-raise-btn');
  btn.style.background=_spacesHandRaised?'#E8B44A':'rgba(255,255,255,.15)';
  toast(_spacesHandRaised?'Hand raised ✋':'Hand lowered','info');
}

async function promoteToSpeaker(uid){
  if(_spacesMyRole!=='host')return;
  await db.ref(`spaces/main/participants/${uid}`).update({role:'speaker',handRaised:false});
  toast('Promoted to speaker','success');
}
async function demoteToListener(uid){
  if(_spacesMyRole!=='host')return;
  await db.ref(`spaces/main/participants/${uid}`).update({role:'listener',handRaised:false});
  toast('Moved back to listening','info');
}

async function reconnectSpacesWithRole(newRole){
  if(!_spacesRoom||!me)return;
  toast(newRole==='speaker'?"🎙 You're live! Reconnecting…":'Reconnecting…','info');
  const canPublish=newRole==='speaker'||newRole==='host';
  try{await _spacesRoom.disconnect();}catch(e){}
  let token;
  try{
    token=await fetchLiveKitToken(SPACES_ROOM,me.uid,me.username,canPublish,true);
  }catch(err){toast('Reconnect failed: '+err.message,'error');return;}
  const room=new LivekitClient.Room({adaptiveStream:true,dynacast:true});
  _spacesRoom=room;
  room.on(LivekitClient.RoomEvent.TrackSubscribed,(track,pub,participant)=>{addSpacesTrack(participant.identity,participant.name,track);});
  room.on(LivekitClient.RoomEvent.TrackUnsubscribed,(track)=>{track.detach().forEach(el=>el.remove());});
  room.on(LivekitClient.RoomEvent.Disconnected,()=>{closeSpacesLiveUI();});
  room.on(LivekitClient.RoomEvent.AudioPlaybackStatusChanged,()=>{
    const banner=$('spaces-audio-banner');if(!banner)return;
    if(!room.canPlaybackAudio){
      banner.classList.remove('hidden');banner.textContent='Tap here — audio is blocked until you tap';
      banner.onclick=()=>{room.startAudio().then(()=>banner.classList.add('hidden'));};
    }else{banner.classList.add('hidden');}
  });
  try{
    await room.connect(LIVEKIT_URL,token);
  }catch(err){toast('Reconnect failed: '+err.message,'error');return;}
  // This reconnect is triggered remotely (the host promoting someone), not
  // by a fresh local tap, so this proactive attempt is less likely to be
  // allowed by the browser than the ones tied directly to a join tap — the
  // banner above is the real fallback for this specific path.
  try{await room.startAudio();}catch(e){}
  if(canPublish){
    try{
      await room.localParticipant.setMicrophoneEnabled(true);
      if(_spacesData?.type==='video')await room.localParticipant.setCameraEnabled(true);
    }catch(err){
      console.error('[spaces] speaker mic/camera enable failed:',err);
      toast('Your microphone could not be turned on: '+err.message,'error');
    }
  }
  $('spaces-mute-btn').classList.toggle('hidden',!canPublish);
  $('spaces-raise-btn').classList.toggle('hidden',canPublish);
  toast(canPublish?"You're live 🎙":'Back to listening','success');
}

async function toggleSpaceType(){
  if(_spacesMyRole!=='host'||!_spacesData)return;
  const newType=_spacesData.type==='video'?'audio':'video';
  await db.ref('spaces/main/type').set(newType);
  _spacesData.type=newType;
  if(_spacesRoom){
    if(newType==='video')await _spacesRoom.localParticipant.setCameraEnabled(true);
    else await _spacesRoom.localParticipant.setCameraEnabled(false);
  }
  updateSpacesTypeToggleLabel();
  toast(`Switched to ${newType}`,'info');
}
function updateSpacesTypeToggleLabel(){
  const btn=$('spaces-type-toggle');if(!btn||!_spacesData)return;
  btn.textContent=_spacesData.type==='video'?'📹 Video · tap for Audio':'📞 Audio · tap for Video';
}

function toggleSpacesMute(){
  if(!_spacesRoom)return;
  _spacesMuted=!_spacesMuted;
  _spacesRoom.localParticipant.setMicrophoneEnabled(!_spacesMuted);
  $('spaces-mute-btn').innerHTML=`<i class="fa-solid fa-microphone${_spacesMuted?'-slash':''}" style="color:#fff;font-size:19px;"></i>`;
}
function toggleSpacesCamera(){
  if(!_spacesRoom||_spacesData?.type!=='video')return;
  _spacesCamOff=!_spacesCamOff;
  _spacesRoom.localParticipant.setCameraEnabled(!_spacesCamOff);
  $('spaces-cam-btn').innerHTML=`<i class="fa-solid fa-video${_spacesCamOff?'-slash':''}" style="color:#fff;font-size:19px;"></i>`;
}

async function endSpace(){
  if(_spacesMyRole!=='host')return;
  if(!confirm('End the Space for everyone?'))return;
  await db.ref('spaces/main').update({status:'ended'});
  await db.ref('spaces/main/participants').remove();
  leaveSpacesSession();
}

async function leaveSpacesSession(){
  if(_spacesParticipantsRef){_spacesParticipantsRef.off();_spacesParticipantsRef=null;}
  if(me)await db.ref(`spaces/main/participants/${me.uid}`).remove().catch(()=>{});
  if(_spacesRoom){try{await _spacesRoom.disconnect();}catch(e){}}
  closeSpacesLiveUI();
}

function closeSpacesLiveUI(){
  $('spaces-live-screen').classList.add('hidden');
  $('spaces-speakers-grid').innerHTML='';$('spaces-listeners-grid').innerHTML='';
  _spacesRoom=null;_spacesMyRole=null;_spacesHandRaised=false;_spacesMuted=false;_spacesCamOff=false;
}

