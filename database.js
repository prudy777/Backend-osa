const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_no INTEGER UNIQUE,
      first_name TEXT,
      last_name TEXT,
      dob TEXT,
      email TEXT,
      phone TEXT,
      test_type TEXT,
      status TEXT DEFAULT 'pending'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS lab_numbers (
      lab_no INTEGER PRIMARY KEY AUTOINCREMENT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS test_bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_no INTEGER,
      lab_no INTEGER,
      name TEXT,
      sex TEXT,
      age TEXT,
      age_unit TEXT,
      panel TEXT,
      referred_by TEXT,
      date TEXT,
      FOREIGN KEY (patient_no) REFERENCES patients(patient_no),
      FOREIGN KEY (lab_no) REFERENCES lab_numbers(lab_no)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS test_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER,
      test_id TEXT,
      test_name TEXT,
      rate REAL,
      price_naira REAL,
      reference_range TEXT,
      interpretation TEXT,
      FOREIGN KEY (booking_id) REFERENCES test_bookings(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      type TEXT,
      category TEXT,
      amount REAL,
      description TEXT
    )
  `);


console.log('Database schema created successfully.');



  // Function to add a column if it does not exist
  const addColumnIfNotExists = (tableName, columnName, columnType) => {
    db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
      if (err) {
        console.error(`Error fetching table info for ${tableName}:`, err);
        return;
      }

      const columnExists = columns.some(column => column.name === columnName);

      if (!columnExists) {
        db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`, (err) => {
          if (err) {
            console.error(`Error adding column ${columnName} to ${tableName}:`, err);
          }
        });
      }
    });
  };

  addColumnIfNotExists('test_details', 'price_naira', 'INTEGER');
  addColumnIfNotExists('test_details', 'reference_range', 'TEXT');
  addColumnIfNotExists('test_details', 'interpretation', 'TEXT');

  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      type TEXT,
      category TEXT,
      amount REAL,
      description TEXT
    )
  `);
});

db.close();
