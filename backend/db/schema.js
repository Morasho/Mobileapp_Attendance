const pool = require("../config/db");

const createTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS students (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(100)  NOT NULL,
        email       VARCHAR(150)  UNIQUE NOT NULL,
        student_id  VARCHAR(20)   UNIQUE NOT NULL,
        password    TEXT          NOT NULL,
        created_at  TIMESTAMPTZ   DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id             SERIAL PRIMARY KEY,
        name           VARCHAR(100)     NOT NULL,
        course_code    VARCHAR(20)      NOT NULL,
        lecturer       VARCHAR(100),
        classroom_lat  DOUBLE PRECISION NOT NULL,
        classroom_lng  DOUBLE PRECISION NOT NULL,
        created_at     TIMESTAMPTZ      DEFAULT NOW()
      )
    `);

    // signed_date is a plain DATE column — no casting needed, fully indexable
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance_logs (
        id          SERIAL PRIMARY KEY,
        student_id  INTEGER          NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        class_id    INTEGER          NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
        signed_at   TIMESTAMPTZ      DEFAULT NOW(),
        signed_date DATE             DEFAULT CURRENT_DATE,
        latitude    DOUBLE PRECISION NOT NULL,
        longitude   DOUBLE PRECISION NOT NULL,
        distance_m  DOUBLE PRECISION NOT NULL,
        status      VARCHAR(10)      DEFAULT 'present',
        UNIQUE (student_id, class_id, signed_date)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id            SERIAL PRIMARY KEY,
        class_id      INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        date          DATE    NOT NULL,
        total_present INTEGER DEFAULT 0,
        generated_at  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (class_id, date)
      )
    `);

    console.log("✅ All tables ready");
  } catch (err) {
    console.error("❌ Table creation error:", err.message);
    throw err;
  }
};

module.exports = createTables;