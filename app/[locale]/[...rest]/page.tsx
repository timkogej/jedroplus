import { notFound } from 'next/navigation';

// Any unknown path under a language (e.g. /sl/nekaj) shows the app's own,
// translated 404 page instead of Next's bare default.
export default function CatchAllPage() {
  notFound();
}
