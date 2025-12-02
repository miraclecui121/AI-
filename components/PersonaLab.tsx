import React, { useState, useMemo } from 'react';
import { Persona, PersonaAnalysis, ROLE_CONFIG, RoleId } from '../types';
import { analyzeStyle } from '../services/geminiService';
import { Loader2, Save, Upload, Link as LinkIcon, Edit2, MessageSquare, History, Trash2, RefreshCw, Eye, AlertCircle, Plus, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import * as pdfjsLib from 'pdfjs-dist';

interface Props {
  onSave: (persona: Persona) => void;
  personas: Persona[];
  onDelete: (id: string) => void;
}

const EmptyAnalysis: PersonaAnalysis = {
  overview: '',
  methodology: '',
  mindset: '',
  expression: '',
  habits: '',
  markers: ''
};

const DIMENSIONS: { key: keyof PersonaAnalysis; label: string }[] = [
    { key: 'overview', label: '概述 (Overview)' },
    { key: 'methodology', label: '方法论 (Methodology)' },
    { key: 'mindset', label: '思维 (Mindset)' },
    { key: 'expression', label: '表达 (Expression)' },
    { key: 'habits', label: '习惯 (Habits)' },
    { key: 'markers', label: '标记 (Markers)' },
];

const PersonaLab: React.FC<Props> = ({ onSave, personas, onDelete }) => {
  const [viewMode, setViewMode] = useState<'create' | 'library'>('create');
  
  // Create Mode State
  const [name, setName] = useState('');
  const [inputText, setInputText] = useState('');
  
  // Multi-link state
  const [linkInputs, setLinkInputs] = useState<string[]>(['']);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<PersonaAnalysis | null>(null);
  
  // Result View State
  const [resultTab, setResultTab] = useState<'preview' | 'edit'>('preview');
  const [activeDimension, setActiveDimension] = useState<keyof PersonaAnalysis>('overview');
  
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    
    // Safely handle pdfjs-dist import structure (default vs named)
    const lib = (pdfjsLib as any).default || pdfjsLib;
    
    if (!lib.GlobalWorkerOptions.workerSrc) {
        lib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';
    }

    const loadingTask = lib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = "";
    
    for (let i = 1; i <= pdf.numPages; i++) {
       const page = await pdf.getPage(i);
       const textContent = await page.getTextContent();
       const pageText = textContent.items.map((item: any) => item.str).join(' ');
       fullText += pageText + "\n";
    }
    return fullText;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      let text = '';
      if (file.type === 'application/pdf') {
        text = await extractTextFromPDF(file);
      } else {
        // Fallback for text based files
        text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = reject;
          reader.readAsText(file);
        });
      }
      
      if (text) {
        setInputText((prev) => {
            const prefix = prev ? prev + "\n\n" : "";
            return prefix + `--- 导入的文件: ${file.name} ---\n` + text;
        });
      }
    } catch (error) {
      console.error("File upload error", error);
      alert("文件解析失败，请尝试标准的PDF或文本文件");
    } finally {
      setIsUploading(false);
      // Reset input value to allow uploading the same file again if needed
      e.target.value = '';
    }
  };

  // Helper to validate a single URL
  const getUrlError = (url: string): string | null => {
    if (!url || !url.trim()) return null;
    const trimmed = url.trim();
    if (!trimmed.startsWith('http') && !trimmed.startsWith('https') && !trimmed.startsWith('www.')) {
        return "需以 http/https 开头";
    }
    try {
        // Simple check if it can be parsed as a URL
        const urlObj = new URL(trimmed.startsWith('www.') ? `https://${trimmed}` : trimmed);
        return null;
    } catch {
        return "无效的 URL 格式";
    }
  };

  const handleLinkChange = (index: number, val: string) => {
    const newLinks = [...linkInputs];
    newLinks[index] = val;
    setLinkInputs(newLinks);
  };

  const addLinkInput = () => {
    if (linkInputs.length < 10) {
        setLinkInputs([...linkInputs, '']);
    }
  };

  const removeLinkInput = (index: number) => {
    const newLinks = linkInputs.filter((_, i) => i !== index);
    if (newLinks.length === 0) {
        setLinkInputs(['']);
    } else {
        setLinkInputs(newLinks);
    }
  };

  // Check if any visible input has an error
  const hasLinkErrors = useMemo(() => linkInputs.some(link => getUrlError(link) !== null), [linkInputs]);

  // Counts for UI badges
  const validLinksList = useMemo(() => linkInputs.filter(l => l.trim() && !getUrlError(l)), [linkInputs]);
  const wechatCount = useMemo(() => validLinksList.filter(l => l.includes('mp.weixin.qq.com')).length, [validLinksList]);
  const otherCount = useMemo(() => validLinksList.filter(l => !l.includes('mp.weixin.qq.com')).length, [validLinksList]);

  const handleAnalyze = async () => {
    if (!inputText && validLinksList.length === 0) return;
    if (hasLinkErrors) return;

    setIsAnalyzing(true);
    setErrorMsg(null);
    try {
      const urlsString = validLinksList.join('\n');
      const result = await analyzeStyle(inputText, urlsString);
      setAnalysis(result);
      setResultTab('preview'); // Default to preview
    } catch (error: any) {
      console.error("Analysis Error:", error);
      setErrorMsg(error.message || "分析失败，请稍后重试");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = () => {
    if (name.trim() && analysis) {
      onSave({
        id: crypto.randomUUID(),
        name: name.trim(),
        analysis,
        createdAt: Date.now(),
        sourceText: inputText,
        sourceUrls: linkInputs.filter(l => l.trim()).join('\n')
      });
      // Reset form
      setName('');
      setInputText('');
      setLinkInputs(['']);
      setAnalysis(null);
      setErrorMsg(null);
      setViewMode('library'); // Go to library after save
    }
  };

  const loadPersonaForTracing = (p: Persona) => {
      setName(p.name);
      setInputText(p.sourceText || '');
      // Restore links from string
      const loadedLinks = p.sourceUrls ? p.sourceUrls.split('\n') : [''];
      setLinkInputs(loadedLinks.length > 0 ? loadedLinks : ['']);
      
      setAnalysis(p.analysis);
      setViewMode('create');
  };

  const handleDimensionChange = (key: keyof PersonaAnalysis, value: string) => {
    if (analysis) {
      setAnalysis({ ...analysis, [key]: value });
    }
  };

  const config = ROLE_CONFIG[RoleId.POLISHER];

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className={`p-6 border-b border-gray-100 flex items-center justify-between ${config.color.split(' ')[0]} bg-opacity-30`}>
        <div className="flex items-center gap-4">
            <img src={config.avatar} alt="Avatar" className="w-16 h-16 rounded-full border-2 border-white shadow-md" />
            <div>
            <h2 className={`text-2xl font-bold ${config.color.split(' ')[1]}`}>{config.name}</h2>
            <p className="text-gray-600 text-sm">{config.description}</p>
            </div>
        </div>
        <div className="flex bg-white/50 p-1 rounded-lg">
            <button
                onClick={() => setViewMode('create')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'create' ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-gray-700'}`}
            >
                新建分析
            </button>
            <button
                onClick={() => setViewMode('library')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'library' ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <History className="w-4 h-4" />
                风格库 ({personas.length})
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
        
        {viewMode === 'library' ? (
            <div className="space-y-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">已保存的写作画像</h3>
                {personas.length === 0 ? (
                    <div className="text-center py-20 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>暂无保存的风格</p>
                        <button onClick={() => setViewMode('create')} className="text-purple-600 font-medium mt-2 hover:underline">
                            去创建一个
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {personas.map(p => (
                            <div key={p.id} className="bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col h-full group">
                                <div className="flex justify-between items-start mb-3">
                                    <h4 className="font-bold text-gray-800 text-lg">{p.name}</h4>
                                    <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
                                        {new Date(p.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-500 mb-4 line-clamp-3 flex-1 bg-gray-50 p-3 rounded-lg leading-relaxed">
                                    <ReactMarkdown>{p.analysis.overview}</ReactMarkdown>
                                </div>
                                <div className="flex items-center gap-2 mt-auto pt-4 border-t border-gray-50">
                                    <button 
                                        onClick={() => loadPersonaForTracing(p)}
                                        className="flex-1 py-2 text-xs font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors flex items-center justify-center gap-1"
                                    >
                                        <RefreshCw className="w-3 h-3" />
                                        查看详情 / 溯源
                                    </button>
                                    <button 
                                        onClick={() => {
                                            if (confirm('确定要删除这个风格画像吗？')) onDelete(p.id);
                                        }}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        title="删除"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        ) : (
            <div className="space-y-8 animate-fade-in pb-10">
                {/* Create Mode Input Section */}
                {!analysis ? (
                    <>
                        <div className="space-y-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <label className="block text-sm font-medium text-gray-700">1. 设定画像名称 (可稍后填)</label>
                            <input
                                type="text"
                                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                placeholder="例如: 科技观察家, 情感故事王"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />

                            <div className="flex items-center justify-between mt-4">
                                <label className="block text-sm font-medium text-gray-700">2. 提供参考素材 (支持粘贴链接或上传文件)</label>
                                <div className="flex gap-2 text-[10px]">
                                    {wechatCount > 0 && (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-100 text-green-700 font-medium">
                                            <MessageSquare className="w-3 h-3" /> {wechatCount} 公众号
                                        </span>
                                    )}
                                    {otherCount > 0 && (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 font-medium">
                                            <LinkIcon className="w-3 h-3" /> {otherCount} 链接
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                                {/* Links Section */}
                                <div className="flex flex-col gap-3 w-full">
                                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                        {linkInputs.map((link, idx) => {
                                            const error = getUrlError(link);
                                            const isWeChat = link.includes('mp.weixin.qq.com');
                                            
                                            return (
                                                <div key={idx} className="relative group">
                                                    <div className="relative">
                                                        <LinkIcon className="absolute top-3.5 left-3 w-4 h-4 text-gray-400 z-10" />
                                                        <input
                                                            type="text"
                                                            className={`w-full p-3 pl-10 pr-10 border rounded-xl focus:ring-2 outline-none transition-all text-sm ${
                                                                error
                                                                ? 'border-red-300 focus:ring-red-200 bg-red-50/10' 
                                                                : 'border-gray-200 focus:ring-purple-500'
                                                            }`}
                                                            placeholder="在此粘贴文章链接 (如公众号)..."
                                                            value={link}
                                                            onChange={(e) => handleLinkChange(idx, e.target.value)}
                                                        />
                                                        
                                                        {isWeChat && (
                                                            <div className="absolute top-2.5 right-10 flex items-center gap-1 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm animate-fade-in pointer-events-none">
                                                                <MessageSquare className="w-3 h-3 fill-current" />
                                                                <span>WeChat</span>
                                                            </div>
                                                        )}

                                                        {(linkInputs.length > 1 || link) && (
                                                            <button 
                                                                onClick={() => removeLinkInput(idx)}
                                                                className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors bg-white/80 rounded-full"
                                                                title="删除链接"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    
                                                    {error && (
                                                        <div className="absolute -bottom-5 left-2 text-[10px] text-red-500 flex items-center gap-1 z-10 bg-white px-2 py-0.5 rounded shadow-sm border border-red-100">
                                                            <AlertCircle className="w-3 h-3" />
                                                            {error}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    
                                    {linkInputs.length < 10 && (
                                        <button 
                                            onClick={addLinkInput}
                                            className="self-start text-xs font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 border border-purple-100 shadow-sm"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            添加更多链接 (最多10个)
                                        </button>
                                    )}
                                </div>

                                {/* File Upload Section */}
                                <div className={`relative border border-dashed border-gray-300 rounded-xl bg-gray-50 flex flex-col items-center justify-center min-h-[120px] lg:h-full transition-all ${isUploading ? 'opacity-50 cursor-wait' : 'hover:bg-gray-100 cursor-pointer'}`}>
                                    <input 
                                        type="file" 
                                        className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                                        onChange={handleFileUpload} 
                                        accept=".txt,.md,.pdf,.csv,.json"
                                        disabled={isUploading}
                                    />
                                    {isUploading ? (
                                        <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-2" />
                                    ) : (
                                        <Upload className="w-8 h-8 text-gray-400 mb-2" />
                                    )}
                                    <span className="text-sm text-gray-500">
                                        {isUploading ? "正在处理..." : "上传 PDF, TXT, MD 文件"}
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 mt-4">
                                <textarea
                                    className="w-full p-3 h-32 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none resize-none transition-all"
                                    placeholder="或者直接在这里粘贴样例文本..."
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                />
                                <p className="text-xs text-gray-400 text-right">{inputText.length} 字</p>
                            </div>
                        </div>
                        
                        {errorMsg && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                                <span className="font-bold">Error:</span> {errorMsg}
                            </div>
                        )}

                        <button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing || (!inputText && validLinksList.length === 0) || hasLinkErrors}
                            className="w-full py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors shadow-lg shadow-purple-200"
                        >
                            {isAnalyzing ? (
                                <>
                                    <Loader2 className="animate-spin" />
                                    正在深入分析风格 DNA...
                                </>
                            ) : "开始分析写作风格 (Analyze DNA)"}
                        </button>
                    </>
                ) : (
                    // RESULTS SECTION
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[600px]">
                        
                        {/* Tab Header */}
                        <div className="flex border-b border-gray-100 bg-gray-50">
                            <button 
                                onClick={() => setResultTab('preview')}
                                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${resultTab === 'preview' ? 'bg-white text-purple-700 border-t-2 border-purple-500' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <Eye className="w-4 h-4" /> 预览模式 (Preview)
                            </button>
                            <button 
                                onClick={() => setResultTab('edit')}
                                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${resultTab === 'edit' ? 'bg-white text-purple-700 border-t-2 border-purple-500' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <Edit2 className="w-4 h-4" /> 编辑模式 (Edit)
                            </button>
                        </div>

                        <div className="flex-1 flex overflow-hidden">
                            {/* Vertical Navigation Sidebar */}
                            <div className="w-48 bg-gray-50 border-r border-gray-100 flex-shrink-0 flex flex-col overflow-y-auto">
                                {DIMENSIONS.map((dim) => (
                                    <button
                                        key={dim.key}
                                        onClick={() => setActiveDimension(dim.key)}
                                        className={`p-3 text-left text-xs font-medium border-l-2 transition-colors ${activeDimension === dim.key ? 'bg-white border-purple-500 text-purple-700 shadow-sm' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}
                                    >
                                        {dim.label}
                                    </button>
                                ))}
                            </div>

                            {/* Content Area */}
                            <div className="flex-1 p-6 overflow-y-auto bg-white">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                                    {DIMENSIONS.find(d => d.key === activeDimension)?.label}
                                </h3>

                                {resultTab === 'preview' ? (
                                    <div className="prose prose-sm max-w-none prose-purple prose-headings:font-bold prose-headings:text-gray-800 prose-p:text-gray-600">
                                        <ReactMarkdown>{analysis[activeDimension]}</ReactMarkdown>
                                    </div>
                                ) : (
                                    <div className="relative h-full min-h-[450px] group">
                                        <div className="absolute top-2 right-4 p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-md border border-gray-200">
                                                支持 Markdown 语法
                                            </span>
                                        </div>
                                        <textarea
                                            className="w-full h-full p-6 border border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-50 focus:border-purple-400 outline-none text-sm leading-7 resize-none font-mono text-gray-800 bg-white shadow-sm transition-all placeholder:text-gray-300"
                                            value={analysis[activeDimension]}
                                            onChange={(e) => handleDimensionChange(activeDimension, e.target.value)}
                                            placeholder="在此处编辑内容，支持 Markdown 标题、列表等格式..."
                                            spellCheck={false}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer Actions with Name Input */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="w-full md:w-auto flex-1 flex items-center gap-2 max-w-md">
                                <span className="text-sm font-bold text-gray-700 whitespace-nowrap">画像名称:</span>
                                <input 
                                    type="text" 
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="起个名字 (必填)"
                                    className={`flex-1 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all ${!name.trim() ? 'border-red-300 bg-red-50 focus:border-red-500' : 'border-gray-300 bg-white'}`}
                                />
                            </div>

                            <div className="flex gap-3 w-full md:w-auto justify-end">
                                <button
                                    onClick={() => {
                                        if(confirm('放弃当前的分析结果吗？')) {
                                            setAnalysis(null);
                                        }
                                    }}
                                    className="px-4 py-2 rounded-lg text-gray-600 font-medium hover:bg-gray-200 transition-colors whitespace-nowrap"
                                >
                                    放弃
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={!name.trim()}
                                    className={`px-6 py-2 bg-gray-900 text-white rounded-lg font-bold hover:bg-black flex items-center gap-2 shadow-lg transition-all whitespace-nowrap ${!name.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <Save className="w-4 h-4" />
                                    保存并加入写作团队
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default PersonaLab;