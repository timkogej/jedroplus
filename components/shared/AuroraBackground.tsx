import styles from './AuroraBackground.module.css';

/**
 * Živo ozadje strani pred prijavo: severni sij v barvah Jedro+ na nočnem
 * nebu (`tone="dark"`) ali mehki pastelni siji na belem (`tone="light"`,
 * onboarding). Samo dekoracija — ne lovi klikov in je skrito bralnikom
 * zaslona.
 */
export default function AuroraBackground({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  return (
    <div className={`${styles.root} ${tone === 'light' ? styles.light : ''}`} aria-hidden="true">
      <div className={styles.stars} />
      <div className={`${styles.ribbon} ${styles.r1}`} />
      <div className={`${styles.ribbon} ${styles.r2}`} />
      <div className={`${styles.ribbon} ${styles.r3}`} />
      <div className={`${styles.ribbon} ${styles.r4}`} />
      <div className={styles.grain} />
    </div>
  );
}
