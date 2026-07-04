'use client'
import styles from './DogLoader.module.css'

export function DogLoader() {
  return (
    <div className={styles.main} role="status" aria-label="Загрузка">
      <div className={styles.dog}>
        <div className={styles.paws}>
          <div className={`${styles.leg} ${styles.blLeg}`}>
            <div className={`${styles.paw} ${styles.blPaw}`} />
            <div className={`${styles.top} ${styles.blTop}`} />
          </div>
          <div className={`${styles.leg} ${styles.flLeg}`}>
            <div className={`${styles.paw} ${styles.flPaw}`} />
            <div className={`${styles.top} ${styles.flTop}`} />
          </div>
          <div className={`${styles.leg} ${styles.frLeg}`}>
            <div className={`${styles.paw} ${styles.frPaw}`} />
            <div className={`${styles.top} ${styles.frTop}`} />
          </div>
        </div>
        <div className={styles.body}><div className={styles.tail} /></div>
        <div className={styles.head}>
          <div className={styles.snout}>
            <div className={styles.eyes}>
              <div className={styles.eyeL} />
              <div className={styles.eyeR} />
            </div>
          </div>
        </div>
        <div className={styles.headC}>
          <div className={styles.earR} />
          <div className={styles.earL} />
        </div>
      </div>
    </div>
  )
}
