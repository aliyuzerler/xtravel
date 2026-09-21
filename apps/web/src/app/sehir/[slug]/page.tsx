import { redirect } from 'next/navigation';

export default async function CityRedirectPage({ params }: { params: { slug: string } }) {
  redirect(`/?city=${params.slug}`);
}
