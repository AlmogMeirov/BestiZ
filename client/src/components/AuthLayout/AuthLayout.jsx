/**
 * The frame around signing in and signing up.
 *
 * This is the first screen anyone sees, including anyone deciding whether the
 * rest is worth looking at, and it used to be a form floating in the middle
 * of an empty grey page.
 *
 * The left half carries no explanation of what BestiZ is. A product that has
 * to introduce itself on its own login screen has already lost the argument.
 * What it shows instead is the product running: the three things that bring
 * somebody back — a message, an accepted request, a new post. They are
 * examples, not claims.
 *
 * Below 860px the panel is removed rather than stacked. On a phone it would
 * be a screenful of decoration between the person and the password field.
 */

import { Link } from 'react-router-dom';

import styles from './AuthLayout.module.css';

const GLIMPSES = [
  { initials: 'ML', line: 'Maya sent you a message', tone: 'green' },
  { initials: 'TR', line: 'Tal accepted your request', tone: 'coral' },
  { initials: 'NB', line: 'Noam posted something new', tone: 'violet' },
];

const AuthLayout = ({ children }) => (
  <div className={styles.page}>
    <div className={styles.frame}>
      <aside className={styles.art} aria-hidden="true">
        <span className={styles.mark}>BestiZ</span>

        {/* Three rings sharing a centre off the bottom-left corner. They give
            the gradient something to sit behind without becoming a pattern. */}
        <span className={`${styles.ring} ${styles.ring1}`} />
        <span className={`${styles.ring} ${styles.ring2}`} />
        <span className={`${styles.ring} ${styles.ring3}`} />

        <div className={styles.glimpses}>
          {GLIMPSES.map((item) => (
            <div key={item.initials} className={styles.glimpse}>
              <span className={`${styles.dot} ${styles[item.tone]}`}>
                {item.initials}
              </span>
              {item.line}
            </div>
          ))}
        </div>
      </aside>

      <main className={styles.pane}>
        <Link to="/login" className={styles.paneMark}>
          Besti<span className={styles.paneMarkZ}>Z</span>
        </Link>
        {children}
      </main>
    </div>
  </div>
);

export default AuthLayout;
