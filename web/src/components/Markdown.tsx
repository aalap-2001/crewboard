import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import clsx from "clsx";
import { useAuth } from "@/auth/AuthProvider";
import { ALL_ID, prepareMentionsForMarkdown } from "@/lib/mentions";

/**
 * Renders user markdown safely: raw HTML is not allowed, links open in a new tab,
 * and @mention tokens become chips (highlighted when they mention you or @all).
 */
export function Markdown({ children }: { children: string }) {
  const me = useAuth().user?.uid;
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (url.startsWith("user:") ? url : defaultUrlTransform(url))}
        components={{
          a: ({ node: _node, href, children: kids, ...props }) => {
            if (href?.startsWith("user:")) {
              const id = href.slice(5);
              const mine = id === me || id === ALL_ID;
              return (
                <span
                  className={clsx(
                    "inline-flex items-center rounded-md px-1.5 py-px text-[0.9em] font-semibold no-underline",
                    mine ? "bg-brand-600 text-white" : "bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200"
                  )}
                >
                  {kids}
                </span>
              );
            }
            return <a href={href} {...props} target="_blank" rel="noopener noreferrer">{kids}</a>;
          },
        }}
      >
        {prepareMentionsForMarkdown(children)}
      </ReactMarkdown>
    </div>
  );
}
