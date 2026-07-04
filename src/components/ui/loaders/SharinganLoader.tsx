'use client'
import styles from './SharinganLoader.module.css'

// Rotating Sharingan-style ring with three tomoe.
export function SharinganLoader() {
  return (
    <div className={styles.sharingan} role="status" aria-label="Загрузка">
      <div className={styles.ring}>
        <div className={styles.tomoe} />
        <div className={styles.tomoe} />
        <div className={styles.tomoe} />
        <div className={styles.pupil} />
      </div>
    </div>
  )
}
