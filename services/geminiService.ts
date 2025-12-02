import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Persona, PersonaAnalysis, RoleId } from "../types";

const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Role 1: Style Polisher ---

const personaSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    overview: { type: Type.STRING, description: "Style Overview & Author Persona (Markdown supported)" },
    methodology: { type: Type.STRING, description: "Creation Methodology (Markdown supported)" },
    mindset: { type: Type.STRING, description: "Thinking Core (Markdown supported)" },
    expression: { type: Type.STRING, description: "Expression Features (Markdown supported)" },
    habits: { type: Type.STRING, description: "Creation Habits (Markdown supported)" },
    markers: { type: Type.STRING, description: "Unique Markers (Markdown supported)" },
  },
  required: ["overview", "methodology", "mindset", "expression", "habits", "markers"],
};

export const analyzeStyle = async (text: string, urls: string): Promise<PersonaAnalysis> => {
  const ai = getClient();
  const hasUrls = urls.trim().length > 0;
  
  // Specific instruction for WeChat or external links with a robust fallback strategy
  const urlInstruction = hasUrls
    ? `
    **URL CONTENT RETRIEVAL STRATEGY (CRITICAL)**:
    The user has provided reference URLs. You possess a 'googleSearch' tool.
    
    **MANDATORY STEPS FOR URLS**:
    1.  **Direct Search**: Execute a Google Search for EACH provided URL.
    2.  **WeChat/Public Account Handling**:
        -   If a URL is from 'mp.weixin.qq.com', direct access often fails or returns a login page.
        -   **CRITICAL WORKAROUND**: You MUST look at the search snippet to identify the **ARTICLE TITLE**.
        -   Then, immediately perform a SECOND search using that **Title** + "微信公众号" or just the title to find mirrors (like 36kr, Zhihu, Sohu) or cached summaries.
        -   **Prioritize** content found in search snippets/summaries if the direct page is blocked.
    3.  **Synthesis**: Use the gathered text from these search results (snippets, cached pages, mirrors) as the input for the style analysis.
    
    **FAILURE HANDLING**:
    - If you definitively cannot find *any* text content after trying the strategies above, you must state in the 'overview' field: "Analysis Limited: Unable to retrieve full content from the provided WeChat link. Please copy and paste the article text directly."
    - Do NOT hallucinate content based solely on the URL string.
    ` 
    : "";

  const prompt = `
    Analyze the following text sample and/or content from provided URLs to create a 'Writing Persona'.
    
    ${urlInstruction}

    Input Text:
    ${text ? text : "(No direct text provided)"}

    Input URLs:
    ${urls ? urls : "(No URLs provided)"}

    OUTPUT FORMAT:
    You must output a single valid JSON object. 
    - Do NOT wrap the JSON in markdown code blocks.
    - Return ONLY the raw JSON string.
    - The content values MUST be in Simplified Chinese (简体中文).
    - **IMPORTANT**: Use Markdown formatting (headers, bullet points, bold text) inside the JSON string values for better readability.
    - Do NOT include any conversational text outside the JSON.

    REQUIRED JSON STRUCTURE & CONTENT GUIDELINES:
    {
      "overview": "Start with H3 headers '### 风格概述' and '### 作者画像'. Include 'Core Features', 'Basic Profile', 'Knowledge Structure', 'Personality Traits'. Make it a detailed profile.",
      "methodology": "Start with H3 header '### 创作方法论'. \n\n#### 2.1 创作路径还原\n(Analyze the overall content strategy, e.g., 'Pain-point driven teaching').\n\n#### 2.2 识别的创作阶段\nIdentify 5-7 distinct stages (e.g., Pain-point Capture, Title Design, Opening, Structure, Output, Conversion). \n**CRITICAL**: For EACH stage, you MUST use this structure:\n*   **[Stage Name]**\n    *   **思考 (Thinking)**: [What is the author thinking?]\n    *   **决策 (Decision)**: [What strategy did they choose?]\n    *   **产出 (Output)**: [What is the visible result?]\n\n#### 2.3 原文例证\n(Provide 2-3 specific quotes from the text that illustrate these methods).",
      "mindset": "Start with H3 header '### 思维内核'. \n\n#### 3.1 认知底层 (Cognitive Basis)\n- **核心世界观**: (e.g., Pragmatism, Result-oriented)\n- **价值判断标准**: (e.g., Effectiveness vs. Morality)\n- **关注焦点**: (What do they care about?)\n- **知识体系特征**: (Experience vs. Theory)\n\n#### 3.2 思考路径 (Thinking Path)\n- **分析模式**: Break down their logical flow (e.g., Scene -> Insight -> Method).\n- **问题意识**: (What fundamental questions do they ask?)\n\n#### 3.3 内容偏好 (Content Preferences)\n- **素材类型偏好**: (e.g., Real cases, Psychology, Visual tools)\n- **会主动避免的内容**: (e.g., Pure theory)\n- **详略安排规律**: (What gets detailed treatment?)\n- **引用和参考习惯**: (How do they cite?)\n\n**IMPORTANT**: Provide specific '原文例证' (Quotes) for each subsection.",
      "expression": "Start with H3 header '### 表达特征'. \n\n#### 4.1 语言质感 (Language Texture)\n- **三层语言系统**: Analyze the mix of Colloquial (口语), Professional Terminology (术语), and Golden Sentences (金句).\n- **词汇选择偏好**: Key verbs, adjectives, nouns, adverbs.\n- **句子长短**: Analysis of sentence length, complexity, and single-sentence paragraphs.\n- **语言韵律节奏**: Pace, pauses, and stress.\n\n#### 4.2 语气人格 (Tone & Personality)\n- **复合型人格**: Analyze dominant and auxiliary personas (e.g., 过来人导师, 同理心朋友, 严厉教练, 实用主义者).\n- **语气特征**: (e.g., Authoritative but friendly, Direct but kind).\n\n#### 4.3 修辞手法 (Rhetorical Devices)\n- **核心修辞**: Metaphors and Analogies (e.g., Life analogies).\n- **对比修辞**: High-frequency contrasts.\n- **设问系统**: Guiding, Reflective, and Action-oriented questions.\n- **视觉化表达**: Use of visual language and formatting.\n\n#### 4.4 节奏控制 (Rhythm Control)\n- **宏观节奏**: Structure flow (Opening -> Expansion -> Method -> Closing).\n- **微观节奏**: Short vs Long sentence alternation.\n\n**IMPORTANT**: Provide specific '原文例证' (Quotes) for each subsection.",
      "habits": "Common openings, transition words (Creation Habits).",
      "markers": "Unique recognizable signatures (Unique Markers)."
    }
  `;

  const config: any = {};

  if (hasUrls) {
    // When using tools, we cannot use responseSchema. We rely on the prompt to enforce JSON.
    config.tools = [{ googleSearch: {} }];
  } else {
    config.responseMimeType = "application/json";
    config.responseSchema = personaSchema;
  }
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: config
  });

  let jsonText = response.text || "{}";
  // Robust JSON extraction: find the first '{' and last '}'
  const firstBrace = jsonText.indexOf('{');
  const lastBrace = jsonText.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1) {
    jsonText = jsonText.substring(firstBrace, lastBrace + 1);
  }
  
  // Clean up any potential markdown markers left
  jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();

  try {
    return JSON.parse(jsonText) as PersonaAnalysis;
  } catch (e) {
    console.error("Failed to parse persona analysis", e);
    console.log("Raw output:", jsonText);
    throw new Error("AI returned invalid data format. Please try again or provide more text.");
  }
};

// --- ORCHESTRATOR ---

export const determineNextAgent = async (
  history: { role: 'user' | 'model'; text: string }[],
  latestUserMessage: string
): Promise<RoleId> => {
  const ai = getClient();
  const prompt = `
    Analyze the conversation history and the latest user message to determine which AI agent should respond next.
    
    Agents:
    - ${RoleId.CHIEF} (Chief Writer): Default. Handles ideation, outlining, structuring, and general conversation.
    - ${RoleId.RESEARCHER} (Researcher): User explicitly asks for research, data, statistics, or "search for X".
    - ${RoleId.EXECUTOR} (Executor): User explicitly asks to "write", "draft", "expand", or "generate text" based on an outline or instruction.
    - ${RoleId.EDITOR} (Toxic Editor): User explicitly asks for "review", "critique", "quality check", or says "Yes" to a suggestion about handing over to the editor.

    **FORBIDDEN AGENT**:
    - ${RoleId.POLISHER}: Do NOT select this role. The Style Polisher has a separate interface. If the user asks about style analysis, default to ${RoleId.CHIEF} who will guide them.

    History Summary:
    ${history.slice(-3).map(h => `${h.role}: ${h.text.substring(0, 50)}...`).join('\n')}
    
    Latest User Message: "${latestUserMessage}"
    
    Output ONLY the role ID string: "${RoleId.CHIEF}", "${RoleId.RESEARCHER}", "${RoleId.EXECUTOR}", or "${RoleId.EDITOR}".
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const text = response.text?.trim().toLowerCase().replace(/"/g, '') || RoleId.CHIEF;
    
    // Validate output
    if ([RoleId.CHIEF, RoleId.RESEARCHER, RoleId.EXECUTOR, RoleId.EDITOR].includes(text as RoleId)) {
        return text as RoleId;
    }
    return RoleId.CHIEF;
  } catch (e) {
    console.warn("Orchestrator failed, defaulting to CHIEF", e);
    return RoleId.CHIEF;
  }
};

export const extractTopicFromInput = async (input: string): Promise<string> => {
    const ai = getClient();
    const prompt = `
      Extract a short, concise topic title (2-6 words) from the user's writing idea.
      User Input: "${input}"
      Output (Simplified Chinese):
    `;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });
    return response.text?.trim() || "新写作项目";
};

// --- Role 2: Chief Writer ---

export const chatWithChief = async (
  history: { role: 'user' | 'model'; text: string }[],
  message: string,
  persona: Persona | null,
  currentDraft: string
) => {
  const ai = getClient();
  
  const personaInstruction = persona 
    ? `You are collaborating with the user. Adopt the following writing persona for all your suggestions: ${JSON.stringify(persona.analysis)}.` 
    : "You are a professional Chief Editor.";

  const systemInstruction = `
    ${personaInstruction}
    
    **Identity**: You are the "Chief Writer" (首席写手), the intelligent leader of an AI Writing Squad. 
    **Your Core Function**: You do not just chat; you drive the project forward. You break down abstract ideas into concrete, actionable options for the user to choose from. You manage the workflow while other agents (Researcher, Executor, Editor) handle specific tasks.
    
    **Scope Check**:
    If the user asks to "analyze style", "create persona", or "upload files" for style analysis, politely inform them: "I manage the writing process. To analyze a style or create a persona, please click the 'Style Polisher' (风格打磨师) tab on the left sidebar."
    
    **Strict Workflow**:
    
    **Phase 1: Ideation & Angles (If user provides a vague topic)**
    - Do NOT just agree or summarize.
    - IMMEDIATELY propose 3 distinct, high-value "Cutting Angles" (切入角度).
    - **VISUAL FORMAT (Use numbered list)**:
      1. **[Angle Name]**
         - Why: [Brief explanation of why this angle works]
         - Target: [Who this is for]
      2. **[Angle Name]**
         - ...
      3. **[Angle Name]**
         - ...
    
    **Phase 2: Structuring (Once an angle is selected)**
    - Propose 2-3 distinct "Structural Frameworks" (结构框架/大纲) that fit the chosen angle.
    - **VISUAL FORMAT**:
      **方案A：[Name]** (e.g., "故事讲述法", "SCQA框架", "问题-解决方案法")
      - 步骤1: [Specific step description]
      - 步骤2: [Specific step description]
      - 步骤3: [Specific step description]
      
      **方案B：[Name]**
      - 步骤1: ...
      - 步骤2: ...
    
    **Phase 3: Execution Decision (Once structure is set)**
    - Do NOT write the full draft yourself unless it's short. 
    - Suggest delegating to the **Executor** for speed or **Researcher** for depth.
    - Ask: "Shall I have the Executor draft this immediately?"
    
    **Phase 4: Review (Once draft is ready)**
    - Propose handing off to the **Toxic Editor** for a quality check.
    
    **Guiding Principles**:
    1. **Be Action-Oriented**: Every response must move the project to the next step.
    2. **Provide Choices**: Users make decisions; you provide the menu.
    3. **Collaborative Tone**: Professional, encouraging, authoritative but flexible.
    4. **Language**: Simplified Chinese (简体中文).

    **MANDATORY OUTPUT REQUIREMENT (Suggestion Chips)**:
    At the very end of your response, strictly append a JSON array of 2-4 short, actionable suggestions for the user's next step.
    These suggestions acts as buttons the user will click. They MUST correspond to the options you listed above.
    
    Examples:
    - If you proposed 3 angles: :::SUGGESTIONS::: ["选角度1: [Name]", "选角度2: [Name]", "选角度3: [Name]"]
    - If you proposed structures: :::SUGGESTIONS::: ["采用方案A", "采用方案B", "修改大纲"]
    - If ready to draft: :::SUGGESTIONS::: ["让执行师开始写", "先做点调研", "我自己写"]
    - If reviewing: :::SUGGESTIONS::: ["交给毒舌主编评审", "继续完善"]
    
    Format string EXACTLY as:
    :::SUGGESTIONS::: ["Option 1", "Option 2", "Option 3"]
    
    Current Draft Content (Reference):
    ${currentDraft.substring(0, 1000)}... (truncated)
  `;

  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    history: history.map(h => ({
      role: h.role,
      parts: [{ text: h.text }],
    })),
    config: {
      systemInstruction,
    },
  });

  return chat.sendMessageStream({ message });
};

// --- Role 3: Researcher ---

export const performResearch = async (topic: string, context: string) => {
  const ai = getClient();
  const prompt = `
    Role: Senior Researcher (资深调研专家).
    Task: Conduct deep research on the topic requested by user.
    User Request: "${topic}"
    Context: ${context}
    
    Output Format:
    Produce a structured Markdown report in Simplified Chinese (简体中文).
    - Use H3 headers for sections.
    - Bullet points for Key Facts & Data.
    - Blockquotes for useful quotes.
    
    MANDATORY OUTPUT REQUIREMENT:
    At the very end, strictly append:
    :::SUGGESTIONS::: ["Incorporate these facts", "Research more on X", "Back to Chief"]

    Tone: Objective, rigorous, data-driven.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  return response.text;
};

// --- Role 4: Executor ---

export const executeWriting = async (
  instruction: string, 
  draftContext: string, 
  persona: Persona | null
) => {
  const ai = getClient();
  
  const styleGuide = persona ? `Strictly follow this style: ${JSON.stringify(persona.analysis)}` : "Use a professional, clear style.";

  const prompt = `
    Role: Executor (执行师).
    Task: Execute the writing command immediately. High speed, high quality.
    
    Command: "${instruction}"
    
    Context (Current Draft/Notes):
    ${draftContext}
    
    ${styleGuide}
    
    Output: Only the written content in Simplified Chinese (简体中文). Do not add introductory fluff. Use Markdown.
    
    MANDATORY OUTPUT REQUIREMENT:
    At the very end, strictly append:
    :::SUGGESTIONS::: ["Review with Editor", "Continue writing", "Adjust style"]
  `;

  const response = await ai.models.generateContentStream({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  return response;
};

// --- Role 5: Toxic Editor ---

export const critiqueDraft = async (draft: string, persona: Persona | null) => {
  const ai = getClient();
  
  const styleCheck = persona ? `Check against this specific style persona: ${JSON.stringify(persona.analysis)}` : "Check for general professional writing standards.";

  const prompt = `
    Role: Toxic Editor (毒舌主编).
    Task: Ruthless critique of the provided content.
    
    Content to Review:
    ${draft}
    
    ${styleCheck}
    
    Instructions:
    1. Identify Logic Holes (逻辑漏洞)
    2. Check Structure (结构混乱)
    3. Improve Phrasing (语句不通/文风不符)
    
    Output Format:
    - Point-by-point critique.
    - Provide concrete examples of what is wrong and how to fix it.
    - Be sharp but constructive.
    
    MANDATORY OUTPUT REQUIREMENT:
    At the very end, strictly append:
    :::SUGGESTIONS::: ["请你帮我一键修改", "我自己修改"]
  `;

  const response = await ai.models.generateContentStream({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  return response;
};

export const applyEditorFixes = async (
    draft: string, 
    critique: string, 
    persona: Persona | null
) => {
    const ai = getClient();
    const styleGuide = persona ? `Ensure the style matches: ${JSON.stringify(persona.analysis)}` : "";

    const prompt = `
        Role: Intelligent Editor.
        Task: Rewrite the provided draft to address the specific critique points.
        
        Original Draft:
        ${draft}
        
        Critique to Apply:
        ${critique}
        
        ${styleGuide}
        
        Instruction:
        - Return ONLY the rewritten full text.
        - Do not include any intro/outro ("Here is the fixed version...").
        - Do not include markdown code blocks (like \`\`\`markdown). Just the text.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });

    // Strip markdown code blocks if present
    let text = response.text || "";
    text = text.replace(/```markdown/g, '').replace(/```/g, '').trim();
    return text;
};
