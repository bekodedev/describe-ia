import { GenerateForm } from '@/components/GenerateForm';

const versions = [
  { name: 'Short', text: 'One sentence for listings and product cards.' },
  { name: 'Medium', text: 'A paragraph for the product page.' },
  { name: 'SEO', text: 'Longer text that works with search engines.' },
];

export default function HomePage() {
  return (
    <div className="grid items-start gap-10 lg:grid-cols-5 lg:gap-16">
      <section className="lg:col-span-2 lg:pt-4">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Product descriptions, ready to paste.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-slate-700">
          Enter a title and a category, add a photo if you have one, and get three versions of the
          description in a few seconds.
        </p>
        <ul className="mt-8 space-y-4">
          {versions.map(({ name, text }) => (
            <li key={name} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-800"
              >
                ✓
              </span>
              <p className="text-slate-700">
                <strong className="font-semibold text-slate-900">{name}.</strong> {text}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="lg:col-span-3">
        <GenerateForm />
      </div>
    </div>
  );
}
