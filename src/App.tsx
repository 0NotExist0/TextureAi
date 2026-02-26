import React, { useState } from 'react';
import { 
  Download, 
  RefreshCw, 
  Layers, 
  Grid3X3, 
  Image as ImageIcon, 
  Settings, 
  Zap,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  ChevronRight,
  Box
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateBaseTexture, generateMap, TextureMaps } from './services/geminiService';

const MAP_TYPES = [
  { id: 'albedo', label: 'Albedo / Base Color', icon: ImageIcon },
  { id: 'normal', label: 'Normal Map', icon: Layers },
  { id: 'height', label: 'Height / Displacement', icon: Box },
  { id: 'metallic', label: 'Metallic Map', icon: Zap },
  { id: 'ao', label: 'Ambient Occlusion', icon: Grid3X3 },
] as const;

type MapType = typeof MAP_TYPES[number]['id'];

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [maps, setMaps] = useState<TextureMaps>({ albedo: '' });
  const [generatingMaps, setGeneratingMaps] = useState<Set<MapType>>(new Set());
  const [showTiling, setShowTiling] = useState(false);
  const [selectedMap, setSelectedMap] = useState<MapType>('albedo');
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    setMaps({ albedo: '' });
    setGeneratingMaps(new Set(['albedo']));

    try {
      const albedo = await generateBaseTexture(prompt);
      setMaps(prev => ({ ...prev, albedo }));
      setGeneratingMaps(prev => {
        const next = new Set(prev);
        next.delete('albedo');
        return next;
      });

      // Start generating other maps in parallel
      const otherMaps: (Exclude<MapType, 'albedo'>)[] = ['normal', 'height', 'metallic', 'ao'];
      
      setGeneratingMaps(prev => {
        const next = new Set(prev);
        otherMaps.forEach(m => next.add(m));
        return next;
      });

      // Generate maps sequentially or in small batches to avoid rate limits if any
      for (const mapType of otherMaps) {
        try {
          const mapUrl = await generateMap(albedo, mapType);
          setMaps(prev => ({ ...prev, [mapType]: mapUrl }));
        } catch (err) {
          console.error(`Failed to generate ${mapType} map:`, err);
        } finally {
          setGeneratingMaps(prev => {
            const next = new Set(prev);
            next.delete(mapType);
            return next;
          });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate texture');
      setGeneratingMaps(new Set());
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = (url: string, name: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAll = () => {
    (Object.entries(maps) as [string, string][]).forEach(([key, url]) => {
      if (url) downloadImage(url, `texture_${key}`);
    });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Layers className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">TextureGen <span className="text-emerald-500">AI</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowTiling(!showTiling)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                showTiling ? 'bg-emerald-500 text-black' : 'bg-white/5 text-zinc-400 hover:bg-white/10'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
              {showTiling ? 'Disable Tiling' : 'Preview Tiling'}
            </button>
            {maps.albedo && (
              <button 
                onClick={downloadAll}
                className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-full text-sm font-medium hover:bg-zinc-200 transition-all"
              >
                <Download className="w-4 h-4" />
                Export All
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Controls */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white/5 rounded-2xl p-6 border border-white/5 space-y-6">
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 block">
                  Texture Prompt
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., weathered dark basalt rock with moss, sci-fi hexagonal metal plating, aged oak wood planks..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all min-h-[120px] resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={isGenerating || !prompt.trim()}
                className="w-full bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                {isGenerating ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Zap className="w-5 h-5" />
                )}
                {isGenerating ? 'Synthesizing...' : 'Generate Texture'}
              </button>
            </form>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3 text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-3">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
                PBR Maps
              </label>
              <div className="grid grid-cols-1 gap-2">
                {MAP_TYPES.map((map) => (
                  <button
                    key={map.id}
                    onClick={() => setSelectedMap(map.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      selectedMap === map.id 
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' 
                        : 'bg-white/5 border-transparent text-zinc-400 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <map.icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{map.label}</span>
                    </div>
                    {generatingMaps.has(map.id) ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                    ) : maps[map.id] ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 opacity-20" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4 text-zinc-500" />
              Generation Info
            </h3>
            <div className="space-y-4 text-xs text-zinc-500">
              <div className="flex justify-between">
                <span>Resolution</span>
                <span className="text-zinc-300">1024 x 1024 (Upscaled)</span>
              </div>
              <div className="flex justify-between">
                <span>Seamless</span>
                <span className="text-emerald-500">Enabled</span>
              </div>
              <div className="flex justify-between">
                <span>Format</span>
                <span className="text-zinc-300">PNG / 16-bit</span>
              </div>
              <div className="pt-4 border-t border-white/5">
                <p className="leading-relaxed">
                  Our AI engine generates high-fidelity textures optimized for game engines like Unreal Engine, Unity, and Blender.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Preview */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white/5 rounded-3xl border border-white/5 overflow-hidden aspect-square relative group">
            <AnimatePresence mode="wait">
              {maps[selectedMap] ? (
                <motion.div
                  key={`${selectedMap}-${maps[selectedMap]}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-full"
                >
                  <div 
                    className="w-full h-full transition-all duration-500"
                    style={{
                      backgroundImage: `url(${maps[selectedMap]})`,
                      backgroundSize: showTiling ? '33.33%' : '100%',
                      backgroundRepeat: 'repeat'
                    }}
                  />
                  
                  {/* Overlay Controls */}
                  <div className="absolute bottom-6 right-6 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => downloadImage(maps[selectedMap]!, `texture_${selectedMap}`)}
                      className="p-3 bg-white text-black rounded-full shadow-xl hover:scale-110 transition-transform"
                      title="Download Map"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button 
                      className="p-3 bg-black/60 backdrop-blur-md text-white rounded-full shadow-xl hover:scale-110 transition-transform"
                      title="Full Screen"
                    >
                      <Maximize2 className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="absolute top-6 left-6 px-4 py-2 bg-black/60 backdrop-blur-md rounded-full text-xs font-bold tracking-widest uppercase border border-white/10">
                    {MAP_TYPES.find(m => m.id === selectedMap)?.label}
                  </div>
                </motion.div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-4">
                  {generatingMaps.has(selectedMap) ? (
                    <>
                      <div className="relative">
                        <RefreshCw className="w-12 h-12 animate-spin text-emerald-500/20" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Layers className="w-6 h-6 text-emerald-500 animate-pulse" />
                        </div>
                      </div>
                      <p className="text-sm font-medium animate-pulse">Synthesizing {selectedMap} data...</p>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-16 h-16 opacity-10" />
                      <p className="text-sm">Enter a prompt to generate your texture</p>
                    </>
                  )}
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Map Thumbnails */}
          <div className="grid grid-cols-5 gap-4">
            {MAP_TYPES.map((map) => (
              <button
                key={map.id}
                onClick={() => setSelectedMap(map.id)}
                className={`aspect-square rounded-2xl border-2 overflow-hidden transition-all relative ${
                  selectedMap === map.id ? 'border-emerald-500 scale-105 shadow-lg shadow-emerald-500/20' : 'border-white/5 hover:border-white/20'
                }`}
              >
                {maps[map.id] ? (
                  <img src={maps[map.id]} alt={map.label} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-white/5 flex items-center justify-center">
                    {generatingMaps.has(map.id) ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-zinc-500" />
                    ) : (
                      <map.icon className="w-6 h-6 text-zinc-700" />
                    )}
                  </div>
                )}
                <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm py-1 text-[10px] font-bold text-center uppercase tracking-tighter">
                  {map.id}
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-zinc-500 text-sm">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4" />
          <span>© 2026 TextureGen AI. Professional PBR Synthesis.</span>
        </div>
        <div className="flex gap-8">
          <a href="#" className="hover:text-zinc-300 transition-colors">Documentation</a>
          <a href="#" className="hover:text-zinc-300 transition-colors">API Reference</a>
          <a href="#" className="hover:text-zinc-300 transition-colors">Terms of Service</a>
        </div>
      </footer>
    </div>
  );
}
