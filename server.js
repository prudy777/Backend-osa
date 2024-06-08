const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
require('dotenv').config();
const app = express();
app.use(cors({
  origin: 'https://frontend-osa.onrender.com', // Allow requests from your frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE','PATCH','HEAD'], // Specify allowed HTTP methods
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
    from:"+13613147013",
    to,
    body: message
  }).then(message => console.log('SMS message sent:', message.sid))
    .catch(error => console.error('Error sending SMS message:', error));
};

const makeCall = (to, url) => {
  client.calls.create({
    from: "+13613147013",
    to,
    url
  }).then(call => console.log('Call initiated:', call.sid))
    .catch(error => console.error('Error making call:', error));
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
    ageUnit TEXT,
    time TEXT,
    specimen TEXT,
    investigation TEXT,
    referredBy TEXT,
    date TEXT,
    FOREIGN KEY (patient_no) REFERENCES patients(patient_no),
    FOREIGN KEY (lab_no) REFERENCES lab_numbers(lab_no)
  )
`,);

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
  db.run(
    `CREATE TABLE IF NOT EXISTS serology (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    test TEXT,
    methodology TEXT,
    result TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients (id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS urinalysis (
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
  )`);
  db.run(`CREATE TABLE  IF NOT EXISTS biochemistry (
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
  )`);  
  
  // Create the Haematology table
  db.run(`
  CREATE TABLE IF NOT EXISTS Haematology (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    investigation TEXT NOT NULL,
    result TEXT NOT NULL,
    reference_range TEXT NOT NULL
  )
`);

 // Create the ParasitologyTests table
 db.run(`
   CREATE TABLE IF NOT EXISTS ParasitologyTests (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     test TEXT NOT NULL,
     methodology TEXT NOT NULL,
     result TEXT NOT NULL
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
        const emailMessage = `Dear Osamedic Diagnostics,\n\nThe registration for the Test Of ${first_name} ${last_name} has been received successfully.\nTest Type: ${test_type}\n\nThank you.`;
        sendEmail('Osamedicare@gmail.com', 'Test Registration Confirmation', emailMessage);

        const smsMessage = `Dear Osamedic Diagnostics,\n\nThe registration for the Test Of ${first_name} ${last_name} has been received successfully.\nTest Type: ${test_type}\n\nThank you`;
        sendSMS("+2348027894448", smsMessage);

        const callUrl = 'https://demo.twilio.com/welcome/voice/';
        makeCall("+2347016724313", callUrl);
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
  const { patient_no, lab_no, name, sex, age, ageUnit, time,specimen,investigation, referredBy, date, tests, serology, urinalysis, biochemistry, haematology, parasitology } = req.body;

  if (!patient_no || !lab_no || !name || !sex || !age || !ageUnit || !time || !specimen || !investigation || !referredBy || !date) {
    return res.status(400).send('Missing required fields');
  }
  const testBookingQuery = `
    INSERT INTO test_bookings (patient_no, lab_no, name, sex, age, ageUnit, time,specimen,investigation, referredBy, date )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(testBookingQuery, [patient_no, lab_no, name, sex, age, ageUnit, time,specimen,investigation, referredBy, date ], function (err) {
    if (err) {
      console.error('Error saving test booking:', err);
      return res.status(500).send('Failed to save test booking');
    }

    const bookingId = this.lastID;

    // Insert into test_details table
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
    stmt.finalize();

    // Insert into serology table
    const serologyQuery = `
      INSERT INTO serology (patient_id, test, methodology, result)
      VALUES (?, ?, ?, ?)
    `;
    const serologyStmt = db.prepare(serologyQuery);
    for (const test of serology) {
      serologyStmt.run([patient_no, test.test, test.methodology, test.result], function (err) {
        if (err) {
          console.error('Error saving serology details:', err);
          return res.status(500).send('Failed to save serology details');
        }
      });
    }
    serologyStmt.finalize();

    // Insert into urinalysis table
    const urinalysisQuery = `
      INSERT INTO urinalysis (patient_id, colour, appearance, pH, specific_gravity, urobilinogen, leukocyte, bilirubin, blood, nitrite, protein, glucose, ketones, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const urinalysisStmt = db.prepare(urinalysisQuery);
    urinalysisStmt.run([patient_no, urinalysis.colour, urinalysis.appearance, urinalysis.pH, urinalysis.specific_gravity, urinalysis.urobilinogen, urinalysis.leukocyte, urinalysis.bilirubin, urinalysis.blood, urinalysis.nitrite, urinalysis.protein, urinalysis.glucose, urinalysis.ketones, urinalysis.comment], function (err) {
      if (err) {
        console.error('Error saving urinalysis details:', err);
        return res.status(500).send('Failed to save urinalysis details');
      }
    });
    urinalysisStmt.finalize();

    // Insert into biochemistry table
    const biochemistryQuery = `
      INSERT INTO biochemistry (patient_id, bilirubin_total, bilirubin_direct, ast_sgot, alt_sgpt, alp, albumin, total_protein, urea, creatinine, sodium, potassium, chloride, bicarbonate, total_cholesterol, hdl, ldl, triglycerides, vldl, fasting_blood_sugar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const biochemistryStmt = db.prepare(biochemistryQuery);
    biochemistryStmt.run([patient_no, biochemistry.bilirubin_total, biochemistry.bilirubin_direct, biochemistry.ast_sgot, biochemistry.alt_sgpt, biochemistry.alp, biochemistry.albumin, biochemistry.total_protein, biochemistry.urea, biochemistry.creatinine, biochemistry.sodium, biochemistry.potassium, biochemistry.chloride, biochemistry.bicarbonate, biochemistry.total_cholesterol, biochemistry.hdl, biochemistry.ldl, biochemistry.triglycerides, biochemistry.vldl, biochemistry.fasting_blood_sugar], function (err) {
      if (err) {
        console.error('Error saving biochemistry details:', err);
        return res.status(500).send('Failed to save biochemistry details');
      }
    });
    biochemistryStmt.finalize();

    // Insert into haematology table
    const haematologyQuery = `
      INSERT INTO Haematology (investigation, result, reference_range)
      VALUES (?, ?, ?)
    `;
    const haematologyStmt = db.prepare(haematologyQuery);
    for (const test of haematology) {
      haematologyStmt.run([test.investigation, test.result, test.reference_range], function (err) {
        if (err) {
          console.error('Error saving haematology details:', err);
          return res.status(500).send('Failed to save haematology details');
        }
      });
    }
    haematologyStmt.finalize();

    // Insert into parasitology table
    const parasitologyQuery = `
      INSERT INTO ParasitologyTests (test, methodology, result)
      VALUES (?, ?, ?)
    `;
    const parasitologyStmt = db.prepare(parasitologyQuery);
    for (const test of parasitology) {
      parasitologyStmt.run([test.test, test.methodology, test.result], function (err) {
        if (err) {
          console.error('Error saving parasitology details:', err);
          return res.status(500).send('Failed to save parasitology details');
        }
      });
    }
    parasitologyStmt.finalize();

    res.status(201).send('Test booking saved successfully');
  });
});

// Endpoint to get all test bookings
app.get('/test-bookings', (req, res) => {
  const query = `
    SELECT tb.*, 
           td.test_name, td.rate, td.price_naira, td.reference_range, td.interpretation,
           s.test AS serology_test, s.methodology AS serology_methodology, s.result AS serology_result,
           u.colour, u.appearance, u.pH, u.specific_gravity, u.urobilinogen, u.leukocyte, u.bilirubin, u.blood, u.nitrite, u.protein, u.glucose, u.ketones, u.comment,
           b.bilirubin_total, b.bilirubin_direct, b.ast_sgot, b.alt_sgpt, b.alp, b.albumin, b.total_protein, b.urea, b.creatinine, b.sodium, b.potassium, b.chloride, b.bicarbonate, b.total_cholesterol, b.hdl, b.ldl, b.triglycerides, b.vldl, b.fasting_blood_sugar,
           h.investigation AS haematology_investigation, h.result AS haematology_result, h.reference_range AS haematology_reference_range,
           p.test AS parasitology_test, p.methodology AS parasitology_methodology, p.result AS parasitology_result
    FROM test_bookings tb
    LEFT JOIN test_details td ON tb.id = td.booking_id
    LEFT JOIN serology s ON tb.patient_no = s.patient_id
    LEFT JOIN urinalysis u ON tb.patient_no = u.patient_id
    LEFT JOIN biochemistry b ON tb.patient_no = b.patient_id
    LEFT JOIN haematology h ON tb.patient_no = h.patient_id
    LEFT JOIN parasitology p ON tb.patient_no = p.patient_id
  `;
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error retrieving test bookings:', err);
      return res.status(500).send('Failed to retrieve test bookings');
    }

    const bookings = rows.reduce((acc, row) => {
      const booking = acc.find(b => b.id === row.id);
      if (booking) {
        // Append test details
        if (row.test_name) {
          booking.tests.push({
            test_name: row.test_name,
            rate: row.rate,
            price_naira: row.price_naira,
            reference_range: row.reference_range,
            interpretation: row.interpretation
          });
        }

        // Append serology details
        if (row.serology_test) {
          booking.serology.push({
            test: row.serology_test,
            methodology: row.serology_methodology,
            result: row.serology_result
          });
        }

        // Append haematology details
        if (row.haematology_investigation) {
          booking.haematology.push({
            investigation: row.haematology_investigation,
            result: row.haematology_result,
            reference_range: row.haematology_reference_range
          });
        }

        // Append parasitology details
        if (row.parasitology_test) {
          booking.parasitology.push({
            test: row.parasitology_test,
            methodology: row.parasitology_methodology,
            result: row.parasitology_result
          });
        }
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
          tests: row.test_name ? [{
            test_name: row.test_name,
            rate: row.rate,
            price_naira: row.price_naira,
            reference_range: row.reference_range,
            interpretation: row.interpretation
          }] : [],
          serology: row.serology_test ? [{
            test: row.serology_test,
            methodology: row.serology_methodology,
            result: row.serology_result
          }] : [],
          urinalysis: {
            colour: row.colour,
            appearance: row.appearance,
            pH: row.pH,
            specific_gravity: row.specific_gravity,
            urobilinogen: row.urobilinogen,
            leukocyte: row.leukocyte,
            bilirubin: row.bilirubin,
            blood: row.blood,
            nitrite: row.nitrite,
            protein: row.protein,
            glucose: row.glucose,
            ketones: row.ketones,
            comment: row.comment
          },
          biochemistry: {
            bilirubin_total: row.bilirubin_total,
            bilirubin_direct: row.bilirubin_direct,
            ast_sgot: row.ast_sgot,
            alt_sgpt: row.alt_sgpt,
            alp: row.alp,
            albumin: row.albumin,
            total_protein: row.total_protein,
            urea: row.urea,
            creatinine: row.creatinine,
            sodium: row.sodium,
            potassium: row.potassium,
            chloride: row.chloride,
            bicarbonate: row.bicarbonate,
            total_cholesterol: row.total_cholesterol,
            hdl: row.hdl,
            ldl: row.ldl,
            triglycerides: row.triglycerides,
            vldl: row.vldl,
            fasting_blood_sugar: row.fasting_blood_sugar
          },
          haematology: row.haematology_investigation ? [{
            investigation: row.haematology_investigation,
            result: row.haematology_result,
            reference_range: row.haematology_reference_range
          }] : [],
          parasitology: row.parasitology_test ? [{
            test: row.parasitology_test,
            methodology: row.parasitology_methodology,
            result: row.parasitology_result
          }] : []
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
  const { patient_id, lab_no, name, sex, age, ageUnit, panel, referredBy, date, tests, serology, urinalysis, biochemistry, haematology, parasitology } = req.body;

  const printedTestQuery = `
    INSERT INTO printed_tests (patient_id, lab_no, name, sex, age, age_unit, panel, referred_by, date, test_name, rate, price_naira, reference_range, interpretation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const stmt = db.prepare(printedTestQuery);

  let hasError = false;

  tests.forEach(test => {
    stmt.run([
      patient_id, lab_no, name, sex, age, ageUnit, panel, referredBy, date,
      test.name, test.rate, test.rate, test.referenceRange, test.interpretation
    ], function (err) {
      if (err) {
        console.error('Error saving printed test:', err);
        hasError = true;
        return res.status(500).send('Failed to save printed test');
      }
    });
  });

  stmt.finalize(err => {
    if (err) {
      console.error('Error finalizing printed test statement:', err);
      return res.status(500).send('Failed to finalize printed test statement');
    }
    
    if (!hasError) {
      // Insert into serology table
      const serologyQuery = `
        INSERT INTO serology (patient_id, test, methodology, result)
        VALUES (?, ?, ?, ?)
      `;
      const serologyStmt = db.prepare(serologyQuery);
      for (const test of serology) {
        serologyStmt.run([patient_id, test.test, test.methodology, test.result], function (err) {
          if (err) {
            console.error('Error saving serology details:', err);
            return res.status(500).send('Failed to save serology details');
          }
        });
      }
      serologyStmt.finalize();

      // Insert into urinalysis table
      const urinalysisQuery = `
        INSERT INTO urinalysis (patient_id, colour, appearance, pH, specific_gravity, urobilinogen, leukocyte, bilirubin, blood, nitrite, protein, glucose, ketones, comment)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const urinalysisStmt = db.prepare(urinalysisQuery);
      urinalysisStmt.run([patient_id, urinalysis.colour, urinalysis.appearance, urinalysis.pH, urinalysis.specific_gravity, urinalysis.urobilinogen, urinalysis.leukocyte, urinalysis.bilirubin, urinalysis.blood, urinalysis.nitrite, urinalysis.protein, urinalysis.glucose, urinalysis.ketones, urinalysis.comment], function (err) {
        if (err) {
          console.error('Error saving urinalysis details:', err);
          return res.status(500).send('Failed to save urinalysis details');
        }
      });
      urinalysisStmt.finalize();

      // Insert into biochemistry table
      const biochemistryQuery = `
        INSERT INTO biochemistry (patient_id, bilirubin_total, bilirubin_direct, ast_sgot, alt_sgpt, alp, albumin, total_protein, urea, creatinine, sodium, potassium, chloride, bicarbonate, total_cholesterol, hdl, ldl, triglycerides, vldl, fasting_blood_sugar)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const biochemistryStmt = db.prepare(biochemistryQuery);
      biochemistryStmt.run([patient_id, biochemistry.bilirubin_total, biochemistry.bilirubin_direct, biochemistry.ast_sgot, biochemistry.alt_sgpt, biochemistry.alp, biochemistry.albumin, biochemistry.total_protein, biochemistry.urea, biochemistry.creatinine, biochemistry.sodium, biochemistry.potassium, biochemistry.chloride, biochemistry.bicarbonate, biochemistry.total_cholesterol, biochemistry.hdl, biochemistry.ldl, biochemistry.triglycerides, biochemistry.vldl, biochemistry.fasting_blood_sugar], function (err) {
        if (err) {
          console.error('Error saving biochemistry details:', err);
          return res.status(500).send('Failed to save biochemistry details');
        }
      });
      biochemistryStmt.finalize();

      // Insert into haematology table
      const haematologyQuery = `
        INSERT INTO haematology (patient_id, investigation, result, reference_range)
        VALUES (?, ?, ?, ?)
      `;
      const haematologyStmt = db.prepare(haematologyQuery);
      for (const test of haematology) {
        haematologyStmt.run([patient_id, test.investigation, test.result, test.reference_range], function (err) {
          if (err) {
            console.error('Error saving haematology details:', err);
            return res.status(500).send('Failed to save haematology details');
          }
        });
      }
      haematologyStmt.finalize();

      // Insert into parasitology table
      const parasitologyQuery = `
        INSERT INTO parasitology (patient_id, test, methodology, result)
        VALUES (?, ?, ?, ?)
      `;
      const parasitologyStmt = db.prepare(parasitologyQuery);
      for (const test of parasitology) {
        parasitologyStmt.run([patient_id, test.test, test.methodology, test.result], function (err) {
          if (err) {
            console.error('Error saving parasitology details:', err);
            return res.status(500).send('Failed to save parasitology details');
          }
        });
      }
      parasitologyStmt.finalize();

      res.status(201).send('Printed test and all related details saved successfully');
    }
  });
});

 // Save printed tests
app.post('/masters', (req, res) => {
  const { tests } = req.body;

  const masterInsertQuery = `
    INSERT INTO printed_tests (test_id, patient_id, lab_no, name, sex, age, age_unit, panel, referred_by, date, test_name, rate, price_naira, reference_range, interpretation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const stmt = db.prepare(masterInsertQuery);
  let hasError = false;

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
    ], function (err) {
      if (err) {
        console.error('Error saving printed tests:', err);
        hasError = true;
        return res.status(500).send('Failed to save printed tests');
      }
    });
  });

  stmt.finalize(err => {
    if (err) {
      console.error('Error finalizing printed tests statement:', err);
      return res.status(500).send('Failed to finalize printed tests statement');
    }
    if (!hasError) {
      const { serology, urinalysis, biochemistry, haematology, parasitology } = req.body;

      // Insert into serology table
      const serologyQuery = `
        INSERT INTO serology (patient_id, test, methodology, result)
        VALUES (?, ?, ?, ?)
      `;
      const serologyStmt = db.prepare(serologyQuery);
      for (const test of serology) {
        serologyStmt.run([test.patient_id, test.test, test.methodology, test.result], function (err) {
          if (err) {
            console.error('Error saving serology details:', err);
            return res.status(500).send('Failed to save serology details');
          }
        });
      }
      serologyStmt.finalize();

      // Insert into urinalysis table
      const urinalysisQuery = `
        INSERT INTO urinalysis (patient_id, colour, appearance, pH, specific_gravity, urobilinogen, leukocyte, bilirubin, blood, nitrite, protein, glucose, ketones, comment)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const urinalysisStmt = db.prepare(urinalysisQuery);
      urinalysisStmt.run([urinalysis.patient_id, urinalysis.colour, urinalysis.appearance, urinalysis.pH, urinalysis.specific_gravity, urinalysis.urobilinogen, urinalysis.leukocyte, urinalysis.bilirubin, urinalysis.blood, urinalysis.nitrite, urinalysis.protein, urinalysis.glucose, urinalysis.ketones, urinalysis.comment], function (err) {
        if (err) {
          console.error('Error saving urinalysis details:', err);
          return res.status(500).send('Failed to save urinalysis details');
        }
      });
      urinalysisStmt.finalize();

      // Insert into biochemistry table
      const biochemistryQuery = `
        INSERT INTO biochemistry (patient_id, bilirubin_total, bilirubin_direct, ast_sgot, alt_sgpt, alp, albumin, total_protein, urea, creatinine, sodium, potassium, chloride, bicarbonate, total_cholesterol, hdl, ldl, triglycerides, vldl, fasting_blood_sugar)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const biochemistryStmt = db.prepare(biochemistryQuery);
      biochemistryStmt.run([biochemistry.patient_id, biochemistry.bilirubin_total, biochemistry.bilirubin_direct, biochemistry.ast_sgot, biochemistry.alt_sgpt, biochemistry.alp, biochemistry.albumin, biochemistry.total_protein, biochemistry.urea, biochemistry.creatinine, biochemistry.sodium, biochemistry.potassium, biochemistry.chloride, biochemistry.bicarbonate, biochemistry.total_cholesterol, biochemistry.hdl, biochemistry.ldl, biochemistry.triglycerides, biochemistry.vldl, biochemistry.fasting_blood_sugar], function (err) {
        if (err) {
          console.error('Error saving biochemistry details:', err);
          return res.status(500).send('Failed to save biochemistry details');
        }
      });
      biochemistryStmt.finalize();

      // Insert into haematology table
      const haematologyQuery = `
        INSERT INTO haematology (patient_id, investigation, result, reference_range)
        VALUES (?, ?, ?, ?)
      `;
      const haematologyStmt = db.prepare(haematologyQuery);
      for (const test of haematology) {
        haematologyStmt.run([test.patient_id, test.investigation, test.result, test.reference_range], function (err) {
          if (err) {
            console.error('Error saving haematology details:', err);
            return res.status(500).send('Failed to save haematology details');
          }
        });
      }
      haematologyStmt.finalize();

      // Insert into parasitology table
      const parasitologyQuery = `
        INSERT INTO parasitology (patient_id, test, methodology, result)
        VALUES (?, ?, ?, ?)
      `;
      const parasitologyStmt = db.prepare(parasitologyQuery);
      for (const test of parasitology) {
        parasitologyStmt.run([test.patient_id, test.test, test.methodology, test.result], function (err) {
          if (err) {
            console.error('Error saving parasitology details:', err);
            return res.status(500).send('Failed to save parasitology details');
          }
        });
      }
      parasitologyStmt.finalize();

      res.status(201).send('Printed tests and all related details saved successfully');
    }
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