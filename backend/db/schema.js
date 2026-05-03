const pool = require("../config/db");

const createTables = async () => {
  try {

    // ── Users ───────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        name          VARCHAR(100)     NOT NULL,
        email         VARCHAR(150)     UNIQUE NOT NULL,
        student_id    VARCHAR(20)      UNIQUE,
        password      TEXT             NOT NULL,
        role          VARCHAR(20)      NOT NULL CHECK (role IN ('student','lecturer','admin')),
        phone         VARCHAR(20),
        department    VARCHAR(100),
        profile_photo TEXT,
        course_id     INTEGER,         -- students only: which course they're on
        year_of_study INTEGER,         -- students only: 1, 2, 3, or 4
        semester      INTEGER,         -- students only: current semester (1 or 2)
        created_at    TIMESTAMPTZ      DEFAULT NOW()
      )
    `);

    // ── Courses ─────────────────────────────────────────────
    // e.g. "BSc Computer Science", "BSc Information Technology"
    await pool.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(150) NOT NULL,   -- "BSc Computer Science"
        code        VARCHAR(20)  NOT NULL UNIQUE,  -- "BCS"
        department  VARCHAR(100),
        created_at  TIMESTAMPTZ  DEFAULT NOW()
      )
    `);

    // ── Units ───────────────────────────────────────────────
    // Pre-loaded by admin. A unit belongs to a course, year, and semester.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS units (
        id            SERIAL PRIMARY KEY,
        name          VARCHAR(150) NOT NULL,   -- "Data Structures"
        code          VARCHAR(20)  NOT NULL,   -- "CS201"
        course_id     INTEGER      NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        year_of_study INTEGER      NOT NULL CHECK (year_of_study BETWEEN 1 AND 4),
        semester      INTEGER      NOT NULL CHECK (semester IN (1, 2)),
        created_at    TIMESTAMPTZ  DEFAULT NOW(),
        UNIQUE (code, course_id)               -- same unit code can't appear twice in a course
      )
    `);

    // ── Lecturer Units ──────────────────────────────────────
    // Which units a lecturer is assigned to teach
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lecturer_units (
        lecturer_id  INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
        unit_id      INTEGER NOT NULL REFERENCES units(id)  ON DELETE CASCADE,
        PRIMARY KEY (lecturer_id, unit_id)
      )
    `);

    // ── Classes ─────────────────────────────────────────────
    // A class is a lecturer's instance of a unit with a location
    await pool.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id            SERIAL PRIMARY KEY,
        unit_id       INTEGER      NOT NULL REFERENCES units(id)  ON DELETE CASCADE,
        lecturer_id   INTEGER      NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
        classroom_lat DOUBLE PRECISION,   -- optional reference location
        classroom_lng DOUBLE PRECISION,
        created_at    TIMESTAMPTZ  DEFAULT NOW(),
        UNIQUE (unit_id, lecturer_id)     -- one class per lecturer per unit
      )
    `);

    // ── Sessions ────────────────────────────────────────────
    // Lecturer opens a session — GPS captured at open time becomes geofence centre
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id          SERIAL PRIMARY KEY,
        class_id    INTEGER      NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
        opened_by   INTEGER      NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
        opened_at   TIMESTAMPTZ  DEFAULT NOW(),
        closed_at   TIMESTAMPTZ,
        is_active   BOOLEAN      DEFAULT TRUE,
        opened_lat  DOUBLE PRECISION NOT NULL,   -- lecturer's GPS when opened
        opened_lng  DOUBLE PRECISION NOT NULL    -- this is the geofence centre
      )
    `);

    // ── Attendance Logs ─────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance_logs (
        id          SERIAL PRIMARY KEY,
        student_id  INTEGER          NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
        class_id    INTEGER          NOT NULL REFERENCES classes(id)   ON DELETE CASCADE,
        session_id  INTEGER          REFERENCES sessions(id)           ON DELETE SET NULL,
        signed_at   TIMESTAMPTZ      DEFAULT NOW(),
        signed_date DATE             DEFAULT CURRENT_DATE,
        latitude    DOUBLE PRECISION NOT NULL,
        longitude   DOUBLE PRECISION NOT NULL,
        distance_m  DOUBLE PRECISION NOT NULL,
        status      VARCHAR(10)      DEFAULT 'present',
        UNIQUE (student_id, class_id, signed_date)
      )
    `);

    // ── Indexes ─────────────────────────────────────────────
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_attendance_student  ON attendance_logs(student_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_attendance_class    ON attendance_logs(class_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_attendance_date     ON attendance_logs(signed_date)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_classes_lecturer    ON classes(lecturer_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_classes_unit        ON classes(unit_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_class      ON sessions(class_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_active     ON sessions(is_active)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_units_course        ON units(course_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_units_year          ON units(year_of_study, semester)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_course        ON users(course_id)`);

    // Add FK for users.course_id now that courses table exists
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'users_course_id_fkey'
        ) THEN
          ALTER TABLE users ADD CONSTRAINT users_course_id_fkey
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    console.log("✅ All tables ready");
  } catch (err) {
    console.error("❌ Table creation error:", err.message);
    throw err;
  }
};

module.exports = createTables;