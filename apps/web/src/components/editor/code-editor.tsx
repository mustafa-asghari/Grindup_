'use client';

import { useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { motion } from 'framer-motion';
import {
    Play,
    RotateCcw,
    Settings,
    Maximize2,
    Code2,
    FileCode
} from 'lucide-react';

interface CodeEditorProps {
    defaultValue?: string;
    language?: string;
    onChange?: (value: string | undefined) => void;
    onRun?: (code: string, language: string) => void;
    isRunning?: boolean;
    disableCopyPaste?: boolean;
}

// ... existing code ...

const SUPPORTED_LANGUAGES = [
    { id: 'python', name: 'Python', icon: '🐍' },
    { id: 'javascript', name: 'JavaScript', icon: '📜' },
    { id: 'java', name: 'Java', icon: '☕' },
    { id: 'cpp', name: 'C++', icon: '⚡' },
];

const DEFAULT_CODE: Record<string, string> = {
    python: `def solution(nums: list[int], target: int) -> list[int]:
    # Write your solution here
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []
`,
    javascript: `function solution(nums, target) {
    // Write your solution here
    const seen = new Map();
    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        if (seen.has(complement)) {
            return [seen.get(complement), i];
        }
        seen.set(nums[i], i);
    }
    return [];
}
`,
    java: `class Solution {
    public int[] solution(int[] nums, int target) {
        // Write your solution here
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (seen.containsKey(complement)) {
                return new int[] {seen.get(complement), i};
            }
            seen.put(nums[i], i);
        }
        return new int[] {};
    }
}
`,
    cpp: `#include <vector>
#include <unordered_map>

class Solution {
public:
    vector<int> solution(vector<int>& nums, int target) {
        // Write your solution here
        unordered_map<int, int> seen;
        for (int i = 0; i < nums.size(); i++) {
            int complement = target - nums[i];
            if (seen.count(complement)) {
                return {seen[complement], i};
            }
            seen[nums[i]] = i;
        }
        return {};
    }
};
`,
};

export function CodeEditor({
    defaultValue,
    language: initialLanguage = 'python',
    onChange,
    onRun,
    isRunning = false,
    disableCopyPaste = false,
}: CodeEditorProps) {
    const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
    const [language, setLanguage] = useState(initialLanguage);
    const languageRef = useRef(initialLanguage);
    const [code, setCode] = useState(defaultValue || DEFAULT_CODE[initialLanguage] || '');

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;

        // Disable Copy/Paste if requested
        if (disableCopyPaste) {
            editor.onKeyDown((e) => {
                const isCmdOrCtrl = e.metaKey || e.ctrlKey;
                if (isCmdOrCtrl && (e.code === 'KeyV' || e.code === 'KeyC')) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            });
            const container = editor.getContainerDomNode();
            const preventDefault = (e: Event) => {
                e.preventDefault();
                e.stopPropagation();
            };
            container.addEventListener('paste', preventDefault, true);
            container.addEventListener('copy', preventDefault, true);
            container.addEventListener('cut', preventDefault, true);
        }

        // Define minimal dark theme
        monaco.editor.defineTheme('grindup', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
                { token: 'keyword', foreground: 'a3a3a3' },
                { token: 'string', foreground: '22c55e' },
                { token: 'number', foreground: 'f5f5f5' },
                { token: 'function', foreground: 'e5e5e5' },
                { token: 'variable', foreground: 'f5f5f5' },
                { token: 'type', foreground: 'd4d4d4' },
            ],
            colors: {
                'editor.background': '#000000',
                'editor.foreground': '#f5f5f5',
                'editor.lineHighlightBackground': '#171717',
                'editor.selectionBackground': '#404040',
                'editor.inactiveSelectionBackground': '#262626',
                'editorLineNumber.foreground': '#525252',
                'editorLineNumber.activeForeground': '#a3a3a3',
                'editorCursor.foreground': '#ffffff',
                'editor.findMatchBackground': '#404040',
                'editor.findMatchHighlightBackground': '#262626',
                'editorBracketMatch.background': '#404040',
                'editorBracketMatch.border': '#737373',
                'editorIndentGuide.background': '#262626',
                'editorIndentGuide.activeBackground': '#404040',
                'scrollbarSlider.background': '#40404080',
                'scrollbarSlider.hoverBackground': '#525252',
                'scrollbarSlider.activeBackground': '#737373',
            },
        });

        monaco.editor.setTheme('grindup');

        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
            const currentCode = editor.getValue();
            onRun?.(currentCode, languageRef.current);
        });
    };

    const handleLanguageChange = (newLanguage: string) => {
        setLanguage(newLanguage);
        languageRef.current = newLanguage;
        const newCode = DEFAULT_CODE[newLanguage] || '';
        setCode(newCode);
        onChange?.(newCode);
    };

    const handleCodeChange = (value: string | undefined) => {
        setCode(value || '');
        onChange?.(value);
    };

    const handleReset = () => {
        const defaultCode = DEFAULT_CODE[language] || '';
        setCode(defaultCode);
        editorRef.current?.setValue(defaultCode);
        onChange?.(defaultCode);
    };

    const handleRun = () => {
        onRun?.(code, language);
    };

    return (
        <div className="h-full flex flex-col bg-black">
            {/* Editor Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-400">Solution</span>
                    </div>

                    {/* Language Tabs */}
                    <div className="flex gap-1">
                        {SUPPORTED_LANGUAGES.map((lang) => (
                            <button
                                key={lang.id}
                                onClick={() => handleLanguageChange(lang.id)}
                                className={`editor-tab ${language === lang.id ? 'active' : ''}`}
                            >
                                <span className="mr-1">{lang.icon}</span>
                                {lang.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={handleReset}
                        className="btn btn-ghost !p-2"
                        title="Reset Code"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>

                    <button className="btn btn-ghost !p-2" title="Settings">
                        <Settings className="w-4 h-4" />
                    </button>

                    <button className="btn btn-ghost !p-2" title="Fullscreen">
                        <Maximize2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Monaco Editor */}
            <div className="flex-1 min-h-0">
                <Editor
                    height="100%"
                    language={language}
                    value={code}
                    onChange={handleCodeChange}
                    onMount={handleEditorDidMount}
                    options={{
                        fontSize: 14,
                        fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, monospace",
                        fontLigatures: true,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        padding: { top: 16, bottom: 16 },
                        lineNumbers: 'on',
                        glyphMargin: false,
                        folding: true,
                        lineDecorationsWidth: 0,
                        lineNumbersMinChars: 3,
                        renderLineHighlight: 'line',
                        cursorBlinking: 'smooth',
                        cursorSmoothCaretAnimation: 'on',
                        smoothScrolling: true,
                        wordWrap: 'on',
                        automaticLayout: true,
                        tabSize: 4,
                        insertSpaces: true,
                    }}
                    loading={
                        <div className="h-full flex items-center justify-center bg-black">
                            <div className="flex items-center gap-3 text-gray-500">
                                <FileCode className="w-5 h-5 animate-pulse" />
                                <span>Loading editor...</span>
                            </div>
                        </div>
                    }
                />
            </div>

            {/* Run Button Bar */}
            <div className="px-4 py-3 bg-gray-900 border-t border-gray-800 flex items-center justify-between">
                <div className="text-xs text-gray-600">
                    <kbd className="px-2 py-1 bg-gray-800 rounded text-gray-400 mr-1">⌘</kbd>
                    +
                    <kbd className="px-2 py-1 bg-gray-800 rounded text-gray-400 ml-1 mr-2">Enter</kbd>
                    to run
                </div>

                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleRun}
                    disabled={isRunning}
                    className={`btn ${isRunning ? 'btn-ghost' : 'btn-success'} min-w-[120px]`}
                >
                    {isRunning ? (
                        <>
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            >
                                <RotateCcw className="w-4 h-4" />
                            </motion.div>
                            Running...
                        </>
                    ) : (
                        <>
                            <Play className="w-4 h-4" />
                            Run Code
                        </>
                    )}
                </motion.button>
            </div>
        </div>
    );
}
