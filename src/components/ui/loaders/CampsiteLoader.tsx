'use client'
import styles from './CampsiteLoader.module.css'

// Night campsite scene inside a circle: crescent moon, stars, hut, campfire, trees.
// Uses dark navy background — DARK/AMOLED themes only.
export function CampsiteLoader() {
  return (
    <div className={styles.master} role="status" aria-label="Загрузка">
      <div className={styles.container}>
        <div className={styles.crescent}><span /><span /></div>
        {[1,2,3,4,5].map(i => <div key={i} className={`${styles.star} ${styles[`s${i}`]}`}><span /><span /></div>)}
        {[1,2,3,4,5,6,7,8].map(i => <div key={i} className={`${styles.smallStar} ${styles[`ss${i}`]}`}><span /><span /></div>)}
        <div className={styles.hut}>
          <hr /><hr /><hr /><hr /><hr /><hr />
          <div className={styles.doorway}><hr className={styles.split} /></div>
        </div>
        <div className={styles.firePit}>
          <div className={styles.fire}><div className={styles.innerFire} /></div>
          <hr className={styles.log1} /><hr className={styles.log2} />
        </div>
        {['one','two','three','four'].map(t => (
          <div key={t} className={`${styles.tree} ${styles[t]}`}>
            <hr className={styles.trunc} />
            <hr className={styles.leaves} /><hr className={styles.leaves} /><hr className={styles.leaves} /><hr className={styles.leaves} />
          </div>
        ))}
        <div className={styles.hill} />
      </div>
    </div>
  )
}
