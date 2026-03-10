import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  query, doc, deleteDoc, updateDoc 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ComposedChart, Cell
} from 'recharts';
import { 
  Users, PhoneCall, TrendingUp, TrendingDown, AlertCircle, 
  CheckCircle2, Search, MessageSquare, Video, MapPin, Mail,
  Plus, X, Calendar, DollarSign, FileText, Cloud, CloudOff, Loader2, UserCircle, MoreHorizontal,
  ArrowRight, Info, ClipboardList
} from 'lucide-react';

// ========================================================
// 1. YOUR FIREBASE CONFIGURATION
// Ensure you have replaced these with your real keys!
// ========================================================
const firebaseConfig = {
  apiKey: "AIzaSyDxCp_2bIxRtLRMgh2uNGxj9fyOs1TWXVQ",
  authDomain: "partner-success-tracker.firebaseapp.com",
  projectId: "partner-success-tracker",
  storageBucket: "partner-success-tracker.firebasestorage.app",
  messagingSenderId: "180612182914",
  appId: "1:180612182914:web:f68cc7e33731cd52bb959b",
  measurementId: "G-2D8CMKGHSG"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'partner-success-tracker-v1'; 

const App = () => {
  const [data, setData] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null); // For the details modal
  const [suggestion, setSuggestion] = useState(null);
  
  const [myRepName, setMyRepName] = useState(localStorage.getItem('preferred_rep_name') || '');
  
  const [formData, setFormData] = useState({
    partner: '',
    rep: localStorage.getItem('preferred_rep_name') || '',
    type: 'Call',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    salesCurrent: '',
    salesLast: '',
    followUp: ''
  });

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const collectionPath = collection(db, 'artifacts', appId, 'public', 'data', 'outreach_logs');
    const unsubscribe = onSnapshot(collectionPath, 
      (snapshot) => {
        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const sortedLogs = logs.sort((a, b) => new Date(b.date) - new Date(a.date));
        setData(sortedLogs);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore error:", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user]);

  const checkSimilarity = (input) => {
    if (!input || input.length < 3) { setSuggestion(null); return; }
    const existingPartners = [...new Set(data.map(d => d.partner))];
    const match = existingPartners.find(p => {
      const pNorm = p.toLowerCase().trim();
      const iNorm = input.toLowerCase().trim();
      return (pNorm.includes(iNorm) || iNorm.includes(pNorm)) && pNorm !== iNorm;
    });
    setSuggestion(match || null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'partner') checkSimilarity(value);
    if (name === 'rep') {
      setMyRepName(value);
      localStorage.setItem('preferred_rep_name', value);
    }
  };

  const handleMatchSuggestion = () => {
    if (suggestion) {
      setFormData(prev => ({ ...prev, partner: suggestion }));
      setSuggestion(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      const collectionPath = collection(db, 'artifacts', appId, 'public', 'data', 'outreach_logs');
      const newEntry = {
        ...formData,
        salesCurrent: parseFloat(formData.salesCurrent) || 0,
        salesLast: parseFloat(formData.salesLast) || 0,
        createdAt: new Date().toISOString(),
        userId: user.uid
      };
      await addDoc(collectionPath, newEntry);
      setIsModalOpen(false);
      setFormData({
        partner: '', rep: myRepName, type: 'Call', 
        date: new Date().toISOString().split('T')[0], 
        notes: '', salesCurrent: '', salesLast: '', followUp: ''
      });
    } catch (err) {
      console.error("Error saving to cloud:", err);
    }
  };

  const processedData = useMemo(() => {
    return data.map(item => {
      const growth = item.salesLast > 0 ? ((item.salesCurrent - item.salesLast) / item.salesLast) * 100 : 0;
      const outreachCount = item.type === "None" ? 0 : 1;
      let status = "";
      let statusColor = "";
      if (outreachCount > 0 && growth > 0) {
        status = "Positive Correlation";
        statusColor = "text-[#37b87b] bg-green-50 border-green-100";
      } else if (outreachCount > 0 && growth <= 0) {
        status = "Negative Correlation";
        statusColor = "text-orange-600 bg-orange-50 border-orange-100";
      } else if (outreachCount === 0 && growth > 0) {
        status = "Self-Motivated Growth";
        statusColor = "text-slate-600 bg-slate-50 border-slate-100";
      } else {
        status = "Needs Engagement";
        statusColor = "text-red-600 bg-red-50 border-red-100";
      }
      return { ...item, growth: growth.toFixed(1), status, statusColor, outreachCount };
    });
  }, [data]);

  const filteredData = processedData.filter(item => 
    item.partner.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.rep.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const repStats = useMemo(() => {
    const stats = {};
    processedData.forEach(item => {
      if (!item.rep || item.rep === "None") return;
      if (!stats[item.rep]) stats[item.rep] = { name: item.rep, totalOutreach: 0, totalGrowth: 0, count: 0 };
      stats[item.rep].totalOutreach += item.outreachCount;
      stats[item.rep].totalGrowth += parseFloat(item.growth);
      stats[item.rep].count += 1;
    });
    return Object.values(stats).map(s => ({ ...s, avgGrowth: (s.totalGrowth / s.count).toFixed(1) }));
  }, [processedData]);

  const getOutreachIcon = (type) => {
    if (type.includes("Call")) return <PhoneCall className="w-4 h-4" />;
    if (type.includes("Email")) return <Mail className="w-4 h-4" />;
    if (type.includes("Video")) return <Video className="w-4 h-4" />;
    if (type.includes("Visit")) return <MapPin className="w-4 h-4" />;
    if (type.includes("Text")) return <MessageSquare className="w-4 h-4" />;
    return <MoreHorizontal className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center text-slate-500">
        <Loader2 className="w-10 h-10 animate-spin text-[#37b87b] mb-4" />
        <p className="font-medium tracking-tight">Syncing Team Data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans text-black antialiased">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-black flex items-center gap-3 uppercase tracking-tighter italic">
            Partner Success Dashboard
            {user ? <Cloud className="w-6 h-6 text-[#37b87b] fill-[#37b87b]/10" /> : <CloudOff className="w-6 h-6 text-red-400" />}
          </h1>
          <p className="text-slate-500 font-bold text-sm tracking-tight">Visibility into outreach impact & revenue performance</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="hidden md:flex items-center bg-white border border-slate-200 rounded-lg px-4 py-2 shadow-sm">
            <UserCircle className="w-4 h-4 text-[#37b87b] mr-2" />
            <span className="text-[10px] font-black text-black uppercase tracking-widest">
              REP: <span className="text-[#37b87b]">{myRepName || 'GUEST'}</span>
            </span>
          </div>
          <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm focus-within:ring-2 ring-[#37b87b]/30">
            <Search className="text-slate-400 w-5 h-5 mr-2" />
            <input 
              type="text" 
              placeholder="Filter by partner or rep..." 
              className="outline-none text-sm w-48 bg-transparent font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={() => setIsModalOpen(true)} className="bg-[#37b87b] hover:brightness-110 text-white px-5 py-2.5 rounded-lg font-black flex items-center transition-all shadow-md active:scale-95 uppercase text-xs tracking-widest">
            <Plus className="w-5 h-5 mr-1 stroke-[3px]" /> Log Activity
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Top Level Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm border-b-4 border-b-[#37b87b]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Outreach</p>
              <p className="text-3xl font-black text-black leading-none">{data.length}</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm border-b-4 border-b-[#37b87b]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Avg Partner Growth</p>
              <p className="text-3xl font-black text-[#37b87b] leading-none">
                {(processedData.reduce((acc, curr) => acc + parseFloat(curr.growth), 0) / (processedData.length || 1)).toFixed(1)}%
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm border-b-4 border-b-black">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Accounts</p>
              <p className="text-3xl font-black text-black leading-none">{[...new Set(data.map(d => d.partner))].length}</p>
            </div>
          </div>

          {/* Activity Stream Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-black uppercase tracking-tighter">Team Activity Stream</h2>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Click row for details</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-200">
                    <th className="px-6 py-4">Partner & Rep</th>
                    <th className="px-6 py-4">Activity Type & Notes</th>
                    <th className="px-6 py-4 text-right">Revenue Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData.map((item) => (
                    <tr 
                      key={item.id} 
                      onClick={() => setSelectedEntry(item)}
                      className="hover:bg-[#37b87b]/5 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-5">
                        <div className="font-bold text-black text-sm group-hover:text-[#37b87b] transition-colors">{item.partner}</div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.rep || 'Unknown'}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold flex items-center gap-2 mb-1">
                            {getOutreachIcon(item.type)} {item.type}
                            <span className="text-[10px] font-bold text-slate-300">| {item.date}</span>
                          </span>
                          {/* Visibility Fix: Show brief note snippet */}
                          <p className="text-[11px] text-slate-500 italic line-clamp-1 max-w-xs font-medium">
                             {item.notes ? `"${item.notes}"` : "No notes provided"}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className={`text-sm font-black ${parseFloat(item.growth) >= 0 ? 'text-[#37b87b]' : 'text-red-500'}`}>
                          {parseFloat(item.growth) >= 0 ? '↑' : '↓'} {Math.abs(item.growth)}%
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 tracking-tight">${item.salesCurrent?.toLocaleString()} Sales</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar Rankings */}
        <div className="space-y-8">
          <div className="bg-white p-7 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-sm font-black uppercase tracking-widest mb-6 border-b pb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#37b87b]" /> Performance Standings
            </h2>
            <div className="space-y-5">
              {repStats.sort((a,b) => b.totalOutreach - a.totalOutreach).map((rep, idx) => (
                <div key={rep.name} className="flex items-center justify-between group border-b border-slate-50 pb-3 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-slate-300">{(idx + 1).toString().padStart(2, '0')}</span>
                    <span className={`font-black text-xs uppercase tracking-tight ${rep.name === myRepName ? 'text-[#37b87b]' : 'text-black'}`}>{rep.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter">{rep.totalOutreach} Touches</span>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${parseFloat(rep.avgGrowth) >= 0 ? 'text-[#37b87b] bg-[#37b87b]/10' : 'text-red-500 bg-red-50'}`}>
                      {rep.avgGrowth}% Avg
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-black text-white p-8 rounded-2xl shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <CheckCircle2 className="w-20 h-20 text-[#37b87b]" />
            </div>
            <h2 className="text-xs font-black uppercase tracking-widest mb-6 flex items-center text-[#37b87b]"><Info className="mr-2 w-4 h-4" /> Success Tip</h2>
            <div className="space-y-6 relative z-10">
              <div className="border-l-2 border-[#37b87b] pl-4">
                <p className="text-[10px] font-black text-[#37b87b] uppercase mb-1 tracking-widest">Growth Factor</p>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">Detailed notes help account reps tailor future pitches based on specific partner objections or wins.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: Log New Activity */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-auto overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2 italic">
                <FileText className="text-[#37b87b]" /> Log Activity
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-black transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="space-y-1 relative">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Partner Name</label>
                <input required name="partner" value={formData.partner} onChange={handleInputChange} className="w-full border-2 border-slate-100 rounded-lg p-3 focus:border-[#37b87b] outline-none font-bold text-sm transition-all" placeholder="e.g. ARCH Orthodontics" />
                {suggestion && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-[#37b87b] text-white p-4 rounded-xl shadow-xl animate-in slide-in-from-top-2">
                    <p className="text-xs font-bold">Did you mean <span className="underline italic">{suggestion}</span>?</p>
                    <div className="flex gap-4 mt-2">
                      <button type="button" onClick={handleMatchSuggestion} className="bg-white text-[#37b87b] text-[10px] font-black px-3 py-1.5 rounded-lg uppercase shadow-sm">Yes, match</button>
                      <button type="button" onClick={() => setSuggestion(null)} className="text-white/80 text-[10px] font-black uppercase">No</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Success Rep</label>
                  <input required name="rep" value={formData.rep} onChange={handleInputChange} className="w-full border-2 border-slate-100 rounded-lg p-3 focus:border-[#37b87b] outline-none font-bold text-sm bg-slate-50" placeholder="Your Name" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</label>
                  <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="w-full border-2 border-slate-100 rounded-lg p-3 focus:border-[#37b87b] outline-none font-bold text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t-2 border-slate-50">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-[#37b87b] uppercase tracking-widest flex items-center gap-1"><DollarSign className="w-3 h-3" /> Current Mo Sales</label>
                  <input type="number" name="salesCurrent" value={formData.salesCurrent} onChange={handleInputChange} className="w-full border-2 border-slate-100 rounded-lg p-3 focus:border-[#37b87b] outline-none font-bold text-sm" placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><DollarSign className="w-3 h-3" /> Last Mo Sales</label>
                  <input type="number" name="salesLast" value={formData.salesLast} onChange={handleInputChange} className="w-full border-2 border-slate-100 rounded-lg p-3 focus:border-[#37b87b] outline-none font-bold text-sm" placeholder="0.00" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Activity Type</label>
                <select name="type" value={formData.type} onChange={handleInputChange} className="w-full border-2 border-slate-100 rounded-lg p-3 focus:border-[#37b87b] outline-none font-bold text-sm bg-white appearance-none">
                  <option>Call</option><option>Email</option><option>Video</option><option>In-Person Visit</option><option>Text</option><option>Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Outreach Notes</label>
                <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows="2" className="w-full border-2 border-slate-100 rounded-lg p-3 focus:border-[#37b87b] outline-none font-bold text-sm" placeholder="Summarize the outcome..."></textarea>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Next Action / Follow-Up</label>
                <input name="followUp" value={formData.followUp} onChange={handleInputChange} className="w-full border-2 border-slate-100 rounded-lg p-3 focus:border-[#37b87b] outline-none font-bold text-sm" placeholder="e.g. Resend contract Friday" />
              </div>
              <button type="submit" className="w-full bg-[#37b87b] hover:brightness-110 text-white font-black py-4 rounded-xl transition-all shadow-lg active:scale-[0.98] mt-2 uppercase tracking-widest text-sm">
                Sync to Cloud
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Entry Details (The Visibility Fix) */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-50 p-6 border-b flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter italic leading-none mb-1">{selectedEntry.partner}</h2>
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar className="w-3 h-3" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Logged on {selectedEntry.date}</span>
                </div>
              </div>
              <button onClick={() => setSelectedEntry(null)} className="bg-white p-2 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <ClipboardList className="w-3 h-3 text-[#37b87b]" /> Activity Outcome
                  </h3>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-sm font-bold text-slate-700 leading-relaxed italic">
                      {selectedEntry.notes || "No notes were recorded for this outreach."}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <ArrowRight className="w-3 h-3 text-[#37b87b]" /> Follow-Up Plan
                  </h3>
                  <div className="bg-[#37b87b]/5 p-4 rounded-xl border border-[#37b87b]/10">
                    <p className="text-sm font-black text-[#37b87b] italic">
                      {selectedEntry.followUp || "No immediate follow-up required."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-inner relative overflow-hidden">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Revenue Impact</h3>
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Growth</p>
                      <p className={`text-3xl font-black ${parseFloat(selectedEntry.growth) >= 0 ? 'text-[#37b87b]' : 'text-red-400'}`}>
                        {selectedEntry.growth}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Success Rep</p>
                      <p className="text-sm font-black text-white italic">{selectedEntry.rep}</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-800 flex justify-between text-[11px] font-bold">
                    <span className="text-slate-500">Last Mo: ${selectedEntry.salesLast?.toLocaleString()}</span>
                    <span className="text-white">Current Mo: ${selectedEntry.salesCurrent?.toLocaleString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-slate-100 rounded-xl p-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${selectedEntry.statusColor}`}>
                      {selectedEntry.status}
                    </span>
                  </div>
                  <div className="border border-slate-100 rounded-xl p-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Touch Method</p>
                    <span className="text-[10px] font-black text-slate-600 uppercase flex items-center gap-1">
                      {getOutreachIcon(selectedEntry.type)} {selectedEntry.type}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t flex justify-end">
               <button 
                onClick={() => setSelectedEntry(null)}
                className="px-6 py-2 bg-black text-white text-xs font-black uppercase tracking-widest rounded-lg hover:bg-slate-800 transition-colors"
               >
                 Close Details
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;