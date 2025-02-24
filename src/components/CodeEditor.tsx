import { useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { Play, Copy, Check, X, Maximize2, Minimize2 } from 'lucide-react';

interface CodeEditorProps {
  initialCode?: string;
  language?: string;
  readOnly?: boolean;
  onRun?: (code: string) => void;
  onClose?: () => void;
}

const languageMap: { [key: string]: any } = {
  javascript,
  python,
  html,
  css,
  sql,
};

const CodeEditor: React.FC<CodeEditorProps> = ({
  initialCode = '',
  language = 'javascript',
  readOnly = false,
  onRun,
  onClose
}) => {
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const runCode = () => {
    if (onRun) {
      onRun(code);
      return;
    }

    setIsRunning(true);
    try {
      // Create a safe evaluation environment
      const consoleOutput: string[] = [];
      const safeConsole = {
        log: (...args: any[]) => consoleOutput.push(args.join(' ')),
        error: (...args: any[]) => consoleOutput.push(`Error: ${args.join(' ')}`),
        warn: (...args: any[]) => consoleOutput.push(`Warning: ${args.join(' ')}`)
      };

      // Create a safe context for evaluation
      const context = {
        console: safeConsole,
        setTimeout: () => {},
        setInterval: () => {},
        fetch: () => {},
        XMLHttpRequest: () => {},
        WebSocket: () => {}
      };

      // Execute the code in the safe context
      const fn = new Function('context', `with(context){${code}}`);
      fn(context);

      setOutput(consoleOutput.join('\n'));
    } catch (error) {
      if (error instanceof Error) {
        setOutput(`Error: ${error.message}`);
      } else {
        setOutput('An unknown error occurred');
      }
    }
    setIsRunning(false);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className={`bg-gray-900 rounded-lg overflow-hidden ${
      isFullscreen ? 'fixed inset-0 z-50' : ''
    }`}>
      <div className="flex items-center justify-between p-2 border-b border-gray-700">
        <span className="text-gray-400 text-sm capitalize">{language}</span>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopy}
            className="p-1.5 text-gray-400 hover:text-white rounded transition-colors"
            title="Copy code"
          >
            {isCopied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
          {!readOnly && (
            <button
              onClick={runCode}
              disabled={isRunning}
              className={`p-1.5 text-gray-400 hover:text-white rounded transition-colors ${
                isRunning ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Run code"
            >
              <Play className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 text-gray-400 hover:text-white rounded transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white rounded transition-colors"
              title="Close editor"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <CodeMirror
        value={code}
        height={isFullscreen ? "calc(100vh - 120px)" : "300px"}
        theme={oneDark}
        extensions={[languageMap[language]()]}
        onChange={(value) => setCode(value)}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightSpecialChars: true,
          history: true,
          foldGutter: true,
          drawSelection: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          syntaxHighlighting: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          rectangularSelection: true,
          crosshairCursor: true,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          closeBracketsKeymap: true,
          defaultKeymap: true,
          searchKeymap: true,
          historyKeymap: true,
          foldKeymap: true,
          completionKeymap: true,
          lintKeymap: true
        }}
      />

      {!readOnly && output && (
        <div className="p-4 bg-gray-800 border-t border-gray-700">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Output:</h3>
          <pre className="text-sm text-white whitespace-pre-wrap">{output}</pre>
        </div>
      )}
    </div>
  );
};

export default CodeEditor;