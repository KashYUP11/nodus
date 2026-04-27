'use client';

import React, { useEffect, useMemo, useRef, useState } from "react";

type AgentKey = "exec" | "skep" | "synth";

type AgentCard = {
  key: AgentKey;
  name: string;
  role: string;
  shortRole: string;
  icon: string;
  color: string;
  glow: string;
  bg: string;
  border: string;
};

type HistoryItem = {
  id: string;
  text: string;
  time: string;
};

type UserAttachment = {
  id: string;
  name: string;
  type: string;
  url: string;
};

type ReasoningPanel = {
  summary?: string;
  keyPoints: string[];
  actionSteps: string[];
  risks: string[];
  conf: number;
  finalDecision?: string;
  tradeoffs?: string[];
  failureConditions?: string[];
};

type ReasonResponse = {
  exec: ReasoningPanel;
  skep: ReasoningPanel;
  synth: ReasoningPanel;
};

type TaskQuestion = {
  id: string;
  field: string;
  label: string;
  inputType: "text" | "date" | "select";
  options?: string[];
  placeholder?: string;
};

type TaskResponse = {
  taskType: "flight" | "hotel" | "food" | "generic" | "youtube";
  message: string;
  steps: string[];
  questions: TaskQuestion[];
  knownState: Record<string, string | null>;
  readyForExecution: boolean;
};

type ChatMessage =
  | {
      id: string;
      type: "user";
      text: string;
      attachments?: UserAttachment[];
    }
  | {
      id: string;
      type: "thinking";
      stepStates: Array<{
        agent: AgentKey;
        title: string;
        status: string;
        state: "inactive" | "active" | "done";
      }>;
    }
  | {
      id: string;
      type: "simple";
      text: string;
    }
  | {
      id: string;
      type: "reason";
      query: string;
      data: ReasonResponse;
    }
  | {
      id: string;
      type: "task";
      query: string;
      data: TaskResponse;
      answers: Record<string, string>;
    }
  | {
      id: string;
      type: "status";
      text: string;
      screenshot?: string;
      results?: Array<{
        name: string;
        price: string;
        rating: string;
        info: string;
        url: string;
      }>;
      url?: string;
      done?: boolean;
    };

const AGENTS: AgentCard[] = [
  {
    key: "exec",
    name: "Executive",
    role: "Generation Agent",
    shortRole: "Generation · Strategy",
    icon: "⬡",
    color: "#60c8f0",
    glow: "rgba(96,200,240,0.20)",
    bg: "rgba(96,200,240,0.07)",
    border: "rgba(96,200,240,0.25)",
  },
  {
    key: "skep",
    name: "Skeptic",
    role: "Critique Agent",
    shortRole: "Critique · Risk",
    icon: "⬢",
    color: "#f06090",
    glow: "rgba(240,96,144,0.20)",
    bg: "rgba(240,96,144,0.07)",
    border: "rgba(240,96,144,0.25)",
  },
  {
    key: "synth",
    name: "Synthesizer",
    role: "Resolution Agent",
    shortRole: "Resolution · Decision",
    icon: "⬟",
    color: "#c8f060",
    glow: "rgba(200,240,96,0.20)",
    bg: "rgba(200,240,96,0.07)",
    border: "rgba(200,240,96,0.25)",
  },
];

const SAMPLE_PILLS = [
  "Should we launch the product this quarter despite incomplete testing?",
  "Evaluate the risks of expanding into a new international market.",
  "Should we hire 5 new engineers now or outsource the project?",
  "Analyze whether we should pivot our business model to SaaS.",
];

const SAMPLE_TASKS = [
  "Book a flight from Goa to Delhi",
  "Book a hotel in Jaipur",
  "Order biryani in Gurgaon",
  "Open YouTube and play lo-fi music",
];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

function isDecisionQuery(q: string) {
  const l = q.toLowerCase();
  const keywords = [
    "should",
    "launch",
    "hire",
    "pivot",
    "expand",
    "invest",
    "strategy",
    "decide",
    "decision",
    "risk",
    "evaluate",
    "choose",
    "build",
    "buy",
    "outsource",
    "market",
    "product",
    "plan",
    "execute",
    "commit",
    "adopt",
    "scale",
    "partner",
    "acquire",
    "merge",
    "release",
    "deploy",
  ];
  return q.trim().length > 15 && keywords.some((k) => l.includes(k));
}

function isAgenticTaskQuery(q: string) {
  const l = q.toLowerCase();
  return [
    "book a flight",
    "flight",
    "hotel",
    "order food",
    "food",
    "open yt",
    "open youtube",
    "play music",
    "play song",
    "youtube",
    "play on youtube",
  ].some((k) => l.includes(k));
}

function buildFinalFallback(data: ReasonResponse) {
  return `Proceed with conditional execution. The Executive's strategic direction is valid. The Skeptic identified ${data.skep.risks.length} material risks, and the synthesized recommendation is to move with explicit gates, a risk owner, and validated success criteria before full commitment.`;
}

function autoResize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 110)}px`;
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function useScrollReveal() {
  useEffect(() => {
    const elements = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { threshold: 0.1 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

function useCustomCursor() {
  useEffect(() => {
    const cursor = document.getElementById("cursor");
    const ring = document.getElementById("cursorRing");
    if (!cursor || !ring) return;

    let cx = 0;
    let cy = 0;
    let rx = 0;
    let ry = 0;
    let frame = 0;

    const onMove = (e: MouseEvent) => {
      cx = e.clientX;
      cy = e.clientY;
      cursor.style.left = `${cx}px`;
      cursor.style.top = `${cy}px`;
    };

    const animate = () => {
      rx += (cx - rx) * 0.12;
      ry += (cy - ry) * 0.12;
      ring.style.left = `${rx}px`;
      ring.style.top = `${ry}px`;
      frame = requestAnimationFrame(animate);
    };

    const grow = () => {
      cursor.style.width = "18px";
      cursor.style.height = "18px";
      ring.style.width = "52px";
      ring.style.height = "52px";
    };

    const shrink = () => {
      cursor.style.width = "10px";
      cursor.style.height = "10px";
      ring.style.width = "36px";
      ring.style.height = "36px";
    };

    document.addEventListener("mousemove", onMove);
    animate();

    const targets = document.querySelectorAll(
      "button,a,.agent-card,.principle,.flow-node,.future-card,.es-pill,.agent-entry,.ptab,.exp-card,.panel-header"
    );
    targets.forEach((el) => {
      el.addEventListener("mouseenter", grow);
      el.addEventListener("mouseleave", shrink);
    });

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("mousemove", onMove);
      targets.forEach((el) => {
        el.removeEventListener("mouseenter", grow);
        el.removeEventListener("mouseleave", shrink);
      });
    };
  }, []);
}

function useHeroCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let frame = 0;
    const nodes: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      op: number;
      ph: number;
    }> = [];

    const resize = () => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width;
      canvas.height = height;
      nodes.length = 0;
      for (let i = 0; i < 60; i++) {
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          r: Math.random() * 2 + 1,
          op: Math.random() * 0.6 + 0.2,
          ph: Math.random() * Math.PI * 2,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 160) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(200,240,96,${(1 - d / 160) * 0.15})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }
      nodes.forEach((n) => {
        n.x += n.vx;
        n.y += n.vy;
        n.ph += 0.02;
        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,240,96,${n.op * (0.7 + 0.3 * Math.sin(n.ph))})`;
        ctx.fill();
      });
      frame = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [canvasRef]);
}

function usePhilosophyCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let angle = 0;
    let frame = 0;

    const draw = () => {
      ctx.clearRect(0, 0, 360, 360);
      angle += 0.005;

      [
        [80, "rgba(96,200,240,0.3)"],
        [120, "rgba(240,96,144,0.2)"],
        [160, "rgba(200,240,96,0.15)"],
      ].forEach(([r, s]) => {
        ctx.beginPath();
        ctx.arc(180, 180, Number(r), 0, Math.PI * 2);
        ctx.strokeStyle = String(s);
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      [
        { r: 80, a: angle * 1.5, c: "#60c8f0", s: 6 },
        { r: 120, a: -angle * 1.2, c: "#f06090", s: 5 },
        { r: 160, a: angle * 0.8, c: "#c8f060", s: 7 },
      ].forEach((o) => {
        const ox = 180 + Math.cos(o.a) * o.r;
        const oy = 180 + Math.sin(o.a) * o.r;
        ctx.beginPath();
        ctx.arc(ox, oy, o.s, 0, Math.PI * 2);
        ctx.fillStyle = o.c;
        ctx.shadowBlur = 20;
        ctx.shadowColor = o.c;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.moveTo(180, 180);
        ctx.lineTo(ox, oy);
        ctx.strokeStyle = `${o.c}33`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      const p2 = 0.8 + 0.2 * Math.sin(angle * 3);
      ctx.beginPath();
      ctx.arc(180, 180, 24 * p2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(200,240,96,0.1)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(180, 180, 10, 0, Math.PI * 2);
      ctx.fillStyle = "#c8f060";
      ctx.shadowBlur = 30;
      ctx.shadowColor = "#c8f060";
      ctx.fill();
      ctx.shadowBlur = 0;

      frame = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(frame);
  }, [canvasRef]);
}

function Panel({
  agent,
  data,
}: {
  agent: AgentCard;
  data: ReasoningPanel;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`panel ${agent.key} ${collapsed ? "collapsed" : ""}`}>
      <div className="panel-header" onClick={() => setCollapsed((v) => !v)}>
        <div className="panel-dot" />
        <div className="panel-name">{agent.name}</div>
        <span className="panel-badge">
          {agent.key === "exec" ? "GEN" : agent.key === "skep" ? "CRIT" : "SYNC"}
        </span>
        <span className="panel-toggle">▾</span>
      </div>

      <div className="panel-body">
        <div className="agent-banner">
          <div className="agent-orb">{agent.icon}</div>
          <div className="agent-banner-info">
            <div className="agent-banner-name">{agent.name} Agent</div>
            <div className="agent-banner-role">{agent.role}</div>
          </div>
          <div className="agent-pill">
            {agent.key === "exec" ? "EXECUTIVE AGENT" : agent.key === "skep" ? "SKEPTIC AGENT" : "SYNTHESIZER AGENT"}
          </div>
        </div>

        {data.summary ? <div className="agent-summary">"{data.summary}"</div> : null}

        <div className="panel-section">
          <div className="panel-section-label">◈ Key Points</div>
          <div className="panel-items">
            {data.keyPoints.map((item, index) => (
              <div className="panel-item" key={index}>{item}</div>
            ))}
          </div>
        </div>

        <div className="panel-section">
          <div className="panel-section-label">→ Action Steps</div>
          <div className="panel-items">
            {data.actionSteps.map((item, index) => (
              <div className="panel-item" key={index}>{item}</div>
            ))}
          </div>
        </div>

        <div className="panel-section">
          <div className="panel-section-label">⚠ Risks / Concerns</div>
          <div className="panel-items">
            {data.risks.map((item, index) => (
              <div className="panel-item" key={index}>{item}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskQuestionCard({
  question,
  onSubmit,
}: {
  question: TaskQuestion;
  onSubmit: (field: string, value: string) => void;
}) {
  const [value, setValue] = useState("");

  if (question.inputType === "select") {
    return (
      <div className="task-question-card">
        <div className="task-question-label">{question.label}</div>
        <div className="task-option-row">
          {(question.options || []).map((opt) => (
            <button
              key={opt}
              className="task-option-btn"
              onClick={() => onSubmit(question.field, opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (question.inputType === "date") {
    return (
      <div className="task-question-card">
        <div className="task-question-label">{question.label}</div>
        <div className="task-input-row">
          <input
            className="task-input"
            type="date"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button
            className="task-submit-btn"
            disabled={!value}
            onClick={() => onSubmit(question.field, value)}
          >
            Submit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="task-question-card">
      <div className="task-question-label">{question.label}</div>
      <div className="task-input-row">
        <input
          className="task-input"
          type="text"
          placeholder={question.placeholder || "Type your answer"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          className="task-submit-btn"
          disabled={!value.trim()}
          onClick={() => onSubmit(question.field, value.trim())}
        >
          Submit
        </button>
      </div>
    </div>
  );
}

export default function Page() {
  const heroCanvasRef = useRef<HTMLCanvasElement>(null);
  const philCanvasRef = useRef<HTMLCanvasElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);

  useHeroCanvas(heroCanvasRef);
  usePhilosophyCanvas(philCanvasRef);
  useCustomCursor();
  useScrollReveal();

  const [chatOpen, setChatOpen] = useState(false);
  const [activeAgent, setActiveAgent] = useState<AgentKey>("exec");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLink, setShareLink] = useState("https://nodus.ai/decision/—");
  const [toast, setToast] = useState("");
  const [attachments, setAttachments] = useState<UserAttachment[]>([]);

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [messages, busy]);

  useEffect(() => {
    autoResize(textareaRef.current);
  }, [input]);

  const openChat = () => {
    setChatOpen(true);
    document.body.style.overflow = "hidden";
  };

  const closeChat = () => {
    setChatOpen(false);
    document.body.style.overflow = "";
  };

  const clearSession = () => {
    setMessages([]);
    setAttachments([]);
  };

  const pushHistory = (text: string) => {
    setHistory((prev) => [
      {
        id: uid(),
        text,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
      ...prev,
    ]);
  };

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 2200);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAttachments((prev) => [
      ...prev,
      {
        id: uid(),
        name: f.name,
        type: f.type,
        url: URL.createObjectURL(f),
      },
    ]);
    e.target.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const updateThinking = (index: number, state: "inactive" | "active" | "done", title: string, status: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.type !== "thinking") return m;
        const next = [...m.stepStates];
        next[index] = { ...next[index], state, title, status };
        return { ...m, stepStates: next };
      })
    );
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || busy) return;

    setBusy(true);
    setInput("");
    pushHistory(text);

    const userMessage: ChatMessage = {
      id: uid(),
      type: "user",
      text,
      attachments,
    };
    setMessages((prev) => [...prev, userMessage]);
    setAttachments([]);

    try {
      if (isDecisionQuery(text)) {
        const thinkingBlock: ChatMessage = {
          id: uid(),
          type: "thinking",
          stepStates: [
            { agent: "exec", title: "Executive", status: "Initializing…", state: "inactive" },
            { agent: "skep", title: "Skeptic", status: "Waiting for Executive output…", state: "inactive" },
            { agent: "synth", title: "Synthesizer", status: "Waiting for both agents…", state: "inactive" },
          ],
        };
        setMessages((prev) => [...prev, thinkingBlock]);

        updateThinking(0, "active", "Executive thinking…", "Generating strategic plan and action steps…");

        const res = await fetch(`${API_BASE}/reason`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: text }),
        });

        if (!res.ok) throw new Error("Reasoning request failed");

        const data: ReasonResponse = await res.json();

        updateThinking(0, "done", "Executive complete ✓", "Plan generated.");
        updateThinking(1, "done", "Skeptic complete ✓", "Critique delivered.");
        updateThinking(2, "done", "Synthesis complete ✓", "Decision validated.");

        await wait(350);

        setMessages((prev) => {
          const filtered = prev.filter((m) => m.type !== "thinking");
          return [
            ...filtered,
            {
              id: uid(),
              type: "reason",
              query: text,
              data,
            },
          ];
        });

      } else if (isAgenticTaskQuery(text)) {
        const statusId = uid();
        setMessages((prev) => [
          ...prev,
          {
            id: statusId,
            type: "status",
            text: "NODUS is planning the task...",
          },
        ]);

        const planRes = await fetch(`${API_BASE}/task`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task: text,
            agent: "Commander",
            answers: {},
          }),
        });

        if (!planRes.ok) throw new Error("Task planning failed");

        const data: TaskResponse = await planRes.json();

        setMessages((prev) => prev.filter((m) => m.id !== statusId));
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            type: "task",
            query: text,
            data,
            answers: {},
          },
        ]);

        if (data.readyForExecution) {
          const execStatusId = uid();
          setMessages((prev) => [
            ...prev,
            {
              id: execStatusId,
              type: "status",
              text: "NODUS is executing the browser task...",
            },
          ]);

          const execRes = await fetch(`${API_BASE}/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              taskType: data.taskType,
              knownState: data.knownState,
              submittedTask: text,
            }),
          });

          const execData = await execRes.json();
          setMessages((prev) => {
            // Remove the "executing" status and previous status messages for this task
            const filtered = prev.filter(m => m.id !== execStatusId && (m.type !== "status" || m.text.includes("Planning"))); 
            return [
              ...filtered,
              {
                id: uid(),
                type: "status",
                text: execData.error ? `Error: ${execData.error}` : (execData.message || "Task completed."),
                screenshot: execData.screenshot,
                results: execData.results,
                url: execData.url,
                done: true
              },
            ];
          });
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            type: "status",
            text: "NODUS is reasoning…",
          },
        ]);

        const res = await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: text }),
        });

        let reply = "The NODUS reasoning core is currently initializing. Please try again in a moment.";
        if (res.ok) {
          const data = await res.json();
          reply = data.message || reply;
        }

        setMessages((prev) => {
          const next = [...prev];
          const lastStatusIndex = next.map((m) => m.type).lastIndexOf("status");
          if (lastStatusIndex >= 0) next.splice(lastStatusIndex, 1);
          next.push({
            id: uid(),
            type: "simple",
            text: reply,
          });
          return next;
        });
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          type: "simple",
          text: "The NODUS reasoning core is currently unavailable. Check the backend and try again.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const answerTaskQuestion = async (messageId: string, field: string, value: string) => {
    const target = messages.find((m) => m.id === messageId);
    if (!target || target.type !== "task") return;

    const answers = {
      ...target.answers,
      [field]: value,
    };

    try {
      const planRes = await fetch(`${API_BASE}/task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: target.query,
          agent: "Commander",
          answers,
        }),
      });

      if (!planRes.ok) throw new Error("Task refinement failed");
      const data: TaskResponse = await planRes.json();

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.type === "task"
            ? { ...m, data, answers }
            : m
        )
      );

      if (data.readyForExecution) {
        const execStatusId = uid();
        setMessages((prev) => [
          ...prev,
          {
            id: execStatusId,
            type: "status",
            text: "NODUS is executing the browser task...",
          },
        ]);

        const execRes = await fetch(`${API_BASE}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskType: data.taskType,
            knownState: data.knownState,
            submittedTask: target.query,
          }),
        });
        const execData = await execRes.json();
        setMessages((prev) => {
          const filtered = prev.filter(m => m.id !== execStatusId);
          return [
            ...filtered,
            {
              id: uid(),
              type: "status",
              text: execData.error ? `Error: ${execData.error}` : (execData.message || "Task completed."),
              screenshot: execData.screenshot,
              results: execData.results,
              url: execData.url,
              done: true
            },
          ];
        });
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          type: "simple",
          text: "Task update failed. Please try again.",
        },
      ]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const usePill = (text: string) => {
    setInput(text);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      showToast("Link copied to clipboard");
    } catch {
      showToast("Copy failed");
    }
  };

  const openShareModal = () => {
    setShareLink(`https://nodus.ai/decision/${Math.random().toString(36).slice(2, 10)}`);
    setShareOpen(true);
  };

  return (
    <>
      <div className="cursor" id="cursor" />
      <div className="cursor-ring" id="cursorRing" />

      <div id="mainSite">
        <nav>
          <div className="nav-logo">N<span>O</span>DUS</div>
          <div className="nav-links">
            <a href="#concept">Agents</a>
            <a href="#architecture">Architecture</a>
            <a href="#philosophy">Philosophy</a>
            <a href="#preview">System</a>
            <a href="#future">Future</a>
          </div>
          <button className="nav-cta" onClick={openChat}>Launch System</button>
        </nav>

        <section id="hero">
          <canvas id="heroCanvas" ref={heroCanvasRef} />
          <div className="hero-tag">Cognitive Decision System · v0.1 Alpha</div>
          <h1 className="hero-headline">
            <div>Think.</div>
            <div className="line2">Challenge.</div>
            <div>Decide.</div>
          </h1>
          <p className="hero-sub">
            NODUS is not a chatbot. It is a structured intelligence system that generates, critiques, and synthesizes decisions through autonomous multi-agent reasoning.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={openChat}>Explore the System</button>
            <button
              className="btn-ghost"
              onClick={() => document.getElementById("preview")?.scrollIntoView({ behavior: "smooth" })}
            >
              Watch It Think
            </button>
          </div>
          <div className="hero-scroll">
            <div className="scroll-line" />
            Scroll to discover
          </div>
        </section>

        <div className="marquee-wrap">
          <div className="marquee-inner">
            <span>Executive Agent</span><span className="dot">◆</span>
            <span>Skeptic Agent</span><span className="dot">◆</span>
            <span>Synthesizer Agent</span><span className="dot">◆</span>
            <span>Execptic Core</span><span className="dot">◆</span>
            <span>Decision Intelligence</span><span className="dot">◆</span>
            <span>Structured Reasoning</span><span className="dot">◆</span>
            <span>Outcome Simulation</span><span className="dot">◆</span>
            <span>Controlled Autonomy</span><span className="dot">◆</span>
            <span>Executive Agent</span><span className="dot">◆</span>
            <span>Skeptic Agent</span><span className="dot">◆</span>
            <span>Synthesizer Agent</span><span className="dot">◆</span>
          </div>
        </div>

        <section id="concept">
          <div className="concept-header reveal">
            <div>
              <div className="section-label">Core Agents</div>
              <h2 className="concept-headline">
                Three minds.<br /><em>One decision.</em>
              </h2>
            </div>
            <p className="concept-desc">
              NODUS operates through a tri-agent cognitive system. Each agent has a distinct function, none acts alone. Intelligence emerges from their conflict and resolution.
            </p>
          </div>

          <div className="agents-grid">
            {AGENTS.map((a, i) => (
              <div className={`agent-card ${a.key} reveal reveal-delay-${Math.min(i + 1, 3)}`} key={a.key}>
                <div className="agent-index">{String(i + 1).padStart(2, "0")} / 03</div>
                <div className="agent-icon">
                  <div className="agent-icon-ring">{a.icon}</div>
                </div>
                <h3 className="agent-name">{a.name}</h3>
                <div className="agent-role">{a.role}</div>
                <p className="agent-desc">
                  {a.key === "exec"
                    ? "The Executive agent generates structured plans, strategies, and forward-looking actions based on context, objectives, and available data."
                    : a.key === "skep"
                    ? "The Skeptic agent critically evaluates every plan, identifying risks, logical flaws, hidden assumptions, and blind spots."
                    : "The Synthesizer resolves the tension between Executive and Skeptic, integrating both into a refined and actionable decision."}
                </p>
                <div className="agent-tags">
                  {a.key === "exec" ? (
                    <>
                      <span className="tag">Planning</span>
                      <span className="tag">Strategy</span>
                      <span className="tag">Generation</span>
                      <span className="tag">Forward-action</span>
                    </>
                  ) : a.key === "skep" ? (
                    <>
                      <span className="tag">Risk Analysis</span>
                      <span className="tag">Critique</span>
                      <span className="tag">Validation</span>
                      <span className="tag">Assumption-check</span>
                    </>
                  ) : (
                    <>
                      <span className="tag">Synthesis</span>
                      <span className="tag">Resolution</span>
                      <span className="tag">Balance</span>
                      <span className="tag">Final-decision</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="architecture">
          <div className="arch-inner">
            <div className="arch-header reveal">
              <div className="section-label">Execptic Core</div>
              <h2 className="arch-title">The reasoning loop</h2>
            </div>

            <div className="flow-container reveal">
              <div className="flow-node fn-input">
                <div className="flow-node-inner">
                  <div className="flow-node-circle">INPUT</div>
                  <div className="flow-node-label">Context</div>
                  <div className="flow-node-sub">Raw signal</div>
                </div>
              </div>

              <div className="flow-arrow">
                <div className="flow-arrow-line">
                  <div className="flow-dot" />
                </div>
                <div className="flow-arrow-head" />
              </div>

              <div className="flow-node fn-exec">
                <div className="flow-node-inner">
                  <div className="flow-node-circle">EXEC</div>
                  <div className="flow-node-label">Executive</div>
                  <div className="flow-node-sub">Generate plan</div>
                </div>
              </div>

              <div className="flow-arrow">
                <div className="flow-arrow-line">
                  <div className="flow-dot" />
                </div>
                <div className="flow-arrow-head" />
              </div>

              <div className="flow-node fn-skep">
                <div className="flow-node-inner">
                  <div className="flow-node-circle">SKEP</div>
                  <div className="flow-node-label">Skeptic</div>
                  <div className="flow-node-sub">Critique plan</div>
                </div>
              </div>

              <div className="flow-arrow">
                <div className="flow-arrow-line">
                  <div className="flow-dot" />
                </div>
                <div className="flow-arrow-head" />
              </div>

              <div className="flow-node fn-synth">
                <div className="flow-node-inner">
                  <div className="flow-node-circle">SYNTH</div>
                  <div className="flow-node-label">Synthesizer</div>
                  <div className="flow-node-sub">Resolve & refine</div>
                </div>
              </div>

              <div className="flow-arrow">
                <div className="flow-arrow-line">
                  <div className="flow-dot" />
                </div>
                <div className="flow-arrow-head" />
              </div>

              <div className="flow-node fn-output">
                <div className="flow-node-inner">
                  <div className="flow-node-circle">OUT</div>
                  <div className="flow-node-label">Execution</div>
                  <div className="flow-node-sub">Validated decision</div>
                </div>
              </div>

              <div className="loop-indicator">
                <div className="loop-icon">↺</div>
                Continuous Execptic Loop · iterates until confidence threshold
              </div>
            </div>
          </div>
        </section>

        <section id="philosophy">
          <div className="philosophy-inner">
            <div className="philosophy-left">
              <div className="section-label reveal">Intelligence Philosophy</div>
              <h2 className="philosophy-title reveal">
                Not answers.<br /><em>Decisions.</em>
              </h2>
              <div className="principles reveal">
                {[
                  ["01", "Think before acting", "Every output is preceded by a structured reasoning cycle. NODUS never responds instantly, it deliberates."],
                  ["02", "Critique before confidence", "No plan is accepted without adversarial review. The Skeptic ensures every assumption is tested before commitment."],
                  ["03", "Simulate consequences", "Outcome-awareness is built into the core loop. NODUS models the consequences of each decision before execution."],
                  ["04", "Decisions over responses", "The goal is never to respond. It is to decide, with precision, accountability, and structured reasoning."],
                ].map(([num, title, desc]) => (
                  <div className="principle" key={num}>
                    <span className="principle-num">{num}</span>
                    <div className="principle-text">
                      <div className="principle-title">{title}</div>
                      <div className="principle-desc">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="philosophy-right reveal">
              <div className="philosophy-visual">
                <canvas id="philCanvas" ref={philCanvasRef} width={360} height={360} />
              </div>
            </div>
          </div>
        </section>

        <section id="preview">
          <div className="preview-inner">
            <div className="preview-header reveal">
              <div className="section-label">Live System</div>
              <h2 className="preview-title">Experience NODUS thinking</h2>
              <p className="preview-sub">
                Enter the Execptic Core. Submit a decision. Watch three agents reason, challenge, and synthesize in real time, structured, layered, and alive.
              </p>
              <button className="enter-chat-btn reveal" onClick={openChat}>
                Enter the Execptic Core <span className="btn-arrow">→</span>
              </button>
            </div>
          </div>
        </section>

        <section id="future">
          <div className="future-bg" />
          <div className="future-inner">
            <div className="section-label reveal" style={{ justifyContent: "center" }}>Future Layer</div>
            <h2 className="future-title reveal">
              The foundation of<br /><em>autonomous intelligence</em>
            </h2>
            <p className="future-desc reveal">
              NODUS is not the destination. It is the infrastructure. A substrate for supervised autonomous systems that act with purpose, accountability, and internal validation at every step.
            </p>
            <div className="future-grid reveal">
              <div className="future-card">
                <div className="future-card-icon">◉</div>
                <div className="future-card-title">Controlled Autonomy</div>
                <div className="future-card-desc">Autonomous action within defined constraint boundaries. Every decision is validated before execution.</div>
              </div>
              <div className="future-card">
                <div className="future-card-icon">⊕</div>
                <div className="future-card-title">Decision Validation</div>
                <div className="future-card-desc">Multi-layer internal review before any action is taken. No single-point reasoning. No unchecked outputs.</div>
              </div>
              <div className="future-card">
                <div className="future-card-icon">⊗</div>
                <div className="future-card-title">Supervised Intelligence</div>
                <div className="future-card-desc">Human oversight embedded structurally, not as an afterthought. Transparency in reasoning, accountability in execution.</div>
              </div>
            </div>
            <div className="future-cta reveal">
              <div className="cta-line" />
              From answering to thinking to deciding, the evolution of intelligence
              <div className="cta-line" style={{ transform: "rotate(180deg)" }} />
            </div>
          </div>
        </section>

        <footer>
          <div className="footer-inner">
            <div className="footer-brand">
              <div className="footer-logo">N<span>O</span>DUS</div>
              <p className="footer-tagline">Cognitive AI. Structured Reasoning.<br />Decision Intelligence.</p>
            </div>
            <div>
              <div className="footer-col-title">System</div>
              <div className="footer-links">
                <a href="#">Architecture</a>
                <a href="#">Agents</a>
                <a href="#">Execptic Core</a>
                <a href="#">Roadmap</a>
              </div>
            </div>
            <div>
              <div className="footer-col-title">Research</div>
              <div className="footer-links">
                <a href="#">White Paper</a>
                <a href="#">Case Studies</a>
                <a href="#">Publications</a>
                <a href="#">Open Source</a>
              </div>
            </div>
            <div>
              <div className="footer-col-title">Access</div>
              <div className="footer-links">
                <a href="#" onClick={(e) => { e.preventDefault(); openChat(); }}>Launch System</a>
                <a href="#">Contact</a>
                <a href="#">Partnerships</a>
                <a href="#">Careers</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <div className="footer-copy">© 2025 NODUS Intelligence Systems. All rights reserved.</div>
            <div className="footer-sys"><div className="status-pulse" />Execptic Core · Online</div>
          </div>
        </footer>
      </div>

      <div id="chatOverlay" className={chatOpen ? "open" : ""}>
        <div className="chat-topbar">
          <button className="chat-back" onClick={closeChat}>← Back</button>
          <div className="chat-top-sep" />
          <div className="chat-top-logo">N<span>O</span>DUS</div>
          <div className="chat-top-sep" />
          <div className="chat-top-tag">Execptic Core v0.1</div>
          <div className="chat-top-status">
            <div className="status-pulse" />
            3 Agents · System Online
          </div>
          <div className="chat-top-btns">
            <button className="cht-btn" onClick={clearSession}>New Session</button>
            <button className="cht-btn accent" onClick={openShareModal}>⇡ Share</button>
          </div>
        </div>

        <div className="chat-body">
          <div className="chat-sidebar">
            <div className="cs-section">
              <div className="cs-label">Active Agents</div>
              <div className="agent-list">
                {AGENTS.map((a) => (
                  <div
                    key={a.key}
                    className={`agent-entry ${a.key} ${activeAgent === a.key ? "active" : ""}`}
                    onClick={() => setActiveAgent(a.key)}
                  >
                    <div className="ae-dot" />
                    <div className="ae-info">
                      <div className="ae-name">{a.name}</div>
                      <div className="ae-role">{a.shortRole}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="cs-divider" />

            <div className="cs-section">
              <div className="cs-label">Session History</div>
            </div>

            <div className="history-scroll">
              {history.length === 0 ? (
                <div className="no-history">No sessions yet</div>
              ) : (
                history.map((item, idx) => (
                  <div className={`hist-item ${idx === 0 ? "active" : ""}`} key={item.id}>
                    <div className="hist-time">{item.time}</div>
                    <div className="hist-text">
                      {item.text.length > 50 ? `${item.text.slice(0, 50)}…` : item.text}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="chat-main">
            <div className="panel-tabs-bar">
              {AGENTS.map((a) => (
                <div
                  key={a.key}
                  className={`ptab ${a.key} ${activeAgent === a.key ? "active" : ""}`}
                  onClick={() => setActiveAgent(a.key)}
                >
                  <div className="ptab-dot" />
                  <div className="ptab-info">
                    <div className="ptab-name">{a.name}</div>
                    <div className="ptab-role">
                      {a.key === "exec"
                        ? "Generates plans & actions"
                        : a.key === "skep"
                        ? "Challenges & critiques"
                        : "Resolves & decides"}
                    </div>
                  </div>
                  <div className="ptab-badge">
                    {a.key === "exec" ? "GEN" : a.key === "skep" ? "CRIT" : "SYNC"}
                  </div>
                </div>
              ))}
            </div>

            <div className="conversation" ref={conversationRef}>
              {messages.length === 0 ? (
                <div className="empty-state">
                  <div className="es-logo">NODUS</div>
                  <div className="es-title">What should we decide?</div>
                  <div className="es-sub">
                    Three agents will think, challenge, and synthesize a structured decision, layered, not instant.
                  </div>
                  <div className="es-pills">
                    {SAMPLE_PILLS.map((pill) => (
                      <div className="es-pill" key={pill} onClick={() => usePill(pill)}>
                        {pill.includes("launch")
                          ? "Product Launch Decision"
                          : pill.includes("international")
                          ? "Market Expansion"
                          : pill.includes("hire")
                          ? "Hire vs Outsource"
                          : "Business Model Pivot"}
                      </div>
                    ))}
                    {SAMPLE_TASKS.map((pill) => (
                      <div className="es-pill" key={pill} onClick={() => usePill(pill)}>
                        {pill}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  if (msg.type === "user") {
                    return (
                      <div className="user-msg-wrap" key={msg.id}>
                        <div className="user-msg">
                          <div className="umsg-label">Input Query</div>
                          <div className="umsg-text">{msg.text}</div>
                          {(msg.attachments || []).map((a) =>
                            a.type.startsWith("image/") ? (
                              <img className="umsg-img" src={a.url} alt="" key={a.id} />
                            ) : null
                          )}
                        </div>
                      </div>
                    );
                  }

                  if (msg.type === "thinking") {
                    return (
                      <div className="thinking-block" key={msg.id}>
                        {msg.stepStates.map((s, idx) => {
                          const agent = AGENTS.find((a) => a.key === s.agent)!;
                          return (
                            <div className={`ts ts-${s.agent} ${s.state}`} key={`${msg.id}-${idx}`}>
                              <div className="ts-orb">{agent.icon}</div>
                              <div className="ts-info">
                                <div className="ts-name" style={{ color: agent.color }}>{s.title}</div>
                                <div className="ts-status">{s.status}</div>
                              </div>
                              <div className="ts-dots" style={{ color: agent.color }}>
                                {s.state === "done" ? <span style={{ width: "auto", height: "auto", background: "transparent", opacity: 1 }}>✓</span> : <><span /><span /><span /></>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  if (msg.type === "simple") {
                    return (
                      <div className="simple-resp" key={msg.id}>
                        <div className="srb">
                          <div className="srb-dot" />
                          <div className="srb-lbl">NODUS · Direct Response</div>
                        </div>
                        <div className="srb-body">{msg.text}</div>
                      </div>
                    );
                  }

                  if (msg.type === "status") {
                    return (
                      <div className={`typing-ind ${msg.done ? "done-status" : ""}`} key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {!msg.done && <div className="td"><span /><span /><span /></div>}
                          {msg.done && <div className="srb-dot" />}
                          <div className="tl">{msg.text}</div>
                        </div>

                        {msg.results && msg.results.length > 0 && (
                          <div style={{ marginTop: 16, width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                            {msg.results.map((res, i) => (
                              <div key={i} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', padding: '12px' }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>{res.name}</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600 }}>{res.price}</div>
                                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{res.rating}</div>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-mid)', lineHeight: 1.4, marginBottom: 12 }}>{res.info}</div>
                                <a 
                                  href={res.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="task-submit-btn"
                                  style={{ display: 'block', textAlign: 'center', textDecoration: 'none', background: 'var(--accent)', color: '#000', fontWeight: 700 }}
                                >
                                  Book Now
                                </a>
                              </div>
                            ))}
                          </div>
                        )}

                        {msg.screenshot && (
                          <div style={{ marginTop: 16, width: '100%', border: '1px solid var(--border)', background: '#000', overflow: 'hidden', borderRadius: 4 }}>
                            <a href={msg.url || '#'} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
                              <div style={{ padding: '6px 12px', background: 'var(--surface2)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                                <span>BROWSER VIEWPORT (1280x1000)</span>
                                <span style={{ color: 'var(--accent)' }}>CLICK TO OPEN LIVE PAGE ↗</span>
                              </div>
                              <img 
                                src={msg.screenshot} 
                                alt="Browser View" 
                                style={{ width: '100%', height: 'auto', display: 'block' }} 
                              />
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (msg.type === "task") {
                    return (
                      <div className="simple-resp" key={msg.id}>
                        <div className="srb">
                          <div className="srb-dot" />
                          <div className="srb-lbl">NODUS · Agentic Task Plan</div>
                        </div>
                        <div className="srb-body">
                          <div style={{ marginBottom: 12 }}>{msg.data.message}</div>
                          <div className="task-steps">
                            {msg.data.steps.map((step, idx) => (
                              <div className="task-step" key={idx}>{step}</div>
                            ))}
                          </div>
                          {msg.data.questions.length > 0 ? (
                            <div className="task-q-list">
                              {msg.data.questions.map((q) => (
                                <TaskQuestionCard
                                  key={q.id}
                                  question={q}
                                  onSubmit={(field, value) => answerTaskQuestion(msg.id, field, value)}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="task-ready">
                              {msg.data.readyForExecution
                                ? "Task is ready for execution."
                                : "No more questions right now."}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="resp-block" key={msg.id}>
                      <div className="resp-header">
                        <div className="resp-label">Execptic Core · Chained Decision Output</div>
                        <div className="resp-line" />
                        <div className="resp-actions">
                          <button className="ra-btn share" onClick={openShareModal}>⇡ Share</button>
                        </div>
                      </div>

                      <div className="chain-flow-indicator">
                        <div className="cfi-step exec-c">⬡ Executive</div>
                        <div className="cfi-arrow">→</div>
                        <div className="cfi-step skep-c">⬢ Skeptic</div>
                        <div className="cfi-arrow">→</div>
                        <div className="cfi-step synth-c">⬟ Synthesizer</div>
                        <div className="cfi-label">Chained · Sequential · Context-aware</div>
                      </div>

                      <div className="panels-grid">
                        <Panel agent={AGENTS[0]} data={msg.data.exec} />
                        <Panel agent={AGENTS[1]} data={msg.data.skep} />
                        <Panel agent={AGENTS[2]} data={msg.data.synth} />
                      </div>

                      <div className="final-dec">
                        <div className="fd-label">✦ Final Synthesized Decision</div>
                        <div className="fd-text">{msg.data.synth.finalDecision || buildFinalFallback(msg.data)}</div>
                        <div className="fd-bar-row">
                          <div className="fd-bar-label">CONFIDENCE</div>
                          <div className="fd-bar">
                            <div className="fd-bar-fill" style={{ width: `${msg.data.synth.conf}%` }} />
                          </div>
                          <div className="fd-bar-val">{msg.data.synth.conf}%</div>
                        </div>

                        {(msg.data.synth.tradeoffs?.length || msg.data.synth.failureConditions?.length) ? (
                          <div className="meta-layer">
                            <div className="meta-header">
                              <div className="meta-title">⊕ Synthesizer Meta-Analysis</div>
                              <div className="meta-sub">Confidence layer · Trade-offs · Failure conditions</div>
                            </div>
                            <div className="meta-grid">
                              {msg.data.synth.tradeoffs?.length ? (
                                <div className="meta-col">
                                  <div className="meta-col-label">Key Trade-offs</div>
                                  {msg.data.synth.tradeoffs.map((t, i) => (
                                    <div className="meta-item" key={i}>
                                      <span className="meta-icon">⇄</span>{t}
                                    </div>
                                  ))}
                                </div>
                              ) : null}

                              {msg.data.synth.failureConditions?.length ? (
                                <div className="meta-col">
                                  <div className="meta-col-label">When This Decision Fails</div>
                                  {msg.data.synth.failureConditions.map((f, i) => (
                                    <div className="meta-item" key={i}>
                                      <span className="meta-icon">⚡</span>{f}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="input-area">
              <div className="attach-list">
                {attachments.map((a) => (
                  <div className="attach-chip" key={a.id}>
                    <span>📎 {a.name}</span>
                    <button onClick={() => removeAttachment(a.id)}>✕</button>
                  </div>
                ))}
              </div>

              <div className="input-row">
                <textarea
                  ref={textareaRef}
                  className="input-ta"
                  value={input}
                  rows={1}
                  placeholder="Ask NODUS to think through a decision…"
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                />

                <div className="ia-btns">
                  <input id="fileInput" type="file" accept="image/*" hidden onChange={onFileChange} />
                  <button className="ia-btn" title="Attach image" onClick={() => document.getElementById("fileInput")?.click()}>
                    📎
                  </button>
                  <button className="ia-btn" title="Voice input">
                    🎙
                  </button>
                  <button className="send-btn" disabled={!input.trim() || busy} onClick={sendMessage}>
                    ➤
                  </button>
                </div>
              </div>

              <div className="input-hint">
                <span>⏎ Send</span>
                <span>⇧⏎ New line</span>
                <span>Execptic Core · 3-layer reasoning</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`modal-bg ${shareOpen ? "open" : ""}`} onClick={() => setShareOpen(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <div className="modal-head-title">Share Decision</div>
            <button className="modal-close" onClick={() => setShareOpen(false)}>✕</button>
          </div>
          <div className="modal-body">
            <div className="modal-section">
              <div className="ml">Shareable Link</div>
              <div className="link-row">
                <input className="link-input" readOnly value={shareLink} />
                <button className="copy-btn" onClick={copyLink}>Copy</button>
              </div>
            </div>

            <div className="modal-section">
              <div className="ml">Export Decision</div>
              <div className="export-row">
                <div className="exp-card">
                  <div className="exp-icon">📄</div>
                  <div className="exp-name">Export as PDF</div>
                  <div className="exp-desc">Clean print-ready layout</div>
                </div>
                <div className="exp-card">
                  <div className="exp-icon">📝</div>
                  <div className="exp-name">Export as DOC</div>
                  <div className="exp-desc">Editable Word document</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500&display=swap');

        :root {
          --bg: #080809;
          --surface: #0e0e10;
          --surface2: #141416;
          --surface3: #1a1a1e;
          --border: rgba(255,255,255,0.06);
          --border2: rgba(255,255,255,0.11);
          --accent: #c8f060;
          --accent-dim: rgba(200,240,96,0.12);
          --accent-glow: rgba(200,240,96,0.25);
          --text: #f0f0ee;
          --text-dim: rgba(240,240,238,0.45);
          --text-mid: rgba(240,240,238,0.7);
          --exec: #60c8f0;
          --exec-bg: rgba(96,200,240,0.07);
          --exec-border: rgba(96,200,240,0.25);
          --exec-glow: rgba(96,200,240,0.2);
          --skep: #f06090;
          --skep-bg: rgba(240,96,144,0.07);
          --skep-border: rgba(240,96,144,0.25);
          --skep-glow: rgba(240,96,144,0.2);
          --synth: #c8f060;
          --synth-bg: rgba(200,240,96,0.07);
          --synth-border: rgba(200,240,96,0.25);
          --synth-glow: rgba(200,240,96,0.2);
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body {
          background: var(--bg);
          color: var(--text);
          font-family: 'Syne', sans-serif;
          overflow-x: hidden;
          cursor: none;
        }

        .cursor {
          position: fixed; width: 10px; height: 10px;
          background: var(--accent); border-radius: 50%;
          pointer-events: none; z-index: 9999;
          transform: translate(-50%,-50%);
          transition: width 0.3s, height 0.3s;
          mix-blend-mode: difference;
        }
        .cursor-ring {
          position: fixed; width: 36px; height: 36px;
          border: 1px solid rgba(200,240,96,0.5);
          border-radius: 50%; pointer-events: none; z-index: 9998;
          transform: translate(-50%,-50%);
          transition: width 0.3s, height 0.3s, opacity 0.3s;
        }

        nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 200;
          padding: 28px 60px;
          display: flex; align-items: center; justify-content: space-between;
          background: linear-gradient(to bottom, rgba(8,8,9,0.97) 0%, transparent 100%);
        }
        .nav-logo { font-family: 'DM Serif Display', serif; font-size: 22px; letter-spacing: -0.5px; }
        .nav-logo span { color: var(--accent); }
        .nav-links { display: flex; gap: 40px; }
        .nav-links a {
          font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase;
          color: var(--text-dim); text-decoration: none; transition: color 0.3s;
        }
        .nav-links a:hover { color: var(--accent); }
        .nav-cta, .btn-primary, .btn-ghost, .enter-chat-btn { cursor: none; }
        .nav-cta {
          font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase;
          padding: 10px 24px; border: 1px solid var(--accent);
          color: var(--accent); background: transparent; transition: all 0.3s;
        }
        .nav-cta:hover { background: var(--accent); color: #000; }

        #hero {
          min-height: 100vh; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          position: relative; overflow: hidden; padding: 0 40px;
        }
        #heroCanvas { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0.7; }
        .hero-tag {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px; letter-spacing: 0.2em; color: var(--accent);
          background: var(--accent-dim); border: 1px solid rgba(200,240,96,0.2);
          padding: 6px 16px; margin-bottom: 48px; display: inline-block;
          text-transform: uppercase; animation: fadeUp 1s ease 0.3s both; z-index: 2;
        }
        .hero-headline {
          font-family: 'DM Serif Display', serif;
          font-size: clamp(64px, 9vw, 140px); line-height: 0.92;
          text-align: center; letter-spacing: -0.03em;
          position: relative; z-index: 2; animation: fadeUp 1s ease 0.5s both;
        }
        .hero-headline .line2 { font-style: italic; color: var(--accent); }
        .hero-sub {
          margin-top: 40px; font-size: 16px; line-height: 1.7;
          color: var(--text-mid); text-align: center; max-width: 520px;
          font-weight: 400; animation: fadeUp 1s ease 0.7s both; position: relative; z-index: 2;
        }
        .hero-actions {
          display: flex; gap: 20px; margin-top: 56px;
          animation: fadeUp 1s ease 0.9s both; z-index: 2; position: relative;
        }
        .btn-primary {
          padding: 16px 40px; background: var(--accent); color: #000;
          font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase; border: none;
          transition: all 0.3s; position: relative; overflow: hidden;
        }
        .btn-primary::after {
          content: ''; position: absolute; inset: 0;
          background: rgba(255,255,255,0.2); transform: translateX(-100%); transition: transform 0.4s;
        }
        .btn-primary:hover::after { transform: translateX(0); }
        .btn-ghost {
          padding: 16px 40px; background: transparent; color: var(--text-mid);
          font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 500;
          letter-spacing: 0.08em; text-transform: uppercase;
          border: 1px solid var(--border); transition: all 0.3s;
        }
        .btn-ghost:hover { border-color: var(--text-dim); color: var(--text); }
        .hero-scroll {
          position: absolute; bottom: 48px;
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          animation: fadeUp 1s ease 1.2s both; color: var(--text-dim);
          font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase;
          font-family: 'JetBrains Mono', monospace; z-index: 2;
        }
        .scroll-line {
          width: 1px; height: 48px;
          background: linear-gradient(to bottom, var(--accent), transparent);
          animation: scrollPulse 2s ease infinite;
        }

        .marquee-wrap {
          overflow: hidden; background: var(--accent);
          padding: 14px 0; white-space: nowrap;
        }
        .marquee-inner {
          display: inline-block; animation: marquee 30s linear infinite;
          font-size: 11px; font-weight: 700; letter-spacing: 0.25em;
          text-transform: uppercase; color: #000;
        }
        .marquee-inner span { margin: 0 40px; }
        .marquee-inner .dot { opacity: 0.4; }

        section { position: relative; }
        .section-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px; letter-spacing: 0.3em; color: var(--accent);
          text-transform: uppercase; margin-bottom: 24px;
          display: flex; align-items: center; gap: 12px;
        }
        .section-label::before {
          content: ''; display: inline-block; width: 32px; height: 1px; background: var(--accent);
        }

        #concept, #philosophy, #future { padding: 140px 60px; background: var(--surface); }
        #architecture, #preview { padding: 140px 60px; background: var(--bg); }

        .concept-header {
          max-width: 1200px; margin: 0 auto 100px;
          display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: end;
        }
        .philosophy-inner {
          max-width: 1200px; margin: 0 auto;
          display: grid; grid-template-columns: 1fr 1fr; gap: 120px; align-items: center;
        }
        .concept-headline, .philosophy-title, .preview-title, .arch-title {
          font-family: 'DM Serif Display', serif;
          font-size: clamp(36px, 5vw, 72px); line-height: 1.0; letter-spacing: -0.02em;
        }
        .concept-headline em, .philosophy-title em, .future-title em { font-style: italic; color: var(--accent); }
        .concept-desc, .preview-sub, .future-desc {
          font-size: 16px; line-height: 1.75; color: var(--text-mid);
        }

        .agents-grid, .future-grid {
          max-width: 1200px; margin: 0 auto;
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px;
        }
        .agent-card, .future-card {
          padding: 56px 48px; background: var(--bg);
          border: 1px solid var(--border); position: relative; overflow: hidden;
          transition: border-color 0.4s, transform 0.4s;
        }
        .future-card { border-top: 2px solid var(--border); padding: 48px 40px; }
        .agent-card:hover, .future-card:hover { transform: translateY(-4px); }
        .future-card:hover { border-top-color: var(--accent); }
        .agent-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
        }
        .agent-card.exec::before { background: var(--exec); }
        .agent-card.skep::before { background: var(--skep); }
        .agent-card.synth::before { background: var(--synth); }
        .agent-card.exec:hover { border-color: var(--exec-border); }
        .agent-card.skep:hover { border-color: var(--skep-border); }
        .agent-card.synth:hover { border-color: var(--synth-border); }

        .agent-index, .agent-role, .footer-col-title, .footer-copy, .footer-sys, .loop-indicator {
          font-family: 'JetBrains Mono', monospace;
        }
        .agent-index { font-size: 10px; letter-spacing: 0.2em; margin-bottom: 48px; opacity: 0.4; }
        .agent-icon { width: 48px; height: 48px; margin-bottom: 32px; }
        .agent-icon-ring {
          width: 100%; height: 100%; border-radius: 50%; border: 1px solid;
          display: flex; align-items: center; justify-content: center; font-size: 18px;
        }
        .exec .agent-icon-ring { border-color: var(--exec); color: var(--exec); box-shadow: 0 0 20px var(--exec-glow); }
        .skep .agent-icon-ring { border-color: var(--skep); color: var(--skep); box-shadow: 0 0 20px var(--skep-glow); }
        .synth .agent-icon-ring { border-color: var(--synth); color: var(--synth); box-shadow: 0 0 20px var(--synth-glow); }
        .agent-name { font-family: 'DM Serif Display', serif; font-size: 32px; margin-bottom: 8px; letter-spacing: -0.01em; }
        .agent-role { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 24px; }
        .exec .agent-role { color: var(--exec); }
        .skep .agent-role { color: var(--skep); }
        .synth .agent-role { color: var(--synth); }
        .agent-desc, .future-card-desc { font-size: 14px; line-height: 1.7; color: var(--text-dim); }
        .agent-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 32px; }
        .tag {
          font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.15em;
          padding: 4px 10px; border: 1px solid var(--border); color: var(--text-dim); text-transform: uppercase;
        }

        .arch-inner, .preview-inner, .future-inner { max-width: 1200px; margin: 0 auto; }
        .arch-header, .preview-header { margin-bottom: 40px; }
        .flow-container {
          display: flex; align-items: center;
          background: var(--surface); border: 1px solid var(--border);
          padding: 60px 48px; position: relative; overflow: hidden;
        }
        .flow-node { flex: 1; text-align: center; position: relative; z-index: 2; padding: 32px 20px; transition: all 0.4s; }
        .flow-node-inner { transition: transform 0.4s; }
        .flow-node:hover .flow-node-inner { transform: scale(1.05); }
        .flow-node-circle {
          width: 72px; height: 72px; border-radius: 50%; margin: 0 auto 20px;
          display: flex; align-items: center; justify-content: center;
          font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.1em;
          border: 1px solid;
        }
        .fn-input .flow-node-circle { border-color: var(--border); color: var(--text-dim); }
        .fn-exec .flow-node-circle { border-color: var(--exec); color: var(--exec); box-shadow: 0 0 30px var(--exec-glow); }
        .fn-skep .flow-node-circle { border-color: var(--skep); color: var(--skep); box-shadow: 0 0 30px var(--skep-glow); }
        .fn-synth .flow-node-circle { border-color: var(--synth); color: var(--synth); box-shadow: 0 0 30px var(--synth-glow); }
        .fn-output .flow-node-circle { border-color: var(--accent); color: var(--accent); box-shadow: 0 0 30px var(--accent-glow); }
        .flow-node-label { font-size: 13px; font-weight: 600; margin-bottom: 6px; }
        .flow-node-sub { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--text-dim); letter-spacing: 0.1em; }
        .flow-arrow { flex: 0 0 auto; width: 48px; display: flex; align-items: center; justify-content: center; position: relative; }
        .flow-arrow-line { width: 100%; height: 1px; background: linear-gradient(to right, var(--border), rgba(200,240,96,0.4), var(--border)); position: relative; }
        .flow-arrow-head { position: absolute; right: 0; width: 6px; height: 6px; border-right: 1px solid var(--accent); border-top: 1px solid var(--accent); transform: rotate(45deg) translateY(-50%); top: 50%; }
        .flow-dot { position: absolute; width: 4px; height: 4px; background: var(--accent); border-radius: 50%; top: 50%; transform: translateY(-50%); animation: flowDot 2s linear infinite; }
        .loop-indicator {
          position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%);
          display: flex; align-items: center; gap: 12px; font-size: 10px; color: var(--accent); letter-spacing: 0.2em;
        }
        .loop-icon { width: 16px; height: 16px; border: 1px solid var(--accent); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 8px; animation: spin 3s linear infinite; }

        .principles { display: flex; flex-direction: column; gap: 2px; }
        .principle {
          padding: 28px 32px; background: var(--bg); border: 1px solid var(--border);
          transition: all 0.4s; display: flex; gap: 24px; align-items: flex-start; position: relative; overflow: hidden;
        }
        .principle::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: var(--accent); transform: scaleY(0); transition: transform 0.4s; transform-origin: top; }
        .principle:hover::before { transform: scaleY(1); }
        .principle:hover { background: var(--surface2); }
        .principle-num { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--accent); letter-spacing: 0.1em; padding-top: 4px; flex-shrink: 0; }
        .principle-title { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
        .principle-desc { font-size: 13px; color: var(--text-dim); line-height: 1.6; }
        .philosophy-right { display: flex; align-items: center; justify-content: center; }
        .philosophy-visual { width: 360px; height: 360px; }

        .enter-chat-btn {
          display: inline-flex; align-items: center; gap: 12px;
          margin-top: 40px; padding: 18px 48px;
          background: var(--accent); color: #000;
          font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700;
          letter-spacing: 0.06em; text-transform: uppercase;
          border: none; transition: all 0.3s; position: relative; overflow: hidden;
        }
        .enter-chat-btn::after { content: ''; position: absolute; inset: 0; background: rgba(255,255,255,0.15); transform: translateX(-100%); transition: transform 0.4s; }
        .enter-chat-btn:hover::after { transform: translateX(0); }
        .btn-arrow { font-size: 18px; transition: transform 0.3s; }
        .enter-chat-btn:hover .btn-arrow { transform: translateX(4px); }

        .future-bg { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 100%, rgba(200,240,96,0.04) 0%, transparent 70%); pointer-events: none; }
        .future-inner { text-align: center; }
        .future-title { font-family: 'DM Serif Display', serif; font-size: clamp(48px, 6vw, 90px); line-height: 0.95; letter-spacing: -0.03em; margin-bottom: 32px; }
        .future-desc { max-width: 600px; margin: 0 auto 80px; }
        .future-card-icon { font-size: 32px; margin-bottom: 24px; }
        .future-card-title { font-size: 18px; font-weight: 700; margin-bottom: 12px; }
        .future-cta { display: inline-flex; align-items: center; gap: 16px; font-size: 14px; color: var(--text-mid); }
        .cta-line { width: 48px; height: 1px; background: linear-gradient(to right, var(--border), var(--accent)); }

        footer { padding: 80px 60px 48px; background: var(--bg); border-top: 1px solid var(--border); }
        .footer-inner { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 60px; margin-bottom: 80px; }
        .footer-logo { font-family: 'DM Serif Display', serif; font-size: 28px; margin-bottom: 16px; }
        .footer-logo span { color: var(--accent); }
        .footer-tagline { font-size: 12px; color: var(--text-dim); line-height: 1.6; }
        .footer-col-title { font-size: 9px; letter-spacing: 0.2em; color: var(--accent); text-transform: uppercase; margin-bottom: 20px; }
        .footer-links { display: flex; flex-direction: column; gap: 10px; }
        .footer-links a { font-size: 13px; color: var(--text-dim); text-decoration: none; transition: color 0.3s; }
        .footer-links a:hover { color: var(--text); }
        .footer-bottom { max-width: 1200px; margin: 0 auto; padding-top: 32px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
        .footer-copy, .footer-sys { font-size: 10px; color: var(--text-dim); letter-spacing: 0.1em; }
        .footer-sys { display: flex; align-items: center; gap: 8px; color: var(--accent); }
        .status-pulse { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); animation: blink 2s ease infinite; }

        .reveal { opacity: 0; transform: translateY(40px); transition: opacity 0.8s cubic-bezier(0.4,0,0.2,1), transform 0.8s cubic-bezier(0.4,0,0.2,1); }
        .reveal.visible { opacity: 1; transform: translateY(0); }
        .reveal-delay-1 { transition-delay: 0.1s; }
        .reveal-delay-2 { transition-delay: 0.2s; }
        .reveal-delay-3 { transition-delay: 0.3s; }

        #chatOverlay {
          position: fixed; inset: 0; z-index: 500;
          background: var(--bg); display: flex; flex-direction: column;
          transform: translateY(100%);
          transition: transform 0.6s cubic-bezier(0.4,0,0.2,1);
          visibility: hidden;
        }
        #chatOverlay.open { transform: translateY(0); visibility: visible; }

        .chat-topbar {
          height: 56px; flex-shrink: 0; background: var(--surface);
          border-bottom: 1px solid var(--border);
          display: flex; align-items: center; gap: 20px; padding: 0 24px; z-index: 10;
        }
        .chat-back, .cht-btn, .copy-btn, .modal-close, .send-btn, .ia-btn, .task-option-btn, .task-submit-btn {
          cursor: none;
        }
        .chat-back {
          display: flex; align-items: center; gap: 8px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--text-dim); background: none; border: none; transition: color 0.25s; padding: 6px 0;
        }
        .chat-back:hover { color: var(--accent); }
        .chat-top-logo { font-family: 'DM Serif Display', serif; font-size: 18px; }
        .chat-top-logo span { color: var(--accent); }
        .chat-top-sep { width: 1px; height: 20px; background: var(--border2); }
        .chat-top-tag {
          font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.2em; color: var(--accent);
          text-transform: uppercase; background: var(--accent-dim); border: 1px solid rgba(200,240,96,0.2); padding: 3px 10px;
        }
        .chat-top-status { display: flex; align-items: center; gap: 7px; font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--text-dim); letter-spacing: 0.15em; margin-left: auto; }
        .chat-top-btns { display: flex; gap: 8px; }
        .cht-btn {
          padding: 6px 14px; background: transparent; border: 1px solid var(--border);
          color: var(--text-dim); font-family: 'JetBrains Mono', monospace;
          font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; transition: all 0.25s;
        }
        .cht-btn:hover { border-color: var(--border2); color: var(--text); }
        .cht-btn.accent { border-color: var(--accent); color: var(--accent); }
        .cht-btn.accent:hover { background: var(--accent); color: #000; }

        .chat-body { display: grid; grid-template-columns: 220px 1fr; flex: 1; overflow: hidden; }
        .chat-sidebar { background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
        .cs-section { padding: 18px 16px 10px; }
        .cs-label {
          font-family: 'JetBrains Mono', monospace; font-size: 8px; letter-spacing: 0.25em;
          color: var(--text-dim); text-transform: uppercase; margin-bottom: 10px;
          display: flex; align-items: center; gap: 8px;
        }
        .cs-label::after { content: ''; flex: 1; height: 1px; background: var(--border); }
        .agent-list { display: flex; flex-direction: column; gap: 3px; }
        .agent-entry {
          display: flex; align-items: center; gap: 10px; padding: 9px 12px;
          border: 1px solid transparent; transition: all 0.25s; position: relative;
        }
        .agent-entry::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; opacity: 0; transition: opacity 0.3s; }
        .agent-entry.exec::before { background: var(--exec); }
        .agent-entry.skep::before { background: var(--skep); }
        .agent-entry.synth::before { background: var(--synth); }
        .agent-entry:hover, .agent-entry.active { background: var(--surface2); border-color: var(--border); }
        .agent-entry.active::before { opacity: 1; }
        .agent-entry.exec.active { background: var(--exec-bg); border-color: var(--exec-border); }
        .agent-entry.skep.active { background: var(--skep-bg); border-color: var(--skep-border); }
        .agent-entry.synth.active { background: var(--synth-bg); border-color: var(--synth-border); }
        .ae-dot, .ptab-dot, .panel-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .exec .ae-dot, .exec .ptab-dot, .exec .panel-dot { background: var(--exec); box-shadow: 0 0 6px var(--exec-glow); }
        .skep .ae-dot, .skep .ptab-dot, .skep .panel-dot { background: var(--skep); box-shadow: 0 0 6px var(--skep-glow); }
        .synth .ae-dot, .synth .ptab-dot, .synth .panel-dot { background: var(--synth); box-shadow: 0 0 6px var(--synth-glow); }
        .ae-name { font-size: 11px; font-weight: 700; }
        .ae-role { font-family: 'JetBrains Mono', monospace; font-size: 8px; color: var(--text-dim); margin-top: 1px; }
        .cs-divider { height: 1px; background: var(--border); margin: 8px 16px; }
        .history-scroll { flex: 1; overflow-y: auto; padding: 0 16px 16px; }
        .no-history {
          font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--text-dim);
          text-align: center; padding: 20px 0;
        }
        .hist-item {
          padding: 9px 12px; margin-bottom: 2px; border: 1px solid transparent; transition: all 0.25s;
        }
        .hist-item:hover, .hist-item.active { background: var(--surface2); border-color: var(--border); }
        .hist-time { font-family: 'JetBrains Mono', monospace; font-size: 8px; color: var(--text-dim); margin-bottom: 3px; }
        .hist-text { font-size: 11px; color: var(--text-mid); line-height: 1.4; }

        .chat-main { display: flex; flex-direction: column; overflow: hidden; }
        .panel-tabs-bar {
          display: grid; grid-template-columns: repeat(3, 1fr);
          border-bottom: 1px solid var(--border); background: var(--surface2); flex-shrink: 0;
        }
        .ptab {
          padding: 13px 20px; display: flex; align-items: center; gap: 10px;
          border-right: 1px solid var(--border); position: relative; transition: background 0.3s;
        }
        .ptab:last-child { border-right: none; }
        .ptab::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px; opacity: 0; transition: opacity 0.3s; }
        .ptab.exec::after { background: var(--exec); }
        .ptab.skep::after { background: var(--skep); }
        .ptab.synth::after { background: var(--synth); }
        .ptab.active::after { opacity: 1; }
        .ptab.exec.active { background: var(--exec-bg); }
        .ptab.skep.active { background: var(--skep-bg); }
        .ptab.synth.active { background: var(--synth-bg); }
        .ptab-name { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; }
        .ptab-role { font-family: 'JetBrains Mono', monospace; font-size: 8px; color: var(--text-dim); }
        .ptab-badge, .panel-badge {
          font-family: 'JetBrains Mono', monospace; font-size: 8px; padding: 2px 6px; border-radius: 8px;
        }
        .exec .ptab-badge, .exec .panel-badge { background: var(--exec-bg); color: var(--exec); border: 1px solid var(--exec-border); }
        .skep .ptab-badge, .skep .panel-badge { background: var(--skep-bg); color: var(--skep); border: 1px solid var(--skep-border); }
        .synth .ptab-badge, .synth .panel-badge { background: var(--synth-bg); color: var(--synth); border: 1px solid var(--synth-border); }

        .conversation { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 24px; }
        .empty-state {
          flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 20px; padding: 60px 40px; text-align: center;
        }
        .es-logo { font-family: 'DM Serif Display', serif; font-size: 52px; opacity: 0.1; letter-spacing: -0.02em; }
        .es-title { font-family: 'DM Serif Display', serif; font-size: 28px; letter-spacing: -0.01em; }
        .es-sub { font-size: 13px; color: var(--text-dim); line-height: 1.7; max-width: 380px; }
        .es-pills { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 8px; }
        .es-pill {
          padding: 8px 16px; border: 1px solid var(--border); font-size: 12px;
          color: var(--text-mid); transition: all 0.25s;
        }
        .es-pill:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-dim); }

        .user-msg-wrap { display: flex; justify-content: flex-end; animation: slideUp 0.4s ease both; }
        .user-msg {
          background: var(--surface2); border: 1px solid var(--border);
          padding: 14px 18px; max-width: 58%;
        }
        .umsg-label { font-family: 'JetBrains Mono', monospace; font-size: 8px; color: var(--text-dim); letter-spacing: 0.2em; margin-bottom: 6px; }
        .umsg-text { font-size: 13px; line-height: 1.6; }
        .umsg-img { max-width: 100%; max-height: 120px; object-fit: cover; margin-top: 8px; border: 1px solid var(--border); display: block; }

        .thinking-block { display: flex; flex-direction: column; gap: 10px; animation: slideUp 0.4s ease both; }
        .ts {
          display: flex; align-items: center; gap: 14px; padding: 13px 18px;
          border: 1px solid var(--border); background: var(--surface);
          position: relative; overflow: hidden; transition: all 0.4s;
        }
        .ts.inactive { opacity: 0.25; }
        .ts.active { opacity: 1; }
        .ts.done { opacity: 0.55; }
        .ts-orb {
          width: 30px; height: 30px; border-radius: 50%; border: 1px solid;
          display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0;
        }
        .ts-exec .ts-orb { border-color: var(--exec); color: var(--exec); }
        .ts-skep .ts-orb { border-color: var(--skep); color: var(--skep); }
        .ts-synth .ts-orb { border-color: var(--synth); color: var(--synth); }
        .ts-info { flex: 1; }
        .ts-name { font-size: 11px; font-weight: 700; }
        .ts-status { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--text-dim); margin-top: 2px; }
        .ts-dots { display: flex; gap: 3px; align-items: center; }
        .ts-dots span { width: 4px; height: 4px; border-radius: 50%; background: currentColor; opacity: 0.6; animation: dotBounce 1.4s ease infinite; }
        .ts-dots span:nth-child(2) { animation-delay: 0.2s; }
        .ts-dots span:nth-child(3) { animation-delay: 0.4s; }

        .simple-resp, .task-question-card {
          border: 1px solid var(--border); background: var(--surface);
          overflow: hidden; animation: slideUp 0.4s ease both;
        }
        .srb {
          padding: 10px 16px; display: flex; align-items: center; gap: 8px;
          background: var(--surface2); border-bottom: 1px solid var(--border);
        }
        .srb-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 8px var(--accent-glow); }
        .srb-lbl { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--accent); letter-spacing: 0.2em; text-transform: uppercase; }
        .srb-body { padding: 16px 18px; font-size: 13px; line-height: 1.75; color: var(--text-mid); }

        .resp-header {
          display: flex; align-items: center; gap: 12px; padding: 0 2px; margin-bottom: 12px;
        }
        .resp-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-dim); }
        .resp-line { flex: 1; height: 1px; background: var(--border); }
        .resp-actions { display: flex; gap: 6px; }
        .ra-btn {
          padding: 4px 10px; border: 1px solid var(--border); background: transparent;
          font-family: 'JetBrains Mono', monospace; font-size: 8px; color: var(--text-dim);
          letter-spacing: 0.1em; text-transform: uppercase; transition: all 0.2s;
        }
        .ra-btn:hover { border-color: var(--border2); color: var(--text); }
        .ra-btn.share:hover { border-color: var(--accent); color: var(--accent); }

        .chain-flow-indicator {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 16px; margin-bottom: 12px;
          background: var(--surface2); border: 1px solid var(--border); flex-wrap: wrap;
        }
        .cfi-step {
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px; letter-spacing: 0.15em; font-weight: 600;
          padding: 3px 10px; border: 1px solid;
        }
        .exec-c { color: var(--exec); border-color: var(--exec-border); background: var(--exec-bg); }
        .skep-c { color: var(--skep); border-color: var(--skep-border); background: var(--skep-bg); }
        .synth-c { color: var(--synth); border-color: var(--synth-border); background: var(--synth-bg); }
        .cfi-arrow { color: var(--text-dim); font-size: 12px; }
        .cfi-label {
          margin-left: auto; font-family: 'JetBrains Mono', monospace;
          font-size: 8px; color: var(--text-dim); letter-spacing: 0.15em;
        }

        .panels-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 10px; }
        .panel {
          border: 1px solid var(--border); background: var(--surface); overflow: hidden;
        }
        .panel-header {
          padding: 12px 14px; display: flex; align-items: center; gap: 8px;
          border-bottom: 1px solid var(--border); background: var(--surface2);
        }
        .exec .panel-header { border-top: 2px solid var(--exec); }
        .skep .panel-header { border-top: 2px solid var(--skep); }
        .synth .panel-header { border-top: 2px solid var(--synth); }
        .panel-name { font-size: 11px; font-weight: 700; flex: 1; }
        .panel-toggle { font-size: 11px; color: var(--text-dim); transition: transform 0.3s; }
        .panel.collapsed .panel-toggle { transform: rotate(-90deg); }
        .panel.collapsed .panel-body { max-height: 0 !important; }
        .panel-body { overflow: hidden; transition: max-height 0.45s cubic-bezier(0.4,0,0.2,1); max-height: 1200px; }

        .agent-banner {
          padding: 16px 16px 12px; display: flex; align-items: center; gap: 12px; position: relative; overflow: hidden;
        }
        .exec .agent-banner { background: linear-gradient(135deg, rgba(96,200,240,0.14) 0%, rgba(96,200,240,0.03) 100%); }
        .skep .agent-banner { background: linear-gradient(135deg, rgba(240,96,144,0.14) 0%, rgba(240,96,144,0.03) 100%); }
        .synth .agent-banner { background: linear-gradient(135deg, rgba(200,240,96,0.14) 0%, rgba(200,240,96,0.03) 100%); }
        .agent-orb {
          width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center; font-size: 16px; border: 1.5px solid;
        }
        .exec .agent-orb { border-color: var(--exec); color: var(--exec); box-shadow: 0 0 16px var(--exec-glow); }
        .skep .agent-orb { border-color: var(--skep); color: var(--skep); box-shadow: 0 0 16px var(--skep-glow); }
        .synth .agent-orb { border-color: var(--synth); color: var(--synth); box-shadow: 0 0 16px var(--synth-glow); }
        .agent-banner-info { flex: 1; }
        .agent-banner-name { font-family: 'DM Serif Display', serif; font-size: 19px; letter-spacing: -0.01em; line-height: 1; margin-bottom: 2px; }
        .exec .agent-banner-name { color: var(--exec); }
        .skep .agent-banner-name { color: var(--skep); }
        .synth .agent-banner-name { color: var(--synth); }
        .agent-banner-role {
          font-family: 'JetBrains Mono', monospace; font-size: 8px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-dim);
        }
        .agent-pill {
          font-family: 'JetBrains Mono', monospace; font-size: 9px; padding: 3px 10px; border-radius: 20px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 600; flex-shrink: 0;
        }
        .exec .agent-pill { background: rgba(96,200,240,0.12); color: var(--exec); border: 1px solid var(--exec-border); }
        .skep .agent-pill { background: rgba(240,96,144,0.12); color: var(--skep); border: 1px solid var(--skep-border); }
        .synth .agent-pill { background: rgba(200,240,96,0.12); color: var(--synth); border: 1px solid var(--synth-border); }

        .agent-summary {
          padding: 10px 16px; border-bottom: 1px solid var(--border);
          font-size: 11px; line-height: 1.5; color: var(--text-mid); font-style: italic;
          background: rgba(255,255,255,0.02);
        }

        .panel-section { padding: 12px 14px; border-bottom: 1px solid var(--border); }
        .panel-section:last-child { border-bottom: none; }
        .panel-section-label {
          font-family: 'JetBrains Mono', monospace; font-size: 8px; letter-spacing: 0.18em;
          text-transform: uppercase; margin-bottom: 7px;
        }
        .exec .panel-section-label { color: var(--exec); }
        .skep .panel-section-label { color: var(--skep); }
        .synth .panel-section-label { color: var(--synth); }
        .panel-items { display: flex; flex-direction: column; gap: 4px; }
        .panel-item {
          font-size: 11px; line-height: 1.5; color: var(--text-mid); padding-left: 10px; position: relative;
        }
        .panel-item::before {
          content: ''; position: absolute; left: 0; top: 7px; width: 4px; height: 1px;
        }
        .exec .panel-item::before { background: var(--exec); }
        .skep .panel-item::before { background: var(--skep); }
        .synth .panel-item::before { background: var(--synth); }

        .final-dec {
          border: 1px solid var(--synth-border); background: var(--synth-bg);
          padding: 18px 22px; position: relative; overflow: hidden;
        }
        .final-dec::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--synth); }
        .fd-label {
          font-family: 'JetBrains Mono', monospace; font-size: 8px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--synth); margin-bottom: 8px;
        }
        .fd-text { font-size: 12px; line-height: 1.7; color: var(--text); }
        .fd-bar-row { margin-top: 12px; display: flex; align-items: center; gap: 10px; }
        .fd-bar-label, .fd-bar-val {
          font-family: 'JetBrains Mono', monospace; font-size: 8px;
        }
        .fd-bar-label { color: var(--text-dim); }
        .fd-bar-val { color: var(--synth); font-size: 10px; }
        .fd-bar { flex: 1; height: 2px; background: var(--border); }
        .fd-bar-fill { height: 100%; background: var(--synth); }

        .meta-layer {
          border: 1px solid var(--synth-border); background: linear-gradient(135deg, rgba(200,240,96,0.05) 0%, transparent 100%); margin-top: 10px;
        }
        .meta-header {
          padding: 14px 18px; border-bottom: 1px solid var(--synth-border);
          display: flex; align-items: center; justify-content: space-between; background: rgba(200,240,96,0.04);
        }
        .meta-title { font-size: 13px; font-weight: 700; color: var(--synth); }
        .meta-sub { font-family: 'JetBrains Mono', monospace; font-size: 8px; color: var(--text-dim); letter-spacing: 0.15em; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; }
        .meta-col { padding: 16px 18px; }
        .meta-col:first-child { border-right: 1px solid var(--border); }
        .meta-col-label {
          font-family: 'JetBrains Mono', monospace; font-size: 8px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--synth); margin-bottom: 10px; opacity: 0.8;
        }
        .meta-item {
          display: flex; gap: 8px; font-size: 11px; line-height: 1.5; color: var(--text-mid); padding: 5px 0; border-bottom: 1px solid var(--border);
        }
        .meta-item:last-child { border-bottom: none; }
        .meta-icon { color: var(--synth); flex-shrink: 0; font-size: 11px; padding-top: 1px; }

        .typing-ind {
          display: flex; align-items: center; gap: 10px; padding: 13px 16px;
          border: 1px solid var(--border); background: var(--surface);
        }
        .td { display: flex; gap: 4px; align-items: center; }
        .td span { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); opacity: 0.6; animation: dotBounce 1.4s ease infinite; }
        .td span:nth-child(2){animation-delay:.2s}
        .td span:nth-child(3){animation-delay:.4s}
        .tl { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--text-dim); letter-spacing: 0.15em; }

        .task-steps, .task-q-list { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
        .task-step {
          font-size: 12px; color: var(--text-mid); padding-left: 12px; position: relative; line-height: 1.6;
        }
        .task-step::before {
          content: ''; position: absolute; left: 0; top: 9px; width: 5px; height: 1px; background: var(--accent);
        }
        .task-question-card { padding: 14px; }
        .task-question-label { font-size: 12px; color: var(--text); margin-bottom: 10px; line-height: 1.5; }
        .task-option-row, .task-input-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .task-option-btn, .task-submit-btn {
          padding: 8px 14px; border: 1px solid var(--border); background: var(--surface2); color: var(--text-mid); font-size: 11px; transition: 0.25s;
        }
        .task-option-btn:hover, .task-submit-btn:hover { border-color: var(--accent); color: var(--accent); }
        .task-submit-btn:disabled { opacity: 0.4; }
        .task-input {
          flex: 1; min-width: 220px; padding: 10px 12px; background: var(--surface2); border: 1px solid var(--border); color: var(--text); outline: none;
        }
        .task-ready { margin-top: 12px; font-size: 12px; color: var(--accent); }

        .input-area { padding: 14px 22px; border-top: 1px solid var(--border); background: var(--surface); flex-shrink: 0; }
        .attach-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
        .attach-chip {
          display: flex; align-items: center; gap: 6px; padding: 3px 10px;
          background: var(--surface2); border: 1px solid var(--border);
          font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--text-mid);
        }
        .attach-chip button { background: none; border: none; color: var(--text-dim); font-size: 9px; }
        .input-row {
          display: flex; align-items: flex-end; gap: 8px;
          background: var(--surface2); border: 1px solid var(--border);
          padding: 10px 12px; transition: border-color 0.25s;
        }
        .input-row:focus-within { border-color: var(--border2); }
        .input-ta {
          flex: 1; background: transparent; border: none; outline: none;
          color: var(--text); font-family: 'Syne', sans-serif; font-size: 13px;
          line-height: 1.6; resize: none; min-height: 20px; max-height: 110px;
        }
        .input-ta::placeholder { color: var(--text-dim); }
        .ia-btns { display: flex; align-items: center; gap: 5px; }
        .ia-btn {
          width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--border);
          background: transparent; color: var(--text-dim);
          display: flex; align-items: center; justify-content: center; font-size: 12px; transition: all 0.25s;
        }
        .ia-btn:hover { border-color: var(--border2); color: var(--text); }
        .send-btn {
          width: 34px; height: 34px; border-radius: 50%; border: none; background: var(--accent); color: #000;
          display: flex; align-items: center; justify-content: center; font-size: 13px; transition: all 0.25s;
        }
        .send-btn:hover { transform: scale(1.06); filter: brightness(1.1); }
        .send-btn:disabled { opacity: 0.35; transform: none; }
        .input-hint {
          margin-top: 7px; display: flex; align-items: center; gap: 16px;
          font-family: 'JetBrains Mono', monospace; font-size: 8px; color: var(--text-dim); letter-spacing: 0.1em;
        }

        .modal-bg {
          position: fixed; inset: 0; background: rgba(8,8,9,0.88); backdrop-filter: blur(10px);
          z-index: 600; display: flex; align-items: center; justify-content: center;
          opacity: 0; pointer-events: none; transition: opacity 0.3s;
        }
        .modal-bg.open { opacity: 1; pointer-events: all; }
        .modal {
          background: var(--surface); border: 1px solid var(--border2);
          width: 460px; max-width: 92vw;
          transform: translateY(24px); transition: transform 0.35s cubic-bezier(0.4,0,0.2,1);
        }
        .modal-bg.open .modal { transform: translateY(0); }
        .modal-head { padding: 20px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
        .modal-head-title { font-family: 'DM Serif Display', serif; font-size: 20px; }
        .modal-close { background: none; border: none; color: var(--text-dim); font-size: 17px; }
        .modal-body { padding: 22px; }
        .ml { font-family: 'JetBrains Mono', monospace; font-size: 8px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-dim); margin-bottom: 10px; }
        .modal-section { margin-bottom: 20px; }
        .link-row { display: flex; gap: 8px; }
        .link-input {
          flex: 1; padding: 9px 13px; background: var(--surface2); border: 1px solid var(--border);
          color: var(--text-mid); font-family: 'JetBrains Mono', monospace; font-size: 10px; outline: none;
        }
        .copy-btn {
          padding: 9px 16px; border: 1px solid var(--accent); background: var(--accent-dim);
          color: var(--accent); font-family: 'JetBrains Mono', monospace;
          font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; transition: all 0.25s;
        }
        .copy-btn:hover { background: var(--accent); color: #000; }
        .export-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .exp-card {
          padding: 14px; border: 1px solid var(--border); background: var(--surface2);
          transition: all 0.25s; display: flex; flex-direction: column; gap: 5px;
        }
        .exp-card:hover { border-color: var(--accent); background: var(--accent-dim); }
        .exp-icon { font-size: 18px; }
        .exp-name { font-size: 12px; font-weight: 600; }
        .exp-desc { font-family: 'JetBrains Mono', monospace; font-size: 8px; color: var(--text-dim); }

        .toast {
          position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
          background: var(--surface2); border: 1px solid var(--accent);
          color: var(--accent); font-family: 'JetBrains Mono', monospace;
          font-size: 9px; letter-spacing: 0.15em; padding: 7px 18px;
          z-index: 700; opacity: 0; pointer-events: none; transition: opacity 0.3s;
        }
        .toast.show { opacity: 1; }

        @keyframes fadeUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes marquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes scrollPulse { 0%,100%{opacity:0.3;transform:scaleY(1)} 50%{opacity:1;transform:scaleY(1.3)} }
        @keyframes flowDot { from{left:0%} to{left:100%} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes dotBounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }

        @media (max-width: 900px) {
          nav { padding: 20px 24px; }
          .nav-links { display: none; }
          #hero { padding: 0 24px; }
          #concept, #architecture, #philosophy, #preview, #future { padding: 80px 24px; }
          .concept-header, .philosophy-inner { grid-template-columns: 1fr; gap: 32px; }
          .agents-grid, .future-grid, .panels-grid, .meta-grid { grid-template-columns: 1fr; }
          .flow-container { flex-direction: column; padding: 40px 24px; }
          .flow-arrow { transform: rotate(90deg); }
          footer { padding: 60px 24px 32px; }
          .footer-inner { grid-template-columns: 1fr 1fr; gap: 40px; }
          .chat-body { grid-template-columns: 1fr; }
          .chat-sidebar { display: none; }
          body { cursor: auto; }
          .cursor, .cursor-ring { display: none; }
          .chat-topbar {
            gap: 10px;
            padding: 0 14px;
            flex-wrap: wrap;
            height: auto;
            min-height: 56px;
            padding-top: 10px;
            padding-bottom: 10px;
          }
          .chat-top-status { margin-left: 0; }
          .chat-top-btns { margin-left: auto; }
          .user-msg { max-width: 85%; }
          .future-cta { flex-direction: column; }
          .cta-line { width: 100px; }
        }

        @media (max-width: 640px) {
          .hero-actions {
            flex-direction: column;
            width: 100%;
            max-width: 320px;
          }
          .btn-primary,
          .btn-ghost,
          .enter-chat-btn {
            width: 100%;
            justify-content: center;
          }
          .footer-inner { grid-template-columns: 1fr; }
          .export-row { grid-template-columns: 1fr; }
          .task-input-row {
            flex-direction: column;
            align-items: stretch;
          }
          .task-input {
            min-width: 0;
          }
          .input-hint {
            flex-wrap: wrap;
            gap: 8px 12px;
          }
        }
      `}</style>
    </>
  );
}