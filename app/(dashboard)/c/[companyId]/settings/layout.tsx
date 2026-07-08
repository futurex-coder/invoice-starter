import { SettingsTabsNav } from './_components/SettingsTabsNav';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section>
      <SettingsTabsNav />
      {children}
    </section>
  );
}
