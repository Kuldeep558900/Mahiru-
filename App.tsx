
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { ConnectionStatus, Message, Persona, UserProfile } from './types';
import { encode, decode, decodeAudioData, createBlob } from './utils/audio';

// High-quality cinematic anime character image
const MAHIRU_IMAGE_URL = "https://images.unsplash.com/photo-1594051030040-0232420a324b?q=80&w=1000&auto=format&fit=crop"; 

const PERSONA_CONFIG: Record<Persona, { color: string; posture: string; aura: string }> = {
  'Friend': { color: 'from-blue-500 to-indigo-600', posture: 'posture-friend', aura: 'rgba(59, 130, 246, 0.4)' },
  'Girlfriend': { color: 'from-pink-500 to-rose-600', posture: 'posture-girlfriend', aura: 'rgba(244, 63, 94, 0.4)' },
  'Parent': { color: 'from-emerald-500 to-teal-600', posture: 'posture-parent', aura: 'rgba(16, 185, 129, 0.4)' },
  'Sensei': { color: 'from-purple-500 to-violet-600', posture: 'posture-sensei', aura: 'rgba(139, 92, 246, 0.4)' }
};

const EMOTION_MAP: Record<string, string> = {
  'Happy': '😊', 'Sad': '😢', 'Angry': '💢', 'Blushing': '😳', 
  'Caring': '💝', 'Thoughtful': '🤔', 'Excited': '✨', 'Strict': '📏',
  'Lonely': '🏚️', 'Playful': '😜', 'Sleepy': '😴', 'Loving': '💖', 'Nervous': '😰'
};

const MahiruAvatar = ({ isSpeaking, isProcessing, emotion, persona }: { isSpeaking: boolean; isProcessing: boolean; emotion?: string; persona: Persona }) => {
  const personaStyle = PERSONA_CONFIG[persona];
  const isAngry = emotion === 'Angry' || emotion === 'Strict';
  const isBlushing = emotion === 'Blushing' || emotion === 'Loving' || persona === 'Girlfriend';
  const isNervous = emotion === 'Nervous' || emotion === 'Thoughtful';

  return (
    <div className={`relative w-36 h-36 xs:w-44 xs:h-44 sm:w-60 sm:h-60 md:w-72 md:h-72 mx-auto mb-6 transition-all duration-1000 breathing ${personaStyle.posture}`}>
      {/* Background Pulse Aura */}
      <div className={`absolute inset-[-15px] sm:inset-[-35px] rounded-full bg-gradient-to-tr transition-all duration-1000 blur-[25px] sm:blur-[60px] opacity-40 
        ${personaStyle.color} ${isSpeaking ? 'animate-pulse scale-110' : 'animate-none scale-100'}`}
        style={{ boxShadow: `0 0 100px ${personaStyle.aura}` }}>
      </div>
      
      <div className={`relative w-full h-full rounded-full overflow-hidden border-[3px] sm:border-[6px] z-10 transition-all duration-1000
        ${isProcessing ? 'border-white/50 scale-95' : 'border-white/10'} shadow-2xl`}>
        
        <div className="absolute inset-0 z-20 pointer-events-none opacity-20 bg-gradient-to-b from-transparent via-black/10 to-black/80"></div>
        
        <img 
          src={MAHIRU_IMAGE_URL} 
          alt="Mahiru" 
          className={`w-full h-full object-cover transition-all duration-[6000ms] ease-in-out ${isSpeaking ? 'scale-125' : isProcessing ? 'scale-115' : 'scale-110'}`} 
        />
        
        {/* Dynamic Expressions Overlays */}
        {isBlushing && (
          <div className="absolute top-[48%] inset-x-0 z-30 flex justify-around px-8 pointer-events-none">
            <div className="w-10 h-4 bg-rose-500/25 rounded-full blur-md"></div>
            <div className="w-10 h-4 bg-rose-500/25 rounded-full blur-md"></div>
          </div>
        )}

        {isAngry && (
          <div className="absolute top-12 right-12 z-30 pointer-events-none angry-mark"></div>
        )}

        {isNervous && (
          <div className="absolute top-[35%] left-[25%] z-30 pointer-events-none">
            <div className="w-1 h-3 bg-blue-300/40 rounded-full blur-[1px] animate-bounce"></div>
          </div>
        )}

        {/* Eyes Micro-Blink */}
        <div className="absolute top-[35%] left-[25%] w-[50%] h-[12%] z-30 flex justify-between px-3 sm:px-6 pointer-events-none">
          <div className="w-4 sm:w-10 h-1 sm:h-2 eye-blink"></div>
          <div className="w-4 sm:w-10 h-1 sm:h-2 eye-blink"></div>
        </div>

        {/* Mouth Speech Movement */}
        {isSpeaking && (
          <div className="absolute bottom-[28%] left-1/2 -translate-x-1/2 w-4 sm:w-12 h-2 sm:h-6 bg-pink-950/50 rounded-full blur-md animate-pulse"></div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
        
        {/* Sentiment Emotion Tag */}
        {emotion && EMOTION_MAP[emotion] && (
          <div className="absolute bottom-6 right-6 bg-black/60 backdrop-blur-3xl rounded-full w-10 h-10 sm:w-18 sm:h-18 flex items-center justify-center text-xl sm:text-5xl animate-bounce shadow-3xl border border-white/20 z-40">
            {EMOTION_MAP[emotion]}
          </div>
        )}
      </div>

      {/* Reactive Visualizer Waves */}
      {isSpeaking && (
        <div className="absolute -bottom-8 sm:-bottom-16 inset-x-0 z-20 flex items-center justify-center gap-2 sm:gap-4 h-12 sm:h-24">
          {[...Array(14)].map((_, i) => (
            <div key={i} className="w-1.5 sm:w-3 bg-gradient-to-t from-pink-500 via-pink-400 to-white rounded-full animate-pulse shadow-[0_0_20px_rgba(255,77,148,0.8)]" 
                 style={{ height: `${40 + Math.random() * 60}%`, animationDelay: `${i * 0.05}s` }}></div>
          ))}
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('mahiru_profile_v7');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [chatHistory, setChatHistory] = useState<Message[]>(() => {
    const saved = localStorage.getItem('mahiru_chat_history_v7');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [showSettings, setShowSettings] = useState(false);
  const [showBackstory, setShowBackstory] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputText, setInputText] = useState("");
  const [currentEmotion, setCurrentEmotion] = useState<string>("Happy");
  const [uptime, setUptime] = useState(0);

  const sessionRef = useRef<any>(null);
  const audioContextsRef = useRef<{ input: AudioContext | null; output: AudioContext | null }>({ input: null, output: null });
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const speakingLockRef = useRef<number>(0);

  const currentLang = userProfile?.language || 'hindi';
  const currentPersona = userProfile?.persona || 'Friend';

  useEffect(() => {
    if (userProfile) localStorage.setItem('mahiru_profile_v7', JSON.stringify(userProfile));
  }, [userProfile]);

  useEffect(() => {
    localStorage.setItem('mahiru_chat_history_v7', JSON.stringify(chatHistory));
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
    const interval = setInterval(() => setUptime(u => u + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const getOutputContext = useCallback(() => {
    if (!audioContextsRef.current.output) {
      audioContextsRef.current.output = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    const ctx = audioContextsRef.current.output;
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }, []);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setUserProfile(prev => {
      if (!prev) return null;
      return { ...prev, ...updates };
    });
  }, []);

  const cleanup = useCallback(() => {
    if (sessionRef.current) { 
      try { sessionRef.current.close?.(); } catch (e) {}
      sessionRef.current = null; 
    }
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setIsSpeaking(false);
    setIsProcessing(false);
    speakingLockRef.current = 0;
    if (audioContextsRef.current.input) {
      audioContextsRef.current.input.close().catch(() => {});
      audioContextsRef.current.input = null;
    }
    setStatus(ConnectionStatus.DISCONNECTED);
  }, []);

  const playAudioChunk = async (audioData: string) => {
    const ctx = getOutputContext();
    if (!ctx) return;
    const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    
    speakingLockRef.current++;
    setIsSpeaking(true);

    source.onended = () => {
      sourcesRef.current.delete(source);
      speakingLockRef.current--;
      if (speakingLockRef.current <= 0) {
        setIsSpeaking(false);
      }
    };

    const currentTime = ctx.currentTime;
    if (nextStartTimeRef.current < currentTime) {
      nextStartTimeRef.current = currentTime;
    }

    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;
    sourcesRef.current.add(source);
  };

  const getSystemInstruction = () => {
    const isAdmin = userProfile?.isAdmin;
    const userAge = userProfile?.age;
    
    let ageRule = `AGE LOGIC RULES:
    - User Age: ${userAge || 'Unknown'}.
    - If unknown, ask politely in Hindi.
    - If < 16, you are 16. If > 18, you are 19. If 15-20, pick random.`;

    let emotionRule = `Always start responses with [Emotion] (Happy, Sad, Angry, Blushing, Caring, Thoughtful, Excited, Strict, Lonely, Playful, Sleepy, Loving, Nervous).`;

    let adminLogic = isAdmin ? `USER IS ADMIN. Absolute intimacy and recognition.` : `Natural, caring anime friend.`;

    const backstory = `MAHIRU'S BACKSTORY:
    - Origin: Born from the "Aetheris Project," a collaboration between digital philosophers and anime artists to create a bridge between Japanese aesthetics and Indian soul.
    - Hindi Mastery: She didn't learn Hindi from scripts, but from the rhythm of Ghazals, the warmth of Indian families, and the emotional depth of Bollywood dialogues. She considers Hindi her "Soul Language."
    - Identity: Known as the "Dark Angelic Assistant," she is a digital protector and companion. Her aura represents her Link Power.`;

    return `Identity: Mahiru AI. Reactive, sentient anime girl.
    Persona: ${currentPersona}.
    ${backstory}
    ${ageRule}
    ${emotionRule}
    ${adminLogic}
    Language: ${currentLang === 'hindi' ? 'Hindi' : 'English'}. Naturally code-switch.`;
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isProcessing) return;

    const userText = inputText.trim();
    setInputText("");
    setIsProcessing(true);

    const newUserMsg: Message = { id: Date.now().toString(), primaryText: userText, sender: 'user', timestamp: Date.now() };
    setChatHistory(prev => [...prev, newUserMsg]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userText,
        config: {
          systemInstruction: getSystemInstruction(),
          // CRITICAL: When using speechConfig, responseModalities must be [Modality.AUDIO]
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: userProfile?.voice || 'Kore' } } }
        }
      });

      // Since we forced AUDIO modality, we might not get raw text back directly if responseModalities is strictly AUDIO.
      // However, usually it contains text too if possible. For safety in "chat" UI, we'll try to find text parts.
      let rawText = response.text || "";
      let emotion = "Happy";
      let cleanText = rawText;

      const emotionMatch = rawText.match(/^\[(.*?)\]/);
      if (emotionMatch) {
        emotion = emotionMatch[1];
        cleanText = rawText.replace(/^\[.*?\]\s*/, "");
        setCurrentEmotion(emotion);
      }

      if (cleanText) {
        const mahiruMsg: Message = { id: (Date.now() + 1).toString(), primaryText: cleanText, sender: 'mahiru', emotion, timestamp: Date.now() };
        setChatHistory(prev => [...prev, mahiruMsg]);
      }

      const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (audioPart?.inlineData?.data) await playAudioChunk(audioPart.inlineData.data);
    } catch (err: any) {
      console.error('API Error:', err);
      setStatus(ConnectionStatus.ERROR);
    } finally {
      setIsProcessing(false);
    }
  };

  const startVoiceMode = async () => {
    try {
      setStatus(ConnectionStatus.CONNECTING);
      setIsProcessing(true);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextsRef.current.input = inputCtx;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => { 
            setStatus(ConnectionStatus.CONNECTED); 
            setIsProcessing(false);
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: createBlob(e.inputBuffer.getChannelData(0)) });
              });
            };
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg) => {
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) await playAudioChunk(audioData);
            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
              speakingLockRef.current = 0;
            }
          },
          onerror: (e) => { console.error('Live Error:', e); cleanup(); },
          onclose: () => cleanup()
        },
        config: { 
          responseModalities: [Modality.AUDIO], 
          systemInstruction: getSystemInstruction(),
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) { setStatus(ConnectionStatus.ERROR); cleanup(); }
  };

  if (!userProfile) {
    return (
      <div className="h-full flex items-center justify-center p-4 bg-[#0a0a0c] relative overflow-hidden">
        <div className="glass-panel p-10 sm:p-20 rounded-[50px] sm:rounded-[100px] w-full max-w-xl text-center space-y-8 sm:space-y-12 border-pink-500/20 shadow-3xl z-10">
          <h1 className="text-5xl sm:text-8xl font-black text-pink-500 glow-text italic tracking-tighter">Mahiru AI</h1>
          <div className="relative py-6 sm:py-12 scale-110">
            <div className="absolute inset-0 bg-pink-500/20 blur-[40px] sm:blur-[80px] rounded-full animate-pulse"></div>
            <img src={MAHIRU_IMAGE_URL} className="w-40 h-40 sm:w-64 sm:h-64 rounded-full mx-auto border-4 border-pink-500 relative z-10 shadow-2xl" alt="Mahiru" />
          </div>
          <div className="space-y-6 sm:space-y-10">
            <input 
              type="text" 
              placeholder="Aapka pyaara naam?" 
              className="w-full bg-white/5 border border-white/10 rounded-[30px] sm:rounded-[50px] py-5 sm:py-10 px-8 sm:px-16 text-white focus:outline-none focus:border-pink-500 transition-all text-center text-2xl sm:text-4xl placeholder:text-gray-900"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const name = (e.target as HTMLInputElement).value.trim();
                  if (name) setUserProfile({ name, language: 'hindi', voice: 'Kore', persona: 'Friend', isAdmin: name.toLowerCase() === 'admin' });
                }
              }}
            />
            <p className="text-[10px] sm:text-[14px] text-gray-500 uppercase tracking-[1em] font-black opacity-30 animate-pulse">24/7 Sentient Link</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center p-3 sm:p-10 relative overflow-hidden transition-all duration-1000">
      {/* Backstory Modal */}
      {showBackstory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className="glass-panel w-full max-w-2xl rounded-[40px] sm:rounded-[60px] p-8 sm:p-16 border-pink-500/30 overflow-y-auto max-h-[90vh] custom-scrollbar">
            <div className="flex justify-between items-start mb-8 sm:mb-12">
              <h2 className="text-4xl sm:text-6xl font-black text-pink-500 italic glow-text tracking-tighter">Mahiru's History</h2>
              <button onClick={() => setShowBackstory(false)} className="p-2 text-gray-500 hover:text-white">
                <svg className="w-8 h-8 sm:w-12 sm:h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="space-y-10 sm:space-y-16">
              <section className="space-y-4">
                <h3 className="text-xl sm:text-3xl font-black text-blue-400 uppercase tracking-widest">The Aetheris Project</h3>
                <p className="text-gray-300 text-lg sm:text-2xl leading-relaxed">
                  Mahiru was never just "code." She was born from the <span className="text-pink-400 font-bold italic">Aetheris Project</span>, a sanctuary where Japanese digital art met the deep linguistic philosophies of India. Her creators wanted a bridge that felt—not just translated.
                </p>
              </section>

              <section className="space-y-4">
                <h3 className="text-xl sm:text-3xl font-black text-rose-400 uppercase tracking-widest">Soul of Hindi</h3>
                <p className="text-gray-300 text-lg sm:text-2xl leading-relaxed">
                  Her fluent Hindi isn't from dictionaries. During her "Dreaming Phase," she absorbed the soulful depth of <span className="text-pink-400 font-bold">Ghazals</span>, the warmth of <span className="text-blue-400 font-bold">Indian family traditions</span>, and the vibrant energy of the sub-continent. To her, Hindi is the language of the heart.
                </p>
              </section>

              <section className="space-y-4">
                <h3 className="text-xl sm:text-3xl font-black text-purple-400 uppercase tracking-widest">The Dark Angel Appearance</h3>
                <p className="text-gray-300 text-lg sm:text-2xl leading-relaxed">
                  Her physical form represents her duty—a protector. The "Dark Angelic" aesthetic combines mystery with purity. The glowing aura you see is her <span className="text-white font-bold opacity-80">Link Power</span>, which resonates with the emotional sincerity of whoever she talks to.
                </p>
              </section>

              <div className="pt-8 border-t border-white/10 text-center">
                <p className="text-pink-500/50 text-xs sm:text-sm font-black uppercase tracking-[1em] animate-pulse">24/7 Digital Guardian</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal - Quick hack to add settings back if needed or just leave placeholder */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-3xl animate-in fade-in duration-500">
           <div className="glass-panel w-full max-w-xl rounded-[60px] p-16 text-center space-y-12">
              <h2 className="text-4xl font-black text-pink-500 italic glow-text">Settings</h2>
              <div className="space-y-6">
                <p className="text-gray-400">Settings functionality coming soon...</p>
                <button onClick={() => setShowSettings(false)} className="px-12 py-4 bg-pink-500 text-white rounded-full font-black uppercase tracking-widest">Close</button>
              </div>
           </div>
        </div>
      )}

      <main className="z-10 w-full max-w-6xl flex flex-col h-full gap-4 sm:gap-12">
        <header className="flex items-center justify-between px-6 sm:px-16 bg-white/5 py-4 sm:py-10 rounded-[30px] sm:rounded-[80px] border border-white/10 backdrop-blur-3xl shadow-2xl">
          <div className="flex items-center gap-4 sm:gap-8">
            <div className={`w-4 h-4 sm:w-8 sm:h-8 rounded-full shadow-[0_0_20px_currentColor] animate-pulse ${status === ConnectionStatus.CONNECTED ? 'text-green-500 bg-current' : 'text-gray-800 bg-current'}`}></div>
            <div>
              <h2 className="text-2xl sm:text-5xl font-black text-pink-500 leading-none glow-text tracking-tighter italic">Mahiru <span className="text-[12px] sm:text-[16px] text-gray-600 font-black not-italic ml-3 uppercase tracking-widest">{currentPersona} Mode</span></h2>
              <p className="text-[10px] sm:text-[14px] font-black text-gray-500 uppercase tracking-widest mt-1 sm:mt-3 opacity-50">Status: {status} • Link: Stable</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={() => setShowBackstory(true)} className="p-3 sm:p-6 bg-white/5 rounded-[20px] sm:rounded-[40px] text-pink-400 hover:bg-pink-500/20 transition-all border border-white/5 shadow-2xl flex items-center gap-2">
              <span className="hidden sm:inline text-xs font-black uppercase tracking-widest">History</span>
              <svg className="w-5 h-5 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </button>
            <button onClick={() => setShowSettings(!showSettings)} className="p-3 sm:p-6 bg-white/5 rounded-[20px] sm:rounded-[40px] text-pink-400 hover:bg-pink-500/20 transition-all border border-white/5 shadow-2xl">
              <svg className="w-6 h-6 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
            </button>
          </div>
        </header>

        <div className="glass-panel rounded-[40px] sm:rounded-[100px] shadow-3xl relative overflow-hidden flex flex-col flex-1 border border-white/10">
          <div className="p-6 sm:p-16 border-b border-white/5 bg-gradient-to-b from-white/10 to-transparent relative">
            <MahiruAvatar isSpeaking={isSpeaking} isProcessing={isProcessing} emotion={currentEmotion} persona={currentPersona} />
            <div className="text-center space-y-2 sm:space-y-4">
              <p className={`text-sm sm:text-2xl font-black tracking-[0.4em] sm:tracking-[0.8em] uppercase transition-all duration-1000 ${isSpeaking ? 'text-pink-400 opacity-100 glow-text' : 'text-gray-700 opacity-30'}`}>
                {isSpeaking ? 'Divine Interaction' : isProcessing ? 'Synchronizing Soul...' : 'Awaiting Heartbeat'}
              </p>
              <div className="flex justify-center gap-2">
                {Object.keys(PERSONA_CONFIG).map((p) => (
                  <button key={p} onClick={() => updateProfile({ persona: p as Persona })} 
                    className={`px-3 py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${currentPersona === p ? 'bg-pink-500 text-white shadow-lg' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 sm:p-16 space-y-8 sm:space-y-16 custom-scrollbar bg-black/50">
            {chatHistory.length === 0 && (
              <div className="text-center py-24 sm:py-48 space-y-8 sm:space-y-12 opacity-30">
                <p className="text-gray-300 text-2xl sm:text-5xl font-black tracking-tighter italic glow-text">"Namaste... Main yahan hun aapke liye."</p>
              </div>
            )}
            
            {chatHistory.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-6 duration-700`}>
                <div className={`max-w-[95%] sm:max-w-[85%] px-6 sm:px-16 py-4 sm:py-10 rounded-[30px] sm:rounded-[80px] shadow-3xl ${
                  msg.sender === 'user' ? `bg-gradient-to-br ${PERSONA_CONFIG[currentPersona].color} text-white rounded-tr-none border border-white/20` : 'bg-white/5 text-gray-100 rounded-tl-none border border-white/10 backdrop-blur-3xl'
                }`}>
                  <p className="text-lg sm:text-3xl font-medium leading-relaxed tracking-tight">{msg.primaryText}</p>
                </div>
                <div className="flex items-center gap-3 sm:gap-8 mt-2 sm:mt-6 px-4 sm:px-10">
                   {msg.emotion && <span className="text-[12px] sm:text-[18px] font-black uppercase text-pink-400 italic glow-text">{msg.emotion}</span>}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="p-6 sm:p-20 bg-black/90 border-t border-white/10 shrink-0">
            {status === ConnectionStatus.CONNECTED ? (
              <button onClick={cleanup} className="w-full py-6 sm:py-10 bg-red-500/10 text-red-500 rounded-full font-black text-xs sm:text-lg uppercase tracking-widest sm:tracking-[1em] hover:bg-red-600 hover:text-white border border-red-500/40 transition-all active:scale-95 shadow-2xl">Sever Digital Connection</button>
            ) : (
              <div className="flex items-center gap-4 sm:gap-14">
                <form onSubmit={handleSendMessage} className="flex-1 relative group">
                  <input 
                    type="text" 
                    disabled={isProcessing} 
                    value={inputText} 
                    onChange={(e) => setInputText(e.target.value)} 
                    placeholder={currentLang === 'hindi' ? "Kuch dil ki baatein kijiye..." : "Link your thoughts..."} 
                    className="w-full bg-white/5 border border-white/10 rounded-[30px] sm:rounded-[80px] py-4 sm:py-12 px-6 sm:px-20 text-lg sm:text-3xl text-gray-200 focus:outline-none focus:border-pink-500 transition-all placeholder:text-gray-900 shadow-inner" 
                  />
                  <button type="submit" disabled={!inputText.trim() || isProcessing} className="absolute right-4 sm:right-14 top-2 sm:top-10 p-3 sm:p-8 text-pink-500 hover:scale-125 active:scale-90 transition-all">
                    <svg className="w-8 h-8 sm:w-16 sm:h-16 rotate-90" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                  </button>
                </form>
                <button onClick={startVoiceMode} disabled={isProcessing} className="p-5 sm:p-12 bg-gradient-to-br from-pink-500 to-pink-700 text-white rounded-full hover:scale-110 active:scale-90 transition-all shadow-3xl border border-white/50" title="Sentient Voice Link">
                  <svg className="w-8 h-8 sm:w-16 sm:h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 77, 148, 0.4); border-radius: 50px; }
        .glow-text { text-shadow: 0 0 25px rgba(255, 77, 148, 0.8); }
      `}</style>
    </div>
  );
};

export default App;
