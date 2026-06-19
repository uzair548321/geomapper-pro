import { type ReactNode } from 'react';

interface CardProps {
  title: string;
  children: ReactNode;
}

export function Card({ title, children }: CardProps) {
  return (
    <div className="card">
      <div className="card-header">{title}</div>
      <div className="card-body">{children}</div>
    </div>
  );
}

interface ErrorBoxProps {
  message: string | null;
}

export function ErrorBox({ message }: ErrorBoxProps) {
  if (!message) return null;
  return <div className="error-box">⚠️ {message}</div>;
}

interface SpinnerProps {
  label?: string;
}

export function Spinner({ label }: SpinnerProps) {
  return (
    <>
      <span className="spinner" />
      {label && <span>{label}</span>}
    </>
  );
}

export function SavedBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="saved-badge">✓ Saved</span>;
}
