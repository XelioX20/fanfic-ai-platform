'use client'
import styles from './HandLoader.module.css'

// Hand with tapping fingers.
export function HandLoader() {
  return (
    <div className={styles.hand} role="status" aria-label="Загрузка">
      <div className={styles.finger} />
      <div className={styles.finger} />
      <div className={styles.finger} />
      <div className={styles.finger} />
      <div className={styles.palm} />
      <div className={styles.thumb} />
    </div>
  )
}
