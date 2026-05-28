const KEY='legacycut_meridian_v49_15_personal';
const BUILD='V49.15-LC7';
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const FULL_MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const SECTIONS={
 schedule:{sub:'Schedule / Calendar + Agenda',tabs:[['calendar','Calendar + Agenda','Calendar view, agenda, and tasks'],['newJob','New Job Entry','Add scheduled or completed jobs'],['newEvent','New Event Entry','Add personal events'],['newProject','New Project','Legacy Cut order form and invoice builder']]},
 clients:{sub:'Clients / Directory',tabs:[['directory','Directory','Alphabetical client list.'],['client','Client','Selected client record and totals.'],['invoices','Invoices','All client invoices in numerical order.']]},
 supplies:{sub:'Supplies / Supply List',tabs:[['list','Supply List','All supplies. Add item or tap item to open details.'],['item','Item','Specific supply item details.'],['receipts','Receipts','Receipts for supply purchases.']]},
 banking:{sub:'Banking / Accounts',tabs:[['accounts','Accounts','Main spending and savings accounts.'],['trackers','Trackers','Money received, spent, saved, and categories.'],['receipts','Receipts','All banking receipts.']]},
 studio:{sub:'Studio / Scratch Pad + Gallery + Mockup Builder',tabs:[['pad','Scratch Pad','Sketch ideas and mark up photos.'],['gallery','Gallery','Saved drawings and markup images.'],['mockups','Mockup Builder','Build Legacy Cut product mockups with wood, stain, shapes, and laser-cut lettering.']]}
};
const now=new Date();
let state=JSON.parse(localStorage.getItem(KEY)||'null')||{section:'schedule',tabs:{schedule:'calendar',clients:'directory',supplies:'list',banking:'accounts',studio:'pad'},notes:{},year:now.getFullYear(),month:now.getMonth(),selectedDate:dateKey(now),calendarData:{},clients:{},selectedClient:'',invoices:[],invoiceCounter:1,services:[],supplies:[],supplyItems:{},selectedSupplyId:'',supplyReceipts:[],supplyCounter:1,timeLogs:[],timeClock:{status:'out'},reminders:[],firedReminders:{}};
function ensureCollections(){if(!state.clients)state.clients={};if(!state.invoices)state.invoices=[];if(!state.invoiceCounter)state.invoiceCounter=1;if(!Array.isArray(state.services))state.services=[];if(!Array.isArray(state.supplies))state.supplies=[];if(!state.supplyItems)state.supplyItems={};if(!state.supplyReceipts)state.supplyReceipts=[];if(!state.supplyCounter)state.supplyCounter=1;if(!state.tabs)state.tabs={schedule:'calendar',clients:'directory',supplies:'list',banking:'accounts',studio:'pad'};if(!state.tabs.supplies)state.tabs.supplies='list';if(!state.tabs.studio)state.tabs.studio='pad';if(!Array.isArray(state.timeLogs))state.timeLogs=[];if(!state.timeClock)state.timeClock={status:'out'};if(!Array.isArray(state.reminders))state.reminders=[];if(!state.firedReminders)state.firedReminders={};if(!state.drafts)state.drafts={};if(!state.scratchPad)state.scratchPad={activeTab:'pad',gallery:[],tool:'pencil',size:6,color:'#111111',undo:[],canvasData:''};if(!state.adminBackup)state.adminBackup={email:'',enabled:false,autoEmail:false,records:[]};if(!Array.isArray(state.adminBackup.records))state.adminBackup.records=[];if(!state.banking)state.banking={transactions:[],draft:{type:'income',date:dateKey(new Date()),description:'',amount:'',category:'Job Income',method:'Cash',notes:'',image:''}};if(!state.mockupBuilder)state.mockupBuilder=defaultMockupBuilderState();if(!Array.isArray(state.mockupBuilder.layers))state.mockupBuilder.layers=[];if(!Array.isArray(state.mockupBuilder.saved))state.mockupBuilder.saved=[];if(!state.settings)state.settings={};if(!state.settings.viewMode)state.settings.viewMode='mobile';}
const DB_NAME='bird_planner_offline_db';
const DB_STORE='state_snapshots';
let saveTimer=null, lastSavedAt=0, dbReady=null;
function normalizeAppState(opts={}){
  if(!state || !state.invoices)return state;
  try{
    Object.keys(state.supplyItems||{}).forEach(id=>calcSupplyUnitPrice(id,{silent:true}));
    (state.invoices||[]).forEach(inv=>normalizeInvoice(inv,{skipSupplySync:true}));
    recalcAllSupplyRemaining({silent:true});
  }catch(e){console.warn('State normalization skipped',e)}
  return state;
}
function openOfflineDb(){
  if(dbReady)return dbReady;
  dbReady=new Promise((resolve)=>{
    if(!('indexedDB' in window)){resolve(null);return;}
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(DB_STORE))db.createObjectStore(DB_STORE,{keyPath:'id'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>resolve(null);
  });
  return dbReady;
}
async function writeOfflineSnapshot(payload){
  try{
    const db=await openOfflineDb();
    if(!db)return;
    const tx=db.transaction(DB_STORE,'readwrite');
    tx.objectStore(DB_STORE).put({id:'latest',updatedAt:new Date().toISOString(),payload});
  }catch(e){console.warn('Offline DB mirror failed',e)}
}
function save(reason='manual'){
  ensureCollections();
  normalizeAppState({silent:true});
  state._meta={build:BUILD,updatedAt:new Date().toISOString(),reason};
  const payload=JSON.stringify(state);
  localStorage.setItem(KEY,payload);
  lastSavedAt=Date.now();
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>writeOfflineSnapshot(payload),250);
}
function flushSave(reason='flush'){
  ensureCollections();
  normalizeAppState({silent:true});
  state._meta={build:BUILD,updatedAt:new Date().toISOString(),reason};
  const payload=JSON.stringify(state);
  localStorage.setItem(KEY,payload);
  writeOfflineSnapshot(payload);
}
function flushCurrentPageAndState(reason='flush'){
  try{autosaveCurrentPage(reason);}catch(e){console.warn('Current page autosave skipped before flush',e)}
  flushSave(reason);
}
window.addEventListener('pagehide',()=>flushCurrentPageAndState('pagehide'));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushCurrentPageAndState('hidden')});
window.addEventListener('online',()=>{state._online=true;save('online')});
window.addEventListener('offline',()=>{state._online=false;save('offline')});
ensureCollections();
repairStateIndexes();
normalizeAppState({silent:true});

function repairStateIndexes(){
  ensureCollections();
  const ids=new Set(Object.keys(state.supplyItems||{}));
  (state.invoices||[]).forEach(inv=>{
    if(!Array.isArray(inv.services))inv.services=[];
    if(!Array.isArray(inv.supplies))inv.supplies=[];
    inv.supplies.forEach(s=>{
      if(s.supplyId && !ids.has(s.supplyId))s.supplyId='';
      s.qty=Number(s.qty||0);
      s.amount=Number(s.amount||0);
    });
    recalcInvoice?.(inv);
  });
  Object.keys(state.supplyItems||{}).forEach(id=>recalcSupplyRemaining?.(id));
}
function firstTab(section){return SECTIONS[section]?.tabs?.[0]?.[0]||''}
function goToFirstTab(section=state.section){if(!SECTIONS[section])section='schedule';state.section=section;state.tabs[section]=firstTab(section);save();render()}
function forceStartupTab(){state.section='schedule';state.tabs.schedule='calendar'}
forceStartupTab();
function applyViewMode(){ensureCollections();const mode=state.settings?.viewMode==='desktop'?'desktop':'mobile';document.body.dataset.view=mode;const btn=document.getElementById('viewModeBtn');if(btn)btn.textContent=mode==='desktop'?'Desktop View':'Mobile View';}
function toggleViewMode(){ensureCollections();state.settings.viewMode=state.settings.viewMode==='desktop'?'mobile':'desktop';applyViewMode();save('view-mode');}
function uid(){return crypto.randomUUID?crypto.randomUUID():'id'+Date.now()+Math.random().toString(16).slice(2)}
function dateKey(d){let x=new Date(d);x.setMinutes(x.getMinutes()-x.getTimezoneOffset());return x.toISOString().slice(0,10)}
function makeKey(y,m,d){return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`}
function parseKey(k){let [y,m,d]=k.split('-').map(Number);return {y,m:m-1,d}}
function ensureDay(k){if(!state.calendarData[k])state.calendarData[k]={agenda:[],tasks:[],notes:''};if(!state.calendarData[k].agenda)state.calendarData[k].agenda=[];if(!state.calendarData[k].tasks)state.calendarData[k].tasks=[];if(state.calendarData[k].notes===undefined)state.calendarData[k].notes='';return state.calendarData[k]}
function setSection(s){autosaveCurrentPage('section-change');if(!SECTIONS[s])s='schedule';state.section=s;state.tabs[s]=firstTab(s);save();render()}
function setTab(t){autosaveCurrentPage('tab-change');ensureCollections();let tabs=SECTIONS[state.section]?.tabs||[];let valid=tabs.some(tab=>tab[0]===t);let next=valid?t:(tabs[0]?.[0]||'');if(state.section==='supplies'&&next==='item'){state.selectedSupplyId='';}state.tabs[state.section]=next;save();render()}
function render(){ensureCollections();applyViewMode();if(!SECTIONS[state.section])state.section='schedule';document.body.dataset.section=state.section;if(!state.tabs[state.section])state.tabs[state.section]=SECTIONS[state.section].tabs[0][0];document.querySelectorAll('.sideTab').forEach(b=>b.classList.toggle('active',b.dataset.section===state.section));subtitle.textContent=SECTIONS[state.section].sub;subtabs.innerHTML=SECTIONS[state.section].tabs.map(t=>`<button class="subtab ${state.tabs[state.section]===t[0]?'active':''}" onclick="setTab('${t[0]}')">${t[1]}</button>`).join('');let tab=SECTIONS[state.section].tabs.find(t=>t[0]===state.tabs[state.section])||SECTIONS[state.section].tabs[0];state.tabs[state.section]=tab[0];if(state.section==='schedule'&&tab[0]==='calendar'){content.innerHTML=renderScheduleCalendar();return}if(state.section==='schedule'&&tab[0]==='newJob'){content.innerHTML=renderJobForm();return}if(state.section==='schedule'&&tab[0]==='newEvent'){content.innerHTML=renderEventForm();return}if(state.section==='schedule'&&tab[0]==='newProject'){content.innerHTML=renderNewProjectForm();setTimeout(()=>setupNewProjectSignaturePad?.(),50);return}if(state.section==='clients'&&tab[0]==='directory'){content.innerHTML=renderClientDirectory();return}if(state.section==='clients'&&tab[0]==='client'){content.innerHTML=renderClientRecord();let inv=findOpenInvoice(state.selectedClient||Object.keys(state.clients||{}).sort()[0]||'');if(inv)setTimeout(()=>setupClientSignaturePad(inv.id),50);return}if(state.section==='clients'&&tab[0]==='invoices'){content.innerHTML=renderClientInvoices();return}if(state.section==='supplies'&&tab[0]==='list'){content.innerHTML=renderSupplyList();return}if(state.section==='supplies'&&tab[0]==='item'){content.innerHTML=renderSupplyItem();return}if(state.section==='supplies'&&tab[0]==='receipts'){content.innerHTML=renderSupplyReceipts();return}if(state.section==='banking'&&tab[0]==='accounts'){content.innerHTML=renderBankingAccounts();return}if(state.section==='banking'&&tab[0]==='trackers'){content.innerHTML=renderBankingTrackers();return}if(state.section==='banking'&&tab[0]==='receipts'){content.innerHTML=renderBankingReceipts();return}if(state.section==='studio'&&tab[0]==='pad'){state.scratchPad.activeTab='pad';content.innerHTML=renderStudioPage();setTimeout(initScratchPad,50);return}if(state.section==='studio'&&tab[0]==='gallery'){state.scratchPad.activeTab='gallery';content.innerHTML=renderStudioPage();return}if(state.section==='studio'&&tab[0]==='mockups'){content.innerHTML=renderMockupBuilder();setTimeout(initMockupBuilder,50);return}content.innerHTML=pageTemplate(state.section,tab)}
function pageTemplate(section,tab){return `<div class="titleRow"><div><h2>${tab[1]}</h2><p>${tab[2]}</p></div><div class="note">Blank Page Template</div></div><div class="box"><p>This page is ready to build next.</p></div>`}
function renderScheduleCalendar(){let y=state.year||now.getFullYear(),m=state.month??now.getMonth();state.year=y;state.month=m;let first=new Date(y,m,1).getDay(),total=new Date(y,m+1,0).getDate(),todayKey=dateKey(new Date());let monthTabs=MONTHS.map((name,i)=>`<button class="monthBtn ${i===m?'active':''}" onclick="setCalendarMonth(${i})">${name}</button>`).join('');let days=['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d=>`<div>${d}</div>`).join('');let grid='';for(let i=0;i<first;i++)grid+=`<div class="calDay blank"></div>`;for(let d=1;d<=total;d++){let k=makeKey(y,m,d),data=ensureDay(k),agenda=data.agenda||[];let previews=agenda.slice(0,3).map(item=>`<div class="preview ${item.canceled?'canceled':''}">${formatTime(item.time)}: ${escapeHtml(item.title||'')}</div>`).join('');if(agenda.length>3)previews+=`<div class="preview">+${agenda.length-3} more</div>`;grid+=`<div class="calDay ${k===state.selectedDate?'selected':''} ${k===todayKey?'today':''}" onclick="openCalendarDay('${k}')"><div class="dayNum">${d}</div>${previews}</div>`}let selectedData=ensureDay(state.selectedDate),selectedDateObj=new Date(state.selectedDate+'T12:00:00');return `<div class="monthTabs">${monthTabs}</div><div class="calendarTitle"><button onclick="changeCalendarYear(-1)">‹ ${y-1}</button><h2>${FULL_MONTHS[m]} ${y}</h2><button onclick="changeCalendarYear(1)">${y+1} ›</button></div><div class="weekdays">${days}</div><div class="calendarGrid">${grid}</div><div class="dayBottom compactDayBottom"><div class="dailyBox compactDailyBox"><h3>${selectedDateObj.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric',year:'numeric'})}</h3><h4>Agenda</h4><div class="compactScrollArea">${selectedData.agenda.map((item,idx)=>`<div class="agendaRow ${item.canceled?'canceled':''}"><span>${formatTime(item.time)}: ${escapeHtml(item.title||'')}</span><button class="smallBtn" onclick="toggleCancel(${idx})">×</button></div>`).join('')||'<p class="note">No agenda items yet.</p>'}</div><div class="addRow compactAddRow"><input id="newAgendaTime"><input id="newAgendaTitle"><button onclick="addAgenda()">Add</button></div></div><div class="dailyBox compactDailyBox"><h4>Tasks</h4><div class="compactScrollArea">${selectedData.tasks.map((task,idx)=>`<div class="taskRow ${task.done?'done':''}"><input type="checkbox" ${task.done?'checked':''} onchange="updateTask(${idx},'done',this.checked)"><input type="text" value="${escapeHtml(task.text||'')}" oninput="updateTask(${idx},'text',this.value)"><button class="smallBtn" onclick="deleteTask(${idx})">×</button></div>`).join('')||'<p class="note">No tasks yet.</p>'}</div><div class="addTaskRow compactAddRow"><input id="newTaskText"><button onclick="addTask()">Add</button></div><textarea class="notesArea compactNotesArea" placeholder="Notes" oninput="updateNotes(this.value)">${escapeHtml(selectedData.notes||'')}</textarea></div></div>${scheduleDayPanelHtml()}${renderTimeCardModule()}${renderReminderModule()}`}
function renderJobForm(){let names=Object.keys(state.clients||{}).sort();let draft=state.drafts?.newJob||{};return `<div class="titleRow"><div><h2>${state.editingAgenda?.type==='job'?'Edit Job Entry':'New Job Entry'}</h2><p>${state.editingAgenda?.type==='job'?'Update this scheduled job entry.':'Saves to calendar, creates client file, and starts/updates client invoice.'}</p></div><div class="note">Schedule / Job</div></div><div class="box"><datalist id="clientNames">${names.map(n=>`<option value="${escapeHtml(n)}"></option>`).join('')}</datalist><label>Date</label><input id="jobDate" type="date" value="${escapeHtml(draft.date||state.selectedDate)}"><label>Job Status</label><select id="jobStatus"><option value="scheduled" ${draft.status==='scheduled'?'selected':''}>Scheduled Job</option><option value="completed" ${draft.status==='completed'?'selected':''}>Completed Job</option></select><label>Title / Service</label><input id="jobTitle" value="${escapeHtml(draft.title||'')}"><div class="two"><div><label>Time In</label><input id="jobStart" value="${escapeHtml(draft.time||'')}" oninput="calcJobPay()"></div><div><label>Time Out</label><input id="jobEnd" value="${escapeHtml(draft.end||'')}" oninput="calcJobPay()"></div></div><label>Total Hours</label><input id="jobHours" type="number" step="0.25" value="${escapeHtml(draft.hours||'')}" oninput="calcJobPay()"><div class="two"><div><label>Pay Type</label><select id="jobPayType" onchange="calcJobPay()"><option value="hourly" ${draft.payType!=='flat'?'selected':''}>Hourly</option><option value="flat" ${draft.payType==='flat'?'selected':''}>Flat Rate</option></select></div><div><label>Rate / Flat Amount</label><input id="jobRate" type="number" step="0.01" value="${escapeHtml(draft.rate||'')}" oninput="calcJobPay()"></div></div><label>Total Price</label><input id="jobOwed" type="number" step="0.01" value="${escapeHtml(draft.owed||'')}" readonly><label>Amount Received</label><input id="jobReceived" type="number" step="0.01" value="${escapeHtml(draft.received||'')}"><label>Client / Contact Name</label><input id="jobClient" list="clientNames" autocomplete="off" value="${escapeHtml(draft.client||'')}" oninput="handleClientPredictiveInput('jobClient','job')" onfocus="showClientSuggestions('jobClient','job')"><div id="jobClientSuggest" class="suggestBox"></div><label>Phone</label><input id="jobPhone" value="${escapeHtml(draft.phone||'')}"><label>Address</label><input id="jobAddress" value="${escapeHtml(draft.address||'')}"><div class="actions"><button type="button" onclick="pinCurrentJobLocation()">Pin Current Location</button><button type="button" onclick="openJobAddressMap()">Open Map</button></div><input id="jobLocationPin" type="hidden" value="${escapeHtml(draft.locationPin||'')}"><p id="jobLocationNote" class="note">${draft.locationPin?'Pinned location saved.':''}</p><label>Notes</label><textarea id="jobNotes">${escapeHtml(draft.notes||'')}</textarea><div class="actions"><button class="save" onclick="saveJob()">${state.editingAgenda?.type==='job'?'Update Job':'Save Job'}</button><button onclick="setTab('calendar')">Back</button></div></div>`}
function renderEventForm(){let draft=state.drafts?.newEvent||{};return `<div class="titleRow"><div><h2>${state.editingAgenda?.type==='event'?'Edit Event Entry':'New Event Entry'}</h2><p>${state.editingAgenda?.type==='event'?'Update this calendar event.':'Add personal events. Events show on the calendar but do not count as jobs.'}</p></div><div class="note">Schedule / Event</div></div><div class="box"><label>Date</label><input id="eventDate" type="date" value="${escapeHtml(draft.date||state.selectedDate)}"><label>Title</label><input id="eventTitle" value="${escapeHtml(draft.title||'')}"><label>Time</label><input id="eventTime" value="${escapeHtml(draft.time||'')}"><label>Location</label><input id="eventLocation" value="${escapeHtml(draft.location||'')}"><label>Notes</label><textarea id="eventNotes">${escapeHtml(draft.notes||'')}</textarea><div class="actions"><button class="save" onclick="saveEvent()">${state.editingAgenda?.type==='event'?'Update Event':'Save Event'}</button><button onclick="setTab('calendar')">Back</button></div></div>`}
function renderClientDirectory(){syncClientsFromJobs();let names=Object.keys(state.clients||{}).sort((a,b)=>a.localeCompare(b));return `<div class="titleRow"><div><h2>Client Directory</h2><p>Alphabetical list. Tap a client to open their file.</p></div><div class="actions"><button class="save" onclick="openNewClientJob()">+ Add Client</button><div class="note">${names.length} clients</div></div></div><div class="clientList">${names.map(n=>{let t=clientTotals(n);return `<div class="clientCard" onclick="openClient('${escapeAttr(n)}')"><b>${escapeHtml(n)}</b><small>${escapeHtml(state.clients[n].phone||'')} ${escapeHtml(state.clients[n].address||'')}</small><br><small>${t.hours.toFixed(2)} hrs • Paid ${money(t.paid)} • Owed ${money(t.balance)}</small></div>`}).join('')||'<p class="note">No clients yet. Save a job with a client name to auto-create one.</p>'}</div>`}
function renderClientRecord(){syncClientsFromJobs();let n=state.selectedClient||Object.keys(state.clients||{}).sort()[0]||'';state.selectedClient=n;if(!n)return `<div class="titleRow"><div><h2>Client Record</h2><p>No client selected yet.</p></div></div>`;let c=state.clients[n]||{},t=clientTotals(n),jobs=jobsForClient(n);let inv=findOpenInvoice(n);return `<div class="titleRow"><div><h2>${escapeHtml(n)}</h2><p>Client file, current invoice, and job history.</p></div><button onclick="setTab('directory')">Directory</button></div><div class="trackers"><div class="tracker">Hours<b>${t.hours.toFixed(2)}</b></div><div class="tracker">Charged<b>${money(t.charged)}</b></div><div class="tracker">Paid<b>${money(t.paid)}</b></div><div class="tracker">Balance<b>${money(t.balance)}</b></div></div><div class="box"><label>Name</label><input id="clientNameEdit" value="${escapeHtml(n)}" autocomplete="off" oninput="handleClientPredictiveInput('clientNameEdit','clientEdit')" onfocus="showClientSuggestions('clientNameEdit','clientEdit')"><div id="clientNameEditSuggest" class="suggestBox"></div><label>Phone</label><input id="clientPhoneEdit" value="${escapeHtml(c.phone||'')}"><label>Address</label><input id="clientAddressEdit" value="${escapeHtml(c.address||'')}"><label>Notes</label><textarea id="clientNotesEdit">${escapeHtml(c.notes||'')}</textarea><div class="actions"><button class="save" onclick="saveClientEdit()">Save Client</button></div></div><h3>Current Invoice</h3><div id="clientInvoiceEmbed" class="clientInvoiceEmbed">${inv?clientInvoiceEmbedHtml(inv):`<div class="box"><p class="note">No current invoice for this client.</p><button class="save" onclick="createInvoiceForSelectedClient()">+ Start Invoice</button></div>`}</div><h3>Job History</h3><div class="clientList">${jobs.map(j=>`<div class="historyCard"><b>${escapeHtml(j.date)} — ${formatTime(j.time)}: ${escapeHtml(j.title)}</b><small>${j.status||''} • ${Number(j.hours||0).toFixed(2)} hrs • Charged ${money(j.owed)} • Paid ${money(j.received)}</small></div>`).join('')||'<p class="note">No jobs for this client yet.</p>'}</div>`}
function renderClientInvoices(){ensureCollections();let invoices=state.invoices||[];return `<div class="titleRow"><div><h2>Invoices</h2><p>Create, sign, send, and store payment receipts.</p></div><button class="save" onclick="newInvoice()">+ New Invoice</button></div><div class="clientList">${invoices.map(inv=>`<div class="invoiceCard ${invoiceStatusClass(inv)}" onclick="openInvoice('${inv.id}')"><b>#${inv.number} — ${escapeHtml(inv.client||'No Client')}</b><small>${escapeHtml(inv.date||'')} • ${getInvoiceStatus(inv)}</small><br><small>Total ${money(inv.total)} • Paid ${money(inv.paid)} • Balance ${money(invoiceBalance(inv))}</small></div>`).join('')||'<p class="note">No invoices yet. Save a job with a client to auto-start one, or tap New Invoice.</p>'}</div>`}

function renderSupplyList(){
 ensureCollections();
 let items=getSupplyArray();
 return `<div class="titleRow"><div><h2>Supplies List</h2><p>Tap Add for quick entry, or tap + Add Item to open the full blank item form.</p></div><div class="actions"><button class="save" type="button" onclick="openQuickSupplyModal()">Add</button><button class="save" type="button" onclick="newSupplyItem()">+ Add Item</button></div></div><div class="box"><div class="supplyHeader"><b>Item #</b><b>Item Name</b><b>Qty Remaining</b><b>Action</b></div>${items.map(item=>`<div class="supplyRowList"><span onclick="openSupplyItem('${item.id}')">${item.itemNumber}</span><span onclick="openSupplyItem('${item.id}')">${escapeHtml(item.name||'Untitled Supply')}</span><span onclick="openSupplyItem('${item.id}')">${formatQty(item.quantityRemaining,item.unit)}</span><button class="delete smallBtn" type="button" onclick="deleteSupplyItemFromList(event,'${item.id}')">Delete</button></div>`).join('')||'<p class="note">No supplies yet. Tap Add for quick entry or + Add Item for the full form.</p>'}</div><div id="quickSupplyModal" class="quickSupplyOverlay hidden" onclick="closeQuickSupplyModal(event)"><div class="quickSupplyBox" onclick="event.stopPropagation()"><div class="titleRow miniTitle"><div><h3>Quick Add Supply</h3><p class="note">Enter the basic item info. You can fill in more details later.</p></div><button class="smallBtn" type="button" onclick="closeQuickSupplyModal()">×</button></div><label>Item Name</label><input id="quickSupplyName" placeholder="Example: String" onkeydown="quickSupplyKey(event)"><label>Price / Cost</label><input id="quickSupplyPrice" type="number" step="0.01" placeholder="Example: 11.99" onkeydown="quickSupplyKey(event)"><div class="actions"><button class="save" type="button" onclick="addQuickSupplyFromList()">Save Item</button><button type="button" onclick="closeQuickSupplyModal()">Cancel</button></div></div></div>`
}
function renderSupplyItem(){ensureCollections();let item=getSelectedSupply();if(!item){item=createBlankSupplyItemDraft();}calcSupplyUnitPrice(item.id,{silent:true});recalcSupplyRemaining(item.id,{silent:true});let t=supplyTotals(item.id);return `<div class="titleRow"><div><h2>${escapeHtml(item.name)}</h2><p>Supply item record + inventory tracker.</p></div><button onclick="setTab('list')">Supply List</button></div><div class="trackers"><div class="tracker">YTD Spent<b>${money(t.spent)}</b></div><div class="tracker">YTD Used<b>${formatQty(t.used,item.unit)}</b></div><div class="tracker">Remaining<b>${formatQty(item.quantityRemaining,item.unit)}</b></div><div class="tracker">Cost/Unit<b>${money(item.pricePerUnit)}</b></div></div><div class="box"><div class="supplyDetailGrid"><div><label>Picture</label><input type="file" accept="image/*" capture="environment" onchange="attachSupplyPhoto(event,'${item.id}')">${item.photo?`<img class="photo supplyPhoto" src="${item.photo}">`:`<div class="photoPlaceholder">No Picture</div>`}</div><div><label>Item #</label><input id="sItemNumber" value="${escapeHtml(item.itemNumber||'')}" readonly><label>Item Name</label><input id="sName" value="${escapeHtml(item.name||'')}" oninput="updateSupplyField('${item.id}','name',this.value)"><label>Description</label><textarea id="sDesc" oninput="updateSupplyField('${item.id}','description',this.value)">${escapeHtml(item.description||'')}</textarea><label>Supplier / Store / Website</label><input id="sSupplier" value="${escapeHtml(item.supplier||'')}" oninput="updateSupplyField('${item.id}','supplier',this.value)"></div></div><h3>Product / Cost Info</h3><label>Actual Store Item Number / SKU</label><div class="two"><input id="sStoreNumber" value="${escapeHtml(item.storeItemNumber||'')}" oninput="updateSupplyField('${item.id}','storeItemNumber',this.value)"><button onclick="scanBarcode('${item.id}')">Scan</button></div><div class="two"><div><label>Cost</label><input id="sPrice" type="number" step="0.01" value="${escapeHtml(item.price||'')}" oninput="updateSupplyField('${item.id}','price',this.value);calcSupplyUnitPrice('${item.id}')"></div><div><label>Amount Of Item For That Cost</label><input id="sQtyForPrice" type="number" step="0.01" value="${escapeHtml(item.quantityForPrice||'')}" oninput="updateSupplyField('${item.id}','quantityForPrice',this.value);calcSupplyUnitPrice('${item.id}')"></div></div><div class="two"><div><label>Unit</label><input id="sUnit" value="${escapeHtml(item.unit||'unit')}" oninput="updateSupplyField('${item.id}','unit',this.value)"></div><div><label>Cost Per Unit</label><input id="sPricePerUnit" type="number" step="0.01" value="${formatMoneyInput(item.pricePerUnit)}" readonly></div></div><h3>Add Inventory</h3><p class="note">Add the amount being added to inventory. Remaining quantity auto-calculates from inventory added minus invoice usage.</p><div class="two"><div><label>Quantity / Amount Added</label><input id="invAddQty" type="number" step="0.01"></div><div><label>Date</label><input id="invAddDate" value="${new Date().toLocaleDateString()}"></div></div><button class="save" type="button" onclick="addInventoryToSupply('${item.id}')">Add Inventory</button><label>Quantity Remaining / Physical Count</label><input id="sRemaining" type="number" step="0.01" value="${escapeHtml(item.quantityRemaining||0)}" oninput="previewSupplyRemaining('${item.id}',this.value)" onblur="commitSupplyRemainingCorrection('${item.id}',this.value)"><p class="note">Edit this only after a physical count. Invoice usage still subtracts automatically.</p><div class="actions"><button class="save" type="button" onclick="saveSupplyItem('${item.id}')">Save Item</button><button class="delete" type="button" onclick="deleteSupplyItem('${item.id}')">Delete</button></div></div>`}
function renderSupplyInventory(){ensureSupplyDbFromNames();let items=getSupplyArray();return `<div class="titleRow"><div><h2>Inventory</h2><p>All supplies and remaining quantity.</p></div></div><div class="box"><div class="supplyHeader"><b>Item</b><b>Remaining</b><b>Value Left</b></div>${items.map(item=>`<div class="supplyRowList" onclick="openSupplyItem('${item.id}')"><span>${escapeHtml(item.name)}</span><span>${formatQty(item.quantityRemaining,item.unit)}</span><span>${money(Number(item.quantityRemaining||0)*Number(item.pricePerUnit||0))}</span></div>`).join('')||'<p class="note">No inventory yet.</p>'}</div>`}
function renderSupplyReceipts(){let receipts=state.supplyReceipts||[];return `<div class="titleRow"><div><h2>Supply Receipts</h2><p>Take receipt pictures and categorize purchases.</p></div><button class="save" onclick="newSupplyReceipt()">+ Add Receipt</button></div><div class="clientList">${receipts.map(r=>`<div class="invoiceCard" onclick="openSupplyReceipt('${r.id}')"><b>${escapeHtml(r.title||'Receipt')}</b><small>${escapeHtml(r.date||'')} • ${escapeHtml(r.category||'Uncategorized')} • ${money(r.amount)}</small></div>`).join('')||'<p class="note">No receipts yet.</p>'}</div>`}

function readSupplyFormIntoState(id){
 let item=state.supplyItems?.[id];
 if(!item)return null;
 let fields=[
  ['sName','name'],['sDesc','description'],['sSupplier','supplier'],['sStoreNumber','storeItemNumber'],
  ['sPrice','price'],['sQtyForPrice','quantityForPrice'],['sUnit','unit']
 ];
 fields.forEach(([elId,key])=>{
  let el=document.getElementById(elId);
  if(el)item[key]=el.value;
 });
 item.name=String(item.name||'').trim();
 item.unit=String(item.unit||'').trim()||'unit';
 return item;
}
function finalizeSupplyItemName(item){
 if(!item)return '';
 item.name=String(item.name||'').trim()||`Supply ${item.itemNumber||''}`.trim()||'Untitled Supply';
 return item.name;
}
function createBlankSupplyItemDraft(){
 ensureCollections();
 let id=uid();
 let number=nextSupplyNumber();
 let item={id,itemNumber:number,name:'',description:'',storeItemNumber:'',price:'',quantityForPrice:'',unit:'unit',pricePerUnit:'',quantityRemaining:0,supplier:'',photo:'',inventoryLog:[],isDraft:true};
 state.supplyItems[id]=item;
 state.selectedSupplyId=id;
 save();
 return item;
}

function saveSupplyItem(id){
 let item=readSupplyFormIntoState(id);
 if(!item)return;
 finalizeSupplyItemName(item);
 item.isDraft=false;
 calcSupplyUnitPrice(id);
 recalcSupplyRemaining(id);
 addSupplyToDb(item.name);
 adminRecord('supply.save',`Supply saved: ${item.name}`,{itemNumber:item.itemNumber,name:item.name,cost:item.price,quantityForPrice:item.quantityForPrice,costPerUnit:item.pricePerUnit,remaining:item.quantityRemaining});
 goToFirstTab('supplies');
}
function newSupplyItem(){ensureCollections();createBlankSupplyItemDraft();state.section='supplies';state.tabs.supplies='item';save();render()}
function openQuickSupplyModal(){
 let modal=document.getElementById('quickSupplyModal');
 if(!modal)return;
 modal.classList.remove('hidden');
 setTimeout(()=>document.getElementById('quickSupplyName')?.focus(),30);
}
function closeQuickSupplyModal(event){
 if(event && event.target && event.currentTarget && event.target!==event.currentTarget)return;
 let modal=document.getElementById('quickSupplyModal');
 if(modal)modal.classList.add('hidden');
}
function quickSupplyKey(event){
 if(event && event.key==='Enter'){
   event.preventDefault();
   addQuickSupplyFromList();
 }
 if(event && event.key==='Escape'){
   event.preventDefault();
   closeQuickSupplyModal();
 }
}
function addQuickSupplyFromList(){
 ensureCollections();
 let name=String(document.getElementById('quickSupplyName')?.value||'').trim();
 let price=toNumber(document.getElementById('quickSupplyPrice')?.value,0);
 if(!name){alert('Enter an item name first.');return;}
 if(price<0){alert('Price cannot be negative.');return;}
 let existing=findSupplyByName(name);
 if(existing){state.selectedSupplyId=existing.id;state.section='supplies';state.tabs.supplies='item';save('quick-supply-existing');render();return;}
 let id=uid();
 let number=nextSupplyNumber();
 let item={id,itemNumber:number,name,description:'',storeItemNumber:'',price:price?price:'',quantityForPrice:price?1:'',unit:'unit',pricePerUnit:price?formatMoneyInput(price):'',quantityRemaining:0,supplier:'',photo:'',inventoryLog:[],isDraft:false};
 state.supplyItems[id]=item;
 calcSupplyUnitPrice(id,{silent:true});
 recalcSupplyRemaining(id,{silent:true});
 addSupplyToDb(name);
 save('quick-supply-add');
 render();
}
function deleteSupplyItemFromList(event,id){
 if(event)event.stopPropagation();
 deleteSupplyItem(id);
}

function openSupplyItem(id){state.selectedSupplyId=id;state.tabs.supplies='item';save();render()}
function getSelectedSupply(){return state.supplyItems?.[state.selectedSupplyId]||null}
function getSupplyArray(){ensureCollections();return Object.values(state.supplyItems||{}).filter(item=>!item.isDraft).sort((a,b)=>Number(a.itemNumber||0)-Number(b.itemNumber||0))}
function nextSupplyNumber(){
 ensureCollections();
 let max=Object.values(state.supplyItems||{}).reduce((highest,item)=>Math.max(highest,Number(item.itemNumber||0)),0);
 let next=Math.max(Number(state.supplyCounter||1),max+1);
 state.supplyCounter=next+1;
 return next;
}

function ensureSupplyDbFromNames(){
 ensureCollections();
 let names=new Set();
 (state.supplies||[]).forEach(name=>{name=String(name||'').trim();if(name)names.add(name)});
 Object.values(state.supplyItems||{}).forEach(item=>{let name=String(item.name||'').trim();if(name&&!item.isDraft)names.add(name)});
 state.supplies=Array.from(names).sort((a,b)=>a.localeCompare(b));
 return state.supplies;
}
function supplyDatalistOptions(){
 return ensureSupplyDbFromNames().map(s=>`<option value="${escapeHtml(s)}"></option>`).join('');
}
function createSupplyFromInvoiceName(name){
 ensureCollections();
 name=String(name||'').trim();
 if(!name)return null;
 let existing=findSupplyByName(name);
 if(existing)return existing;
 let id=uid();
 let item={id,itemNumber:nextSupplyNumber(),name,description:'Created from invoice supply entry',storeItemNumber:'',price:'',quantityForPrice:'',unit:'unit',pricePerUnit:'',quantityRemaining:0,supplier:'',photo:'',inventoryLog:[],isDraft:false};
 state.supplyItems[id]=item;
 addSupplyToDb(name);
 return item;
}
function getSupplyUnitCost(item){
 if(!item)return 0;
 let cached=toNumber(item.pricePerUnit,0);
 if(cached>0)return cached;
 let cost=toNumber(item.price,0);
 let amount=toNumber(item.quantityForPrice,0);
 if(cost>0 && amount>0){
   item.pricePerUnit=formatMoneyInput(cost/amount);
   return toNumber(item.pricePerUnit,0);
 }
 return 0;
}
function getInvoiceSupplyUnitCost(item){
 // Invoice charges use displayed currency precision. This prevents hidden 4-decimal
 // unit costs from making invoice totals disagree with the visible line math.
 return normalizeMoneyNumber(getSupplyUnitCost(item),2);
}
function calcSupplyLineAmount(name,qty){
 let item=findSupplyByName(name,{includeDrafts:true});
 return item?normalizeMoneyNumber(getInvoiceSupplyUnitCost(item)*toNumber(qty,0),2):0;
}
function supplyLineMeta(line){
 let item=line?.supplyId?state.supplyItems?.[line.supplyId]:findSupplyByName(line?.name,{includeDrafts:true});
 let unit=item?.unit||line?.unit||'unit';
 let pricePerUnit=item?getInvoiceSupplyUnitCost(item):normalizeMoneyNumber(line?.pricePerUnit,2);
 return {item,unit,pricePerUnit};
}
function recalcSupplyLine(line){
 if(!line)return line;
 let meta=supplyLineMeta(line);
 line.qty=Math.max(toNumber(line.qty,0),0);
 line.unit=meta.unit;
 line.pricePerUnit=normalizeMoneyNumber(meta.pricePerUnit,2);
 line.amount=normalizeMoneyNumber(line.qty*line.pricePerUnit,2);
 if(meta.item){line.supplyId=meta.item.id;line.name=meta.item.name;meta.item.isDraft=false;addSupplyToDb(meta.item.name);}
 return line;
}
function invoiceSupplyLineHtml(inv,line,idx,mode){
 let meta=supplyLineMeta(line);
 let prefix=mode==='client'?'clientInv':'fullInv';
 return `<div class="lineItem supplyLine"><span>${escapeHtml(line.name)}<small>${Number(line.qty||0)} ${escapeHtml(meta.unit)} × ${money(meta.pricePerUnit)} / ${escapeHtml(meta.unit)}</small></span><input aria-label="Quantity used" type="number" step="0.01" value="${Number(line.qty||0)}" oninput="updateInvoiceSupplyQty('${inv.id}',${idx},this.value,'${mode}')"><input aria-label="Supply cost" type="number" step="0.01" value="${Number(line.amount||0).toFixed(2)}" oninput="updateInvoiceLine('${inv.id}','supplies',${idx},this.value)"><button class="smallBtn" type="button" onclick="${mode==='client'?'removeClientInvoiceLine':'removeInvoiceLine'}('${inv.id}','supplies',${idx})">×</button></div>`;
}
function invoiceSupplyAddHtml(inv,mode){
 let nameId=mode==='client'?'clientNewSupplyName':'newSupplyName';
 let qtyId=mode==='client'?'clientNewSupplyQty':'newSupplyQty';
 let dataId=mode==='client'?'clientSupplyOptions':'supplyOptions';
 let addFn=mode==='client'?'addClientInvoiceSupply':'addInvoiceSupply';
 return `<datalist id="${dataId}">${supplyDatalistOptions()}</datalist><div class="invoiceSupplyAdd"><div><label>Supply Item Used</label><input id="${nameId}" list="${dataId}" placeholder="Type new or choose saved supply" value="${escapeHtml(state.drafts?.invoiceEditor?.[inv.id]?.newSupplyName||'')}"></div><div><label>Amount Used</label><input id="${qtyId}" type="number" step="0.01" placeholder="Qty used" value="${escapeHtml(state.drafts?.invoiceEditor?.[inv.id]?.newSupplyQty||'')}"></div><button class="save" type="button" onclick="${addFn}('${inv.id}')">Add Supply</button></div><p class="note">Saved supplies auto-calculate cost from Cost Per Unit. New typed supplies are added to the supply list with $0 cost until their product cost info is filled in.</p>`;
}

function toNumber(value, fallback=0){
 let n=Number(value);
 return Number.isFinite(n)?n:fallback;
}
function normalizeMoneyNumber(value, places=2){
 const factor=Math.pow(10,places);
 const n=toNumber(value,0);
 return Math.round((n+Number.EPSILON)*factor)/factor;
}
function formatMoneyInput(value){
 const n=toNumber(value,0);
 if(!Number.isFinite(n) || n===0)return '';
 return normalizeMoneyNumber(n,2).toFixed(2);
}
function normalizeCents(value){
 return Math.round((toNumber(value,0)+Number.EPSILON)*100);
}
function centsToMoney(cents){
 return normalizeMoneyNumber(toNumber(cents,0)/100,2);
}
function updateSupplyField(id,key,value){
 let item=state.supplyItems[id];
 if(!item)return;
 item[key]=value;
 let hasName=String(item.name||'').trim();
 if(hasName){item.isDraft=false;addSupplyToDb(item.name);}
 if(['price','quantityForPrice'].includes(key))calcSupplyUnitPrice(id,{silent:true});
 if(key==='unit'){
   (state.invoices||[]).forEach(inv=>{
     (inv.supplies||[]).forEach(line=>{
       if(line.supplyId===id){recalcSupplyLine(line);}
     });
     normalizeInvoice(inv,{silent:true});
   });
 }
 recalcSupplyRemaining(id,{silent:true});
 save('supply-field');
 refreshSupplyTrackers(id);
}
function calcSupplyUnitPrice(id,opts={}){
 let item=state.supplyItems[id];
 if(!item)return;
 let cost=toNumber(item.price,0);
 let amount=toNumber(item.quantityForPrice,0);
 item.pricePerUnit=(cost>0 && amount>0)?formatMoneyInput(cost/amount):'';
 if(String(item.name||'').trim())item.isDraft=false;
 let el=document.getElementById('sPricePerUnit');
 if(el)el.value=formatMoneyInput(item.pricePerUnit);
 if(!opts.silent)save('supply-unit-price');
 return item.pricePerUnit;
}
async function attachSupplyPhoto(e,id){
 const file=e.target.files?.[0];
 if(!file)return;
 const input=e.target;
 input.disabled=true;
 try{
   const item=state.supplyItems[id];
   if(item){
     item.photo=await resizeImageDataUrl(file,1200,.72);
     save('supply-photo-compressed');
     render();
   }
 }catch(err){
   console.error(err);
   alert('The supply photo could not be saved. Try a smaller image.');
 }finally{
   input.disabled=false;
 }
}
function deleteSupplyItem(id){ensureCollections();let item=state.supplyItems[id];if(!item)return;let used=(state.invoices||[]).some(inv=>(inv.supplies||[]).some(s=>s.supplyId===id));let msg=used?'This supply is already used on at least one invoice. Delete it from the supply list anyway? Existing invoices will keep their line item history.':'Delete this supply item?';if(!confirm(msg))return;delete state.supplyItems[id];state.supplies=(state.supplies||[]).filter(name=>String(name||'').trim().toLowerCase()!==String(item.name||'').trim().toLowerCase() || findSupplyByName(name));if(state.selectedSupplyId===id)state.selectedSupplyId='';state.section='supplies';state.tabs.supplies='list';save('supply-delete');render()}
function supplyTotals(id){
 let item=state.supplyItems[id];
 if(!item)return{spent:0,used:0,purchased:0};
 let spent=0,used=0,purchased=0;
 (item.inventoryLog||[]).forEach(log=>{
   purchased+=toNumber(log.qty,0);
   spent+=toNumber(log.cost,0);
 });
 (state.supplyReceipts||[]).forEach(r=>{
   (r.items||[]).forEach(i=>{
     if(i.supplyId===id){purchased+=toNumber(i.qty,0);spent+=toNumber(i.amount,0);}
   });
 });
 (state.invoices||[]).forEach(inv=>{
   (inv.supplies||[]).forEach(s=>{
     if(s.supplyId===id || String(s.name||'').trim().toLowerCase()===String(item.name||'').trim().toLowerCase())used+=toNumber(s.qty,0);
   });
 });
 return{spent:normalizeMoneyNumber(spent),used,purchased};
}
function findSupplyByName(name,opts={}){
 ensureCollections();
 let target=String(name||'').trim().toLowerCase();
 if(!target)return null;
 return Object.values(state.supplyItems||{}).find(item=>(opts.includeDrafts||!item.isDraft)&&String(item.name||'').trim().toLowerCase()===target)||null;
}
function recalcSupplyRemaining(id,opts={}){
 let item=state.supplyItems?.[id];
 if(!item)return;
 if(!item.inventoryLog)item.inventoryLog=[];
 calcSupplyUnitPrice(id,{silent:true});
 let totals=supplyTotals(id);
 item.quantityRemaining=Math.max(toNumber(totals.purchased,0)-toNumber(totals.used,0),0);
 item.quantityRemaining=Number(roundMoney(item.quantityRemaining,4));
 let el=document.getElementById('sRemaining');
 if(el && state.selectedSupplyId===id)el.value=item.quantityRemaining;
 if(!opts.silent)save('supply-remaining');
 return item.quantityRemaining;
}
function recalcAllSupplyRemaining(opts={}){ensureCollections();Object.keys(state.supplyItems||{}).forEach(id=>recalcSupplyRemaining(id,{silent:true}));if(!opts.silent)save('all-supply-remaining');}
function refreshSupplyTrackers(id){
 let item=state.supplyItems?.[id];
 if(!item)return;
 let t=supplyTotals(id);
 document.querySelectorAll('.tracker b').forEach(()=>{});
 let unitEl=document.getElementById('sPricePerUnit'); if(unitEl)unitEl.value=formatMoneyInput(item.pricePerUnit);
 let remEl=document.getElementById('sRemaining'); if(remEl)remEl.value=item.quantityRemaining||0;
}
function previewSupplyRemaining(id,value){
 let el=document.getElementById('sRemaining');
 if(el)el.value=value;
}
function commitSupplyRemainingCorrection(id,value){
 let item=readSupplyFormIntoState(id);
 if(!item)return;
 let desired=toNumber(value,0);
 if(desired<0){desired=0;}
 let totals=supplyTotals(id);
 let current=toNumber(totals.purchased,0)-toNumber(totals.used,0);
 let adjustment=Number(roundMoney(desired-current,4));
 if(Math.abs(adjustment)>0.0001){
   if(!item.inventoryLog)item.inventoryLog=[];
   item.inventoryLog.push({id:uid(),qty:adjustment,date:new Date().toLocaleDateString(),cost:0,type:'physical-count-correction',note:'Manual quantity remaining correction'});
 }
 item.isDraft=false;
 finalizeSupplyItemName(item);
 recalcSupplyRemaining(id,{silent:true});
 addSupplyToDb(item.name);
 save('supply-physical-count');
 render();
}
function addInventoryToSupply(id){
 let item=readSupplyFormIntoState(id);
 if(!item)return;
 let qty=toNumber(document.getElementById('invAddQty')?.value,0);
 if(!qty || qty<0){alert('Enter a quantity greater than 0.');return;}
 finalizeSupplyItemName(item);
 calcSupplyUnitPrice(id,{silent:true});
 if(!item.inventoryLog)item.inventoryLog=[];
 item.inventoryLog.push({id:uid(),qty,date:document.getElementById('invAddDate')?.value||new Date().toLocaleDateString(),cost:normalizeMoneyNumber(toNumber(item.pricePerUnit,0)*qty),type:'inventory-add'});
 item.isDraft=false;
 recalcSupplyRemaining(id,{silent:true});
 addSupplyToDb(item.name);
 adminRecord('supply.inventory',`Inventory added: ${item.name}`,{name:item.name,quantityAdded:qty,cost:normalizeMoneyNumber(toNumber(item.pricePerUnit,0)*qty),remaining:item.quantityRemaining});
 save('supply-inventory-add');
 state.section='supplies';state.tabs.supplies='item';state.selectedSupplyId=id;
 render();
}
function formatQty(q,unit){if(q===''||q===undefined||q===null)return'—';return `${Number(q||0)} ${unit||'unit'}`}
function newSupplyReceipt(){let id=uid();let r={id,title:'New Receipt',date:new Date().toLocaleDateString(),category:'Yard Supplies',amount:0,image:'',items:[]};state.supplyReceipts.push(r);save();openSupplyReceipt(id)}
function openSupplyReceipt(id){let r=state.supplyReceipts.find(x=>x.id===id);if(!r)return;content.innerHTML=`<div class="titleRow"><div><h2>${escapeHtml(r.title||'Receipt')}</h2><p>${escapeHtml(r.date||'')} • ${escapeHtml(r.category||'')}</p></div><button onclick="setTab('receipts')">Back</button></div><div class="box"><label>Receipt Name</label><input id="receiptTitle" value="${escapeHtml(r.title||'')}" oninput="updateReceipt('${id}','title',this.value)"><label>Date</label><input id="receiptDate" value="${escapeHtml(r.date||'')}" oninput="updateReceipt('${id}','date',this.value)"><label>Category</label><input id="receiptCategory" value="${escapeHtml(r.category||'')}" oninput="updateReceipt('${id}','category',this.value)"><label>Total Price</label><input id="receiptAmount" type="number" step="0.01" value="${Number(r.amount||0)}" oninput="updateReceipt('${id}','amount',this.value)"><label>Receipt Photo</label><input type="file" accept="image/*" capture="environment" onchange="attachReceiptPhoto(event,'${id}')">${r.image?`<img class="photo" src="${r.image}">`:''}<div class="actions"><button class="save" onclick="saveSupplyReceiptAndReturn('${id}')">Save Receipt</button><button onclick="setTab('receipts')">Back</button><button class="delete" onclick="deleteReceipt('${id}')">Delete</button></div></div>`}
function saveSupplyReceiptAndReturn(id){
 const r=state.supplyReceipts.find(x=>x.id===id);
 if(r){
   adminRecord?.('supply.receipt.save',`Supply receipt saved: ${r.title||'Receipt'}`,{date:r.date,amount:r.amount,category:r.category,hasImage:!!r.image});
 }
 save('supply-receipt-save-return');
 state.section='supplies';
 state.tabs.supplies='receipts';
 render();
}
function updateReceipt(id,key,value){let r=state.supplyReceipts.find(x=>x.id===id);if(!r)return;r[key]=key==='amount'?Number(value||0):value;save()}
async function attachReceiptPhoto(e,id){
 const file=e.target.files?.[0];
 if(!file)return;
 const r=state.supplyReceipts.find(x=>x.id===id);
 if(!r)return;
 const input=e.target;
 input.disabled=true;
 try{
   r.image=await processReceiptPhoto(file);
   save('supply-receipt-photo-compressed');
   openSupplyReceipt(id);
 }catch(err){
   console.error(err);
   alert('The receipt photo could not be saved. Try a smaller image or take a lower resolution photo.');
 }finally{
   input.disabled=false;
 }
}
function deleteReceipt(id){state.supplyReceipts=state.supplyReceipts.filter(r=>r.id!==id);save();setTab('receipts')}


function createInvoiceForSelectedClient(){let client=state.selectedClient||'';if(!client)return;let inv=createBlankInvoice(client);save();render()}
function getOrCreateClientActiveInvoice(client){ensureCollections();let inv=findOpenInvoice(client);if(!inv){inv=createBlankInvoice(client);save()}return inv}
function clientInvoiceEmbedHtml(inv){if(!inv)return'<p class="note">No current invoice.</p>';let serviceOptions=(state.services||[]).map(s=>`<option value="${escapeHtml(s)}"></option>`).join('');return `<div class="box embeddedInvoice"><div class="titleRow miniTitle"><div><h2>Invoice #${inv.number}</h2><p>${getInvoiceStatus(inv)} • Total ${money(inv.total)} • Balance ${money(invoiceBalance(inv))}</p></div><button onclick="openInvoice('${inv.id}')">Full View</button></div><datalist id="clientServiceOptions">${serviceOptions}</datalist><label>Date</label><input value="${escapeHtml(inv.date||'')}" oninput="updateInvoiceField('${inv.id}','date',this.value)"><h4>Services</h4>${(inv.services||[]).map((s,idx)=>`<div class="lineItem"><span>${escapeHtml(s.name)}${s.qty?` (${s.qty})`:''}</span><input type="number" step="0.01" value="${Number(s.amount||0)}" oninput="updateInvoiceLine('${inv.id}','services',${idx},this.value)"><button class="smallBtn" onclick="removeClientInvoiceLine('${inv.id}','services',${idx})">×</button></div>`).join('')||'<p class="note">No services yet.</p>'}<div class="two"><input id="clientNewServiceName" list="clientServiceOptions"><input id="clientNewServiceAmount" type="number" step="0.01"></div><button onclick="addClientInvoiceService('${inv.id}')">Add Service</button><h4>Supplies</h4>${(inv.supplies||[]).map((s,idx)=>invoiceSupplyLineHtml(inv,s,idx,'client')).join('')||'<p class="note">No supplies yet.</p>'}${invoiceSupplyAddHtml(inv,'client')}<div class="two"><div><label>Amount Paid</label><input type="number" step="0.01" value="${Number(inv.paid||0).toFixed(2)}" oninput="updateClientInvoicePaid('${inv.id}',this.value)" onblur="commitClientInvoicePaid('${inv.id}')"></div><div><label>Status</label><select data-invoice-status="${inv.id}" onchange="setInvoiceStatusFromControl('${inv.id}',this.value,'client')"><option value="UNPAID" ${getInvoiceStatus(inv)==='UNPAID'?'selected':''}>UNPAID</option><option value="PARTIAL" ${getInvoiceStatus(inv)==='PARTIAL'?'selected':''}>PARTIAL</option><option value="PAID" ${getInvoiceStatus(inv)==='PAID'?'selected':''}>PAID</option></select></div></div><label>Notes</label><textarea oninput="updateInvoiceField('${inv.id}','notes',this.value)">${escapeHtml(inv.notes||'')}</textarea><h4>Client Signature</h4><canvas id="clientSignaturePad" class="signature"></canvas><div class="actions"><button onclick="clearInvoiceSignature('${inv.id}')">Clear Signature</button></div><h4>Check Photo</h4><input type="file" accept="image/*" capture="environment" onchange="attachCheckPhoto(event,'${inv.id}')">${inv.checkPhoto?`<img class="photo" src="${inv.checkPhoto}">`:''}<div class="actions"><button class="save" onclick="shareInvoice('${inv.id}','text')">Text Invoice</button><button class="save" onclick="shareInvoice('${inv.id}','email')">Email Invoice</button><button onclick="markClientInvoicePaid('${inv.id}')">Mark Paid</button><button onclick="toggleInvoiceTimeLogs('${inv.id}')">View Time Logs</button></div>${state.invoiceTimeLogOpen===inv.id?invoiceTimeLogsHtml(inv):''}<div class="receipt smallReceipt">${invoiceReceiptHtml(inv)}</div></div>`}
function refreshClientInvoiceEmbed(id){let inv=state.invoices.find(i=>i.id===id);let el=document.getElementById('clientInvoiceEmbed');if(el&&inv){el.innerHTML=clientInvoiceEmbedHtml(inv);setTimeout(()=>setupClientSignaturePad(id),50)}else render()}
function addClientInvoiceService(id){let inv=state.invoices.find(i=>i.id===id);let name=document.getElementById('clientNewServiceName')?.value.trim(),amount=Number(document.getElementById('clientNewServiceAmount')?.value||0);if(!inv||!name)return;addServiceToDb(name);inv.services.push({name,amount});recalcInvoice(inv);refreshClientInvoiceEmbed(id)}
function addClientInvoiceSupply(id){
 let inv=state.invoices.find(i=>i.id===id);
 let name=document.getElementById('clientNewSupplyName')?.value.trim();
 let qty=Number(document.getElementById('clientNewSupplyQty')?.value||0);
 if(!inv||!name)return;
 if(!qty||qty<0)qty=1;
 let item=findSupplyByName(name,{includeDrafts:true})||createSupplyFromInvoiceName(name);
 let line={name:item?item.name:name,qty,supplyId:item?item.id:'',unit:item?.unit||'unit',pricePerUnit:Number(item?.pricePerUnit||0),amount:0};
 recalcSupplyLine(line);
 addSupplyToDb(line.name);
 inv.supplies.push(line);
 if(state.drafts?.invoiceEditor?.[id]){state.drafts.invoiceEditor[id].newSupplyName='';state.drafts.invoiceEditor[id].newSupplyQty='';}
 recalcInvoice(inv);
 if(item)recalcSupplyRemaining(item.id);
 save();
 refreshClientInvoiceEmbed(id);
}
function removeClientInvoiceLine(id,type,idx){let inv=state.invoices.find(i=>i.id===id);if(!inv)return;let line=inv[type]?.[idx];inv[type].splice(idx,1);recalcInvoice(inv);if(type==='supplies'&&line?.supplyId)recalcSupplyRemaining(line.supplyId);refreshClientInvoiceEmbed(id)}
function updateClientInvoicePaid(id,value){let inv=state.invoices.find(i=>i.id===id);if(!inv)return;setInvoiceManualPaidTotal(inv,value);save('client-invoice-paid');updateInvoiceStatusDom(id)}
function commitClientInvoicePaid(id){refreshClientInvoiceEmbed(id)}
function markClientInvoicePaid(id){let inv=state.invoices.find(i=>i.id===id);if(!inv)return;setInvoiceManualPaidTotal(inv,normalizeMoneyNumber(inv.total||0,2));refreshClientInvoiceEmbed(id)}
function updateInvoiceStatusDom(id){let inv=state.invoices.find(i=>i.id===id);if(!inv)return;let st=getInvoiceStatus(inv);document.querySelectorAll(`[data-invoice-status="${id}"]`).forEach(el=>{if(el.tagName==='SELECT')el.value=st;else el.value=st;});document.querySelectorAll(`[data-invoice-balance="${id}"]`).forEach(el=>el.textContent=money(invoiceBalance(inv)));}
function setInvoiceStatusFromControl(id,status,mode='client'){let inv=state.invoices.find(i=>i.id===id);if(!inv)return;status=String(status||'').toUpperCase();if(status==='PAID'){setInvoiceManualPaidTotal(inv,normalizeMoneyNumber(inv.total||0,2));}
 else if(status==='UNPAID'){setInvoiceManualPaidTotal(inv,0);}
 else if(status==='PARTIAL'){if(normalizeCents(inv.paid)<=0)setInvoiceManualPaidTotal(inv,0);else reconcileInvoiceBankPayments(id);}
 save('invoice-status-control');if(mode==='full')renderInvoiceEditor(id);else refreshClientInvoiceEmbed(id)}
function removeAutoInvoicePayments(invoiceId){ensureBanking();state.banking.transactions=state.banking.transactions.filter(t=>!(t.linkedInvoiceId===invoiceId&&t.autoInvoicePayment));}
function setupClientSignaturePad(id){let c=document.getElementById('clientSignaturePad');if(!c)return;let inv=state.invoices.find(i=>i.id===id);let r=c.getBoundingClientRect();c.width=Math.max(300,Math.floor(r.width*2));c.height=220;let ctx=c.getContext('2d');ctx.lineWidth=4;ctx.lineCap='round';ctx.strokeStyle='#111';if(inv&&inv.signature){let img=new Image();img.onload=()=>ctx.drawImage(img,0,0,c.width,c.height);img.src=inv.signature}let drawing=false;let point=e=>{let rr=c.getBoundingClientRect();return{x:(e.clientX-rr.left)*(c.width/rr.width),y:(e.clientY-rr.top)*(c.height/rr.height)}};c.onpointerdown=e=>{drawing=true;let p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y)};c.onpointermove=e=>{if(!drawing)return;let p=point(e);ctx.lineTo(p.x,p.y);ctx.stroke()};c.onpointerup=()=>{drawing=false;let inv=state.invoices.find(i=>i.id===id);if(inv){inv.signature=c.toDataURL('image/png');save()}};c.onpointerleave=()=>drawing=false}

function setCalendarMonth(m){state.month=m;state.selectedDate=makeKey(state.year,m,1);state.scheduleDayPanelOpen=false;save();render()}function changeCalendarYear(n){state.year+=n;state.selectedDate=makeKey(state.year,state.month,1);state.scheduleDayPanelOpen=false;save();render()}function selectCalendarDay(k){state.selectedDate=k;let p=parseKey(k);state.year=p.y;state.month=p.m;save();render()}
function openCalendarDay(k){state.selectedDate=k;let p=parseKey(k);state.year=p.y;state.month=p.m;state.scheduleDayPanelOpen=true;save();render()}
function closeScheduleDayPanel(){state.scheduleDayPanelOpen=false;save();render()}
function addJobForSelectedDay(){ensureCollections();if(!state.drafts)state.drafts={};state.drafts.newJob={date:state.selectedDate,status:'scheduled',title:'',time:'',end:'',payType:'hourly',rate:'',client:'',phone:'',address:'',hours:'',owed:'',received:'',notes:''};state.editingAgenda=null;state.scheduleDayPanelOpen=false;state.section='schedule';state.tabs.schedule='newJob';save();render()}
function addEventForSelectedDay(){ensureCollections();if(!state.drafts)state.drafts={};state.drafts.newEvent={date:state.selectedDate,title:'',time:'',location:'',notes:''};state.editingAgenda=null;state.scheduleDayPanelOpen=false;state.section='schedule';state.tabs.schedule='newEvent';save();render()}
function editAgendaItem(idx){let d=ensureDay(state.selectedDate);let item=d.agenda[idx];if(!item)return;ensureCollections();if(!state.drafts)state.drafts={};state.editingAgenda={date:state.selectedDate,idx,type:item.type||'quick',id:item.id||''};if(item.type==='event'){state.drafts.newEvent={date:state.selectedDate,title:item.title||'',time:item.time||'',location:item.location||'',notes:item.notes||''};state.section='schedule';state.tabs.schedule='newEvent';}else{state.drafts.newJob={date:state.selectedDate,status:item.status||'scheduled',title:item.title||'',time:item.time||'',end:item.end||'',payType:item.payType||'hourly',rate:item.rate||'',client:item.client||'',phone:item.phone||'',address:item.address||'',hours:item.hours||'',owed:item.owed||'',received:item.received||'',notes:item.notes||''};state.section='schedule';state.tabs.schedule='newJob';}state.scheduleDayPanelOpen=false;save();render()}
function scheduleDayPanelHtml(){if(!state.scheduleDayPanelOpen)return '';let data=ensureDay(state.selectedDate);let rows=(data.agenda||[]).map((item,idx)=>`<div class="scheduleEditRow"><span><b>${formatTime(item.time)} ${escapeHtml(item.title||'Untitled')}</b><small>${escapeHtml(item.type||'quick')}${item.client?' • '+escapeHtml(item.client):''}</small></span><button class="smallBtn" onclick="editAgendaItem(${idx})">Edit</button></div>`).join('')||'<p class="note">No jobs or events on this day yet.</p>';return `<div class="box scheduleDayPanel"><div class="titleRow miniTitle"><div><h3>Day Planner</h3><p class="note">Add or edit jobs/events for ${escapeHtml(state.selectedDate)}.</p></div><button class="smallBtn" onclick="closeScheduleDayPanel()">×</button></div><div class="actions"><button class="save" onclick="addJobForSelectedDay()">+ Add Job</button><button onclick="addEventForSelectedDay()">+ Add Event</button></div><div class="clientList">${rows}</div></div>`}
function addAgenda(){let time=document.getElementById('newAgendaTime').value.trim(),title=document.getElementById('newAgendaTitle').value.trim();if(!time||!title)return;let d=ensureDay(state.selectedDate);d.agenda.push({time,title,type:'quick',canceled:false});sortAgenda(d.agenda);save();render()}
function saveJob(){let date=document.getElementById('jobDate').value,title=document.getElementById('jobTitle').value,time=document.getElementById('jobStart').value;if(!date||!title)return;calcJobPay();let client=document.getElementById('jobClient').value.trim();let d=ensureDay(date);let job={id:state.editingAgenda?.id||uid(),time,title,type:'job',status:document.getElementById('jobStatus').value,end:document.getElementById('jobEnd').value,payType:document.getElementById('jobPayType').value,rate:document.getElementById('jobRate').value,client,phone:document.getElementById('jobPhone').value,address:document.getElementById('jobAddress').value,hours:document.getElementById('jobHours').value,owed:document.getElementById('jobOwed').value,received:document.getElementById('jobReceived').value,notes:document.getElementById('jobNotes').value,locationPin:document.getElementById('jobLocationPin')?.value||'',canceled:false};let editing=state.editingAgenda&&state.editingAgenda.type==='job';if(editing){let oldDate=state.editingAgenda.date;let oldDay=ensureDay(oldDate);let oldIdx=state.editingAgenda.idx;if(oldDate===date&&oldDay.agenda[oldIdx])oldDay.agenda[oldIdx]=job;else{oldDay.agenda.splice(oldIdx,1);d.agenda.push(job)}}else{d.agenda.push(job)}addServiceToDb(title);if(client)upsertClientFromJob(job);if(client&&!editing)autoInvoiceFromJob(job,date);sortAgenda(d.agenda);if(state.drafts)delete state.drafts.newJob;state.editingAgenda=null;state.selectedDate=date;adminRecord('schedule.job',`${editing?'Job updated':'Job saved'}: ${title}`,{date,time,client,total:job.owed,paid:job.received,address:job.address,locationPin:job.locationPin});let p=parseKey(date);state.year=p.y;state.month=p.m;goToFirstTab('schedule')}
function saveEvent(){let date=document.getElementById('eventDate').value,title=document.getElementById('eventTitle').value,time=document.getElementById('eventTime').value;if(!date||!title)return;let d=ensureDay(date);let eventItem={id:state.editingAgenda?.id||uid(),time,title,type:'event',location:document.getElementById('eventLocation').value,notes:document.getElementById('eventNotes').value,canceled:false};let editing=state.editingAgenda&&state.editingAgenda.type==='event';if(editing){let oldDate=state.editingAgenda.date;let oldDay=ensureDay(oldDate);let oldIdx=state.editingAgenda.idx;if(oldDate===date&&oldDay.agenda[oldIdx])oldDay.agenda[oldIdx]=eventItem;else{oldDay.agenda.splice(oldIdx,1);d.agenda.push(eventItem)}}else{d.agenda.push(eventItem)}sortAgenda(d.agenda);if(state.drafts)delete state.drafts.newEvent;state.editingAgenda=null;state.selectedDate=date;adminRecord('schedule.event',`${editing?'Event updated':'Event saved'}: ${title}`,{date,time,location:eventItem.location});let p=parseKey(date);state.year=p.y;state.month=p.m;goToFirstTab('schedule')}
function autoFillClient(){let name=document.getElementById('jobClient')?.value.trim();let c=state.clients?.[name];if(!c)return;let phone=document.getElementById('jobPhone'),address=document.getElementById('jobAddress');if(phone&&!phone.value)phone.value=c.phone||'';if(address&&!address.value)address.value=c.address||''}
function getClientNames(){ensureCollections();syncClientsFromJobs();return Object.keys(state.clients||{}).filter(Boolean).sort((a,b)=>a.localeCompare(b))}
function handleClientPredictiveInput(inputId,mode,invoiceId=''){
 showClientSuggestions(inputId,mode,invoiceId);
 let input=document.getElementById(inputId);
 if(!input)return;
 let name=input.value.trim();
 let c=state.clients?.[name];
 if(c){applyClientDetailsToVisibleForm(name,mode,invoiceId,false)}
}
function showClientSuggestions(inputId,mode,invoiceId=''){
 let input=document.getElementById(inputId),box=document.getElementById(inputId+'Suggest');
 if(!input||!box)return;
 let q=input.value.trim().toLowerCase();
 let names=getClientNames().filter(n=>!q||n.toLowerCase().includes(q)).slice(0,8);
 if(!names.length){box.innerHTML='';box.classList.remove('open');return}
 box.innerHTML=names.map(n=>{let c=state.clients[n]||{};let details=[c.phone,c.address].filter(Boolean).join(' • ');return `<button type="button" class="suggestItem" onclick="selectClientSuggestion('${inputId}','${escapeAttr(n)}','${mode}','${invoiceId}')"><b>${escapeHtml(n)}</b>${details?`<small>${escapeHtml(details)}</small>`:''}</button>`}).join('');
 box.classList.add('open');
}
function selectClientSuggestion(inputId,name,mode,invoiceId=''){
 let input=document.getElementById(inputId);if(input)input.value=name;
 let box=document.getElementById(inputId+'Suggest');if(box){box.innerHTML='';box.classList.remove('open')}
 applyClientDetailsToVisibleForm(name,mode,invoiceId,true);
}
function applyClientDetailsToVisibleForm(name,mode,invoiceId='',force=false){
 let c=state.clients?.[name];if(!c)return;
 if(mode==='job'){
   let phone=document.getElementById('jobPhone'),address=document.getElementById('jobAddress');
   if(phone&&(force||!phone.value))phone.value=c.phone||'';
   if(address&&(force||!address.value))address.value=c.address||'';
 }
 if(mode==='clientEdit'){
   let phone=document.getElementById('clientPhoneEdit'),address=document.getElementById('clientAddressEdit'),notes=document.getElementById('clientNotesEdit');
   if(phone&&(force||!phone.value))phone.value=c.phone||'';
   if(address&&(force||!address.value))address.value=c.address||'';
   if(notes&&(force||!notes.value))notes.value=c.notes||'';
 }
 if(mode==='invoice'&&invoiceId){updateInvoiceClientFromInput(invoiceId,name)}
}
function updateInvoiceClientFromInput(id,value){
 let inv=state.invoices.find(i=>i.id===id);if(!inv)return;
 inv.client=value;
 let name=String(value||'').trim();
 if(name){
   ensureCollections();
   if(!state.clients[name])state.clients[name]={name,phone:'',address:'',notes:''};
 }
 save();
}
function upsertClientFromJob(job){if(!state.clients)state.clients={};let n=job.client.trim();if(!n)return;if(!state.clients[n])state.clients[n]={name:n,phone:'',address:'',notes:''};if(job.phone)state.clients[n].phone=job.phone;if(job.address)state.clients[n].address=job.address;if(job.notes&&!state.clients[n].notes)state.clients[n].notes=job.notes}
function syncClientsFromJobs(){if(!state.clients)state.clients={};Object.keys(state.calendarData||{}).forEach(date=>{(state.calendarData[date].agenda||[]).forEach(a=>{if(a.type==='job'&&a.client)upsertClientFromJob(a)})});save()}

function renderAddClientForm(){
 let draft=state.drafts?.newClient||{};
 content.innerHTML=`<div class="titleRow"><div><h2>Add Client</h2><p>Create a new client file.</p></div><button onclick="setTab('directory')">Back</button></div>
 <div class="box">
   <label>Client Name</label>
   <input id="newClientName" value="${escapeHtml(draft.name||'')}">
   <label>Phone</label>
   <input id="newClientPhone" value="${escapeHtml(draft.phone||'')}">
   <label>Address</label>
   <input id="newClientAddress" value="${escapeHtml(draft.address||'')}">
   <label>Notes</label>
   <textarea id="newClientNotes">${escapeHtml(draft.notes||'')}</textarea>
   <div class="actions">
     <button class="save" onclick="saveNewClient()">Save Client</button>
     <button onclick="setTab('directory')">Cancel</button>
   </div>
 </div>`;
}
function saveNewClient(){
 let name=document.getElementById('newClientName')?.value.trim();
 if(!name)return;
 if(!state.clients)state.clients={};
 state.clients[name]={
   name,
   phone:document.getElementById('newClientPhone')?.value||'',
   address:document.getElementById('newClientAddress')?.value||'',
   notes:document.getElementById('newClientNotes')?.value||''
 };
 state.selectedClient=name;
 adminRecord('client.save',`Client saved: ${name}`,{name,phone:state.clients[name].phone,address:state.clients[name].address});
 if(state.drafts)delete state.drafts.newClient;
 goToFirstTab('clients');
}

function openNewClientJob(){renderAddClientForm()}
function openClient(n){state.selectedClient=n;state.tabs.clients='client';save();render()}function saveClientEdit(){let old=state.selectedClient;let name=document.getElementById('clientNameEdit').value.trim();if(!name)return;if(!state.clients)state.clients={};if(name!==old){delete state.clients[old];renameClientInJobs(old,name)}state.clients[name]={name,phone:document.getElementById('clientPhoneEdit').value,address:document.getElementById('clientAddressEdit').value,notes:document.getElementById('clientNotesEdit').value};state.selectedClient=name;adminRecord('client.update',`Client updated: ${name}`,{name,phone:state.clients[name].phone,address:state.clients[name].address});goToFirstTab('clients')}
function renameClientInJobs(oldName,newName){Object.keys(state.calendarData||{}).forEach(date=>(state.calendarData[date].agenda||[]).forEach(a=>{if(a.client===oldName)a.client=newName}))}
function jobsForClient(n){let out=[];Object.keys(state.calendarData||{}).forEach(date=>(state.calendarData[date].agenda||[]).forEach(a=>{if(a.type==='job'&&a.client===n)out.push({...a,date})}));return out.sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))}
function clientTotals(n){let jobs=jobsForClient(n),hours=0,charged=0,paid=0;jobs.forEach(j=>{if(!j.canceled){hours+=Number(j.hours||0);charged+=Number(j.owed||0);paid+=Number(j.received||0)}});return{hours,charged,paid,balance:Math.max(charged-paid,0)}}
function addServiceToDb(name){ensureCollections();name=String(name||'').trim();if(name&&!state.services.some(s=>s.toLowerCase()===name.toLowerCase()))state.services.push(name)}function addSupplyToDb(name){ensureCollections();name=String(name||'').trim();if(name&&!state.supplies.some(s=>String(s||'').trim().toLowerCase()===name.toLowerCase()))state.supplies.push(name);ensureSupplyDbFromNames()}
function nextInvoiceNumber(){ensureCollections();return state.invoiceCounter++}function createBlankInvoice(client=''){ensureCollections();let inv={id:uid(),number:nextInvoiceNumber(),client,date:new Date().toLocaleDateString(),services:[],supplies:[],jobs:[],notes:'',total:0,paid:0,signature:'',checkPhoto:'',status:'unpaid'};state.invoices.push(inv);return inv}function findOpenInvoice(client){ensureCollections();return state.invoices.find(i=>i.client===client&&getInvoiceStatus(i)!=='PAID')}function autoInvoiceFromJob(job,date){let inv=findOpenInvoice(job.client)||createBlankInvoice(job.client);inv.jobs.push({date,time:job.time,title:job.title,hours:job.hours,rate:job.rate,payType:job.payType,total:Number(job.owed||0),paid:Number(job.received||0)});inv.services.push({name:job.title,qty:job.hours||1,amount:Number(job.owed||0)});inv.paid=Number(inv.paid||0)+Number(job.received||0);recalcInvoice(inv)}
function newInvoice(){let client=prompt('Client name?')||'';let inv=createBlankInvoice(client);state.selectedInvoiceId=inv.id;save();renderInvoiceEditor(inv.id)}function openInvoice(id){state.selectedInvoiceId=id;save();renderInvoiceEditor(id)}
function renderInvoiceEditor(id){let inv=state.invoices.find(i=>i.id===id);if(!inv)return;content.innerHTML=invoiceEditorHtml(inv);setTimeout(()=>setupSignaturePad(inv.id),50)}
function invoiceEditorHtml(inv){let serviceOptions=(state.services||[]).map(s=>`<option value="${escapeHtml(s)}"></option>`).join('');return `<div class="titleRow"><div><h2>Invoice #${inv.number}</h2><p>${escapeHtml(inv.client||'No client selected')} • ${getInvoiceStatus(inv)}</p></div><button onclick="setTab('invoices')">Back</button></div><div class="invoiceGrid"><div class="box"><label>Client / Contact</label><input id="invClient" value="${escapeHtml(inv.client||'')}" autocomplete="off" oninput="updateInvoiceClientFromInput('${inv.id}',this.value);handleClientPredictiveInput('invClient','invoice','${inv.id}')" onfocus="showClientSuggestions('invClient','invoice','${inv.id}')"><div id="invClientSuggest" class="suggestBox"></div><label>Date</label><input id="invDate" value="${escapeHtml(inv.date||'')}" oninput="updateInvoiceField('${inv.id}','date',this.value)"><h3>Services</h3><datalist id="serviceOptions">${serviceOptions}</datalist><div>${(inv.services||[]).map((s,idx)=>`<div class="lineItem"><span>${escapeHtml(s.name)}${s.qty?` (${s.qty})`:''}</span><input type="number" step="0.01" value="${Number(s.amount||0)}" oninput="updateInvoiceLine('${inv.id}','services',${idx},this.value)"><button class="smallBtn" onclick="removeInvoiceLine('${inv.id}','services',${idx})">×</button></div>`).join('')||'<p class="note">No services yet.</p>'}</div><div class="two"><input id="newServiceName" list="serviceOptions" value="${escapeHtml(state.drafts?.invoiceEditor?.[inv.id]?.newServiceName||'')}"><input id="newServiceAmount" type="number" step="0.01" value="${escapeHtml(state.drafts?.invoiceEditor?.[inv.id]?.newServiceAmount||'')}"></div><button onclick="addInvoiceService('${inv.id}')">Add Service</button><h3>Supplies</h3><div>${(inv.supplies||[]).map((s,idx)=>invoiceSupplyLineHtml(inv,s,idx,'full')).join('')||'<p class="note">No supplies yet.</p>'}</div>${invoiceSupplyAddHtml(inv,'full')}<h3>Payment</h3><div class="two"><div><label>Amount Paid</label><input id="invPaid" type="number" step="0.01" value="${Number(inv.paid||0).toFixed(2)}" oninput="updateInvoicePaid('${inv.id}',this.value)" onblur="renderInvoiceEditor('${inv.id}')"></div><div><label>Status</label><select data-invoice-status="${inv.id}" onchange="setInvoiceStatusFromControl('${inv.id}',this.value,'full')"><option value="UNPAID" ${getInvoiceStatus(inv)==='UNPAID'?'selected':''}>UNPAID</option><option value="PARTIAL" ${getInvoiceStatus(inv)==='PARTIAL'?'selected':''}>PARTIAL</option><option value="PAID" ${getInvoiceStatus(inv)==='PAID'?'selected':''}>PAID</option></select></div></div><label>Notes</label><textarea id="invNotes" oninput="updateInvoiceField('${inv.id}','notes',this.value)">${escapeHtml(inv.notes||'')}</textarea><h3>Signature</h3><canvas id="signaturePad" class="signature"></canvas><div class="actions"><button onclick="clearInvoiceSignature('${inv.id}')">Clear Signature</button></div><h3>Check Photo</h3><input type="file" accept="image/*" capture="environment" onchange="attachCheckPhoto(event,'${inv.id}')">${inv.checkPhoto?`<img class="photo" src="${inv.checkPhoto}">`:''}<div class="actions"><button class="save" onclick="shareInvoice('${inv.id}','text')">Text Invoice</button><button class="save" onclick="shareInvoice('${inv.id}','email')">Email Invoice</button><button onclick="toggleInvoiceTimeLogs('${inv.id}')">View Time Logs</button><button class="delete" onclick="deleteInvoice('${inv.id}')">Delete</button></div>${state.invoiceTimeLogOpen===inv.id?invoiceTimeLogsHtml(inv):''}</div><div class="box receipt">${invoiceReceiptHtml(inv)}</div></div>`}
function invoiceReceiptHtml(inv){return `<h2>Invoice #${inv.number}</h2><p><b>Client:</b> ${escapeHtml(inv.client||'')}<br><b>Date:</b> ${escapeHtml(inv.date||'')}</p><h3>Services</h3>${(inv.services||[]).map(s=>`<div class="receiptLine"><span>${escapeHtml(s.name)}</span><b>${money(s.amount)}</b></div>`).join('')||'<p>No services.</p>'}<h3>Supplies</h3>${(inv.supplies||[]).map(s=>{let meta=supplyLineMeta(s);return `<div class="receiptLine"><span>${escapeHtml(s.name)}${s.qty?` (${Number(s.qty||0)} ${escapeHtml(meta.unit)})`:''}</span><b>${money(s.amount)}</b></div>`}).join('')||'<p>No supplies.</p>'}<hr><p><b>Total:</b> ${money(inv.total)}<br><b>Paid:</b> ${money(inv.paid)}<br><b>Balance:</b> ${money(invoiceBalance(inv))}<br><b>Status:</b> ${getInvoiceStatus(inv)}</p>${inv.signature?`<p><b>Signed:</b><br><img class="sigImg" src="${inv.signature}"></p>`:''}${inv.checkPhoto?'<p><b>Check photo saved.</b></p>':''}`}
function normalizeInvoice(inv,opts={}){if(!inv)return null;if(!Array.isArray(inv.services))inv.services=[];if(!Array.isArray(inv.supplies))inv.supplies=[];inv.services.forEach(s=>{s.amount=normalizeMoneyNumber(s.amount||0,2);});inv.supplies.forEach(recalcSupplyLine);const totalCents=[...(inv.services||[]),...(inv.supplies||[])].reduce((a,l)=>a+normalizeCents(l.amount),0);inv.total=centsToMoney(totalCents);inv.paid=normalizeMoneyNumber(inv.paid||0,2);inv.balance=centsToMoney(Math.max(totalCents-normalizeCents(inv.paid),0));inv.status=getInvoiceStatus(inv).toLowerCase();if(!opts.skipSupplySync)recalcAllSupplyRemaining({silent:true});return inv;}
function recalcInvoice(inv){normalizeInvoice(inv);save('invoice-recalc')}
function updateInvoiceField(id,key,value){let inv=state.invoices.find(i=>i.id===id);if(!inv)return;inv[key]=value;normalizeInvoice(inv);save('invoice-field')}
function updateInvoicePaid(id,value){let inv=state.invoices.find(i=>i.id===id);if(!inv)return;setInvoiceManualPaidTotal(inv,value);save('invoice-paid');updateInvoiceStatusDom(id)}
function updateInvoiceLine(id,type,idx,value){let inv=state.invoices.find(i=>i.id===id);if(!inv)return;inv[type][idx].amount=toNumber(value,0);recalcInvoice(inv);if(type==='supplies')recalcAllSupplyRemaining({silent:false});}
function updateInvoiceSupplyQty(id,idx,value,mode='full'){
 let inv=state.invoices.find(i=>i.id===id);if(!inv||!inv.supplies?.[idx])return;
 let line=inv.supplies[idx];
 let oldSupplyId=line.supplyId;
 line.qty=Math.max(Number(value||0),0);
 recalcSupplyLine(line);
 recalcInvoice(inv);
 if(oldSupplyId)recalcSupplyRemaining(oldSupplyId);
 if(line.supplyId&&line.supplyId!==oldSupplyId)recalcSupplyRemaining(line.supplyId);
 if(mode==='client')refreshClientInvoiceEmbed(id);else renderInvoiceEditor(id);
}
function addInvoiceService(id){let inv=state.invoices.find(i=>i.id===id);let name=document.getElementById('newServiceName').value.trim(),amount=Number(document.getElementById('newServiceAmount').value||0);if(!inv||!name)return;addServiceToDb(name);inv.services.push({name,amount});if(state.drafts?.invoiceEditor?.[id]){state.drafts.invoiceEditor[id].newServiceName='';state.drafts.invoiceEditor[id].newServiceAmount='';}recalcInvoice(inv);renderInvoiceEditor(id)}
function addInvoiceSupply(id){
 let inv=state.invoices.find(i=>i.id===id);
 let name=document.getElementById('newSupplyName')?.value.trim(),qty=Number(document.getElementById('newSupplyQty')?.value||0);
 if(!inv||!name)return;
 if(!qty||qty<0)qty=1;
 let item=findSupplyByName(name,{includeDrafts:true})||createSupplyFromInvoiceName(name);
 let line={name:item?item.name:name,qty,supplyId:item?item.id:'',unit:item?.unit||'unit',pricePerUnit:Number(item?.pricePerUnit||0),amount:0};
 recalcSupplyLine(line);
 addSupplyToDb(line.name);
 inv.supplies.push(line);
 if(state.drafts?.invoiceEditor?.[id]){state.drafts.invoiceEditor[id].newSupplyName='';state.drafts.invoiceEditor[id].newSupplyQty='';}
 recalcInvoice(inv);
 if(item)recalcSupplyRemaining(item.id);
 save();
 renderInvoiceEditor(id);
}
function removeInvoiceLine(id,type,idx){let inv=state.invoices.find(i=>i.id===id);if(!inv)return;let line=inv[type][idx];inv[type].splice(idx,1);recalcInvoice(inv);if(type==='supplies'&&line?.supplyId)recalcSupplyRemaining(line.supplyId);renderInvoiceEditor(id)}
function invoiceBalance(inv){return centsToMoney(Math.max(normalizeCents(inv.total)-normalizeCents(inv.paid),0))}function getInvoiceStatus(inv){let total=normalizeCents(inv.total),paid=normalizeCents(inv.paid);if(total>0&&paid>=total)return'PAID';if(paid>0)return'PARTIAL';return'UNPAID'}function invoiceStatusClass(inv){return getInvoiceStatus(inv).toLowerCase()}function shareInvoice(id,type){let inv=state.invoices.find(i=>i.id===id);if(!inv)return;let msg=encodeURIComponent(`Invoice #${inv.number}\nClient: ${inv.client}\nTotal: ${money(inv.total)}\nPaid: ${money(inv.paid)}\nBalance: ${money(invoiceBalance(inv))}\nStatus: ${getInvoiceStatus(inv)}`);if(type==='text')location.href='sms:?body='+msg;else if(type==='email')location.href='mailto:?subject=Invoice #'+inv.number+'&body='+msg;else if(navigator.share)navigator.share({title:'Invoice #'+inv.number,text:decodeURIComponent(msg)});else alert(decodeURIComponent(msg))}function deleteInvoice(id){state.invoices=state.invoices.filter(i=>i.id!==id);save();setTab('invoices')}
async function attachCheckPhoto(e,id){
 const file=e.target.files?.[0];
 if(!file)return;
 const input=e.target;
 input.disabled=true;
 try{
   let inv=state.invoices.find(i=>i.id===id);
   if(inv){
     inv.checkPhoto=await resizeImageDataUrl(file,1200,.72);
     save('invoice-check-photo-compressed');
     renderInvoiceEditor(id);
   }
 }catch(err){
   console.error(err);
   alert('The check photo could not be saved. Try a smaller image.');
 }finally{
   input.disabled=false;
 }
}let sigCtx=null,sigDraw=false;function setupSignaturePad(id){let c=document.getElementById('signaturePad');if(!c)return;let inv=state.invoices.find(i=>i.id===id);let r=c.getBoundingClientRect();c.width=Math.max(300,Math.floor(r.width*2));c.height=220;sigCtx=c.getContext('2d');sigCtx.lineWidth=4;sigCtx.lineCap='round';sigCtx.strokeStyle='#111';if(inv&&inv.signature){let img=new Image();img.onload=()=>sigCtx.drawImage(img,0,0,c.width,c.height);img.src=inv.signature}c.onpointerdown=e=>{sigDraw=true;let p=sigPoint(e,c);sigCtx.beginPath();sigCtx.moveTo(p.x,p.y)};c.onpointermove=e=>{if(!sigDraw)return;let p=sigPoint(e,c);sigCtx.lineTo(p.x,p.y);sigCtx.stroke()};c.onpointerup=()=>{sigDraw=false;let inv=state.invoices.find(i=>i.id===id);if(inv){inv.signature=c.toDataURL('image/png');save();renderInvoiceEditor(id)}};c.onpointerleave=()=>sigDraw=false}function sigPoint(e,c){let r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*(c.width/r.width),y:(e.clientY-r.top)*(c.height/r.height)}}function clearInvoiceSignature(id){let inv=state.invoices.find(i=>i.id===id);if(inv){inv.signature='';save();renderInvoiceEditor(id)}}

function fieldValue(id){return document.getElementById(id)?.value||''}
function hasAnyValue(obj){return Object.values(obj||{}).some(v=>String(v??'').trim()!=='')}
function clearFields(ids){ids.forEach(id=>{let el=document.getElementById(id);if(el)el.value='';});}
function readJobFormDraft(){
 if(!document.getElementById('jobDate'))return null;
 calcJobPay();
 return {date:fieldValue('jobDate'),status:fieldValue('jobStatus'),title:fieldValue('jobTitle'),time:fieldValue('jobStart'),end:fieldValue('jobEnd'),payType:fieldValue('jobPayType'),rate:fieldValue('jobRate'),client:fieldValue('jobClient'),phone:fieldValue('jobPhone'),address:fieldValue('jobAddress'),hours:fieldValue('jobHours'),owed:fieldValue('jobOwed'),received:fieldValue('jobReceived'),notes:fieldValue('jobNotes'),locationPin:fieldValue('jobLocationPin')};
}
function commitJobDraft(draft){
 if(!draft||!draft.date||!draft.title)return false;
 let d=ensureDay(draft.date);
 let job={id:uid(),time:draft.time,title:draft.title,type:'job',status:draft.status||'scheduled',end:draft.end,payType:draft.payType||'hourly',rate:draft.rate,client:String(draft.client||'').trim(),phone:draft.phone,address:draft.address,hours:draft.hours,owed:draft.owed,received:draft.received,notes:draft.notes,canceled:false};
 d.agenda.push(job);
 addServiceToDb(job.title);
 if(job.client){upsertClientFromJob(job);autoInvoiceFromJob(job,draft.date)}
 sortAgenda(d.agenda);
 state.selectedDate=draft.date;
 let p=parseKey(draft.date);state.year=p.y;state.month=p.m;
 if(state.drafts)delete state.drafts.newJob;
 clearFields(['jobTitle','jobStart','jobEnd','jobHours','jobRate','jobOwed','jobReceived','jobClient','jobPhone','jobAddress','jobNotes']);
 save();
 return true;
}
function readEventFormDraft(){
 if(!document.getElementById('eventDate'))return null;
 return {date:fieldValue('eventDate'),title:fieldValue('eventTitle'),time:fieldValue('eventTime'),location:fieldValue('eventLocation'),notes:fieldValue('eventNotes')};
}
function commitEventDraft(draft){
 if(!draft||!draft.date||!draft.title)return false;
 let d=ensureDay(draft.date);
 d.agenda.push({time:draft.time,title:draft.title,type:'event',location:draft.location,notes:draft.notes,canceled:false});
 sortAgenda(d.agenda);
 state.selectedDate=draft.date;
 let p=parseKey(draft.date);state.year=p.y;state.month=p.m;
 if(state.drafts)delete state.drafts.newEvent;
 clearFields(['eventTitle','eventTime','eventLocation','eventNotes']);
 save();
 return true;
}
function readNewClientDraft(){
 if(!document.getElementById('newClientName'))return null;
 return {name:fieldValue('newClientName').trim(),phone:fieldValue('newClientPhone'),address:fieldValue('newClientAddress'),notes:fieldValue('newClientNotes')};
}
function commitNewClientDraft(draft){
 if(!draft||!draft.name)return false;
 if(!state.clients)state.clients={};
 state.clients[draft.name]={name:draft.name,phone:draft.phone||'',address:draft.address||'',notes:draft.notes||''};
 state.selectedClient=draft.name;
 if(state.drafts)delete state.drafts.newClient;
 clearFields(['newClientName','newClientPhone','newClientAddress','newClientNotes']);
 save();
 return true;
}
function autosaveSupplyItemPage(){
 let id=state.selectedSupplyId;
 if(!id||!document.getElementById('sName'))return false;
 let item=readSupplyFormIntoState(id);
 if(!item)return false;
 let hasValue=hasAnyValue({name:item.name,description:item.description,supplier:item.supplier,storeItemNumber:item.storeItemNumber,price:item.price,quantityForPrice:item.quantityForPrice});
 if(hasValue){item.isDraft=false;finalizeSupplyItemName(item);calcSupplyUnitPrice(id,{silent:true});recalcSupplyRemaining(id,{silent:true});addSupplyToDb(item.name);save('autosave-supply');return true;}
 save('autosave-empty-supply');
 return false;
}
function autosaveInvoiceEditorPage(){
 let invId=state.selectedInvoiceId;
 let inv=invId?state.invoices.find(i=>i.id===invId):null;
 if(!inv||!document.getElementById('invClient'))return false;
 inv.client=fieldValue('invClient');
 inv.date=fieldValue('invDate')||inv.date;
 inv.paid=Number(fieldValue('invPaid')||0);
 inv.notes=fieldValue('invNotes');
 let serviceName=fieldValue('newServiceName').trim();
 let serviceAmount=Number(fieldValue('newServiceAmount')||0);
 if(serviceName){addServiceToDb(serviceName);inv.services.push({name:serviceName,amount:serviceAmount});clearFields(['newServiceName','newServiceAmount']);}
 let supplyName=fieldValue('newSupplyName').trim();
 let supplyQty=Number(fieldValue('newSupplyQty')||0);
 if(supplyName){
   if(!supplyQty||supplyQty<0)supplyQty=1;
   let item=findSupplyByName(supplyName)||createSupplyFromInvoiceName(supplyName);
   let line={name:item?item.name:supplyName,qty:supplyQty,supplyId:item?item.id:'',unit:item?.unit||'unit',pricePerUnit:Number(item?.pricePerUnit||0),amount:0};
   recalcSupplyLine(line);addSupplyToDb(line.name);inv.supplies.push(line);if(item)recalcSupplyRemaining(item.id);clearFields(['newSupplyName','newSupplyQty']);
 }
 if(inv.client){if(!state.clients[inv.client])state.clients[inv.client]={name:inv.client,phone:'',address:'',notes:''};}
 recalcInvoice(inv);
 save();
 return true;
}

function ensureDraftBucket(name){ensureCollections();if(!state.drafts)state.drafts={};if(!state.drafts[name])state.drafts[name]={};return state.drafts[name]}
function saveJobDraftOnly(reason='live-draft'){
 const draft=readJobFormDraft();
 if(!draft)return false;
 if(hasAnyValue(draft)){state.drafts.newJob=draft;save(reason);return true;}
 return false;
}
function saveEventDraftOnly(reason='live-draft'){
 const draft=readEventFormDraft();
 if(!draft)return false;
 if(hasAnyValue(draft)){state.drafts.newEvent=draft;save(reason);return true;}
 return false;
}
function saveNewClientDraftOnly(reason='live-draft'){
 const draft=readNewClientDraft();
 if(!draft)return false;
 if(hasAnyValue(draft)){state.drafts.newClient=draft;save(reason);return true;}
 return false;
}
function saveTimeCardMetaDraft(reason='live-draft'){
 if(!document.getElementById('timeJobTitle')&&!document.getElementById('timeClientName'))return false;
 state.drafts.timeCardMeta={job:fieldValue('timeJobTitle'),client:fieldValue('timeClientName')};
 save(reason);
 return true;
}
function saveInvoiceEditorDraftOnly(reason='live-draft'){
 let invId=state.selectedInvoiceId;
 let inv=invId?state.invoices.find(i=>i.id===invId):null;
 if(!inv||!document.getElementById('invClient'))return false;
 inv.client=fieldValue('invClient');
 inv.date=fieldValue('invDate')||inv.date;
 inv.paid=normalizeMoneyNumber(fieldValue('invPaid')||0,2);
 inv.notes=fieldValue('invNotes');
 if(inv.client && !state.clients[inv.client])state.clients[inv.client]={name:inv.client,phone:'',address:'',notes:''};
 normalizeInvoice(inv,{skipSupplySync:false});
 const bucket=ensureDraftBucket('invoiceEditor');
 bucket[inv.id]={
   newServiceName:fieldValue('newServiceName'),
   newServiceAmount:fieldValue('newServiceAmount'),
   newSupplyName:fieldValue('newSupplyName'),
   newSupplyQty:fieldValue('newSupplyQty')
 };
 save(reason);
 return true;
}
function saveClientEditDraftOnly(reason='live-draft'){
 if(!document.getElementById('clientNameEdit'))return false;
 const name=fieldValue('clientNameEdit').trim();
 if(!name)return false;
 if(!state.clients)state.clients={};
 const old=state.selectedClient;
 if(old && name!==old && state.clients[old]){
   state.clients[name]={...(state.clients[old]||{}),name,phone:fieldValue('clientPhoneEdit'),address:fieldValue('clientAddressEdit'),notes:fieldValue('clientNotesEdit')};
 }else{
   state.clients[name]={name,phone:fieldValue('clientPhoneEdit'),address:fieldValue('clientAddressEdit'),notes:fieldValue('clientNotesEdit')};
 }
 save(reason);
 return true;
}
function autosaveDraftCurrentPage(reason='live-draft'){
 if(autosaveLock)return;
 autosaveLock=true;
 try{
   ensureCollections();
   if(saveJobDraftOnly(reason))return;
   if(saveEventDraftOnly(reason))return;
   if(saveNewClientDraftOnly(reason))return;
   if(saveClientEditDraftOnly(reason))return;
   if(autosaveSupplyItemPage())return;
   if(saveInvoiceEditorDraftOnly(reason))return;
   if(saveTimeCardMetaDraft(reason))return;
 }catch(err){console.warn('Live autosave skipped:',err)}
 finally{autosaveLock=false;}
}
let liveAutosaveTimer=null;
function queueLiveAutosave(reason='input'){
 clearTimeout(liveAutosaveTimer);
 liveAutosaveTimer=setTimeout(()=>autosaveDraftCurrentPage(reason),450);
}
document.addEventListener('input',e=>{
 const t=e.target;
 if(!t || !['INPUT','TEXTAREA','SELECT'].includes(t.tagName))return;
 if(t.type==='file')return;
 queueLiveAutosave('live-input');
},true);
document.addEventListener('change',e=>{
 const t=e.target;
 if(!t || t.type==='file')return;
 if(['INPUT','TEXTAREA','SELECT'].includes(t.tagName))queueLiveAutosave('live-change');
},true);

function autosaveClientEditPage(){
 if(!document.getElementById('clientNameEdit'))return false;
 let old=state.selectedClient;
 let name=fieldValue('clientNameEdit').trim();
 if(!name)return false;
 if(!state.clients)state.clients={};
 if(old&&name!==old){delete state.clients[old];renameClientInJobs(old,name)}
 state.clients[name]={name,phone:fieldValue('clientPhoneEdit'),address:fieldValue('clientAddressEdit'),notes:fieldValue('clientNotesEdit')};
 state.selectedClient=name;
 save();
 return true;
}
let autosaveLock=false;
function autosaveCurrentPage(reason='manual'){
 clearTimeout(liveAutosaveTimer);
 if(autosaveLock)return;
 autosaveLock=true;
 try{
   ensureCollections();
   let job=readJobFormDraft();
   if(job){if(!commitJobDraft(job)&&hasAnyValue(job)){state.drafts.newJob=job;save();}return;}
   let event=readEventFormDraft();
   if(event){if(!commitEventDraft(event)&&hasAnyValue(event)){state.drafts.newEvent=event;save();}return;}
   let newClient=readNewClientDraft();
   if(newClient){if(!commitNewClientDraft(newClient)&&hasAnyValue(newClient)){state.drafts.newClient=newClient;save();}return;}
   if(autosaveClientEditPage())return;
   if(autosaveSupplyItemPage())return;
   if(autosaveInvoiceEditorPage())return;
   save();
 }catch(err){console.warn('Autosave skipped:',err)}
 finally{autosaveLock=false;}
}
window.addEventListener('beforeunload',()=>autosaveCurrentPage('app-close'));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')autosaveCurrentPage('app-hidden')});


/* ===== V44 SCRATCH PAD / GALLERY ENGINE + SYNC HARDENING ===== */


function renderStudioPage(){
  ensureScratchPad();
  return `<div class="titleRow"><div><h2>Studio</h2><p>Sketch ideas, mock up Legacy Cut products, and save drawings to the gallery.</p></div><div class="note">Creative Workspace</div></div>${renderScratchModule()}`;
}
function renderTimeCardModule(){
  ensureCollections();
  const today=state.selectedDate||dateKey(new Date());
  const logs=(state.timeLogs||[]).filter(l=>l.date===today).sort((a,b)=>String(b.ts).localeCompare(String(a.ts)));
  const totals=timeTotalsForDate(today);
  const status=state.timeClock?.status||'out';
  return `<div class="timeCardModule box"><div class="titleRow miniTitle"><div><h3>Time Card</h3><p class="note">Clock jobs, breaks, and day-end punches with date/time stamps.</p></div><b class="timeStatus ${escapeAttr(status)}">${timeStatusLabel(status)}</b></div><div class="timeButtonGrid"><button class="save" onclick="timePunch('clockIn')">Clock In</button><button onclick="timePunch('breakStart')">Start Break</button><button onclick="timePunch('breakEnd')">End Break</button><button class="delete" onclick="timePunch('clockOut')">Clock Out</button></div><div class="two timeMetaRow"><input id="timeJobTitle" placeholder="Job / task label optional" value="${escapeHtml(state.drafts?.timeCardMeta?.job||'')}"><input id="timeClientName" placeholder="Client optional" list="timeClientOptions" value="${escapeHtml(state.drafts?.timeCardMeta?.client||'')}"></div><datalist id="timeClientOptions">${Object.keys(state.clients||{}).sort().map(n=>`<option value="${escapeHtml(n)}"></option>`).join('')}</datalist><p class="note">Today: ${formatDuration(totals.worked)} worked • ${formatDuration(totals.breaks)} breaks</p><div class="timeLogList">${logs.map(l=>`<div class="timeLogRow"><span>${escapeHtml(timePunchLabel(l.type))}</span><b>${escapeHtml(l.time)}</b><small>${escapeHtml(l.job||'')}${l.client?' • '+escapeHtml(l.client):''}</small></div>`).join('')||'<p class="note">No time punches for this date yet.</p>'}</div></div>`;
}
function timePunch(type){
  ensureCollections();
  const d=new Date();
  const log={id:uid(),type,ts:d.toISOString(),date:dateKey(d),time:d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}),job:fieldValue('timeJobTitle'),client:fieldValue('timeClientName')};
  state.timeLogs.push(log);
  if(type==='clockIn')state.timeClock={status:'in',startedAt:log.ts};
  if(type==='breakStart')state.timeClock={...(state.timeClock||{}),status:'break',breakStartedAt:log.ts};
  if(type==='breakEnd')state.timeClock={...(state.timeClock||{}),status:'in',breakStartedAt:''};
  if(type==='clockOut')state.timeClock={status:'out',endedAt:log.ts};
  save();render();
}
function timeStatusLabel(status){return status==='in'?'CLOCKED IN':status==='break'?'ON BREAK':'CLOCKED OUT'}
function timePunchLabel(type){return ({clockIn:'Clock In',breakStart:'Break Start',breakEnd:'Break End',clockOut:'Clock Out'}[type]||type)}
function timeTotalsForDate(date){
  const logs=(state.timeLogs||[]).filter(l=>l.date===date).sort((a,b)=>String(a.ts).localeCompare(String(b.ts)));
  let worked=0,breaks=0,lastIn=null,lastBreak=null;
  logs.forEach(l=>{const t=new Date(l.ts).getTime();if(l.type==='clockIn')lastIn=t;if(l.type==='breakStart'){if(lastIn){worked+=t-lastIn;lastIn=null;}lastBreak=t;}if(l.type==='breakEnd'){if(lastBreak){breaks+=t-lastBreak;lastBreak=null;}lastIn=t;}if(l.type==='clockOut'){if(lastIn){worked+=t-lastIn;lastIn=null;}if(lastBreak){breaks+=t-lastBreak;lastBreak=null;}}});
  return {worked:worked/3600000,breaks:breaks/3600000};
}
function formatDuration(hours){const mins=Math.round(Number(hours||0)*60);return `${Math.floor(mins/60)}h ${String(mins%60).padStart(2,'0')}m`}
function invoiceTimeLogsHtml(inv){
  const logs=(state.timeLogs||[]).filter(l=>!inv.client||l.client===inv.client||!l.client).sort((a,b)=>String(b.ts).localeCompare(String(a.ts))).slice(0,30);
  const byDate={};logs.forEach(l=>{(byDate[l.date] ||= []).push(l)});
  return `<div class="invoiceTimeLogs box"><h3>Time Logs${inv.client?' — '+escapeHtml(inv.client):''}</h3>${Object.keys(byDate).map(date=>{const totals=timeTotalsForDate(date);return `<div class="timeDateGroup"><b>${escapeHtml(date)} • ${formatDuration(totals.worked)} worked</b>${byDate[date].map(l=>`<div class="timeLogRow"><span>${escapeHtml(timePunchLabel(l.type))}</span><b>${escapeHtml(l.time)}</b><small>${escapeHtml(l.job||'')}</small></div>`).join('')}</div>`}).join('')||'<p class="note">No matching time logs yet.</p>'}</div>`;
}
function toggleInvoiceTimeLogs(id){state.invoiceTimeLogOpen=state.invoiceTimeLogOpen===id?'':id;save();renderInvoiceEditor(id)}
function renderReminderModule(){
  ensureCollections();
  const upcoming=(state.reminders||[]).filter(r=>!r.done).sort((a,b)=>(a.date+' '+a.time).localeCompare(b.date+' '+b.time)).slice(0,5);
  return `<div class="reminderModule box"><div class="titleRow miniTitle"><div><h3>Reminders / Alarms</h3><p class="note">Schedule job and event reminders. Alerts fire while the app is open.</p></div><button onclick="requestReminderPermission()">Enable Alerts</button></div><div class="reminderAddGrid"><input id="reminderTitle" placeholder="Reminder title"><input id="reminderDate" type="date" value="${escapeHtml(state.selectedDate||dateKey(new Date()))}"><input id="reminderTime" type="time"><button class="save" onclick="addReminder()">Add</button></div><div class="reminderList">${upcoming.map(r=>`<div class="reminderRow"><span>${escapeHtml(r.title)}</span><b>${escapeHtml(r.date)} ${escapeHtml(r.time)}</b><button class="smallBtn" onclick="completeReminder('${r.id}')">×</button></div>`).join('')||'<p class="note">No reminders set.</p>'}</div></div>`;
}
function addReminder(){
  ensureCollections();
  const title=fieldValue('reminderTitle').trim(),date=fieldValue('reminderDate'),time=fieldValue('reminderTime');
  if(!title||!date||!time){alert('Add a title, date, and time for the reminder.');return;}
  state.reminders.push({id:uid(),title,date,time,done:false,createdAt:new Date().toISOString()});
  save();scheduleReminderChecks();render();
}
function completeReminder(id){const r=(state.reminders||[]).find(x=>x.id===id);if(r){r.done=true;save();render();}}
function requestReminderPermission(){if('Notification' in window)Notification.requestPermission().then(()=>alert('Reminder alerts enabled for this browser when the app is open.'));else alert('This browser does not support notifications. Reminders will use app alerts.');}
let reminderTimer=null;
function scheduleReminderChecks(){clearInterval(reminderTimer);reminderTimer=setInterval(checkDueReminders,30000);checkDueReminders();}
function checkDueReminders(){
  ensureCollections();const nowMs=Date.now();
  (state.reminders||[]).forEach(r=>{if(r.done||state.firedReminders[r.id])return;const due=new Date(`${r.date}T${r.time}`).getTime();if(!isNaN(due)&&nowMs>=due){state.firedReminders[r.id]=true;save();if('Notification' in window&&Notification.permission==='granted')new Notification('Meridian Reminder',{body:r.title});else alert('Reminder: '+r.title);}})
}

function mountScratchPadFallback(){
  try{
    ensureScratchPad();
    if(state.section!=='schedule' || state.tabs.schedule!=='calendar')return;
    if(document.getElementById('calendarScratchModule'))return;
    const target=document.getElementById('content');
    if(target){target.insertAdjacentHTML('beforeend', renderScratchModule());}
  }catch(e){console.warn('Scratch pad fallback mount failed', e)}
}

function ensureScratchPad(){
  ensureCollections();
  if(!state.scratchPad)state.scratchPad={};
  if(!Array.isArray(state.scratchPad.gallery))state.scratchPad.gallery=[];
  if(!Array.isArray(state.scratchPad.undo))state.scratchPad.undo=[];
  if(!state.scratchPad.activeTab)state.scratchPad.activeTab='pad';
  if(!state.scratchPad.tool)state.scratchPad.tool='pencil';
  if(!state.scratchPad.size)state.scratchPad.size=6;
  if(!state.scratchPad.color)state.scratchPad.color='#111111';
}
function renderScratchModule(){
  ensureScratchPad();
  const sp=state.scratchPad;
  const padActive=sp.activeTab!=='gallery';
  return `<div class="scratchModule box" id="calendarScratchModule"><div class="scratchModuleHeader"><h3>Quick Scratch Pad</h3><p class="note">Sketch quick job ideas, draw over yard photos, and save them to Gallery.</p></div><div class="scratchMiniTabs"><button type="button" class="miniFolderTab ${padActive?'active':''}" onclick="setScratchTab('pad')">Scratch Pad</button><button type="button" class="miniFolderTab ${!padActive?'active':''}" onclick="setScratchTab('gallery')">Gallery</button></div>${padActive?renderScratchPadView():renderScratchGalleryView()}</div>`;
}
function renderScratchPadView(){
  ensureScratchPad();
  const sp=state.scratchPad;
  const menu=sp.menu||'';
  const drawLabel=sp.tool==='eraser'?'Eraser':'Draw';
  const shapeLabel=['line','circle','square','triangle'].includes(sp.tool)?({line:'Line',circle:'Circle',square:'Square',triangle:'Triangle'}[sp.tool]):'Shape';
  return `<div class="scratchPadWrap elegantScratch upgradedScratch"><div class="scratchToolbarCompact"><button type="button" class="toolBtn ${['pencil','eraser'].includes(sp.tool)?'activeTool':''}" onclick="toggleScratchMenu('draw')">✎ ${drawLabel}</button><button type="button" class="toolBtn ${['line','circle','square','triangle'].includes(sp.tool)?'activeTool':''}" onclick="toggleScratchMenu('shape')">◇ ${shapeLabel}</button><button type="button" class="toolBtn" onclick="toggleScratchMenu('style')">☼ Style</button><button type="button" class="toolBtn" onclick="toggleScratchMenu('image')">▣ Image</button><button type="button" class="toolBtn" onclick="undoScratch()">↶ Undo</button></div>${renderScratchPopover(menu)}<div class="scratchCanvasBox"><canvas id="scratchCanvas" class="scratchCanvas"></canvas><div id="scratchHint" class="note">Sketch ideas or draw over yard photos, then save to Gallery.</div></div><div class="scratchActionsCompact"><button type="button" class="save" onclick="saveScratchToGallery()">Save</button><button type="button" onclick="clearScratchPad()">Clear</button><button type="button" onclick="shareScratchPad()">Share</button></div></div>`;
}
function renderScratchPopover(menu){
  ensureScratchPad();
  const sp=state.scratchPad;
  if(menu==='draw'){
    return `<div class="scratchPopover"><button type="button" class="${sp.tool==='pencil'?'activeTool':''}" onclick="setScratchTool('pencil')">✎ Pencil</button><button type="button" class="${sp.tool==='eraser'?'activeTool':''}" onclick="setScratchTool('eraser')">⌫ Eraser</button></div>`;
  }
  if(menu==='shape'){
    return `<div class="scratchPopover"><button type="button" class="${sp.tool==='line'?'activeTool':''}" onclick="setScratchTool('line')">╱ Line</button><button type="button" class="${sp.tool==='circle'?'activeTool':''}" onclick="setScratchTool('circle')">○ Circle</button><button type="button" class="${sp.tool==='square'?'activeTool':''}" onclick="setScratchTool('square')">□ Square</button><button type="button" class="${sp.tool==='triangle'?'activeTool':''}" onclick="setScratchTool('triangle')">△ Triangle</button></div>`;
  }
  if(menu==='style'){
    return `<div class="scratchPopover stylePopover upgradedStyle"><div class="colorWheelWrap"><label>Color Wheel <input class="colorWheelInput" type="color" value="${escapeHtml(sp.color)}" oninput="setScratchColor(this.value)"><span class="colorSwatch" style="background:${escapeHtml(sp.color)}"></span></label></div><label>Size <input type="range" min="2" max="44" value="${Number(sp.size||6)}" oninput="setScratchSize(this.value)"> <b>${Number(sp.size||6)}px</b></label></div>`;
  }
  if(menu==='image'){
    return `<div class="scratchPopover imagePopover"><label class="toolBtn uploadBtnCompact">📁 Choose from Files<input type="file" accept="image/*" onchange="addScratchImage(event)"></label><label class="toolBtn uploadBtnCompact">📷 Take Photo<input type="file" accept="image/*" capture="environment" onchange="addScratchImage(event)"></label></div>`;
  }
  return '';
}
function renderScratchGalleryView(){
  ensureScratchPad();
  const items=state.scratchPad.gallery||[];
  return `<div class="scratchGallery"><div class="titleRow miniTitle"><div><h3>Saved Sketches</h3><p class="note">View, add to client notes, share, or delete.</p></div></div>${items.map(g=>`<div class="galleryCard"><img src="${g.image}" class="galleryImg"><div><b>${escapeHtml(g.title||'Sketch')}</b><small>${escapeHtml(g.date||'')}</small><div class="actions"><button type="button" onclick="addSketchToClient('${g.id}')">Add</button><button type="button" onclick="shareGallerySketch('${g.id}')">Share</button><button type="button" class="delete" onclick="deleteGallerySketch('${g.id}')">Delete</button></div></div></div>`).join('')||'<p class="note">No saved sketches yet.</p>'}</div>`;
}
function toggleScratchMenu(menu){ensureScratchPad();state.scratchPad.menu=state.scratchPad.menu===menu?'':menu;save();render()}
function setScratchTab(tab){ensureScratchPad();state.scratchPad.activeTab=tab;state.scratchPad.menu='';save();render()}
function setScratchTool(tool){ensureScratchPad();state.scratchPad.tool=tool;state.scratchPad.menu='';save();render()}
function setScratchColor(color){ensureScratchPad();state.scratchPad.color=color;save();initScratchPad()}
function setScratchSize(size){ensureScratchPad();state.scratchPad.size=Number(size||6);save();}

function initScratchPad(){
  ensureScratchPad();
  const canvas=document.getElementById('scratchCanvas');
  if(!canvas)return;
  const box=canvas.parentElement;
  const dpr=Math.max(1,Math.min(window.devicePixelRatio||1,2));
  const rect=box.getBoundingClientRect();
  const cssW=Math.max(320,Math.round(rect.width||320));
  const cssH=Math.max(460,Math.round(rect.height||460));
  canvas.style.width='100%';
  canvas.style.height='100%';
  if(canvas.width!==Math.round(cssW*dpr)||canvas.height!==Math.round(cssH*dpr)){
    canvas.width=Math.round(cssW*dpr);
    canvas.height=Math.round(cssH*dpr);
  }
  const ctx=canvas.getContext('2d',{alpha:false});
  const resetTransform=()=>ctx.setTransform(dpr,0,0,dpr,0,0);
  resetTransform();
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';

  const paintBackground=()=>{ctx.save();resetTransform();ctx.globalCompositeOperation='source-over';ctx.fillStyle='#fffdf7';ctx.fillRect(0,0,cssW,cssH);ctx.restore();};
  paintBackground();
  const existing=state.scratchPad.canvasData;
  if(existing){const img=new Image();img.onload=()=>{paintBackground();ctx.drawImage(img,0,0,cssW,cssH)};img.src=existing;}

  let drawing=false,start=null,last=null,raf=0,queue=[],shapePoint=null,snap=null;
  const point=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*(cssW/r.width),y:(e.clientY-r.top)*(cssH/r.height),t:performance.now(),p:(e.pressure&&e.pressure>0)?e.pressure:.6}};
  const snapshot=()=>canvas.toDataURL('image/png');
  const pushUndo=()=>{state.scratchPad.undo.push(snapshot());if(state.scratchPad.undo.length>60)state.scratchPad.undo.shift();save('scratch-undo')};
  const commit=()=>{state.scratchPad.canvasData=snapshot();save('scratch-commit')};
  const drawSegment=(a,b,c)=>{
    ctx.save();resetTransform();ctx.lineCap='round';ctx.lineJoin='round';ctx.globalCompositeOperation=state.scratchPad.tool==='eraser'?'destination-out':'source-over';ctx.strokeStyle=state.scratchPad.color;
    const base=Number(state.scratchPad.size||6)*(state.scratchPad.tool==='eraser'?1.45:1);
    const dist=Math.hypot(c.x-a.x,c.y-a.y);
    ctx.lineWidth=Math.max(1,base*(dist>60?.85:1));
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(b.x,b.y,c.x,c.y);ctx.stroke();ctx.restore();
  };
  const process=()=>{
    raf=0;
    while(queue.length>0){
      const p=queue.shift();
      if(!last){last=p;continue;}
      const mid={x:(last.x+p.x)/2,y:(last.y+p.y)/2};
      drawSegment(last,last,mid);
      last=p;
    }
  };
  const redrawSnap=(done)=>{
    paintBackground();
    if(!snap){done?.();return;}
    const img=new Image();img.onload=()=>{paintBackground();ctx.drawImage(img,0,0,cssW,cssH);done?.()};img.src=snap;
  };
  const shape=(p)=>{ctx.save();resetTransform();ctx.globalCompositeOperation='source-over';ctx.lineWidth=Number(state.scratchPad.size||6);ctx.strokeStyle=state.scratchPad.color;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();const x=start.x,y=start.y,w=p.x-start.x,h=p.y-start.y;if(state.scratchPad.tool==='line'){ctx.moveTo(x,y);ctx.lineTo(p.x,p.y)}else if(state.scratchPad.tool==='circle'){ctx.ellipse(x+w/2,y+h/2,Math.abs(w/2),Math.abs(h/2),0,0,Math.PI*2)}else if(state.scratchPad.tool==='square'){ctx.roundRect?ctx.roundRect(x,y,w,h,8):ctx.rect(x,y,w,h)}else if(state.scratchPad.tool==='triangle'){ctx.moveTo(x+w/2,y);ctx.lineTo(p.x,p.y);ctx.lineTo(x,y+h);ctx.closePath()}ctx.stroke();ctx.restore();};
  const preview=()=>{const p=shapePoint;if(!p)return;redrawSnap(()=>shape(p));};

  canvas.onpointerdown=e=>{e.preventDefault();canvas.setPointerCapture?.(e.pointerId);drawing=true;start=point(e);last=null;queue=[];shapePoint=null;pushUndo();snap=snapshot();if(['pencil','eraser'].includes(state.scratchPad.tool)){queue.push(start);if(!raf)raf=requestAnimationFrame(process)}};
  canvas.onpointermove=e=>{if(!drawing)return;e.preventDefault();const p=point(e);if(['pencil','eraser'].includes(state.scratchPad.tool)){queue.push(p);if(!raf)raf=requestAnimationFrame(process)}else{shapePoint=p;if(!raf)raf=requestAnimationFrame(()=>{raf=0;preview()})}};
  const finish=()=>{if(!drawing)return;drawing=false;if(raf){cancelAnimationFrame(raf);raf=0}if(queue.length)process();if(shapePoint&&!['pencil','eraser'].includes(state.scratchPad.tool))preview();commit()};
  canvas.onpointerup=finish;canvas.onpointercancel=finish;canvas.onpointerleave=finish;
}
function undoScratch(){ensureScratchPad();const data=state.scratchPad.undo.pop();if(!data)return;state.scratchPad.canvasData=data;save();initScratchPad()}
function clearScratchPad(){if(!confirm('Clear the scratch pad?'))return;ensureScratchPad();state.scratchPad.canvasData='';state.scratchPad.undo=[];save();initScratchPad()}
function addScratchImage(e){
  const file=e.target.files?.[0];
  if(!file)return;
  ensureScratchPad();
  const reader=new FileReader();
  reader.onload=()=>{
    const canvas=document.getElementById('scratchCanvas');
    if(!canvas)return;
    const ctx=canvas.getContext('2d');
    const dpr=Math.max(1,Math.min(window.devicePixelRatio||1,2));
    const r=canvas.getBoundingClientRect();
    const cssW=Math.max(320,Math.round(r.width||320));
    const cssH=Math.max(460,Math.round(r.height||460));
    const img=new Image();
    img.onload=()=>{
      state.scratchPad.undo.push(canvas.toDataURL('image/png'));
      if(state.scratchPad.undo.length>60)state.scratchPad.undo.shift();
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality='high';
      const ratio=Math.min((cssW*.86)/img.width,(cssH*.86)/img.height,1);
      const w=img.width*ratio,h=img.height*ratio;
      ctx.drawImage(img,(cssW-w)/2,(cssH-h)/2,w,h);
      state.scratchPad.canvasData=canvas.toDataURL('image/png');
      save('scratch-image');
      e.target.value='';
    };
    img.src=reader.result;
  };
  reader.readAsDataURL(file)
}
function saveScratchToGallery(){ensureScratchPad();const canvas=document.getElementById('scratchCanvas');if(!canvas)return;const image=canvas.toDataURL('image/png');if(!image)return;state.scratchPad.gallery.unshift({id:uid(),title:'Sketch '+new Date().toLocaleString(),date:new Date().toLocaleString(),image});state.scratchPad.activeTab='gallery';save();render()}
function scratchCurrentImage(){const canvas=document.getElementById('scratchCanvas');return canvas?canvas.toDataURL('image/png'):state.scratchPad?.canvasData}
async function shareDataUrl(data,title='Meridian Sketch'){try{const blob=await(await fetch(data)).blob();const file=new File([blob],'meridian-sketch.png',{type:'image/png'});if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title});return true}}catch(e){}return false}
async function shareScratchPad(){const data=scratchCurrentImage();if(!data)return;if(await shareDataUrl(data,'Meridian Sketch'))return;alert('Native share is not available in this browser. Save to Gallery first, then share from there.')}
async function shareGallerySketch(id){const g=(state.scratchPad?.gallery||[]).find(x=>x.id===id);if(!g)return;if(await shareDataUrl(g.image,g.title))return;alert('Share is not available on this device/browser.')}
function deleteGallerySketch(id){if(!confirm('Delete this saved sketch?'))return;state.scratchPad.gallery=(state.scratchPad.gallery||[]).filter(g=>g.id!==id);save();render()}
function addSketchToClient(id){const g=(state.scratchPad?.gallery||[]).find(x=>x.id===id);if(!g)return;const name=prompt('Add sketch to which client/contact? Type saved or new name:');if(!name)return;ensureCollections();if(!state.clients[name])state.clients[name]={name,phone:'',address:'',notes:''};if(!Array.isArray(state.clients[name].sketches))state.clients[name].sketches=[];state.clients[name].sketches.push({id:g.id,title:g.title,date:g.date,image:g.image});state.clients[name].notes=((state.clients[name].notes||'')+`\n[Sketch added: ${g.title} — ${g.date}]`).trim();save();alert('Sketch added to client notes/gallery.')}


/* ===== V49.15-LC7 LEGACY CUT MOCKUP BUILDER =====
   Targeted Studio addition only. Scratch Pad and Gallery remain intact. */

const MOCKUP_PRODUCT_TEMPLATES={
  sign:{label:'Sign',shape:'roundedRect',width:18,height:8,thickness:.25},
  frame:{label:'Frame',shape:'frame',width:14,height:10,thickness:.25},
  puzzle:{label:'Puzzle',shape:'puzzle',width:10,height:10,thickness:.2},
  coasters:{label:'Coasters',shape:'circle',width:4,height:4,thickness:.2},
  keychain:{label:'Key Chain',shape:'keychain',width:3,height:1.6,thickness:.125},
  bookmark:{label:'Bookmark',shape:'bookmark',width:2,height:7,thickness:.125},
  notebook:{label:'Notebook Cover',shape:'notebook',width:6,height:8,thickness:.125},
  bookbox:{label:'Book Box',shape:'bookbox',width:7,height:9,thickness:.25},
  garden:{label:'Garden Stakes',shape:'gardenStake',width:3,height:12,thickness:.125},
  custom:{label:'Custom Shape',shape:'roundedRect',width:10,height:6,thickness:.25}
};
const MOCKUP_WOOD_PRESETS={
  basswood:{label:'Basswood',base:'#d9b575',grain:'#b98743'},
  birch:{label:'Birch',base:'#ead39a',grain:'#c79d58'},
  cedar:{label:'Cedar',base:'#b46a35',grain:'#7d3f20'},
  walnut:{label:'Walnut',base:'#6b4025',grain:'#3c2113'},
  oak:{label:'Oak',base:'#c89452',grain:'#8a5d2e'},
  mdf:{label:'MDF',base:'#b58d62',grain:'#8f6a42'},
  custom:{label:'Custom Wood',base:'#d9b575',grain:'#a47435'}
};
const MOCKUP_FINISH_PRESETS={
  natural:{label:'Natural',color:''},
  light:{label:'Light Stain',color:'#c99653'},
  dark:{label:'Dark Stain',color:'#5a321c'},
  white:{label:'White',color:'#f4efe4'},
  black:{label:'Black',color:'#1e1914'},
  red:{label:'Red',color:'#9d2722'},
  pink:{label:'Pink',color:'#d9829d'},
  purple:{label:'Purple',color:'#6c4b8a'},
  blue:{label:'Blue',color:'#3e70a4'},
  green:{label:'Green',color:'#4f7f45'},
  custom:{label:'Custom Color',color:''}
};
function defaultMockupBuilderState(){return {product:'sign',wood:'basswood',shape:'roundedRect',width:18,height:8,thickness:.25,finish:'natural',customBaseColor:'#d9b575',selectedLayerId:'',layers:[],saved:[],draftText:'Legacy Cut',draftFont:'Georgia',draftSize:86,draftFinish:'dark',draftCustomColor:'#5a321c'};}
function ensureMockupBuilder(){ensureCollections();if(!state.mockupBuilder)state.mockupBuilder=defaultMockupBuilderState();let m=state.mockupBuilder;if(!Array.isArray(m.layers))m.layers=[];if(!Array.isArray(m.saved))m.saved=[];if(!m.product)m.product='sign';if(!m.wood)m.wood='basswood';if(!m.shape)m.shape='roundedRect';if(!m.width)m.width=18;if(!m.height)m.height=8;if(!m.thickness)m.thickness=.25;if(!m.finish)m.finish='natural';if(!m.customBaseColor)m.customBaseColor='#d9b575';if(!m.draftText)m.draftText='Legacy Cut';if(!m.draftFont)m.draftFont='Georgia';if(!m.draftSize)m.draftSize=86;if(!m.draftFinish)m.draftFinish='dark';if(!m.draftCustomColor)m.draftCustomColor='#5a321c';}
function mockupBaseColor(){ensureMockupBuilder();const m=state.mockupBuilder;const wood=MOCKUP_WOOD_PRESETS[m.wood]||MOCKUP_WOOD_PRESETS.basswood;const finish=MOCKUP_FINISH_PRESETS[m.finish]||MOCKUP_FINISH_PRESETS.natural;if(m.finish==='custom')return m.customBaseColor||wood.base;return finish.color||wood.base;}
function mockupGrainColor(){const wood=MOCKUP_WOOD_PRESETS[state.mockupBuilder?.wood]||MOCKUP_WOOD_PRESETS.basswood;return wood.grain||'#8f6a42';}
function mockupLayerColor(layer){const finish=MOCKUP_FINISH_PRESETS[layer.finish||'dark']||MOCKUP_FINISH_PRESETS.dark;if(layer.finish==='custom')return layer.customColor||'#5a321c';return finish.color||'#5a321c';}
function clampColorVal(n,min,max){n=Number(n);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):min}
function hexToHsv(hex){hex=String(hex||'#000000').replace('#','');if(hex.length===3)hex=hex.split('').map(c=>c+c).join('');let r=parseInt(hex.slice(0,2),16)/255,g=parseInt(hex.slice(2,4),16)/255,b=parseInt(hex.slice(4,6),16)/255;let max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,h=0,s=max===0?0:d/max,v=max;if(d){if(max===r)h=((g-b)/d)%6;else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h=Math.round(h*60);if(h<0)h+=360;}return{h,s:Math.round(s*100),v:Math.round(v*100)}}
function hsvToHex(h,s,v){h=clampColorVal(h,0,360);s=clampColorVal(s,0,100)/100;v=clampColorVal(v,0,100)/100;let c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c,r=0,g=0,b=0;if(h<60){r=c;g=x}else if(h<120){r=x;g=c}else if(h<180){g=c;b=x}else if(h<240){g=x;b=c}else if(h<300){r=x;b=c}else{r=c;b=x}const toHex=n=>Math.round((n+m)*255).toString(16).padStart(2,'0');return '#'+toHex(r)+toHex(g)+toHex(b)}
function mockupCurrentColorForTarget(target,layerId){ensureMockupBuilder();const m=state.mockupBuilder;if(target==='base')return m.customBaseColor||mockupBaseColor()||'#d9b575';if(target==='draftText')return m.draftCustomColor||'#5a321c';if(target==='layerText'){const l=m.layers.find(x=>x.id===layerId)||m.layers.find(x=>x.id===m.selectedLayerId);return l?.customColor||mockupLayerColor(l||{})||'#5a321c';}return '#5a321c'}
function openMockupColorPicker(target,layerId=''){ensureMockupBuilder();const color=mockupCurrentColorForTarget(target,layerId);const hsv=hexToHsv(color);state.mockupColorPicker={target,layerId,h:hsv.h,s:hsv.s,v:hsv.v,color:hsvToHex(hsv.h,hsv.s,hsv.v)};save('mockup-color-open');render()}
function closeMockupColorPicker(){if(state.mockupColorPicker)delete state.mockupColorPicker;save('mockup-color-close');render()}
function applyMockupPickerColor(close=false){ensureMockupBuilder();const p=state.mockupColorPicker;if(!p)return;const color=hsvToHex(p.h,p.s,p.v);p.color=color;const m=state.mockupBuilder;if(p.target==='base'){m.finish='custom';m.customBaseColor=color;}else if(p.target==='draftText'){m.draftFinish='custom';m.draftCustomColor=color;}else if(p.target==='layerText'){const layer=m.layers.find(l=>l.id===p.layerId)||m.layers.find(l=>l.id===m.selectedLayerId);if(layer){layer.finish='custom';layer.customColor=color;m.selectedLayerId=layer.id;}}if(close)delete state.mockupColorPicker;save('mockup-color-set');render()}
function setMockupPickerHue(value){const p=state.mockupColorPicker;if(!p)return;p.h=clampColorVal(value,0,360);p.color=hsvToHex(p.h,p.s,p.v);save('mockup-color-hue');render()}
function mockupColorSquarePointer(evt){evt.preventDefault();const el=evt.currentTarget;const rect=el.getBoundingClientRect();const x=clampColorVal(evt.clientX-rect.left,0,rect.width);const y=clampColorVal(evt.clientY-rect.top,0,rect.height);const p=state.mockupColorPicker;if(!p)return;p.s=Math.round((x/rect.width)*100);p.v=Math.round(100-(y/rect.height)*100);p.color=hsvToHex(p.h,p.s,p.v);save('mockup-color-square');render()}
function mockupColorWheelPointer(evt){evt.preventDefault();const el=evt.currentTarget;const rect=el.getBoundingClientRect();const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;let deg=Math.atan2(evt.clientY-cy,evt.clientX-cx)*180/Math.PI+90;if(deg<0)deg+=360;const p=state.mockupColorPicker;if(!p)return;p.h=Math.round(deg);p.color=hsvToHex(p.h,p.s,p.v);save('mockup-color-wheel');render()}
function renderMockupColorPicker(){const p=state.mockupColorPicker;if(!p)return '';const color=hsvToHex(p.h,p.s,p.v);const x=clampColorVal(p.s,0,100),y=100-clampColorVal(p.v,0,100);const hueStyle=`background:linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,hsl(${Number(p.h||0)},100%,50%))`;const label=p.target==='base'?'Base Wood Color':p.target==='draftText'?'New Text Color':'Selected Text Color';return `<div class="mockColorOverlay" onclick="closeMockupColorPicker()"><div class="mockColorModal" onclick="event.stopPropagation()"><div class="titleRow miniTitle"><div><h3>Color Selector</h3><p class="note">${label}</p></div><button type="button" class="smallBtn" onclick="closeMockupColorPicker()">×</button></div><div class="mockColorPickerGrid"><div class="mockWheelWrap"><div class="mockHueWheel" onpointerdown="mockupColorWheelPointer(event)"><span class="mockHueMarker" style="transform:rotate(${Number(p.h||0)}deg) translateY(-78px);"></span></div><label>Hue <input type="range" min="0" max="360" value="${Number(p.h||0)}" oninput="setMockupPickerHue(this.value)"></label></div><div><div class="mockColorSquare" style="${hueStyle}" onpointerdown="mockupColorSquarePointer(event)"><span style="left:${x}%;top:${y}%"></span></div><div class="mockChosenRow"><div><b>Chosen color</b><code>${escapeHtml(color)}</code></div><span class="mockChosenSwatch" style="background:${escapeHtml(color)}"></span></div></div></div><div class="actions mockColorActions"><button type="button" onclick="closeMockupColorPicker()">Cancel</button><button type="button" class="save" onclick="applyMockupPickerColor(true)">Set Color</button></div></div></div>`}
function mockupTemplateOptions(){return Object.keys(MOCKUP_PRODUCT_TEMPLATES).map(k=>`<option value="${k}" ${state.mockupBuilder.product===k?'selected':''}>${MOCKUP_PRODUCT_TEMPLATES[k].label}</option>`).join('')}
function mockupWoodOptions(){return Object.keys(MOCKUP_WOOD_PRESETS).map(k=>`<option value="${k}" ${state.mockupBuilder.wood===k?'selected':''}>${MOCKUP_WOOD_PRESETS[k].label}</option>`).join('')}
function mockupFinishOptions(selected){return Object.keys(MOCKUP_FINISH_PRESETS).map(k=>`<option value="${k}" ${selected===k?'selected':''}>${MOCKUP_FINISH_PRESETS[k].label}</option>`).join('')}
function renderMockupBuilder(){
  ensureMockupBuilder();const m=state.mockupBuilder;const sel=m.layers.find(l=>l.id===m.selectedLayerId)||null;
  return `<div class="titleRow"><div><h2>Mockup Builder</h2><p>Build Legacy Cut product previews with wood pieces, stains, colors, and raised laser-cut lettering.</p></div><div class="note">Studio / Legacy Cut</div></div>
  <div class="mockupBuilder">
    <div class="mockupControls box">
      <h3>Base Wood</h3>
      <label>Product Shape</label><select id="mockProduct" onchange="setMockupProduct(this.value)">${mockupTemplateOptions()}</select>
      <div class="two"><div><label>Wood Type</label><select id="mockWood" onchange="updateMockupField('wood',this.value)">${mockupWoodOptions()}</select></div><div><label>Base Finish / Color</label><select id="mockFinish" onchange="updateMockupField('finish',this.value)">${mockupFinishOptions(m.finish)}</select></div></div>
      <label>Custom Base Color</label><button type="button" class="mockColorButton" onclick="openMockupColorPicker('base')"><span class="mockColorSwatch" style="background:${escapeHtml(m.customBaseColor||'#d9b575')}"></span><span>Pick Base Color</span></button>
      <div class="three"><div><label>Width</label><input type="number" step="0.25" value="${escapeHtml(m.width)}" oninput="updateMockupField('width',this.value)"></div><div><label>Height</label><input type="number" step="0.25" value="${escapeHtml(m.height)}" oninput="updateMockupField('height',this.value)"></div><div><label>Thickness</label><input type="number" step="0.125" value="${escapeHtml(m.thickness)}" oninput="updateMockupField('thickness',this.value)"></div></div>
      <h3>Laser-Cut Text Piece</h3>
      <label>Words</label><input id="mockText" value="${escapeHtml(m.draftText)}" oninput="updateMockupFieldLive('draftText',this.value)">
      <div class="two"><div><label>Font</label><select id="mockFont" onchange="updateMockupFieldLive('draftFont',this.value)">${mockupFontOptions(m.draftFont)}</select></div><div><label>Text Size</label><input type="number" min="18" max="220" value="${escapeHtml(m.draftSize)}" oninput="updateMockupFieldLive('draftSize',this.value)"></div></div>
      <div class="two"><div><label>Letter Stain / Color</label><select id="mockTextFinish" onchange="updateMockupFieldLive('draftFinish',this.value)">${mockupFinishOptions(m.draftFinish)}</select></div><div><label>Custom Letter Color</label><button type="button" class="mockColorButton" onclick="openMockupColorPicker('draftText')"><span class="mockColorSwatch" style="background:${escapeHtml(m.draftCustomColor||'#5a321c')}"></span><span>Pick Letter Color</span></button></div></div>
      <div class="actions"><button type="button" class="save" onclick="addMockupTextLayer()">Add Text Piece</button><button type="button" onclick="duplicateSelectedMockupLayer()">Duplicate Selected</button><button type="button" class="delete" onclick="deleteSelectedMockupLayer()">Delete Selected</button></div>
      ${sel?renderSelectedMockupEditor(sel):'<p class="note">Select a text piece on the mockup to edit, move, resize, rotate, duplicate, or delete it.</p>'}
      <h3>Save</h3><div class="actions"><button type="button" class="save" onclick="saveMockupToGallery()">Save to Gallery</button><button type="button" onclick="saveMockupSnapshot()">Save Mockup</button><button type="button" onclick="clearMockupBuilder()">Clear Mockup</button></div>
    </div>
    <div class="mockupStage box">
      <div class="mockupStageHeader"><b>${escapeHtml((MOCKUP_PRODUCT_TEMPLATES[m.product]||{}).label||'Custom Product')}</b><small>${escapeHtml(m.width)}&quot; × ${escapeHtml(m.height)}&quot; × ${escapeHtml(m.thickness)}&quot;</small></div>
      ${renderMockupSvg()}
      <p class="note">Drag text pieces directly on the wood. Use Rotate/Size after selecting a piece.</p>
    </div>
  </div>
  <div class="mockupSaved box"><div class="titleRow miniTitle"><div><h3>Saved Mockups</h3><p class="note">Saved mockups stay in this Legacy Cut copy. Gallery saves also appear under Studio → Gallery.</p></div></div>${renderSavedMockups()}</div>${renderMockupColorPicker()}`;
}
function mockupFontOptions(selected){const fonts=['Georgia','Times New Roman','Arial','Verdana','Trebuchet MS','Impact','Courier New','Brush Script MT','Lucida Handwriting'];return fonts.map(f=>`<option value="${escapeHtml(f)}" ${selected===f?'selected':''}>${escapeHtml(f)}</option>`).join('')}
function renderSelectedMockupEditor(layer){return `<div class="selectedMockupEditor"><h3>Selected Text Piece</h3><p class="note">Edits update the selected lettering live without rebuilding the whole Studio page.</p><label>Text</label><input value="${escapeHtml(layer.text||'')}" oninput="updateMockupLayerLive('${layer.id}','text',this.value)"><div class="two"><div><label>Font</label><select onchange="updateMockupLayerLive('${layer.id}','font',this.value)">${mockupFontOptions(layer.font)}</select></div><div><label>Size</label><input type="number" value="${escapeHtml(layer.size||80)}" oninput="updateMockupLayerLive('${layer.id}','size',this.value)"></div></div><div class="two"><div><label>Finish</label><select onchange="updateMockupLayerLive('${layer.id}','finish',this.value)">${mockupFinishOptions(layer.finish||'dark')}</select></div><div><label>Custom Color</label><button type="button" class="mockColorButton" onclick="openMockupColorPicker('layerText','${layer.id}')"><span class="mockColorSwatch" style="background:${escapeHtml(layer.customColor||'#5a321c')}"></span><span>Pick Selected Color</span></button></div></div><label>Rotate</label><input type="range" min="-45" max="45" value="${escapeHtml(layer.rotate||0)}" oninput="updateMockupLayerLive('${layer.id}','rotate',this.value)"><div class="actions"><button type="button" onclick="duplicateSelectedMockupLayer()">Duplicate</button><button type="button" class="delete" onclick="deleteSelectedMockupLayer()">Delete</button></div></div>`}
function renderMockupSvg(){ensureMockupBuilder();const m=state.mockupBuilder;return `<svg id="mockupSvg" class="mockupSvg" viewBox="0 0 1000 650" role="img" aria-label="Legacy Cut product mockup" onpointermove="mockupPointerMove(event)" onpointerup="mockupPointerUp(event)" onpointercancel="mockupPointerUp(event)" onpointerleave="mockupPointerUp(event)">
  <defs>${mockupSvgDefs()}</defs>
  <rect x="0" y="0" width="1000" height="650" rx="24" fill="#f7edda"/>
  ${mockupBaseShapeSvg()}
  ${m.layers.map(renderMockupLayerSvg).join('')}
</svg>`}
function mockupSvgDefs(){const base=mockupBaseColor(),grain=mockupGrainColor();return `<filter id="mockShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#000" flood-opacity=".38"/></filter><filter id="letterShadow" x="-40%" y="-50%" width="180%" height="200%"><feDropShadow dx="4" dy="7" stdDeviation="3" flood-color="#000" flood-opacity=".42"/></filter><pattern id="woodGrain" patternUnits="userSpaceOnUse" width="120" height="42"><rect width="120" height="42" fill="${base}"/><path d="M0 8 C30 2,55 15,90 7 S130 12,150 5" stroke="${grain}" stroke-width="2" fill="none" opacity=".32"/><path d="M0 24 C28 32,60 16,95 28 S130 30,150 22" stroke="${grain}" stroke-width="2" fill="none" opacity=".24"/><path d="M0 38 C38 34,60 44,120 36" stroke="#fff" stroke-width="1" fill="none" opacity=".12"/></pattern>`}
function mockupBaseShapeSvg(){const m=state.mockupBuilder;const fill='url(#woodGrain)';const stroke='rgba(55,28,12,.55)';const common=`fill="${fill}" stroke="${stroke}" stroke-width="8" filter="url(#mockShadow)"`;switch(m.shape){case 'circle':return `<circle cx="500" cy="325" r="210" ${common}/>`;case 'keychain':return `<rect x="255" y="235" width="490" height="210" rx="80" ${common}/><circle cx="310" cy="325" r="38" fill="#f7edda" stroke="${stroke}" stroke-width="8"/>`;case 'bookmark':return `<path d="M390 105 H610 V545 L500 485 L390 545 Z" ${common}/>`;case 'gardenStake':return `<path d="M405 70 H595 Q625 70 625 100 V430 L500 600 L375 430 V100 Q375 70 405 70 Z" ${common}/>`;case 'frame':return `<path d="M210 135 H790 Q830 135 830 175 V500 Q830 540 790 540 H210 Q170 540 170 500 V175 Q170 135 210 135 Z M295 215 V460 H705 V215 Z" fill-rule="evenodd" ${common}/>`;case 'puzzle':return `<path d="M240 145 H455 Q450 105 500 105 Q550 105 545 145 H760 V360 Q800 350 800 400 Q800 450 760 440 V545 H545 Q550 585 500 585 Q450 585 455 545 H240 V440 Q200 450 200 400 Q200 350 240 360 Z" ${common}/>`;case 'notebook':return `<rect x="285" y="95" width="430" height="520" rx="28" ${common}/><line x1="350" y1="120" x2="350" y2="590" stroke="rgba(60,30,13,.3)" stroke-width="8"/>`;case 'bookbox':return `<rect x="285" y="85" width="430" height="540" rx="22" ${common}/><rect x="325" y="130" width="350" height="450" rx="18" fill="none" stroke="rgba(60,30,13,.25)" stroke-width="7"/>`;default:return `<rect x="160" y="170" width="680" height="310" rx="42" ${common}/>`;}}
function renderMockupLayerSvg(layer){const selected=state.mockupBuilder.selectedLayerId===layer.id;const color=mockupLayerColor(layer);const stroke=layer.finish==='white'?'#b89961':'#6f3f20';return `<g id="mockLayer-${layer.id}" class="mockTextLayer ${selected?'selected':''}" transform="translate(${Number(layer.x||500)} ${Number(layer.y||325)}) rotate(${Number(layer.rotate||0)})" onpointerdown="mockupPointerDown(event,'${layer.id}')"><text text-anchor="middle" dominant-baseline="middle" font-family="${escapeHtml(layer.font||'Georgia')}" font-size="${Number(layer.size||86)}" font-weight="800" fill="${color}" stroke="${stroke}" stroke-width="2" paint-order="stroke fill" filter="url(#letterShadow)">${escapeHtml(layer.text||'Text')}</text>${selected?'<rect x="-180" y="-55" width="360" height="110" rx="10" fill="none" stroke="#2b6cb0" stroke-width="4" stroke-dasharray="10 8" pointer-events="none"/>':''}</g>`}
function setMockupProduct(key){ensureMockupBuilder();const t=MOCKUP_PRODUCT_TEMPLATES[key]||MOCKUP_PRODUCT_TEMPLATES.custom;Object.assign(state.mockupBuilder,{product:key,shape:t.shape,width:t.width,height:t.height,thickness:t.thickness});save('mockup-product');render()}
function updateMockupField(key,value){ensureMockupBuilder();if(['width','height','thickness','draftSize'].includes(key))value=Number(value||0);state.mockupBuilder[key]=value;save('mockup-field');render()}
function updateMockupFieldLive(key,value){ensureMockupBuilder();if(['width','height','thickness','draftSize'].includes(key))value=Number(value||0);state.mockupBuilder[key]=value;save('mockup-field-live')}
function addMockupTextLayer(){ensureMockupBuilder();const m=state.mockupBuilder;const text=String(m.draftText||'').trim();if(!text){alert('Type the words to add first.');return;}const layer={id:uid(),type:'text',text,x:500,y:325,size:Number(m.draftSize||86),font:m.draftFont||'Georgia',finish:m.draftFinish||'dark',customColor:m.draftCustomColor||'#5a321c',rotate:0};m.layers.push(layer);m.selectedLayerId=layer.id;save('mockup-add-text');render()}
function updateMockupLayer(id,key,value){ensureMockupBuilder();const layer=state.mockupBuilder.layers.find(l=>l.id===id);if(!layer)return;if(['size','rotate','x','y'].includes(key))value=Number(value||0);layer[key]=value;save('mockup-layer');render()}
function updateMockupLayerLive(id,key,value){ensureMockupBuilder();const layer=state.mockupBuilder.layers.find(l=>l.id===id);if(!layer)return;if(['size','rotate','x','y'].includes(key))value=Number(value||0);layer[key]=value;state.mockupBuilder.selectedLayerId=id;syncMockupLayerDom(layer);save('mockup-layer-live')}
function syncMockupLayerDom(layer){const g=document.getElementById('mockLayer-'+layer.id);if(!g)return;g.setAttribute('transform',`translate(${Number(layer.x||500)} ${Number(layer.y||325)}) rotate(${Number(layer.rotate||0)})`);const textEl=g.querySelector('text');if(!textEl)return;textEl.textContent=layer.text||'Text';textEl.setAttribute('font-family',layer.font||'Georgia');textEl.setAttribute('font-size',Number(layer.size||86));textEl.setAttribute('fill',mockupLayerColor(layer));textEl.setAttribute('stroke',layer.finish==='white'?'#b89961':'#6f3f20')}
function duplicateSelectedMockupLayer(){ensureMockupBuilder();const m=state.mockupBuilder;const layer=m.layers.find(l=>l.id===m.selectedLayerId);if(!layer)return;const copy={...layer,id:uid(),x:Number(layer.x||500)+32,y:Number(layer.y||325)+32};m.layers.push(copy);m.selectedLayerId=copy.id;save('mockup-duplicate');render()}
function deleteSelectedMockupLayer(){ensureMockupBuilder();const id=state.mockupBuilder.selectedLayerId;if(!id)return;state.mockupBuilder.layers=state.mockupBuilder.layers.filter(l=>l.id!==id);state.mockupBuilder.selectedLayerId='';save('mockup-delete-layer');render()}
function clearMockupBuilder(){if(!confirm('Clear the current mockup?'))return;const saved=state.mockupBuilder?.saved||[];state.mockupBuilder=defaultMockupBuilderState();state.mockupBuilder.saved=saved;save('mockup-clear');render()}
let mockupDrag=null;
function initMockupBuilder(){ensureMockupBuilder();}
function mockupSvgPoint(evt){const svg=document.getElementById('mockupSvg');if(!svg)return{x:500,y:325};const pt=svg.createSVGPoint();pt.x=evt.clientX;pt.y=evt.clientY;const ctm=svg.getScreenCTM();if(!ctm)return{x:500,y:325};return pt.matrixTransform(ctm.inverse())}
function mockupPointerDown(evt,id){evt.preventDefault();evt.stopPropagation();ensureMockupBuilder();const layer=state.mockupBuilder.layers.find(l=>l.id===id);if(!layer)return;const p=mockupSvgPoint(evt);state.mockupBuilder.selectedLayerId=id;mockupDrag={id,dx:p.x-Number(layer.x||0),dy:p.y-Number(layer.y||0)};render()}
function mockupPointerMove(evt){if(!mockupDrag)return;evt.preventDefault();const p=mockupSvgPoint(evt);const layer=state.mockupBuilder.layers.find(l=>l.id===mockupDrag.id);if(!layer)return;layer.x=Math.max(40,Math.min(960,p.x-mockupDrag.dx));layer.y=Math.max(40,Math.min(610,p.y-mockupDrag.dy));const g=document.getElementById('mockLayer-'+layer.id);if(g)g.setAttribute('transform',`translate(${layer.x} ${layer.y}) rotate(${Number(layer.rotate||0)})`)}
function mockupPointerUp(evt){if(!mockupDrag)return;mockupDrag=null;save('mockup-drag')}
function mockupSvgDataUrl(){const svg=document.getElementById('mockupSvg');if(!svg)return '';const clone=svg.cloneNode(true);clone.setAttribute('xmlns','http://www.w3.org/2000/svg');const xml=new XMLSerializer().serializeToString(clone);return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(xml)}
function saveMockupSnapshot(){ensureMockupBuilder();const image=mockupSvgDataUrl();const title=`Mockup ${new Date().toLocaleString()}`;state.mockupBuilder.saved.unshift({id:uid(),title,date:new Date().toLocaleString(),image,config:JSON.parse(JSON.stringify(state.mockupBuilder))});save('mockup-save');render()}
function saveMockupToGallery(){ensureMockupBuilder();ensureScratchPad();const image=mockupSvgDataUrl();if(!image){alert('Mockup image could not be created.');return;}const title=`Legacy Cut Mockup ${new Date().toLocaleString()}`;state.scratchPad.gallery.unshift({id:uid(),title,date:new Date().toLocaleString(),image});saveMockupSnapshot();state.tabs.studio='gallery';state.scratchPad.activeTab='gallery';save('mockup-gallery');render()}
function renderSavedMockups(){ensureMockupBuilder();const items=state.mockupBuilder.saved||[];return items.map(item=>`<div class="galleryCard"><img src="${item.image}" class="galleryImg"><div><b>${escapeHtml(item.title||'Mockup')}</b><small>${escapeHtml(item.date||'')}</small><div class="actions"><button type="button" onclick="loadSavedMockup('${item.id}')">Load</button><button type="button" onclick="shareSavedMockup('${item.id}')">Share</button><button type="button" class="delete" onclick="deleteSavedMockup('${item.id}')">Delete</button></div></div></div>`).join('')||'<p class="note">No saved mockups yet.</p>'}
function loadSavedMockup(id){ensureMockupBuilder();const item=state.mockupBuilder.saved.find(x=>x.id===id);if(!item||!item.config)return;const saved=state.mockupBuilder.saved;state.mockupBuilder={...defaultMockupBuilderState(),...item.config,saved};save('mockup-load');render()}
async function shareSavedMockup(id){ensureMockupBuilder();const item=state.mockupBuilder.saved.find(x=>x.id===id);if(!item)return;if(await shareDataUrl(item.image,item.title||'Legacy Cut Mockup'))return;alert('Share is not available on this device/browser.')}
function deleteSavedMockup(id){if(!confirm('Delete this saved mockup?'))return;state.mockupBuilder.saved=(state.mockupBuilder.saved||[]).filter(x=>x.id!==id);save('mockup-delete');render()}


function pinCurrentJobLocation(){
  if(!navigator.geolocation){alert('Location is not available on this device/browser.');return;}
  const note=document.getElementById('jobLocationNote');
  if(note)note.textContent='Getting current location…';
  navigator.geolocation.getCurrentPosition(pos=>{
    const lat=Number(pos.coords.latitude).toFixed(6);
    const lng=Number(pos.coords.longitude).toFixed(6);
    const pin=`${lat},${lng}`;
    const pinEl=document.getElementById('jobLocationPin');if(pinEl)pinEl.value=pin;
    const addr=document.getElementById('jobAddress');
    if(addr && !String(addr.value||'').trim())addr.value=`Pinned location: ${pin}`;
    if(note)note.innerHTML=`Pinned: <a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pin)}">Open in Google Maps</a>`;
    autosaveCurrentPage('pin-location');
  },err=>{if(note)note.textContent='Could not get location. Check location permission.';alert('Could not get location. Check location permission.');},{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
}
function openJobAddressMap(){
  const pin=document.getElementById('jobLocationPin')?.value||'';
  const addr=document.getElementById('jobAddress')?.value||'';
  const q=pin||addr;
  if(!q){alert('Add an address or pin the current location first.');return;}
  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,'_blank');
}

function toggleCancel(idx){let d=ensureDay(state.selectedDate);d.agenda[idx].canceled=!d.agenda[idx].canceled;save();render()}function updateTask(idx,key,value){ensureDay(state.selectedDate).tasks[idx][key]=value;save();renderCalendarOnlySoon()}function deleteTask(idx){ensureDay(state.selectedDate).tasks.splice(idx,1);save();render()}function addTask(){let text=document.getElementById('newTaskText').value.trim();if(!text)return;ensureDay(state.selectedDate).tasks.push({text,done:false});save();render()}function updateNotes(value){ensureDay(state.selectedDate).notes=value;save()}



/* ===== V49.9 BANKING ↔ ANY INVOICE PAYMENT LINK ENGINE ===== */
function invoicePaymentsFor(invoiceId){
  ensureBanking();
  return state.banking.transactions.filter(t=>t.type==='income'&&t.linkedInvoiceId===invoiceId);
}
function bankLinkedInvoicePaymentTotal(invoiceId,opts={}){
  ensureBanking();
  return normalizeMoneyNumber(invoicePaymentsFor(invoiceId).reduce((sum,t)=>{
    if(opts.autoOnly && !t.autoInvoicePayment)return sum;
    if(opts.manualOnly && t.autoInvoicePayment)return sum;
    return sum+normalizeMoneyNumber(t.amount||0,2);
  },0),2);
}
function firstAutoInvoicePayment(invoiceId){
  ensureBanking();
  return state.banking.transactions.find(t=>t.type==='income'&&t.linkedInvoiceId===invoiceId&&t.autoInvoicePayment)||null;
}
function reconcileInvoiceBankPayments(invoiceId){
  ensureCollections();ensureBanking();
  const inv=(state.invoices||[]).find(i=>i.id===invoiceId);
  if(!inv)return;
  normalizeInvoice(inv,{skipSupplySync:true});
  const linked=bankLinkedInvoicePaymentTotal(invoiceId);
  inv.paid=Math.min(linked,normalizeMoneyNumber(inv.total||0,2));
  inv.balance=invoiceBalance(inv);
  inv.status=getInvoiceStatus(inv).toLowerCase();
  normalizeInvoice(inv,{skipSupplySync:true});
}
function reconcileAllInvoiceBankPayments(){
  ensureCollections();ensureBanking();
  (state.invoices||[]).forEach(inv=>{
    if(state.banking.transactions.some(t=>t.linkedInvoiceId===inv.id))reconcileInvoiceBankPayments(inv.id);
    else normalizeInvoice(inv,{skipSupplySync:true});
  });
}
function setInvoiceManualPaidTotal(inv,value){
  if(!inv)return;
  ensureBanking();
  normalizeInvoice(inv,{skipSupplySync:true});
  const oldPaid=normalizeMoneyNumber(inv.paid||0,2);
  const target=Math.min(Math.max(normalizeMoneyNumber(value||0,2),0),normalizeMoneyNumber(inv.total||0,2));
  const manualLinked=bankLinkedInvoicePaymentTotal(inv.id,{manualOnly:true});
  const autoAmount=Math.max(normalizeMoneyNumber(target-manualLinked,2),0);
  upsertAutoInvoicePayment(inv,autoAmount,'invoice-paid-input');
  reconcileInvoiceBankPayments(inv.id);
  normalizeInvoice(inv,{skipSupplySync:true});
  if(oldPaid!==normalizeMoneyNumber(inv.paid||0,2)){
    adminRecord('invoice.payment',`Invoice #${inv.number} payment updated`,{invoiceNumber:inv.number,client:inv.client,total:inv.total,paid:inv.paid,balance:invoiceBalance(inv),status:getInvoiceStatus(inv)});
  }
}
function upsertAutoInvoicePayment(inv,amount,source='invoice'){
  ensureBanking();
  if(!inv)return null;
  const amt=normalizeMoneyNumber(amount||0,2);
  let tx=firstAutoInvoicePayment(inv.id);
  if(amt<=0){
    if(tx)state.banking.transactions=state.banking.transactions.filter(t=>t.id!==tx.id);
    return null;
  }
  if(!tx){
    tx={id:uid(),type:'income',date:dateKey(new Date()),createdAt:new Date().toISOString(),image:'',linkedSupplyId:'',autoInvoicePayment:true};
    state.banking.transactions.push(tx);
  }
  tx.type='income';
  tx.linkedInvoiceId=inv.id;
  tx.amount=amt;
  tx.category='Job Income';
  tx.description=`Invoice #${inv.number} payment${inv.client?' — '+inv.client:''}`;
  tx.method=tx.method||'Cash';
  tx.notes=source==='invoice'?'Auto-created/updated from invoice payment.':(tx.notes||'Linked invoice payment.');
  tx.updatedAt=new Date().toISOString();
  return tx;
}
function createBankPaymentForInvoice(inv,amount,source='invoice'){
  if(!inv)return null;
  normalizeInvoice(inv,{skipSupplySync:true});
  setInvoiceManualPaidTotal(inv,normalizeMoneyNumber(inv.paid||0,2)+normalizeMoneyNumber(amount||invoiceBalance(inv),2));
  save('bank-invoice-payment');
  return firstAutoInvoicePayment(inv.id);
}
function syncBankTransactionLinks(tx,oldInvoiceId=''){
  ensureBanking();
  if(oldInvoiceId&&oldInvoiceId!==tx?.linkedInvoiceId)reconcileInvoiceBankPayments(oldInvoiceId);
  if(tx?.linkedInvoiceId)reconcileInvoiceBankPayments(tx.linkedInvoiceId);
}

/* ===== V48.9 BANKING V1 ===== */
function ensureBanking(){
  ensureCollections();
  if(!state.banking)state.banking={transactions:[],draft:{}};
  if(!Array.isArray(state.banking.transactions))state.banking.transactions=[];
  if(!state.banking.draft)state.banking.draft={};
  const d=state.banking.draft;
  if(!d.type)d.type='income';
  if(!d.date)d.date=dateKey(new Date());
  if(!d.category)d.category=d.type==='expense'?'General':'Job Income';
  if(!d.method)d.method='Cash';
  if(d.description===undefined)d.description='';
  if(d.amount===undefined)d.amount='';
  if(d.notes===undefined)d.notes='';
  if(d.linkedInvoiceId===undefined)d.linkedInvoiceId='';
  if(d.linkedSupplyId===undefined)d.linkedSupplyId='';
  if(!Array.isArray(state.banking.categories))state.banking.categories=[];
  if(!Array.isArray(state.banking.savingsGoals))state.banking.savingsGoals=[];
}
function defaultBankCategories(){return ['Job Income','Supplies','Fuel','Tools','Materials','Labor','Advertising','Office','Food','Travel','Savings','Personal','Other'];}
function bankCategories(){ensureBanking();let set=new Set(defaultBankCategories());(state.banking.categories||[]).forEach(c=>{c=String(c||'').trim();if(c)set.add(c)});return Array.from(set).sort((a,b)=>a.localeCompare(b));}
function bankCategoryOptions(selected=''){return bankCategories().map(c=>`<option value="${escapeHtml(c)}" ${selected===c?'selected':''}>${escapeHtml(c)}</option>`).join('');}
function bankCategoryManagerHtml(selectId='bankCategory'){
  return `<div class="bankCategoryManager"><input id="bankNewCategory" placeholder="Add custom category"><button type="button" class="smallBtn save" onclick="addBankCategory()">Add Category</button><button type="button" class="smallBtn delete" onclick="removeSelectedBankCategory('${selectId}')">Remove Selected</button></div>`;
}
function addBankCategory(){
  ensureBanking();
  const el=document.getElementById('bankNewCategory');
  const value=String(el?.value||'').trim();
  if(!value){alert('Type a category name first.');return;}
  if(!state.banking.categories)state.banking.categories=[];
  if(!bankCategories().some(c=>c.toLowerCase()===value.toLowerCase()))state.banking.categories.push(value);
  state.banking.draft.category=value;
  save('bank-category-add');
  render();
}
function removeSelectedBankCategory(selectId='bankCategory'){
  ensureBanking();
  const selected=document.getElementById(selectId)?.value||state.banking.draft.category||'';
  if(!selected)return;
  if(defaultBankCategories().some(c=>c.toLowerCase()===selected.toLowerCase())){alert('Default categories stay available. Add/remove only custom categories.');return;}
  if(!confirm(`Remove custom category "${selected}"? Existing entries keep their saved category.`))return;
  state.banking.categories=(state.banking.categories||[]).filter(c=>c.toLowerCase()!==selected.toLowerCase());
  if(state.banking.draft.category===selected)state.banking.draft.category=state.banking.draft.type==='expense'?'Supplies':'Job Income';
  save('bank-category-remove');
  render();
}
function bankMethods(){return ['Cash','Card','Transfer','Check','App','Other'];}
function bankDraftField(key,value){
  ensureBanking();
  state.banking.draft[key]=value;
  if(key==='type'){
    if(value==='income'){
      state.banking.draft.category='Job Income';
      state.banking.draft.linkedSupplyId='';
    }else if(value==='expense'){
      state.banking.draft.category='Supplies';
      state.banking.draft.linkedInvoiceId='';
    }else if(value==='transfer'){
      state.banking.draft.category='Savings';
      state.banking.draft.linkedInvoiceId='';
      state.banking.draft.linkedSupplyId='';
    }
    save('bank-draft-type');
    render();
    return;
  }
  save('bank-draft')
}
function invoiceLinkOptions(selected=''){
  ensureCollections();ensureBanking();
  return (state.invoices||[])
    .slice()
    .sort((a,b)=>Number(a.number||0)-Number(b.number||0))
    .map(inv=>{
      normalizeInvoice(inv,{skipSupplySync:true});
      const status=getInvoiceStatus(inv);
      const balance=invoiceBalance(inv);
      const alreadyLinked=state.banking?.transactions?.some(t=>t.type==='income'&&t.linkedInvoiceId===inv.id);
      const linkedNote=alreadyLinked?' • linked':'';
      return `<option value="${escapeAttr(inv.id)}" ${selected===inv.id?'selected':''}>#${inv.number} — ${escapeHtml(inv.client||'No Client')} — ${status} — Paid ${money(inv.paid||0)} / ${money(inv.total||0)} — Bal ${money(balance)}${linkedNote}</option>`;
    })
    .join('');
}
function unpaidInvoiceOptions(selected=''){
  // Backward-compatible wrapper. The UI now intentionally links to ANY invoice.
  return invoiceLinkOptions(selected);
}
function savedSupplyOptions(selected=''){
  ensureSupplyDbFromNames();
  return Object.values(state.supplyItems||{})
    .filter(item=>!item.isDraft&&String(item.name||'').trim())
    .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')))
    .map(item=>`<option value="${escapeAttr(item.id)}" ${selected===item.id?'selected':''}>${escapeHtml(item.name)}${item.price?` — ${money(item.price)}`:''}</option>`)
    .join('');
}
function bankSelectInvoice(invoiceId){
  ensureBanking();
  const d=state.banking.draft;
  d.linkedInvoiceId=invoiceId||'';
  d.linkedSupplyId='';
  if(invoiceId){
    const inv=(state.invoices||[]).find(i=>i.id===invoiceId);
    if(inv){
      normalizeInvoice(inv,{skipSupplySync:true});
      const existing=(state.banking.transactions||[]).find(t=>t.type==='income'&&t.linkedInvoiceId===invoiceId);
      const balance=normalizeMoneyNumber(invoiceBalance(inv),2);
      const existingAmount=existing?normalizeMoneyNumber(existing.amount||0,2):0;
      const fallback=normalizeMoneyNumber(inv.paid||inv.total||0,2);
      const amount=balance>0?balance:(existingAmount>0?existingAmount:fallback);
      d.type='income';
      d.category='Job Income';
      d.amount=amount>0?amount.toFixed(2):'';
      d.description=`Invoice #${inv.number} payment${inv.client?' — '+inv.client:''}`;
      d.method=existing?.method||d.method||'Cash';
      d.notes=existing?.notes||d.notes||'';
      const typeEl=document.getElementById('bankType');if(typeEl)typeEl.value='income';
      const amtEl=document.getElementById('bankAmount');if(amtEl)amtEl.value=d.amount;
      const descEl=document.getElementById('bankDescription');if(descEl)descEl.value=d.description;
      const catEl=document.getElementById('bankCategory');if(catEl)catEl.value=d.category;
      const methodEl=document.getElementById('bankMethod');if(methodEl)methodEl.value=d.method;
    }
  }
  save('bank-link-invoice-any');
}
function bankSelectSupply(supplyId){
  ensureBanking();
  const d=state.banking.draft;
  d.linkedSupplyId=supplyId||'';
  d.linkedInvoiceId='';
  if(supplyId){
    const item=state.supplyItems?.[supplyId];
    if(item){
      d.type='expense';
      d.category='Supplies';
      d.description=`Supply purchase: ${item.name||'Supply'}`;
      const cost=normalizeMoneyNumber(item.price||0,2);
      if(cost>0)d.amount=cost.toFixed(2);
      const typeEl=document.getElementById('bankType');if(typeEl)typeEl.value='expense';
      const amtEl=document.getElementById('bankAmount');if(amtEl&&cost>0)amtEl.value=d.amount;
      const descEl=document.getElementById('bankDescription');if(descEl)descEl.value=d.description;
      const catEl=document.getElementById('bankCategory');if(catEl)catEl.value=d.category;
    }
  }
  save('bank-link-supply');
}

function bankTotals(){
  ensureBanking();
  let income=0,spent=0,saved=0;
  state.banking.transactions.forEach(t=>{
    let amt=normalizeMoneyNumber(t.amount||0,2);
    if(t.type==='income')income+=amt;
    if(t.type==='expense')spent+=amt;
    if(t.type==='transfer')saved+=amt;
  });
  income=normalizeMoneyNumber(income);spent=normalizeMoneyNumber(spent);saved=normalizeMoneyNumber(saved);
  let spendingBalance=normalizeMoneyNumber(income-spent-saved);
  return {income,spent,saved,spendingBalance,savingsBalance:saved};
}
function bankCategoryTotals(){
  ensureBanking();
  let map={};
  state.banking.transactions.forEach(t=>{
    if(t.type!=='expense')return;
    let cat=t.category||'Other';
    map[cat]=normalizeMoneyNumber((map[cat]||0)+normalizeMoneyNumber(t.amount||0));
  });
  return Object.entries(map).sort((a,b)=>b[1]-a[1]);
}
function invoicePaidTotal(){return normalizeMoneyNumber((state.invoices||[]).reduce((sum,inv)=>sum+normalizeMoneyNumber(inv.paid||0),0));}
function savingsGoalTotals(){
  ensureBanking();
  const savings=bankTotals().savingsBalance;
  let allocated=0,needed=0;
  state.banking.savingsGoals.forEach(g=>{
    g.totalNeeded=normalizeMoneyNumber(g.totalNeeded||0,2);
    g.amountSaved=normalizeMoneyNumber(g.amountSaved||0,2);
    allocated=normalizeMoneyNumber(allocated+g.amountSaved,2);
    needed=normalizeMoneyNumber(needed+g.totalNeeded,2);
  });
  return {savings,allocated,needed,unallocated:normalizeMoneyNumber(savings-allocated,2)};
}
function savingsGoalPriorityOptions(selected='Medium'){
  return ['High','Medium','Low'].map(p=>`<option value="${p}" ${selected===p?'selected':''}>${p}</option>`).join('');
}
function savingsGoalPercent(g){
  const total=normalizeMoneyNumber(g.totalNeeded||0,2);
  if(total<=0)return 0;
  return Math.max(0,Math.min(100,Math.round((normalizeMoneyNumber(g.amountSaved||0,2)/total)*100)));
}
function clampGoalSaved(id,value){
  ensureBanking();
  const goals=state.banking.savingsGoals;
  const goal=goals.find(g=>g.id===id);
  const raw=normalizeMoneyNumber(value||0,2);
  const total=normalizeMoneyNumber(goal?.totalNeeded||0,2);
  const current=normalizeMoneyNumber(goal?.amountSaved||0,2);
  const otherAllocated=goals.reduce((sum,g)=>g.id===id?sum:normalizeMoneyNumber(sum+normalizeMoneyNumber(g.amountSaved||0,2),2),0);
  const availableForThis=normalizeMoneyNumber(bankTotals().savingsBalance-otherAllocated,2);
  const maxAllowed=Math.max(0,Math.min(total>0?total:raw,availableForThis));
  return Math.min(Math.max(raw,0),maxAllowed);
}
function goalPriorityRank(p){return p==='High'?0:p==='Low'?2:1;}
function renderSavingsGoalsPanel(){
  ensureBanking();
  const totals=savingsGoalTotals();
  const over=totals.unallocated<0;
  const sortedGoals=state.banking.savingsGoals.slice().sort((a,b)=>goalPriorityRank(a.priority)-goalPriorityRank(b.priority)||String(a.name||'').localeCompare(String(b.name||'')));
  let rows=sortedGoals.map(g=>{
    const pct=savingsGoalPercent(g);
    const remaining=normalizeMoneyNumber(Math.max(Number(g.totalNeeded||0)-Number(g.amountSaved||0),0),2);
    const priority=escapeAttr(g.priority||'Medium');
    return `<div class="goalCard priority${priority}"><div class="goalTop"><div><b>${escapeHtml(g.name||'Savings Goal')}</b><small>${escapeHtml(g.priority||'Medium')} Priority • Remaining ${money(remaining)}</small></div><button class="delete smallBtn" type="button" onclick="deleteSavingsGoal('${g.id}')">Delete</button></div><div class="goalProgress"><span style="width:${pct}%"></span></div><div class="goalInputs"><div><label>Total Needed</label><input type="number" step="0.01" value="${Number(g.totalNeeded||0)}" oninput="updateSavingsGoal('${g.id}','totalNeeded',this.value)"></div><div><label>Total Saved</label><input type="number" step="0.01" value="${Number(g.amountSaved||0)}" oninput="updateSavingsGoal('${g.id}','amountSaved',this.value)"></div><div><label>Total Remaining</label><input type="text" value="${money(remaining)}" readonly></div><div><label>Priority</label><select onchange="updateSavingsGoal('${g.id}','priority',this.value)">${savingsGoalPriorityOptions(g.priority||'Medium')}</select></div></div><p class="note">${pct}% funded • ${money(g.amountSaved||0)} of ${money(g.totalNeeded||0)} • Remaining ${money(remaining)}</p></div>`;
  }).join('');
  if(!rows)rows='<p class="note">No savings goals yet. Add something you want or need to save for.</p>';
  return `<div class="box savingsGoalsPanel"><div class="titleRow miniTitle"><div><h3>Savings Goals</h3><p>Allocate real savings toward custom goals without double-counting money.</p></div><div class="note">Unallocated Savings: <b>${money(totals.unallocated)}</b></div></div><div class="trackers goalTrackers"><div class="tracker">Savings Balance<b>${money(totals.savings)}</b></div><div class="tracker">Allocated<b>${money(totals.allocated)}</b></div><div class="tracker">Unallocated<b>${money(totals.unallocated)}</b></div><div class="tracker">Goal Need<b>${money(totals.needed)}</b></div></div>${over?'<p class="note warningNote">Goal allocations are higher than available savings. Adjust saved amounts or move more money to savings.</p>':''}<div class="goalAdd"><div><label>Goal Name</label><input id="goalName" placeholder="Example: New laser, truck repair, vacation"></div><div><label>Total Needed</label><input id="goalTotal" type="number" step="0.01"></div><div><label>Saved Toward</label><input id="goalSaved" type="number" step="0.01"></div><div><label>Priority</label><select id="goalPriority">${savingsGoalPriorityOptions('Medium')}</select></div><button class="save" type="button" onclick="addSavingsGoal()">Add Goal</button></div><div class="goalList">${rows}</div></div>`;
}
function addSavingsGoal(){
  ensureBanking();
  const name=String(document.getElementById('goalName')?.value||'').trim();
  if(!name){alert('Enter a goal name first.');return;}
  const id=uid();
  const totalNeeded=normalizeMoneyNumber(document.getElementById('goalTotal')?.value||0,2);
  const priority=document.getElementById('goalPriority')?.value||'Medium';
  let amountSaved=normalizeMoneyNumber(document.getElementById('goalSaved')?.value||0,2);
  const allocated=savingsGoalTotals().allocated;
  const available=Math.max(0,normalizeMoneyNumber(bankTotals().savingsBalance-allocated,2));
  amountSaved=Math.min(Math.max(amountSaved,0),totalNeeded>0?totalNeeded:amountSaved,available);
  state.banking.savingsGoals.push({id,name,totalNeeded,amountSaved,priority,createdAt:new Date().toISOString()});
  save('savings-goal-add');
  render();
}
function updateSavingsGoal(id,key,value){
  ensureBanking();
  const g=state.banking.savingsGoals.find(x=>x.id===id);
  if(!g)return;
  if(key==='name')g.name=value;
  else if(key==='priority')g.priority=value;
  else if(key==='totalNeeded'){
    g.totalNeeded=normalizeMoneyNumber(value||0,2);
    if(normalizeMoneyNumber(g.amountSaved||0,2)>g.totalNeeded)g.amountSaved=g.totalNeeded;
  }else if(key==='amountSaved'){
    g.amountSaved=clampGoalSaved(id,value);
  }
  save('savings-goal-update');
}
function deleteSavingsGoal(id){
  ensureBanking();
  const g=state.banking.savingsGoals.find(x=>x.id===id);
  if(!g)return;
  if(!confirm(`Delete savings goal "${g.name||'Savings Goal'}"? This does not remove actual savings money.`))return;
  state.banking.savingsGoals=state.banking.savingsGoals.filter(x=>x.id!==id);
  save('savings-goal-delete');
  render();
}

function renderBankingAccounts(){
  ensureBanking();
  const t=bankTotals(), d=state.banking.draft;
  const cats=bankCategoryOptions(d.category||'');
  const methods=bankMethods().map(m=>`<option value="${escapeHtml(m)}" ${d.method===m?'selected':''}>${escapeHtml(m)}</option>`).join('');
  const invoiceLink=d.type==='income'?`<div><label>Link Invoice</label><select id="bankLinkedInvoice" onchange="bankSelectInvoice(this.value)"><option value="">None / general income</option>${invoiceLinkOptions(d.linkedInvoiceId||'')}</select></div>`:'';
  const supplyLink=d.type==='expense'?`<div><label>Supply Item</label><select id="bankLinkedSupply" onchange="bankSelectSupply(this.value)"><option value="">None / general expense</option>${savedSupplyOptions(d.linkedSupplyId||'')}</select></div>`:'';
  return `<div class="titleRow"><div><h2>Banking Accounts</h2><p>Track job money, spending, and savings in one place.</p></div><div class="note">Saved locally</div></div>
  <div class="trackers"><div class="tracker">Received<b>${money(t.income)}</b></div><div class="tracker">Spent<b>${money(t.spent)}</b></div><div class="tracker">Saved<b>${money(t.saved)}</b></div><div class="tracker">Spending Balance<b>${money(t.spendingBalance)}</b></div></div>
  <div class="box bankingPanel"><h3>Add Money Entry</h3><div class="three"><div><label>Type</label><select id="bankType" onchange="bankDraftField('type',this.value)"><option value="income" ${d.type==='income'?'selected':''}>Money Received</option><option value="expense" ${d.type==='expense'?'selected':''}>Money Spent</option><option value="transfer" ${d.type==='transfer'?'selected':''}>Move To Savings</option></select></div><div><label>Date</label><input id="bankDate" type="date" value="${escapeHtml(d.date||dateKey(new Date()))}" oninput="bankDraftField('date',this.value)"></div><div><label>Amount</label><input id="bankAmount" type="number" step="0.01" value="${escapeHtml(d.amount||'')}" oninput="bankDraftField('amount',this.value)"></div></div>${invoiceLink||supplyLink?`<div class="two bankLinkRow">${invoiceLink}${supplyLink}</div>`:''}<label>Description</label><input id="bankDescription" value="${escapeHtml(d.description||'')}" placeholder="Example: Yard cleanup payment / Fuel / Transfer to savings" oninput="bankDraftField('description',this.value)"><div class="two"><div><label>Category</label><select id="bankCategory" onchange="bankDraftField('category',this.value)">${cats}</select>${bankCategoryManagerHtml('bankCategory')}</div><div><label>Method</label><select id="bankMethod" onchange="bankDraftField('method',this.value)">${methods}</select></div></div><label>Notes</label><textarea id="bankNotes" oninput="bankDraftField('notes',this.value)">${escapeHtml(d.notes||'')}</textarea><div class="actions"><button class="save" onclick="addBankTransaction()">Save Entry</button><button onclick="clearBankDraft()">Clear</button></div></div>
  <h3>Account Register</h3>${bankRegisterHtml()}`;
}
function bankRegisterHtml(){
  ensureBanking();
  const rows=bankRegisterRows();
  if(!rows.length)return '<div class="bankRegister empty"><p class="note">No banking activity yet.</p></div>';
  return `<div class="bankRegister"><div class="bankRegisterHead"><b>Date</b><b>Transaction</b><b>Method</b><b>Debit</b><b>Credit</b><b>Balance</b><b></b></div>${rows.map(r=>`<div class="bankRegisterRow ${r.type}"><span>${escapeHtml(r.date||'')}</span><span><b>${escapeHtml(r.description||r.category||'Bank Entry')}</b><small>${escapeHtml(r.category||'')}</small></span><span>${escapeHtml(r.method||'')}</span><span>${r.debit?money(r.debit):''}</span><span>${r.credit?money(r.credit):''}</span><span>${money(r.balance)}</span><span class="registerActions"><button class="smallBtn" onclick="openBankTransaction('${r.id}')">Open</button><button class="delete smallBtn" onclick="deleteBankTransaction('${r.id}')">×</button></span></div>`).join('')}</div>`;
}
function bankRegisterRows(){
  ensureBanking();
  let balance=0;
  const asc=state.banking.transactions.slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
  const rows=asc.map(t=>{
    const amt=normalizeMoneyNumber(t.amount||0,2);
    let debit=0,credit=0;
    if(t.type==='income'){credit=amt;balance=normalizeMoneyNumber(balance+amt,2)}
    else if(t.type==='expense'){debit=amt;balance=normalizeMoneyNumber(balance-amt,2)}
    else if(t.type==='transfer'){debit=amt;balance=normalizeMoneyNumber(balance-amt,2)}
    return {...t,debit,credit,balance};
  });
  return rows.reverse().slice(0,18);
}
function renderBankingTrackers(){
  ensureBanking();
  const t=bankTotals(), cats=bankCategoryTotals(), invoicePaid=invoicePaidTotal();
  return `<div class="titleRow"><div><h2>Money Trackers</h2><p>Totals update from banking entries, invoice payments, and savings allocations.</p></div><div class="note">Invoice paid: ${money(invoicePaid)}</div></div><div class="trackers"><div class="tracker">Received<b>${money(t.income)}</b></div><div class="tracker">Spent<b>${money(t.spent)}</b></div><div class="tracker">Saved<b>${money(t.saved)}</b></div><div class="tracker">Available<b>${money(t.spendingBalance)}</b></div></div>${renderSavingsGoalsPanel()}${renderAdminBackupPanel()}${renderHumanReportPanel()}<div class="box"><h3>Spending By Category</h3>${cats.map(([cat,amt])=>`<div class="bankCatRow"><span>${escapeHtml(cat)}</span><b>${money(amt)}</b></div>`).join('')||'<p class="note">No spending categories yet.</p>'}</div><div class="box"><h3>All Transactions</h3><div class="clientList bankList">${state.banking.transactions.slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).map(bankTransactionCard).join('')||'<p class="note">No transactions yet.</p>'}</div></div>`;
}
function renderBankingReceipts(){
  ensureBanking();
  const receipts=state.banking.transactions.filter(t=>t.type==='expense'||t.image);
  return `<div class="titleRow"><div><h2>Banking Receipts</h2><p>Store purchase records and receipt photos.</p></div><button class="save" onclick="setTab('accounts')">+ Add Entry</button></div><div class="clientList bankList">${receipts.slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).map(bankReceiptCard).join('')||'<p class="note">No receipts yet. Add an expense from Accounts, then attach a photo.</p>'}</div>`;
}
function bankTransactionCard(t){
  const cls=t.type==='income'?'bankIncome':t.type==='transfer'?'bankTransfer':'bankExpense';
  const sign=t.type==='expense'?'-':t.type==='transfer'?'↦':'+';
  return `<div class="invoiceCard bankCard ${cls}"><b>${sign} ${money(t.amount)} — ${escapeHtml(t.description||t.category||'Bank Entry')}</b><small>${escapeHtml(t.date||'')} • ${escapeHtml(t.category||'')} • ${escapeHtml(t.method||'')}</small><div class="actions"><button class="smallBtn" onclick="openBankTransaction('${t.id}')">Open</button><button class="delete smallBtn" onclick="deleteBankTransaction('${t.id}')">Delete</button></div></div>`;
}
function bankReceiptCard(t){
  return `<div class="invoiceCard bankCard receiptCard" onclick="openBankTransaction('${t.id}')"><div class="receiptCardBody"><div class="receiptCardText"><b>${escapeHtml(t.description||'Receipt')} — ${money(t.amount)}</b><small>${escapeHtml(t.date||'')} • ${escapeHtml(t.category||'')} • ${escapeHtml(t.method||'')}</small></div>${t.image?`<img class="receiptThumb" src="${t.image}" alt="Receipt thumbnail">`:''}</div><div class="actions" onclick="event.stopPropagation()"><button class="smallBtn" onclick="openBankTransaction('${t.id}')">Open</button><button class="delete smallBtn" onclick="deleteBankTransaction('${t.id}')">Delete</button></div></div>`;
}
function addBankTransaction(){
  ensureBanking();
  const d=state.banking.draft;
  const amount=normalizeMoneyNumber(d.amount||0,2);
  if(!amount||amount<0){alert('Enter an amount greater than 0.');return;}
  const base={type:d.type||'income',date:d.date||dateKey(new Date()),description:String(d.description||'').trim()||bankDefaultDescription(d.type),amount,category:d.category||'Other',method:d.method||'Cash',notes:d.notes||'',linkedInvoiceId:d.type==='income'?(d.linkedInvoiceId||''):'',linkedSupplyId:d.type==='expense'?(d.linkedSupplyId||''):'',autoInvoicePayment:false,updatedAt:new Date().toISOString()};
  let tx=null;
  if(base.type==='income'&&base.linkedInvoiceId){
    // One ledger payment row per invoice. Linking any invoice updates/merges the existing row instead of double-entering it.
    tx=state.banking.transactions.find(t=>t.type==='income'&&t.linkedInvoiceId===base.linkedInvoiceId)||null;
  }
  if(tx){
    const keepImage=tx.image||'';
    const createdAt=tx.createdAt||new Date().toISOString();
    Object.assign(tx,base,{image:keepImage,createdAt});
  }else{
    tx={id:uid(),...base,image:'',createdAt:new Date().toISOString()};
    state.banking.transactions.push(tx);
  }
  if(tx.linkedInvoiceId)reconcileInvoiceBankPayments(tx.linkedInvoiceId);
  adminRecord('banking.entry',`Bank entry saved: ${tx.description||tx.category||tx.type}`,{type:tx.type,date:tx.date,amount:tx.amount,category:tx.category,method:tx.method,linkedInvoiceId:tx.linkedInvoiceId||'',linkedSupplyId:tx.linkedSupplyId||''});
  state.banking.draft={type:d.type||'income',date:dateKey(new Date()),description:'',amount:'',category:d.type==='expense'?'Supplies':'Job Income',method:d.method||'Cash',notes:'',image:'',linkedInvoiceId:'',linkedSupplyId:''};
  save('bank-add-or-merge-invoice');
  render();
}
function bankDefaultDescription(type){return type==='expense'?'Purchase':type==='transfer'?'Savings Transfer':'Money Received';}
function clearBankDraft(){ensureBanking();state.banking.draft={type:'income',date:dateKey(new Date()),description:'',amount:'',category:'Job Income',method:'Cash',notes:'',image:'',linkedInvoiceId:'',linkedSupplyId:''};save('bank-clear');render();}
function deleteBankTransaction(id){ensureBanking();const tx=state.banking.transactions.find(t=>t.id===id);if(!tx)return;if(!confirm('Delete this banking entry?'))return;const oldInvoiceId=tx.linkedInvoiceId||'';state.banking.transactions=state.banking.transactions.filter(t=>t.id!==id);if(oldInvoiceId)reconcileInvoiceBankPayments(oldInvoiceId);save('bank-delete');render();}
function openBankTransaction(id){
  ensureBanking();
  const t=state.banking.transactions.find(x=>x.id===id);if(!t)return;
  const cats=bankCategoryOptions(t.category||'');
  const methods=bankMethods().map(m=>`<option value="${escapeHtml(m)}" ${t.method===m?'selected':''}>${escapeHtml(m)}</option>`).join('');
  const linkedInvoice=t.linkedInvoiceId?`<p class="note"><b>Linked invoice:</b> ${escapeHtml(invoiceLabel(t.linkedInvoiceId))}</p>`:'';
  const linkedSupply=t.linkedSupplyId?`<p class="note"><b>Linked supply:</b> ${escapeHtml(state.supplyItems?.[t.linkedSupplyId]?.name||'Supply')}</p>`:'';
  content.innerHTML=`<div class="titleRow"><div><h2>Bank Entry</h2><p>${escapeHtml(t.date||'')} • ${escapeHtml(t.type||'')}</p></div><button onclick="setTab('${state.tabs.banking||'accounts'}')">Back</button></div><div class="box"><div class="three"><div><label>Type</label><select onchange="updateBankTransaction('${id}','type',this.value)"><option value="income" ${t.type==='income'?'selected':''}>Money Received</option><option value="expense" ${t.type==='expense'?'selected':''}>Money Spent</option><option value="transfer" ${t.type==='transfer'?'selected':''}>Move To Savings</option></select></div><div><label>Date</label><input type="date" value="${escapeHtml(t.date||'')}" oninput="updateBankTransaction('${id}','date',this.value)"></div><div><label>Amount</label><input type="number" step="0.01" value="${Number(t.amount||0).toFixed(2)}" oninput="updateBankTransaction('${id}','amount',this.value)"></div></div>${linkedInvoice}${linkedSupply}<label>Description</label><input value="${escapeHtml(t.description||'')}" oninput="updateBankTransaction('${id}','description',this.value)"><div class="two"><div><label>Category</label><select id="bankEntryCategory" onchange="updateBankTransaction('${id}','category',this.value)">${cats}</select>${bankCategoryManagerHtml('bankEntryCategory')}</div><div><label>Method</label><select onchange="updateBankTransaction('${id}','method',this.value)">${methods}</select></div></div><label>Notes</label><textarea oninput="updateBankTransaction('${id}','notes',this.value)">${escapeHtml(t.notes||'')}</textarea><label>Receipt Photo</label><p class="note">Tap the saved image to view larger.</p><input type="file" accept="image/*" capture="environment" onchange="attachBankReceiptPhoto(event,'${id}')">${t.image?`<img class="receiptFullPhoto" src="${t.image}" onclick="showReceiptImage('${id}')" alt="Receipt image">`:''}<div class="actions"><button class="save" onclick="saveBankEntryAndReturnToAccounts('${id}')">Save</button><button class="delete" onclick="deleteBankTransaction('${id}')">Delete</button></div></div>`;
}
function invoiceLabel(invoiceId){const inv=(state.invoices||[]).find(i=>i.id===invoiceId);return inv?`#${inv.number} — ${inv.client||'No Client'} — ${money(inv.total)}`:'Invoice not found'}
function updateBankTransaction(id,key,value){ensureBanking();const t=state.banking.transactions.find(x=>x.id===id);if(!t)return;const oldInvoiceId=t.linkedInvoiceId||'';t[key]=key==='amount'?normalizeMoneyNumber(value||0,2):value;if(key==='type'&&t.type!=='income')t.linkedInvoiceId='';if(key==='type'&&t.type!=='expense')t.linkedSupplyId='';syncBankTransactionLinks(t,oldInvoiceId);save('bank-update');}

function saveBankEntryAndReturnToAccounts(id){
 ensureBanking();
 const tx=state.banking.transactions.find(t=>t.id===id);
 if(tx?.linkedInvoiceId)reconcileInvoiceBankPayments(tx.linkedInvoiceId);
 adminRecord('banking.entry.update',`Bank entry updated: ${tx?.description||tx?.category||id}`,{type:tx?.type,date:tx?.date,amount:tx?.amount,category:tx?.category,linkedInvoiceId:tx?.linkedInvoiceId||''});
 save('bank-entry-save-return-accounts');
 state.section='banking';
 state.tabs.banking='accounts';
 render();
}
function resizeImageDataUrl(file,maxDim=1280,quality=.72){
 return new Promise((resolve,reject)=>{
   const reader=new FileReader();
   reader.onerror=()=>reject(reader.error||new Error('Could not read image file.'));
   reader.onload=()=>{
     const img=new Image();
     img.onerror=()=>resolve(reader.result);
     img.onload=()=>{
       try{
         let w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
         let scale=Math.min(1,maxDim/Math.max(w,h));
         let canvas=document.createElement('canvas');
         canvas.width=Math.max(1,Math.round(w*scale));
         canvas.height=Math.max(1,Math.round(h*scale));
         let ctx=canvas.getContext('2d',{alpha:false});
         ctx.fillStyle='#fff';
         ctx.fillRect(0,0,canvas.width,canvas.height);
         ctx.drawImage(img,0,0,canvas.width,canvas.height);
         resolve(canvas.toDataURL('image/jpeg',quality));
       }catch(err){resolve(reader.result)}
     };
     img.src=reader.result;
   };
   reader.readAsDataURL(file);
 });
}
async function imageDataUrlToImage(dataUrl){
 return new Promise((resolve,reject)=>{
   const img=new Image();
   img.onload=()=>resolve(img);
   img.onerror=()=>reject(new Error('Image load failed'));
   img.src=dataUrl;
 });
}
async function autoCropDocumentDataUrl(dataUrl,maxDim=1400,quality=.78){
 try{
   const img=await imageDataUrlToImage(dataUrl);
   const scanMax=900;
   let w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
   let scale=Math.min(1,scanMax/Math.max(w,h));
   const sw=Math.max(1,Math.round(w*scale)), sh=Math.max(1,Math.round(h*scale));
   const scan=document.createElement('canvas');scan.width=sw;scan.height=sh;
   const sx=scan.getContext('2d',{willReadFrequently:true});
   sx.drawImage(img,0,0,sw,sh);
   const data=sx.getImageData(0,0,sw,sh).data;
   const idx=(x,y)=>(y*sw+x)*4;
   function pix(x,y){let i=idx(Math.max(0,Math.min(sw-1,x)),Math.max(0,Math.min(sh-1,y)));return [data[i],data[i+1],data[i+2]]}
   const samples=[pix(2,2),pix(sw-3,2),pix(2,sh-3),pix(sw-3,sh-3)];
   const bg=samples.reduce((a,p)=>[a[0]+p[0],a[1]+p[1],a[2]+p[2]],[0,0,0]).map(v=>v/samples.length);
   const bgLum=.299*bg[0]+.587*bg[1]+.114*bg[2];
   let minX=sw,minY=sh,maxX=0,maxY=0,count=0;
   const step=4;
   for(let y=0;y<sh;y+=step){
     for(let x=0;x<sw;x+=step){
       const i=idx(x,y), r=data[i], g=data[i+1], b=data[i+2];
       const lum=.299*r+.587*g+.114*b;
       const dist=Math.hypot(r-bg[0],g-bg[1],b-bg[2]);
       // Document/receipt edge heuristic: find bright paper against darker surface, or any strong contrast from corner background.
       const paperOnDark=(bgLum<205 && lum>210);
       const contrast=dist>52 && Math.abs(lum-bgLum)>24;
       if(paperOnDark || contrast){
         minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);count++;
       }
     }
   }
   const area=(maxX-minX)*(maxY-minY), full=sw*sh;
   if(!count || area<full*.08 || area>full*.96)return dataUrl;
   const pad=Math.round(Math.min(sw,sh)*.025);
   minX=Math.max(0,minX-pad);minY=Math.max(0,minY-pad);maxX=Math.min(sw,maxX+pad);maxY=Math.min(sh,maxY+pad);
   const rx=minX/scale, ry=minY/scale, rw=(maxX-minX)/scale, rh=(maxY-minY)/scale;
   const outScale=Math.min(1,maxDim/Math.max(rw,rh));
   const out=document.createElement('canvas');out.width=Math.max(1,Math.round(rw*outScale));out.height=Math.max(1,Math.round(rh*outScale));
   const ox=out.getContext('2d',{alpha:false});
   ox.fillStyle='#fff';ox.fillRect(0,0,out.width,out.height);
   ox.drawImage(img,rx,ry,rw,rh,0,0,out.width,out.height);
   return out.toDataURL('image/jpeg',quality);
 }catch(err){
   console.warn('Receipt auto-crop skipped',err);
   return dataUrl;
 }
}
async function processReceiptPhoto(file){
 // V49.14: reliability first for Android WebView. Keep receipt images compressed and skip experimental auto-crop.
 return await resizeImageDataUrl(file,1200,.72);
}
async function attachBankReceiptPhoto(e,id){
 const file=e.target.files?.[0];
 if(!file)return;
 const t=state.banking.transactions.find(x=>x.id===id);
 if(!t)return;
 const input=e.target;
 input.disabled=true;
 try{
   t.image=await processReceiptPhoto(file);
   save('bank-receipt-photo-scan');
   openBankTransaction(id);
 }catch(err){
   console.error(err);
   alert('The receipt photo could not be saved. Try a smaller image or take a lower resolution photo.');
 }finally{
   input.disabled=false;
 }
}
function showReceiptImage(id){
 const t=state.banking?.transactions?.find(x=>x.id===id);
 if(!t?.image)return;
 const overlay=document.createElement('div');
 overlay.className='receiptImageOverlay';
 overlay.innerHTML=`<div class="receiptImageViewer"><button class="smallBtn receiptClose" type="button">Close</button><img src="${t.image}" alt="Receipt full view"></div>`;
 overlay.addEventListener('click',e=>{if(e.target===overlay||e.target.classList.contains('receiptClose'))overlay.remove()});
 document.body.appendChild(overlay);
}


/* ===== V49.11 BACKUP / RECOVERY CENTER ===== */
function ensureAdminBackup(){
  ensureCollections();
  if(!state.adminBackup)state.adminBackup={email:'',enabled:false,autoEmail:false,records:[]};
  if(!Array.isArray(state.adminBackup.records))state.adminBackup.records=[];
  if(state.adminBackup.enabled===undefined)state.adminBackup.enabled=false;
  if(state.adminBackup.autoEmail===undefined)state.adminBackup.autoEmail=false;
  if(state.adminBackup.email===undefined)state.adminBackup.email='';
  return state.adminBackup;
}
function backupSummary(){
  ensureAdminBackup();
  const total=state.adminBackup.records.length;
  const unsent=state.adminBackup.records.filter(r=>!r.emailedAt).length;
  return {total,unsent};
}
function renderAdminBackupPanel(){
  const cfg=ensureAdminBackup(), sum=backupSummary();
  const recent=cfg.records.slice(-5).reverse();
  return `<div class="box adminBackupPanel"><div class="titleRow miniTitle"><div><h3>Backup / Recovery Center</h3><p class="note">Portable app backups plus optional admin record receipts for important entries.</p></div><div class="note">${sum.total} records • ${sum.unsent} unsent</div></div><div class="two"><div><label>Backup Email</label><input id="adminBackupEmail" type="email" value="${escapeHtml(cfg.email||'')}" placeholder="you@example.com" oninput="updateAdminBackupSetting('email',this.value)"></div><div><label>Admin Record Email</label><select id="adminBackupEnabled" onchange="updateAdminBackupSetting('enabled',this.value==='yes')"><option value="no" ${!cfg.enabled?'selected':''}>Off</option><option value="yes" ${cfg.enabled?'selected':''}>On</option></select></div></div><label><input type="checkbox" ${cfg.autoEmail?'checked':''} onchange="updateAdminBackupSetting('autoEmail',this.checked)"> Auto-open email receipt after major saves</label><p class="note">Browser PWAs cannot silently send email without a secure backend. When enabled, Meridian opens your email/share app with a prefilled record receipt so you can send it.</p><div class="actions"><button class="save" type="button" onclick="exportFullDatabase()">Export Full Backup</button><label class="fileButton"><input type="file" accept="application/json,.json,.ahtel" onchange="importFullDatabase(event)">Import Backup</label><button type="button" onclick="emailUnsentAdminRecords()">Email Unsent Receipts</button><button type="button" onclick="downloadAdminRecordLog()">Download Receipt Log</button></div><h4>Recent Backup Records</h4><div class="clientList adminRecordList">${recent.map(r=>`<div class="historyCard"><b>${escapeHtml(r.title)}</b><small>${escapeHtml(new Date(r.createdAt).toLocaleString())} • ${escapeHtml(r.type)} ${r.emailedAt?'• emailed':'• not emailed'}</small><div class="actions"><button class="smallBtn" type="button" onclick="emailAdminRecord('${r.id}')">Email</button></div></div>`).join('')||'<p class="note">No record receipts yet. Major saved entries will appear here.</p>'}</div></div>`;
}
function updateAdminBackupSetting(key,value){
  const cfg=ensureAdminBackup();
  cfg[key]=value;
  save('admin-backup-setting');
}
function adminRecord(type,title,details={}){
  const cfg=ensureAdminBackup();
  const record={id:uid(),type,title,details,createdAt:new Date().toISOString(),build:BUILD,emailedAt:''};
  cfg.records.push(record);
  if(cfg.records.length>500)cfg.records=cfg.records.slice(-500);
  save('admin-record');
  if(cfg.enabled&&cfg.autoEmail&&cfg.email){setTimeout(()=>emailAdminRecord(record.id,true),80)}
  return record;
}
function adminRecordText(records){
  records=Array.isArray(records)?records:[records];
  return records.map(r=>{
    const lines=[`MERIDIAN ADMIN RECORD`, `Type: ${r.type}`, `Title: ${r.title}`, `Time: ${new Date(r.createdAt).toLocaleString()}`, `Build: ${r.build||BUILD}`, ''];
    Object.entries(r.details||{}).forEach(([k,v])=>lines.push(`${k}: ${typeof v==='object'?JSON.stringify(v):v}`));
    return lines.join('\n');
  }).join('\n\n------------------------------\n\n');
}
function emailRecords(records,quiet=false){
  const cfg=ensureAdminBackup();
  records=Array.isArray(records)?records:[records];
  if(!records.length){if(!quiet)alert('No backup records to email.');return;}
  const to=encodeURIComponent(cfg.email||'');
  const subject=encodeURIComponent(`Meridian Admin Backup Receipt (${records.length})`);
  const body=encodeURIComponent(adminRecordText(records));
  records.forEach(r=>r.emailedAt=new Date().toISOString());
  save('admin-record-email');
  if(navigator.share&&!cfg.email){
    navigator.share({title:'Meridian Admin Backup Receipt',text:adminRecordText(records)}).catch(()=>{});
  }else{
    location.href=`mailto:${to}?subject=${subject}&body=${body}`;
  }
}
function emailAdminRecord(id,quiet=false){
  const cfg=ensureAdminBackup();
  const r=cfg.records.find(x=>x.id===id);
  if(!r){if(!quiet)alert('Record not found.');return;}
  emailRecords([r],quiet);
}
function emailUnsentAdminRecords(){
  const cfg=ensureAdminBackup();
  const records=cfg.records.filter(r=>!r.emailedAt).slice(-20);
  emailRecords(records);
}
function downloadTextFile(filename,text,type='application/json'){
  const b=new Blob([text],{type});
  const u=URL.createObjectURL(b),a=document.createElement('a');
  a.href=u;a.download=filename;a.click();URL.revokeObjectURL(u);
}
function exportFullDatabase(){
  autosaveCurrentPage('export-full-database');
  flushSave('export-full-database');
  const payload={app:'Meridian',format:'meridian-full-backup',version:1,build:BUILD,exportedAt:new Date().toISOString(),state};
  downloadTextFile(`meridian-full-backup-${dateKey(new Date())}.json`,JSON.stringify(payload,null,2));
  adminRecord('backup.export','Full database export',{exportedAt:payload.exportedAt,clients:Object.keys(state.clients||{}).length,invoices:(state.invoices||[]).length,bankingEntries:(state.banking?.transactions||[]).length});
}
function importFullDatabase(event){
  const file=event.target.files?.[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const parsed=JSON.parse(reader.result);
      const importedState=parsed.state||parsed;
      if(!importedState||typeof importedState!=='object')throw new Error('Invalid backup format');
      if(!confirm('Import this backup and replace the current local app data? A fresh export will be downloaded first as a safety copy.'))return;
      exportFullDatabase();
      state=importedState;
      ensureCollections();
      repairStateIndexes();
      adminRecord('backup.import','Full database import',{importedAt:new Date().toISOString(),source:file.name||'backup file'});
      flushSave('import-full-database');
      alert('Backup imported. The app will reload now.');
      location.reload();
    }catch(err){
      console.error(err);
      alert('Could not import that backup file. Make sure it is an Meridian JSON backup.');
    }
  };
  reader.readAsText(file);
}
function downloadAdminRecordLog(){
  const cfg=ensureAdminBackup();
  downloadTextFile(`meridian-admin-record-log-${dateKey(new Date())}.json`,JSON.stringify({app:'Meridian',build:BUILD,exportedAt:new Date().toISOString(),records:cfg.records},null,2));
}
function backup(){exportFullDatabase()}




/* ===== V49.12 HUMAN-READABLE BACKUP REPORTS ===== */
function renderHumanReportPanel(){
  return `<div class="box humanReportPanel"><div class="titleRow miniTitle"><div><h3>Human-Readable Reports</h3><p class="note">Pretty printable backups for records, clients, schedules, and business snapshots. JSON export remains the true restore file.</p></div><div class="note">PDF-ready</div></div><div class="actions"><button class="save" type="button" onclick="exportBusinessReport()">Business Records Report</button><button type="button" onclick="exportClientReport()">Client Report</button><button type="button" onclick="exportScheduleReport()">Schedule Snapshot</button></div><p class="note">Reports open as a styled page. Use the browser share/print menu to save as PDF, print, or send.</p></div>`;
}
function reportCss(){return `<style>
  :root{--ink:#20170d;--gold:#d8ad3d;--paper:#fff8e9;--line:#c8a96e;--char:#14100c;--muted:#745d35;}
  *{box-sizing:border-box}body{margin:0;padding:24px;background:#eee3cd;color:var(--ink);font-family:Arial,Helvetica,sans-serif;line-height:1.35}.report{max-width:960px;margin:auto;background:var(--paper);border:1px solid var(--line);box-shadow:0 10px 30px rgba(0,0,0,.18);padding:28px;border-radius:18px}.top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:3px double var(--line);padding-bottom:14px;margin-bottom:20px}.brand{display:flex;gap:12px;align-items:center}.mark{width:52px;height:52px;border-radius:15px;display:grid;place-items:center;background:#16110d;color:#f5d979;border:1px solid #d8ad3d;font:bold 34px Georgia,serif}.brand h1{font-family:Georgia,serif;margin:0;font-size:30px;letter-spacing:2px}.brand p,.meta{margin:3px 0;color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.08em}h2{font:700 24px Georgia,serif;border-bottom:1px solid var(--line);padding-bottom:7px;margin:24px 0 10px}h3{font:700 18px Georgia,serif;margin:18px 0 8px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.card{border:1px solid rgba(120,88,34,.35);background:rgba(255,255,255,.55);border-radius:12px;padding:12px}.card b{display:block;font-size:20px;color:#16110d}.small{font-size:12px;color:var(--muted)}table{width:100%;border-collapse:collapse;margin:8px 0 18px;background:rgba(255,255,255,.54)}th,td{border:1px solid rgba(120,88,34,.35);padding:8px;text-align:left;vertical-align:top;font-size:13px}th{background:#241a10;color:#f5d979}.right{text-align:right}.pill{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:3px 8px;font-size:12px;background:#fff}.progress{height:10px;background:#ead7ad;border-radius:999px;overflow:hidden}.bar{height:100%;background:linear-gradient(90deg,#8a651d,#d8ad3d)}.actions{position:sticky;top:0;margin:-28px -28px 18px;padding:10px 28px;background:rgba(20,16,12,.94);display:flex;gap:8px;justify-content:flex-end;border-radius:18px 18px 0 0}button{border:0;border-radius:10px;padding:10px 14px;background:#d8ad3d;color:#211608;font-weight:bold}@media print{body{background:white;padding:0}.report{box-shadow:none;border:0;border-radius:0}.actions{display:none}.card,table{break-inside:avoid}}@media(max-width:720px){body{padding:10px}.report{padding:16px}.grid{grid-template-columns:1fr 1fr}.top{flex-direction:column}.actions{margin:-16px -16px 14px;padding:10px 16px}.brand h1{font-size:22px}th,td{font-size:12px;padding:6px}}
</style>`}
function reportShell(title,body){const exported=new Date().toLocaleString();return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>${reportCss()}</head><body><main class="report"><div class="actions"><button onclick="window.print()">Print / Save PDF</button><button onclick="navigator.share?navigator.share({title:document.title,text:document.body.innerText}).catch(()=>{}):window.print()">Share</button></div><section class="top"><div class="brand"><div class="mark">A</div><div><h1>MERIDIAN</h1><p>Creative Workflow Studio</p></div></div><div class="meta">${escapeHtml(title)}<br>Exported ${escapeHtml(exported)}<br>Build ${escapeHtml(BUILD)}</div></section>${body}</main></body></html>`}
function openReportHtml(title,html,filename){
  const blob=new Blob([html],{type:'text/html'}),url=URL.createObjectURL(blob);
  const win=window.open(url,'_blank');
  if(!win){downloadTextFile(filename,html);alert('Report downloaded. Open it to print, save as PDF, or share.');}
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  adminRecord('report.export',title,{filename,exportedAt:new Date().toISOString()});
}
function reportMoney(n){return money(normalizeMoneyNumber?normalizeMoneyNumber(n):Number(n||0));}
function businessReportBody(){
  ensureCollections(); const bt=bankingTotals?bankingTotals():{income:0,spent:0,saved:0,spendingBalance:0};
  const invoices=state.invoices||[], tx=(state.banking?.transactions||[]).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  const goals=(state.banking?.savingsGoals||[]); const cats={}; tx.forEach(t=>{if(t.type==='expense')cats[t.category||'Uncategorized']=(cats[t.category||'Uncategorized']||0)+Number(t.amount||0)});
  let body=`<h2>Business Records Snapshot</h2><div class="grid"><div class="card">Received<b>${reportMoney(bt.income)}</b></div><div class="card">Spent<b>${reportMoney(bt.spent)}</b></div><div class="card">Saved<b>${reportMoney(bt.saved)}</b></div><div class="card">Available<b>${reportMoney(bt.spendingBalance)}</b></div></div>`;
  body+=`<h2>Banking Ledger</h2><table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Category</th><th>Method</th><th class="right">Amount</th></tr></thead><tbody>${tx.map(t=>`<tr><td>${escapeHtml(t.date||'')}</td><td>${escapeHtml(t.type||'')}</td><td>${escapeHtml(t.description||'')}</td><td>${escapeHtml(t.category||'')}</td><td>${escapeHtml(t.method||'')}</td><td class="right">${reportMoney(t.amount)}</td></tr>`).join('')||'<tr><td colspan="6">No banking activity.</td></tr>'}</tbody></table>`;
  body+=`<h2>Savings Goals</h2><table><thead><tr><th>Goal</th><th>Priority</th><th class="right">Needed</th><th class="right">Saved</th><th class="right">Remaining</th><th>Progress</th></tr></thead><tbody>${goals.map(g=>{let need=Number(g.totalNeeded||0),saved=Number(g.saved||0),pct=need?Math.min(100,Math.max(0,saved/need*100)):0;return `<tr><td>${escapeHtml(g.name||'Goal')}</td><td>${escapeHtml(g.priority||'Medium')}</td><td class="right">${reportMoney(need)}</td><td class="right">${reportMoney(saved)}</td><td class="right">${reportMoney(Math.max(need-saved,0))}</td><td><div class="progress"><div class="bar" style="width:${pct}%"></div></div><span class="small">${pct.toFixed(0)}%</span></td></tr>`}).join('')||'<tr><td colspan="6">No savings goals.</td></tr>'}</tbody></table>`;
  body+=`<h2>Invoices</h2><table><thead><tr><th>#</th><th>Client</th><th>Date</th><th>Status</th><th class="right">Total</th><th class="right">Paid</th><th class="right">Balance</th></tr></thead><tbody>${invoices.map(inv=>`<tr><td>${escapeHtml(inv.number||'')}</td><td>${escapeHtml(inv.client||'')}</td><td>${escapeHtml(inv.date||'')}</td><td>${escapeHtml(getInvoiceStatus?getInvoiceStatus(inv):(inv.status||''))}</td><td class="right">${reportMoney(inv.total)}</td><td class="right">${reportMoney(inv.paid)}</td><td class="right">${reportMoney(invoiceBalance?invoiceBalance(inv):Number(inv.total||0)-Number(inv.paid||0))}</td></tr>`).join('')||'<tr><td colspan="7">No invoices.</td></tr>'}</tbody></table>`;
  body+=`<h2>Spending By Category</h2><table><thead><tr><th>Category</th><th class="right">Spent</th></tr></thead><tbody>${Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([c,a])=>`<tr><td>${escapeHtml(c)}</td><td class="right">${reportMoney(a)}</td></tr>`).join('')||'<tr><td colspan="2">No category spending.</td></tr>'}</tbody></table>`;
  return body;
}
function exportBusinessReport(){const html=reportShell('Business Records Report',businessReportBody());openReportHtml('Business Records Report',html,`meridian-business-report-${dateKey(new Date())}.html`)}
function clientReportBody(){
  ensureCollections(); syncClientsFromJobs?.(); const clients=Object.keys(state.clients||{}).sort();
  let body='<h2>Client Records Report</h2>';
  if(!clients.length)return body+'<p>No clients yet.</p>';
  clients.forEach(name=>{const c=state.clients[name]||{}, totals=clientTotals?clientTotals(name):{hours:0,charged:0,paid:0,balance:0}; const invs=(state.invoices||[]).filter(i=>String(i.client||'')===name); body+=`<h2>${escapeHtml(name)}</h2><div class="grid"><div class="card">Hours<b>${Number(totals.hours||0).toFixed(2)}</b></div><div class="card">Charged<b>${reportMoney(totals.charged)}</b></div><div class="card">Paid<b>${reportMoney(totals.paid)}</b></div><div class="card">Balance<b>${reportMoney(totals.balance)}</b></div></div><p><b>Phone:</b> ${escapeHtml(c.phone||'')}<br><b>Address:</b> ${escapeHtml(c.address||'')}<br><b>Notes:</b> ${escapeHtml(c.notes||'')}</p><table><thead><tr><th>Invoice</th><th>Date</th><th>Status</th><th class="right">Total</th><th class="right">Paid</th><th class="right">Balance</th></tr></thead><tbody>${invs.map(inv=>`<tr><td>#${escapeHtml(inv.number||'')}</td><td>${escapeHtml(inv.date||'')}</td><td>${escapeHtml(getInvoiceStatus?getInvoiceStatus(inv):(inv.status||''))}</td><td class="right">${reportMoney(inv.total)}</td><td class="right">${reportMoney(inv.paid)}</td><td class="right">${reportMoney(invoiceBalance?invoiceBalance(inv):Number(inv.total||0)-Number(inv.paid||0))}</td></tr>`).join('')||'<tr><td colspan="6">No invoices.</td></tr>'}</tbody></table>`; });
  return body;
}
function exportClientReport(){const html=reportShell('Client Report',clientReportBody());openReportHtml('Client Report',html,`meridian-client-report-${dateKey(new Date())}.html`)}
function scheduleReportBody(){
  ensureCollections(); const rows=[]; Object.entries(state.calendarData||{}).forEach(([date,day])=>{(day.agenda||[]).forEach(a=>rows.push({date,type:a.type||'agenda',time:a.time||'',title:a.title||'',client:a.client||'',status:a.status||'',notes:a.notes||''})); (day.tasks||[]).forEach(t=>rows.push({date,type:'task',time:'',title:t.text||'',client:'',status:t.done?'done':'open',notes:''}));}); rows.sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  const logs=(state.timeLogs||[]).slice().sort((a,b)=>String(a.at||'').localeCompare(String(b.at||'')));
  let body=`<h2>Schedule Snapshot</h2><table><thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Title</th><th>Client</th><th>Status</th><th>Notes</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escapeHtml(r.date)}</td><td>${escapeHtml(formatTime?formatTime(r.time):r.time)}</td><td>${escapeHtml(r.type)}</td><td>${escapeHtml(r.title)}</td><td>${escapeHtml(r.client)}</td><td>${escapeHtml(r.status)}</td><td>${escapeHtml(r.notes)}</td></tr>`).join('')||'<tr><td colspan="7">No schedule entries.</td></tr>'}</tbody></table>`;
  body+=`<h2>Time Logs</h2><table><thead><tr><th>Timestamp</th><th>Action</th><th>Job</th><th>Client</th></tr></thead><tbody>${logs.map(l=>`<tr><td>${escapeHtml(new Date(l.at||l.time||Date.now()).toLocaleString())}</td><td>${escapeHtml(l.action||l.type||'')}</td><td>${escapeHtml(l.job||l.label||'')}</td><td>${escapeHtml(l.client||'')}</td></tr>`).join('')||'<tr><td colspan="4">No time logs.</td></tr>'}</tbody></table>`;
  return body;
}
function exportScheduleReport(){const html=reportShell('Schedule Snapshot',scheduleReportBody());openReportHtml('Schedule Snapshot',html,`meridian-schedule-snapshot-${dateKey(new Date())}.html`)}


function openTutorial(){
  const existing=document.getElementById('tutorialOverlay');
  if(existing)existing.remove();
  const html=`<div id="tutorialOverlay" class="tutorialOverlay" onclick="closeTutorial(event)"><div class="tutorialPanel" onclick="event.stopPropagation()"><div class="titleRow miniTitle"><div><h2>Meridian Quick Guide</h2><p class="note">Creative Workflow OS for field work, clients, money, supplies, and studio planning.</p></div><button class="smallBtn" type="button" onclick="closeTutorial()">×</button></div><div class="tutorialGrid"><div class="tutorialCard"><b>1. Schedule</b><p>Use Calendar + Agenda for jobs, events, tasks, reminders, time cards, and GPS job pins. Tap a calendar day to plan or edit work.</p></div><div class="tutorialCard"><b>2. Clients + Invoices</b><p>Create client files, build invoices, mark payment status, capture signatures, attach check photos, and sync payments to Banking.</p></div><div class="tutorialCard"><b>3. Supplies</b><p>Track inventory, cost per unit, quantity remaining, and supplies used on invoices. Supply costs sync into invoice totals.</p></div><div class="tutorialCard"><b>4. Banking</b><p>Use Accounts as a checkbook register, Trackers for totals/goals/reports, and Receipts for expense proof. Link ledger entries to invoices and supplies.</p></div><div class="tutorialCard"><b>5. Studio</b><p>Sketch ideas, mark up photos, save to Gallery, and prepare client concepts. Advanced materials/assets are planned for a future workspace system.</p></div><div class="tutorialCard"><b>6. Backup</b><p>Use Export Full Backup for restore/import. Use Reports for human-readable PDFs. Meridian saves locally and mirrors data offline.</p></div></div><div class="actions"><button class="save" type="button" onclick="setSection('schedule');closeTutorial()">Start in Schedule</button><button type="button" onclick="setSection('banking');state.tabs.banking='trackers';save();render();closeTutorial()">Open Backup Center</button><button type="button" onclick="toggleViewMode()">Toggle Mobile/Desktop</button></div></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
function closeTutorial(event){
  if(event && event.target && event.currentTarget && event.target!==event.currentTarget)return;
  const el=document.getElementById('tutorialOverlay');
  if(el)el.remove();
}

function calcJobPay(){let start=document.getElementById('jobStart')?.value||'',end=document.getElementById('jobEnd')?.value||'',hoursEl=document.getElementById('jobHours'),rateEl=document.getElementById('jobRate'),typeEl=document.getElementById('jobPayType'),owedEl=document.getElementById('jobOwed');if(hoursEl&&start&&end){let h=hoursBetween(start,end);if(h!==null)hoursEl.value=h.toFixed(h%1===0?0:2)}let hours=Number(hoursEl?.value||0),rate=Number(rateEl?.value||0),type=typeEl?.value||'hourly',total=type==='flat'?rate:hours*rate;if(owedEl)owedEl.value=total?total.toFixed(2):''}function hoursBetween(start,end){let a=parseFlexibleTime(start),b=parseFlexibleTime(end);if(a===null||b===null)return null;let mins=b-a;if(mins<0)mins+=1440;return mins/60}function parseFlexibleTime(t){t=String(t||'').trim().toLowerCase();let m=t.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])?m?$/);if(!m)return null;let h=Number(m[1]),min=Number(m[2]||0),ap=m[3];if(ap==='p'&&h<12)h+=12;if(ap==='a'&&h===12)h=0;if(h>23||min>59)return null;return h*60+min}function sortAgenda(arr){arr.sort((a,b)=>timeValue(a.time)-timeValue(b.time))}function timeValue(t){t=String(t||'').toLowerCase().trim();let m=t.match(/(\d{1,2})(?::(\d{2}))?\s*([ap])?/);if(!m)return 9999;let h=Number(m[1]),min=Number(m[2]||0),ap=m[3];if(ap==='p'&&h<12)h+=12;if(ap==='a'&&h===12)h=0;return h*60+min}function formatTime(t){t=String(t||'').trim().toLowerCase();if(!t)return'';if(t.includes('a')||t.includes('p'))return t.replace(':00','');if(t.includes(':')){let [h,min]=t.split(':');h=Number(h);let ap=h>=12?'p':'a';h=h%12||12;return min==='00'?`${h}${ap}`:`${h}:${min}${ap}`}return t}let softRenderTimer=null;function renderCalendarOnlySoon(){clearTimeout(softRenderTimer);softRenderTimer=setTimeout(()=>render(),650)}function roundMoney(n,places=2){let factor=Math.pow(10,places);return (Math.round((Number(n||0)+Number.EPSILON)*factor)/factor).toFixed(places)}function money(n){return '$'+normalizeMoneyNumber(n,2).toFixed(2)}function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}function escapeAttr(s=''){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;')}function backupLegacyJson(){autosaveCurrentPage('backup-legacy');let b=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});let u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='meridian-backup-legacy.json';a.click();URL.revokeObjectURL(u)}
async function forceFreshApp(){
  try{
    if('serviceWorker' in navigator){
      const regs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r=>r.unregister()));
    }
    if('caches' in window){
      const keys=await caches.keys();
      await Promise.all(keys.map(k=>caches.delete(k)));
    }
  }catch(e){console.warn('Cache reset failed',e)}
  location.reload(true);
}
if('serviceWorker'in navigator){
  window.addEventListener('load',async()=>{
    try{
      const reg=await navigator.serviceWorker.register('./service-worker.js?v=49.13');
      reg.update();
    }catch(e){}
  });
}

async function scanBarcode(id){
  if(!('BarcodeDetector' in window)){
    alert('Barcode scanning not supported on this device. Enter manually.');
    return;
  }
  try{
    const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    const video = document.createElement('video');
    video.srcObject = stream;
    await video.play();

    const detector = new BarcodeDetector();
    const scan = async ()=>{
      const codes = await detector.detect(video);
      if(codes.length){
        const value = codes[0].rawValue;
        let item = state.supplyItems[id];
        if(item){
          item.storeItemNumber = value;
          save();
          render();
        }
        stream.getTracks().forEach(t=>t.stop());
      }else{
        requestAnimationFrame(scan);
      }
    };
    scan();
  }catch(e){
    alert('Camera error');
  }
}


function updatePwaStatus(){
  const el=document.getElementById('pwaStatus');
  if(!el)return;
  el.textContent=navigator.onLine?'Online / Saved locally':'Offline / Saved locally';
  el.classList.toggle('offline',!navigator.onLine);
}
window.addEventListener('online',updatePwaStatus);
window.addEventListener('offline',updatePwaStatus);
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js?v=49.13').then(()=>updatePwaStatus()).catch(()=>updatePwaStatus()));
}else{window.addEventListener('load',updatePwaStatus);}

scheduleReminderChecks();
render();
setTimeout(updatePwaStatus,200);


/* ===== V40 STATIC SCRATCH PAD ENGINE ===== */

/* Static V40 emergency scratchpad removed in V43. Calendar-mounted scratchpad is now the single source of truth. */



/* LEGACY CUT MERIDIAN PATCH v1.1
   Targeted override only: invoice/order form, receipt text, and manual payment method display.
   Original Meridian layout, sections, navigation, storage engine, supplies, banking, studio, and schedule remain intact. */
const LEGACY_CUT_PRODUCTS=['Sign','Frame','Puzzle','Coasters','Key Chain','Bookmark','Notebook Cover','Book Box','Garden Stakes'];
const LEGACY_CUT_SIZES=['Standard','Small','Medium','Large'];
const LEGACY_CUT_DESIGNS=['A','B','C','Custom'];
const LEGACY_CUT_FONTS=['1','2','3','4'];
const LEGACY_CUT_STAINS=['Dark Stain Back / Light Stain Letters','Light Stain Back / Dark Stain Letters'];
const LEGACY_CUT_COLORS=['Red','Dark Pink','Light Pink','Purple','Baby Blue','Light Blue','Dark Blue','Green','Light Yellow','Dark Yellow','Light Brown','Dark Brown','Black','White','Custom Color +$3/color'];
const LEGACY_CUT_PAYMENTS=['Cash','Square/Card','CashApp','Chime','PayPal','Other'];

function ensureLegacyCutInvoice(inv){
 if(!inv)return null;
 if(!inv.legacyCut)inv.legacyCut={};
 const lc=inv.legacyCut;
 if(!Array.isArray(lc.products))lc.products=[];
 if(!Array.isArray(lc.size))lc.size=[];
 if(!Array.isArray(lc.designOptions))lc.designOptions=[];
 if(!Array.isArray(lc.fontOptions))lc.fontOptions=[];
 if(!Array.isArray(lc.stainOptions))lc.stainOptions=[];
 if(!Array.isArray(lc.woodColors))lc.woodColors=[];
 lc.name=lc.name||inv.client||'';
 lc.phone=lc.phone||inv.phone||'';
 lc.email=lc.email||inv.email||'';
 lc.address=lc.address||inv.address||'';
 lc.productOther=lc.productOther||'';
 lc.addItem=lc.addItem||'';
 lc.sizeCustom=lc.sizeCustom||'';
 lc.fontCustom=lc.fontCustom||'';
 lc.customColor=lc.customColor||'';
 lc.personalization=lc.personalization||'';
 if(lc.basePrice===undefined)lc.basePrice='';
 if(lc.extraOther===undefined)lc.extraOther='';
 if(lc.customColorCount===undefined)lc.customColorCount='';
 lc.deliveryDate=lc.deliveryDate||inv.deliveryDate||'';
 inv.paymentMethod=inv.paymentMethod||lc.paymentMethod||'Cash';
 inv.paymentOther=inv.paymentOther||lc.paymentOther||'';
 lc.paymentMethod=inv.paymentMethod;
 lc.paymentOther=inv.paymentOther;
 return lc;
}
function legacyChecked(arr,value){return Array.isArray(arr)&&arr.includes(value)}
function legacyCheckGroup(inv,group,items,otherKey,labelPrefix=''){
 const lc=ensureLegacyCutInvoice(inv);
 const checks=items.map(item=>`<label class="legacyCheck"><input type="checkbox" ${legacyChecked(lc[group],item)?'checked':''} onchange="updateLegacyCutCheckbox('${inv.id}','${group}','${escapeAttr(item)}',this.checked)"><span>${escapeHtml(item)}</span></label>`).join('');
 const other=otherKey?`<label>${labelPrefix||'Other / Custom'}</label><input value="${escapeHtml(lc[otherKey]||'')}" oninput="updateLegacyCutField('${inv.id}','${otherKey}',this.value)" placeholder="Type here">`:'';
 return `<div class="legacyCheckGrid">${checks}</div>${other}`;
}
function legacyPaymentChecks(inv){
 ensureLegacyCutInvoice(inv);
 return `<div class="legacyCheckGrid paymentGrid">${LEGACY_CUT_PAYMENTS.map(method=>`<label class="legacyCheck"><input type="checkbox" ${inv.paymentMethod===method?'checked':''} onchange="setLegacyCutPaymentMethod('${inv.id}','${escapeAttr(method)}',this.checked)"><span>${escapeHtml(method)}</span></label>`).join('')}</div><label>Other Payment Note</label><input value="${escapeHtml(inv.paymentOther||'')}" oninput="updateLegacyCutField('${inv.id}','paymentOther',this.value)" placeholder="Only if Other">`;
}
function updateLegacyCutField(id,key,value){
 const inv=state.invoices.find(i=>i.id===id);if(!inv)return;
 const lc=ensureLegacyCutInvoice(inv);
 lc[key]=value;
 if(key==='name'){inv.client=value; if(value){if(!state.clients[value])state.clients[value]={name:value,phone:'',address:'',notes:''};}}
 if(key==='phone'){inv.phone=value;if(inv.client){if(!state.clients[inv.client])state.clients[inv.client]={name:inv.client,phone:'',address:'',notes:''};state.clients[inv.client].phone=value;}}
 if(key==='email'){inv.email=value;if(inv.client){if(!state.clients[inv.client])state.clients[inv.client]={name:inv.client,phone:'',address:'',notes:''};state.clients[inv.client].email=value;}}
 if(key==='address'){inv.address=value;if(inv.client){if(!state.clients[inv.client])state.clients[inv.client]={name:inv.client,phone:'',address:'',notes:''};state.clients[inv.client].address=value;}}
 if(key==='deliveryDate')inv.deliveryDate=value;
 if(key==='paymentOther'){inv.paymentOther=value;lc.paymentOther=value;}
 normalizeInvoice(inv,{skipSupplySync:true});save('legacy-cut-field');
}
function updateLegacyCutCheckbox(id,group,value,checked){
 const inv=state.invoices.find(i=>i.id===id);if(!inv)return;
 const lc=ensureLegacyCutInvoice(inv);
 if(!Array.isArray(lc[group]))lc[group]=[];
 if(checked && !lc[group].includes(value))lc[group].push(value);
 if(!checked)lc[group]=lc[group].filter(v=>v!==value);
 recalcLegacyCutOrderTotal(inv);save('legacy-cut-checkbox');
 if(state.tabs?.schedule==='newProject')render();
}
function setLegacyCutPaymentMethod(id,method,checked){
 const inv=state.invoices.find(i=>i.id===id);if(!inv)return;
 const lc=ensureLegacyCutInvoice(inv);
 inv.paymentMethod=checked?method:'';
 lc.paymentMethod=inv.paymentMethod;
 const tx=firstAutoInvoicePayment?.(id);
 if(tx)tx.method=inv.paymentMethod||'Cash';
 save('legacy-cut-payment-method');
 if(document.getElementById('clientInvoiceEmbed'))refreshClientInvoiceEmbed(id);else if(state.tabs?.schedule==='newProject')render();else renderInvoiceEditor(id);
}
function setLegacyCutTotalDue(id,value){
 const inv=state.invoices.find(i=>i.id===id);if(!inv)return;
 const lc=ensureLegacyCutInvoice(inv);
 lc.basePrice=value;
 recalcLegacyCutOrderTotal(inv);
 save('legacy-cut-base-price');
}
function legacyCutExtraColorCount(inv){
 const lc=ensureLegacyCutInvoice(inv);
 return (lc.woodColors||[]).filter(c=>c!=='Custom Color +$3/color').length;
}
function legacyCutCustomColorExtra(inv){
 const lc=ensureLegacyCutInvoice(inv);
 return legacyChecked(lc.woodColors,'Custom Color +$3/color')?normalizeMoneyNumber(toNumber(lc.customColorCount,0)*3,2):0;
}
function legacyCutTotalBreakdown(inv){
 const lc=ensureLegacyCutInvoice(inv);
 const base=normalizeMoneyNumber(lc.basePrice||0,2);
 const colorExtra=normalizeMoneyNumber(legacyCutExtraColorCount(inv)*5,2);
 const customColorExtra=legacyCutCustomColorExtra(inv);
 const otherExtra=normalizeMoneyNumber(lc.extraOther||0,2);
 const total=normalizeMoneyNumber(base+colorExtra+customColorExtra+otherExtra,2);
 return {base,colorExtra,customColorExtra,otherExtra,total};
}
function recalcLegacyCutOrderTotal(inv){
 if(!inv)return;
 const b=legacyCutTotalBreakdown(inv);
 let line=(inv.services||[]).find(s=>s.legacyCutOrderTotal);
 if(!line){line={name:'Legacy Cut Custom Order',amount:0,legacyCutOrderTotal:true};inv.services.unshift(line);}
 line.amount=b.total;
 recalcInvoice(inv);
 upsertAutoInvoicePayment?.(inv,inv.paid||0,'invoice');
 return b;
}
function updateLegacyCutPriceField(id,key,value){
 const inv=state.invoices.find(i=>i.id===id);if(!inv)return;
 const lc=ensureLegacyCutInvoice(inv);
 lc[key]=value;
 recalcLegacyCutOrderTotal(inv);
 save('legacy-cut-price');
 if(document.getElementById('clientInvoiceEmbed'))refreshClientInvoiceEmbed(id);else if(state.tabs?.schedule==='newProject')render();else renderInvoiceEditor(id);
}
function legacyCutOrderDetails(inv){
 const lc=ensureLegacyCutInvoice(inv);
 const lines=[];
 const products=[...lc.products]; if(lc.productOther)products.push('Other: '+lc.productOther); if(lc.addItem)products.push('Add Item: '+lc.addItem);
 if(products.length)lines.push('Product(s): '+products.join(', '));
 const sizes=[...lc.size]; if(lc.sizeCustom)sizes.push('Custom: '+lc.sizeCustom);
 if(sizes.length)lines.push('Size: '+sizes.join(', '));
 if(lc.designOptions.length)lines.push('Design: '+lc.designOptions.join(', '));
 const fonts=[...lc.fontOptions]; if(lc.fontCustom)fonts.push('Custom: '+lc.fontCustom);
 if(fonts.length)lines.push('Font: '+fonts.join(', '));
 if(lc.stainOptions.length)lines.push('Stain: '+lc.stainOptions.join(', '));
 const colors=[...lc.woodColors]; if(lc.customColor)colors.push('Custom Color: '+lc.customColor);
 if(colors.length)lines.push('Wood Color(s): '+colors.join(', '));
 if(String(lc.personalization||'').trim())lines.push('Customization / Personalization: '+String(lc.personalization||'').trim());
 const b=legacyCutTotalBreakdown(inv);
 if(b.base)lines.push('Set price: '+money(b.base));
 if(b.colorExtra)lines.push('Wood color extra: '+money(b.colorExtra));
 if(b.customColorExtra)lines.push('Custom color extra: '+money(b.customColorExtra));
 if(b.otherExtra)lines.push('Other extra charges: '+money(b.otherExtra));
 return lines;
}
function legacyCutOrderDetailsHtml(inv){
 const details=legacyCutOrderDetails(inv);
 return details.length?details.map(line=>`<p class="legacyReceiptLine">${escapeHtml(line)}</p>`).join(''):'<p class="note">No order details selected yet.</p>';
}
function legacyCutReceiptText(inv){
 ensureLegacyCutInvoice(inv);
 const details=legacyCutOrderDetails(inv).join('\n');
 return `Legacy Cut LLC\n"Crafted with Passion, Cut with Precision"\n\nARTIST: BiRD\nPHONE: (562) 505-4588\nEMAIL: LegacyCutLLC@gmail.com\n\nDate: ${inv.date||''}\nClient: ${inv.client||''}\nPhone: ${inv.phone||''}\nEmail: ${inv.email||''}\nAddress: ${inv.address||''}\n\nProduct/order details:\n${details||'No order details selected yet.'}\n\nTotal: ${money(inv.total)}\nPaid: ${money(inv.paid)}\nPayment Method: ${inv.paymentMethod||''}${inv.paymentMethod==='Other'&&inv.paymentOther?' — '+inv.paymentOther:''}\nBalance: ${money(invoiceBalance(inv))}\nEstimated Delivery Date: ${inv.deliveryDate||''}`;
}
function legacyCutOrderFormHtml(inv,mode='full'){
 const lc=ensureLegacyCutInvoice(inv);
 return `<div class="legacyOrderForm">
  <h3>Legacy Cut Order Form</h3>
  <label>Date</label><input value="${escapeHtml(inv.date||'')}" oninput="updateInvoiceField('${inv.id}','date',this.value)">
  <label>Name</label><input value="${escapeHtml(lc.name||inv.client||'')}" autocomplete="off" oninput="updateLegacyCutField('${inv.id}','name',this.value)">
  <label>Phone</label><input value="${escapeHtml(lc.phone||inv.phone||'')}" oninput="updateLegacyCutField('${inv.id}','phone',this.value)">
  <label>Email</label><input value="${escapeHtml(lc.email||inv.email||'')}" oninput="updateLegacyCutField('${inv.id}','email',this.value)">
  <label>Address</label><input value="${escapeHtml(lc.address||inv.address||'')}" oninput="updateLegacyCutField('${inv.id}','address',this.value)">
  <h4>PRODUCT(S)</h4>${legacyCheckGroup(inv,'products',LEGACY_CUT_PRODUCTS,'productOther','Other')}
  <label>Add Item <span class="note">New product to sell</span></label><input value="${escapeHtml(lc.addItem||'')}" oninput="updateLegacyCutField('${inv.id}','addItem',this.value)" placeholder="Example: Ornament, magnet, wall art, etc.">
  <h4>SIZE</h4>${legacyCheckGroup(inv,'size',LEGACY_CUT_SIZES,'sizeCustom','Custom')}
  <h4>DESIGN OPTIONS</h4>${legacyCheckGroup(inv,'designOptions',LEGACY_CUT_DESIGNS,null)}
  <h4>FONT OPTIONS</h4>${legacyCheckGroup(inv,'fontOptions',LEGACY_CUT_FONTS,'fontCustom','Custom Font')}
  <h4>WOOD STAIN OPTIONS <span class="note">Included in price</span></h4>${legacyCheckGroup(inv,'stainOptions',LEGACY_CUT_STAINS,null)}
  <h4>WOOD COLOR(S) <span class="note">Extra $5</span></h4>${legacyCheckGroup(inv,'woodColors',LEGACY_CUT_COLORS,'customColor','Custom Color Details')}
  <h4>CUSTOMIZATION / PERSONALIZATION</h4><textarea oninput="updateLegacyCutField('${inv.id}','personalization',this.value)" placeholder="Personalization notes">${escapeHtml(lc.personalization||'')}</textarea>
  <h4>Totals + Payment</h4>
  ${legacyCutPricingHtml(inv,mode)}
  <label>TOTAL PAID</label><input type="number" step="0.01" value="${Number(inv.paid||0).toFixed(2)}" oninput="updateInvoicePaid('${inv.id}',this.value)" onblur="${mode==='client'?`refreshClientInvoiceEmbed('${inv.id}')`:(mode==='project'?`render()`:`renderInvoiceEditor('${inv.id}')`)}">
  <h4>PAYMENT METHOD</h4>${legacyPaymentChecks(inv)}
  <label>TOTAL BALANCE</label><input type="text" value="${money(invoiceBalance(inv))}" readonly>
  <label>ESTIMATED DELIVERY DATE</label><input value="${escapeHtml(inv.deliveryDate||lc.deliveryDate||'')}" placeholder="__/__/____" oninput="updateLegacyCutField('${inv.id}','deliveryDate',this.value)">
 </div>`;
}

function legacyCutPricingHtml(inv,mode='full'){
 const lc=ensureLegacyCutInvoice(inv);
 const b=legacyCutTotalBreakdown(inv);
 const colorCount=legacyCutExtraColorCount(inv);
 const customColorChecked=legacyChecked(lc.woodColors,'Custom Color +$3/color');
 return `<div class="legacyPriceBox">
  <p class="note"><b>Included in set price:</b> selected size, design, font, and stain. <b>Extras:</b> wood colors are $5 each; custom colors are $3/color.</p>
  <label>SET PRICE FOR SIZE / DESIGN</label><input type="number" step="0.01" value="${escapeHtml(lc.basePrice||'')}" oninput="updateLegacyCutPriceField('${inv.id}','basePrice',this.value)" placeholder="Base order price">
  <div class="legacyPriceBreakdown">
    <div>Wood color extras: ${colorCount} × $5 = <b>${money(b.colorExtra)}</b></div>
    <div>${customColorChecked?`Custom colors: <input class="inlineMoney" type="number" step="1" min="0" value="${escapeHtml(lc.customColorCount||'')}" oninput="updateLegacyCutPriceField('${inv.id}','customColorCount',this.value)"> × $3 = <b>${money(b.customColorExtra)}</b>`:'Custom colors: not selected'}</div>
  </div>
  <label>OTHER EXTRA CHARGES</label><input type="number" step="0.01" value="${escapeHtml(lc.extraOther||'')}" oninput="updateLegacyCutPriceField('${inv.id}','extraOther',this.value)" placeholder="Optional add-ons">
  <label>TOTAL PRICE DUE</label><input type="text" value="${money(b.total)}" readonly>
 </div>`;
}
function getNewProjectInvoice(){
 ensureCollections();
 let id=state.legacyCutProjectDraftId||'';
 let inv=state.invoices.find(i=>i.id===id);
 if(!inv){inv=createBlankInvoice('');state.legacyCutProjectDraftId=inv.id;}
 ensureLegacyCutInvoice(inv);
 recalcLegacyCutOrderTotal(inv);
 return inv;
}
function renderNewProjectForm(){
 const inv=getNewProjectInvoice();
 return `<div class="titleRow"><div><h2>New Project</h2><p>Legacy Cut order builder. Check the options, enter the set price, extras auto-add, and the total feeds the invoice.</p></div><div class="actions"><button onclick="resetNewProjectDraft()">New Blank Project</button><button class="save" onclick="openInvoice('${inv.id}')">Open Invoice</button></div></div><div class="invoiceGrid"><div class="box">${legacyCutOrderFormHtml(inv,'project')}<div class="actions"><button class="save" onclick="saveNewProjectDraft('${inv.id}')">Save Project / Invoice</button><button class="save" onclick="shareInvoice('${inv.id}','text')">Text Receipt</button><button class="save" onclick="shareInvoice('${inv.id}','email')">Email Receipt</button></div></div><div class="box receipt">${invoiceReceiptHtml(inv)}</div></div>`;
}
function saveNewProjectDraft(id){
 const inv=state.invoices.find(i=>i.id===id);if(!inv)return;
 ensureLegacyCutInvoice(inv);
 recalcLegacyCutOrderTotal(inv);
 if(inv.client){if(!state.clients[inv.client])state.clients[inv.client]={name:inv.client,phone:inv.phone||'',address:inv.address||'',notes:''};state.selectedClient=inv.client;}
 save('legacy-cut-new-project-save');
 alert('Project saved to invoices.');
 render();
}
function resetNewProjectDraft(){
 if(!confirm('Start a new blank Legacy Cut project form? The current invoice will stay saved in Invoices.'))return;
 state.legacyCutProjectDraftId='';
 save('legacy-cut-new-project-reset');
 render();
}
function setupNewProjectSignaturePad(){return;}
function legacyCutAdvancedLineItemsHtml(inv,mode='full'){
 let serviceOptions=(state.services||[]).map(s=>`<option value="${escapeHtml(s)}"></option>`).join('');
 const serviceNameId=mode==='client'?'clientNewServiceName':'newServiceName';
 const serviceAmountId=mode==='client'?'clientNewServiceAmount':'newServiceAmount';
 const addService=mode==='client'?'addClientInvoiceService':'addInvoiceService';
 const removeLine=mode==='client'?'removeClientInvoiceLine':'removeInvoiceLine';
 return `<details class="legacyAdvanced"><summary>Advanced: extra services, supplies, signature, and check photo</summary>
  <datalist id="${mode==='client'?'clientServiceOptions':'serviceOptions'}">${serviceOptions}</datalist>
  <h4>Services</h4><div>${(inv.services||[]).map((s,idx)=>`<div class="lineItem"><span>${escapeHtml(s.name)}${s.legacyCutOrderTotal?' <small>main total</small>':''}</span><input type="number" step="0.01" value="${Number(s.amount||0)}" oninput="updateInvoiceLine('${inv.id}','services',${idx},this.value)"><button class="smallBtn" onclick="${removeLine}('${inv.id}','services',${idx})">×</button></div>`).join('')||'<p class="note">No services yet.</p>'}</div>
  <div class="two"><input id="${serviceNameId}" list="${mode==='client'?'clientServiceOptions':'serviceOptions'}" placeholder="Service"><input id="${serviceAmountId}" type="number" step="0.01" placeholder="Amount"></div><button onclick="${addService}('${inv.id}')">Add Service</button>
  <h4>Supplies</h4>${(inv.supplies||[]).map((s,idx)=>invoiceSupplyLineHtml(inv,s,idx,mode)).join('')||'<p class="note">No supplies yet.</p>'}${invoiceSupplyAddHtml(inv,mode)}
  <h4>Client Signature</h4><canvas id="${mode==='client'?'clientSignaturePad':'signaturePad'}" class="signature"></canvas><div class="actions"><button onclick="clearInvoiceSignature('${inv.id}')">Clear Signature</button></div>
  <h4>Check Photo</h4><input type="file" accept="image/*" capture="environment" onchange="attachCheckPhoto(event,'${inv.id}')">${inv.checkPhoto?`<img class="photo" src="${inv.checkPhoto}">`:''}
 </details>`;
}
function createBlankInvoice(client=''){
 ensureCollections();
 let inv={id:uid(),number:nextInvoiceNumber(),client,date:new Date().toLocaleDateString(),services:[],supplies:[],jobs:[],notes:'',total:0,paid:0,signature:'',checkPhoto:'',status:'unpaid',phone:'',email:'',address:'',deliveryDate:'',paymentMethod:'Cash',paymentOther:'',legacyCut:{}};
 ensureLegacyCutInvoice(inv);
 state.invoices.push(inv);
 return inv;
}
function invoiceEditorHtml(inv){
 ensureLegacyCutInvoice(inv);normalizeInvoice(inv,{skipSupplySync:true});
 return `<div class="titleRow"><div><h2>Invoice #${inv.number}</h2><p>Legacy Cut order • ${getInvoiceStatus(inv)}</p></div><button onclick="setTab('invoices')">Back</button></div><div class="invoiceGrid"><div class="box">${legacyCutOrderFormHtml(inv,'full')}${legacyCutAdvancedLineItemsHtml(inv,'full')}<label>Notes</label><textarea id="invNotes" oninput="updateInvoiceField('${inv.id}','notes',this.value)">${escapeHtml(inv.notes||'')}</textarea><div class="actions"><button class="save" onclick="shareInvoice('${inv.id}','text')">Text Receipt</button><button class="save" onclick="shareInvoice('${inv.id}','email')">Email Receipt</button><button onclick="toggleInvoiceTimeLogs('${inv.id}')">View Time Logs</button><button class="delete" onclick="deleteInvoice('${inv.id}')">Delete</button></div>${state.invoiceTimeLogOpen===inv.id?invoiceTimeLogsHtml(inv):''}</div><div class="box receipt">${invoiceReceiptHtml(inv)}</div></div>`;
}
function clientInvoiceEmbedHtml(inv){
 if(!inv)return'<p class="note">No current invoice.</p>';
 ensureLegacyCutInvoice(inv);normalizeInvoice(inv,{skipSupplySync:true});
 return `<div class="box embeddedInvoice"><div class="titleRow miniTitle"><div><h2>Invoice #${inv.number}</h2><p>${getInvoiceStatus(inv)} • Total ${money(inv.total)} • Balance ${money(invoiceBalance(inv))}</p></div><button onclick="openInvoice('${inv.id}')">Full View</button></div>${legacyCutOrderFormHtml(inv,'client')}${legacyCutAdvancedLineItemsHtml(inv,'client')}<label>Notes</label><textarea oninput="updateInvoiceField('${inv.id}','notes',this.value)">${escapeHtml(inv.notes||'')}</textarea><div class="actions"><button class="save" onclick="shareInvoice('${inv.id}','text')">Text Receipt</button><button class="save" onclick="shareInvoice('${inv.id}','email')">Email Receipt</button><button onclick="markClientInvoicePaid('${inv.id}')">Mark Paid</button><button onclick="toggleInvoiceTimeLogs('${inv.id}')">View Time Logs</button></div>${state.invoiceTimeLogOpen===inv.id?invoiceTimeLogsHtml(inv):''}<div class="receipt smallReceipt">${invoiceReceiptHtml(inv)}</div></div>`;
}
function invoiceReceiptHtml(inv){
 const pay=escapeHtml(inv.paymentMethod||'');
 const payNote=inv.paymentMethod==='Other'&&inv.paymentOther?` — ${escapeHtml(inv.paymentOther)}`:'';
 return `<div class="legacyReceipt"><h2>Legacy Cut LLC</h2><p class="tagline">"Crafted with Passion, Cut with Precision"</p><p><b>ARTIST:</b> BiRD<br><b>PHONE:</b> (562) 505-4588<br><b>EMAIL:</b> LegacyCutLLC@gmail.com</p><hr><p><b>Date:</b> ${escapeHtml(inv.date||'')}<br><b>Name:</b> ${escapeHtml(inv.client||'')}<br><b>Phone:</b> ${escapeHtml(inv.phone||'')}<br><b>Email:</b> ${escapeHtml(inv.email||'')}<br><b>Address:</b> ${escapeHtml(inv.address||'')}</p><h3>Product / Order Details</h3>${legacyCutOrderDetailsHtml(inv)}<hr><p><b>Total:</b> ${money(inv.total)}<br><b>Paid:</b> ${money(inv.paid)}<br><b>Payment Method:</b> ${pay}${payNote}<br><b>Balance:</b> ${money(invoiceBalance(inv))}<br><b>Est. Delivery Date:</b> ${escapeHtml(inv.deliveryDate||'')}</p>${inv.signature?`<p><b>Signed:</b><br><img class="sigImg" src="${inv.signature}"></p>`:''}${inv.checkPhoto?'<p><b>Check photo saved.</b></p>':''}</div>`;
}
function normalizeInvoice(inv,opts={}){
 if(!inv)return null;
 ensureLegacyCutInvoice(inv);
 if(!Array.isArray(inv.services))inv.services=[];
 if(!Array.isArray(inv.supplies))inv.supplies=[];
 inv.services.forEach(s=>{s.amount=normalizeMoneyNumber(s.amount||0,2);});
 inv.supplies.forEach(recalcSupplyLine);
 const totalCents=[...(inv.services||[]),...(inv.supplies||[])].reduce((a,l)=>a+normalizeCents(l.amount),0);
 inv.total=centsToMoney(totalCents);
 inv.paid=normalizeMoneyNumber(inv.paid||0,2);
 inv.balance=centsToMoney(Math.max(totalCents-normalizeCents(inv.paid),0));
 inv.status=getInvoiceStatus(inv).toLowerCase();
 if(!opts.skipSupplySync)recalcAllSupplyRemaining({silent:true});
 return inv;
}
function shareInvoice(id,type){
 let inv=state.invoices.find(i=>i.id===id);if(!inv)return;
 let body=legacyCutReceiptText(inv);
 let msg=encodeURIComponent(body);
 if(type==='text')location.href='sms:?body='+msg;
 else if(type==='email')location.href='mailto:?subject=Legacy Cut Receipt #'+inv.number+'&body='+msg;
 else if(navigator.share)navigator.share({title:'Legacy Cut Receipt #'+inv.number,text:body});
 else alert(body);
}
function upsertAutoInvoicePayment(inv,amount,source='invoice'){
 ensureBanking();
 if(!inv)return null;
 ensureLegacyCutInvoice(inv);
 const amt=normalizeMoneyNumber(amount||0,2);
 let tx=firstAutoInvoicePayment(inv.id);
 if(amt<=0){
   if(tx)state.banking.transactions=state.banking.transactions.filter(t=>t.id!==tx.id);
   return null;
 }
 if(!tx){
   tx={id:uid(),type:'income',date:dateKey(new Date()),createdAt:new Date().toISOString(),image:'',linkedSupplyId:'',autoInvoicePayment:true};
   state.banking.transactions.push(tx);
 }
 tx.type='income';
 tx.linkedInvoiceId=inv.id;
 tx.amount=amt;
 tx.category='Job Income';
 tx.description=`Legacy Cut Invoice #${inv.number} payment${inv.client?' — '+inv.client:''}`;
 tx.method=inv.paymentMethod||'Cash';
 tx.notes=source==='invoice'?'Auto-created/updated from Legacy Cut invoice payment.':(tx.notes||'Linked invoice payment.');
 tx.updatedAt=new Date().toISOString();
 return tx;
}
