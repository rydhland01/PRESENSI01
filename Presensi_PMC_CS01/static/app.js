/* app.js — client for Flask backend */
/* meniru fungsionalitas versi JS lama, tapi kirim data ke /api/... */

document.addEventListener('DOMContentLoaded', ()=> {
  const saved = localStorage.getItem('pmc_theme') || 'light';
  applyTheme(saved);
  document.querySelectorAll('#themeToggle').forEach(btn => btn.addEventListener('click', ()=>{
    const next = document.body.classList.contains('dark') ? 'light' : 'dark';
    applyTheme(next);
  }));
  setupAuthUI();
});

function applyTheme(t){
  document.body.classList.remove('light','dark');
  document.body.classList.add(t);
  localStorage.setItem('pmc_theme', t);
}

function setupAuthUI(){
  fetch('/api/whoami').then(r=>r.json()).then(j=>{
    if(j.user){
      if(!location.pathname.endsWith('/dashboard')) location.href = '/dashboard';
    } else {
      attachIndexHandlers();
    }
  });
}

function attachIndexHandlers(){
  const btnLogin = document.getElementById('btnLogin');
  const btnRegister = document.getElementById('btnRegister');
  const saveRegister = document.getElementById('saveRegister');
  const cancelRegister = document.getElementById('cancelRegister');
  const popup = document.getElementById('registerPopup');

  btnLogin?.addEventListener('click', handleLogin);
  ['loginUser','loginPass'].forEach(id=>{
    document.getElementById(id)?.addEventListener('keydown', e=>{
      if(e.key === 'Enter'){ e.preventDefault(); handleLogin(); }
    });
  });

  btnRegister?.addEventListener('click', ()=> popup.classList.remove('hidden'));
  cancelRegister?.addEventListener('click', ()=> popup.classList.add('hidden'));

  saveRegister?.addEventListener('click', async ()=>{
    const u = document.getElementById('newUsername').value.trim();
    const p = document.getElementById('newPassword').value.trim();
    if(!u||!p) return alert('Isi semua kolom!');
    const res = await fetch('/api/register', {
      method: 'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({username:u,password:p})
    });
    const j = await res.json();
    if(res.ok && j.ok){ alert('Akun berhasil dibuat! Silakan login.'); popup.classList.add('hidden'); }
    else alert(j.error || 'Gagal daftar: ' + (j.msg||''));
  });
}

async function handleLogin(){
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value.trim();
  if(!user||!pass) return alert('Isi username & password.');
  const res = await fetch('/api/login', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({username:user,password:pass})
  });
  const j = await res.json();
  if(res.ok && j.ok){
    showToast(`Selamat datang, ${j.user}`);
    setTimeout(()=> location.href = '/dashboard', 600);
  } else {
    alert(j.error || 'Login gagal');
  }
}

if(location.pathname.endsWith('dashboard')){
  initDashboard();
}

function initDashboard(){
  fetch('/api/whoami').then(r=>r.json()).then(j=>{
    if(!j.user) location.href = '/';
  });

  const clockTop = document.getElementById('clockTop');
  setInterval(()=>{ 
    if(clockTop) clockTop.textContent = new Date().toLocaleString('id-ID',{
      weekday:'long', hour:'2-digit',minute:'2-digit',second:'2-digit'
    });
  },1000);

  document.getElementById('logoutBtn')?.addEventListener('click', async ()=>{
    await fetch('/api/logout', {method:'POST'});
    location.href = '/';
  });

  const video=document.getElementById('video'),
        canvas=document.getElementById('canvas'),
        thumb=document.getElementById('thumb');
  let stream=null;

  async function startCamera(){ 
    try{ 
      stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false}); 
      video.srcObject=stream; 
    }catch(e){ alert('Tidak bisa akses kamera: '+e.message); } 
  }
  function stopCamera(){ 
    if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null; } 
  }
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) stopCamera(); });
  document.getElementById('startCameraBtn')?.addEventListener('click',startCamera);
  document.getElementById('stopCameraBtn')?.addEventListener('click',stopCamera);

  const coordsBox = document.getElementById("coords");
  let currentCoords = { lat: "", lon: "" };
  function getLocation() {
    if (!navigator.geolocation) {
      if (coordsBox) coordsBox.textContent = "Geolocation tidak didukung.";
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        currentCoords = { lat: latitude.toFixed(4), lon: longitude.toFixed(4) };
        if (coordsBox) coordsBox.textContent = `Koordinat: ${currentCoords.lat}, ${currentCoords.lon}`;
      },
      () => {
        if (coordsBox) coordsBox.textContent = "Menunggu izin lokasi...";
      }
    );
  }
  getLocation();
  setInterval(getLocation, 15000);

  function hhmmssFromSeconds(sec){
    const h=Math.floor(sec/3600),
          m=Math.floor((sec%3600)/60),
          s=sec%60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  function diffSeconds(t1,t2){
    const [h1,m1,s1]=t1.split(':').map(Number),
          [h2,m2,s2]=t2.split(':').map(Number);
    let a=h1*3600+m1*60+s1,b=h2*3600+m2*60+s2,d=b-a;
    if(d<0)d+=86400;
    return d;
  }

  function captureWithTimestamp(){
    if(!stream) return null;
    canvas.width=video.videoWidth; 
    canvas.height=video.videoHeight;
    const ctx=canvas.getContext('2d'); 
    ctx.drawImage(video,0,0,canvas.width,canvas.height);
    const now=new Date(),
          hariList=["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
    const line1=`${hariList[now.getDay()]}, ${now.toLocaleDateString("id-ID")} — ${now.toLocaleTimeString("id-ID",{hour12:false})} WIB`;
    const gpsText=currentCoords.lat && currentCoords.lon?`Lat: ${currentCoords.lat}, Lon: ${currentCoords.lon}`:"Lokasi belum tersedia";
    ctx.font="16px Poppins"; 
    const pad=10, w=Math.max(ctx.measureText(line1).width,ctx.measureText(gpsText).width)+pad*2, h=52, x=12, y=canvas.height-h-12;
    ctx.fillStyle="rgba(0,0,0,0.6)";
    ctx.fillRect(x,y,w,h);
    ctx.fillStyle="#fff";
    ctx.fillText(line1,x+pad,y+24); 
    ctx.fillText(gpsText,x+pad,y+46);
    return canvas.toDataURL("image/jpeg",0.9);
  }

  document.getElementById('captureBtn')?.addEventListener('click',()=>{
    const d=captureWithTimestamp(); 
    if(d){ thumb.src=d; showToast('Preview siap'); }
  });

  let data = [];
  async function loadRekap(){
    const res = await fetch('/api/rekap');
    const j = await res.json();
    if(j.ok){ data = j.data || []; render(); }
  }

  function render(){
    const tbody=document.getElementById('tbody'); tbody.innerHTML='';
    const totals={};
    for(const r of data.slice().reverse()){
      const tr=document.createElement('tr');
      const lokasi=r.lat&&r.lon?`<small>📍 ${r.lat}, ${r.lon}</small>`:'';
      tr.innerHTML=`
        <td>${r.nama}</td>
        <td>${r.keterangan||''}</td>
        <td>${r.datang||''}</td>
        <td>${r.fotoDatang?`<img src="${r.fotoDatang}" style="width:80px;height:60px;border-radius:6px">`:''}</td>
        <td>${r.pulang||''}</td>
        <td>${r.fotoPulang?`<img src="${r.fotoPulang}" style="width:80px;height:60px;border-radius:6px">`:''}</td>
        <td>${r.lama||''}</td>
        <td>${lokasi}</td>
        <td><button class="btn-ghost deleteBtn" data-nama="${r.nama}" data-tanggal="${r.tanggal}">🗑</button></td>`;
      tbody.appendChild(tr);
      if(r.lamaSeconds) totals[r.nama]=(totals[r.nama]||0)+r.lamaSeconds;
    }
    const summary=document.getElementById('rekapSummary');
    summary.innerHTML='';
    for(const [name,sec] of Object.entries(totals)){
      const p=document.createElement('div'); 
      p.textContent=`${name}: ${hhmmssFromSeconds(sec)}`; 
      summary.appendChild(p);
    }

    document.querySelectorAll('.deleteBtn').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const nama=btn.dataset.nama, tanggal=btn.dataset.tanggal;
        if(!confirm(`Yakin ingin hapus data ${nama} tanggal ${tanggal}?`)) return;
        const res = await fetch('/api/delete_absen', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({nama, tanggal})
        });
        const j = await res.json();
        alert(j.msg || j.error);
        if(res.ok && j.ok) loadRekap();
      });
    });
  }

  loadRekap();

  async function doAbsen(type){
    const nama=document.getElementById('nama').value, ket=document.getElementById('keterangan').value;
    if(!nama) return alert('Pilih nama terlebih dahulu!');
    if(!stream) return alert('Nyalakan kamera terlebih dahulu!');
    const foto=captureWithTimestamp(); if(!foto) return alert('Gagal mengambil foto.');
    const time=new Date().toLocaleTimeString('id-ID',{hour12:false});
    const date=new Date().toLocaleDateString('id-ID');
    const payload = {
      nama, type, keterangan: ket, foto, lat: currentCoords.lat, lon: currentCoords.lon, time, date
    };
    const res = await fetch('/api/absen', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const j = await res.json();
    if(res.ok && j.ok){
      showToast('Absen tersimpan');
      await loadRekap();
    } else {
      alert(j.error || 'Gagal menyimpan absen');
    }
  }

  document.getElementById('absenDatang')?.addEventListener('click', ()=>doAbsen('datang'));
  document.getElementById('absenPulang')?.addEventListener('click', ()=>doAbsen('pulang'));

  document.getElementById('menuBtn')?.addEventListener('click', () => document.getElementById('menuPopup').classList.toggle('hidden'));
  document.getElementById('globalMenuBtn')?.addEventListener('click', () => document.getElementById('globalMenuPopup').classList.toggle('hidden'));
  document.getElementById('globalListNama')?.addEventListener('click', async () => {
    const res = await fetch('/api/rekap'); const j = await res.json();
    let html = '<table class="table"><thead><tr><th>Nama</th><th>Tanggal</th><th>Lama</th></tr></thead><tbody>';
    (j.data||[]).forEach(r => html += `<tr><td>${r.nama}</td><td>${r.tanggal}</td><td>${r.lama||'-'}</td></tr>`);
    html += '</tbody></table>';
    if(!(j.data||[]).length) html = '<p class="kv">Belum ada data.</p>';
    showPopup('📋 Rekap', html);
  });

  document.getElementById('globalInfoPembuat')?.addEventListener('click', () => {
    const html = `<p><b>Dikembangkan oleh:</b></p>
      <ul style="margin-top:6px;">
        <li>Riyadh — Frontend & Desain UI</li>
        <li>Rydhland — GPS, Data & Watermark</li>
      </ul>
      <p style="margin-top:10px;font-size:13px;color:var(--muted);">Versi Sistem: <b>v3.3</b></p>`;
    showPopup('👤 Info Pembuat', html);
  });

  document.getElementById('globalTujuan')?.addEventListener('click', () => {
    const html = `<p>Website ini dibuat untuk mendukung <b>presensi internal PMC CS-01</b> secara <b>offline</b> dengan fitur foto dan GPS.</p>`;
    showPopup('🎯 Tujuan Pembuatan Web', html);
  });

  function showPopup(title, content){
    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.innerHTML = `<div class="popup-card"><h3>${title}</h3><div style="max-height:320px;overflow:auto;margin-top:6px;">${content}</div>
      <div style="text-align:right;margin-top:12px;"><button class="btn-ghost" id="closePopup">Tutup</button></div></div>`;
    document.body.appendChild(popup);
    document.getElementById('closePopup').addEventListener('click', ()=>popup.remove());
  }
}

function showToast(msg){ 
  const d=document.createElement('div'); 
  d.textContent=msg; 
  d.style.cssText="position:fixed;right:18px;bottom:18px;background:var(--accent);color:#fff;padding:10px 14px;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.2);z-index:999"; 
  document.body.appendChild(d); 
  setTimeout(()=>d.remove(),2500); 
}
