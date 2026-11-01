import Link from 'next/link';

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="text-lg font-black tracking-tighter text-red-600 hover:text-red-500">
      CODE FIGHTER <span className="text-zinc-100">Z</span>
    </Link>
  );
}
