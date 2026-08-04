// ══ STICKERS ═════════════════════════════════════════════════════
let stickerChat=null;
function openStickerPicker(ct){stickerChat=ct||_attachChat;buildStickerGrid();openModal('emoji-kb-modal');emojiKbTab('sticker');}
function buildStickerGrid(){
  const grid=$('sticker-grid-main');if(!grid)return;grid.innerHTML='';
  STICKERS.forEach(s=>{
    const d=document.createElement('div');d.className='sticker-item';d.textContent=s;
    d.onclick=()=>{sendSticker(s);closeModal('emoji-kb-modal');};grid.appendChild(d);
  });
}
function sendSticker(sticker){
  if(!me)return;
  const chat=stickerChat||ekbChat||_attachChat;
  const msg={uid:me.uid,username:me.username,mkjNumber:me.mkjNumber,photoURL:me.photoURL,text:sticker,time:ts(),timestamp:Date.now(),type:'sticker'};
  sendToRef(chat,msg,'[sticker]');
}

// ══ GIF PICKER ════════════════════════════════════════════════════
const GIPHY='dc6zaTOxFJmzC';let gifTimer=null;
function openGifPicker(ct){gifTarget=ct||_attachChat;openModal('gif-modal');loadGifsModal('');}
async function loadTrendingGifs(){
  const grid=$('gif-grid');if(!grid)return;grid.innerHTML='<p style="color:var(--t2);font-size:13px;text-align:center;width:100%;padding:16px;">Loading…</p>';
  try{const r=await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY}&limit=10&rating=g`);const d=await r.json();renderGifGrid(d.data,grid,ekbChat);}catch{grid.innerHTML='<p style="color:var(--t2);font-size:13px;text-align:center;width:100%;padding:16px;">Could not load GIFs</p>';}
}
function searchGifs(q){clearTimeout(gifTimer);if(!q){loadTrendingGifs();return;}gifTimer=setTimeout(async()=>{const grid=$('gif-grid');grid.innerHTML='Searching…';try{const r=await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY}&q=${encodeURIComponent(q)}&limit=10&rating=g`);const d=await r.json();renderGifGrid(d.data,grid,ekbChat);}catch{grid.innerHTML='Search failed';}},600);}
async function loadGifsModal(q){const grid=$('gif-results2');grid.innerHTML='<p style="color:var(--t2);font-size:13px;text-align:center;width:100%;padding:16px;">Loading…</p>';try{const url=q?`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY}&q=${encodeURIComponent(q)}&limit=12&rating=g`:`https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY}&limit=12&rating=g`;const r=await fetch(url);const d=await r.json();renderGifGrid(d.data,grid,gifTarget);}catch{grid.innerHTML='<p style="color:var(--t2);text-align:center;padding:16px;">Could not load</p>';}}
function searchGifsModal(q){clearTimeout(gifTimer);gifTimer=setTimeout(()=>loadGifsModal(q),600);}
function renderGifGrid(gifs,container,chatType){
  container.innerHTML='';if(!gifs?.length){container.innerHTML='<p style="color:var(--t2);font-size:13px;text-align:center;width:100%;padding:16px;">No GIFs found</p>';return;}
  gifs.forEach(g=>{
    const url=g.images.fixed_height_small.url;
    const div=document.createElement('div');div.className='gif-item';
    div.innerHTML=`<img src="${esc(url)}" loading="lazy" style="width:100%;display:block;">`;
    div.onclick=()=>{
      const msg={uid:me.uid,username:me.username,mkjNumber:me.mkjNumber,photoURL:me.photoURL,url,time:ts(),timestamp:Date.now(),type:'gif'};
      sendToRef(chatType||_attachChat,msg,'[GIF]');
      closeModal('gif-modal');closeModal('emoji-kb-modal');
      $('gif-search-inp')&&($('gif-search-inp').value='');
      $('gif-search-inp2')&&($('gif-search-inp2').value='');
    };container.appendChild(div);
  });
}

// ══ ATTACH ════════════════════════════════════════════════════════
function openAttach(chatType){_attachChat=chatType;openModal('attach-modal');}
function pickMedia(type){
  if(!me)return;closeModal('attach-modal');
  const chatType=_attachChat;
  const inp=document.createElement('input');inp.type='file';
  if(type==='image'||type==='gallery')inp.accept='image/*';
  else if(type==='video')inp.accept='video/*';
  else inp.accept='*/*';
  inp.onchange=async e=>{
    const f=e.target.files[0];if(!f)return;
    if(f.size>200*1024*1024)return toast('Max 200MB','error');
    toast('Uploading…','info');
    try{
      let file=f;if(f.type.startsWith('image/'))file=await compressImage(f);
      const url=await uploadCld(file);
      const msgType=f.type.startsWith('video/')?'video':f.type.startsWith('audio/')?'voice':'image';
      const msg={uid:me.uid,username:me.username,mkjNumber:me.mkjNumber,photoURL:me.photoURL,url,time:ts(),timestamp:Date.now(),type:type==='file'?'file':msgType};
      if(type==='file')msg.fileName=f.name;
      const rd=replyData[chatType];if(rd){msg.replyTo=rd;clearReply(chatType);}
      sendToRef(chatType,msg,type==='file'?`[${f.name}]`:`[${msgType}]`);
    }catch(err){toast('Upload failed','error');}
  };inp.click();
}

// ══ VOICE NOTES ══════════════════════════════════════════════════
async function startVoice(chatType){
  if(!me)return;const ct=chatType||_attachChat;closeModal('attach-modal');
  if(isRec){mRec?.stop();return;}
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    aChunks=[];mRec=new MediaRecorder(stream);recChat=ct;isRec=true;
    const icons={global:'g-send-icon',private:'p-send-icon',group:'grp-send-icon'};
    const icon=$(icons[ct]);if(icon){icon.className='fa-solid fa-stop';icon.parentElement.style.background='var(--red)';}
    toast('🔴 Recording… tap stop when done','info');
    mRec.ondataavailable=e=>aChunks.push(e.data);
    mRec.onstop=async()=>{
      isRec=false;stream.getTracks().forEach(t=>t.stop());
      const icon=$(icons[recChat]);if(icon){icon.className='fa-solid fa-microphone';icon.parentElement.style.background='var(--g)';}
      const blob=new Blob(aChunks,{type:'audio/webm'});
      toast('Sending…','info');
      try{
        const url=await uploadCld(new File([blob],'voice.webm',{type:'audio/webm'}));
        const msg={uid:me.uid,username:me.username,mkjNumber:me.mkjNumber,photoURL:me.photoURL,url,time:ts(),timestamp:Date.now(),type:'voice'};
        const rd=replyData[recChat];if(rd){msg.replyTo=rd;clearReply(recChat);}
        sendToRef(recChat,msg,'[voice]');
      }catch{toast('Upload failed','error');}
    };mRec.start();
  }catch{isRec=false;toast('Microphone access denied','error');}
}

// ══ REACTIONS ════════════════════════════════════════════════════
function doReactCore(key,chatType,em){
  if(!me)return;
  let ref;
  if(chatType==='global')ref=db.ref(`reactions/global/${key}/${me.uid}`);
  else if(chatType==='private')ref=db.ref(`reactions/private/${chatId}/${key}/${me.uid}`);
  else ref=db.ref(`reactions/group/${curGid}/${key}/${me.uid}`);
  ref.once('value').then(s=>{s.val()===em?ref.remove():ref.set(em);});
}
function pickReact(em){if(pickerKey)doReact(pickerKey,pickerChat,em);hidePicker();}

// ══ EMOJI PICKER CONTEXT ══════════════════════════════════════════
function showPicker(e,key,chatType,msg){
  pickerKey=key;pickerChat=chatType;pickerMsg=msg;
  const picker=$('emoji-picker');picker.classList.remove('hidden');
  $('ep-reply').onclick=()=>{startReply(msg,chatType);hidePicker();};
  $('ep-star').onclick=()=>{starMsg(msg,key,chatType);hidePicker();};
  $('ep-fwd').onclick=()=>{openForward(msg);hidePicker();};
  $('ep-pin').onclick=()=>{pinMsg(msg,key,chatType);hidePicker();};
  // Long-press "Translate" now drives the SAME inline toggle as the button under the message
  // (see toggleInlineTranslation below), instead of opening the old separate modal.
  $('ep-xlate').onclick=()=>{toggleInlineTranslation(key,chatType,msg);hidePicker();};
  $('ep-report').onclick=()=>{openReport(msg);hidePicker();};
  const isOwn=msg.uid===me?.uid;
  $('ep-del').style.display=isOwn?'flex':'none';
  $('ep-del').onclick=()=>{delMsg(key,chatType);hidePicker();};
  $('ep-edit').style.display=(isOwn&&msg.type==='text')?'flex':'none';
  $('ep-edit').onclick=()=>{editMsg(key,chatType,msg.text||'');hidePicker();};
}
function hidePicker(){$('emoji-picker').classList.add('hidden');}
document.addEventListener('touchstart',e=>{if(!$('emoji-picker').contains(e.target))hidePicker();},{passive:true});

// ══ REPLY ═════════════════════════════════════════════════════════
function startReply(msg,chatType){
  const rd={username:msg.username||me?.username,text:msg.text||'[media]'};
  replyData[chatType]=rd;
  const map={global:['g-reply-bar','g-rn','g-rt','g-inp'],private:['p-reply-bar','p-rn','p-rt','p-inp'],group:['grp-reply-bar','grp-rn','grp-rt','grp-inp']};
  const [barId,nameId,textId,inpId]=map[chatType]||[];
  if(barId){$(nameId).textContent=rd.username;$(textId).textContent=rd.text;$(barId).classList.remove('hidden');$(inpId)?.focus();}
}
function clearReply(chatType){
  replyData[chatType]=null;
  const bars={global:'g-reply-bar',private:'p-reply-bar',group:'grp-reply-bar'};
  $(bars[chatType])?.classList.add('hidden');
}

// ══ DELETE ════════════════════════════════════════════════════════
function delMsg(key,chatType){
  const modal=document.createElement('div');modal.className='modal-bg';modal.style.zIndex='600';
  modal.onclick=e=>{if(e.target===modal)modal.remove();};
  // Only show "delete for everyone" for own messages within 10 minutes
  const msgEl=document.querySelector(`[data-key="${key}"]`);
  const isOwn=pickerMsg?.uid===me?.uid;
  const within10min=pickerMsg?.timestamp&&(Date.now()-pickerMsg.timestamp)<600000;
  let btns=`<button onclick="delMsgForMe('${key}','${chatType}');this.closest('.modal-bg').remove()" style="width:100%;padding:13px;background:var(--s2);border-radius:10px;color:var(--t1);font-weight:600;margin-bottom:8px;text-align:left;display:flex;align-items:center;gap:10px;"><i class="fa-solid fa-user" style="color:var(--t2);width:18px;"></i>Delete for me</button>`;
  if(isOwn&&within10min)btns+=`<button onclick="delMsgForEveryone('${key}','${chatType}');this.closest('.modal-bg').remove()" style="width:100%;padding:13px;background:rgba(239,68,68,.1);border-radius:10px;color:var(--red);font-weight:700;margin-bottom:8px;text-align:left;display:flex;align-items:center;gap:10px;"><i class="fa-solid fa-users" style="width:18px;"></i>Delete for everyone</button>`;
  modal.innerHTML=`<div class="modal-box"><div style="font-size:17px;font-weight:700;color:var(--t1);margin-bottom:16px;">Delete message?</div>${btns}<button onclick="this.closest('.modal-bg').remove()" style="width:100%;padding:12px;background:none;border-radius:10px;color:var(--t2);font-weight:600;">Cancel</button></div>`;
  document.body.appendChild(modal);
}
function delMsgForMe(key,chatType){
  // Mark as deleted for this user only in localStorage
  const delKey=`deleted_${me?.uid}`;
  const deleted=JSON.parse(localStorage.getItem(delKey)||'[]');
  deleted.push(key);localStorage.setItem(delKey,JSON.stringify(deleted));
  // Hide the element in UI
  const el=document.querySelector(`[data-key="${key}"]`);
  if(el){el.style.opacity='0';el.style.transition='opacity .3s';setTimeout(()=>el.remove(),300);}
  toast('Message deleted for you','info');
}
async function delMsgForEveryone(key,chatType){
  let ref;
  if(chatType==='global')ref=db.ref(`global_chat/${key}`);
  else if(chatType==='private'&&chatId)ref=db.ref(`private_chats/${chatId}/${key}`);
  else if(chatType==='group'&&curGid)ref=db.ref(`group_messages/${curGid}/${key}`);
  if(!ref)return;
  // Replace content with deleted marker instead of removing
  await ref.update({text:'🚫 This message was deleted',type:'deleted',deleted:true,deletedAt:Date.now()});
  toast('Message deleted for everyone','info');
}
// Check if message is locally deleted
function isLocallyDeleted(key){
  const delKey=`deleted_${me?.uid}`;
  const deleted=JSON.parse(localStorage.getItem(delKey)||'[]');
  return deleted.includes(key);
}

// ══ SWIPE TO REPLY ════════════════════════════════════════════════
function addSwipeReply(el,msg,chatType){
  let startX=0,swiping=false,didSwipe=false;
  el.addEventListener('touchstart',e=>{startX=e.touches[0].clientX;swiping=true;didSwipe=false;},{passive:true});
  el.addEventListener('touchmove',e=>{
    if(!swiping)return;const dx=e.touches[0].clientX-startX;
    if(dx>10)didSwipe=true;
    if(dx>40&&dx<100){el.style.transform=`translateX(${dx*0.5}px)`;el.style.transition='none';}
  },{passive:true});
  el.addEventListener('touchend',e=>{
    if(!swiping)return;swiping=false;const dx=e.changedTouches[0].clientX-startX;
    el.style.transform='';el.style.transition='transform .2s';
    if(dx>60)startReply(msg,chatType);
  });
  el._didSwipe=()=>didSwipe;
}

// ══ DOUBLE TAP REACT ══════════════════════════════════════════════
function addDoubleTap(el,key,chatType){
  let lastTap=0;
  el.addEventListener('touchend',e=>{
    if(el._didSwipe&&el._didSwipe())return;
    const now=Date.now();if(now-lastTap<300){doReact(key,chatType,'❤️');}lastTap=now;
  },{passive:true});
}

// ══ INLINE MESSAGE TRANSLATION (WhatsApp-style show/hide under the bubble) ══
// Single translate flow for the whole app: called by the per-message "🌐 Translate"
// button AND by the long-press picker's "Translate" quick action, so there is only
// one code path to maintain and only one place the "already loaded" cache is checked.
//
// This function re-locates its DOM nodes twice on purpose: once before the network
// call, once after. Translating takes a second or two, and in that window the user
// can close the chat, reopen it, or the list can re-render — any of which detaches
// the bubble we found at the start. Writing into a detached node is invisible to the
// user (nothing on screen changes) even though the translation succeeded and got
// cached — that mismatch was the root cause of translations only ever appearing
// after a full app restart. Re-finding the live node right before writing fixes it.
function findXlateParts(key){
  const wrap=document.querySelector(`[data-key="${CSS.escape(key)}"]`);
  if(!wrap)return null;
  const btn=wrap.querySelector('.xlate-btn'),box=wrap.querySelector('.xlate-box');
  return (btn&&box)?{wrap,btn,box}:null;
}
async function toggleInlineTranslation(key,chatType,msg){
  let parts=findXlateParts(key);
  if(!parts){toast('Message not visible on screen','info');return;}
  const {btn,box}=parts;

  const targetLang=getMyPreferredLanguage();
  const alreadyShown=!box.classList.contains('hidden');
  const shownLang=box.dataset.lang||null; // which language the box currently displays, if any

  if(alreadyShown&&shownLang===targetLang){
    // Same language already on screen: just hide it, no network call needed.
    box.classList.add('hidden');
    btn.textContent='🌐 Translate';
    return;
  }
  // Otherwise we need a FRESH translation, either because nothing is shown yet, or
  // because the box is showing a translation in a language the user has since changed
  // away from in Settings (previously this just hid the old text instead of re-fetching).

  if(btn.disabled)return; // a request for this exact message is already in flight — ignore double-taps
  btn.disabled=true;
  box.classList.remove('hidden');
  box.textContent='Translating…';
  btn.textContent='Hide Translation';

  let translated=null,failed=false;
  try{
    translated=await translateMessageText(key,msg.text||'',msg,targetLang);
  }catch(err){
    failed=true;
  }

  // Re-find live nodes NOW, after the await — see comment above findXlateParts.
  // Falls back to the original (possibly detached) nodes only if the message has
  // truly vanished from every visible list, so we never throw on a null reference.
  parts=findXlateParts(key)||parts;
  parts.box.textContent=failed?'Translation unavailable.':translated;
  parts.box.classList.remove('hidden');
  if(!failed)parts.box.dataset.lang=targetLang; // remember what's shown, so future taps know whether to re-fetch
  parts.btn.textContent='Hide Translation';
  parts.btn.disabled=false;
}

// ══ MESSAGE RENDERER ══════════════════════════════════════════════
function makeMsgCore(msg,isMe,key,chatType,reactions,searchQ){
  const now=Date.now();
  if(msg.disappearAt&&msg.disappearAt<now)return null;
  if(isLocallyDeleted(key))return null;
  if(msg.deleted){
    const wrap=document.createElement('div');
    wrap.dataset.key=key;wrap.style.cssText=`display:flex;justify-content:${isMe?'flex-end':'flex-start'};padding:2px 12px;`;
    wrap.innerHTML=`<div style="font-size:13px;color:var(--t2);font-style:italic;padding:6px 12px;background:var(--s2);border-radius:10px;">🚫 This message was deleted</div>`;
    return wrap;
  }
  const wrap=document.createElement('div');
  wrap.style.cssText=`display:flex;flex-direction:column;${isMe?'align-self:flex-end;':'align-self:flex-start;'}max-width:82%;`;
  wrap.dataset.key=key;
  const bubble=document.createElement('div');bubble.className=isMe?'msg-out':'msg-in';
  addSwipeReply(bubble,msg,chatType);addDoubleTap(bubble,key,chatType);
  let html='';
  // Sender name + MKJ
  if(!isMe&&msg.username){
    const senderDisplayName=getDisplayName(msg.uid,msg.username);
    const clr=chatType==='global'?'color:var(--g);cursor:pointer;':'color:var(--g);';
    const click=chatType==='global'?`onclick="openPrivate('${esc(msg.uid)}','${esc(msg.username||'')}','${esc(msg.mkjNumber||'')}','${esc(msg.photoURL||'')}')"`:''
    const crown=(chatType==='global'&&msg.uid===CEO_UID)?'<span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;background:#1d9bf0;border-radius:50%;margin-left:3px;" title="MKJ Verified"><i class="fa-solid fa-check" style="color:#fff;font-size:9px;"></i></span>':'';
    html+=`<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;" ${click}>
      <span style="font-size:12px;font-weight:700;${clr}">${esc(senderDisplayName)}</span>${crown}
      <span style="font-size:10px;color:var(--blue);">#${esc(msg.mkjNumber||'')}</span>
    </div>`;
  }
  if(msg.forwarded)html+=`<div style="font-size:11px;color:var(--t2);margin-bottom:3px;"><i class="fa-solid fa-share" style="margin-right:3px;"></i>Forwarded</div>`;
  if(msg.scheduled)html+=`<div style="font-size:11px;color:var(--blue);margin-bottom:3px;"><i class="fa-solid fa-clock" style="margin-right:3px;"></i>Scheduled</div>`;
  if(msg.replyTo)html+=`<div style="background:rgba(0,0,0,.2);border-left:3px solid var(--g);border-radius:0 6px 6px 0;padding:5px 8px;margin-bottom:5px;font-size:11px;"><div style="color:var(--g);font-weight:600;">${esc(msg.replyTo.username||'')}</div><div style="color:var(--t2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;">${esc(msg.replyTo.text||'[media]')}</div></div>`;
  // Content
  if(msg.type==='image')html+=`<img src="${esc(msg.url)}" style="max-width:220px;border-radius:10px;display:block;cursor:pointer;" loading="lazy" onclick="window.open('${esc(msg.url)}','_blank')">`;
  else if(msg.type==='video')html+=`<video controls style="max-width:220px;border-radius:10px;display:block;"><source src="${esc(msg.url)}"></video>`;
  else if(msg.type==='voice')html+=`<div><audio controls src="${esc(msg.url)}" style="max-width:240px;" id="aud-${esc(key)}"></audio><br><button onclick="transcribeAudio('${esc(msg.url)}','${esc(key)}')" style="font-size:11px;color:var(--g);margin-top:4px;"><i class='fa-solid fa-waveform-lines' style='margin-right:3px;'></i>Transcribe</button><div id="tr-${esc(key)}" class="transcript-box hidden"></div></div>`;
  else if(msg.type==='gif')html+=`<img src="${esc(msg.url)}" style="max-width:220px;border-radius:10px;display:block;" loading="lazy">`;
  else if(msg.type==='file')html+=`<a href="${esc(msg.url)}" target="_blank" style="color:var(--blue);display:flex;align-items:center;gap:8px;text-decoration:none;padding:2px 0;"><i class="fa-solid fa-file" style="font-size:22px;"></i><span style="font-size:13px;word-break:break-all;">${esc(msg.fileName||'File')}</span></a>`;
  else if(msg.type==='sticker')html+=`<div style="font-size:52px;line-height:1;">${esc(msg.text)}</div>`;
  else if(msg.type==='game_invite')html+=`<div style="background:linear-gradient(135deg,var(--g),var(--dg));border-radius:12px;padding:12px;cursor:pointer;max-width:220px;" onclick="openGameFromMsg('${esc(msg.gameId||'')}','${esc(msg.gameType||'')}')"><div style="font-size:24px;margin-bottom:4px;">🎮</div><div style="color:#fff;font-weight:700;font-size:14px;">${esc(msg.text||'Game invite')}</div><div style="color:rgba(255,255,255,.8);font-size:12px;margin-top:4px;">Tap to play</div></div>`;
  else if(msg.type==='contact')html+=`<div class="contact-card" onclick="openPrivate('${esc(msg.contactUid)}','${esc(msg.contactUsername)}','${esc(msg.contactMKJ)}','${esc(msg.contactPhoto)}')"><img src="${esc(msg.contactPhoto||avUrl(msg.contactUsername))}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;"><div><div style="font-weight:700;color:var(--t1);font-size:14px;">${esc(msg.contactUsername||'User')}</div><div style="font-size:12px;color:var(--blue);">#${esc(msg.contactMKJ||'')}</div><div style="font-size:11px;color:var(--g);margin-top:2px;">Tap to chat →</div></div></div>`;
  else if(msg.type==='poll'){
    // Support both old pollOptions format and new options array
    if(msg.options){
      const total=msg.options.reduce((a,o)=>a+(o.votes?.length||0),0);
      html+=`<div style="min-width:200px;"><div style="font-weight:700;font-size:14px;margin-bottom:10px;">📊 ${esc(msg.question||'Poll')}</div>`;
      msg.options.forEach((o,idx)=>{
        const votes=o.votes||[];const pct=total>0?Math.round(votes.length/total*100):0;
        const voted=votes.includes(me?.uid);
        html+=`<div onclick="votePollNew('${esc(key)}',${idx},'${chatType}')" style="background:var(--s2);border-radius:10px;padding:10px;margin-bottom:6px;cursor:pointer;${voted?'border:1.5px solid var(--g);':''}">
          <div style="font-size:13px;color:var(--t1);margin-bottom:6px;">${esc(o.option)} ${voted?'✓':''}</div>
          <div style="background:var(--s1);border-radius:4px;height:6px;overflow:hidden;"><div style="background:var(--g);width:${pct}%;height:100%;border-radius:4px;transition:width .3s;"></div></div>
          <div style="font-size:11px;color:var(--t2);margin-top:4px;">${pct}% · ${votes.length} vote${votes.length!==1?'s':''}</div>
        </div>`;
      });
      html+=`<div style="font-size:11px;color:var(--t2);">${total} total vote${total!==1?'s':''}</div></div>`;
    } else {
      const opts=msg.pollOptions||{};const total=Object.values(opts).reduce((a,o)=>a+(o.count||0),0);
      html+=`<div style="min-width:180px;"><div style="font-weight:700;font-size:14px;margin-bottom:10px;">📊 ${esc(msg.pollQuestion||msg.text)}</div>`;
      Object.entries(opts).forEach(([idx,o])=>{
        const pct=total>0?Math.round((o.count||0)/total*100):0;const voted=o.voters&&me&&o.voters[me.uid];
        html+=`<div onclick="votePoll('${esc(key)}',${idx})" class="poll-opt-row" style="${voted?'border:1px solid var(--g);':''}cursor:pointer;"><div style="flex:1;"><div style="font-size:13px;color:var(--t1);margin-bottom:4px;">${esc(o.option)} ${voted?'✓':''}</div><div class="poll-bar-fill" style="width:${pct}%;"></div></div><span style="font-size:12px;color:var(--t2);margin-left:8px;">${pct}%</span></div>`;
      });
      html+=`<div style="font-size:11px;color:var(--t2);margin-top:6px;">${total} vote${total!==1?'s':''}</div></div>`;
    }
  }
  else{
    const textHtml=searchQ?highlightText(msg.text||'',searchQ):detectLinks(msg.text||'');
    html+=`<div style="font-size:var(--fs,15px);white-space:pre-wrap;line-height:1.5;color:var(--t1);">${textHtml}</div>`;
  }
  // Time + ticks
  html+=`<div style="display:flex;align-items:center;justify-content:flex-end;gap:4px;margin-top:4px;">
    ${msg.disappearAt?'<i class="fa-regular fa-clock" style="font-size:9px;color:rgba(255,255,255,.4);"></i>':''}
    <span style="font-size:10px;color:${isMe?'rgba(255,255,255,.5)':'var(--t2)'};">${esc(msg.time||'')}</span>
    ${isMe?`<span style="font-size:11px;color:${msg.readBy?'var(--blue)':'rgba(255,255,255,.4)'};">✓✓</span>`:''}
  </div>`;
  bubble.innerHTML=html;
  // ══ TRANSLATE BUTTON (received plain-text messages only) ══════════
  // Never shown for our own outgoing messages (spec: never auto-translate or offer to translate
  // what WE sent). Text messages in this app are sent with type:'text' explicitly — msg.type is
  // only unset for a few legacy/edge cases — so both are treated as "plain text" here.
  if(!isMe&&(!msg.type||msg.type==='text')){
    const xlateBtn=document.createElement('button');
    xlateBtn.className='xlate-btn';           // styled in style.css to look like WhatsApp's translate link
    xlateBtn.textContent='🌐 Translate';
    xlateBtn.onclick=(e)=>{
      e.stopPropagation();                    // don't trigger the bubble's long-press/reply handlers
      toggleInlineTranslation(key,chatType,msg);
    };
    const xlateBox=document.createElement('div');
    xlateBox.className='xlate-box hidden';     // hidden until the button is tapped
    bubble.appendChild(xlateBtn);
    bubble.appendChild(xlateBox);
  }
  // Long press
  let pt=null;
  bubble.addEventListener('touchstart',e=>{pt=setTimeout(()=>showPicker(e,key,chatType,msg),550);},{passive:true});
  bubble.addEventListener('touchend',()=>clearTimeout(pt));
  bubble.addEventListener('touchmove',()=>clearTimeout(pt),{passive:true});
  wrap.appendChild(bubble);
  // Reactions
  if(reactions&&Object.keys(reactions).length){
    const rDiv=document.createElement('div');rDiv.className='react-wrap';
    const counts={};Object.values(reactions).forEach(e=>{counts[e]=(counts[e]||0)+1;});
    const myR=reactions[me?.uid];
    Object.entries(counts).forEach(([em,cnt])=>{
      const chip=document.createElement('button');chip.className='react-chip'+(myR===em?' mine':'');
      chip.innerHTML=`${em}<span style="font-size:11px;color:var(--t2);margin-left:2px;">${cnt}</span>`;
      chip.onclick=()=>doReact(key,chatType,em);rDiv.appendChild(chip);
    });
    wrap.appendChild(rDiv);
  }
  // Auto-delete after read for non-sender
  if(msg.autoDelete&&!isMe)checkAutoDelete(wrap,key,chatType);
  return wrap;
}

// ══ SEND TO REF ═══════════════════════════════════════════════════
function sendToRef(chatType,msg,preview){
  if(msg.disappearAt===undefined&&disappearSetting)msg.disappearAt=Date.now()+disappearSetting*1000;
  if(chatType==='global'){
    db.ref('global_chat').push(msg).catch(err=>{console.error('[send] global_chat failed:',err);toast('Message failed to send: '+err.message,'error');});
  }
  else if(chatType==='private'&&chatId&&chatTarget){
    db.ref(`private_chats/${chatId}`).push(msg).catch(err=>{
      console.error('[send] private_chats failed:',err,'path=private_chats/'+chatId);
      toast('Message failed to send: '+err.message,'error');
    });
    const upd={lastMessage:preview,timestamp:Date.now(),unread:0,targetUid:chatTarget.uid,targetUsername:chatTarget.username,targetMKJ:chatTarget.mkjNumber||'',targetPhoto:chatTarget.photoURL||''};
    db.ref(`conversations/${me.uid}/${chatId}`).update(upd).catch(err=>console.error('[send] conversations update failed:',err));
    db.ref(`conversations/${chatTarget.uid}/${chatId}`).transaction(ex=>{
      const prev=ex||{};
      return{...prev,targetUid:me.uid,targetUsername:me.username,targetMKJ:me.mkjNumber||'',targetPhoto:me.photoURL||'',lastMessage:preview,timestamp:Date.now(),unread:(prev.unread||0)+1};
    }).catch(err=>console.error('[send] recipient conversation transaction failed:',err));
    if(chatTarget.uid!==me.uid&&!isChatMuted())sendPush(`${me.username}`,preview,me.photoURL);
  }
  else if(chatType==='group'&&curGid){
    db.ref(`group_messages/${curGid}`).push(msg).catch(err=>{console.error('[send] group_messages failed:',err);toast('Message failed to send: '+err.message,'error');});
  }
}


// ══ SEND FUNCTIONS ════════════════════════════════════════════════
function sendGlobal(){
  if(!isCEO())return toast('📢 Official announcements only','info');
  const inp=$('g-inp'),text=inp.value.trim();if(!text||!me)return;if(!checkRate())return;
  hideMentionBox();
  const msg={uid:me.uid,username:me.username,mkjNumber:me.mkjNumber,photoURL:me.photoURL,text,time:ts(),timestamp:Date.now(),type:'text',lang:getMyPreferredLanguage()};
  if(replyData.global){msg.replyTo=replyData.global;clearReply('global');}
  if(disappearSetting)msg.disappearAt=Date.now()+disappearSetting*1000;
  db.ref('global_chat').push(msg);inp.value='';inp.style.height='auto';
  $('ai-row-g').classList.add('hidden');earnPoints(1,'message');
  onInpChange('g-inp','ai-row-g');
  clearTimeout(typTimers.global);db.ref(`typing/global/${me.uid}`).remove();
}
async function sendPrivate(){
  const inp=$('p-inp'),text=inp.value.trim();if(!text||!chatId||!chatTarget||!me)return;if(!checkRate())return;
  const blocked=await isBlockedByTarget();if(blocked)return toast('You are blocked by this user','error');
  hideMentionBox();
  const msg={uid:me.uid,username:me.username,mkjNumber:me.mkjNumber,photoURL:me.photoURL,text,time:ts(),timestamp:Date.now(),type:'text',lang:getMyPreferredLanguage()};
  if(replyData.private){msg.replyTo=replyData.private;clearReply('private');}
  if(disappearSetting)msg.disappearAt=Date.now()+disappearSetting*1000;
  sendToRef('private',msg,text);
  inp.value='';inp.style.height='auto';$('ai-row-p').classList.add('hidden');onInpChange('p-inp','ai-row-p');
  saveDraft(chatId,'');earnPoints(1,'message');
  clearTimeout(typTimers.private);db.ref(`typing/private/${chatId}/${me.uid}`).remove();
}
async function sendGroup(){
  const inp=$('grp-inp'),text=inp.value.trim();if(!text||!curGid||!me)return;if(!checkRate())return;
  const muted=await checkMuted_();if(muted)return toast('You are muted in this group 🔇','error');
  // Announcement-only mode check
  if(curGData?.announcementOnly){
    const myRole=(curGData.roles||{})[me.uid]||'member';
    if(myRole!=='admin'&&myRole!=='moderator')return toast('📢 Only admins/moderators can post','info');
  }
  hideMentionBox();
  const msg={uid:me.uid,username:me.username,mkjNumber:me.mkjNumber,photoURL:me.photoURL,text,time:ts(),timestamp:Date.now(),type:'text',lang:getMyPreferredLanguage()};
  if(replyData.group){msg.replyTo=replyData.group;clearReply('group');}
  db.ref(`group_messages/${curGid}`).push(msg);inp.value='';inp.style.height='auto';$('ai-row-grp').classList.add('hidden');earnPoints(1,'message');onInpChange('grp-inp','ai-row-grp');
  clearTimeout(typTimers.group);db.ref(`typing/group/${curGid}/${me.uid}`).remove();
}
async function checkMuted_(){if(!curGid||!me)return false;const s=await db.ref(`groups/${curGid}/muted/${me.uid}`).once('value');return s.val()===true;}

// ══ LOAD GLOBAL (with reaction updates) ═══════════════════════════
function loadGlobal(){
  const c=$('global-msgs');c.innerHTML='';gUnread=0;
  if(lGlobal)db.ref('global_chat').off();
  lGlobal=db.ref('global_chat').orderByChild('timestamp').limitToLast(50).on('child_added',snap=>{
    const msg=snap.val();if(!me)return;
    db.ref(`reactions/global/${snap.key}`).once('value',rs=>{
      const el=makeMsg(msg,msg.uid===me.uid,snap.key,'global',rs.val());
      if(el)c.appendChild(el);scrollBottom('global-msgs');
    });
    $('g-prev')&&($('g-prev').textContent=(msg.username?getDisplayName(msg.uid,msg.username)+': ':'')+( msg.text||'[media]'));
    $('g-time')&&($('g-time').textContent=ago(msg.timestamp));
    if(curView!=='global'){gUnread++;[$('g-badge'),$('g-nb')].forEach(b=>{if(b){b.textContent=gUnread;b.classList.remove('hidden');}});}
    if(msg.uid!==me.uid)sendPush(getDisplayName(msg.uid,msg.username)||'MKJ Community',msg.text||'[media]',msg.photoURL);
  });
  db.ref('reactions/global').on('child_changed',snap=>{
    const el=$('global-msgs')?.querySelector(`[data-key="${snap.key}"]`);
    if(!el)return;const rc=el.querySelector('.react-wrap');if(rc)rc.remove();
    const reactions=snap.val();if(!reactions||!Object.keys(reactions).length)return;
    const rDiv=document.createElement('div');rDiv.className='react-wrap';
    const counts={};Object.values(reactions).forEach(e=>{counts[e]=(counts[e]||0)+1;});
    const myR=reactions[me?.uid];
    Object.entries(counts).forEach(([em,cnt])=>{const chip=document.createElement('button');chip.className='react-chip'+(myR===em?' mine':'');chip.innerHTML=`${em}<span style="font-size:11px;color:var(--t2);margin-left:2px;">${cnt}</span>`;chip.onclick=()=>doReact(snap.key,'global',em);rDiv.appendChild(chip);});
    el.appendChild(rDiv);
  });
  watchTyping('typing/global','g-typing');
}

// ══ PRIVATE CHAT (with pagination) ════════════════════════════════
let _onlineLRef=null;
// ══ USER PROFILE VIEW MODAL ═══════════════════════════════════════
// ══ CONTACTS — private per-user address book, powers status privacy ═
let _contacts={}; // {uid: {savedName, username, addedAt}} — only ever loaded for the logged-in user's own list
function loadContacts(){
  if(!me)return;
  db.ref(`contacts/${me.uid}`).on('value',snap=>{_contacts=snap.val()||{};});
}
function isContact(uid){return !!_contacts[uid];}
function getDisplayName(uid,fallbackName){
  return _contacts[uid]?.savedName || fallbackName || 'User';
}
async function saveContactPrompt(uid,defaultUsername,defaultPhoto){
  if(!me||!uid||uid===me.uid)return;
  const existing=_contacts[uid];
  const name=prompt('Save this contact as:',existing?.savedName||defaultUsername||'');
  if(!name||!name.trim())return;
  try{
    await db.ref(`contacts/${me.uid}/${uid}`).set({savedName:name.trim(),username:defaultUsername||'',addedAt:existing?.addedAt||Date.now()});
    toast(existing?'Contact updated ✓':'Contact saved ✓','success');
  }catch(e){toast('Could not save contact','error');}
}
async function removeContact(uid){
  if(!me||!uid)return;
  if(!confirm('Remove this saved contact?'))return;
  try{
    await db.ref(`contacts/${me.uid}/${uid}`).remove();
    toast('Contact removed','info');
  }catch(e){toast('Could not remove contact','error');}
}
function openContactsList(){
  const list=$('contacts-list');if(!list)return;
  list.innerHTML='';
  const entries=Object.entries(_contacts);
  if(!entries.length){
    list.innerHTML='<div style="color:var(--t2);font-size:13px;text-align:center;padding:24px;">No saved contacts yet.<br>Save someone from their profile to see them here.</div>';
  }else{
    entries.sort((a,b)=>(a[1].savedName||'').localeCompare(b[1].savedName||'')).forEach(([uid,c])=>{
      const row=document.createElement('div');row.className='ci';row.style.borderRadius='10px';
      const infoDiv=document.createElement('div');infoDiv.style.cssText='flex:1;min-width:0;cursor:pointer;';
      infoDiv.innerHTML=`<div style="font-weight:600;color:var(--t1);font-size:14px;">${esc(c.savedName)}</div><div style="font-size:12px;color:var(--t2);">${esc(c.username||'')}</div>`;
      infoDiv.onclick=async()=>{
        closeModal('contacts-modal');
        // Fetch their current profile (mkj number, photo) so the chat header isn't blank on first open
        try{
          const s=await db.ref(`users/${uid}`).once('value');
          const u=s.val()||{};
          openPrivate(uid,c.username||u.username||'',u.mkjNumber||'',u.photoURL||'');
        }catch(e){
          openPrivate(uid,c.username||'','','');
        }
      };
      row.appendChild(infoDiv);
      const chatIcon=document.createElement('i');chatIcon.className='fa-solid fa-message';chatIcon.style.cssText='color:var(--g);font-size:14px;padding:6px 4px;';
      row.appendChild(chatIcon);
      const editBtn=document.createElement('button');editBtn.style.cssText='color:var(--t2);font-size:14px;padding:6px 10px;';editBtn.innerHTML='<i class="fa-solid fa-pen"></i>';
      editBtn.onclick=(e)=>{e.stopPropagation();saveContactPrompt(uid,c.username).then(()=>openContactsList());};
      const delBtn=document.createElement('button');delBtn.style.cssText='color:#ef4444;font-size:14px;padding:6px 10px;';delBtn.innerHTML='<i class="fa-solid fa-trash"></i>';
      delBtn.onclick=(e)=>{e.stopPropagation();removeContact(uid).then(()=>openContactsList());};
      row.appendChild(editBtn);row.appendChild(delBtn);
      list.appendChild(row);
    });
  }
  openModal('contacts-modal');
}

async function viewUserProfile(uid){
  if(!uid||!me)return;
  if(uid===me.uid){switchTab('profile');return;}
  // Build modal
  const modal=document.createElement('div');modal.className='modal-bg';modal.style.zIndex='500';
  modal.onclick=e=>{if(e.target===modal)modal.remove();};
  modal.innerHTML=`<div class="modal-box" style="padding:0;overflow:hidden;border-radius:20px 20px 0 0;max-height:88vh;overflow-y:auto;">
    <div id="upm-loading" style="padding:40px;text-align:center;color:var(--t2);">Loading…</div>
  </div>`;
  document.body.appendChild(modal);
  // Fetch user data
  const [uSnap,followData,hlSnap]=await Promise.all([
    db.ref(`users/${uid}`).once('value'),
    getFollowCounts(uid),
    db.ref(`highlights/${uid}`).once('value')
  ]);
  const u=uSnap.val();if(!u){modal.remove();return toast('User not found','error');}
  const following=await isFollowing(uid);
  const highlights=Object.entries(hlSnap.val()||{});
  const vbadge=uid===CEO_UID?'<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;background:#1d9bf0;border-radius:50%;margin-left:4px;"><i class="fa-solid fa-check" style="color:#fff;font-size:9px;"></i></span>':'';
  const box=modal.querySelector('.modal-box');
  box.innerHTML=`
    <!-- Header -->
    <div style="background:linear-gradient(135deg,var(--dg),var(--g));padding:28px 16px 20px;text-align:center;position:relative;">
      <button onclick="this.closest('.modal-bg').remove()" style="position:absolute;top:14px;right:14px;color:rgba(255,255,255,.7);font-size:24px;line-height:1;background:none;">×</button>
      <img src="${esc(u.photoURL||avUrl(u.username||'U'))}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,.4);margin-bottom:10px;">
      <div style="font-size:20px;font-weight:800;color:#fff;display:flex;align-items:center;justify-content:center;gap:4px;">${esc(u.username||'User')}${vbadge}</div>
      <div style="font-size:13px;color:rgba(255,255,255,.7);margin-top:3px;">#${esc(u.mkjNumber||'')}</div>
    </div>
    <!-- Followers row -->
    <div style="display:flex;justify-content:center;gap:32px;padding:14px 0;background:var(--s1);border-bottom:1px solid rgba(255,255,255,.06);">
      <div style="text-align:center;cursor:pointer;" onclick="openFollowList('${uid}','followers')">
        <div style="font-size:20px;font-weight:800;color:var(--t1);">${followData.followers}</div>
        <div style="font-size:12px;color:var(--t2);">Followers</div>
      </div>
      <div style="text-align:center;cursor:pointer;" onclick="openFollowList('${uid}','following')">
        <div style="font-size:20px;font-weight:800;color:var(--t1);">${followData.following}</div>
        <div style="font-size:12px;color:var(--t2);">Following</div>
      </div>
    </div>
    <!-- Bio -->
    <div style="padding:14px 16px;background:var(--s1);">
      ${u.bio?`<p style="font-size:14px;color:var(--t1);line-height:1.6;margin-bottom:${u.bioLink?'8px':'0'};">${esc(u.bio)}</p>`:''}
      ${u.bioLink?`<a href="${esc(u.bioLink)}" target="_blank" rel="noopener" style="color:var(--blue);font-size:13px;font-weight:600;text-decoration:none;display:flex;align-items:center;gap:5px;"><i class="fa-solid fa-link" style="font-size:12px;"></i>${esc(u.bioLink.replace(/^https?:\/\//,''))}</a>`:''}
    </div>
    <!-- Highlights row (rings populated via JS below to avoid quote issues) -->
    ${highlights.length?`<div style="background:var(--s1);border-top:1px solid rgba(255,255,255,.04);padding:12px 16px;">
      <div style="font-size:11px;font-weight:700;color:var(--g);margin-bottom:10px;letter-spacing:.5px;">HIGHLIGHTS</div>
      <div id="upm-hl-row" style="display:flex;gap:14px;overflow-x:auto;padding-bottom:4px;"></div>
    </div>`:''}
    <!-- Action buttons -->
    <div style="display:flex;gap:10px;padding:14px 16px;background:var(--s1);border-top:1px solid rgba(255,255,255,.06);">
      <button id="upm-follow-btn" style="flex:1;padding:12px;border-radius:12px;font-weight:700;font-size:14px;background:${following?'var(--s2)':'var(--g)'};color:${following?'var(--t1)':'#fff'};">${following?'Following':'Follow'}</button>
      <button id="upm-msg-btn" style="flex:1;padding:12px;border-radius:12px;font-weight:700;font-size:14px;background:var(--s2);color:var(--t1);"><i class="fa-solid fa-message" style="margin-right:6px;color:var(--g);"></i>Message</button>
      <button id="upm-contact-btn" style="width:48px;padding:12px;border-radius:12px;font-weight:700;font-size:14px;background:var(--s2);color:${isContact(uid)?'var(--g)':'var(--t1)'};"><i class="fa-solid ${isContact(uid)?'fa-address-book':'fa-user-plus'}"></i></button>
    </div>
  `;
  // Wire up buttons via JS (avoids inline onclick quote escaping issues)
  const followBtn=box.querySelector('#upm-follow-btn');
  if(followBtn)followBtn.onclick=()=>followUser(uid).then(f=>{followBtn.textContent=f?'Following':'Follow';followBtn.style.background=f?'var(--s2)':'var(--g)';followBtn.style.color=f?'var(--t1)':'#fff';});
  const msgBtn=box.querySelector('#upm-msg-btn');
  if(msgBtn)msgBtn.onclick=()=>{modal.remove();openPrivate(uid,u.username||'',u.mkjNumber||'',u.photoURL||'');};
  const contactBtn=box.querySelector('#upm-contact-btn');
  if(contactBtn)contactBtn.onclick=()=>saveContactPrompt(uid,u.username,u.photoURL).then(()=>{
    contactBtn.style.color=isContact(uid)?'var(--g)':'var(--t1)';
    contactBtn.innerHTML=`<i class="fa-solid ${isContact(uid)?'fa-address-book':'fa-user-plus'}"></i>`;
  });
  // Build highlights rings via JS (safe, no innerHTML quote issues)
  const hlRow=box.querySelector('#upm-hl-row');
  if(hlRow){
    const uData={username:getDisplayName(uid,u.username)||'User',photoURL:u.photoURL||''};
    highlights.forEach(([key,s])=>{
      const div=document.createElement('div');div.style.cssText='text-align:center;flex-shrink:0;cursor:pointer;';
      const thumb=s.type==='photo'
        ?`<img src="${esc(s.url)}" style="width:58px;height:58px;border-radius:50%;object-fit:cover;border:2.5px solid var(--g);">`
        :`<div style="width:58px;height:58px;border-radius:50%;background:var(--s2);display:flex;align-items:center;justify-content:center;border:2.5px solid var(--g);font-size:22px;">🎬</div>`;
      div.innerHTML=`${thumb}<div style="font-size:10px;color:var(--t2);margin-top:5px;max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(s.caption||'Highlight')}</div>`;
      div.onclick=()=>viewStatus(uid,uData,[s]);
      hlRow.appendChild(div);
    });
  }
}

function openPrivate(uid,name,mkj,photo){
  if(!me)return toast('Not logged in','error');
  if(!uid||uid===me.uid)return;
  if(localStorage.getItem(`blocked_${uid}`)==='true')return toast('You have blocked this user','error');
  if(_onlineLRef){_onlineLRef.off('value');_onlineLRef=null;}
  chatId=[me.uid,uid].sort().join('_');
  chatTarget={uid,username:name,mkjNumber:mkj,photoURL:photo};
  $('p-av').src=photo||avUrl(name);$('p-name').textContent=getDisplayName(uid,name);
  const pSub=$('p-sub');pSub.textContent=mkj?`#${mkj}`:'';delete pSub.dataset.original;
  closeSearch();closeModal('search-modal');showView('private');applyWallpaper('private');
  const savedBg=localStorage.getItem(`bg_${chatId}`);if(savedBg)$('priv-msgs').style.background=savedBg;
  loadPrivMsgs();
  _onlineLRef=db.ref(`users/${uid}/online`);
  _onlineLRef.on('value',s=>{
    const dot=$('p-dot');if(dot)dot.classList.toggle('hidden',!s.val()||localStorage.getItem('priv_online')==='true');
  });
  watchTyping(`typing/private/${chatId}`,'p-sub');
  db.ref(`conversations/${me.uid}/${chatId}`).update({unread:0,targetUid:uid,targetUsername:name,targetMKJ:mkj,targetPhoto:photo});
  recordProfileView(uid);
  setTimeout(()=>{loadDraftToInp(chatId,'p-inp');addFollowBtnToProfile(uid);},200);
}
function loadPrivMsgs(){
  const c=$('priv-msgs');c.innerHTML='';privMsgCursor=null;
  if(lPrivate&&chatId)db.ref(`private_chats/${chatId}`).off();
  lPrivate=db.ref(`private_chats/${chatId}`).orderByChild('timestamp').limitToLast(PAGE).on('child_added',snap=>{
    const msg=snap.val();if(!me)return;
    db.ref(`reactions/private/${chatId}/${snap.key}`).once('value',rs=>{
      const el=makeMsg(msg,msg.uid===me.uid,snap.key,'private',rs.val());
      if(el)c.appendChild(el);scrollBottom('priv-msgs');
    });
    if(msg.uid!==me.uid){
      db.ref(`conversations/${me.uid}/${chatId}`).update({unread:0});
      db.ref(`private_chats/${chatId}/${snap.key}/readBy/${me.uid}`).set(true);
      if(!isChatMuted())sendPush(getDisplayName(msg.uid,msg.username)||'MKJ Chat',msg.text||'[media]',msg.photoURL);
    }
  },err=>{
    console.error('[load] private_chats read failed:',err,'path=private_chats/'+chatId);
    toast('Could not load chat history: '+err.message,'error');
  });
  db.ref(`private_chats/${chatId}`).orderByChild('timestamp').limitToFirst(1).once('value',snap=>{
    $('p-load-more').classList.toggle('hidden',!snap.val());
    if(snap.val())privMsgCursor=Object.values(snap.val())[0].timestamp;
  }).catch(err=>console.error('[load] private_chats first-msg check failed:',err));
}
async function loadMorePrivate(){
  if(!chatId||!privMsgCursor)return;
  const snap=await db.ref(`private_chats/${chatId}`).orderByChild('timestamp').endAt(privMsgCursor-1).limitToLast(PAGE).once('value');
  const data=snap.val();if(!data){$('p-load-more').classList.add('hidden');return;}
  const c=$('priv-msgs'),prevH=c.scrollHeight;
  const entries=Object.entries(data).sort((a,b)=>a[1].timestamp-b[1].timestamp);
  // Insert synchronously to preserve order; reactions fetched after
  const insertedEls=[];
  for(const [key,msg] of entries){
    const el=makeMsg(msg,msg.uid===me.uid,key,'private',null);
    if(el){c.insertBefore(el,c.firstChild);insertedEls.push({el,key});}
  }
  // Fetch reactions and patch in
  insertedEls.forEach(({el,key})=>{
    db.ref(`reactions/private/${chatId}/${key}`).once('value',rs=>{
      const rv=rs.val();if(!rv||!Object.keys(rv).length)return;
      const rDiv=document.createElement('div');rDiv.className='react-wrap';
      const counts={};Object.values(rv).forEach(e=>{counts[e]=(counts[e]||0)+1;});
      const myR=rv[me?.uid];
      Object.entries(counts).forEach(([em,cnt])=>{const chip=document.createElement('button');chip.className='react-chip'+(myR===em?' mine':'');chip.innerHTML=`${em}<span style="font-size:11px;color:var(--t2);margin-left:2px;">${cnt}</span>`;chip.onclick=()=>doReact(key,'private',em);rDiv.appendChild(chip);});
      el.appendChild(rDiv);
    });
  });
  privMsgCursor=entries[0][1].timestamp;
  setTimeout(()=>{c.scrollTop=c.scrollHeight-prevH;},50);
  if(entries.length<PAGE)$('p-load-more').classList.add('hidden');
}
function closePrivate(){
  if(lPrivate&&chatId){db.ref(`private_chats/${chatId}`).off();lPrivate=null;}
  if(_onlineLRef){_onlineLRef.off('value');_onlineLRef=null;}
  chatId=null;chatTarget=null;replyData.private=null;
  $('p-reply-bar').classList.add('hidden');$('ai-row-p').classList.add('hidden');
  $('p-sub').textContent='';goBack('chats');
}
function openChatInfo(){recordProfileView(chatTarget?.uid);openPrivatMenu();}

// ══ CONVERSATIONS LIST ════════════════════════════════════════════
const _convOnlineRefs={};
function loadConvs(){
  if(lConvs&&me)db.ref(`conversations/${me.uid}`).off();
  lConvs=db.ref(`conversations/${me.uid}`).orderByChild('timestamp').on('value',snap=>{
    // Clean up previous online listeners
    Object.values(_convOnlineRefs).forEach(r=>r.off('value'));
    Object.keys(_convOnlineRefs).forEach(k=>delete _convOnlineRefs[k]);
    const data=snap.val()||{};
    const el=$('priv-list');el.innerHTML='';
    const pinned=[],unpinned=[];
    const sorted=Object.entries(data).filter(([,c])=>!c.isGroup).sort((a,b)=>(b[1].timestamp||0)-(a[1].timestamp||0));
    sorted.forEach(entry=>{
      const [,c]=entry;
      (localStorage.getItem(`pinned_chat_${c.targetUid}`)==='true'?pinned:unpinned).push(entry);
    });
    // Pinned horizontal scroll
    const pRow=$('pinned-scroll'),pWrap=$('pinned-contacts-row');
    if(pinned.length){pRow.innerHTML='';pWrap.classList.remove('hidden');}else pWrap.classList.add('hidden');
    pinned.forEach(([cid,c])=>{
      const dName=getDisplayName(c.targetUid,c.targetUsername);
      const av=document.createElement('div');av.className='pin-av';
      av.innerHTML=`<img src="${esc(c.targetPhoto||avUrl(c.targetUsername))}" class="pin-av-img" onerror="this.src='${avUrl(c.targetUsername)}'">${c.unread>0?`<div class="badge" style="position:absolute;top:0;right:0;min-width:16px;height:16px;font-size:9px;">${c.unread}</div>`:''}<div class="pin-av-name">${esc(dName)}</div>`;
      av.style.position='relative';
      av.onclick=()=>openPrivate(c.targetUid,c.targetUsername,c.targetMKJ||'',c.targetPhoto||'');
      pRow.appendChild(av);
    });
    // Regular list
    let total=0;
    unpinned.forEach(([cid,c])=>{
      if(c.unread>0)total+=c.unread;
      const isBlocked=localStorage.getItem(`blocked_${c.targetUid}`)==='true';
      const isMuted=localStorage.getItem(`muted_${c.targetUid}`)==='true';
      const isArchived=c.archived===true;
      const pinned=getPinnedChats();const isPinnedChat=pinned.includes(cid);
      const div=document.createElement('div');div.className='ci';
      const dName=getDisplayName(c.targetUid,c.targetUsername);
      div.dataset.name=(dName||'').toLowerCase();
      div.dataset.mkj=(c.targetMKJ||'').toLowerCase();
      div.dataset.cid=cid;
      div.dataset.unread=c.unread||0;
      div.dataset.archived=isArchived?'true':'false';
      div.dataset.isGroup='false';
      if(isArchived&&activeFolder!=='all')return;// skip archived in non-all views by default
      div.innerHTML=`
        <div style="position:relative;flex-shrink:0;">
          <img src="${esc(c.targetPhoto||avUrl(c.targetUsername))}" style="width:50px;height:50px;border-radius:50%;object-fit:cover;" onerror="this.src='${avUrl(c.targetUsername)}'">
          <div id="odot-${esc(cid)}" class="online-dot hidden"></div>
          ${isPinnedChat?'<div style="position:absolute;top:-2px;right:-2px;font-size:10px;">📌</div>':''}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:600;color:var(--t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px;">${esc(dName||'Unknown')}${isBlocked?' 🚫':''}${isMuted?' 🔇':''}</span>
            <span style="font-size:11px;color:${c.unread>0?'var(--g)':'var(--t2)'};">${ago(c.timestamp)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
            <span class="ci-sub" data-orig="${esc(c.lastMessage||'')}" style="font-size:13px;color:var(--t2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;">${c.draft?`<span class="draft-label">Draft</span>${esc(c.draft||'')}`:esc(c.lastMessage||'')}</span>
            ${c.unread>0?`<span class="badge">${c.unread}</span>`:''}
          </div>
          <div style="font-size:11px;color:var(--blue);">#${esc(c.targetMKJ||'')}</div>
        </div>`;
      if(!localStorage.getItem('priv_online')){
        const oRef=db.ref(`users/${c.targetUid}/online`);
        oRef.on('value',s=>{const dot=$(`odot-${cid}`);if(dot)dot.classList.toggle('hidden',!s.val());});
        _convOnlineRefs[c.targetUid]=oRef;
      }
      div.addEventListener('click',()=>openPrivate(c.targetUid,c.targetUsername,c.targetMKJ||'',c.targetPhoto||''));
      el.appendChild(div);
    });
    if(total>0){$('priv-nb').textContent=total;$('priv-nb').classList.remove('hidden');}else $('priv-nb').classList.add('hidden');
    $('empty-chats').style.display=sorted.length?'none':'flex';
  });
}
function filterChats(q){
  const lower=q.toLowerCase();
  $('priv-list').querySelectorAll('.ci').forEach(item=>{
    item.style.display=(!q||(item.dataset.name||'').includes(lower)||(item.dataset.mkj||'').includes(lower))?'flex':'none';
  });
}

// ══ GROUPS ════════════════════════════════════════════════════════
let lGroups=null;
function loadGroups(){
  if(lGroups)db.ref('groups').off('value',lGroups);
  lGroups=db.ref('groups').on('value',snap=>{
    const data=snap.val()||{};const wrap=$('groups-section-wrap'),scroll=$('groups-hscroll');
    scroll.innerHTML='';const myGroups=Object.entries(data).filter(([,g])=>g.members&&g.members[me?.uid]);
    myGroups.length?wrap.classList.remove('hidden'):wrap.classList.add('hidden');
    myGroups.forEach(([gid,g])=>{
      const card=document.createElement('div');card.className='grp-card';
      const color=`hsl(${(gid.charCodeAt(0)*7)%360},60%,45%)`;
      card.innerHTML=`<div class="grp-card-av" style="background:${color};">${(g.name||'G')[0].toUpperCase()}</div><div class="grp-card-name">${esc(g.name||'Group')}</div>`;
      if(g.photoURL){const img=card.querySelector('.grp-card-av');img.innerHTML=`<img src="${esc(g.photoURL)}" style="width:100%;height:100%;border-radius:16px;object-fit:cover;">`;}
      card.addEventListener('click',()=>openGroup(gid,g));scroll.appendChild(card);
    });
    $('has-divider')?.classList.toggle('hidden',!myGroups.length);
  });
}
function openGroup(gid,g){
  curGid=gid;curGData=g;grpMembers={};
  $('grp-name').textContent=g.name;
  $('grp-av').src=g.photoURL||avUrl(g.name,'7C3AED');
  showView('group');applyWallpaper('group');
  const savedBg=localStorage.getItem(`bg_grp_${gid}`);if(savedBg)$('group-msgs').style.background=savedBg;
  Object.keys(g.members||{}).forEach(uid=>{db.ref(`users/${uid}`).once('value').then(s=>{if(s.val())grpMembers[uid]={...s.val(),uid};});});
  // Real-time membership watch - kicks user out instantly if removed
  db.ref(`groups/${gid}/members/${me.uid}`).on('value',snap=>{
    if(!snap.val()&&curGid===gid){
      db.ref(`groups/${gid}/members/${me.uid}`).off();
      closeGroup();
      toast('You have been removed from this group','warn');
    }
  });
  // Also watch for announcement mode changes
  db.ref(`groups/${gid}/announcementOnly`).on('value',snap=>{
    if(curGid===gid&&curGData)curGData.announcementOnly=snap.val()||false;
  });
  loadGroupMsgs();
  watchGroupCallBanner(gid);
}
function loadGroupMsgs(){
  const c=$('group-msgs');c.innerHTML='';grpMsgCursor=null;
  if(lGroup&&curGid)db.ref(`group_messages/${curGid}`).off();
  lGroup=db.ref(`group_messages/${curGid}`).orderByChild('timestamp').limitToLast(PAGE).on('child_added',snap=>{
    const msg=snap.val();if(!me)return;
    db.ref(`reactions/group/${curGid}/${snap.key}`).once('value',rs=>{
      const el=makeMsg(msg,msg.uid===me.uid,snap.key,'group',rs.val());
      if(el)c.appendChild(el);scrollBottom('group-msgs');
    });
    if(msg.uid!==me.uid){
      if(msg.text?.includes(`@${me.username}`))sendPush(`${getDisplayName(msg.uid,msg.username)} mentioned you`,msg.text,msg.photoURL);
      else sendPush(`${getDisplayName(msg.uid,msg.username)||'MKJ'} in ${curGData?.name||'Group'}`,msg.text||'[media]',msg.photoURL);
    }
  });
  db.ref(`group_messages/${curGid}`).orderByChild('timestamp').limitToFirst(1).once('value',snap=>{
    $('grp-load-more').classList.toggle('hidden',!snap.val());
    if(snap.val())grpMsgCursor=Object.values(snap.val())[0].timestamp;
  });
  watchTyping(`typing/group/${curGid}`,'grp-typing');
}
async function loadMoreGroup(){
  if(!curGid||!grpMsgCursor)return;
  const c=$('group-msgs'),prevH=c.scrollHeight;
  const snap=await db.ref(`group_messages/${curGid}`).orderByChild('timestamp').endAt(grpMsgCursor-1).limitToLast(PAGE).once('value');
  const data=snap.val();if(!data){$('grp-load-more').classList.add('hidden');return;}
  const entries=Object.entries(data).sort((a,b)=>a[1].timestamp-b[1].timestamp);
  const insertedEls=[];
  for(const [key,msg] of entries){
    const el=makeMsg(msg,msg.uid===me.uid,key,'group',null);
    if(el){c.insertBefore(el,c.firstChild);insertedEls.push({el,key});}
  }
  insertedEls.forEach(({el,key})=>{
    db.ref(`reactions/group/${curGid}/${key}`).once('value',rs=>{
      const rv=rs.val();if(!rv||!Object.keys(rv).length)return;
      const rDiv=document.createElement('div');rDiv.className='react-wrap';
      const counts={};Object.values(rv).forEach(e=>{counts[e]=(counts[e]||0)+1;});
      const myR=rv[me?.uid];
      Object.entries(counts).forEach(([em,cnt])=>{const chip=document.createElement('button');chip.className='react-chip'+(myR===em?' mine':'');chip.innerHTML=`${em}<span style="font-size:11px;color:var(--t2);margin-left:2px;">${cnt}</span>`;chip.onclick=()=>doReact(key,'group',em);rDiv.appendChild(chip);});
      el.appendChild(rDiv);
    });
  });
  grpMsgCursor=entries[0][1].timestamp;
  setTimeout(()=>{c.scrollTop=c.scrollHeight-prevH;},50);
  if(entries.length<PAGE)$('grp-load-more').classList.add('hidden');
}
function closeGroup(){
  if(lGroup&&curGid){db.ref(`group_messages/${curGid}`).off();lGroup=null;}
  stopWatchingGroupCallBanner();
  curGid=null;curGData=null;replyData.group=null;
  $('grp-reply-bar').classList.add('hidden');$('ai-row-grp').classList.add('hidden');goBack('chats');
}
function addGroupMember(){
  const q=$('grp-ph-inp').value.trim();if(!q)return;
  const clean=q.replace('#','');
  db.ref('users').orderByChild('mkjNumber').equalTo(clean).once('value').then(snap=>{
    const u=snap.val();if(!u)return toast('User not found','error');
    const [uid,data]=Object.entries(u)[0];if(uid===me.uid)return toast("That's you",'error');
    grpMembers[uid]={...data,uid};$('grp-ph-inp').value='';
    const chips=$('grp-members-chips');
    const chip=document.createElement('span');chip.className='member-chip';
    chip.innerHTML=`<img src="${esc(avUrl(data.username))}" style="width:20px;height:20px;border-radius:50%;">${esc(data.username)}<button onclick="delete grpMembers['${uid}'];this.parentElement.remove()" style="color:var(--t2);font-size:14px;margin-left:4px;">×</button>`;
    chips.appendChild(chip);toast(`✅ ${data.username} added`,'success');
  });
}
async function createGroup(){
  const name=$('grp-name-inp').value.trim();if(!name)return toast('Enter group name','error');
  if(!Object.keys(grpMembers).length)return toast('Add at least 1 member','error');
  const members={[me.uid]:true};Object.keys(grpMembers).forEach(uid=>{members[uid]=true;});
  const roles={[me.uid]:'admin'};// Creator is always admin
  let photoURL='';
  if(grpSelPic){try{const b=await(await fetch(grpSelPic)).blob();photoURL=await uploadCld(new File([b],'grp.jpg',{type:'image/jpeg'}));}catch(e){}}
  await db.ref('groups').push({name,photoURL,members,roles,createdBy:me.uid,createdAt:Date.now(),announcementOnly:false});
  toast('✅ Group created!','success');
  $('grp-name-inp').value='';$('grp-members-chips').innerHTML='';grpMembers={};grpSelPic=null;closeModal('create-group-modal');
}
function previewGroupPic(inp){const f=inp.files[0];if(!f)return;const url=URL.createObjectURL(f);$('grp-av-prev').src=url;grpSelPic=url;}
function openGroupInfo(){
  openModal('group-info-modal');if(!curGData)return;
  $('invite-link-box').style.display='none';
  const c=$('group-info-content');c.innerHTML='';
  const roles=curGData.roles||{};
  const myRole=roles[me.uid]||'member';
  const isAdmin=myRole==='admin';
  const isMod=myRole==='moderator';
  const members=curGData.members||{};const muted=curGData.muted||{};
  // Announcement mode toggle (admin only)
  if(isAdmin){
    const annDiv=document.createElement('div');annDiv.className='ci';annDiv.style.cssText='border-radius:12px;margin-bottom:8px;justify-content:space-between;';
    annDiv.innerHTML=`<div style="display:flex;align-items:center;gap:10px;"><i class="fa-solid fa-bullhorn" style="color:var(--g);font-size:16px;width:24px;"></i><div><div style="color:var(--t1);font-size:14px;font-weight:500;">Announcement Only</div><div style="font-size:12px;color:var(--t2);">Only admins/mods can post</div></div></div><div class="toggle ${curGData.announcementOnly?'on':''}" onclick="toggleAnnouncementMode()"></div>`;
    c.appendChild(annDiv);
  }
  // Wallpaper btn
  const wpBtn=document.createElement('div');wpBtn.className='ci';wpBtn.style.cssText='border-radius:12px;margin-bottom:8px;';
  wpBtn.innerHTML='<i class="fa-solid fa-image" style="color:var(--blue);font-size:18px;width:28px;"></i><span style="color:var(--t1);font-size:14px;font-weight:500;">Set Wallpaper</span>';
  wpBtn.onclick=()=>{closeModal('group-info-modal');setChatWallpaper('group');};c.appendChild(wpBtn);
  const title=document.createElement('div');title.style.cssText='font-size:11px;color:var(--t2);font-weight:700;padding:4px 0 10px;letter-spacing:.5px;';
  title.textContent=`${Object.keys(members).length} MEMBERS`;c.appendChild(title);
  Object.keys(members).forEach(uid=>{
    db.ref(`users/${uid}`).once('value').then(s=>{
      const u=s.val()||{};const div=document.createElement('div');div.className='ci';div.style.cssText='padding:8px 0;';
      const memberRole=roles[uid]||'member';
      const roleBadge=memberRole==='admin'?'<span style="font-size:11px;color:var(--g);padding:2px 8px;border-radius:10px;background:rgba(0,168,132,.1);">👑 Admin</span>':memberRole==='moderator'?'<span style="font-size:11px;color:var(--blue);padding:2px 8px;border-radius:10px;background:rgba(59,130,246,.1);">🛡 Mod</span>':'';
      let actions='';
      if(isAdmin&&uid!==me.uid){
        const nextRole=memberRole==='moderator'?'member':'moderator';
        const roleLabel=memberRole==='moderator'?'Remove Mod':'Make Mod';
        actions+=`<button onclick="promoteGroupMember('${uid}','${nextRole}')" style="font-size:11px;padding:3px 8px;border-radius:8px;background:var(--s2);color:var(--t2);margin-left:4px;">${roleLabel}</button>`;
        actions+=`<button onclick="toggleMuteMember('${uid}','${esc(u.username||'User')}')" style="font-size:11px;padding:3px 8px;border-radius:8px;background:var(--s2);color:var(--t2);margin-left:4px;">${muted[uid]?'Unmute':'Mute'}</button>`;
        actions+=`<button onclick="if(confirm('Remove member?'))db.ref('groups/${curGid}/members/${uid}').remove().then(()=>openGroupInfo())" style="font-size:11px;padding:3px 8px;border-radius:8px;background:rgba(239,68,68,.15);color:var(--red);margin-left:4px;">Remove</button>`;
      }
      div.innerHTML=`<img src="${esc(u.photoURL||avUrl(u.username))}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">
        <div style="flex:1;min-width:0;"><div style="color:var(--t1);font-weight:600;font-size:14px;">${esc(getDisplayName(uid,u.username))} ${muted[uid]?'🔇':''}</div><div style="font-size:11px;color:var(--blue);">#${esc(u.mkjNumber||'')}</div></div>
        ${roleBadge}${actions}`;
      c.appendChild(div);
    });
  });
  if(curGData.createdBy!==me.uid){
    const leaveBtn=document.createElement('button');
    leaveBtn.style.cssText='width:100%;padding:12px;border-radius:12px;background:none;color:var(--red);font-weight:600;font-size:14px;border:1px solid rgba(239,68,68,.3);margin-top:16px;cursor:pointer;';
    leaveBtn.textContent='Leave Group';
    leaveBtn.onclick=()=>{if(!confirm('Leave this group?'))return;db.ref(`groups/${curGid}/members/${me.uid}`).remove().then(()=>{db.ref(`conversations/${me.uid}/${curGid}`).remove();closeModal('group-info-modal');closeGroup();toast('You left the group','info');});};
    c.appendChild(leaveBtn);
  }
}
async function toggleAnnouncementMode(){
  if(!curGid)return;
  const ref=db.ref(`groups/${curGid}/announcementOnly`);
  const s=await ref.once('value');
  const next=!s.val();
  await ref.set(next);
  if(curGData)curGData.announcementOnly=next;
  toast(next?'Announcement mode ON 📢':'Announcement mode OFF','info');
  openGroupInfo();
}
function addMemberToGroup(){
  const q=$('grp-add-ph').value.trim();if(!q||!curGid)return;
  db.ref('users').orderByChild('mkjNumber').equalTo(q.replace('#','')).once('value').then(snap=>{
    const u=snap.val();if(!u)return toast('User not found','error');
    const [uid]=Object.entries(u)[0];
    db.ref(`groups/${curGid}/members/${uid}`).set(true).then(()=>{toast('✅ Member added','success');$('grp-add-ph').value='';openGroupInfo();});
  });
}
async function toggleMuteMember(uid,username){
  if(!curGid||curGData?.createdBy!==me.uid)return toast('Only admin can mute','error');
  const ref=db.ref(`groups/${curGid}/muted/${uid}`);
  const s=await ref.once('value');
  if(s.val()){await ref.remove();toast(`${username} unmuted`,'success');}
  else{await ref.set(true);toast(`${username} muted 🔇`,'info');}
  openGroupInfo();
}
function genGroupInviteLink(){
  if(!curGid)return;
  const link=`${location.origin}${location.pathname}?join=${curGid}`;
  const box=$('invite-link-box');box.style.display='block';box.textContent=link;
  navigator.clipboard?.writeText(link).then(()=>toast('Invite link copied!','success'));
}
function checkGroupInvite(){
  const gid=new URLSearchParams(location.search).get('join');
  if(gid&&me){db.ref(`groups/${gid}/members/${me.uid}`).set(true).then(()=>{toast('Joined group via invite ✓','success');history.replaceState({},'',location.pathname);});}
}

// ══ INVITE LINK SYSTEM ════════════════════════════════════════════
function checkInviteParam(){
  const mkj=new URLSearchParams(location.search).get('invite');
  if(!mkj||!me)return;
  history.replaceState({},'',location.pathname);
  db.ref('users').orderByChild('mkjNumber').equalTo(mkj).once('value').then(snap=>{
    const data=snap.val();if(!data)return;
    const [uid,u]=Object.entries(data)[0];
    if(uid===me.uid)return;
    toast(`👋 Opening chat with ${u.username}…`,'info');
    setTimeout(()=>openPrivate(uid,u.username,u.mkjNumber,u.photoURL),800);
  });
}
function getMyInviteLink(){
  return `${location.origin}${location.pathname}?invite=${me?.mkjNumber}`;
}
function shareInviteLink(){
  const link=getMyInviteLink();
  if(navigator.share){navigator.share({title:'Join me on MKJ Chat',text:`Add me on MKJ Chat! My number is #${me?.mkjNumber}`,url:link}).catch(()=>{});}
  else{navigator.clipboard?.writeText(link).then(()=>toast('Invite link copied! 🔗','success')).catch(()=>toast(link,'info'));}
}

// ══ CHANNELS ══════════════════════════════════════════════════════
let curChannelId=null,lChannel=null;

function loadChannels(){
  db.ref(`channel_subs/${me.uid}`).once('value').then(snap=>{
    const subs=snap.val()||{};
    const wrap=$('channels-section-wrap');const scroll=$('channels-hscroll');
    if(!scroll)return;scroll.innerHTML='';
    // Always show CEO channel
    db.ref('channels').once('value').then(cs=>{
      const all=cs.val()||{};
      // Show channels user is subscribed to OR is CEO's channel
      const visible=Object.entries(all).filter(([id,c])=>subs[id]||c.createdBy===me.uid);
      if(visible.length===0&&!isCEO()){wrap?.classList.add('hidden');return;}
      wrap?.classList.remove('hidden');
      // Add "+" card for creating channel
      const addCard=document.createElement('div');addCard.className='grp-card';
      addCard.innerHTML=`<div class="grp-card-av" style="background:var(--s2);"><i class="fa-solid fa-plus" style="color:var(--g);font-size:20px;"></i></div><span class="grp-card-name">New</span>`;
      addCard.onclick=()=>openModal('create-channel-modal');
      scroll.appendChild(addCard);
      visible.forEach(([id,c])=>{
        const card=document.createElement('div');card.className='grp-card';
        const av=c.photo?`<img src="${esc(c.photo)}" style="width:56px;height:56px;border-radius:16px;object-fit:cover;">`:`<div class="grp-card-av" style="background:linear-gradient(135deg,var(--g),var(--dg));font-size:20px;">${esc(c.name?.[0]||'C')}</div>`;
        card.innerHTML=`${av}<span class="grp-card-name">${esc(c.name||'Channel')}</span>`;
        card.onclick=()=>openChannel(id,c);
        scroll.appendChild(card);
      });
    });
  });
}

function openChannel(id,data){
  curChannelId=id;
  showView('channel');
  $('ch-name').textContent=data.name||'Channel';
  $('ch-sub').textContent=`${data.subscriberCount||0} subscribers`;
  $('ch-msgs').innerHTML='';
  const postBar=$('ch-inp-bar');const chBanner=$('ch-readonly-banner');
  if(postBar&&chBanner){
    if(me.uid===data.createdBy||isCEO()){postBar.classList.remove('hidden');chBanner.classList.add('hidden');}
    else{postBar.classList.add('hidden');chBanner.classList.remove('hidden');}
  }
  // Subscribe only if not already subscribed
  db.ref(`channel_subs/${me.uid}/${id}`).once('value').then(snap=>{
    if(!snap.val()){
      db.ref(`channel_subs/${me.uid}/${id}`).set(true);
      db.ref(`channels/${id}/subscriberCount`).transaction(n=>(n||0)+1);
    }
  });
  // Add share button to channel header if not already there
  const chHeader=$('ch-name')?.parentElement?.parentElement;
  if(chHeader&&!chHeader.querySelector('.ch-share-btn')){
    const shareBtn=document.createElement('button');shareBtn.className='ch-share-btn';
    shareBtn.style.cssText='color:var(--t2);font-size:18px;padding:4px;';
    shareBtn.innerHTML='<i class="fa-solid fa-share-nodes"></i>';
    shareBtn.onclick=()=>{
      const url=`${location.origin}${location.pathname}?channel=${id}`;
      if(navigator.share)navigator.share({title:data.name||'Channel',text:`Join ${data.name} on MKJ Chat`,url});
      else navigator.clipboard?.writeText(url).then(()=>toast('Channel link copied 🔗','success'));
    };
    chHeader.appendChild(shareBtn);
  }
  if(lChannel)db.ref(`channel_posts/${curChannelId}`).off();
  lChannel=db.ref(`channel_posts/${id}`).orderByChild('timestamp').limitToLast(50).on('child_added',snap=>{
    const msg=snap.val();
    db.ref(`channel_reactions/${id}/${snap.key}`).once('value',rs=>{
      const el=makeChannelPost(msg,snap.key,rs.val());
      if(el){$('ch-msgs').appendChild(el);scrollBottom('ch-msgs');}
    });
  });
}

function makeChannelPost(msg,key,reactions){
  const wrap=document.createElement('div');
  wrap.style.cssText='margin:8px 12px;background:var(--s1);border-radius:14px;padding:12px;';
  let html=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
    <img src="${esc(msg.photoURL||avUrl(msg.username||'C'))}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">
    <div><div style="font-size:13px;font-weight:700;color:var(--g);">${esc(getDisplayName(msg.uid,msg.username))} 👑</div>
    <div style="font-size:10px;color:var(--t2);">${esc(msg.time||'')}</div></div></div>`;
  if(msg.type==='image')html+=`<img src="${esc(msg.url)}" style="width:100%;border-radius:10px;margin-bottom:8px;" loading="lazy" onclick="window.open('${esc(msg.url)}','_blank')">`;
  else if(msg.type==='video')html+=`<video controls style="width:100%;border-radius:10px;margin-bottom:8px;"><source src="${esc(msg.url)}"></video>`;
  else if(msg.text)html+=`<div style="font-size:15px;color:var(--t1);line-height:1.5;margin-bottom:8px;">${detectLinks(msg.text)}</div>`;
  // Reactions
  const counts={};if(reactions)Object.values(reactions).forEach(e=>{counts[e]=(counts[e]||0)+1;});
  const myR=reactions?.[me?.uid];
  const reacts=Object.entries(counts).map(([em,cnt])=>`<button onclick="doChannelReact('${key}','${em}')" style="background:${myR===em?'var(--g)':'var(--s2)'};border-radius:20px;padding:4px 10px;font-size:13px;margin-right:4px;color:${myR===em?'#fff':'var(--t1)'};">${em} ${cnt}</button>`).join('');
  html+=`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">
    ${reacts}
    <button onclick="showChannelReactPicker('${key}')" style="background:var(--s2);border-radius:20px;padding:4px 10px;font-size:13px;color:var(--t2);">+ React</button>
  </div>`;
  wrap.innerHTML=html;return wrap;
}

function doChannelReact(postKey,em){
  if(!curChannelId||!me)return;
  const ref=db.ref(`channel_reactions/${curChannelId}/${postKey}/${me.uid}`);
  ref.once('value').then(s=>{s.val()===em?ref.remove():ref.set(em);openChannel(curChannelId,curGData||{});});
}
function showChannelReactPicker(postKey){
  const emojis=['❤️','🔥','👍','😂','😮','🙏','💯','🎉'];
  // Quick inline picker
  const existing=document.getElementById(`ch-rp-${postKey}`);
  if(existing){existing.remove();return;}
  const picker=document.createElement('div');picker.id=`ch-rp-${postKey}`;
  picker.style.cssText='display:flex;flex-wrap:wrap;gap:6px;padding:8px;background:var(--s1);border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.4);margin-top:6px;';
  emojis.forEach(em=>{const b=document.createElement('button');b.textContent=em;b.style.fontSize='22px';b.onclick=()=>{doChannelReact(postKey,em);picker.remove();};picker.appendChild(b);});
  // Append after the post containing this key — find by scanning ch-msgs
  const posts=$('ch-msgs').children;
  for(const p of posts){if(p.innerHTML.includes(postKey)){p.appendChild(picker);return;}}
  $('ch-msgs').appendChild(picker);
}

async function createChannel(){
  const name=$('ch-name-inp').value.trim();
  const desc=$('ch-desc-inp').value.trim();
  if(!name)return toast('Enter a channel name','error');
  const channelId=db.ref('channels').push().key;
  let photo='';
  const pic=$('ch-pic-inp').files[0];
  if(pic){try{const c=await compressImage(pic,400,0.8);photo=await uploadCld(c);}catch(e){}}
  await db.ref(`channels/${channelId}`).set({name,description:desc,photo,createdBy:me.uid,createdByName:me.username,createdByPhoto:me.photoURL||'',subscriberCount:1,createdAt:Date.now()});
  await db.ref(`channel_subs/${me.uid}/${channelId}`).set(true);
  closeModal('create-channel-modal');$('ch-name-inp').value='';$('ch-desc-inp').value='';
  toast(`Channel "${name}" created 🎉`,'success');
  loadChannels();
}

async function sendChannelPost(){
  if(!curChannelId||!me)return;
  // Check creator or CEO
  const snap=await db.ref(`channels/${curChannelId}/createdBy`).once('value');
  if(snap.val()!==me.uid&&!isCEO())return toast('Only the channel owner can post','error');
  const inp=$('ch-post-inp');const text=inp.value.trim();if(!text)return;
  const msg={uid:me.uid,username:me.username,mkjNumber:me.mkjNumber,photoURL:me.photoURL,text,time:ts(),timestamp:Date.now(),type:'text',lang:getMyPreferredLanguage()};
  db.ref(`channel_posts/${curChannelId}`).push(msg);
  inp.value='';inp.style.height='auto';toast('Posted ✓','success');
}

function closeChannel(){if(lChannel&&curChannelId)db.ref(`channel_posts/${curChannelId}`).off();curChannelId=null;lChannel=null;goBack('chats');}

// ══ STATUS TEXT TYPE ══════════════════════════════════════════════
let textStatusBg='#00A884';
function pickTextStatusBg(color){
  textStatusBg=color;
  const prev=$('text-status-prev');
  if(prev)prev.style.background=color;
  document.querySelectorAll('.tsb-swatch').forEach(s=>s.style.border=s.dataset.color===color?'3px solid #fff':'3px solid transparent');
}

// ══ GROUP ROLES ════════════════════════════════════════════════════
async function getMyGroupRole(){
  if(!curGid||!me)return'member';
  const snap=await db.ref(`groups/${curGid}/roles/${me.uid}`).once('value');
  return snap.val()||'member';
}
async function promoteGroupMember(uid,role){
  if(!curGid||!me)return;
  const myRole=await getMyGroupRole();
  if(myRole!=='admin')return toast('Only admins can change roles','error');
  await db.ref(`groups/${curGid}/roles/${uid}`).set(role);
  toast(`Role updated to ${role} ✓`,'success');
  openGroupInfo();
}
async function sendGroupAnnouncement(){
  const myRole=await getMyGroupRole();
  if(myRole!=='admin'&&myRole!=='moderator')return toast('Only admins/moderators can post announcements','error');
  const text=prompt('Announcement text:');if(!text?.trim())return;
  const msg={uid:me.uid,username:me.username,mkjNumber:me.mkjNumber,photoURL:me.photoURL,text:text.trim(),time:ts(),timestamp:Date.now(),type:'text',isAnnouncement:true,lang:getMyPreferredLanguage()};
  db.ref(`group_messages/${curGid}`).push(msg);toast('Announcement posted 📢','success');
}

// ══ EXPANDED REACTIONS ════════════════════════════════════════════
function showFullReactPicker(key,chatType){
  const existing=$('full-react-picker');if(existing)existing.remove();
  const all=['❤️','🔥','👍','👎','😂','😮','😢','🙏','💯','🎉','😍','🤯','💪','🤝','✅','❌','🎊','🤣','😅','🫡'];
  const picker=document.createElement('div');picker.id='full-react-picker';
  picker.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:600;background:var(--s1);border-radius:16px;padding:12px;display:flex;flex-wrap:wrap;gap:8px;max-width:300px;box-shadow:0 8px 32px rgba(0,0,0,.5);';
  all.forEach(em=>{
    const b=document.createElement('button');b.style.fontSize='24px';b.textContent=em;
    b.onclick=()=>{doReact(key,chatType,em);picker.remove();};
    picker.appendChild(b);
  });
  const close=document.createElement('button');close.textContent='×';close.style.cssText='width:100%;margin-top:6px;color:var(--t2);font-size:18px;';close.onclick=()=>picker.remove();
  picker.appendChild(close);
  document.body.appendChild(picker);
}
function showReactionSummary(key,chatType){
  let ref;
  if(chatType==='global')ref=db.ref(`reactions/global/${key}`);
  else if(chatType==='private')ref=db.ref(`reactions/private/${chatId}/${key}`);
  else if(chatType==='group')ref=db.ref(`reactions/group/${curGid}/${key}`);
  else return;
  ref.once('value').then(snap=>{
    const data=snap.val()||{};
    if(!Object.keys(data).length)return toast('No reactions yet','info');
    const byEmoji={};
    Object.entries(data).forEach(([uid,em])=>{if(!byEmoji[em])byEmoji[em]=[];byEmoji[em].push(uid);});
    let html='<div style="display:grid;gap:10px;">';
    Object.entries(byEmoji).forEach(([em,uids])=>{
      html+=`<div style="background:var(--s2);border-radius:10px;padding:10px;">
        <div style="font-size:18px;margin-bottom:6px;">${em} <span style="font-size:13px;color:var(--t2);">${uids.length}</span></div>
        <div style="font-size:12px;color:var(--t2);">${uids.length} user${uids.length!==1?'s':''} reacted</div>
      </div>`;
    });
    html+='</div>';
    const modal=document.createElement('div');modal.className='modal-bg';modal.style.zIndex='500';
    modal.innerHTML=`<div class="modal-box"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;"><span style="font-size:17px;font-weight:700;color:var(--t1);">Reactions</span><button onclick="this.closest('.modal-bg').remove()" style="color:var(--t2);font-size:26px;">×</button></div>${html}</div>`;
    document.body.appendChild(modal);
  });
}

// ══ POLL ══════════════════════════════════════════════════════════
function addPollOptLegacy(){
  const cont=$('poll-opts-cont');const inp=document.createElement('input');inp.type='text';inp.className='poll-opt';
  inp.placeholder=`Option ${cont.children.length+1}`;inp.style.cssText='width:100%;padding:12px;background:var(--s2);border-radius:10px;font-size:14px;margin-bottom:8px;color:var(--t1);';
  cont.appendChild(inp);
}
function submitPoll(){
  const q=$('poll-q').value.trim();const opts=Array.from(document.querySelectorAll('.poll-opt')).map(i=>i.value.trim()).filter(Boolean);
  if(!q||opts.length<2)return toast('Need a question and at least 2 options','error');
  const votes={};opts.forEach((o,i)=>{votes[i]={option:o,count:0,voters:{}};});
  const msg={uid:me.uid,username:me.username,mkjNumber:me.mkjNumber,photoURL:me.photoURL,text:q,time:ts(),timestamp:Date.now(),type:'poll',pollQuestion:q,pollOptions:votes};
  db.ref(`group_messages/${curGid}`).push(msg);
  closeModal('poll-modal');$('poll-q').value='';document.querySelectorAll('.poll-opt').forEach((el,i)=>{if(i<2)el.value='';else el.remove();});
  toast('Poll created ✓','success');
}
async function votePollNew(msgKey,optIdx,chatType){
  if(!me)return toast('Login to vote','error');
  let ref;
  if(chatType==='global')ref=db.ref(`global_chat/${msgKey}/options/${optIdx}/votes`);
  else if(chatType==='private'&&chatId)ref=db.ref(`private_chats/${chatId}/${msgKey}/options/${optIdx}/votes`);
  else if(chatType==='group'&&curGid)ref=db.ref(`group_messages/${curGid}/${msgKey}/options/${optIdx}/votes`);
  else return;
  const snap=await ref.once('value');const votes=snap.val()||[];
  if(votes.includes(me.uid)){ref.set(votes.filter(v=>v!==me.uid));}
  else{ref.set([...votes,me.uid]);}
}
async function votePoll(msgKey,optIdx){
  if(!curGid||!me)return;
  const ref=db.ref(`group_messages/${curGid}/${msgKey}/pollOptions/${optIdx}/voters/${me.uid}`);
  const s=await ref.once('value');
  if(s.val()){await ref.remove();await db.ref(`group_messages/${curGid}/${msgKey}/pollOptions/${optIdx}/count`).transaction(c=>Math.max(0,(c||0)-1));}
  else{await ref.set(true);await db.ref(`group_messages/${curGid}/${msgKey}/pollOptions/${optIdx}/count`).transaction(c=>(c||0)+1);}
}
