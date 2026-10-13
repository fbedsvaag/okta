export function Stille({ children }: { children: React.ReactNode }) {
  return <p className="py-1 text-brod text-blekk-svak">{children}</p>;
}

/**
 * Notater og møtelogg, SPEC §4.7.
 *
 * Kronologisk liste, nyeste først, med åpne oppfølgingspunkter fast øverst.
 * Dette er en annen type notat enn skåringsnotatet i §4.4: det henger på én
 * bestemt økt og leses i heatmapet. Møteloggen er en bevisst hendelse — en
 * samtale, en observasjon, en avtale.
 */
