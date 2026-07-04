'use client'
import styles from './Book3dLoader.module.css'

// 3D flipping-book loader with page flips.
// Adapts page colors to site theme (light / dark / amoled) via CSS variables.
export function Book3dLoader() {
  return (
    <div className={styles.book} role="status" aria-label="Загрузка">
      <div className={styles.pgShadow} />
      <div className={`${styles.pg} ${styles.pg1}`} />
      <div className={`${styles.pg} ${styles.pg2}`} />
      <div className={`${styles.pg} ${styles.pg3}`} />
      <div className={`${styles.pg} ${styles.pg4}`} />
      <div className={`${styles.pg} ${styles.pg5}`} />
    </div>
  )
}
