import React, { useState, useEffect, useRef } from 'react';
import { RoleId, ROLE_CONFIG, ChatMessage, Persona } from '../types';
import { chatWithChief, executeWriting, critiqueDraft, performResearch, determineNextAgent, applyEditorFixes, extractTopicFromInput } from '../services/geminiService';
import { Send, FileText, Search, Loader2, ChevronDown, Users, Sparkles, ArrowRight, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Props {
  activeRole: RoleId; // Primarily RoleId.CHIEF in this new view
  selectedPersona: Persona | null;
  personas: Persona[];
  onSelectPersona: (id: string | null) => void;
  draftContent: string;
  setDraftContent: (content: string) => void;
  researchNotes: string;
  setResearchNotes: (notes: string) => void;
  projectTopic: string;
  setProjectTopic: (topic: string) => void;
}

const CollaborativeEditor: React.FC<Props> = ({ 
  activeRole, selectedPersona, personas, onSelectPersona, 
  draftContent, setDraftContent, researchNotes, setResearchNotes,
  projectTopic, setProjectTopic
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPersonaDropdown, setShowPersonaDropdown] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowPersonaDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Initial greeting
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'init',
        role: 'model',
        agentId: RoleId.CHIEF,
        text: `你好! 我是首席写手。告诉我你的想法，我会帮你找到最佳切入角度和结构。如果需要调研或审稿，我的团队随时待命。\n\n:::SUGGESTIONS::: ["提供一个写作灵感", "我想写一篇行业分析"]`,
        timestamp: Date.now()
      }]);
    }
  }, []);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || inputValue;
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: textToSend,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsProcessing(true);

    // Extract topic if it's the first real user interaction and topic isn't set
    if (!projectTopic && messages.length <= 1) {
        extractTopicFromInput(textToSend).then(topic => {
            if (topic) setProjectTopic(topic);
        }).catch(err => console.warn("Topic extraction failed", err));
    }

    try {
      // SPECIAL FLOW: ONE-CLICK FIX
      if (textToSend === "请你帮我一键修改") {
          // Find the last critique from the editor
          const lastCritiqueMsg = [...messages].reverse().find(m => m.agentId === RoleId.EDITOR && m.role === 'model');
          const critiqueText = lastCritiqueMsg ? lastCritiqueMsg.text : "请优化全文";

          const aiMsgId = crypto.randomUUID();
          setMessages(prev => [...prev, {
            id: aiMsgId,
            role: 'model',
            agentId: RoleId.EDITOR,
            text: '没问题，我正在根据之前的评审意见进行全篇修改，请稍候...',
            timestamp: Date.now(),
            isThinking: true
          }]);

          const result = await applyEditorFixes(draftContent, critiqueText, selectedPersona);
          
          setDraftContent(result || draftContent); // Auto-update draft
          
          setMessages(prev => prev.map(m => m.id === aiMsgId ? { 
              ...m, 
              text: `✅ 已根据毒舌主编的意见完成修改，并自动更新了右侧草稿。\n\n你可以检查一下，或者继续进行下一步。\n\n:::SUGGESTIONS::: ["继续完善草稿", "再次评审", "完成项目"]`, 
              isThinking: false 
          } : m));

          setIsProcessing(false);
          return;
      }

      // 1. Determine which agent should handle this
      const targetAgentId = await determineNextAgent(
        messages.map(m => ({ role: m.role, text: m.text })), 
        userMsg.text
      );

      // Placeholder for AI response
      const aiMsgId = crypto.randomUUID();
      setMessages(prev => [...prev, {
        id: aiMsgId,
        role: 'model',
        agentId: targetAgentId,
        text: '',
        timestamp: Date.now(),
        isThinking: true
      }]);

      const updateAiMessage = (text: string) => {
        setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text, isThinking: false } : m));
      };

      // 2. Route to appropriate service
      if (targetAgentId === RoleId.RESEARCHER) {
        
        const result = await performResearch(userMsg.text, draftContent);
        updateAiMessage(result || "没有找到相关调研结果。");
        if (result) {
            setResearchNotes(researchNotes + `\n\n--- 调研主题: ${userMsg.text} ---\n` + result);
        }

      } else if (targetAgentId === RoleId.EXECUTOR) {
        
        const stream = await executeWriting(userMsg.text, draftContent + "\n\nResearch Context:\n" + researchNotes, selectedPersona);
        let fullText = "";
        for await (const chunk of stream) {
            fullText += chunk.text;
            updateAiMessage(fullText);
        }

      } else if (targetAgentId === RoleId.EDITOR) {
        
        // Editor reviews either the whole draft or what user pasted
        const contentToReview = userMsg.text.length > 50 ? userMsg.text : draftContent;
        if (!contentToReview) {
             updateAiMessage("请先生成草稿，或者直接把要评审的内容发给我。\n\n:::SUGGESTIONS::: [" + (draftContent ? "评审当前草稿" : "我来写一段") + "]");
        } else {
            const stream = await critiqueDraft(contentToReview, selectedPersona);
            let fullText = "";
            for await (const chunk of stream) {
                fullText += chunk.text;
                updateAiMessage(fullText);
            }
        }

      } else {
        // Default: CHIEF WRITER
        const stream = await chatWithChief(
          messages.map(m => ({ role: m.role, text: m.text })), 
          userMsg.text, 
          selectedPersona,
          draftContent
        );
        
        let fullText = "";
        for await (const chunk of stream) {
            fullText += chunk.text;
            updateAiMessage(fullText);
        }
      }

    } catch (err) {
      console.error(err);
      setMessages(prev => prev.map(m => m.role === 'model' && m.isThinking ? { ...m, text: "发生错误，请重试。", isThinking: false } : m));
    } finally {
      setIsProcessing(false);
    }
  };

  const getAgentConfig = (agentId?: RoleId) => {
      return ROLE_CONFIG[agentId || RoleId.CHIEF];
  };

  // Function to extract suggestions and clean text
  const parseMessageContent = (content: string) => {
      const parts = content.split(':::SUGGESTIONS:::');
      const cleanText = parts[0].trim();
      let suggestions: string[] = [];
      
      if (parts.length > 1) {
          try {
              suggestions = JSON.parse(parts[1].trim());
          } catch (e) {
              console.warn("Failed to parse suggestions", e);
          }
      }
      return { cleanText, suggestions };
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm overflow-hidden relative">
      
      {/* Top Bar */}
      <div className={`p-4 border-b border-gray-100 flex justify-between items-center ${ROLE_CONFIG[RoleId.CHIEF].color.split(' ')[0]} bg-opacity-30 backdrop-blur-sm z-10 transition-all`}>
        <div className="flex items-center gap-3">
          <img src={ROLE_CONFIG[RoleId.CHIEF].avatar} className="w-10 h-10 rounded-full border border-white/50" alt="Chief"/>
          <div className="flex flex-col">
             {projectTopic ? (
                 <>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-500 bg-white/50 px-1.5 py-0.5 rounded">PROJECT</span>
                        <h3 className="font-bold text-lg bg-gradient-to-r from-blue-700 to-purple-600 bg-clip-text text-transparent truncate max-w-[200px] md:max-w-md">
                            {projectTopic}
                        </h3>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">首席写手正在主导...</p>
                 </>
             ) : (
                <>
                    <h3 className={`font-bold ${ROLE_CONFIG[RoleId.CHIEF].color.split(' ')[1]}`}>写作天团工作台</h3>
                    <p className="text-xs text-gray-500 hidden sm:block">首席写手正在主导项目...</p>
                </>
             )}
          </div>
        </div>
        
        {/* Context / Persona Selector */}
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setShowPersonaDropdown(!showPersonaDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/80 rounded-lg text-xs font-medium text-gray-700 border border-gray-200 hover:bg-white transition-colors shadow-sm"
            >
                <Users className="w-3.5 h-3.5 text-purple-500" />
                <span className="max-w-[100px] truncate">{selectedPersona ? selectedPersona.name : "选择写作风格"}</span>
                <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>

            {showPersonaDropdown && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 animate-fade-in">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase border-b border-gray-50">
                        切换风格画像
                    </div>
                    {personas.length === 0 && (
                            <div className="px-4 py-3 text-xs text-gray-400 italic text-center">
                            暂无风格<br/>请先去打磨师处创建
                            </div>
                    )}
                    {personas.map(p => (
                        <button
                            key={p.id}
                            onClick={() => {
                                onSelectPersona(p.id);
                                setShowPersonaDropdown(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-purple-50 flex items-center justify-between ${selectedPersona?.id === p.id ? 'text-purple-700 font-medium bg-purple-50' : 'text-gray-700'}`}
                        >
                            <span className="truncate">{p.name}</span>
                            {selectedPersona?.id === p.id && <CheckIcon className="w-3 h-3" />}
                        </button>
                    ))}
                    <div className="border-t border-gray-50 mt-1">
                            <button
                            onClick={() => {
                                onSelectPersona(null);
                                setShowPersonaDropdown(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-500 ${!selectedPersona ? 'font-medium text-gray-800' : ''}`}
                            >
                            不使用特定风格
                            </button>
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* Main Layout: Split View for larger screens */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/50">
             {messages.map((msg) => {
               const agentConfig = getAgentConfig(msg.agentId);
               const isUser = msg.role === 'user';
               const { cleanText, suggestions } = parseMessageContent(msg.text);
               
               return (
                <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} group items-end gap-2`}>
                   
                   {!isUser && (
                       <div className="flex flex-col items-center mb-4">
                           <div className="relative">
                               <img src={agentConfig.avatar} className="w-8 h-8 rounded-full shadow-sm" alt={agentConfig.name} />
                               <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${agentConfig.color.split(' ')[0].replace('bg-', 'bg-')}`}></div>
                           </div>
                           <span className="text-[10px] text-gray-400 mt-1 scale-90">{agentConfig.name}</span>
                       </div>
                   )}

                   <div className={`flex flex-col max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                       <div className={`rounded-2xl p-4 shadow-sm ${
                        isUser 
                           ? 'bg-gray-900 text-white rounded-br-none' 
                           : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'
                       }`}>
                         {msg.isThinking && !msg.text ? (
                            <div className="flex items-center gap-2 text-gray-400 text-sm">
                               <Loader2 className="w-4 h-4 animate-spin" />
                               {msg.agentId ? `${ROLE_CONFIG[msg.agentId].name} 正在思考...` : 'Thinking...'}
                            </div>
                         ) : (
                           <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-li:marker:text-gray-400">
                             <ReactMarkdown>{cleanText}</ReactMarkdown>
                           </div>
                         )}
                         
                         {/* Default action button if needed */}
                         {!isUser && !msg.isThinking && (
                             <div className="mt-2 pt-2 border-t border-gray-100 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => {
                                      setDraftContent(draftContent + (draftContent ? "\n\n" : "") + cleanText);
                                  }}
                                  className="text-[10px] flex items-center gap-1 text-gray-400 hover:text-blue-600 font-medium transition-colors"
                                  title="Add raw text to draft"
                                >
                                   <FileText className="w-3 h-3" /> 引用到草稿
                                </button>
                                <button 
                                  onClick={() => handleCopy(cleanText, msg.id)}
                                  className="text-[10px] flex items-center gap-1 text-gray-400 hover:text-purple-600 font-medium transition-colors"
                                  title="复制内容"
                                >
                                   {copiedId === msg.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                   {copiedId === msg.id ? "已复制" : "复制"}
                                </button>
                             </div>
                         )}
                       </div>

                       {/* Interactive Suggestion Chips */}
                       {!isUser && suggestions.length > 0 && (
                           <div className="flex flex-wrap gap-2 mt-2 ml-1">
                               {suggestions.map((suggestion, idx) => (
                                   <button
                                      key={idx}
                                      onClick={() => handleSend(suggestion)}
                                      disabled={isProcessing}
                                      className="px-3 py-1.5 bg-white border border-purple-200 text-purple-700 rounded-full text-xs font-medium shadow-sm hover:bg-purple-50 hover:border-purple-300 hover:shadow transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                   >
                                       {suggestion === "请你帮我一键修改" && <Sparkles className="w-3 h-3 text-purple-500" />}
                                       {suggestion}
                                       {suggestion !== "请你帮我一键修改" && <ArrowRight className="w-3 h-3 opacity-50" />}
                                   </button>
                               ))}
                           </div>
                       )}
                   </div>
                 </div>
               );
             })}
             <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-gray-100">
            <div className="relative flex items-end gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200 focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-sm">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                    }
                }}
                placeholder="输入你的想法、指令或回复..."
                className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[44px] py-2 px-2 text-sm"
                rows={1}
              />
              <button 
                onClick={() => handleSend()}
                disabled={!inputValue.trim() || isProcessing}
                className={`p-2 rounded-lg mb-0.5 transition-colors ${
                    inputValue.trim() && !isProcessing ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md' : 'bg-gray-200 text-gray-400'
                }`}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Draft & Context */}
        <div className="w-1/2 border-l border-gray-200 bg-white flex flex-col hidden lg:flex">
             <div className="p-3 border-b border-gray-100 bg-gray-50 flex gap-4 text-sm font-medium">
                <div className="flex items-center gap-2 text-gray-700">
                    <FileText className="w-4 h-4" /> 写作草稿 (Working Draft)
                </div>
             </div>
             <textarea 
                className="flex-1 w-full p-4 outline-none text-gray-700 leading-relaxed font-serif resize-none focus:bg-gray-50 transition-colors"
                placeholder="此处将显示生成的草稿内容..."
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
             />
             
             {/* Mini Research View */}
             {researchNotes && (
                 <div className="h-1/3 border-t border-gray-200 flex flex-col">
                    <div className="p-2 bg-teal-50 text-teal-800 text-xs font-bold px-4 flex items-center gap-2">
                        <Search className="w-3 h-3" /> 调研笔记 (Research Notes)
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 bg-slate-50 text-xs text-gray-600">
                        <ReactMarkdown>{researchNotes}</ReactMarkdown>
                    </div>
                 </div>
             )}
        </div>

      </div>
    </div>
  );
};

const CheckIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
);

export default CollaborativeEditor;