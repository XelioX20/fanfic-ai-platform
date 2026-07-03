'use client'
import styles from './CauldronLoader.module.css'

// Cauldron with rotating ladle and rising bubbles. Multi-element loader.
// Colors kept from original: dimgrey body / beige highlights work on both light and dark themes.
export function CauldronLoader() {
  return (
    <div className={styles.container} role="status" aria-label="Загрузка">
      <div className={styles.cauldronBody} />
      <div className={styles.cauldronLid}>
        <div className={styles.innerLid} />
        <div className={styles.outerLid} />
      </div>
      <div className={styles.ladle} />
      <div className={styles.bubbles}>
        <div className={styles.bubbleContainer}>
          <div className={`${styles.bubbleBound} ${styles.bubbleBound1}`}>
            <div className={`${styles.bubble} ${styles.bubble1}`}>
              <div className={styles.opaqueBackground} />
            </div>
          </div>
          <div className={`${styles.bubbleBound} ${styles.bubbleBound2}`}>
            <div className={`${styles.bubble} ${styles.bubble2}`}>
              <div className={styles.opaqueBackground} />
            </div>
          </div>
          <div className={`${styles.bubbleBound} ${styles.bubbleBound3}`}>
            <div className={`${styles.bubble} ${styles.bubble3}`}>
              <div className={styles.opaqueBackground} />
            </div>
          </div>
        </div>
      </div>
      <div className={styles.cauldronLegs}>
        <div className={`${styles.leg} ${styles.leg1}`} />
        <div className={`${styles.leg} ${styles.leg2}`} />
      </div>
    </div>
  )
}
