'use client'
import styles from './HamsterLoader.module.css'

// Hamster running inside a wheel.
export function HamsterLoader() {
  return (
    <div
      className={styles.wheelAndHamster}
      role="img"
      aria-label="Orange and tan hamster running in a metal wheel"
    >
      <div className={styles.wheel} />
      <div className={styles.hamster}>
        <div className={styles.hamsterBody}>
          <div className={styles.hamsterHead}>
            <div className={styles.hamsterEar} />
            <div className={styles.hamsterEye} />
            <div className={styles.hamsterNose} />
          </div>
          <div className={`${styles.hamsterLimb} ${styles.hamsterLimbFr}`} />
          <div className={`${styles.hamsterLimb} ${styles.hamsterLimbFl}`} />
          <div className={`${styles.hamsterLimb} ${styles.hamsterLimbBr}`} />
          <div className={`${styles.hamsterLimb} ${styles.hamsterLimbBl}`} />
          <div className={styles.hamsterTail} />
        </div>
      </div>
      <div className={styles.spoke} />
    </div>
  )
}
