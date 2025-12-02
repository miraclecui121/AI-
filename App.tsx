import React, { useState, useEffect } from 'react';
import { RoleId, ROLE_CONFIG, Persona } from './types';
import PersonaLab from './components/PersonaLab';
import CollaborativeEditor from './components/CollaborativeEditor';
import { Users, PenTool, Search, Zap, AlertTriangle, ChevronRight, Menu } from 'lucide-react';

export default function App() {
  const [activeRole, setActiveRole] = useState<RoleId>(RoleId.POLISHER);
  
  // Load personas from local storage
  const [personas, setPersonas] = useState<Persona[]>(() => {
    try {
      const saved = localStorage.getItem('ai_squad_personas');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load personas", e);
      return [];
    }
  });

  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  
  // Shared Project State
  const [draftContent, setDraftContent] = useState('');
  const [researchNotes, setResearchNotes] = useState('');
  const [projectTopic, setProjectTopic] = useState('');

  // Persist personas whenever they change
  useEffect(() => {
    localStorage.setItem('ai_squad_personas', JSON.stringify(personas));
  }, [personas]);

  const handleSavePersona = (persona: Persona) => {
    setPersonas(prev => [...prev, persona]);
    setSelectedPersonaId(persona.id);
    // Auto switch to Chief Writer after creating a persona for better flow
    setActiveRole(RoleId.CHIEF);
  };

  const handleDeletePersona = (id: string) => {
    setPersonas(prev => prev.filter(p => p.id !== id));
    if (selectedPersonaId === id) {
      setSelectedPersonaId(null);
    }
  };

  const getRoleIcon = (role: RoleId) => {
    switch (role) {
      case RoleId.POLISHER: return <Users className="w-5 h-5" />;
      case RoleId.CHIEF: return <PenTool className="w-5 h-5" />;
      case RoleId.RESEARCHER: return <Search className="w-5 h-5" />;
      case RoleId.EXECUTOR: return <Zap className="w-5 h-5" />;
      case RoleId.EDITOR: return <AlertTriangle className="w-5 h-5" />;
    }
  };

  const selectedPersona = personas.find(p => p.id === selectedPersonaId) || null;

  // Filter visible roles for the sidebar
  const visibleRoles = [RoleId.POLISHER, RoleId.CHIEF];

  return (
    <div className="flex h-screen bg-slate-100 font-sans">
      
      {/* Sidebar Navigation */}
      <div className="w-20 lg:w-64 bg-white border-r border-gray-200 flex flex-col justify-between shrink-0 transition-all duration-300">
        <div>
          <div className="p-6 flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg shadow-lg flex items-center justify-center text-white font-bold">
              AI
            </div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 hidden lg:block">写作天团</h1>
          </div>

          <nav className="space-y-1 px-2">
            {Object.values(RoleId)
              .filter(role => visibleRoles.includes(role))
              .map((role) => {
                const config = ROLE_CONFIG[role];
                const isActive = activeRole === role;
                return (
                  <button
                    key={role}
                    onClick={() => setActiveRole(role)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group relative ${
                      isActive 
                        ? 'bg-gray-900 text-white shadow-md' 
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <div className={`p-1 rounded ${isActive ? 'text-white' : config.iconColor}`}>
                      {getRoleIcon(role)}
                    </div>
                    <div className="hidden lg:block text-left">
                      <div className="font-medium text-sm">{config.name}</div>
                      <div className={`text-[10px] ${isActive ? 'text-gray-300' : 'text-gray-400'}`}>{config.title}</div>
                    </div>
                    {isActive && <div className="absolute right-2 w-1.5 h-1.5 bg-white rounded-full lg:hidden"></div>}
                  </button>
                );
            })}
          </nav>
        </div>

        {/* Persona Selector in Sidebar (Desktop) */}
        <div className="p-4 border-t border-gray-100 hidden lg:block">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
                当前风格 (Current Style)
            </label>
            {personas.length === 0 ? (
                <div className="text-xs text-gray-400 italic p-2 bg-gray-50 rounded text-center">
                    暂无风格画像<br/>请先在风格打磨师处创建
                </div>
            ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                    {personas.map(p => (
                        <button
                            key={p.id}
                            onClick={() => setSelectedPersonaId(p.id)}
                            className={`w-full text-left p-2 rounded-lg text-sm flex items-center justify-between group ${
                                selectedPersonaId === p.id 
                                ? 'bg-purple-50 text-purple-700 border border-purple-100' 
                                : 'hover:bg-gray-50 text-gray-600'
                            }`}
                        >
                            <span className="truncate">{p.name}</span>
                            {selectedPersonaId === p.id && <div className="w-2 h-2 rounded-full bg-purple-500"></div>}
                        </button>
                    ))}
                    <button
                        onClick={() => setSelectedPersonaId(null)}
                        className={`w-full text-left p-2 rounded-lg text-sm flex items-center justify-between group ${
                            selectedPersonaId === null
                            ? 'bg-gray-100 text-gray-700 border border-gray-200'
                            : 'hover:bg-gray-50 text-gray-500'
                        }`}
                    >
                        <span className="truncate">不使用特定风格</span>
                    </button>
                </div>
            )}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-4 lg:p-6 h-full overflow-hidden relative">
        <div className="max-w-7xl mx-auto h-full">
            {activeRole === RoleId.POLISHER ? (
                <PersonaLab 
                  onSave={handleSavePersona} 
                  personas={personas}
                  onDelete={handleDeletePersona}
                />
            ) : (
                <CollaborativeEditor 
                    activeRole={activeRole}
                    selectedPersona={selectedPersona}
                    personas={personas}
                    onSelectPersona={setSelectedPersonaId}
                    draftContent={draftContent}
                    setDraftContent={setDraftContent}
                    researchNotes={researchNotes}
                    setResearchNotes={setResearchNotes}
                    projectTopic={projectTopic}
                    setProjectTopic={setProjectTopic}
                />
            )}
        </div>
      </main>

    </div>
  );
}