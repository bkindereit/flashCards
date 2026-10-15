import React, { useState, useMemo } from 'react';
import { ArrowLeft, BookOpen, Search, ExternalLink, HelpCircle } from 'lucide-react';
import manualContentRaw from '../../docs/user_manual.md?raw';

interface UserManualViewProps {
  onBack: () => void;
}

export const UserManualView: React.FC<UserManualViewProps> = ({ onBack }) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Extract major sections (## headings) for quick-jump navigation
  const sections = useMemo(() => {
    const lines = manualContentRaw.split('\n');
    const list: { title: string; id: string }[] = [];
    for (const line of lines) {
      if (line.startsWith('## ') || line.startsWith('# Appendix')) {
        const title = line.replace(/^##\s+/, '').replace(/^#\s+/, '').trim();
        const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        list.push({ title, id });
      }
    }
    return list;
  }, []);

  // Filter lines if search query is provided
  const filteredContent = useMemo(() => {
    if (!searchQuery.trim()) return manualContentRaw;
    const q = searchQuery.toLowerCase();
    const paragraphs = manualContentRaw.split('\n\n');
    const matched = paragraphs.filter(p => p.toLowerCase().includes(q));
    if (matched.length === 0) {
      return `## No results found for "${searchQuery}"\n\nTry searching for broader keywords like **sign in**, **csv**, **study**, **dashboard**, **password**, or **delete**.`;
    }
    return matched.join('\n\n');
  }, [searchQuery]);

  // Safe inline markdown renderer
  const renderInline = (text: string) => {
    // Links: [label](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts: (string | React.ReactNode)[] = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push(text.slice(lastIdx, match.index));
      }
      const label = match[1];
      const url = match[2];
      parts.push(
        <a
          key={`link-${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline underline-offset-2 font-medium"
        >
          {label}
        </a>
      );
      lastIdx = linkRegex.lastIndex;
    }
    if (lastIdx < text.length) {
      parts.push(text.slice(lastIdx));
    }

    // Process bold, italic, code on string parts
    return parts.map((part, pIdx) => {
      if (typeof part !== 'string') return part;

      // Split by bold (**text**)
      const boldSegments = part.split(/(\*\*[^*]+\*\*)/g);
      return (
        <React.Fragment key={`p-${pIdx}`}>
          {boldSegments.map((segment, bIdx) => {
            if (segment.startsWith('**') && segment.endsWith('**')) {
              return <strong key={bIdx} className="font-semibold text-white">{segment.slice(2, -2)}</strong>;
            }
            // Inline code (`code`)
            const codeSegments = segment.split(/(`[^`]+`)/g);
            return (
              <React.Fragment key={bIdx}>
                {codeSegments.map((codeSeg, cIdx) => {
                  if (codeSeg.startsWith('`') && codeSeg.endsWith('`')) {
                    return (
                      <code
                        key={cIdx}
                        className="px-1.5 py-0.5 rounded text-xs font-mono bg-slate-900 border border-slate-700 text-blue-300"
                      >
                        {codeSeg.slice(1, -1)}
                      </code>
                    );
                  }
                  return codeSeg;
                })}
              </React.Fragment>
            );
          })}
        </React.Fragment>
      );
    });
  };

  // Block markdown renderer
  const renderBlocks = (content: string) => {
    const lines = content.split('\n');
    const nodes: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBuffer: string[] = [];

    lines.forEach((line, idx) => {
      // Code block start / end
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          nodes.push(
            <pre key={`code-${idx}`} className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-blue-300 overflow-x-auto my-3">
              <code>{codeBuffer.join('\n')}</code>
            </pre>
          );
          codeBuffer = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        return;
      }

      // Horizontal rule
      if (line.trim() === '---') {
        nodes.push(<hr key={`hr-${idx}`} className="border-t border-slate-700/80 my-6" />);
        return;
      }

      // Blockquotes
      if (line.startsWith('>')) {
        nodes.push(
          <div key={`bq-${idx}`} className="p-3.5 my-3 bg-blue-950/40 border-l-4 border-blue-500 rounded-r-xl text-xs text-blue-200">
            {renderInline(line.replace(/^>\s?/, ''))}
          </div>
        );
        return;
      }

      // Headings
      if (line.startsWith('# ')) {
        nodes.push(
          <h1 key={`h1-${idx}`} className="text-2xl sm:text-3xl font-extrabold text-white mt-8 mb-4 border-b border-slate-700 pb-3">
            {line.replace(/^#\s+/, '')}
          </h1>
        );
        return;
      }

      if (line.startsWith('## ')) {
        const text = line.replace(/^##\s+/, '');
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        nodes.push(
          <h2 key={`h2-${idx}`} id={id} className="text-lg sm:text-xl font-bold text-white mt-7 mb-3 flex items-center gap-2 pt-2 scroll-mt-20">
            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            <span>{text}</span>
          </h2>
        );
        return;
      }

      if (line.startsWith('### ')) {
        nodes.push(
          <h3 key={`h3-${idx}`} className="text-base sm:text-lg font-semibold text-slate-200 mt-5 mb-2">
            {line.replace(/^###\s+/, '')}
          </h3>
        );
        return;
      }

      // List items
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        nodes.push(
          <li key={`li-${idx}`} className="ml-5 list-disc text-sm text-slate-300 my-1 leading-relaxed">
            {renderInline(line.trim().replace(/^[-*]\s+/, ''))}
          </li>
        );
        return;
      }

      // Numbered lists (e.g. "1. Step description")
      const numMatch = line.trim().match(/^(\d+)\.\s+(.*)$/);
      if (numMatch) {
        nodes.push(
          <div key={`num-${idx}`} className="flex items-start gap-2.5 my-1.5 ml-2 text-sm text-slate-300 leading-relaxed">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-blue-400 font-bold text-xs shrink-0 mt-0.5 border border-slate-700">
              {numMatch[1]}
            </span>
            <div className="flex-1">{renderInline(numMatch[2] ?? '')}</div>
          </div>
        );
        return;
      }

      // Regular paragraph (if not blank)
      if (line.trim().length > 0) {
        nodes.push(
          <p key={`p-${idx}`} className="text-sm text-slate-300 my-2 leading-relaxed">
            {renderInline(line)}
          </p>
        );
      }
    });

    return nodes;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6" role="region" aria-label="User Manual">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-700/80">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors"
            aria-label="Back to application"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-400" />
              <h1 className="text-xl sm:text-2xl font-bold text-white">Adaptive Flashcards — User Manual</h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live documentation compiled directly from <code className="text-slate-300">docs/user_manual.md</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <a
            href="https://github.com/bkindereit/flashCards/blob/main/docs/user_manual.md"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 transition-colors min-h-[44px] shrink-0"
          >
            <span>View on GitHub</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={onBack}
            className="flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors min-h-[44px] shrink-0"
          >
            Done
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative mb-6">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search topics (e.g. CSV upload, study timer, password login, delete deck)..."
          className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          aria-label="Search user manual"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-700"
          >
            Clear
          </button>
        )}
      </div>

      {/* Quick Jump Chapter Pills */}
      {!searchQuery && sections.length > 0 && (
        <div className="mb-6 p-4 bg-slate-800/60 border border-slate-700/80 rounded-2xl">
          <div className="flex items-center gap-2 mb-2.5 text-xs font-bold text-slate-300 uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
            <span>Quick Chapters</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {sections.map((sec, sIdx) => (
              <a
                key={sIdx}
                href={`#${sec.id}`}
                className="px-2.5 py-1 text-xs font-medium bg-slate-700/80 hover:bg-blue-600 text-slate-200 hover:text-white rounded-lg border border-slate-600/60 transition-colors"
              >
                {sec.title}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Rendered Manual Body */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 sm:p-8 text-slate-100 shadow-xl">
        {renderBlocks(filteredContent)}
      </div>

      {/* Footer Return Button */}
      <div className="mt-8 text-center">
        <button
          onClick={onBack}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm shadow-lg transition-colors min-h-[44px]"
        >
          Return to Application
        </button>
      </div>
    </div>
  );
};
