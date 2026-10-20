/* ══════════════════════════════════════════════════════════
   Emvalis v3.4 — app.export.js  (5/6)
   İçerik : XLSX (Excel) rapor dışa aktarımı — ExcelJS ile
            tam formatlı fazla mesai çizelgesi üretimi
   Not    : app.core.js ve app.distribution.js'ten sonra yüklenmelidir
            (state.lastResult kullanır).

   ══════════════════════════════════════════════════════════ */
'use strict';

/* ── XLSX EXPORT ─────────────────────────────────────────── */
async function exportExcel() {
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

async function _generateXLSX({assigned,allDates,holidays,year,month,grup,weOK}) {
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

  const buf=await wb.xlsx.writeBuffer();
  downloadFile(new Uint8Array(buf),`fazla_mesai_${grup}_${year}_${pad(month)}.xlsx`,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s);});}