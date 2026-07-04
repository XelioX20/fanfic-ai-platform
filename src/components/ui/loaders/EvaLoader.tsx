'use client'
import styles from './EvaLoader.module.css'

export function EvaLoader() {
  return (
    <div className={styles.viewport} role="status" aria-label="Загрузка">
      <div className={styles.eva}>
        <div className={styles.head}>
          <div className={styles.eyeChamber}>
            <div className={styles.eye} />
            <div className={styles.eye} />
          </div>
        </div>
        <div className={styles.body}>
          <div className={styles.hand} />
          <div className={styles.hand} />
          <div className={styles.scanner} />
          <div className={styles.scannerOrigin} />
        </div>
      </div>
    </div>
  )
}
