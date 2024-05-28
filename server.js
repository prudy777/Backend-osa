const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

require('dotenv').config();

const db = new sqlite3.Database('./database.db');
const app = express();
app.use(express.json());
// Allow requests from your frontend domain
app.use(cors({
  origin: 'https://frontend-osa.vercel.app',
  methods: ['GET', 'POST', 'DELETE'], // Define allowed methods as an array of strings
  credentials: true, // if you're using cookies or authentication headers
}));

// Create tables for users, patients, and test bookings
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
}); 

// User registration endpoint
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  db.run('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashedPassword], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed: users.email')) {
        return res.status(409).send('Email already exists');
      }
      return res.status(500).send('Signup failed due to server error');
    }
    res.status(201).send('User created successfully');
  });
});

// User login endpoint
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) return res.status(500).send('Server error');
    if (!user) return res.status(404).send('User not found');
    const passwordIsValid = await bcrypt.compare(password, user.password);
    if (!passwordIsValid) return res.status(401).send('Invalid password');
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '86400' });
    res.status(200).send({ auth: true, token: token });
  });
});

// Patient registration endpoint
app.post('/register', (req, res) => {
  const { first_name, last_name, dob, email, phone, test_type } = req.body;

  db.run('INSERT INTO patients (first_name, last_name, dob, email, phone, test_type) VALUES (?, ?, ?, ?, ?, ?)', 
    [first_name, last_name, dob, email, phone, test_type], 
    function (err) {
      if (err) {
        return res.status(500).send('Registration failed due to server error');
      }

      const patientId = this.lastID;

      // Update the patient_no with the same value as the id
      db.run('UPDATE patients SET patient_no = ? WHERE id = ?', [patientId, patientId], function (err) {
        if (err) {
          return res.status(500).send('Failed to set patient number');
        }
        res.status(201).send('Patient registered successfully');
      });
    });
});

// Endpoint to get list of patients
app.get('/patients', (req, res) => {
  db.all('SELECT * FROM patients', [], (err, rows) => {
    if (err) {
      return res.status(500).send('Failed to retrieve patients');
    }
    res.status(200).json(rows);
  });
});

// Endpoint to get a specific patient's details
app.get('/patients/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM patients WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Error fetching patient details:', err);
      return res.status(500).send('Failed to fetch patient details');
    }
    if (!row) {
      return res.status(404).send('Patient not found');
    }

    // Assuming test_type is a comma-separated string
    row.test_type = row.test_type.split(',').map(type => type.trim());

    res.status(200).json(row);
  });
});


// Endpoint to get accepted patients
app.get('/accepted-patients', (req, res) => {
  db.all('SELECT * FROM patients WHERE status = "accepted"', [], (err, rows) => {
    if (err) {
      return res.status(500).send('Failed to retrieve accepted patients');
    }
    res.status(200).json(rows);
  });
});

// Endpoint to update patient status
app.put('/patients/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  console.log(`Updating patient ID: ${id} with status: ${status}`); // Debugging log
  db.run('UPDATE patients SET status = ? WHERE id = ?', [status, id], function (err) {
    if (err) {
      console.error('Error updating patient status:', err); // Debugging log
      return res.status(500).send('Failed to update patient status');
    }
    res.status(200).send('Patient status updated successfully');
  });
});

// Endpoint to delete a patient
app.delete('/patients/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM patients WHERE id = ?', id, function (err) {
    if (err) {
      console.error('Error deleting patient:', err);
      return res.status(500).send('Failed to delete patient');
    }
    res.status(200).send('Patient deleted successfully');
  });
});

// Endpoint to save test booking
app.post('/test-booking', (req, res) => {
  const { patientId, labNo, name, sex, age, ageUnit, panel, referredBy, date, tests } = req.body;
  const testBookingQuery = `
    INSERT INTO test_bookings (patient_id, lab_no, name, sex, age, age_unit, panel, referred_by, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  db.run(testBookingQuery, [patientId, labNo, name, sex, age, ageUnit, panel, referredBy, date], function (err) {
    if (err) {
      console.error('Error saving test booking:', err);
      return res.status(500).send('Failed to save test booking');
    }
    const bookingId = this.lastID;
    const testDetailsQuery = `
      INSERT INTO test_details (booking_id, test_id, test_name, rate, price_naira, reference_range, interpretation)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const stmt = db.prepare(testDetailsQuery);
    for (const test of tests) {
      stmt.run([bookingId, test.id, test.name, test.rate, test.rate, test.referenceRange, test.interpretation], function (err) {
        if (err) {
          console.error('Error saving test details:', err);
          return res.status(500).send('Failed to save test details');
        }
      });
    }
    stmt.finalize((err) => {
      if (err) {
        console.error('Error finalizing statement:', err);
        return res.status(500).send('Failed to finalize test details');
      }
      res.status(201).send('Test booking saved successfully');
    });
  });
});

app.get('/test-bookings', (req, res) => {
  db.all(`
    SELECT tb.id, tb.patient_id, tb.lab_no, tb.name, tb.sex, tb.age, tb.age_unit, tb.panel, tb.referred_by, tb.date, 
           td.test_id, td.test_name, td.rate, td.reference_range, td.interpretation
    FROM test_bookings tb
    LEFT JOIN test_details td ON tb.id = td.booking_id
  `, [], (err, rows) => {
    if (err) {
      console.error('Error retrieving test bookings:', err);
      return res.status(500).send('Failed to retrieve test bookings');
    }
    res.status(200).json(rows);
  });
});

// Endpoint to delete test bookings by id
app.delete('/test-bookings/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM test_details WHERE booking_id = ?', [id], function (err) {
    if (err) {
      console.error('Error deleting test details:', err);
      return res.status(500).send('Failed to delete test details');
    }
    db.run('DELETE FROM test_bookings WHERE id = ?', [id], function (err) {
      if (err) {
        console.error('Error deleting test booking:', err);
        return res.status(500).send('Failed to delete test booking');
      }
      res.status(200).send('Test booking deleted successfully');
    });
  });
});

// Save printed tests
app.post('/masters', (req, res) => {
  const { tests } = req.body;
  const stmt = db.prepare(`
    INSERT INTO printed_tests (test_id, patient_id, lab_no, name, sex, age, age_unit, panel, referred_by, date, test_name, rate, price_naira, reference_range, interpretation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  tests.forEach(test => {
    stmt.run([
      test.test_id,
      test.patient_id,
      test.lab_no,
      test.name,
      test.sex,
      test.age,
      test.age_unit,
      test.panel,
      test.referred_by,
      test.date,
      test.test_name,
      test.rate,
      test.price_naira,
      test.reference_range,
      test.interpretation,
    ]);
  });

  stmt.finalize(err => {
    if (err) {
      console.error('Error saving printed tests:', err);
      res.status(500).send('Error saving printed tests');
      return;
    }
    res.status(201).send('Printed tests saved successfully');
  });
});

// Retrieve printed tests
app.get('/masters', (req, res) => {
  db.all('SELECT * FROM printed_tests', [], (err, rows) => {
    if (err) {
      console.error('Error retrieving printed tests:', err);
      res.status(500).send('Error retrieving printed tests');
      return;
    }
    res.status(200).json(rows);
  });
});

// Endpoint to get transactions
app.get('/accounting/transactions', (req, res) => {
  db.all('SELECT * FROM transactions', [], (err, rows) => {
    if (err) {
      console.error('Error retrieving transactions:', err);
      return res.status(500).send('Failed to retrieve transactions');
    }
    res.status(200).json(rows);
  });
});

// Endpoint to add a transaction
app.post('/accounting/transactions', (req, res) => {
  const { date, type, category, amount, description } = req.body;
  db.run('INSERT INTO transactions (date, type, category, amount, description) VALUES (?, ?, ?, ?, ?)', [date, type, category, amount, description], function (err) {
    if (err) {
      console.error('Error adding transaction:', err);
      return res.status(500).send('Failed to add transaction');
    }
    res.status(201).send('Transaction added successfully');
  });
});

// Endpoint to update a transaction
app.put('/accounting/transactions/:id', (req, res) => {
  const { id } = req.params;
  const { date, type, category, amount, description } = req.body;
  db.run('UPDATE transactions SET date = ?, type = ?, category = ?, amount = ?, description = ? WHERE id = ?', [date, type, category, amount, description, id], function (err) {
    if (err) {
      console.error('Error updating transaction:', err);
      return res.status(500).send('Failed to update transaction');
    }
    res.status(200).send('Transaction updated successfully');
  });
});

// Endpoint to delete a transaction
app.delete('/accounting/transactions/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM transactions WHERE id = ?', [id], function (err) {
    if (err) {
      console.error('Error deleting transaction:', err);
      return res.status(500).send('Failed to delete transaction');
    }
    res.status(200).send('Transaction deleted successfully');
  });
});

// Endpoint to get sales data
app.get('/api/sales', (req, res) => {
  const salesData = {
    today: 145,
    increasePercentage: 12
  };
  res.json(salesData);
});

// Endpoint to get revenue data
app.get('/api/revenue', (req, res) => {
  const revenueData = {
    thisMonth: 3264,
    increasePercentage: 8
  };
  res.json(revenueData);
});

// Endpoint to get customer data
app.get('/api/customers', (req, res) => {
  const customersData = {
    thisYear: 1244,
    decreasePercentage: 12
  };
  res.json(customersData);
});

// Endpoint to get reports data
app.get('/api/reports', (req, res) => {
  const reportsData = {
    sales: [31, 40, 28, 51, 42, 82, 56],
    revenue: [11, 32, 45, 32, 34, 52, 41],
    customers: [15, 11, 32, 18, 9, 24, 11],
    categories: ["2018-09-19T00:00:00.000Z", "2018-09-19T01:30:00.000Z", "2018-09-19T02:30:00.000Z", "2018-09-19T03:30:00.000Z", "2018-09-19T04:30:00.000Z", "2018-09-19T05:30:00.000Z", "2018-09-19T06:30:00.000Z"]
  };
  res.json(reportsData);
});

// Endpoint to get recent sales data
app.get('/api/recent-sales', (req, res) => {
  const recentSalesData = [
    { id: "#2457", customer: "Brandon Jacob", product: "At praesentium minu", price: 64, status: "Approved" },
    { id: "#2147", customer: "Bridie Kessler", product: "Blanditiis dolor omnis similique", price: 47, status: "Pending" },
    { id: "#2049", customer: "Ashleigh Langosh", product: "At recusandae consectetur", price: 147, status: "Approved" },
    { id: "#2644", customer: "Angus Grady", product: "Ut voluptatem id earum et", price: 67, status: "Rejected" },
    { id: "#2644", customer: "Raheem Lehner", product: "Sunt similique distinctio", price: 165, status: "Approved" }
  ];
  res.json(recentSalesData);
});

// Endpoint to get top selling products data
app.get('/api/top-selling', (req, res) => {
  const topSellingData = [
    { preview: "assets/img/product-1.jpg", product: "Ut inventore ipsa voluptas nulla", price: 64, sold: 124, revenue: 5828 },
    { preview: "assets/img/product-2.jpg", product: "Exercitationem similique doloremque", price: 46, sold: 98, revenue: 4508 },
    { preview: "assets/img/product-3.jpg", product: "Doloribus nisi exercitationem", price: 59, sold: 74, revenue: 4366 },
    { preview: "assets/img/product-4.jpg", product: "Officiis quaerat sint rerum error", price: 32, sold: 63, revenue: 2016 },
    { preview: "assets/img/product-5.jpg", product: "Sit unde debitis delectus repellendus", price: 79, sold: 41, revenue: 3239 }
  ];
  res.json(topSellingData);
});

// Endpoint to get recent activity data
app.get('/api/recent-activity', (req, res) => {
  const recentActivityData = [
    { label: "32 min", content: "Quia quae rerum explicabo officiis beatae", badge: "text-success" },
    { label: "56 min", content: "Voluptatem blanditiis blanditiis eveniet", badge: "text-danger" },
    { label: "2 hrs", content: "Voluptates corrupti molestias voluptatem", badge: "text-primary" },
    { label: "1 day", content: "Tempore autem saepe occaecati voluptatem tempore", badge: "text-info" },
    { label: "2 days", content: "Est sit eum reiciendis exercitationem", badge: "text-warning" },
    { label: "4 weeks", content: "Dicta dolorem harum nulla eius. Ut quidem quidem sit quas", badge: "text-muted" }
  ];
  res.json(recentActivityData);
});

// Start the server
app.listen(4000, () => {
  console.log('Server running on https://backend-osa.vercel.app');
});
