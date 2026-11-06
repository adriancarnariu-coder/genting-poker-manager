const pad=value=>String(value).padStart(2,'0');
export function clockPoint(value,mode,size=320){
 const hour=mode==='hours',inner=hour&&(value===0||value>12),radius=size*(inner ? .265 : .415),angle=(value%(hour?12:60))/(hour?12:60)*Math.PI*2;
 return {x:size/2+Math.sin(angle)*radius,y:size/2-Math.cos(angle)*radius,radius,angle};
}
export function clockValueAt(x,y,size,mode){
 if(!Number.isFinite(x)||!Number.isFinite(y)||!(size>0))return null;
 const dx=x-size/2,dy=y-size/2,distance=Math.hypot(dx,dy);if(distance<size*.12)return null;
 const angle=(Math.atan2(dx,-dy)+Math.PI*2)%(Math.PI*2),steps=mode==='hours'?12:60,index=Math.round(angle/(Math.PI*2)*steps)%steps;
 return mode==='hours'?(distance<size*.34?(index===0?0:index+12):(index===0?12:index)):index;
}
export function clockDraft(value){const match=String(value??'').match(/^([01]\d|2[0-3])[.:]([0-5]\d)$/);return {hour:match?Number(match[1]):0,minute:match?Number(match[2]):0,cleared:!match};}
export const clockDraftValue=draft=>draft.cleared?'':pad(draft.hour)+':'+pad(draft.minute);
export function mountClockPicker({trigger,getValue,onConfirm,host=document.body}){
 const dialog=document.createElement('dialog');dialog.id='time-clock-dialog';dialog.className='clock-dialog';dialog.setAttribute('aria-labelledby','time-clock-title');
 dialog.innerHTML='<h2 id="time-clock-title">Select time</h2><p class="clock-format">24-hour time</p><div class="clock-digital"><button type="button" data-phase="hours" aria-label="Select hours"></button><span aria-hidden="true">:</span><button type="button" data-phase="minutes" aria-label="Select minutes"></button></div><p class="clock-instruction" role="status" aria-live="polite"></p><div class="clock-face" tabindex="0" role="group" aria-label="24-hour clock"><div class="clock-ticks" aria-hidden="true"></div><div class="clock-hand" aria-hidden="true"></div><span class="clock-centre" aria-hidden="true"></span><div class="clock-numbers"></div></div><div class="clock-precision"><button type="button" data-adjust="-1" aria-label="One minute earlier">−1 min</button><span>Fine adjustment</span><button type="button" data-adjust="1" aria-label="One minute later">+1 min</button></div><div class="clock-actions"><button type="button" data-action="clear">Clear</button><button type="button" data-action="cancel">Cancel</button><button type="button" class="primary" data-action="confirm">Confirm</button></div>';
 host.append(dialog);const find=s=>dialog.querySelector(s),face=find('.clock-face'),numbers=find('.clock-numbers'),ticks=find('.clock-ticks'),hand=find('.clock-hand'),hours=find('[data-phase="hours"]'),minutes=find('[data-phase="minutes"]'),precision=find('.clock-precision');
 let draft=clockDraft(''),phase='hours',drag=null,shownPhase;
 function paint(){
  hours.textContent=draft.cleared?'--':pad(draft.hour);minutes.textContent=draft.cleared?'--':pad(draft.minute);hours.setAttribute('aria-pressed',String(phase==='hours'));minutes.setAttribute('aria-pressed',String(phase==='minutes'));
  find('.clock-instruction').textContent=phase==='hours'?'Choose an hour · outer ring 01–12, inner ring 13–23 and 00':'Choose any minute · drag the hand or use ±1 min';face.setAttribute('aria-label',phase==='hours'?'Hours clock, 00 to 23. Arrow keys adjust; Enter chooses minutes.':'Minutes clock, 00 to 59. Arrow keys adjust one minute.');precision.hidden=phase!=='minutes';
  if(shownPhase!==phase){shownPhase=phase;numbers.replaceChildren();ticks.replaceChildren();
   const values=phase==='hours'?Array.from({length:24},(_,i)=>i):Array.from({length:12},(_,i)=>i*5);
   for(const value of values){const p=clockPoint(value,phase,100),button=document.createElement('button');button.type='button';button.className='clock-number';button.textContent=pad(value);button.dataset.value=value;button.style.left=p.x+'%';button.style.top=p.y+'%';button.setAttribute('aria-label',(phase==='hours'?'Hour ':'Minute ')+pad(value));button.onclick=()=>choose(value,true);numbers.append(button);}
   if(phase==='minutes')for(let value=0;value<60;value++){const tick=document.createElement('i');tick.className='clock-tick'+(value%5===0?' major':'');tick.style.transform=`rotate(${value*6}deg)`;ticks.append(tick);}
  }
  const value=phase==='hours'?draft.hour:draft.minute,p=clockPoint(value,phase,100);hand.style.width=p.radius+'%';hand.style.transform=`rotate(${p.angle*180/Math.PI-90}deg)`;hand.hidden=draft.cleared;find('.clock-centre').hidden=draft.cleared;
  for(const button of numbers.children){const active=!draft.cleared&&Number(button.dataset.value)===value;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));}
 }
 function choose(value,complete=false){draft={...draft,[phase==='hours'?'hour':'minute']:value,cleared:false};if(complete&&phase==='hours'){phase='minutes';paint();face.focus();}else paint();}
 function pointerValue(event){const r=face.getBoundingClientRect();return clockValueAt(event.clientX-r.left,event.clientY-r.top,r.width,phase);}
 face.addEventListener('pointerdown',event=>{if(event.button!==0||event.isPrimary===false)return;event.preventDefault();drag={id:event.pointerId,previous:{...draft},phase};face.setPointerCapture(event.pointerId);face.focus();const value=pointerValue(event);if(value!==null)choose(value);});
 face.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;const value=pointerValue(event);if(value!==null)choose(value);});
 face.addEventListener('pointerup',event=>{if(!drag||drag.id!==event.pointerId)return;const value=pointerValue(event),previousPhase=phase;drag=null;if(face.hasPointerCapture(event.pointerId))face.releasePointerCapture(event.pointerId);if(value!==null)choose(value,true);else if(previousPhase==='hours'&&!draft.cleared){phase='minutes';paint();}});
 face.addEventListener('pointercancel',()=>{if(!drag)return;draft=drag.previous;phase=drag.phase;drag=null;paint();});
 face.addEventListener('keydown',event=>{if(event.target!==face)return;const max=phase==='hours'?24:60,key=phase==='hours'?'hour':'minute';let value;
  if(['ArrowRight','ArrowUp'].includes(event.key))value=(draft[key]+1)%max;else if(['ArrowLeft','ArrowDown'].includes(event.key))value=(draft[key]+max-1)%max;else if(event.key==='Home')value=0;else if(event.key==='End')value=max-1;else if(event.key==='Enter'||event.key===' '){event.preventDefault();if(phase==='hours'){phase='minutes';paint();}else find('[data-action="confirm"]').focus();return;}else return;event.preventDefault();choose(value);
 });
 hours.onclick=()=>{phase='hours';paint();};minutes.onclick=()=>{phase='minutes';paint();};
 for(const button of dialog.querySelectorAll('[data-adjust]'))button.onclick=()=>{draft.minute=(draft.minute+Number(button.dataset.adjust)+60)%60;draft.cleared=false;paint();};
 function close(){drag=null;if(dialog.open&&typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');trigger.setAttribute('aria-expanded','false');trigger.focus();}
 find('[data-action="cancel"]').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('close',()=>{drag=null;trigger.setAttribute('aria-expanded','false');});
 find('[data-action="clear"]').onclick=()=>{draft=clockDraft('');paint();};
 find('[data-action="confirm"]').onclick=()=>{const value=clockDraftValue(draft);close();onConfirm(value);};
 trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');trigger.onclick=()=>{draft=clockDraft(getValue());phase='hours';shownPhase=null;paint();if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');trigger.setAttribute('aria-expanded','true');face.focus();};
 return {close,element:dialog};
}
