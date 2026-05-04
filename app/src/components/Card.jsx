export default function Card({ className = '', children }) {
  return (
    <div className={`rounded-2xl bg-white shadow-[0_8px_22px_rgba(15,41,77,0.08)] ${className}`}>
      {children}
    </div>
  )
}
