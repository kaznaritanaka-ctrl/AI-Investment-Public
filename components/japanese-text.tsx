import { Fragment } from "react";

/** Keep each authored Japanese phrase together while allowing responsive wrapping. */
export function JapaneseText({ parts }: { parts: readonly string[] }) {
  return (
    <span className="jp-text" lang="ja">
      {parts.map((part, index) => (
        <Fragment key={index}>
          <span className="jp-phrase">{part}</span>
          {index < parts.length - 1 && <wbr />}
        </Fragment>
      ))}
    </span>
  );
}
