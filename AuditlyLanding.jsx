import React, { useState, useEffect } from 'react';

// --- Mock Data ---
const CATEGORIES = [
  { id: 'Mobil', name: 'Mobil' },
  { id: 'Hodinky', name: 'Hodinky' },
  { id: 'Slúchadlá', name: 'Slúchadlá' },
  { id: 'Tablet', name: 'Tablet' },
  { id: 'Konzola', name: 'Konzola' },
  { id: 'Notebook', name: 'Notebook' },
];

const BRANDS = {
  Mobil: ['Apple', 'Samsung', 'Google', 'Xiaomi'],
  Hodinky: ['Apple', 'Samsung', 'Garmin'],
  Slúchadlá: ['Apple', 'Sony', 'Bose'],
  Tablet: ['Apple', 'Samsung', 'Microsoft'],
  Konzola: ['Sony', 'Microsoft', 'Nintendo'],
  Notebook: ['Apple', 'MSI', 'Acer', 'ASUS', 'Razer', 'Lenovo', 'Dell'],
};

const MODELS = {
  Apple: ['iPhone 17 Pro Max', 'iPhone 17 Pro', 'iPhone 17', 'iPhone 16 Pro Max', 'iPhone 15 Pro', 'iPhone 13 Pro', 'iPad Pro 12.9 M2', 'iPad Air 13 M2', 'iPad Air 5 M1', 'MacBook Air M2', 'MacBook Pro M3', 'Apple Watch Ultra 2', 'AirPods Pro (2nd Gen)'],
  Samsung: ['S24 Ultra', 'S23 Ultra', 'Tab S9 Ultra', 'Galaxy Watch 6'],
  Sony: ['PS5 Disk Edition', 'PS5 Digital', 'PS4 Pro', 'WH-1000XM5'],
  Microsoft: ['Xbox Series X', 'Xbox Series S', 'Surface Pro 9'],
  Nintendo: ['Nintendo Switch OLED', 'Nintendo Switch Lite'],
  // ... rest
};

const CAPACITIES = {
  'iPhone 17 Pro Max': ['256 GB', '512 GB', '1 TB'],
  'iPhone 17 Pro': ['128 GB', '256 GB', '512 GB', '1 TB'],
  'iPhone 17': ['128 GB', '256 GB', '512 GB'],
  'iPhone 16 Pro Max': ['256 GB', '512 GB', '1 TB'],
  'iPhone 15 Pro': ['128 GB', '256 GB', '512 GB', '1 TB'],
  'iPhone 13 Pro': ['128 GB', '256 GB', '512 GB', '1 TB'],
  'iPad Pro 12.9 M2': ['128 GB', '256 GB', '512 GB', '1 TB', '2 TB'],
  'iPad Air 13 M2': ['128 GB', '256 GB', '512 GB', '1 TB'],
  'iPad Air 5 M1': ['64 GB', '256 GB'],
  'PS5 Disk Edition': ['825 GB', '1 TB'],
  'MacBook Air M2': ['256 GB', '512 GB', '1 TB', '2 TB'],
};

// --- Components ---

const Navbar = () => (
  <nav className="flex items-center justify-between px-8 py-6 bg-transparent">
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-blue-600 rounded-lg shadow-lg flex items-center justify-center">
        <span className="text-white font-bold text-xl">A</span>
      </div>
      <span className="text-xl font-bold tracking-tight text-slate-900">AUDITLY.IO</span>
    </div>
    <div className="hidden md:flex gap-8 text-sm font-medium text-slate-600">
      <a href="#" className="hover:text-violet-600 transition-colors">Ako to funguje</a>
      <a href="#" className="hover:text-violet-600 transition-colors">Cenník</a>
      <a href="#" className="hover:text-violet-600 transition-colors">Pre firmy</a>
    </div>
    <button className="px-5 py-2.5 bg-slate-900 text-white rounded-full text-sm font-semibold hover:bg-slate-800 transition-all shadow-sm">
      Vyskúšať zadarmo
    </button>
  </nav>
);

const SkeletonLoader = () => (
  <div className="w-full max-w-4xl mx-auto p-8 bg-white/80 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl animate-pulse">
    <div className="h-8 bg-slate-200 rounded-lg w-1/3 mb-6"></div>
    <div className="space-y-4">
      <div className="h-4 bg-slate-100 rounded w-full"></div>
      <div className="h-4 bg-slate-100 rounded w-5/6"></div>
      <div className="h-4 bg-slate-100 rounded w-4/6"></div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-32 bg-slate-50 rounded-2xl border border-slate-100"></div>
      ))}
    </div>
  </div>
);

const AuditReport = ({ reportData, capacity }) => {
  const { report } = reportData;
  const [showFullModal, setShowFullModal] = useState(false);
  const [checkedItems, setCheckedItems] = useState({});
  
  const commonFaults = typeof report.common_faults === 'string' 
    ? JSON.parse(report.common_faults) 
    : (report.common_faults || []);

  const reportParagraphs = (report.full_report || "").split('\n\n').filter(p => p.trim());

  // Calculate dynamic risk score based on faults count
  const riskScore = Math.max(10, 100 - (commonFaults.length * 15));
  const scoreColor = riskScore > 70 ? 'text-emerald-500' : riskScore > 40 ? 'text-amber-500' : 'text-red-500';

  const toggleCheck = (idx) => {
    setCheckedItems(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <>
      <div className="w-full max-w-4xl mx-auto p-8 bg-white/90 backdrop-blur-2xl rounded-[2.5rem] border border-white shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700 text-left relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-500/10 to-blue-500/10 blur-3xl -mr-16 -mt-16"></div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 bg-violet-600 text-white text-[10px] font-black rounded-full uppercase tracking-[0.2em]">
                Expert Audit
              </span>
              <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.64.304 1.25.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                <span className="text-[10px] font-black tracking-wider">VERIFIED BY AI</span>
              </div>
            </div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">
              {report.name} <span className="text-slate-400 font-normal">{capacity}</span>
            </h2>
          </div>
          <div className="flex gap-4">
            <div className="bg-slate-50 px-6 py-4 rounded-3xl border border-slate-100 text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Safety Score</p>
              <p className={`text-3xl font-black ${scoreColor}`}>{riskScore}%</p>
            </div>
            <div className="bg-slate-900 px-6 py-4 rounded-3xl text-right min-w-[140px]">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-white/50">Odhad Ceny</p>
              <p className="text-2xl font-black text-white">
                {report.base_price_recommended ? `${Number(report.base_price_recommended).toFixed(0)} €` : 'Trhová'}
            </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* Hardware Card */}
          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Hardvér
            </p>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-medium">Panel</p>
                <p className="text-sm font-bold text-slate-800 line-clamp-1">{report.display_tech || 'Standard'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-medium">Materiál</p>
                  <p className="text-sm font-bold text-slate-800">{report.frame_material || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Interactive Risks Checklist */}
          <div className="p-6 bg-amber-50/50 rounded-3xl border border-amber-100 md:col-span-2">
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Interaktívny Checklist Chýb
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {commonFaults.map((risk, i) => (
                <div 
                  key={i} 
                  onClick={() => toggleCheck(i)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${
                    checkedItems[i] ? 'bg-white border-amber-500 shadow-sm' : 'bg-white/40 border-amber-100 hover:border-amber-300'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    checkedItems[i] ? 'bg-amber-500 border-amber-500' : 'border-amber-200'
                  }`}>
                    {checkedItems[i] && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <span className={`text-[11px] font-bold ${checkedItems[i] ? 'text-slate-900' : 'text-slate-600'}`}>
                    {(risk || "").split(':')[0].replace(/⚠️/g, '')}
                  </span>
          </div>
              ))}
            </div>
          </div>
        </div>

        <button 
          onClick={() => setShowFullModal(true)}
          className="w-full py-6 bg-slate-900 text-white rounded-[1.5rem] font-bold text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-3 group shadow-xl shadow-slate-200"
        >
          <span>OTVORIŤ FORENZNÚ ANALÝZU</span>
          <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>

      {/* MODAL WINDOW (Master Report) */}
      {showFullModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowFullModal(false)}></div>
          
          <div className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
            {/* Modal Header */}
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Master Audit Report</h3>
                  <p className="text-xs font-bold text-slate-400 tracking-widest uppercase">Technická dokumentácia & Riziká</p>
                </div>
              </div>
              <button 
                onClick={() => setShowFullModal(false)}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-8 md:p-12 scroll-smooth">
              <div className="max-w-3xl mx-auto space-y-12">
                
                {/* 1. Header Detail */}
                <div className="text-center space-y-4">
                  <h1 className="text-5xl font-black text-slate-900">{report.name}</h1>
                  <p className="text-slate-500 font-medium">Konfigurácia: {capacity} | Status: Verifikované v Auditly databáze</p>
                  <div className="flex justify-center gap-4 pt-4">
                    <div className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-100">
                      Top Stav Odporúčaný
                    </div>
                    <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-100">
                      Odborný Odhad Ceny
                    </div>
                  </div>
                </div>

                {/* 2. Structured Sections from DB */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Technické Špecifikácie</h4>
                    <ul className="space-y-4">
                      <li className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <span className="text-sm font-bold text-slate-500">Displej</span>
                        <span className="text-sm font-black text-slate-900">{report.display_tech}</span>
                      </li>
                      <li className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <span className="text-sm font-bold text-slate-500">Rám / Telo</span>
                        <span className="text-sm font-black text-slate-900">{report.frame_material}</span>
                      </li>
                      <li className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <span className="text-sm font-bold text-slate-500">Kapacita</span>
                        <span className="text-sm font-black text-slate-900">{capacity}</span>
                      </li>
                    </ul>
                  </div>

                  <div className="p-8 bg-amber-50/50 rounded-[2rem] border border-amber-100">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-6">Rozšírený Checklist Chýb</h4>
                    <ul className="space-y-3">
                      {commonFaults.map((fault, idx) => (
                        <li key={idx} className="text-xs font-bold text-slate-700 flex gap-3">
                          <span className="text-amber-500 font-black">!</span> {fault}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* 3. The Big Report Text */}
                <div className="p-10 bg-slate-50/50 rounded-[3rem] border border-slate-100 relative">
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8 text-center">Hĺbková Analýza (Forenzný Report)</h4>
                   <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed font-medium">
                      {reportParagraphs.map((p, i) => (
                        <p key={i} className="mb-6 whitespace-pre-wrap">{p}</p>
                      ))}
                   </div>
                </div>

                {/* 4. Negotiation Full Tips */}
                <div className="p-10 bg-gradient-to-br from-violet-600 to-blue-600 rounded-[3rem] text-white">
                   <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-6">Expertizná Vyjednávacia Stratégia</h4>
                   <p className="text-lg font-bold leading-relaxed italic">
                      "{report.negotiation_tips}"
                   </p>
                </div>

                {/* Footer of modal */}
                <div className="py-12 border-t border-slate-100 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Tento report bol vygenerovaný systémom Auditly.io na základe expertných dát.</p>
                  <button 
                    onClick={() => setShowFullModal(false)}
                    className="px-12 py-5 bg-slate-100 text-slate-900 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all"
                  >
                    Zatvoriť dokument
                  </button>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default function AuditlyLanding() {
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [capacity, setCapacity] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    if (!category || !model) return;
    setLoading(true);
    setReport(null);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/api/audit/report?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}`);
      const data = await response.json();
      
      if (data.ok) {
        setReport({ ...data, capacity });
      } else {
        setError(data.error || 'Nepodarilo sa načítať audit.');
      }
    } catch (err) {
      setError('Chyba spojenia so serverom.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FD] font-sans text-slate-900 selection:bg-violet-100">
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-violet-200/40 blur-[120px] rounded-full"></div>
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-blue-200/30 blur-[100px] rounded-full"></div>
      </div>

      <div className="relative z-10">
        <Navbar />

        <main className="px-6 pt-12 pb-24 max-w-7xl mx-auto text-center">
          {/* Hero Section */}
          <div className="mb-16">
            <span className="inline-block px-4 py-1.5 mb-6 text-[11px] font-bold tracking-widest text-violet-600 uppercase bg-violet-50 rounded-full ring-1 ring-violet-200">
              Expertíza na dosah ruky
            </span>
            <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 text-slate-900">
              Nekupuj <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-blue-600">mačku vo vreci</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
              Auditlyio analyzuje bazárovú elektroniku. Získajte hĺbkový technický report a overte si férovú cenu skôr, než zaplatíte.
            </p>
          </div>

          {/* Audit Tool Card - Multi-step Selection */}
          <div className="max-w-4xl mx-auto mb-20">
            <div className="bg-white p-4 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                
                {/* 1. Kategória */}
                <div className="flex flex-col items-start px-6 py-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">1. Kategória</label>
                  <select 
                    value={category}
                    onChange={(e) => { 
                      setCategory(e.target.value); 
                      setBrand(''); 
                      setModel(''); 
                      setCapacity(''); 
                    }}
                    className="w-full bg-transparent outline-none text-slate-700 font-bold appearance-none cursor-pointer"
                  >
                    <option value="" disabled>Vyber...</option>
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {/* 2. Značka */}
                <div className="flex flex-col items-start px-6 py-2 border-t md:border-t-0 md:border-l border-slate-100">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">2. Značka</label>
                  <select 
                    value={brand}
                    onChange={(e) => { 
                      setBrand(e.target.value); 
                      setModel(''); 
                      setCapacity(''); 
                    }}
                    disabled={!category}
                    className="w-full bg-transparent outline-none text-slate-700 font-bold appearance-none cursor-pointer disabled:opacity-20"
                  >
                    <option value="" disabled>Vyber...</option>
                    {category && BRANDS[category].map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                {/* 3. Model */}
                <div className="flex flex-col items-start px-6 py-2 border-t md:border-t-0 md:border-l border-slate-100">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">3. Model</label>
                  <select 
                    value={model}
                    onChange={(e) => { 
                      setModel(e.target.value); 
                      setCapacity(''); 
                    }}
                    disabled={!brand}
                    className="w-full bg-transparent outline-none text-slate-700 font-bold appearance-none cursor-pointer disabled:opacity-20"
                  >
                    <option value="" disabled>Vyber...</option>
                    {brand && MODELS[brand] && MODELS[brand].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                {/* 4. Kapacita */}
                <div className="flex flex-col items-start px-6 py-2 border-t md:border-t-0 md:border-l border-slate-100">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">4. Kapacita</label>
                  <select 
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    disabled={!model || !CAPACITIES[model]}
                    className="w-full bg-transparent outline-none text-slate-700 font-bold appearance-none cursor-pointer disabled:opacity-20"
                  >
                    <option value="" disabled>Vyber...</option>
                    {model && CAPACITIES[model] && CAPACITIES[model].map(cap => <option key={cap} value={cap}>{cap}</option>)}
                    {!CAPACITIES[model] && model && <option value="standard">Standard</option>}
                  </select>
                </div>

              </div>

              <div className="mt-4 pt-4 border-t border-slate-50 flex justify-center">
                <button 
                  onClick={handleGenerate}
                  disabled={!model || loading}
                  className="w-full md:w-auto px-12 py-4 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold rounded-2xl hover:shadow-xl hover:shadow-violet-200 transition-all active:scale-95 disabled:grayscale disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {loading && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                  {loading ? 'Analyzujem databázu...' : 'Vygenerovať Expertny Audit'}
                </button>
              </div>
            </div>
            
            {/* Trust Badges */}
            <div className="flex flex-wrap justify-center items-center gap-8 mt-10 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                <span className="text-[10px] font-black uppercase tracking-widest">100% Bezpečné</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                <span className="text-[10px] font-black uppercase tracking-widest">AI Poháňané</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                <span className="text-[10px] font-black uppercase tracking-widest">Expertne Overené</span>
              </div>
            </div>
          </div>

          {/* Results Area */}
          <div className="min-h-[400px]">
            {loading && <SkeletonLoader />}
            {error && (
              <div className="p-8 bg-red-50 text-red-600 rounded-[2rem] border border-red-100 max-w-2xl mx-auto">
                <p className="font-bold">Chyba</p>
                <p className="text-sm">{error}</p>
                <button 
                  onClick={() => setError(null)}
                  className="mt-4 text-xs font-bold underline uppercase tracking-widest"
                >
                  Skúsiť znova
                </button>
              </div>
            )}
            {report && !loading && <AuditReport reportData={report} capacity={capacity} />}
            
            {!loading && !report && (
              <div className="py-20 border-2 border-dashed border-slate-200 rounded-[3rem] text-slate-300">
                <p className="text-sm font-medium">Zadajte model zariadenia pre začatie auditu</p>
              </div>
            )}
          </div>
        </main>

        <footer className="py-12 text-center text-slate-400 text-xs border-t border-slate-100">
          <p>© 2026 Auditlyio. Všetky práva vyhradené.</p>
        </footer>
      </div>
    </div>
  );
}
