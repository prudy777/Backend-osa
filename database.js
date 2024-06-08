const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Could not connect to the database:', err);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

const createTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE,
          password TEXT
        )
      `, (err) => {
        if (err) console.error('Error creating users table:', err.message);
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS patients (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          dob DATE NOT NULL,
          email TEXT NOT NULL,
          phone TEXT NOT NULL,
          test_type TEXT NOT NULL,
          patient_no INTEGER,
          status TEXT DEFAULT 'pending'
        )
      `, (err) => {
        if (err) console.error('Error creating patients table:', err.message);
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS lab_numbers (
          lab_no INTEGER PRIMARY KEY AUTOINCREMENT
        )
      `, (err) => {
        if (err) console.error('Error creating lab_numbers table:', err.message);
      });

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
      `, (err) => {
        if (err) console.error('Error creating test_bookings table:', err.message);
      });

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
      `, (err) => {
        if (err) console.error('Error creating test_details table:', err.message);
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT,
          type TEXT,
          category TEXT,
          amount REAL,
          description TEXT
        )
      `, (err) => {
        if (err) console.error('Error creating transactions table:', err.message);
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS printed_tests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          test_id TEXT,
          patient_id INTEGER,
          lab_no INTEGER,
          name TEXT,
          sex TEXT,
          age TEXT,
          age_unit TEXT,
          panel TEXT,
          referred_by TEXT,
          date TEXT,
          test_name TEXT,
          rate REAL,
          price_naira REAL,
          reference_range TEXT,
          interpretation TEXT
        )
      `, (err) => {
        if (err) console.error('Error creating printed_tests table:', err.message);
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS serology (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          patient_id INTEGER,
          test TEXT,
          methodology TEXT,
          result TEXT,
          FOREIGN KEY (patient_id) REFERENCES patients (id)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating serology table:', err.message);
        } else {
          console.log('serology table created successfully.');
        }
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS urinalysis (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          patient_id INTEGER,
          colour TEXT,
          appearance TEXT,
          pH TEXT,
          specific_gravity TEXT,
          urobilinogen TEXT,
          leukocyte TEXT,
          bilirubin TEXT,
          blood TEXT,
          nitrite TEXT,
          protein TEXT,
          glucose TEXT,
          ketones TEXT,
          comment TEXT,
          FOREIGN KEY (patient_id) REFERENCES patients (id)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating urinalysis table:', err.message);
        }
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS biochemistry (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          patient_id INTEGER,
          bilirubin_total TEXT,
          bilirubin_direct TEXT,
          ast_sgot TEXT,
          alt_sgpt TEXT,
          alp TEXT,
          albumin TEXT,
          total_protein TEXT,
          urea TEXT,
          creatinine TEXT,
          sodium TEXT,
          potassium TEXT,
          chloride TEXT,
          bicarbonate TEXT,
          total_cholesterol TEXT,
          hdl TEXT,
          ldl TEXT,
          triglycerides TEXT,
          vldl TEXT,
          fasting_blood_sugar TEXT,
          FOREIGN KEY (patient_id) REFERENCES patients (id)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating biochemistry table:', err.message);
        }
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS Haematology (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          investigation TEXT NOT NULL,
          result TEXT NOT NULL,
          reference_range TEXT NOT NULL
        )
      `, (err) => {
        if (err) {
          console.error('Error creating Haematology table:', err.message);
        }
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS ParasitologyTests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          test TEXT NOT NULL,
          methodology TEXT NOT NULL,
          result TEXT NOT NULL
        )
      `, (err) => {
        if (err) {
          console.error('Error creating ParasitologyTests table:', err.message);
        }
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS comments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          patient_id INTEGER,
          red_blood_cells TEXT,
          white_blood_cells TEXT,
          platelets TEXT,
          FOREIGN KEY (patient_id) REFERENCES patients (id)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating comments table:', err.message);
        }
      });

      console.log('Database schema created successfully.');
      resolve();
    });
  });
};

const addColumnIfNotExists = (tableName, columnName, columnType) => {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
      if (err) {
        console.error(`Error fetching table info for ${tableName}:`, err.message);
        reject(err);
        return;
      }

      const columnExists = columns.some(column => column.name === columnName);

      if (!columnExists) {
        db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`, (err) => {
          if (err) {
            console.error(`Error adding column ${columnName} to ${tableName}:`, err.message);
            reject(err);
          } else {
            console.log(`Column ${columnName} added to ${tableName}`);
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  });
};

createTables().then(() => {
  return Promise.all([
    addColumnIfNotExists('test_details', 'price_naira', 'REAL'),
    addColumnIfNotExists('test_details', 'reference_range', 'TEXT'),
    addColumnIfNotExists('test_details', 'interpretation', 'TEXT')
  ]);
}).then(() => {
  db.close((err) => {
    if (err) {
      console.error('Error closing the database connection:', err.message);
    } else {
      console.log('Closed the database connection.');
    }
  });
}).catch((err) => {
  console.error('Error during database setup:', err);
});
