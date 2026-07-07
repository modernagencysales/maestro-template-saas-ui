import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";

export function Badge({ children }: { readonly children: ReactNode }) {
  return <span className="template-badge">{children}</span>;
}

export function Button({
  children,
  className,
  variant,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variant?: string;
  readonly children: ReactNode;
}) {
  void variant;

  return (
    <button className={className ?? "template-button"} {...props}>
      {children}
    </button>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}
