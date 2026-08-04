// ══ FEED (TIKTOK/X STYLE) ═══════════════════════════════════════
let lFeed=null;
const _feedPostCache={}; // key -> minimal post data, used by toggleBookmark so we never have to embed raw JSON into an onclick attribute
function loadFeed(){
  const list=$('feed-list');if(!list)return Promise.resolve();
  // Always detach and re-attach so we get fresh data
  if(lFeed){db.ref('feed_posts').off();lFeed=null;}
  if(_feedObserver){_feedObserver.disconnect();_feedObserver=null;}
  list.innerHTML='<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#666;font-size:14px;">Loading…</div>';
  // Update post avatar in modal
  const av=$('post-user-av');const nm=$('post-user-name');
  if(av&&me)av.src=me.photoURL||avUrl(me.username||'U');
  if(nm&&me)nm.textContent=me.username||'';

  // One-time initial fetch renders the full list once. This replaces the
  // old .on('value',...) approach, which rebuilt the ENTIRE feed (wiping
  // and resetting scroll to the top) every single time ANYTHING changed
  // anywhere under feed_posts — including an automatic view-count write
  // or someone else's like, not just a new post. That's what was causing
  // the feed to look "stuck" on one post no matter how far you scrolled.
  return db.ref('feed_posts').orderByChild('timestamp').limitToLast(50).once('value').then(snap=>{
    list.innerHTML='';
    const posts=[];let newestTs=0;
    snap.forEach(s=>{
      const val=s.val();
      posts.unshift({...val,key:s.key});
      if(val.timestamp>newestTs)newestTs=val.timestamp;
    });
    if(!posts.length){
      list.innerHTML='<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;"><div style="font-size:48px;">📱</div><div style="color:#888;font-size:15px;text-align:center;">No posts yet<br><span style="font-size:13px;color:#555;">Be first to share something!</span></div></div>';
    }else{
      posts.forEach(p=>{
        try{
          list.appendChild(buildFeedPost(p));
        }catch(err){
          console.error('Feed post failed to render:',p.key,p.uid,err);
          const errCard=document.createElement('div');
          errCard.style.cssText='margin:8px 12px;padding:12px;background:#3a1a1a;border-radius:10px;color:#ff8080;font-size:12px;';
          errCard.textContent=`⚠ A post from ${p.username||p.uid||'unknown user'} failed to display (${err.message}). Screenshot this and send it to me.`;
          list.appendChild(errCard);
        }
      });
    }
    // From here on, only watch for genuinely NEW posts (timestamp strictly
    // after the newest one already rendered) — a like, comment, or view
    // elsewhere in the tree will never fire this, so scroll position is
    // never disturbed by anything except an actual new post arriving.
    lFeed=db.ref('feed_posts').orderByChild('timestamp').startAt(newestTs+1).on('child_added',s=>{
      const emptyMsg=list.querySelector('div[style*="No posts yet"]');
      if(emptyMsg)emptyMsg.remove();
      const p={...s.val(),key:s.key};
      try{
        list.prepend(buildFeedPost(p));
      }catch(err){
        console.error('New feed post failed to render:',p.key,p.uid,err);
      }
    });
  }).catch(err=>{
    console.error('Feed initial load failed:',err);
    list.innerHTML=`<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#ff8080;font-size:13px;padding:20px;text-align:center;">Could not load feed: ${err.message}</div>`;
  });
}

let _feedSoundOn=false;
let _feedObserver=null;
function ensureFeedObserver(){
  if(_feedObserver)return _feedObserver;
  // Only the post that's actually on screen should ever be playing —
  // everything else gets paused, which stops its audio too. This is what
  // was missing: videos kept autoplaying (and staying unmuted) even after
  // being scrolled away from, so an old post's sound kept going underneath
  // whatever you scrolled to next.
  _feedObserver=new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      const video=entry.target.querySelector('video');
      const audio=entry.target.querySelector('audio[id^="fm-"]');
      if(video){
        if(entry.isIntersecting&&entry.intersectionRatio>=0.6){
          video.muted=!_feedSoundOn;
          video.play().catch(()=>{});
          const key=video.id.replace('fv-','');
          const btn=document.getElementById('fvmute-'+key);
          if(btn)btn.innerHTML=video.muted?'<i class="fa-solid fa-volume-xmark"></i>':'<i class="fa-solid fa-volume-high"></i>';
        }else{
          video.pause();
        }
      }
      if(audio){
        // Post music never competes with a post's own video sound — only plays if there's no video, or the video is muted
        if(entry.isIntersecting&&entry.intersectionRatio>=0.6&&_feedSoundOn&&(!video||video.muted)){
          audio.play().catch(()=>{});
        }else{
          audio.pause();
        }
      }
    });
  },{threshold:[0,0.6,1]});
  return _feedObserver;
}
function toggleFeedVideoMute(key){
  const v=document.getElementById('fv-'+key);
  const btn=document.getElementById('fvmute-'+key);
  if(!v||!btn)return;
  v.muted=!v.muted;
  _feedSoundOn=!v.muted;
  btn.innerHTML=v.muted
    ?'<i class="fa-solid fa-volume-xmark"></i>'
    :'<i class="fa-solid fa-volume-high"></i>';
}

function buildFeedPost(p){
  _feedPostCache[p.key]={uid:p.uid||'',username:p.username||'',text:p.text||'',imageURL:p.imageURL||'',videoURL:p.videoURL||'',time:p.time||''};
  const wrap=document.createElement('div');
  // TikTok style - each post fills exactly 100dvh, no gaps
  // height set twice on purpose: browsers/WebViews that don't understand
  // dvh treat it as an invalid value and ignore the whole declaration,
  // which without a fallback collapses the post to its content height
  // (the "half screen" bug). The 100% rule is the fallback; dvh overrides
  // it wherever supported.
  wrap.style.cssText='position:relative;width:100%;height:100%;height:100dvh;scroll-snap-align:start;overflow:hidden;background:#000;flex-shrink:0;';
  const likes=p.likes||{};const liked=me&&likes[me.uid];const likeCount=Object.keys(likes).length;
  const comments=p.comments||{};const commentCount=Object.keys(comments).length;
  const vbadge=p.uid===CEO_UID?'<span style="display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;background:#1d9bf0;border-radius:50%;margin-left:3px;"><i class="fa-solid fa-check" style="color:#fff;font-size:8px;"></i></span>':'';

  // Background media
  let mediaBg='';
  if(p.videoURL){
    // Videos autoplay MUTED (browser requirement). Named function avoids all quote escaping issues.
    mediaBg=`<video id="fv-${p.key}" autoplay muted loop playsinline src="${esc(p.videoURL)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" onclick="this.paused?this.play():this.pause()"></video>
    <button id="fvmute-${p.key}" onclick="toggleFeedVideoMute('${p.key}')" style="position:absolute;top:60px;right:14px;z-index:5;width:40px;height:40px;border-radius:50%;background:rgba(0,0,0,.5);backdrop-filter:blur(8px);color:#fff;font-size:18px;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;"><i class="fa-solid fa-volume-xmark"></i></button>`;
  } else if(p.imageURL){
    mediaBg=`<img src="${esc(p.imageURL)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" loading="lazy">`;
  } else {
    // Text-only post - gradient background
    const gradients=['linear-gradient(135deg,#1a1a2e,#16213e)','linear-gradient(135deg,#0f0c29,#302b63)','linear-gradient(135deg,#1a2a1a,#2d4a2d)','linear-gradient(135deg,#2d1b69,#11998e)','linear-gradient(135deg,#1a1200,#3d2b00)'];
    const grad=gradients[Math.abs(p.uid?.charCodeAt(0)||0)%gradients.length];
    mediaBg=`<div style="position:absolute;inset:0;background:${grad};display:flex;align-items:center;justify-content:center;padding:24px;"><div style="font-size:20px;color:#fff;font-weight:600;text-align:center;line-height:1.6;">${esc(p.text||'')}</div></div>`;
  }

  // Gradient overlay at bottom
  const overlay=`<div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.85) 0%,transparent 50%);pointer-events:none;"></div>`;

  // Bottom left — user info + caption (bottom:76px clears the floating nav bar)
  const bottomLeft=`<div style="position:absolute;bottom:76px;left:14px;right:80px;z-index:2;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;" onclick="viewUserProfile('${esc(p.uid)}')">
      <img src="${esc(p.photoURL||avUrl(p.username||'U'))}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid #fff;">
      <div><div style="font-weight:700;color:#fff;font-size:14px;display:flex;align-items:center;">${esc(getDisplayName(p.uid,p.username))}${vbadge}</div><div style="font-size:11px;color:rgba(255,255,255,.7);">${esc(p.time||'')}</div></div>
    </div>
    ${p.text&&(p.imageURL||p.videoURL)?`<div style="color:#fff;font-size:14px;line-height:1.5;text-shadow:0 1px 3px rgba(0,0,0,.8);">${esc(p.text.substring(0,120))}${p.text.length>120?'…':''}</div>`:''}
    <div style="margin-top:6px;display:flex;align-items:center;gap:6px;">
      <i class="fa-solid fa-eye" style="color:rgba(255,255,255,.5);font-size:11px;"></i>
      <span id="views-${p.key}" style="color:rgba(255,255,255,.5);font-size:11px;">${Object.keys(p.views||{}).length} views</span>
    </div>
  </div>`;

  // Right side — action buttons (TikTok style), bottom:76px clears the floating nav bar
  const rightBtns=`<div style="position:absolute;bottom:76px;right:12px;z-index:2;display:flex;flex-direction:column;align-items:center;gap:18px;">
    <div style="text-align:center;">
      <button onclick="toggleFeedLike('${p.key}')" id="like-btn-${p.key}" data-liked="${liked?'1':'0'}" style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.15);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;color:${liked?'#ef4444':'#fff'};font-size:22px;"><i class="fa-${liked?'solid':'regular'} fa-heart"></i></button>
      <div id="like-count-${p.key}" style="color:#fff;font-size:12px;margin-top:4px;font-weight:600;">${likeCount||''}</div>
    </div>
    <div style="text-align:center;">
      <button onclick="openFeedComments('${p.key}')" style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.15);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;"><i class="fa-regular fa-comment"></i></button>
      <div style="color:#fff;font-size:12px;margin-top:4px;font-weight:600;">${commentCount||''}</div>
    </div>
    <div style="text-align:center;">
      <button onclick="shareFeedPost('${p.key}','${esc(p.text||'')}')" style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.15);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;"><i class="fa-solid fa-share-nodes"></i></button>
    </div>
    <div style="text-align:center;">
      <button onclick="toggleBookmark('${p.key}')" id="bm-${p.key}" style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.15);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;color:${isBookmarked(p.key)?'#f59e0b':'#fff'};font-size:20px;"><i class="fa-${isBookmarked(p.key)?'solid':'regular'} fa-bookmark"></i></button>
    </div>
    ${p.uid===me?.uid?`<div style="text-align:center;"><button onclick="deleteFeedPost('${p.key}')" style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.15);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;"><i class="fa-solid fa-trash"></i></button></div>`:''}
  </div>`;

  const musicHtml=p.music?.url?`<audio id="fm-${p.key}" src="${esc(p.music.url)}" loop style="display:none;"></audio><div style="position:absolute;top:14px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.5);color:#fff;font-size:12px;padding:5px 12px;border-radius:20px;display:flex;align-items:center;gap:6px;z-index:2;"><i class="fa-solid fa-music"></i> ${esc(p.music.title||'Music')}</div>`:'';

  wrap.innerHTML=mediaBg+overlay+bottomLeft+rightBtns+musicHtml;
  if(p.videoURL||p.music?.url)ensureFeedObserver().observe(wrap);
  // Record view + watch live view count — uses a SEPARATE path from
  // feed_posts on purpose. Writing under feed_posts/{key}/views used to
  // retrigger loadFeed()'s own listener on feed_posts (which watches the
  // whole tree), causing list.innerHTML='' to wipe and rebuild the entire
  // feed on every single view recorded — resetting scroll to the top
  // every time, which is why it looked "stuck" on the first post no
  // matter how far you scrolled.
  if(me&&p.uid!==me.uid)db.ref(`feed_post_views/${p.key}/${me.uid}`).set(true);
  db.ref(`feed_post_views/${p.key}`).on('value',snap=>{
    const el=document.getElementById(`views-${p.key}`);
    if(el)el.textContent=`${Object.keys(snap.val()||{}).length} views`;
  });
  return wrap;
}

function previewPostMedia(input,type){
  const file=input.files[0];if(!file)return;
  const prev=$('post-media-prev');const imgP=$('post-img-prev');const vidP=$('post-vid-prev');
  if(prev)prev.style.display='block';
  if(type==='image'){if(imgP)imgP.style.display='block';if(vidP)vidP.style.display='none';const r=new FileReader();r.onload=e=>{if(imgP)imgP.src=e.target.result;};r.readAsDataURL(file);}
  else{if(vidP){vidP.style.display='block';vidP.src=URL.createObjectURL(file);}if(imgP)imgP.style.display='none';}
}
function clearPostMedia(){
  const prev=$('post-media-prev');if(prev)prev.style.display='none';
  ['post-img-prev','post-vid-prev'].forEach(id=>{const el=$(id);if(el){el.src='';el.style.display='none';}});
  ['post-img-inp','post-vid-inp'].forEach(id=>{const el=$(id);if(el)el.value='';});
}
function previewPostImg(input){previewPostMedia(input,'image');}
async function createFeedPost(){
  const text=$('post-text-inp')?.value.trim();
  const imgFile=$('post-img-inp')?.files[0];
  const vidFile=$('post-vid-inp')?.files[0];
  if(!text&&!imgFile&&!vidFile)return toast('Write something or add media','error');
  if(!me)return toast('Not logged in','error');
  const pendingMusic=_feedPostMusicData; // captured up front, before any await
  const btn=document.querySelector('#create-post-modal .modal-box button:last-child');
  if(btn){btn.disabled=true;btn.textContent='Posting…';}
  let imageURL='',videoURL='';
  try{
    if(imgFile){const c=await compressImage(imgFile,1080,.82);imageURL=await uploadCld(c);}
    if(vidFile){videoURL=await uploadCld(vidFile);}
  }catch(e){
    toast('Media upload failed. Try a smaller file.','error');
    if(btn){btn.disabled=false;btn.textContent='Share Post';}return;
  }
  const feedPayload={uid:me.uid,username:me.username,photoURL:me.photoURL||'',mkjNumber:me.mkjNumber||'',text:text||'',imageURL,videoURL,time:ts(),timestamp:Date.now(),likes:{},comments:{}};
  if(pendingMusic?.url)feedPayload.music={url:pendingMusic.url,title:pendingMusic.title||'Music'};
  await db.ref('feed_posts').push(feedPayload);
  $('post-text-inp').value='';clearPostMedia();clearFeedMusic();
  if(btn){btn.disabled=false;btn.textContent='Share Post';}
  closeModal('create-post-modal');toast('Posted! ✅','success');earnPoints(3,'post');
}
function toggleFeedLike(postKey){
  if(!me)return;
  const btn=document.getElementById(`like-btn-${postKey}`);
  const countEl=document.getElementById(`like-count-${postKey}`);
  db.ref(`feed_posts/${postKey}/likes/${me.uid}`).once('value').then(s=>{
    const wasLiked=!!s.val();
    if(wasLiked){
      db.ref(`feed_posts/${postKey}/likes/${me.uid}`).remove();
    }else{
      db.ref(`feed_posts/${postKey}/likes/${me.uid}`).set(true);earnPoints(2,'like');
      db.ref(`feed_posts/${postKey}/uid`).once('value').then(us=>{
        const o=us.val();if(o&&o!==me.uid)db.ref(`notifications/${o}`).push({type:'reaction',from:me.uid,fromName:me.username,timestamp:Date.now()});
      });
    }
    // Reflect the new state immediately, without waiting on any feed listener
    const nowLiked=!wasLiked;
    if(btn){
      btn.dataset.liked=nowLiked?'1':'0';
      btn.style.color=nowLiked?'#ef4444':'#fff';
      const icon=btn.querySelector('i');
      if(icon)icon.className=`fa-${nowLiked?'solid':'regular'} fa-heart`;
    }
    if(countEl){
      const current=parseInt(countEl.textContent||'0')||0;
      const next=Math.max(0,current+(nowLiked?1:-1));
      countEl.textContent=next>0?next:'';
    }
  });
}
function deleteFeedPost(postKey){
  const m=document.createElement('div');m.className='modal-bg';m.style.zIndex='600';
  m.innerHTML=`<div class="modal-box"><div style="font-size:17px;font-weight:700;color:var(--t1);margin-bottom:14px;">Delete this post?</div><div style="display:flex;gap:8px;"><button onclick="this.closest('.modal-bg').remove()" style="flex:1;padding:12px;background:var(--s2);border-radius:10px;color:var(--t1);font-weight:600;">Cancel</button><button onclick="db.ref('feed_posts/${postKey}').remove();this.closest('.modal-bg').remove();toast('Post deleted','info')" style="flex:1;padding:12px;background:var(--red);border-radius:10px;color:#fff;font-weight:700;">Delete</button></div></div>`;
  document.body.appendChild(m);
}
function openFeedComments(postKey){
  const modal=document.createElement('div');modal.className='modal-bg';modal.style.zIndex='500';
  modal.onclick=e=>{if(e.target===modal)modal.remove();};
  modal.innerHTML=`<div class="modal-box" style="max-height:80vh;overflow-y:auto;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><span style="font-weight:700;color:var(--t1);font-size:16px;">Comments</span><button onclick="this.closest('.modal-bg').remove()" style="color:var(--t2);font-size:26px;">×</button></div>
    <div id="clist-${postKey}" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;min-height:40px;"></div>
    <div style="display:flex;gap:8px;">
      <input id="cinp-${postKey}" placeholder="Add a comment…" style="flex:1;padding:10px;background:var(--s2);border-radius:10px;font-size:14px;color:var(--t1);border:none;" onkeydown="if(event.key==='Enter')addFeedComment('${postKey}',this.closest('.modal-bg'))">
      <button onclick="addFeedComment('${postKey}',this.closest('.modal-bg'))" style="padding:10px 14px;background:var(--g);border-radius:10px;color:#fff;font-weight:700;">Post</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  db.ref(`feed_posts/${postKey}/comments`).on('value',snap=>{
    const list=modal.querySelector(`#clist-${postKey}`);if(!list)return;list.innerHTML='';
    const entries=Object.values(snap.val()||{});
    if(!entries.length){list.innerHTML='<div style="color:var(--t2);font-size:13px;text-align:center;padding:12px;">No comments yet</div>';return;}
    entries.sort((a,b)=>(a.timestamp||0)-(b.timestamp||0)).forEach(c=>{
      const d=document.createElement('div');d.className='feed-comment-item';
      d.innerHTML=`<img src="${esc(c.photoURL||avUrl(c.username||'U'))}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;flex-shrink:0;">
        <div style="flex:1;"><div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;"><span style="font-size:13px;font-weight:700;color:var(--g);">${esc(getDisplayName(c.uid,c.username))}</span><span style="font-size:10px;color:var(--t2);">${ago(c.timestamp)}</span></div><div style="font-size:14px;color:var(--t1);line-height:1.4;">${esc(c.text||'')}</div></div>`;
      list.appendChild(d);
    });
  });
}
function addFeedComment(postKey,modal){
  const inp=modal?.querySelector(`#cinp-${postKey}`);if(!inp||!inp.value.trim()||!me)return;
  const text=inp.value.trim();
  db.ref(`feed_posts/${postKey}/comments`).push({uid:me.uid,username:me.username,photoURL:me.photoURL||'',text,timestamp:Date.now()});
  inp.value='';earnPoints(1,'comment');
  // Notify post owner
  db.ref(`feed_posts/${postKey}/uid`).once('value').then(s=>{
    const ownerUid=s.val();
    if(ownerUid&&ownerUid!==me.uid)db.ref(`notifications/${ownerUid}`).push({type:'comment',fromUid:me.uid,fromName:me.username,fromPhoto:me.photoURL||'',preview:text.substring(0,60),timestamp:Date.now()});
  });
}
function shareFeedPost(key,text){
  const url=`${location.origin}${location.pathname}?post=${key}`;
  if(navigator.share)navigator.share({title:'MKJ Post',text:text||'Check this on MKJ',url});
  else navigator.clipboard?.writeText(url).then(()=>toast('Link copied 🔗','success'));
}
// ══ FEATURE B: NOTIFICATIONS CENTER ═══════════════════════════════
let _notifRef=null;
function startNotifListener(){
  if(!me||_notifRef)return;
  _notifRef=db.ref(`notifications/${me.uid}`).orderByChild('timestamp').limitToLast(50);
  _notifRef.on('value',snap=>{
    const data=snap.val()||{};const count=Object.keys(data).length;
    const badge=$('notif-bell-badge');if(badge){badge.textContent=count;badge.classList.toggle('hidden',count===0);}
  });
}
function openNotifCenter(){
  openModal('notif-center-modal');
  const list=$('notif-list');if(!list)return;list.innerHTML='';
  db.ref(`notifications/${me?.uid}`).orderByChild('timestamp').limitToLast(30).once('value').then(snap=>{
    const data=snap.val()||{};const items=Object.entries(data).sort((a,b)=>b[1].timestamp-a[1].timestamp);
    if(!items.length){list.innerHTML='<div style="text-align:center;padding:24px;color:var(--t2);font-size:13px;">No notifications yet</div>';return;}
    items.forEach(([key,n])=>{
      const div=document.createElement('div');div.className='notif-item';
      const icons={status_react:'❤️',mention:'@',birthday:'🎂',channel_post:'📡',reaction:'😊'};
      div.innerHTML=`<span style="font-size:24px;">${icons[n.type]||'🔔'}</span><div style="flex:1;"><div style="font-size:14px;color:var(--t1);">${esc(n.fromName||'Someone')} ${getNotifText(n.type)}</div><div style="font-size:11px;color:var(--t2);">${ago(n.timestamp)}</div></div>`;
      div.onclick=()=>{closeModal('notif-center-modal');if(n.fromUid)db.ref(`users/${n.fromUid}`).once('value').then(s=>{const u=s.val()||{};openPrivate(n.fromUid,u.username||'User',u.mkjNumber||'',u.photoURL||'');});};
      list.appendChild(div);
    });
    // Mark all read - remove badge
    db.ref(`notifications/${me?.uid}`).remove();
    const badge=$('notif-bell-badge');if(badge)badge.classList.add('hidden');
  });
}
function getNotifText(type){const map={status_react:'reacted to your status',mention:'mentioned you',birthday:'has a birthday today!',channel_post:'posted in a channel',reaction:'reacted to your message'};return map[type]||'sent you a notification';}

// ══ FEATURE C: QUICK REPLIES ═══════════════════════════════════════
const DEFAULT_QUICK=['On my way! 🚗','Busy right now, will reply later 🙏','Sounds good! 👍','Let me check and get back to you','Call me when you can 📞'];
function getQuickReplies(){return JSON.parse(localStorage.getItem(`quick_${me?.uid}`)||JSON.stringify(DEFAULT_QUICK));}
function openQuickReplies(){
  const qr=$('quick-row');if(!qr)return;
  const showing=!qr.classList.contains('hidden');
  if(showing){qr.classList.add('hidden');return;}
  qr.innerHTML='';qr.classList.remove('hidden');
  getQuickReplies().forEach(r=>{
    const chip=document.createElement('button');chip.className='quick-chip';chip.textContent=r;
    chip.onclick=()=>{
      const inp=curView==='private'?$('p-inp'):curView==='group'?$('grp-inp'):$('g-inp');
      if(inp){inp.value=r;autoResize(inp);}qr.classList.add('hidden');
    };
    qr.appendChild(chip);
  });
}
function renderQuickReplies(){
  const list=$('quick-replies-list');if(!list)return;list.innerHTML='';
  getQuickReplies().forEach((r,i)=>{
    const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:8px;background:var(--s2);border-radius:10px;padding:10px 12px;';
    row.innerHTML=`<span style="flex:1;font-size:14px;color:var(--t1);">${esc(r)}</span><button onclick="deleteQuickReply(${i})" style="color:var(--red);font-size:14px;"><i class="fa-solid fa-trash"></i></button>`;
    list.appendChild(row);
  });
}
function addQuickReply(){
  const inp=$('new-quick-inp');if(!inp||!inp.value.trim())return;
  const list=getQuickReplies();list.push(inp.value.trim());
  localStorage.setItem(`quick_${me?.uid}`,JSON.stringify(list));inp.value='';renderQuickReplies();toast('Quick reply added ⚡','success');
}
function deleteQuickReply(i){
  const list=getQuickReplies();list.splice(i,1);localStorage.setItem(`quick_${me?.uid}`,JSON.stringify(list));renderQuickReplies();
}

// ══ FEATURE D: MESSAGE DRAFTS ══════════════════════════════════════
function saveDraft(chatId,text){
  if(!me)return;
  const key=`draft_${me.uid}_${chatId}`;
  if(text.trim())localStorage.setItem(key,text);
  else localStorage.removeItem(key);
}
function getDraft(chatId){return me?localStorage.getItem(`draft_${me.uid}_${chatId}`)||'':'';}
function loadDraftToInp(chatId,inpId){
  const draft=getDraft(chatId);const inp=$(inpId);
  if(draft&&inp){inp.value=draft;autoResize(inp);}
}

// ══ FEATURE E: CHAT STATISTICS ════════════════════════════════════
async function openChatStats(){
  openModal('chat-stats-modal');
  const content=$('chat-stats-content');if(!content)return;
  content.innerHTML='<div style="text-align:center;padding:20px;color:var(--t2);">Calculating…</div>';
  if(!chatId||!me){content.innerHTML='<div style="color:var(--t2);text-align:center;padding:20px;">Open a chat first</div>';return;}
  const snap=await db.ref(`private_chats/${chatId}`).orderByChild('timestamp').limitToLast(500).once('value');
  const msgs=[];snap.forEach(s=>msgs.push(s.val()));
  const total=msgs.length;const mine=msgs.filter(m=>m.uid===me.uid).length;const theirs=total-mine;
  const wordCount={};msgs.forEach(m=>(m.text||'').toLowerCase().split(/\s+/).forEach(w=>{if(w.length>3)wordCount[w]=(wordCount[w]||0)+1;}));
  const topWords=Object.entries(wordCount).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const hourCounts=new Array(24).fill(0);msgs.forEach(m=>{if(m.timestamp)hourCounts[new Date(m.timestamp).getHours()]++;});
  const peakHour=hourCounts.indexOf(Math.max(...hourCounts));
  const firstMsg=msgs[0];const dayCount=firstMsg?Math.ceil((Date.now()-firstMsg.timestamp)/86400000):0;
  const myPct=total>0?Math.round(mine/total*100):50;
  content.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
      <div style="background:var(--s2);border-radius:12px;padding:12px;text-align:center;"><div style="font-size:28px;font-weight:800;color:var(--g);">${total}</div><div style="font-size:12px;color:var(--t2);">Total Messages</div></div>
      <div style="background:var(--s2);border-radius:12px;padding:12px;text-align:center;"><div style="font-size:28px;font-weight:800;color:var(--blue);">${dayCount}</div><div style="font-size:12px;color:var(--t2);">Days Together</div></div>
    </div>
    <div style="background:var(--s2);border-radius:12px;padding:12px;margin-bottom:10px;">
      <div style="font-size:13px;color:var(--t2);margin-bottom:8px;">Who sends more?</div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--t2);margin-bottom:4px;"><span>You (${mine})</span><span>Them (${theirs})</span></div>
      <div class="stat-bar"><div class="stat-fill" style="width:${myPct}%;"></div></div>
      <div style="font-size:11px;color:var(--t2);margin-top:4px;">You send ${myPct}% of messages</div>
    </div>
    <div style="background:var(--s2);border-radius:12px;padding:12px;margin-bottom:10px;">
      <div style="font-size:13px;color:var(--t2);margin-bottom:6px;">⏰ Most active at ${peakHour}:00–${peakHour+1}:00</div>
      <div style="font-size:13px;color:var(--t2);">🔤 Top words: ${topWords.map(([w])=>w).join(', ')||'—'}</div>
    </div>
    <div style="background:var(--s2);border-radius:12px;padding:12px;">
      <div style="font-size:13px;color:var(--t2);">📅 First message: ${firstMsg?new Date(firstMsg.timestamp).toLocaleDateString():'—'}</div>
    </div>`;
}

// ══ FEATURE F: CHAT THEMES ════════════════════════════════════════
const CHAT_THEMES=[
  {name:'Default',bg:'transparent',mine:'#005c4b',theirs:'#1f2c34'},
  {name:'Ocean',bg:'linear-gradient(135deg,#0f2027,#203a43,#2c5364)',mine:'#0077b6',theirs:'#023e8a'},
  {name:'Sunset',bg:'linear-gradient(135deg,#2d1b69,#8b1a6b,#ff6b35)',mine:'#c77dff',theirs:'#4a0072'},
  {name:'Forest',bg:'linear-gradient(135deg,#1a2f1a,#2d4a2d,#1a3a1a)',mine:'#40916c',theirs:'#1b4332'},
  {name:'Rose',bg:'linear-gradient(135deg,#3a1a2a,#6b2d4a,#8b1a3a)',mine:'#e63946',theirs:'#9d0208'},
  {name:'Midnight',bg:'#0a0a0a',mine:'#4361ee',theirs:'#1a1a2e'},
  {name:'Gold',bg:'linear-gradient(135deg,#1a1200,#3d2b00,#6b4c00)',mine:'#d4a017',theirs:'#5c3d02'},
  {name:'Ice',bg:'linear-gradient(135deg,#e0f4ff,#b8e0ff,#90c7ff)',mine:'#0077b6',theirs:'#caf0f8'},
];
let selectedTheme=null;
function openChatTheme(){
  openModal('chat-theme-modal');
  const sw=$('theme-swatches');if(!sw)return;sw.innerHTML='';
  const curTheme=localStorage.getItem(`theme_${chatId||curGid}`);
  CHAT_THEMES.forEach((t,i)=>{
    const div=document.createElement('div');
    div.style.cssText=`width:48px;height:48px;border-radius:12px;cursor:pointer;background:${t.bg||t.mine};border:3px solid ${curTheme===t.name?'#fff':'transparent'};display:flex;align-items:center;justify-content:center;flex-direction:column;gap:2px;`;
    div.innerHTML=`<span style="font-size:10px;color:#fff;font-weight:700;text-shadow:0 1px 3px rgba(0,0,0,.8);">${t.name}</span>`;
    div.onclick=()=>{selectedTheme=t;sw.querySelectorAll('div').forEach(d=>d.style.borderColor='transparent');div.style.borderColor='#fff';};
    sw.appendChild(div);
  });
}
function applyChatTheme(){
  if(!selectedTheme)return toast('Pick a theme first','error');
  const id=chatId||curGid;if(!id)return;
  localStorage.setItem(`theme_${id}`,selectedTheme.name);
  const msgs=$('priv-msgs')||$('group-msgs');
  if(msgs)msgs.style.background=selectedTheme.bg||'';
  closeModal('chat-theme-modal');toast(`Theme "${selectedTheme.name}" applied 🎨`,'success');
}

// ══ FEATURE G: SCHEDULING CALENDAR VIEW ════════════════════════════
function renderSchedList(){
  const list=$('sched-list-view');if(!list)return;list.innerHTML='';
  if(!scheduledMsgs.length){list.innerHTML='<div style="text-align:center;padding:20px;color:var(--t2);font-size:13px;">No scheduled messages</div>';return;}
  scheduledMsgs.forEach((s,i)=>{
    const div=document.createElement('div');div.style.cssText='background:var(--s2);border-radius:12px;padding:12px;display:flex;align-items:center;gap:10px;';
    div.innerHTML=`<div style="flex:1;"><div style="font-size:14px;color:var(--t1);margin-bottom:2px;">${esc(s.msg)}</div><div style="font-size:12px;color:var(--g);">📅 ${new Date(s.sendAt).toLocaleString()}</div><div style="font-size:11px;color:var(--t2);">→ ${esc(s.targetUsername||s.groupName||s.chatType||'')}</div></div>
    <button onclick="cancelSched(${i})" style="color:var(--red);font-size:14px;padding:6px;"><i class="fa-solid fa-xmark"></i></button>`;
    list.appendChild(div);
  });
}
function cancelSched(i){
  scheduledMsgs.splice(i,1);localStorage.setItem('sched_msgs',JSON.stringify(scheduledMsgs));renderSchedList();toast('Scheduled message cancelled','info');
}

// ══ FEATURE H: CHAT BACKUP & EXPORT ═══════════════════════════════
async function exportChat(){
  if(!chatId||!chatTarget||!me)return toast('Open a chat first','error');
  toast('Preparing export…','info');
  const snap=await db.ref(`private_chats/${chatId}`).orderByChild('timestamp').once('value');
  let txt=`MKJ Chat Export\nChat with: ${chatTarget.username} (#${chatTarget.mkjNumber})\nExported: ${new Date().toLocaleString()}\n${'─'.repeat(50)}\n\n`;
  snap.forEach(s=>{const m=s.val();txt+=`[${m.time||''}] ${m.username||'?'}: ${m.text||'[media]'}\n`;});
  const blob=new Blob([txt],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`mkj_chat_${chatTarget.username}_${Date.now()}.txt`;a.click();
  toast('Chat exported ✓','success');
}

// ══ FEATURE I: TYPING SPEED INDICATOR ═════════════════════════════
const _typingSpeeds={};
function trackTypingSpeed(chatType,uid){
  const now=Date.now();const key=`${chatType}_${uid}`;
  const last=_typingSpeeds[key];
  if(last&&now-last<500)_typingSpeeds[`${key}_fast`]=(_typingSpeeds[`${key}_fast`]||0)+1;
  _typingSpeeds[key]=now;
}
function getTypingLabel(uid,chatType){
  const fastCount=_typingSpeeds[`${chatType}_${uid}_fast`]||0;
  if(fastCount>5)return'typing fast ✍️';
  if(fastCount>2)return'typing…';
  return'typing slowly…';
}

// ══ FEATURE J: AUTO-DELETE AFTER READ ═════════════════════════════
function sendAutoDeleteMsg(text,chatType){
  if(!me)return;
  const msg={uid:me.uid,username:me.username,mkjNumber:me.mkjNumber,photoURL:me.photoURL,text,time:ts(),timestamp:Date.now(),type:'text',autoDelete:true,lang:getMyPreferredLanguage()};
  if(chatType==='private'&&chatId)db.ref(`private_chats/${chatId}`).push(msg);
  else if(chatType==='group'&&curGid)db.ref(`group_messages/${curGid}`).push(msg);
  toast('Message will delete after read 👁','info');
}
function checkAutoDelete(msgEl,key,chatType){
  if(!msgEl)return;
  const observer=new IntersectionObserver(entries=>{
    if(entries[0].isIntersecting){
      observer.disconnect();
      setTimeout(()=>{
        let ref;
        if(chatType==='private'&&chatId)ref=db.ref(`private_chats/${chatId}/${key}`);
        else if(chatType==='group'&&curGid)ref=db.ref(`group_messages/${curGid}/${key}`);
        if(ref)ref.remove();
        msgEl.style.opacity='0';msgEl.style.transition='opacity .5s';setTimeout(()=>msgEl.remove(),500);
      },3000);
    }
  },{threshold:1.0});
  observer.observe(msgEl);
}

// ══ FEATURE K: CUSTOM NOTIFICATION SOUNDS PER CONTACT ═════════════
const CONTACT_SOUNDS=['default','chime','ping','pop','silent'];
function setContactSound(uid,sound){
  localStorage.setItem(`csound_${uid}`,sound);toast(`Notification sound set for this contact`,'success');
}
function getContactSound(uid){return localStorage.getItem(`csound_${uid}`)||localStorage.getItem('notif_sound')||'default';}

// ══ FEATURE L: MINI-GAMES ═════════════════════════════════════════
function startGame(type){
  closeModal('games-modal');
  if(!chatTarget&&!curGid)return toast('Open a chat first to challenge someone','error');
  const game={type,state:'waiting',challenger:me.uid,challengerName:me.username,timestamp:Date.now()};
  let ref;
  if(chatId)ref=db.ref(`private_chats/${chatId}`);
  else if(curGid)ref=db.ref(`group_messages/${curGid}`);
  if(!ref)return;
  const gameRef=db.ref(`games/${me.uid}_${Date.now()}`);
  gameRef.set({...game,chatId,groupId:curGid});
  const msg={uid:me.uid,username:me.username,mkjNumber:me.mkjNumber,photoURL:me.photoURL,type:'game_invite',gameType:type,gameId:gameRef.key,time:ts(),timestamp:Date.now(),text:`🎮 ${me.username} challenges you to ${getGameName(type)}! Tap to play.`};
  ref.push(msg);toast(`Game invite sent! 🎮`,'success');
}
function getGameName(t){const n={ttt:'Tic-Tac-Toe',rps:'Rock Paper Scissors',number:'Number Battle',word:'Word Guess'};return n[t]||t;}
function openGameFromMsg(gameId,gameType){
  // Simple inline game modal
  const modal=document.createElement('div');modal.className='modal-bg';modal.style.zIndex='600';
  modal.onclick=e=>{if(e.target===modal)modal.remove();};
  let gameHTML='';
  if(gameType==='ttt')gameHTML=buildTTT(gameId,modal);
  else if(gameType==='rps')gameHTML=buildRPS(gameId,modal);
  else gameHTML=`<div style="color:var(--t2);text-align:center;padding:20px;">Game type: ${esc(gameType)}</div>`;
  modal.innerHTML=`<div class="modal-box"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;"><span style="font-weight:700;color:var(--t1);">${getGameName(gameType)}</span><button onclick="this.closest('.modal-bg').remove()" style="color:var(--t2);font-size:26px;">×</button></div>${gameHTML}</div>`;
  document.body.appendChild(modal);
}
function buildTTT(gameId,modal){
  let board=Array(9).fill('');let turn='X';let myMark=Math.random()>0.5?'X':'O';
  const render=()=>{
    const g=modal.querySelector('#ttt-board');if(!g)return;g.innerHTML='';
    board.forEach((cell,i)=>{const btn=document.createElement('button');btn.className='game-cell';btn.textContent=cell;btn.style.color=cell==='X'?'var(--g)':'var(--red)';btn.onclick=()=>{if(cell||turn!==myMark)return;board[i]=turn;turn=turn==='X'?'O':'X';checkTTT(board,modal);render();};g.appendChild(btn);});
  };
  setTimeout(render,100);
  return`<div style="text-align:center;margin-bottom:12px;font-size:13px;color:var(--t2);">You are <strong>${myMark}</strong></div><div id="ttt-board" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:280px;margin:0 auto;"></div>`;
}
function checkTTT(board,modal){
  const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for(const[a,b,c] of wins){if(board[a]&&board[a]===board[b]&&board[a]===board[c]){toast(`${board[a]} wins! 🎉`,'success');modal.remove();return;}}
  if(board.every(c=>c)){toast(`It's a draw! 🤝`,'info');modal.remove();}
}
function buildRPS(gameId,modal){
  const choices=['✊ Rock','✌️ Scissors','🤚 Paper'];
  return`<div style="text-align:center;margin-bottom:14px;color:var(--t2);">Pick your move:</div><div style="display:flex;gap:10px;justify-content:center;">${choices.map((c,i)=>`<button onclick="playRPS(${i},this.closest('.modal-bg'))" style="padding:12px 16px;background:var(--s2);border-radius:12px;font-size:20px;">${c}</button>`).join('')}</div>`;
}
function playRPS(myIdx,modal){
  const choices=['Rock','Scissors','Paper'];const aiIdx=Math.floor(Math.random()*3);
  const results=[[0,1,2],[2,0,1],[1,2,0]];const result=results[myIdx][aiIdx];
  const msg=result===0?`Draw! Both chose ${choices[myIdx]} 🤝`:result===1?`You win! ${choices[myIdx]} beats ${choices[aiIdx]} 🎉`:`AI wins! ${choices[aiIdx]} beats ${choices[myIdx]} 😔`;
  toast(msg,result===1?'success':'info');if(modal)modal.remove();
}

// ══ FEATURE M: COLLABORATIVE NOTES ════════════════════════════════
let _collabNoteRef=null;let _collabDebounce=null;
function openCollabNotes(){
  if(!chatId||!chatTarget)return toast('Open a private chat first','error');
  openModal('collab-notes-modal');
  const ta=$('collab-note-ta');const status=$('collab-note-status');
  if(_collabNoteRef)_collabNoteRef.off();
  _collabNoteRef=db.ref(`collab_notes/${chatId}`);
  _collabNoteRef.on('value',snap=>{
    const data=snap.val();
    if(data&&ta&&document.activeElement!==ta)ta.value=data.text||'';
    if(status)status.textContent='Synced ✓';
  });
}
function syncCollabNote(text){
  const status=$('collab-note-status');if(status)status.textContent='Saving…';
  clearTimeout(_collabDebounce);
  _collabDebounce=setTimeout(()=>{
    if(_collabNoteRef)_collabNoteRef.set({text,updatedBy:me?.uid,updatedAt:Date.now()}).then(()=>{if(status)status.textContent='Synced ✓';});
  },600);
}

// ══ FEATURE N: REACTIONS LEADERBOARD ══════════════════════════════
async function loadReactLeaderboard(){
  const list=$('react-leaderboard-list');if(!list)return;
  list.innerHTML='<div style="text-align:center;padding:20px;color:var(--t2);">Loading…</div>';
  const snap=await db.ref('reactions/global').once('value');
  const userReacts={};const userNames={};const userPhotos={};
  snap.forEach(msgSnap=>{
    msgSnap.forEach(reactSnap=>{
      // reactSnap.key = uid, reactSnap.val() = emoji
      // Need to count reactions received by each message author
    });
  });
  // Alternative: count reactions on community messages
  const msgSnap=await db.ref('global_chat').orderByChild('timestamp').limitToLast(200).once('value');
  const msgAuthors={};msgSnap.forEach(s=>{const m=s.val();if(m.uid&&!m.isAnon){msgAuthors[s.key]=m.uid;userNames[m.uid]=m.username||'User';userPhotos[m.uid]=m.photoURL||'';}});
  const reactSnap=await db.ref('reactions/global').once('value');
  reactSnap.forEach(msgR=>{const authorUid=msgAuthors[msgR.key];if(!authorUid)return;msgR.forEach(()=>{userReacts[authorUid]=(userReacts[authorUid]||0)+1;});});
  const sorted=Object.entries(userReacts).sort((a,b)=>b[1]-a[1]).slice(0,10);
  list.innerHTML='';const medals=['🥇','🥈','🥉'];
  sorted.forEach(([uid,count],i)=>{
    const row=document.createElement('div');row.className='leaderboard-row';
    row.innerHTML=`<span style="font-size:22px;width:32px;">${medals[i]||i+1}</span><img src="${esc(userPhotos[uid]||avUrl(userNames[uid]))}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;"><div style="flex:1;"><div style="color:var(--t1);font-weight:600;">${esc(getDisplayName(uid,userNames[uid]))}</div><div style="font-size:12px;color:var(--t2);">${count} reactions received</div></div>${uid===me?.uid?'<span style="font-size:11px;color:var(--g);padding:2px 8px;background:rgba(0,168,132,.1);border-radius:10px;">You</span>':''}`;
    list.appendChild(row);
  });
  if(!sorted.length)list.innerHTML='<div style="text-align:center;padding:20px;color:var(--t2);">No reaction data yet</div>';
}

// ══ FEATURE O: MKJ POINTS / REPUTATION ════════════════════════════
const LEVEL_THRESHOLDS=[{min:0,name:'Newcomer',icon:'🌱'},{min:50,name:'Regular',icon:'⭐'},{min:200,name:'Veteran',icon:'🔥'},{min:500,name:'Legend',icon:'👑'}];
function earnPoints(amount,reason){
  if(!me)return;
  const key=`points_${me.uid}`;const current=parseInt(localStorage.getItem(key)||'0');const next=current+amount;
  localStorage.setItem(key,next);
  db.ref(`users/${me.uid}/points`).set(next);
  // Check level up
  const prevLevel=getLevel(current);const nextLevel=getLevel(next);
  if(nextLevel.name!==prevLevel.name)toast(`🎉 Level up! You are now ${nextLevel.icon} ${nextLevel.name}!`,'success');
}
function getLevel(pts){return[...LEVEL_THRESHOLDS].reverse().find(l=>pts>=l.min)||LEVEL_THRESHOLDS[0];}
function getMyPoints(){return parseInt(localStorage.getItem(`points_${me?.uid}`)||me?.points||'0');}
function renderPoints(){
  const content=$('points-content');if(!content||!me)return;
  const pts=getMyPoints();const level=getLevel(pts);const nextLevel=LEVEL_THRESHOLDS.find(l=>l.min>pts)||level;
  const pct=nextLevel.min>level.min?Math.min(100,Math.round((pts-level.min)/(nextLevel.min-level.min)*100)):100;
  content.innerHTML=`<div style="text-align:center;margin-bottom:16px;"><div style="font-size:48px;margin-bottom:6px;">${level.icon}</div><div style="font-size:22px;font-weight:800;color:var(--t1);">${level.name}</div><div style="font-size:14px;color:var(--g);margin-top:4px;">${pts} points</div></div>
  <div class="points-bar"><div class="points-fill" style="width:${pct}%;"></div></div>
  <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--t2);margin-top:4px;"><span>${pts} pts</span><span>${nextLevel.min} pts → ${nextLevel.name} ${nextLevel.icon}</span></div>`;
}

// ══ FEATURE P: CEO MODERATION DASHBOARD ════════════════════════════
async function loadModDashboard(){
  if(!isCEO())return;
  // Stats
  const statsRow=$('mod-stats-row');if(statsRow){
    const [users,msgs,reports]=await Promise.all([
      db.ref('users').once('value'),db.ref('global_chat').once('value'),db.ref('reports').once('value')
    ]);
    const statData=[{icon:'👥',label:'Total Users',value:Object.keys(users.val()||{}).length},{icon:'💬',label:'Community Msgs',value:Object.keys(msgs.val()||{}).length},{icon:'🚩',label:'Reports',value:Object.keys(reports.val()||{}).length},{icon:'📡',label:'Channels',value:0}];
    statsRow.innerHTML=statData.map(s=>`<div style="background:var(--s2);border-radius:12px;padding:12px;text-align:center;"><div style="font-size:24px;font-weight:800;color:var(--t1);">${s.value}</div><div style="font-size:11px;color:var(--t2);">${s.icon} ${s.label}</div></div>`).join('');
  }
  // Reports
  const repList=$('mod-reports-list');if(repList){
    const snap=await db.ref('reports').orderByChild('timestamp').limitToLast(20).once('value');
    const data=snap.val()||{};repList.innerHTML='';
    const entries=Object.entries(data).reverse();
    if(!entries.length)repList.innerHTML='<div style="color:var(--t2);font-size:13px;">No reports</div>';
    entries.forEach(([key,r])=>{
      const div=document.createElement('div');div.className='mod-item';
      div.innerHTML=`<div style="font-size:13px;color:var(--t1);margin-bottom:4px;">🚩 Report: <span style="color:var(--red);">${esc(r.reason||'')}</span></div>
        <div style="font-size:12px;color:var(--t2);margin-bottom:8px;">"${esc((r.text||'').substring(0,80))}"</div>
        <div style="display:flex;gap:8px;">
          <button onclick="deleteReportedMsg('${key}','${r.chatType||''}','${r.msgKey||''}','${r.chatId||''}')" style="padding:6px 12px;background:var(--red);border-radius:8px;color:#fff;font-size:12px;font-weight:600;">Delete Msg</button>
          <button onclick="db.ref('reports/${key}').remove();this.closest('.mod-item').remove()" style="padding:6px 12px;background:var(--s2);border-radius:8px;color:var(--t2);font-size:12px;">Dismiss</button>
        </div>`;
      repList.appendChild(div);
    });
  }
  // Users
  const userList=$('mod-users-list');if(userList){
    const snap=await db.ref('users').orderByChild('createdAt').limitToLast(20).once('value');
    const data=snap.val()||{};userList.innerHTML='';
    Object.entries(data).reverse().forEach(([uid,u])=>{
      const div=document.createElement('div');div.className='mod-item';
      div.innerHTML=`<div style="display:flex;align-items:center;gap:10px;">
        <img src="${esc(u.photoURL||avUrl(u.username))}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">
        <div style="flex:1;"><div style="font-size:13px;font-weight:600;color:var(--t1);">${esc(u.username||'User')}</div><div style="font-size:11px;color:var(--blue);">#${esc(u.mkjNumber||'')}</div></div>
        <button onclick="banUser('${uid}','${esc(u.username||'')}')" style="padding:4px 10px;background:rgba(239,68,68,.15);border-radius:8px;color:var(--red);font-size:11px;font-weight:600;">Ban</button>
      </div>`;
      userList.appendChild(div);
    });
  }
}
async function deleteReportedMsg(reportKey,chatType,msgKey,cid){
  if(!confirm('Delete this message?'))return;
  let ref;
  if(chatType==='global')ref=db.ref(`global_chat/${msgKey}`);
  else if(chatType==='private'&&cid)ref=db.ref(`private_chats/${cid}/${msgKey}`);
  else if(chatType==='group'&&cid)ref=db.ref(`group_messages/${cid}/${msgKey}`);
  if(ref)await ref.remove();
  await db.ref(`reports/${reportKey}`).remove();
  toast('Message deleted and report dismissed','success');
  loadModDashboard();
}
function banUser(uid,username){
  if(!confirm(`Ban ${username}? This will delete their account data.`))return;
  db.ref(`users/${uid}`).remove();db.ref(`blocks/${me.uid}/${uid}`).set(true);
  toast(`${username} has been banned`,'warn');loadModDashboard();
}

// ══ FEATURE Q: MULTIPLE ACCOUNTS ══════════════════════════════════
function renderAccounts(){
  const list=$('acct-list');if(!list)return;list.innerHTML='';
  const accounts=JSON.parse(localStorage.getItem('mkj_accounts')||'[]');
  if(me){
    const curr=document.createElement('div');curr.className='ci';curr.style.cssText='border-radius:12px;border:2px solid var(--g);';
    curr.innerHTML=`<img src="${esc(me.photoURL||avUrl(me.username))}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;"><div style="flex:1;"><div style="font-weight:700;color:var(--t1);">${esc(me.username||'')}</div><div style="font-size:12px;color:var(--g);">Active account</div></div>`;
    list.appendChild(curr);
  }
  accounts.filter(a=>a.uid!==me?.uid).forEach(a=>{
    const div=document.createElement('div');div.className='ci';div.style.cssText='border-radius:12px;cursor:pointer;';
    div.innerHTML=`<div style="width:44px;height:44px;border-radius:50%;background:var(--s2);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--t1);">${(a.username||'?')[0].toUpperCase()}</div><div style="flex:1;"><div style="font-weight:600;color:var(--t1);">${esc(a.username||'Account')}</div><div style="font-size:12px;color:var(--t2);">${esc(a.email||'')}</div></div><button onclick="switchToAccount('${a.uid}')" style="padding:6px 12px;background:var(--g);border-radius:8px;color:#fff;font-size:12px;font-weight:600;">Switch</button>`;
    list.appendChild(div);
  });
}
function addNewAccount(){closeModal('multi-acct-modal');if(me){const accounts=JSON.parse(localStorage.getItem('mkj_accounts')||'[]');if(!accounts.find(a=>a.uid===me.uid))accounts.push({uid:me.uid,username:me.username,email:me.email});localStorage.setItem('mkj_accounts',JSON.stringify(accounts));}auth.signOut();toast('Sign in with your other account','info');}
function switchToAccount(uid){toast('Signing out to switch…','info');auth.signOut();}

// ══ FEATURE R: DEEP LINKS ══════════════════════════════════════════
function openDeepLink(){
  openModal('deeplink-modal');
  const url=`${location.origin}${location.pathname}?u=${me?.mkjNumber}`;
  const el=$('deeplink-url');if(el)el.textContent=url;
}
function copyDeepLink(){const el=$('deeplink-url');if(el)navigator.clipboard?.writeText(el.textContent).then(()=>toast('Link copied! 🔗','success'));}
function shareDeepLink(){
  const url=`${location.origin}${location.pathname}?u=${me?.mkjNumber}`;
  if(navigator.share)navigator.share({title:`Chat with me on MKJ`,text:`Find me on MKJ Chat! #${me?.mkjNumber}`,url});
  else copyDeepLink();
}
function checkDeepLinkParam(){
  const mkj=new URLSearchParams(location.search).get('u');
  if(!mkj||!me)return;
  history.replaceState({},'',location.pathname);
  db.ref('users').orderByChild('mkjNumber').equalTo(mkj).once('value').then(snap=>{
    const data=snap.val();if(!data)return;
    const[uid,u]=Object.entries(data)[0];
    if(uid===me.uid)return;
    toast(`Opening profile of ${u.username}…`,'info');
    setTimeout(()=>openPrivate(uid,u.username,u.mkjNumber,u.photoURL),800);
  });
}

// ══ FEATURE S: PROFILE CEO BTN ════════════════════════════════════
function renderProfileCEOBtn(){
  const wrap=$('ceo-section-wrap');
  if(wrap)wrap.style.display=isCEO()?'block':'none';
  // Update points preview
  const prev=$('points-preview');
  if(prev&&me){const pts=getMyPoints();const level=getLevel(pts);prev.textContent=`${level.icon} ${level.name} · ${pts} points`;}
}

