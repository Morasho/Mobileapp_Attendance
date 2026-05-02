const pool = require("../config/db");

const createTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        name          VARCHAR(100)     NOT NULL,
        email         VARCHAR(150)     UNIQUE NOT NULL,
        student_id    VARCHAR(20)      UNIQUE,
        password      TEXT             NOT NULL,
        role          VARCHAR(20)      NOT NULL CHECK (role IN ('student', 'lecturer')),
        phone         VARCHAR(20),
        department    VARCHAR(100),
        profile_photo TEXT,
        created_at    TIMESTAMPTZ      DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id             SERIAL PRIMARY KEY,
        name           VARCHAR(100)     NOT NULL,
        course_code    VARCHAR(20)      NOT NULL,
        lecturer       VARCHAR(100),
        lecturer_id    INTEGER          REFERENCES users(id) ON DELETE SET NULL,
        classroom_lat  DOUBLE PRECISION NOT NULL,
        classroom_lng  DOUBLE PRECISION NOT NULL,
        created_at     TIMESTAMPTZ      DEFAULT NOW()
      )
    `);

    // Sessions — lecturers open/close attendance windows
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id          SERIAL PRIMARY KEY,
        class_id    INTEGER     NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        opened_by   INTEGER     NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
        opened_at   TIMESTAMPTZ DEFAULT NOW(),
        closed_at   TIMESTAMPTZ,                          -- NULL means still open
        is_active   BOOLEAN     DEFAULT TRUE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance_logs (
        id          SERIAL PRIMARY KEY,
        student_id  INTEGER          NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
        class_id    INTEGER          NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
        session_id  INTEGER          REFERENCES sessions(id)          ON DELETE SET NULL,
        signed_at   TIMESTAMPTZ      DEFAULT NOW(),
        signed_date DATE             DEFAULT CURRENT_DATE,
        latitude    DOUBLE PRECISION NOT NULL,
        longitude   DOUBLE PRECISION NOT NULL,
        distance_m  DOUBLE PRECISION NOT NULL,
        status      VARCHAR(10)      DEFAULT 'present',
        UNIQUE (student_id, class_id, signed_date)
      )
    `);

    

    // Indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_attendance_student  ON attendance_logs(student_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_attendance_class    ON attendance_logs(class_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_attendance_date     ON attendance_logs(signed_date)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_classes_lecturer    ON classes(lecturer_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_class      ON sessions(class_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_active     ON sessions(is_active)`);

    console.log("✅ All tables ready");
  } catch (err) {
    console.error("❌ Table creation error:", err.message);
    throw err;
  }
};

module.exports = createTables;