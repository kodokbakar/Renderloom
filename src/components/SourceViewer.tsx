import { useState } from "react";
import { CheckIcon, CopyIcon } from "./icons";
import { tokenizeLines } from "./utils/syntax-tokenizer";

export interface SourceViewerProps {
  code: string;
  language: "jsx" | "svg";
  title?: string;
  isLoading?: boolean;
  className?: string;
}

export function SourceViewer({
  code,
  language,
  title,
  isLoading = false,
  className = "",
}: SourceViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Clipboard access denied or headless environment
    }
  };

  if (isLoading) {
    return (
      <div className={`source-viewer loading ${className}`.trim()}>
        <div className="source-viewer-header">
          <span className="source-title">
            {title || language.toUpperCase()}
          </span>
        </div>
        <div className="source-loading-skeleton">
          Loading source artifact...
        </div>
      </div>
    );
  }

  if (!code || !code.trim()) {
    return (
      <div className={`source-viewer empty ${className}`.trim()}>
        <div className="source-viewer-header">
          <span className="source-title">
            {title || language.toUpperCase()}
          </span>
        </div>
        <div className="source-empty-message">No source code available.</div>
      </div>
    );
  }

  const lines = tokenizeLines(code, language);

  return (
    <div className={`source-viewer ${className}`.trim()}>
      <div className="source-viewer-header">
        <span className="source-title">
          {title || `${language.toUpperCase()} Source`}
        </span>
        <button
          type="button"
          className="btn-copy-code"
          onClick={handleCopy}
          aria-label={copied ? "Copied to clipboard" : "Copy source code"}
        >
          {copied ? (
            <>
              <CheckIcon size={14} />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <CopyIcon size={14} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div className="source-code-scroll">
        <pre className="source-pre">
          <code>
            {lines.map((lineTokens, lineIdx) => {
              const lineNum = lineIdx + 1;
              return (
                <div key={lineNum} className="source-line">
                  <span className="line-number" aria-hidden="true">
                    {lineNum}
                  </span>
                  <span className="line-content">
                    {lineTokens.length === 0
                      ? "\n"
                      : lineTokens.map((token, tokenIdx) => {
                          const tokenKey = `${lineNum}-${tokenIdx}`;
                          return (
                            <span
                              key={tokenKey}
                              className={`token token-${token.type}`}
                            >
                              {token.value}
                            </span>
                          );
                        })}
                  </span>
                </div>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}
