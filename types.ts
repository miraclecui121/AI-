export enum RoleId {
  POLISHER = 'polisher',
  CHIEF = 'chief',
  RESEARCHER = 'researcher',
  EXECUTOR = 'executor',
  EDITOR = 'editor'
}

export interface PersonaAnalysis {
  overview: string;      // 风格概述
  methodology: string;   // 创作方法论
  mindset: string;       // 思维内核
  expression: string;    // 表达特征
  habits: string;        // 创作习惯
  markers: string;       // 独特标记
}

export interface Persona {
  id: string;
  name: string;
  analysis: PersonaAnalysis;
  createdAt: number;     // Creation timestamp
  sourceText?: string;   // Original text for tracing
  sourceUrls?: string;   // Original URLs for tracing
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isThinking?: boolean;
  agentId?: RoleId; // The specific AI agent who sent this message
}

export interface ProjectState {
  currentPhase: 'ideation' | 'research' | 'drafting' | 'refining';
  selectedPersonaId: string | null;
  topic: string;
  draftContent: string;
  researchNotes: string;
}

export const ROLE_CONFIG = {
  [RoleId.POLISHER]: {
    name: "风格打磨师",
    title: "Style Polisher",
    description: "建立写作画像，分析创作DNA",
    color: "bg-purple-100 text-purple-700",
    iconColor: "text-purple-600",
    avatar: "https://picsum.photos/id/64/200/200"
  },
  [RoleId.CHIEF]: {
    name: "首席写手",
    title: "Chief Writer",
    description: "全流程把控，提供决策选项",
    color: "bg-blue-100 text-blue-700",
    iconColor: "text-blue-600",
    avatar: "https://picsum.photos/id/65/200/200"
  },
  [RoleId.RESEARCHER]: {
    name: "资深调研",
    title: "Senior Researcher",
    description: "深度搜索，提供结构化报告",
    color: "bg-teal-100 text-teal-700",
    iconColor: "text-teal-600",
    avatar: "https://picsum.photos/id/66/200/200"
  },
  [RoleId.EXECUTOR]: {
    name: "执行师",
    title: "Executor",
    description: "快速成稿，精准扩写",
    color: "bg-orange-100 text-orange-700",
    iconColor: "text-orange-600",
    avatar: "https://picsum.photos/id/67/200/200"
  },
  [RoleId.EDITOR]: {
    name: "毒舌主编",
    title: "Toxic Editor",
    description: "质量把控，犀利点评",
    color: "bg-rose-100 text-rose-700",
    iconColor: "text-rose-600",
    avatar: "https://picsum.photos/id/68/200/200"
  }
};