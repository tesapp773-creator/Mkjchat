// ══ FEATURE 9: PINNED CHATS ═══════════════════════════════════════
function pinChat(chatId2,targetUid){
  if(!me)return;
  const pinned=JSON.parse(localStorage.getItem(`pinned_${me.uid}`)||'[]');
  if(pinned.includes(chatId2)){toast('Already pinned','info');return;}
  if(pinned.length>=3){toast('Max 3 pinned chats','warn');return;}
  pinned.push(chatId2);
  localStorage.setItem(`pinned_${me.uid}`,JSON.stringify(pinned));
  db.ref(`conversations/${me.uid}/${chatId2}/pinned`).set(true);
  toast('Chat pinned 📌','success');
}
function unpinChat(chatId2){
  if(!me)return;
  const pinned=JSON.parse(localStorage.getItem(`pinned_${me.uid}`)||'[]');
  const updated=pinned.filter(id=>id!==chatId2);
  localStorage.setItem(`pinned_${me.uid}`,JSON.stringify(updated));
  db.ref(`conversations/${me.uid}/${chatId2}/pinned`).remove();
  toast('Unpinned','info');
}
function isPinned(chatId2){
  const pinned=JSON.parse(localStorage.getItem(`pinned_${me?.uid}`)||'[]');
  return pinned.includes(chatId2);
}

// ══ FEATURE 10: READ RECEIPT TOGGLE PER CHAT ═════════════════════
let _rrChatId=null;
function openReadReceiptModal(){
  if(!chatTarget)return;
  _rrChatId=chatId;
  openModal('read-receipt-modal');
  const nm=$('rr-contact-name');if(nm)nm.textContent=`For: ${chatTarget.username}`;
  const tog=$('rr-toggle');if(tog){
    const disabled=localStorage.getItem(`rr_off_${chatId}`)==='true';
    tog.classList.toggle('on',!disabled);
  }
}
function toggleReadReceipt(){
  if(!_rrChatId)return;
  const tog=$('rr-toggle');const isOn=tog?.classList.contains('on');
  tog?.classList.toggle('on');
  localStorage.setItem(`rr_off_${_rrChatId}`,isOn?'true':'false');
  toast(isOn?'Read receipts off for this chat':'Read receipts on','info');
}
function shouldShowReadReceipt(){
  return localStorage.getItem(`rr_off_${chatId}`)!=='true'&&localStorage.getItem('rr_off_global')!=='true';
}

// ══ HELPERS: PINNED/ARCHIVE IN CHAT LIST ═════════════════════════
function getPinnedChats(){return JSON.parse(localStorage.getItem(`pinned_${me?.uid}`)||'[]');}
// Override filterByFolder to handle pinned and archived
function filterByFolder(){
  const items=document.querySelectorAll('#convs-list [data-cid]');
  const pinned=getPinnedChats();
  items.forEach(item=>{
    const cid=item.dataset.cid;
    const isGroup=item.dataset.isGroup==='true';
    const unread=parseInt(item.dataset.unread||'0');
    const isSaved=item.dataset.isSaved==='true';
    const isArchived=item.dataset.archived==='true';
    let show=true;
    if(activeFolder==='pinned')show=pinned.includes(cid);
    else if(activeFolder==='groups')show=isGroup&&!isArchived;
    else if(activeFolder==='unread')show=unread>0&&!isArchived;
    else if(activeFolder==='saved')show=isSaved&&!isArchived;
    else show=!isArchived; // 'all' hides archived
    item.style.display=show?'':'none';
    // Add pin indicator
    const existPin=item.querySelector('.pin-indicator');
    if(pinned.includes(cid)&&!existPin){
      const pi=document.createElement('span');pi.className='pin-indicator';
      pi.style.cssText='font-size:11px;color:var(--amber);position:absolute;top:4px;right:4px;';
      pi.textContent='📌';item.style.position='relative';item.appendChild(pi);
    } else if(!pinned.includes(cid)&&existPin){existPin.remove();}
  });
}

// ══ CHAT SEARCH BAR IN PRIVATE/GROUP HEADER ══════════════════════
// Injected dynamically when search icon is tapped
function injectChatSearchBar(parentId){
  const existing=$('chat-search-bar');if(existing)return;
  const bar=document.createElement('div');bar.id='chat-search-bar';bar.className='hidden';
  bar.style.cssText='padding:6px 12px;background:var(--s1);display:flex;align-items:center;gap:8px;flex-shrink:0;border-top:1px solid rgba(255,255,255,.05);';
  bar.innerHTML=`<i class="fa-solid fa-magnifying-glass" style="color:var(--t2);font-size:14px;"></i><input placeholder="Search in this chat…" style="flex:1;background:var(--s2);border:none;border-radius:8px;padding:7px 10px;font-size:14px;color:var(--t1);" oninput="searchInChat(this.value)"><button onclick="openChatSearch()" style="color:var(--t2);font-size:18px;">×</button>`;
  const parent=$(parentId);if(parent)parent.appendChild(bar);
}

// ══ ADD SPACES BUTTON TO COMMUNITY HEADER ════════════════════════
function addSpacesBtn(){
  const hdr=$('g-typing')?.closest('div')?.parentElement;
  if(hdr&&!hdr.querySelector('.spaces-btn')){
    const btn=document.createElement('button');btn.className='spaces-btn';
    btn.style.cssText='color:var(--t2);font-size:18px;padding:4px;';btn.title='MKJ Spaces';
    btn.innerHTML='<i class="fa-solid fa-microphone-lines"></i>';
    btn.onclick=openSpaces;hdr.insertBefore(btn,hdr.querySelector('button'));
  }
}

// ══ ADD FOLLOW BUTTON TO USER PROFILE VIEWS ══════════════════════
function addFollowBtnToProfile(uid){
  const existing=$('profile-follow-btn');if(existing)existing.remove();
  if(!me||uid===me.uid)return;
  isFollowing(uid).then(following=>{
    const btn=document.createElement('button');btn.id='profile-follow-btn';
    btn.style.cssText=`padding:8px 20px;border-radius:20px;font-weight:700;font-size:13px;background:${following?'var(--s2)':'var(--g)'};color:${following?'var(--t1)':'#fff'};`;
    btn.textContent=following?'Following':'Follow';
    btn.onclick=()=>followUser(uid).then(()=>addFollowBtnToProfile(uid));
    const pName=$('p-name');if(pName?.parentElement)pName.parentElement.appendChild(btn);
  });
}

// ══════════════════════════════════════════════════════════════════
// FEATURE 1: NOTIFICATION CENTRE (full rebuild)
// ══════════════════════════════════════════════════════════════════
function openNotifCenter(){
  openModal('notif-center-modal');
  const list=$('notif-list');if(!list)return;
  list.innerHTML='<div style="text-align:center;padding:20px;color:var(--t2);">Loading…</div>';
  db.ref(`notifications/${me?.uid}`).orderByChild('timestamp').limitToLast(50).once('value').then(snap=>{
    list.innerHTML='';
    const items=Object.entries(snap.val()||{}).sort((a,b)=>b[1].timestamp-a[1].timestamp);
    if(!items.length){list.innerHTML='<div style="text-align:center;padding:32px 20px;"><div style="font-size:48px;margin-bottom:12px;">🔔</div><div style="color:var(--t2);font-size:14px;">No notifications yet</div></div>';return;}
    items.forEach(([key,n])=>{
      const div=document.createElement('div');div.className='notif-item';
      const typeMap={
        follow:{icon:'👤',color:'var(--blue)',text:'followed you'},
        like:{icon:'❤️',color:'var(--red)',text:'liked your post'},
        comment:{icon:'💬',color:'var(--g)',text:'commented on your post'},
        status_react:{icon:'😍',color:'var(--amber)',text:'reacted to your status'},
        mention:{icon:'@',color:'var(--purple)',text:'mentioned you'},
        birthday:{icon:'🎂',color:'var(--amber)',text:'has a birthday today!'},
        reaction:{icon:'😊',color:'var(--g)',text:'reacted to your message'},
        watch_party:{icon:'🎬',color:'var(--purple)',text:'invited you to a Watch Party'},
      };
      const t=typeMap[n.type]||{icon:'🔔',color:'var(--t2)',text:'sent you a notification'};
      div.innerHTML=`
        <div style="width:42px;height:42px;border-radius:50%;background:${n.fromPhoto?'none':'var(--s2)'};flex-shrink:0;position:relative;">
          ${n.fromPhoto?`<img src="${esc(n.fromPhoto)}" style="width:42px;height:42px;border-radius:50%;object-fit:cover;">`:''}
          <div style="position:absolute;bottom:-2px;right:-2px;width:20px;height:20px;border-radius:50%;background:var(--s1);display:flex;align-items:center;justify-content:center;font-size:11px;">${t.icon}</div>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;color:var(--t1);line-height:1.4;"><strong style="color:${t.color};">${esc(getDisplayName(n.fromUid,n.fromName)||'Someone')}</strong> ${t.text}</div>
          ${n.preview?`<div style="font-size:12px;color:var(--t2);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(n.preview)}</div>`:''}
          <div style="font-size:11px;color:var(--t2);margin-top:3px;">${ago(n.timestamp)}</div>
        </div>
        <div class="notif-dot"></div>`;
      div.onclick=()=>{
        closeModal('notif-center-modal');
        if(n.type==='follow'&&n.fromUid)viewUserProfile(n.fromUid);
        else if(n.type==='like'||n.type==='comment')switchTab('feed');
        else if(n.type==='watch_party')openWatchPartyHub();
        else if(n.fromUid)db.ref(`users/${n.fromUid}`).once('value').then(s=>{const u=s.val()||{};openPrivate(n.fromUid,u.username||'User',u.mkjNumber||'',u.photoURL||'');});
      };
      list.appendChild(div);
    });
  }).then(()=>{
    // Clear badge + remove from db
    [$('notif-bell-badge'),$('prof-notif-dot')].forEach(b=>{if(b)b.classList.add('hidden');});
    db.ref(`notifications/${me?.uid}`).remove();
  });
}
function clearAllNotifs(){
  db.ref(`notifications/${me?.uid}`).remove();
  const list=$('notif-list');if(list)list.innerHTML='<div style="text-align:center;padding:32px 20px;color:var(--t2);">No notifications</div>';
  [$('notif-bell-badge'),$('prof-notif-dot')].forEach(b=>{if(b)b.classList.add('hidden');});
}
// Enhanced startNotifListener - now shows badge on both nav items
function startNotifListener(){
  if(!me||_notifRef)return;
  _notifRef=db.ref(`notifications/${me.uid}`).orderByChild('timestamp').limitToLast(50);
  _notifRef.on('value',snap=>{
    const count=Object.keys(snap.val()||{}).length;
    [$('notif-bell-badge'),$('prof-notif-dot')].forEach(b=>{
      if(b){b.textContent=count>9?'9+':count||'';b.classList.toggle('hidden',count===0);}
    });
  });
}

// ══════════════════════════════════════════════════════════════════
// FEATURE 2: FEED POST BOOKMARKS
// ══════════════════════════════════════════════════════════════════
function isBookmarked(key){
  const bm=JSON.parse(localStorage.getItem(`bookmarks_${me?.uid}`)||'[]');
  return bm.some(b=>b.key===key);
}
function toggleBookmark(key,postData){
  if(!me)return toast('Login required','error');
  const data=postData||_feedPostCache[key]||{};
  let bm=JSON.parse(localStorage.getItem(`bookmarks_${me.uid}`)||'[]');
  const idx=bm.findIndex(b=>b.key===key);
  if(idx>-1){
    bm.splice(idx,1);toast('Removed from saved posts','info');
  } else {
    bm.unshift({key,...data,savedAt:Date.now()});
    toast('Post saved 🔖','success');
  }
  localStorage.setItem(`bookmarks_${me.uid}`,JSON.stringify(bm));
  // Update button colour
  const btn=document.getElementById(`bm-${key}`);
  if(btn){
    const saved=idx===-1;
    btn.style.color=saved?'#f59e0b':'#fff';
    btn.innerHTML=`<i class="fa-${saved?'solid':'regular'} fa-bookmark"></i>`;
  }
}
function loadBookmarks(){
  const list=$('bookmarks-list');if(!list||!me)return;
  list.innerHTML='';
  const bm=JSON.parse(localStorage.getItem(`bookmarks_${me.uid}`)||'[]');
  if(!bm.length){
    list.innerHTML='<div style="text-align:center;padding:40px 20px;"><div style="font-size:48px;margin-bottom:12px;">🔖</div><div style="color:var(--t2);font-size:14px;">No saved posts yet.<br>Tap the bookmark on any feed post.</div></div>';
    return;
  }
  bm.forEach(p=>{
    const div=document.createElement('div');div.className='bookmarked-post';
    const thumb=p.imageURL?`<img src="${esc(p.imageURL)}" style="width:80px;height:80px;object-fit:cover;border-radius:10px;flex-shrink:0;">`
      :p.videoURL?`<div style="width:80px;height:80px;background:var(--s1);border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:28px;">🎬</div>`
      :`<div style="width:80px;height:80px;background:var(--s1);border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--t2);padding:6px;text-align:center;">${esc((p.text||'').substring(0,40))}</div>`;
    div.innerHTML=`<div style="display:flex;gap:12px;padding:12px;">
      ${thumb}
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;color:var(--t1);margin-bottom:4px;">${esc(p.username||'User')}</div>
        ${p.text?`<div style="font-size:13px;color:var(--t2);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${esc(p.text)}</div>`:''}
        <div style="font-size:11px;color:var(--t2);margin-top:6px;">${ago(p.savedAt)}</div>
      </div>
      <button onclick="toggleBookmark('${p.key}',{})" style="color:var(--amber);font-size:18px;flex-shrink:0;padding:4px;"><i class="fa-solid fa-bookmark"></i></button>
    </div>`;
    list.appendChild(div);
  });
}

// ══════════════════════════════════════════════════════════════════
// FEATURE 3: EXPLORE / TRENDING
// ══════════════════════════════════════════════════════════════════
let _exploreTab='trending';
function setExploreTab(tab,btn){
  _exploreTab=tab;
  document.querySelectorAll('.explore-tag').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  loadExplore(tab);
}
async function loadExplore(tab){
  const cont=$('explore-content');if(!cont)return;
  cont.innerHTML='<div style="text-align:center;padding:20px;color:var(--t2);">Loading…</div>';
  if(tab==='people'){
    const snap=await db.ref('users').limitToLast(30).once('value');
    const users=Object.entries(snap.val()||{}).filter(([uid])=>uid!==me?.uid);
    cont.innerHTML='';
    if(!users.length){cont.innerHTML='<div style="color:var(--t2);text-align:center;padding:20px;">No users found</div>';return;}
    users.sort(()=>Math.random()-0.5).slice(0,20).forEach(([uid,u])=>{
      const div=document.createElement('div');div.className='ci';div.style.borderRadius='12px';
      div.innerHTML=`<img src="${esc(u.photoURL||avUrl(u.username||'U'))}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">
        <div style="flex:1;"><div style="font-weight:600;color:var(--t1);font-size:14px;">${esc(u.username||'User')}</div><div style="font-size:12px;color:var(--blue);">#${esc(u.mkjNumber||'')}</div>${u.bio?`<div style="font-size:12px;color:var(--t2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(u.bio.substring(0,50))}</div>`:''}</div>
        <button onclick="followUser('${uid}').then(f=>this.textContent=f?'Following':'Follow')" style="padding:7px 14px;background:var(--g);border-radius:20px;color:#fff;font-size:12px;font-weight:700;">Follow</button>`;
      div.onclick=e=>{if(e.target.tagName==='BUTTON')return;closeModal('explore-modal');viewUserProfile(uid);};
      cont.appendChild(div);
    });
    return;
  }
  // Trending & Most Liked both use feed_posts
  const snap=await db.ref('feed_posts').orderByChild('timestamp').limitToLast(100).once('value');
  const posts=[];snap.forEach(s=>posts.push({...s.val(),key:s.key}));
  if(tab==='liked')posts.sort((a,b)=>Object.keys(b.likes||{}).length-Object.keys(a.likes||{}).length);
  else posts.sort((a,b)=>((Object.keys(b.likes||{}).length*3)+(Object.keys(b.comments||{}).length*2)+(Object.keys(b.views||{}).length))
    -((Object.keys(a.likes||{}).length*3)+(Object.keys(a.comments||{}).length*2)+(Object.keys(a.views||{}).length)));
  cont.innerHTML='';
  if(!posts.length){cont.innerHTML='<div style="color:var(--t2);text-align:center;padding:20px;">No posts yet</div>';return;}
  posts.slice(0,20).forEach((p,rank)=>{
    const div=document.createElement('div');
    div.style.cssText='display:flex;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer;align-items:center;';
    const thumb=p.imageURL?`<img src="${esc(p.imageURL)}" style="width:56px;height:56px;object-fit:cover;border-radius:10px;flex-shrink:0;">`
      :p.videoURL?`<div style="width:56px;height:56px;background:var(--s2);border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:24px;">🎬</div>`
      :`<div style="width:56px;height:56px;background:var(--s2);border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--t2);padding:4px;text-align:center;">${esc((p.text||'').substring(0,30))}</div>`;
    div.innerHTML=`<div style="font-size:18px;font-weight:900;color:var(--g);min-width:24px;text-align:center;">${rank+1}</div>
      ${thumb}
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;color:var(--t1);">${esc(p.username||'User')}</div>
        ${p.text?`<div style="font-size:12px;color:var(--t2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(p.text.substring(0,60))}</div>`:''}
        <div style="display:flex;gap:10px;margin-top:4px;font-size:11px;color:var(--t2);">
          <span>❤️ ${Object.keys(p.likes||{}).length}</span>
          <span>💬 ${Object.keys(p.comments||{}).length}</span>
          <span>👁 ${Object.keys(p.views||{}).length}</span>
        </div>
      </div>`;
    div.onclick=()=>{closeModal('explore-modal');switchTab('feed');};
    cont.appendChild(div);
  });
}

// ══════════════════════════════════════════════════════════════════
// FEATURE 4: WATCH PARTY (YouTube sync via Firebase)
// ══════════════════════════════════════════════════════════════════
// ══ WATCH PARTY — private/public, invite-only or open rooms per friend group ══
let _wpChatRef=null;let _wpActive=false;let currentPartyId=null;
let wpPlayer=null;let _wpApplyingRemote=false;let _wpCurrentYtId=null;let _wpVideoListenerRef=null;let _wpPlaybackListenerRef=null;let _wpSyncInterval=null;
let _wpApiLoadPromise=null;
let _wpInviteMode='create'; // 'create' (new party) or 'invite-more' (adding people to an existing one)
let _wpVisibility='private'; // 'private' or 'public' — only relevant while creating
let _wpPlayerReady=false;let _wpPlayerReadyResolve=null;let _wpPlayerReadyPromise=null;
const WP_STALE_MS=30*60*1000; // a party with no activity for 30 minutes is treated as closed
const WP_VOICE_MAX_SEC=20; // keep watch-party voice notes short so a busy chat stays readable

function loadYTApi(){
  if(window.YT&&window.YT.Player)return Promise.resolve();
  if(_wpApiLoadPromise)return _wpApiLoadPromise;
  _wpApiLoadPromise=new Promise(resolve=>{
    const prevCb=window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady=()=>{if(prevCb)prevCb();resolve();};
    if(!document.getElementById('yt-iframe-api-script')){
      const tag=document.createElement('script');tag.id='yt-iframe-api-script';tag.src='https://www.youtube.com/iframe_api';document.head.appendChild(tag);
    }
  });
  return _wpApiLoadPromise;
}

// ── HUB — pending invites, your active parties, and open public ones ──
function openWatchPartyHub(){
  if(!me)return toast('Login required','error');
  openModal('watch-party-hub-modal');
  loadWatchPartyHub();
}
async function loadWatchPartyHub(){
  const pendingCont=$('wp-hub-pending');const activeCont=$('wp-hub-active');const emptyMsg=$('wp-hub-empty');
  const publicWrap=$('wp-hub-public-wrap');const publicCont=$('wp-hub-public');
  if(!pendingCont||!activeCont)return;
  pendingCont.innerHTML='';activeCont.innerHTML='';if(publicCont)publicCont.innerHTML='';
  if(emptyMsg)emptyMsg.classList.add('hidden');
  if(publicWrap)publicWrap.classList.add('hidden');

  const idxSnap=await db.ref(`user_watch_parties/${me.uid}`).once('value');
  const partyIds=Object.keys(idxSnap.val()||{});
  let anyShown=false;
  const myAcceptedIds=new Set();

  for(const partyId of partyIds){
    try{
      const [partySnap,inviteSnap]=await Promise.all([
        db.ref(`watch_parties/${partyId}`).once('value'),
        db.ref(`watch_parties/${partyId}/invites/${me.uid}`).once('value')
      ]);
      const party=partySnap.val();const myInvite=inviteSnap.val();
      if(!party||!myInvite)continue; // party or our invite was removed
      const lastActive=party.lastActivityAt||party.createdAt||0;
      const isStale=(Date.now()-lastActive)>WP_STALE_MS;
      if(isStale){
        db.ref(`user_watch_parties/${me.uid}/${partyId}`).remove();
        continue;
      }
      anyShown=true;
      if(myInvite.status==='pending'){
        const row=document.createElement('div');row.className='ci';row.style.cssText='background:var(--s2);border-radius:12px;margin-bottom:8px;flex-direction:column;align-items:stretch;gap:8px;padding:12px;';
        row.innerHTML=`<div style="font-size:14px;color:var(--t1);"><strong>${esc(getDisplayName(myInvite.invitedBy,myInvite.invitedByName))}</strong> invited you to a Watch Party</div>
          <div style="display:flex;gap:8px;">
            <button data-accept style="flex:1;padding:9px;background:var(--g);border-radius:8px;color:#fff;font-weight:700;font-size:13px;">Accept</button>
            <button data-decline style="flex:1;padding:9px;background:var(--s1);border-radius:8px;color:var(--t2);font-weight:700;font-size:13px;">Decline</button>
          </div>`;
        row.querySelector('[data-accept]').onclick=()=>acceptWatchPartyInvite(partyId);
        row.querySelector('[data-decline]').onclick=()=>declineWatchPartyInvite(partyId);
        pendingCont.appendChild(row);
      }else if(myInvite.status==='accepted'){
        myAcceptedIds.add(partyId);
        const row=document.createElement('div');row.className='ci';row.style.cursor='pointer';
        row.innerHTML=`<div style="width:44px;height:44px;border-radius:12px;background:var(--s2);display:flex;align-items:center;justify-content:center;font-size:20px;">${party.visibility==='public'?'🌍':'🎬'}</div>
          <div style="flex:1;min-width:0;"><div style="font-weight:600;color:var(--t1);font-size:14px;">${esc(getDisplayName(party.createdBy,party.createdByName))}'s Watch Party</div><div style="font-size:12px;color:var(--t2);">Tap to join</div></div>`;
        row.onclick=()=>{closeModal('watch-party-hub-modal');joinWatchParty(partyId);};
        activeCont.appendChild(row);
      }
    }catch(e){ /* couldn't load this one — skip it rather than break the whole list */ }
  }

  // Public parties — open to everyone, joinable directly without an invite
  try{
    const pubSnap=await db.ref('public_watch_parties').once('value');
    const pubIds=Object.keys(pubSnap.val()||{});
    if(pubIds.length&&publicWrap&&publicCont){
      let anyPublicShown=false;
      for(const partyId of pubIds){
        if(myAcceptedIds.has(partyId))continue; // already shown above, don't duplicate
        try{
          const [partySnap,viewersSnap]=await Promise.all([
            db.ref(`watch_parties/${partyId}`).once('value'),
            db.ref(`watch_parties/${partyId}/viewers`).once('value')
          ]);
          const party=partySnap.val();
          if(!party)continue;
          const lastActive=party.lastActivityAt||party.createdAt||0;
          if((Date.now()-lastActive)>WP_STALE_MS){db.ref(`public_watch_parties/${partyId}`).remove();continue;}
          const viewerCount=Object.keys(viewersSnap.val()||{}).length;
          anyPublicShown=true;anyShown=true;
          const row=document.createElement('div');row.className='ci';row.style.cursor='pointer';
          row.innerHTML=`<div style="width:44px;height:44px;border-radius:12px;background:var(--s2);display:flex;align-items:center;justify-content:center;font-size:20px;">🌍</div>
            <div style="flex:1;min-width:0;"><div style="font-weight:600;color:var(--t1);font-size:14px;">${esc(getDisplayName(party.createdBy,party.createdByName))}'s Watch Party</div><div style="font-size:12px;color:var(--g);">🎬 ${viewerCount} watching now</div></div>`;
          row.onclick=()=>{closeModal('watch-party-hub-modal');joinWatchParty(partyId);};
          publicCont.appendChild(row);
        }catch(e){}
      }
      if(anyPublicShown)publicWrap.classList.remove('hidden');
    }
  }catch(e){}

  if(!anyShown&&emptyMsg)emptyMsg.classList.remove('hidden');
}

// ── CREATE / INVITE (shared contact picker) ─────────────────────
function createWatchPartyStart(){
  if(!me)return toast('Login required','error');
  _wpInviteMode='create';_wpVisibility='private';
  const title=$('wp-invite-title');if(title)title.textContent='Create Watch Party';
  const visPicker=$('wp-visibility-picker');if(visPicker)visPicker.classList.remove('hidden');
  updateWpVisibilityButtons();
  buildWatchPartyInviteList();
  openModal('wp-invite-modal');
}
function inviteMoreToWatchParty(){
  if(!currentPartyId)return;
  _wpInviteMode='invite-more';
  const title=$('wp-invite-title');if(title)title.textContent='Invite More People';
  const visPicker=$('wp-visibility-picker');if(visPicker)visPicker.classList.add('hidden');
  // Step the room aside while the invite picker is open — both share the same
  // visual layer, and the room (opened first) would otherwise sit on top of
  // the picker and hide it completely, making "Invite More" look broken.
  const room=$('watch-party-modal');if(room)room.classList.add('hidden');
  buildWatchPartyInviteList();
  openModal('wp-invite-modal');
}
function closeWpInviteModal(){
  closeModal('wp-invite-modal');
  if(_wpInviteMode==='invite-more'&&currentPartyId){
    const room=$('watch-party-modal');if(room)room.classList.remove('hidden'); // come back to the room
  }
}
function setWpVisibility(mode){
  _wpVisibility=mode;
  updateWpVisibilityButtons();
}
function updateWpVisibilityButtons(){
  const priv=$('wp-vis-private');const pub=$('wp-vis-public');
  if(!priv||!pub)return;
  priv.style.background=_wpVisibility==='private'?'rgba(0,168,132,.15)':'var(--s2)';
  priv.style.color=_wpVisibility==='private'?'var(--g)':'var(--t1)';
  priv.style.border=_wpVisibility==='private'?'1px solid var(--g)':'none';
  pub.style.background=_wpVisibility==='public'?'rgba(0,168,132,.15)':'var(--s2)';
  pub.style.color=_wpVisibility==='public'?'var(--g)':'var(--t1)';
  pub.style.border=_wpVisibility==='public'?'1px solid var(--g)':'none';
}
function buildWatchPartyInviteList(){
  const list=$('wp-invite-list');if(!list)return;
  list.innerHTML='';
  const entries=Object.entries(_contacts);
  if(!entries.length){
    list.innerHTML='<div style="font-size:13px;color:var(--t2);padding:12px;">You have no saved contacts yet. Save someone from their profile first.</div>';
    return;
  }
  entries.forEach(([uid,c])=>{
    const row=document.createElement('label');
    row.style.cssText='display:flex;align-items:center;gap:10px;padding:8px 4px;font-size:14px;color:var(--t1);cursor:pointer;';
    const cb=document.createElement('input');cb.type='checkbox';cb.dataset.uid=uid;cb.className='wp-invite-cb';
    row.appendChild(cb);
    const span=document.createElement('span');span.textContent=c.savedName||c.username||'User';
    row.appendChild(span);
    list.appendChild(row);
  });
}
async function confirmWatchPartyInvite(){
  const checked=Array.from(document.querySelectorAll('.wp-invite-cb:checked')).map(cb=>cb.dataset.uid);
  const creatingPublic=_wpInviteMode==='create'&&_wpVisibility==='public';
  if(!checked.length&&!creatingPublic)return toast('Pick at least one person to invite','error');
  const wasInviteMore=_wpInviteMode==='invite-more';
  closeModal('wp-invite-modal');
  if(_wpInviteMode==='create'){
    await createWatchPartyWithInvites(checked,_wpVisibility);
  }else{
    if(checked.length){await sendWatchPartyInvites(currentPartyId,checked);toast('Invites sent 🎬','success');}
    if(wasInviteMore&&currentPartyId){const room=$('watch-party-modal');if(room)room.classList.remove('hidden');}
  }
}
async function createWatchPartyWithInvites(inviteeUids,visibility){
  if(!me)return;
  const partyRef=db.ref('watch_parties').push();
  const partyId=partyRef.key;
  const now=Date.now();
  await partyRef.set({createdBy:me.uid,createdByName:me.username,createdAt:now,lastActivityAt:now,visibility:visibility||'private'});
  // Creator is auto-accepted into their own party
  await db.ref(`watch_parties/${partyId}/invites/${me.uid}`).set({username:me.username,photoURL:me.photoURL||'',status:'accepted',invitedBy:me.uid,invitedByName:me.username,timestamp:now});
  await db.ref(`user_watch_parties/${me.uid}/${partyId}`).set(true);
  if(visibility==='public')await db.ref(`public_watch_parties/${partyId}`).set(true);
  if(inviteeUids.length)await sendWatchPartyInvites(partyId,inviteeUids);
  toast(visibility==='public'?'Public Watch Party created 🌍':'Watch Party created 🎬','success');
  joinWatchParty(partyId);
}
async function sendWatchPartyInvites(partyId,inviteeUids){
  if(!me||!partyId)return;
  const now=Date.now();
  for(const uid of inviteeUids){
    const c=_contacts[uid]||{};
    // Being invited always means an accept step — even for a Public party,
    // being personally invited is different from someone freely joining a
    // public room themselves, which needs no invite at all.
    await db.ref(`watch_parties/${partyId}/invites/${uid}`).set({username:c.username||'',photoURL:'',status:'pending',invitedBy:me.uid,invitedByName:me.username,timestamp:now});
    await db.ref(`user_watch_parties/${uid}/${partyId}`).set(true);
    db.ref(`notifications/${uid}`).push({type:'watch_party',fromUid:me.uid,fromName:me.username,fromPhoto:me.photoURL||'',partyId,timestamp:now});
  }
  db.ref(`watch_parties/${partyId}/lastActivityAt`).set(now);
}
async function acceptWatchPartyInvite(partyId){
  if(!me)return;
  await db.ref(`watch_parties/${partyId}/invites/${me.uid}/status`).set('accepted');
  closeModal('watch-party-hub-modal');
  joinWatchParty(partyId);
}
async function declineWatchPartyInvite(partyId){
  if(!me)return;
  await db.ref(`watch_parties/${partyId}/invites/${me.uid}`).remove();
  await db.ref(`user_watch_parties/${me.uid}/${partyId}`).remove();
  toast('Invite declined','info');
  loadWatchPartyHub();
}

// ── ACTIVE ROOM ──────────────────────────────────────────────────
function joinWatchParty(partyId){
  currentPartyId=partyId;
  openModal('watch-party-modal');
  initWatchParty();
}
async function initWatchParty(){
  if(_wpActive||!me||!currentPartyId)return;_wpActive=true;
  const partyId=currentPartyId;

  db.ref(`watch_parties/${partyId}`).once('value').then(s=>{
    const p=s.val();if(!p)return;
    const title=$('wp-room-title');if(title)title.textContent=`${getDisplayName(p.createdBy,p.createdByName)}'s Watch Party`;
  });

  const joinNow=Date.now();
  db.ref(`watch_parties/${partyId}/viewers/${me.uid}`).set({username:me.username,photoURL:me.photoURL||'',joinedAt:joinNow});
  db.ref(`watch_parties/${partyId}/viewers/${me.uid}`).onDisconnect().remove();
  db.ref(`watch_parties/${partyId}/lastActivityAt`).set(joinNow);

  await loadYTApi();
  if(!wpPlayer){
    _wpPlayerReady=false;
    _wpPlayerReadyPromise=new Promise(resolve=>{_wpPlayerReadyResolve=resolve;});
    wpPlayer=new YT.Player('wp-yt-target',{
      playerVars:{playsinline:1,rel:0},
      events:{
        onReady:()=>{_wpPlayerReady=true;if(_wpPlayerReadyResolve)_wpPlayerReadyResolve();},
        onStateChange:(e)=>wpOnPlayerStateChange(e),
      }
    });
  }else if(!_wpPlayerReadyPromise){
    // Reusing a player instance from a previous room this session — already ready
    _wpPlayerReady=true;_wpPlayerReadyPromise=Promise.resolve();
  }

  // Watch for a new video being loaded by anyone in this room
  _wpVideoListenerRef=db.ref(`watch_parties/${partyId}/video`).on('value',async snap=>{
    const v=snap.val();if(!v||!v.url)return;
    const ytId=extractYTId(v.url);
    if(!ytId||ytId===_wpCurrentYtId)return;
    _wpCurrentYtId=ytId;
    const loading=$('wp-loading');if(loading)loading.style.display='flex';
    await _wpPlayerReadyPromise; // wait for the player to actually finish waking up before handing it a video
    if(currentPartyId!==partyId)return; // left while waiting
    const ph=$('wp-yt-placeholder');if(ph)ph.style.display='none';
    _wpApplyingRemote=true;
    wpPlayer.loadVideoById(ytId);
    setTimeout(()=>{_wpApplyingRemote=false;const l=$('wp-loading');if(l)l.style.display='none';},1200);
  });

  // Watch the shared play/pause/seek state and mirror it locally
  _wpPlaybackListenerRef=db.ref(`watch_parties/${partyId}/playback`).on('value',async snap=>{
    const p=snap.val();if(!p)return;
    if(p.updatedBy===me.uid)return; // don't react to our own broadcast
    await _wpPlayerReadyPromise;
    if(currentPartyId!==partyId||!wpPlayer||typeof wpPlayer.seekTo!=='function')return;
    const elapsed=p.state==='playing'?(Date.now()-p.updatedAt)/1000:0;
    const targetTime=(p.time||0)+elapsed;
    _wpApplyingRemote=true;
    wpPlayer.seekTo(targetTime,true);
    if(p.state==='playing')wpPlayer.playVideo();else wpPlayer.pauseVideo();
    setTimeout(()=>{_wpApplyingRemote=false;},800);
  });

  // Periodic drift correction — every 5s, nudge back in sync if more than 2s off
  _wpSyncInterval=setInterval(()=>{
    if(!_wpPlayerReady||!wpPlayer||typeof wpPlayer.getCurrentTime!=='function'||currentPartyId!==partyId)return;
    db.ref(`watch_parties/${partyId}/playback`).once('value').then(snap=>{
      const p=snap.val();if(!p||p.state!=='playing'||p.updatedBy===me?.uid)return;
      const expected=(p.time||0)+(Date.now()-p.updatedAt)/1000;
      const actual=wpPlayer.getCurrentTime();
      if(Math.abs(expected-actual)>2){_wpApplyingRemote=true;wpPlayer.seekTo(expected,true);setTimeout(()=>{_wpApplyingRemote=false;},800);}
    });
  },5000);

  // Watch viewers currently in this room
  db.ref(`watch_parties/${partyId}/viewers`).on('value',snap=>{
    const cont=$('wp-viewers');if(!cont)return;
    const viewers=snap.val()||{};
    const existing=cont.querySelectorAll('[data-uid]');existing.forEach(e=>e.remove());
    Object.entries(viewers).forEach(([uid,v])=>{
      const av=document.createElement('div');av.dataset.uid=uid;av.style.cssText='display:flex;flex-direction:column;align-items:center;gap:3px;flex-shrink:0;';
      av.innerHTML=`<img src="${esc(v.photoURL||avUrl(v.username||'U'))}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid ${uid===me?.uid?'var(--g)':'var(--s2)'};"><span style="font-size:9px;color:var(--t2);max-width:40px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(getDisplayName(uid,v.username))}</span>`;
      cont.appendChild(av);
    });
  });
  // Watch chat for this room — text or voice notes
  _wpChatRef=db.ref(`watch_parties/${partyId}/chat`).orderByChild('timestamp').limitToLast(30).on('child_added',snap=>{
    const m=snap.val();const chat=$('wp-chat');if(!chat)return;
    const div=document.createElement('div');div.className='wp-msg';
    const nameSpan=`<span style="font-size:12px;font-weight:700;color:${m.uid===me?.uid?'var(--g)':'var(--blue)'};">${esc(getDisplayName(m.uid,m.username))}: </span>`;
    if(m.voiceURL){
      div.innerHTML=`${nameSpan}<audio controls src="${esc(m.voiceURL)}" style="height:28px;vertical-align:middle;max-width:180px;"></audio>`;
    }else{
      div.innerHTML=`${nameSpan}${esc(m.text||'')}`;
    }
    chat.appendChild(div);chat.scrollTop=chat.scrollHeight;
  });
}
function wpOnPlayerStateChange(e){
  if(_wpApplyingRemote||!me||!wpPlayer||!currentPartyId)return; // remote sync, not a real local tap — don't re-broadcast it
  const partyId=currentPartyId;
  const state=e.data;
  const now=Date.now();
  if(state===YT.PlayerState.PLAYING){
    db.ref(`watch_parties/${partyId}/playback`).set({state:'playing',time:wpPlayer.getCurrentTime(),updatedAt:now,updatedBy:me.uid});
    db.ref(`watch_parties/${partyId}/lastActivityAt`).set(now);
  }else if(state===YT.PlayerState.PAUSED){
    db.ref(`watch_parties/${partyId}/playback`).set({state:'paused',time:wpPlayer.getCurrentTime(),updatedAt:now,updatedBy:me.uid});
    db.ref(`watch_parties/${partyId}/lastActivityAt`).set(now);
  }
}
function wpLoadVideo(){
  const inp=$('wp-yt-inp');if(!inp||!inp.value.trim()||!currentPartyId)return;
  const url=inp.value.trim();
  if(!extractYTId(url))return toast('Please paste a valid YouTube URL','error');
  const now=Date.now();
  db.ref(`watch_parties/${currentPartyId}/video`).set({url,setBy:me?.uid,setByName:me?.username,timestamp:now});
  db.ref(`watch_parties/${currentPartyId}/playback`).set({state:'playing',time:0,updatedAt:now,updatedBy:me?.uid});
  db.ref(`watch_parties/${currentPartyId}/lastActivityAt`).set(now);
  inp.value='';toast('Video loaded for everyone 🎬','success');
}
function wpSendMsg(){
  const inp=$('wp-msg-inp');if(!inp||!inp.value.trim()||!me||!currentPartyId)return;
  const now=Date.now();
  db.ref(`watch_parties/${currentPartyId}/chat`).push({uid:me.uid,username:me.username,text:inp.value.trim(),timestamp:now});
  db.ref(`watch_parties/${currentPartyId}/lastActivityAt`).set(now);
  inp.value='';
}

// ── VOICE NOTES IN WATCH PARTY CHAT ──────────────────────────────
let wpMRec=null,wpAChunks=[],wpIsRec=false,wpRecTimer=null;
async function toggleWpVoiceRec(){
  if(!me||!currentPartyId)return;
  if(wpIsRec){wpMRec?.stop();return;}
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    wpAChunks=[];wpMRec=new MediaRecorder(stream);wpIsRec=true;
    const btn=$('wp-voice-btn');if(btn){btn.innerHTML='<i class="fa-solid fa-stop"></i>';btn.style.background='var(--red)';btn.style.color='#fff';}
    toast(`🔴 Recording… max ${WP_VOICE_MAX_SEC}s`,'info');
    wpMRec.ondataavailable=e=>wpAChunks.push(e.data);
    wpMRec.onstop=async()=>{
      wpIsRec=false;stream.getTracks().forEach(t=>t.stop());
      clearTimeout(wpRecTimer);wpRecTimer=null;
      const btn=$('wp-voice-btn');if(btn){btn.innerHTML='<i class="fa-solid fa-microphone"></i>';btn.style.background='var(--s2)';btn.style.color='var(--g)';}
      const blob=new Blob(wpAChunks,{type:'audio/webm'});
      if(blob.size<500||!currentPartyId)return; // too short/empty, or left the room mid-recording — don't send
      toast('Sending voice note…','info');
      try{
        const url=await uploadCld(new File([blob],'wp-voice.webm',{type:'audio/webm'}));
        const now=Date.now();
        db.ref(`watch_parties/${currentPartyId}/chat`).push({uid:me.uid,username:me.username,text:'',voiceURL:url,timestamp:now});
        db.ref(`watch_parties/${currentPartyId}/lastActivityAt`).set(now);
      }catch{toast('Voice note upload failed','error');}
    };
    wpMRec.start();
    wpRecTimer=setTimeout(()=>{if(wpIsRec)wpMRec.stop();},WP_VOICE_MAX_SEC*1000);
  }catch{wpIsRec=false;toast('Microphone access denied','error');}
}

function leaveWatchParty(){
  const partyId=currentPartyId;
  _wpActive=false;_wpCurrentYtId=null;
  if(wpIsRec&&wpMRec){wpMRec.stop();} // don't leave a stray recording running
  if(partyId){
    if(_wpVideoListenerRef){db.ref(`watch_parties/${partyId}/video`).off();_wpVideoListenerRef=null;}
    if(_wpPlaybackListenerRef){db.ref(`watch_parties/${partyId}/playback`).off();_wpPlaybackListenerRef=null;}
    if(_wpChatRef){db.ref(`watch_parties/${partyId}/chat`).off();_wpChatRef=null;}
    db.ref(`watch_parties/${partyId}/viewers`).off();
    if(me)db.ref(`watch_parties/${partyId}/viewers/${me.uid}`).remove();
  }
  if(_wpSyncInterval){clearInterval(_wpSyncInterval);_wpSyncInterval=null;}
  if(wpPlayer&&typeof wpPlayer.destroy==='function'){wpPlayer.destroy();wpPlayer=null;}
  _wpPlayerReady=false;_wpPlayerReadyPromise=null;_wpPlayerReadyResolve=null;
  const ph=$('wp-yt-placeholder');if(ph)ph.style.display='flex';
  const loading=$('wp-loading');if(loading)loading.style.display='none';
  const chat=$('wp-chat');if(chat)chat.innerHTML='';
  const viewersCont=$('wp-viewers');if(viewersCont)viewersCont.querySelectorAll('[data-uid]').forEach(e=>e.remove());
  currentPartyId=null;
  closeModal('watch-party-modal');
}
function extractYTId(url){
  const m=url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([\w-]{11})/);
  return m?m[1]:null;
}

// ══════════════════════════════════════════════════════════════════
// FEATURE 5: STATUS MUSIC
// ══════════════════════════════════════════════════════════════════
let _statusMusicData=null;
const VIBE_URLS={
  chill:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  hype:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  love:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  sad:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
};
const VIBE_NAMES={chill:'😌 Chill Vibes',hype:'🔥 Hype Mode',love:'❤️ Love Mood',sad:'😢 Feeling Blue'};
function selectVibeMusic(vibe){
  _statusMusicData={url:VIBE_URLS[vibe],title:VIBE_NAMES[vibe]};
  $('status-music-url').value=VIBE_URLS[vibe];
  $('status-music-title').value=VIBE_NAMES[vibe];
  toast(`${VIBE_NAMES[vibe]} selected 🎵`,'success');
}
function attachMusicToStatus(){
  const url=$('status-music-url').value.trim();
  const title=$('status-music-title').value.trim()||'Music';
  if(!url)return toast('Enter a music URL','error');
  _statusMusicData={url,title};
  const prev=$('status-music-preview');const txt=$('status-music-preview-txt');
  if(prev){prev.style.display='flex';prev.classList.remove('hidden');}
  if(txt)txt.textContent=title;
  closeModal('status-music-modal');
  toast('Music attached 🎵','success');
}
function clearStatusMusic(){
  _statusMusicData=null;
  const prev=$('status-music-preview');if(prev){prev.style.display='none';prev.classList.add('hidden');}
}
// ══ FEED POST MUSIC — mirrors the status music feature above, kept as separate state/ids on purpose ══
let _feedPostMusicData=null;
function selectFeedVibeMusic(vibe){
  _feedPostMusicData={url:VIBE_URLS[vibe],title:VIBE_NAMES[vibe]};
  $('feed-music-url').value=VIBE_URLS[vibe];
  $('feed-music-title').value=VIBE_NAMES[vibe];
  toast(`${VIBE_NAMES[vibe]} selected 🎵`,'success');
}
function attachMusicToFeedPost(){
  const url=$('feed-music-url').value.trim();
  const title=$('feed-music-title').value.trim()||'Music';
  if(!url)return toast('Enter a music URL','error');
  _feedPostMusicData={url,title};
  const prev=$('feed-music-preview');const txt=$('feed-music-preview-txt');
  if(prev){prev.style.display='flex';prev.classList.remove('hidden');}
  if(txt)txt.textContent=title;
  closeModal('feed-music-modal');
  toast('Music attached 🎵','success');
}
function clearFeedMusic(){
  _feedPostMusicData=null;
  const prev=$('feed-music-preview');if(prev){prev.style.display='none';prev.classList.add('hidden');}
  const urlInp=$('feed-music-url');if(urlInp)urlInp.value='';
  const titleInp=$('feed-music-title');if(titleInp)titleInp.value='';
}
// Patch postStatus to include music data
function postStatus(){
  // We'll inject music into the status payload via a flag read by the real postStatus
  window._pendingStatusMusic=_statusMusicData;
  postStatusCore();
  _statusMusicData=null;clearStatusMusic();
}

// ══════════════════════════════════════════════════════════════════
// FEATURE 6: EDIT MESSAGE
// ══════════════════════════════════════════════════════════════════
function editMsg(key,chatType,currentText){
  const modal=document.createElement('div');modal.className='modal-bg';modal.style.zIndex='600';
  modal.onclick=e=>{if(e.target===modal)modal.remove();};
  modal.innerHTML=`<div class="modal-box">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <span style="font-size:16px;font-weight:700;color:var(--t1);">✏️ Edit Message</span>
      <button onclick="this.closest('.modal-bg').remove()" style="color:var(--t2);font-size:24px;">×</button>
    </div>
    <textarea id="edit-msg-inp" rows="4" style="width:100%;padding:12px;background:var(--s2);border-radius:12px;font-size:15px;color:var(--t1);resize:none;line-height:1.5;margin-bottom:12px;">${esc(currentText)}</textarea>
    <div style="display:flex;gap:8px;">
      <button onclick="this.closest('.modal-bg').remove()" style="flex:1;padding:12px;background:var(--s2);border-radius:12px;color:var(--t1);font-weight:600;">Cancel</button>
      <button onclick="saveEditMsg('${key}','${chatType}',this.closest('.modal-bg'))" style="flex:1;padding:12px;background:var(--g);border-radius:12px;color:#fff;font-weight:700;">Save</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  setTimeout(()=>{const inp=modal.querySelector('#edit-msg-inp');if(inp){inp.focus();inp.selectionStart=inp.value.length;}},100);
}
async function saveEditMsg(key,chatType,modal){
  const inp=modal?.querySelector('#edit-msg-inp');if(!inp)return;
  const newText=inp.value.trim();if(!newText)return toast('Message cannot be empty','error');
  let ref;
  if(chatType==='global')ref=db.ref(`global_chat/${key}`);
  else if(chatType==='private'&&chatId)ref=db.ref(`private_chats/${chatId}/${key}`);
  else if(chatType==='group'&&curGid)ref=db.ref(`group_messages/${curGid}/${key}`);
  if(!ref)return;
  await ref.update({text:newText,edited:true,editedAt:Date.now()});
  modal.remove();toast('Message edited ✓','success');
}
// Show edited indicator in makeMsg - patch the time display
function makeMsg(msg,isMe,key,chatType,reactions,searchQ){
  const el=makeMsgCore(msg,isMe,key,chatType,reactions,searchQ);
  if(el&&msg.edited){
    const timeRow=el.querySelector('[style*="font-size:10px"]');
    if(timeRow){
      const editedSpan=document.createElement('span');
      editedSpan.style.cssText='font-size:10px;color:var(--t2);font-style:italic;margin-right:4px;';
      editedSpan.textContent='edited';
      timeRow.prepend(editedSpan);
    }
  }
  return el;
}

window.addEventListener('beforeunload',()=>{if(me){db.ref(`users/${me.uid}/online`).set(false);db.ref(`users/${me.uid}/lastSeen`).set(Date.now());}});
