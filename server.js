const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
require('dotenv').config();
const app = express();
app.use(cors({
  origin: 'https://frontend-osa.onrender.com', // Allow requests from your frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Specify allowed HTTP methods
  credentials: true // If you need to send cookies or authentication headers
}));

const db = new sqlite3.Database('./database.db');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Twilio configuration
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Function to send email
const sendEmail = (to, subject, text) => {
  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    text
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
    } else {
      console.log('Email sent:', info.response);
    }
  });
};
// Function to send SMS message
const sendSMS = (to, message) => {
  client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to,
    body: message
  }).then(message => console.log('SMS message sent:', message.sid))
    .catch(error => console.error('Error sending SMS message:', error));
};

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

  db.run(`
    CREATE TABLE IF NOT EXISTS printed_tests (
      test_id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      interpretation TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients(patient_no),
      FOREIGN KEY (lab_no) REFERENCES lab_numbers(lab_no)
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
app.post('/register',async (req, res) => {
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


        // Send email and WhatsApp notifications
        const emailMessage = `Dear ${first_name} ${last_name},\n\nYour registration for the test has been received successfully.\nTest Type: ${test_type}\n\nThank you.`;
        sendEmail('ailemendaniel76@gmail.com', 'Test Registration Confirmation', emailMessage);

        const smsMessage = `Dear ${first_name}, your registration for the test (${test_type}) has been received successfully. Thank you.`;
        sendSMS('+234 701 672 4313', smsMessage);

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
  db.run('UPDATE patients SET status = ? WHERE id = ?', [status, id], function (err) {
    if (err) {
      console.error('Error updating patient status:', err);
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
  const { patient_no, lab_no, name, sex, age, ageUnit, panel, referredBy, date, tests } = req.body;
  const testBookingQuery = `
    INSERT INTO test_bookings (patient_no, lab_no, name, sex, age, age_unit, panel, referred_by, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  db.run(testBookingQuery, [patient_no, lab_no, name, sex, age, ageUnit, panel, referredBy, date], function (err) {
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
        console.error('Error finalizing test details statement:', err);
        return res.status(500).send('Failed to finalize test details statement');
      }
      res.status(201).send('Test booking saved successfully');
    });
  });
});

// Endpoint to get all test bookings
app.get('/test-bookings', (req, res) => {
  const query = `
    SELECT tb.*, td.test_name, td.rate, td.price_naira, td.reference_range, td.interpretation
    FROM test_bookings tb
    LEFT JOIN test_details td ON tb.id = td.booking_id
  `;
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error retrieving test bookings:', err);
      return res.status(500).send('Failed to retrieve test bookings');
    }
    const bookings = rows.reduce((acc, row) => {
      const booking = acc.find(b => b.id === row.id);
      if (booking) {
        booking.tests.push({
          test_name: row.test_name,
          rate: row.rate,
          price_naira: row.price_naira,
          reference_range: row.reference_range,
          interpretation: row.interpretation
        });
      } else {
        acc.push({
          id: row.id,
          patient_no: row.patient_no,
          lab_no: row.lab_no,
          name: row.name,
          sex: row.sex,
          age: row.age,
          age_unit: row.age_unit,
          panel: row.panel,
          referred_by: row.referred_by,
          date: row.date,
          tests: [{
            test_name: row.test_name,
            rate: row.rate,
            price_naira: row.price_naira,
            reference_range: row.reference_range,
            interpretation: row.interpretation
          }]
        });
      }
      return acc;
    }, []);
    res.status(200).json(bookings);
  });
});

// Endpoint to delete a test booking
app.delete('/test-bookings/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM test_bookings WHERE id = ?', id, function (err) {
    if (err) {
      console.error('Error deleting test booking:', err);
      return res.status(500).send('Failed to delete test booking');
    }
    db.run('DELETE FROM test_details WHERE booking_id = ?', id, function (err) {
      if (err) {
        console.error('Error deleting test details:', err);
        return res.status(500).send('Failed to delete test details');
      }
      res.status(200).send('Test booking deleted successfully');
    });
  });
});

// Endpoint to save printed test
app.post('/printed-tests', (req, res) => {
  const { patient_id, lab_no, name, sex, age, ageUnit, panel, referredBy, date, tests } = req.body;
  const printedTestQuery = `
    INSERT INTO printed_tests (patient_id, lab_no, name, sex, age, age_unit, panel, referred_by, date, test_name, rate, price_naira, reference_range, interpretation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const stmt = db.prepare(printedTestQuery);
  for (const test of tests) {
    stmt.run([patient_id, lab_no, name, sex, age, ageUnit, panel, referredBy, date, test.name, test.rate, test.rate, test.referenceRange, test.interpretation], function (err) {
      if (err) {
        console.error('Error saving printed test:', err);
        return res.status(500).send('Failed to save printed test');
      }
    });
  }
  stmt.finalize((err) => {
    if (err) {
      console.error('Error finalizing printed test statement:', err);
      return res.status(500).send('Failed to finalize printed test statement');
    }
    res.status(201).send('Printed test saved successfully');
  });
});

// Endpoint to get all printed tests
app.get('/printed-tests', (req, res) => {
  const query = `
    SELECT pt.*, p.first_name, p.last_name, p.dob, p.email, p.phone
    FROM printed_tests pt
    LEFT JOIN patients p ON pt.patient_id = p.patient_no
  `;
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error retrieving printed tests:', err);
      return res.status(500).send('Failed to retrieve printed tests');
    }
    const printedTests = rows.reduce((acc, row) => {
      const test = {
        test_id: row.test_id,
        name: row.name,
        sex: row.sex,
        age: row.age,
        age_unit: row.age_unit,
        panel: row.panel,
        referred_by: row.referred_by,
        date: row.date,
        test_name: row.test_name,
        rate: row.rate,
        price_naira: row.price_naira,
        reference_range: row.reference_range,
        interpretation: row.interpretation
      };
      const patient = acc.find(p => p.patient_no === row.patient_id);
      if (patient) {
        patient.tests.push(test);
      } else {
        acc.push({
          patient_no: row.patient_id,
          first_name: row.first_name,
          last_name: row.last_name,
          dob: row.dob,
          email: row.email,
          phone: row.phone,
          tests: [test]
        });
      }
      return acc;
    }, []);
    res.status(200).json(printedTests);
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

// Starting the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});