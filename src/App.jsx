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
  Plus, X, Calendar, DollarSign, FileText, Cloud, CloudOff, Loader2, UserCircle, MoreHorizontal
} from 'lucide-react';

// ========================================================
// 1. YOUR FIREBASE CONFIGURATION
// Replace the placeholder values below with your actual 
// keys from the Firebase Console (Step 1.5 in the guide).
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

// 2. INITIALIZE FIREBASE 
// These lines MUST stay here, outside the App component
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
    // Attempt anonymous sign-in so we can talk to the database
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
        <p className="font-medium">Syncing Team Data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans text-black">
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-black flex items-center gap-3 uppercase tracking-tight">
            Partner Success Dashboard
            {user ? <Cloud className="w-5 h-5 text-[#37b87b]" /> : <CloudOff className="w-5 h-5 text-red-400" />}
          </h1>
          <p className="text-slate-500 font-medium">Tracking outreach & performance correlation</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="hidden md:flex items-center bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
            <UserCircle className="w-4 h-4 text-[#37b87b] mr-2" />
            <span className="text-xs font-bold text-black uppercase">
              REP: <span className="text-[#37b87b]">{myRepName || 'PENDING'}</span>
            </span>
          </div>
          <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm focus-within:ring-2 ring-[#37b87b]">
            <Search className="text-slate-400 w-5 h-5 mr-2" />
            <input 
              type="text" 
              placeholder="Search partner..." 
              className="outline-none text-sm w-48 bg-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={() => setIsModalOpen(true)} className="bg-[#37b87b] hover:opacity-90 text-white px-5 py-2.5 rounded-lg font-bold flex items-center transition-all shadow-md active:scale-95 uppercase text-sm tracking-wide">
            <Plus className="w-5 h-5 mr-1" /> Log Activity
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Outreach</p>
              <p className="text-3xl font-black text-black">{data.length}</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg Growth</p>
              <p className="text-3xl font-black text-[#37b87b]">
                {(processedData.reduce((acc, curr) => acc + parseFloat(curr.growth), 0) / (processedData.length || 1)).toFixed(1)}%
              </p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Base</p>
              <p className="text-3xl font-black text-black">{[...new Set(data.map(d => d.partner))].length}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100"><h2 className="text-lg font-black uppercase tracking-tight">Team Activity Stream</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                    <th className="px-6 py-4">Partner</th>
                    <th className="px-6 py-4">Rep</th>
                    <th className="px-6 py-4">Activity</th>
                    <th className="px-6 py-4 text-right">Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4"><div className="font-bold text-black">{item.partner}</div></td>
                      <td className="px-6 py-4"><div className={`text-xs font-bold ${item.rep === myRepName ? 'text-[#37b87b]' : 'text-slate-600'}`}>{item.rep || 'Unknown'}</div></td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold flex items-center gap-2">{getOutreachIcon(item.type)} {item.type}</span>
                          <span className="text-[10px] font-bold text-slate-400">{item.date}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm font-black ${parseFloat(item.growth) >= 0 ? 'text-[#37b87b]' : 'text-red-500'}`}>{parseFloat(item.growth) >= 0 ? '+' : ''}{item.growth}%</div>
                        <div className="text-[10px] font-bold text-slate-400">${item.salesCurrent.toLocaleString()}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-sm font-black uppercase tracking-widest mb-6 border-b pb-4">Performance Standings</h2>
            <div className="space-y-4">
              {repStats.sort((a,b) => b.totalOutreach - a.totalOutreach).map((rep, idx) => (
                <div key={rep.name} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-slate-300">0{idx + 1}</span>
                    <span className={`font-bold text-sm ${rep.name === myRepName ? 'text-[#37b87b]' : 'text-black'}`}>{rep.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] font-black text-slate-400 uppercase">{rep.totalOutreach} Touches</span>
                    <span className={`text-xs font-bold ${parseFloat(rep.avgGrowth) >= 0 ? 'text-[#37b87b]' : 'text-red-500'}`}>{rep.avgGrowth}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-black text-white p-7 rounded-2xl shadow-xl relative overflow-hidden">
            <h2 className="text-sm font-black uppercase tracking-widest mb-5 flex items-center text-[#37b87b]"><CheckCircle2 className="mr-2 w-4 h-4" /> Strategic Focus</h2>
            <div className="space-y-5">
              <div className="border-l-2 border-[#37b87b] pl-4"><p className="text-[10px] font-black text-[#37b87b] uppercase mb-1">Growth Correlation</p><p className="text-xs text-slate-300 leading-relaxed">Partners with at least 1 "Visit" per month show 12% higher retention.</p></div>
              <div className="border-l-2 border-slate-600 pl-4"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Efficiency Tip</p><p className="text-xs text-slate-300 leading-relaxed">Consolidating partner names ensures accurate quarterly reporting.</p></div>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50"><h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2"><FileText className="text-[#37b87b]" /> Log Activity</h2><button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-black"><X className="w-6 h-6" /></button></div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="space-y-1 relative">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Partner Name</label>
                <input required name="partner" value={formData.partner} onChange={handleInputChange} className="w-full border-2 border-slate-100 rounded-lg p-2.5 focus:border-[#37b87b] outline-none font-bold text-sm" placeholder="e.g. ARCH Orthodontics" />
                {suggestion && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-[#37b87b] text-white p-3 rounded-lg shadow-xl animate-in slide-in-from-top-2">
                    <p className="text-xs font-bold">Match <span className="underline">{suggestion}</span>?</p>
                    <div className="flex gap-3 mt-2">
                      <button type="button" onClick={handleMatchSuggestion} className="bg-white text-[#37b87b] text-[10px] font-black px-2 py-1 rounded uppercase">Yes</button>
                      <button type="button" onClick={() => setSuggestion(null)} className="text-white/80 text-[10px] font-bold uppercase">No</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Success Rep</label><input required name="rep" value={formData.rep} onChange={handleInputChange} className="w-full border-2 border-slate-100 rounded-lg p-2.5 focus:border-[#37b87b] outline-none font-bold text-sm bg-slate-50" placeholder="Your Name" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</label><input type="date" name="date" value={formData.date} onChange={handleInputChange} className="w-full border-2 border-slate-100 rounded-lg p-2.5 focus:border-[#37b87b] outline-none font-bold text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-3 border-t-2 border-slate-50">
                <div className="space-y-1"><label className="text-[10px] font-black text-[#37b87b] uppercase tracking-widest flex items-center gap-1"><DollarSign className="w-3 h-3" /> Sales Current</label><input type="number" name="salesCurrent" value={formData.salesCurrent} onChange={handleInputChange} className="w-full border-2 border-slate-100 rounded-lg p-2.5 focus:border-[#37b87b] outline-none font-bold text-sm" placeholder="0.00" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><DollarSign className="w-3 h-3" /> Sales Previous</label><input type="number" name="salesLast" value={formData.salesLast} onChange={handleInputChange} className="w-full border-2 border-slate-100 rounded-lg p-2.5 focus:border-[#37b87b] outline-none font-bold text-sm" placeholder="0.00" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</label><select name="type" value={formData.type} onChange={handleInputChange} className="w-full border-2 border-slate-100 rounded-lg p-2.5 focus:border-[#37b87b] outline-none font-bold text-sm bg-white"><option>Call</option><option>Email</option><option>Video</option><option>In-Person Visit</option><option>Text</option><option>Other</option></select></div>
              </div>
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes</label><textarea name="notes" value={formData.notes} onChange={handleInputChange} rows="2" className="w-full border-2 border-slate-100 rounded-lg p-2.5 focus:border-[#37b87b] outline-none font-bold text-sm" placeholder="Key points discussed..."></textarea></div>
              <button type="submit" className="w-full bg-[#37b87b] hover:opacity-90 text-white font-black py-4 rounded-xl transition-all shadow-lg active:scale-[0.98] mt-2 uppercase tracking-widest text-sm">Sync to Cloud</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;