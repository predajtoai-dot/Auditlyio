import React, { useState, useEffect } from 'react';

// --- Mock Data ---
const CATEGORIES = [
  { id: 'mobile', name: 'Mobil' },
  { id: 'console', name: 'Konzola' },
  { id: 'laptop', name: 'Laptop' },
];

const MODELS = {
  mobile: ['iPhone 13 Pro', 'iPhone 15', 'Samsung S23 Ultra'],
  console: ['PS5 Disk Edition', 'Xbox Series X', 'Nintendo Switch OLED'],
  laptop: ['MacBook Air M2', 'MacBook Pro M3', 'Dell XPS 13'],
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

const AuditReport = ({ product }) => (
  <div className="w-full max-w-4xl mx-auto p-8 bg-white/90 backdrop-blur-2xl rounded-3xl border border-white shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className="px-3 py-1 bg-violet-100 text-violet-700 text-xs font-bold rounded-full uppercase tracking-wider">
            Technický Report
          </span>
          <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.64.304 1.25.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
            <span className="text-[10px] font-bold">CERTIFIKOVANÉ</span>
          </div>
        </div>
        <h2 className="text-3xl font-bold text-slate-900">{product}</h2>
      </div>
      <div className="text-right">
        <p className="text-sm text-slate-500 mb-1">Odporúčaná cena</p>
        <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-blue-600">
          649,00 €
        </p>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="space-y-6">
        <section>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-violet-500 rounded-full"></span>
            Checklist rizík
          </h3>
          <ul className="space-y-3">
            {[
              'Displej: Možný "ghosting" pri vysokom jase',
              'Batéria: Priemerná degradácia po 2 rokoch: 15%',
              'Telo: Náchylnosť na mikro-škrabance (Stainless Steel)',
              'Konektivita: Skontrolovať uvoľnený Lightning port'
            ].map((item, idx) => (
              <li key={idx} className="flex items-start gap-3 text-slate-600 text-sm p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-amber-500 mt-0.5">⚠️</span>
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="space-y-6">
        <section>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
            Tipy na vyjednávanie
          </h3>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-2xl border border-blue-100">
            <p className="text-slate-700 text-sm italic leading-relaxed">
              "Vzhľadom na stav batérie pod 85% a drobné odreniny na ráme je férová protiponuka okolo 600€. Spomeňte nutnosť budúcej výmeny batérie v autorizovanom servise (cca 90€)."
            </p>
          </div>
        </section>
        
        <div className="p-4 border-2 border-dashed border-slate-200 rounded-2xl">
          <p className="text-[10px] text-slate-400 text-center uppercase font-bold">Technická Špecifikácia</p>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="text-center">
              <p className="text-[10px] text-slate-400 uppercase">Displej</p>
              <p className="text-xs font-semibold">ProMotion OLED</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-400 uppercase">Materiál</p>
              <p className="text-xs font-semibold">Oceľ + Sklo</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default function AuditlyLanding() {
  const [category, setCategory] = useState('');
  const [model, setModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);

  const handleGenerate = () => {
    if (!category || !model) return;
    setLoading(true);
    setReport(null);
    
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      setReport(model);
    }, 2000);
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

          {/* Audit Tool Card */}
          <div className="max-w-2xl mx-auto mb-20">
            <div className="bg-white p-2 rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-slate-100">
              <div className="flex flex-col md:flex-row gap-2">
                <div className="flex-1">
                  <select 
                    value={category}
                    onChange={(e) => { setCategory(e.target.value); setModel(''); }}
                    className="w-full px-6 py-4 bg-transparent outline-none text-slate-700 font-medium appearance-none cursor-pointer"
                  >
                    <option value="" disabled>Vyber kategóriu</option>
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="w-px h-8 bg-slate-100 my-auto hidden md:block"></div>
                <div className="flex-1">
                  <select 
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    disabled={!category}
                    className="w-full px-6 py-4 bg-transparent outline-none text-slate-700 font-medium appearance-none cursor-pointer disabled:opacity-30"
                  >
                    <option value="" disabled>Vyber model</option>
                    {category && MODELS[category].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <button 
                  onClick={handleGenerate}
                  disabled={!model || loading}
                  className="px-8 py-4 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold rounded-2xl hover:shadow-lg hover:shadow-violet-200 transition-all active:scale-95 disabled:grayscale disabled:opacity-50"
                >
                  {loading ? 'Analyzujem...' : 'Vygenerovať audit'}
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
            {report && !loading && <AuditReport product={report} />}
            
            {!loading && !report && (
              <div className="py-20 border-2 border-dashed border-slate-200 rounded-[3rem] text-slate-300">
                <p className="text-sm font-medium">Zadajte model zariadenia pre začatie auditu</p>
              </div>
            )}
          </div>
        </main>

        <footer className="py-12 text-center text-slate-400 text-xs border-t border-slate-100">
          <p>© 2026 Auditlyio. Všetky práva vyhradené. Súčasť ekosystému PredajTo.ai</p>
        </footer>
      </div>
    </div>
  );
}
