/* ══════════════════════════════════════════════════════════
   Emvalis v3.4 — app.export.js  (5/6)
   İçerik : XLSX (Excel) rapor dışa aktarımı — ExcelJS ile
            tam formatlı fazla mesai çizelgesi üretimi
   Not    : app.core.js ve app.distribution.js'ten sonra yüklenmelidir
            (state.lastResult kullanır).

   ══════════════════════════════════════════════════════════ */
'use strict';

/* ── XLSX EXPORT ─────────────────────────────────────────── */
/* ── XLSX: önce bilgi kartı açılır, "Anladım, indir" ile iner ── */
function exportExcel() {
  if(!state.lastResult){notify('Önce dağıtım yapın!','error');Sounds.error();return;}
  openXlsxTip();
}
function openXlsxTip(){ document.getElementById('xlsxTip').classList.add('show'); }
function closeXlsxTip(){ document.getElementById('xlsxTip').classList.remove('show'); }

async function confirmExcelDownload() {
  if(!state.lastResult){notify('Önce dağıtım yapın!','error');Sounds.error();return;}
  if(document.getElementById('loadingOverlay').classList.contains('active')) return; // çift tıklama koruması
  document.getElementById('loadingOverlay').classList.add('active');
  try {
    await _generateXLSX(state.lastResult);
    Sounds.excel();
    notify('XLSX başarıyla indirildi!','success');
  } catch(e) {
    notify('XLSX hatası: '+e.message,'error'); Sounds.error(); console.error(e);
  } finally {
    document.getElementById('loadingOverlay').classList.remove('active');
  }
}


/* ── PDF: XLSX ile aynı hücre düzeninden, A4 yatay ── */
async function exportPDF() {
  if(!state.lastResult){notify('Önce dağıtım yapın!','error');Sounds.error();return;}
  const ov=document.getElementById('loadingOverlay');
  if(ov.classList.contains('active')) return;
  ov.classList.add('active');
  try {
    if(!window.jspdf) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    if(!(window.pdfMake&&window.pdfMake.vfs)) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js'); // Roboto (Türkçe karakter)

    const r=state.lastResult;
    const ws=await _generateXLSX(r,true);          // XLSX ile birebir aynı sayfa, indirmeden
    const doc=new window.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    const v=window.pdfMake.vfs;
    doc.addFileToVFS('Roboto-Regular.ttf',v['Roboto-Regular.ttf']); doc.addFont('Roboto-Regular.ttf','Roboto','normal');
    doc.addFileToVFS('Roboto-Medium.ttf',v['Roboto-Medium.ttf']);   doc.addFont('Roboto-Medium.ttf','Roboto','bold');

    _renderWorksheetPDF(doc,ws,r.assigned.length,r.grup,r.year,r.month);

    downloadFile(doc.output('arraybuffer'),`fazla_mesai_${r.grup}_${r.year}_${pad(r.month)}.pdf`,'application/pdf');
    Sounds.excel();
    notify('PDF başarıyla indirildi!','success');
  } catch(e) {
    notify('PDF hatası: '+e.message,'error'); Sounds.error(); console.error(e);
  } finally {
    ov.classList.remove('active');
  }
}

/* ── XLSX çalışma sayfasını (ExcelJS ws) PDF'e çizer ── */
function _renderWorksheetPDF(doc, ws, nPersons, grup, year, month) {
  const PT=0.352778, PXMM=25.4/96;
  const PAGE_W=297, PAGE_H=210, ML=2.54, MR=2.54, MT=7.6, MB=10.2;      // A4 yatay, Excel kenar boşlukları
  const colPx=w=>Math.trunc(((256*w+Math.trunc(128/7))/256)*7);
  const totC=ws.columnCount;
  const natW=Array.from({length:totC},(_,i)=>colPx(ws.getColumn(i+1).width||8.43)*PXMM);
  const natTotal=natW.reduce((a,b)=>a+b,0);
  const S=Math.min(1,(PAGE_W-ML-MR)/natTotal);                            // "tüm sütunları 1 sayfaya sığdır"
  const colW=natW.map(w=>w*S);
  const colX=[0]; colW.forEach(w=>colX.push(colX[colX.length-1]+w));
  const X0=(PAGE_W-colX[totC])/2;                                          // yatay ortala
  const rowH=r=>((ws.getRow(r).height)||15)*PT*S;

  // birleşik hücreler
  const master={}, slave={};
  (ws.model.merges||[]).forEach(a=>{
    const [p,q]=a.split(':'); const A=ws.getCell(p), B=ws.getCell(q);
    master[A.row+','+A.col]={r2:B.row,c2:B.col};
    for(let r=A.row;r<=B.row;r++)for(let c=A.col;c<=B.col;c++) if(r!==A.row||c!==A.col) slave[r+','+c]=1;
  });

  const HR=4, lastData=HR+nPersons*2, fLabel=lastData+2, fLine=fLabel+1;
  const hdrH=[1,2,3,4].reduce((a,r)=>a+rowH(r),0);
  const personH=rowH(HR+1)+rowH(HR+2);
  const footH=rowH(lastData+1)+rowH(fLabel)+rowH(fLine);
  const avail=(PAGE_H-MT-MB)*.99;
  const cap=Math.max(1,Math.floor((avail-hdrH)/personH));
  const capLast=Math.max(1,Math.floor((avail-hdrH-footH)/personH));
  const pages=[]; let rem=nPersons;
  while(rem>0){
    if(rem<=capLast){pages.push(rem);rem=0;}
    else if(rem<=cap){const f=Math.ceil(rem/2);pages.push(f);pages.push(rem-f);rem=0;}
    else{pages.push(cap);rem-=cap;}
  }
  if(!pages.length) pages.push(0);

  const rgb=a=>{a=String(a||'').slice(-6);return [parseInt(a.slice(0,2),16),parseInt(a.slice(2,4),16),parseInt(a.slice(4,6),16)];};
  const fmtVal=c=>{
    let v=c.value; if(v==null||v==='') return '';
    if(v instanceof Date){const p=n=>String(n).padStart(2,'0');return `${p(v.getUTCDate())}.${p(v.getUTCMonth()+1)}.${v.getUTCFullYear()}`;}
    if(typeof v==='object'){ if(v.richText) return v.richText.map(t=>t.text).join(''); if(v.result!=null) return String(v.result); return String(c.text||''); }
    return String(v);
  };

  let personIdx=0;
  pages.forEach((count,pi)=>{
    if(pi>0) doc.addPage('a4','landscape');
    const rows=[1,2,3,4];
    for(let i=0;i<count;i++){rows.push(HR+1+(personIdx+i)*2, HR+2+(personIdx+i)*2);}
    personIdx+=count;
    if(pi===pages.length-1) rows.push(lastData+1,fLabel,fLine);
    const rowY={}; let y=MT; rows.forEach(r=>{rowY[r]=y;y+=rowH(r);});

    // 1. geçiş: dolgu + kenarlıklar
    doc.setDrawColor(0,0,0);
    rows.forEach(r=>{
      for(let c=1;c<=totC;c++){
        const cell=ws.getRow(r).getCell(c); const x=X0+colX[c-1], w=colW[c-1], h=rowH(r), yy=rowY[r];
        const f=cell.fill;
        if(f&&f.fgColor&&f.fgColor.argb){const [R,G,B]=rgb(f.fgColor.argb);doc.setFillColor(R,G,B);doc.rect(x,yy,w,h,'F');}
        const b=cell.border||{}; doc.setLineWidth(Math.max(.08,.75*PT*S));
        if(b.top   &&b.top.style)    doc.line(x,yy,x+w,yy);
        if(b.bottom&&b.bottom.style) doc.line(x,yy+h,x+w,yy+h);
        if(b.left  &&b.left.style)   doc.line(x,yy,x,yy+h);
        if(b.right &&b.right.style)  doc.line(x+w,yy,x+w,yy+h);
      }
    });

    // 2. geçiş: yazılar (birleşik bloğun tamamına ortalanır)
    rows.forEach(r=>{
      for(let c=1;c<=totC;c++){
        if(slave[r+','+c]) continue;
        const cell=ws.getRow(r).getCell(c); const txt=fmtVal(cell); if(!txt) continue;
        const m=master[r+','+c]; const r2=m?m.r2:r, c2=m?m.c2:c;
        const x=X0+colX[c-1], w=colX[c2]-colX[c-1];
        let h=0; for(let k=r;k<=r2;k++) h+=rowH(k);
        const yy=rowY[r];
        const fo=cell.font||{}, al=cell.alignment||{};
        const rot=al.textRotation===90, pad=.4;
        const along=(rot?h:w)-2*pad, across=(rot?w:h)-2*pad;
        let size=(fo.size||10)*S*.9, lines, lh, cap;                  // Roboto, Calibri'den geniş → %10 küçült
        doc.setFont('Roboto',fo.bold?'bold':'normal');
        for(let it=0;it<14;it++){                                      // hücreye sığana kadar küçült
          doc.setFontSize(size); lh=size*PT*1.18; cap=size*PT*.72;
          lines=al.wrapText?doc.splitTextToSize(txt,along):[txt];
          const wordMax=Math.max(...txt.split(/\s+/).map(t=>doc.getTextWidth(t)));
          const lineMax=Math.max(...lines.map(t=>doc.getTextWidth(t)));
          const ok=(al.wrapText?wordMax:lineMax)<=along && lines.length*size*PT<=((rot?w:h))*1.05;
          if(ok) break; size*=.93;
        }
        const n=lines.length; doc.setTextColor(0,0,0);
        if(rot){
          lines.forEach((ln,i)=>{
            const tw=doc.getTextWidth(ln);
            const bx=x+w/2+(i-(n-1)/2)*lh+cap/2;
            doc.text(ln,bx,yy+h/2+tw/2,{angle:90});
          });
        }else{
          lines.forEach((ln,i)=>{
            const by=yy+h/2+(i-(n-1)/2)*lh+cap/2;
            doc.text(ln,x+w/2,by,{align:'center'});
          });
        }
      }
    });

    // alt bilgi (Excel'deki sayfa altlığı)
    doc.setFont('Roboto','normal'); doc.setFontSize(7); doc.setTextColor(0,0,0);
    doc.text('Emvalis — Fazla Mesai Dağıtım Sistemi',ML+2,PAGE_H-4.5);
    doc.text(`Sayfa ${pi+1} / ${pages.length}`,PAGE_W/2,PAGE_H-4.5,{align:'center'});
    doc.text(new Date().toLocaleDateString('tr-TR'),PAGE_W-MR-2,PAGE_H-4.5,{align:'right'});
  });
}



async function _generateXLSX({assigned,allDates,holidays,year,month,grup,weOK}, returnWs=false) {
  if(!window.ExcelJS) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js');
  const wb=new ExcelJS.Workbook();
  wb.creator='Emvalis'; wb.lastModifiedBy='Emvalis'; wb.created=new Date(); wb.modified=new Date();
  wb.title=`Fazla Mesai — ${grup==='kadrolu'?'Kadrolu':'Sözleşmeli'} — ${TR_MONTHS[month-1]} ${year}`;
  const sheetName=`${TR_MONTHS[month-1]} ${year}`.replace(/[\\\/\?\*\[\]:]/g,'');   // Excel'in yasakladığı karakterler
  const ws=wb.addWorksheet(sheetName);
  const weeks=buildWeeks(allDates);

  const DAY_TR=['PZ','PZT','SALI','ÇAR','PER','CM','CT']; // getDay(): 0=Pazar
  const thin ={style:'thin',  color:{argb:'FF000000'}};
  const med  ={style:'thin',  color:{argb:'FF000000'}};   // kalın çerçeve yerine standart ince çizgi
  const bd=(t=thin,l=thin,b=thin,r=thin)=>({top:t,left:l,bottom:b,right:r});
  const font=(sz=10,bold=false)=>({name:'Calibri',size:sz,bold});
  const align=(rot=0,wrap=false,h='center',v='middle')=>({horizontal:h,vertical:v,wrapText:wrap,textRotation:rot});
  const GRAY='FFD9D9D9'; // orijinal şablondaki tek renk: giriş/çıkış/gün/tarih hücreleri
  const grayFill={type:'pattern',pattern:'solid',fgColor:{argb:GRAY}};

  /* tek hücre */
  function sc(r,c,val,{sz=10,bold=false,rot=0,wrap=false,fill=false,border=null}={}){
    const cell=ws.getCell(r,c);
    cell.value=(val===undefined||val===null)?null:val;
    cell.font=font(sz,bold);
    cell.alignment=align(rot,wrap);
    if(fill) cell.fill=grayFill;
    cell.border=border||bd();
    return cell;
  }

  /* birleşik blok: stil HER hücreye ayrı yazılır, böylece birleştirmede alt/sağ çerçeve kaybolmaz.
     out = {t,l,b,r} → bloğun DIŞ çerçevesi (iç kenarlar zaten görünmez). */
  function scm(r1,c1,r2,c2,val,{sz=10,bold=false,rot=0,wrap=false,fill=false,out={}}={}){
    const edge=(r,c)=>({
      top:   r===r1 ? out.t : undefined,
      left:  c===c1 ? out.l : undefined,
      bottom:r===r2 ? out.b : undefined,
      right: c===c2 ? out.r : undefined
    });
    for(let r=r1;r<=r2;r++) for(let c=c1;c<=c2;c++){
      sc(r,c,(r===r1&&c===c1)?val:null,{sz,bold,rot,wrap,fill,border:edge(r,c)});
    }
    if(r1===r2&&c1===c2) return;
    if(typeof ws.mergeCellsWithoutStyle==='function'){
      ws.mergeCellsWithoutStyle(r1,c1,r2,c2);           // ExcelJS ≥ 4.2: stili ezmeden birleştir
    }else{                                              // eski sürüm için yedek: stilleri geri yaz
      const snap=[];
      for(let r=r1;r<=r2;r++) for(let c=c1;c<=c2;c++){ const k=ws.getCell(r,c); snap.push([k,JSON.parse(JSON.stringify(k.style))]); }
      ws.mergeCells(r1,c1,r2,c2);
      snap.forEach(([k,s])=>{ k.style=s; });
    }
  }

  // ── Sütun genişlikleri (Orjinal_Sablon.xlsx / Sayfa1 ile birebir) ──
  ws.getColumn(1).width=8.44140625;   // SİCİL NO
  ws.getColumn(2).width=20.5546875;   // ADI SOYADI
  ws.getColumn(3).width=9.109375;     // ÜNVANI
  let cur=4; const dcm={}; const wis=[];
  weeks.forEach(wk=>{
    wk.forEach(d=>{
      dcm[dateKey(d)]={in:cur,out:cur+1};
      ws.getColumn(cur).width=2.0; ws.getColumn(cur+1).width=2.0;
      cur+=2;
    });
    const tC=cur++; const oC=cur++;
    ws.getColumn(tC).width=5.44140625; // Haftalık Çalışma Saati
    ws.getColumn(oC).width=6.109375;   // Haf.Faz. Çalışma Saati
    wis.push({wk,tC,oC});
  });
  const mC=cur++; const sC=cur++;
  ws.getColumn(mC).width=8.109375;    // Aylık Toplam Fazla Çalışma Saati
  ws.getColumn(sC).width=18.6640625;  // İmza
  const totC=cur-1;
  const firstWeekLastCol=wis[0].wk.length*2+3; // ilk haftanın son gün sütunu (D'den itibaren)

  // ── Satır yükseklikleri (orijinal: 27 / 23.25 / 61.5 / 66, sonra 29.25–31.5 dönüşümlü) ──
  const H1=27, H2=23.25, H3=61.5, H4=66, HA=29.25, HP=31.5;
  ws.getRow(1).height=H1;
  ws.getRow(2).height=H2;
  ws.getRow(3).height=H3;
  ws.getRow(4).height=H4;

  // ── Satır 1-2: Kurum adı (A1:C2) + "HAFTALIK ÇALIŞMA SAATİ 40:00:00" banner'ı ──
  const kurumAdi=`${grup==='kadrolu'?'KADROLU':'SÖZLEŞMELİ'} PERSONEL ~ ${(getMudurluk()||'MÜDÜRLÜK').toLocaleUpperCase('tr-TR')}`;
  scm(1,1,2,3,kurumAdi,
      {sz:12,bold:true,wrap:true,out:{t:med,l:med,b:med,r:med}});
  // İlk hafta parçalı olabilir (ayın 1'i Cmt/Paz ise 1-2 gün) → banner en az 12 gün-sütunu genişliğinde.
  const MIN_BANNER_COLS = 12;
  const bannerLastCol = Math.min(totC, Math.max(firstWeekLastCol, 3+MIN_BANNER_COLS));
  scm(1,4,1,Math.max(4,bannerLastCol),'HAFTALIK ÇALIŞMA SAATİ  40:00:00',
      {sz:9,bold:true,wrap:true,out:{t:med,l:med,b:med,r:med}});

  // ── Satır 2: Gün adları (PZT, SALI, ÇAR ...) — 1 gri / 1 beyaz dönüşümlü ──
  wis.forEach(({wk})=>wk.forEach((d,di)=>{
    const dc=dcm[dateKey(d)];
    scm(2,dc.in,2,dc.out,DAY_TR[d.getDay()],{sz:10,rot:90,fill:di%2===0,out:{t:thin,l:thin,b:thin,r:thin}});
  }));

  // ── Satır 3: Ay adı + tarihler ──
  scm(3,1,3,3,`${TR_MONTHS[month-1]}-${year}`,{sz:11,bold:true,wrap:true,out:{t:thin,l:thin,b:thin,r:thin}});
  wis.forEach(({wk})=>wk.forEach((d,di)=>{
    const dc=dcm[dateKey(d)];
    // ExcelJS, Date nesnesini UTC'ye göre seri sayıya çeviriyor; yerel saatte (TR, UTC+3)
    // oluşturulan gece yarısı tarih UTC'ye çevrilince 1 gün geriye kayıyor. Bu yüzden aynı
    // yıl/ay/gün'ü UTC gece yarısı olarak yeniden kuruyoruz.
    const dUTC=new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    scm(3,dc.in,3,dc.out,dUTC,{sz:10,rot:90,wrap:true,fill:di%2===0,out:{t:thin,l:thin,b:thin,r:thin}});
    ws.getCell(3,dc.in).numFmt='dd.mm.yyyy';
  }));

  // ── Satır 4: Sütun başlıkları ──
  ['SİCİL NO','ADI SOYADI','ÜNVANI'].forEach((l,ci)=>{
    sc(4,ci+1,l,{sz:11,bold:true,wrap:true,border:bd(med,med,med,med)});
  });
  wis.forEach(({wk,tC,oC})=>{
    wk.forEach((d,di)=>{
      const dc=dcm[dateKey(d)];
      const fillC=di%2===0;
      sc(4,dc.in ,'GİRİŞ SAATİ',{sz:9,rot:90,wrap:true,fill:fillC, border:bd(med,med,med,thin)});
      sc(4,dc.out,'ÇIKIŞ SAATİ',{sz:9,rot:90,wrap:true,fill:fillC, border:bd(med,thin,med,med)});
    });
    sc(4,tC,'HAFTALIK ÇALIŞMA SAATİ', {sz:9,rot:90,wrap:true,border:bd(med,med,med,med)});
    sc(4,oC,'HAF.FAZ. ÇALIŞMA SAATİ',{sz:9,rot:90,wrap:true,border:bd(med,med,med,med)});
  });
  sc(4,mC,'AYLIK TOPLAM FAZLA ÇALIŞMA SAATİ',{sz:9,bold:true,wrap:true,border:bd(med,med,med,med)});
  sc(4,sC,'İMZA',{sz:9,bold:true,wrap:true,border:bd(med,med,med,med)});

  // ── Veri satırları: her personel için 2 satır (Sabah / Öğleden sonra) ──
  const HR=4;
  assigned.forEach(({person:p,dayMap,leavesSet},pi)=>{
    const rA=HR+1+pi*2, rP=rA+1;
    ws.getRow(rA).height=HA; ws.getRow(rP).height=HP;

    // Sicil: yalnızca baştaki sıfırı olmayan rakamlar sayıya çevrilir (00123 bozulmasın);
    // harf içeren sicil (örn. "tk123456") metin kalır.
    const sicilStr=String(p.sicil==null?'':p.sicil).trim();
    const sicilVal=(/^[1-9]\d{0,14}$/.test(sicilStr)) ? Number(sicilStr) : sicilStr;
    const blkOut={t:med,l:med,b:med,r:thin};
    scm(rA,1,rP,1,sicilVal,       {sz:10,wrap:true,out:blkOut});
    scm(rA,2,rP,2,p.ad||'',       {sz:12,wrap:true,out:blkOut});          // uzun isimler satıra sarar
    scm(rA,3,rP,3,p.unvan||'',    {sz:12,wrap:true,out:blkOut});          // uzun ünvanlar satıra sarar
    if(typeof sicilVal==='number') ws.getCell(rA,1).numFmt='0';

    let mOT=0;
    wis.forEach(({wk,tC,oC})=>{
      let wkT=0,wkOT=0;
      wk.forEach((d,di)=>{
        const dk=dateKey(d); const dc=dcm[dk];
        const isFirst=di===0, isLast=di===wk.length-1;
        const fillC=di%2===0;
        const lft=isFirst?med:thin, rgt=isLast?med:thin;
        const inTop =bd(med, lft, thin, thin);
        const inBot =bd(thin,lft, med,  thin);
        const outTop=bd(med, thin, thin, rgt);
        const outBot=bd(thin,thin, med,  rgt);
        const isH=isHolidayDate(d,holidays); const isL=leavesSet.has(dk);
        const isWE=isWeekend(d); const ot=dayMap[dk]||0;
        if(isH||isL){
          // 2×2 birleşik blok; yazı dar sütuna sığsın diye DİKEY
          scm(rA,dc.in,rP,dc.out,'İzin/Tatil',{sz:8,rot:90,fill:fillC,out:{t:med,l:lft,b:med,r:rgt}});
        }else if(isWE){
          if(ot>0&&weOK){
            const mOT2=Math.min(ot,180); const aft=ot-mOT2;
            const ao=addMin('09:00',mOT2); const po=aft>0?addMin('13:00',aft):'13:00';
            sc(rA,dc.in,'09:00',{sz:9,rot:90,fill:fillC,border:inTop}); sc(rA,dc.out,ao,{sz:9,rot:90,fill:fillC,border:outTop});
            sc(rP,dc.in,'13:00',{sz:9,rot:90,fill:fillC,border:inBot}); sc(rP,dc.out,po,{sz:9,rot:90,fill:fillC,border:outBot});
            wkT+=ot; wkOT+=ot;
          }else{
            sc(rA,dc.in,'-',{sz:8,fill:fillC,border:inTop}); sc(rA,dc.out,'-',{sz:8,fill:fillC,border:outTop});
            sc(rP,dc.in,'-',{sz:8,fill:fillC,border:inBot}); sc(rP,dc.out,'-',{sz:8,fill:fillC,border:outBot});
          }
        }else{
          const aus=ot>0?addMin('17:00',ot):'17:00';
          sc(rA,dc.in,'08:00',{sz:9,rot:90,fill:fillC,border:inTop}); sc(rA,dc.out,'12:00',{sz:9,rot:90,fill:fillC,border:outTop});
          sc(rP,dc.in,'13:00',{sz:9,rot:90,fill:fillC,border:inBot}); sc(rP,dc.out,aus, {sz:9,rot:90,fill:fillC,border:outBot});
          wkT+=NORMAL_DAY_MIN+ot; wkOT+=ot;
        }
      });
      mOT+=wkOT;
      scm(rA,tC,rP,tC,m2hms(wkT), {sz:10,rot:90,wrap:true,out:{t:med,l:thin,b:med,r:thin}});
      scm(rA,oC,rP,oC,m2hm(wkOT), {sz:10,                out:{t:med,l:thin,b:med,r:med}});
    });
    scm(rA,mC,rP,mC,m2hms(mOT),{sz:10,bold:true,out:{t:med,l:thin,b:med,r:thin}});
    scm(rA,sC,rP,sC,'',        {sz:10,          out:{t:med,l:thin,b:med,r:med}});
  });

  // ── Alt imza bloğu: DÜZENLEYEN / KONTROL EDEN / ONAYLAYAN ──
  const lastDataRow=HR+assigned.length*2;
  const footerLabelRow=lastDataRow+2;   // 1 satır boşluk bırak
  const footerLineRow=footerLabelRow+1; // imza için boş satır
  const HF1=30, HF2=40, HGAP=15;
  ws.getRow(footerLabelRow).height=HF1;
  ws.getRow(footerLineRow).height=HF2;
  const thirdW=Math.max(1,Math.floor((totC-3)/3));
  const spans=[[4,3+thirdW],[4+thirdW,3+2*thirdW],[4+2*thirdW,totC]];
  ['DÜZENLEYEN','KONTROL EDEN','ONAYLAYAN'].forEach((lbl,i)=>{
    const c1=Math.min(spans[i][0],totC), c2=Math.max(spans[i][1],c1);
    scm(footerLabelRow,c1,footerLabelRow,c2,lbl,{sz:11,bold:true,wrap:true,out:{}});
  });

  /* ══════════════════════════════════════════════════════════
     YAZDIRMA AYARLARI — A4 YATAY, "Tüm Sütunları Bir Sayfaya Sığdır"
     ══════════════════════════════════════════════════════════
     Excel'deki karşılığı: Sayfa Düzeni → Ölçek → "Tüm Sütunları Bir Sayfaya Sığdır"
     (Genişlik: 1 sayfa, Yükseklik: Otomatik). Dosyada: fitToPage + fitToWidth=1 + fitToHeight=0. */
  const PAPER_W=11.69, PAPER_H=8.27;                         // A4 yatay (inç)
  const MARG={left:.1,right:.1,top:.3,bottom:.4,header:.12,footer:.15};

  ws.pageSetup.orientation='landscape';
  ws.pageSetup.paperSize=9;                                  // A4

  ws.pageSetup.horizontalCentered=true;
  ws.pageSetup.margins=MARG;
  ws.pageSetup.printTitlesRow='1:4';                         // her sayfada başlık satırları
  const sonSutunHarfi=ws.getColumn(totC).letter;
  ws.pageSetup.printArea=`A1:${sonSutunHarfi}${footerLineRow}`;
  ws.headerFooter={
    oddFooter:'&L&8Emvalis — Fazla Mesai Dağıtım Sistemi&C&8Sayfa &P / &N&R&8&D'
  };

  // ── Sayfa sonları: kişi blokları (2 satır) asla ikiye bölünmesin, imza bloğu son sayfaya sığsın ──
  // Excel'in uygulayacağı ölçeği yalnızca sayfa sonu yerlerini tahmin etmek için hesaplıyoruz.
  const colPx=w=>Math.trunc(((256*w+Math.trunc(128/7))/256)*7);   // sütun genişliği → piksel
  let natPx=0; for(let c=1;c<=totC;c++) natPx+=colPx(ws.getColumn(c).width);
  const natIn=natPx/96;
  const usableW=PAPER_W-MARG.left-MARG.right;
  const estScale=Math.max(25,Math.min(100,Math.floor(usableW/natIn*100*.88)));
  ws.pageSetup.fitToPage=true;       // Tüm sütunları bir sayfaya sığdır
  ws.pageSetup.fitToWidth=1;         // genişlik: 1 sayfa
  ws.pageSetup.fitToHeight=0;        // yükseklik: otomatik

  const hdrPt=H1+H2+H3+H4, personPt=HA+HP, footerPt=HGAP+HF1+HF2;
  const availPt=(PAPER_H-MARG.top-MARG.bottom)*72/(estScale/100)*.97;
  const cap    =Math.max(1,Math.floor((availPt-hdrPt)/personPt));
  const capLast=Math.max(1,Math.floor((availPt-hdrPt-footerPt)/personPt));
  const pages=[]; let remaining=assigned.length;
  while(remaining>0){
    if(remaining<=capLast){ pages.push(remaining); remaining=0; }
    else if(remaining<=cap){                                  // kişiler sığar ama imza bloğu sığmaz → dengeli böl
      const first=Math.ceil(remaining/2); pages.push(first); pages.push(remaining-first); remaining=0;
    }else{ pages.push(cap); remaining-=cap; }
  }
  let acc=0;
  pages.slice(0,-1).forEach(n=>{ acc+=n; ws.getRow(HR+acc*2).addPageBreak(); });

  // ── Ekran görünümü: SABİT BÖLME YOK — sağa/sola/aşağı kaydırınca tüm tablo birlikte kayar ──
  ws.views=[{state:'normal',showGridLines:true}];

  if(returnWs) return ws;   // PDF için: dosyayı indirmeden sayfayı döndür
  const buf=await wb.xlsx.writeBuffer();
  downloadFile(new Uint8Array(buf),`fazla_mesai_${grup}_${year}_${pad(month)}.xlsx`,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s);});}