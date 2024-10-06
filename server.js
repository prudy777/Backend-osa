const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
require('dotenv').config();
const app = express();
// app.use(cors({
//   origin: 'https://frontend-osa.onrender.com', // Allow requests from your frontend URL
//   methods: ['GET', 'POST', 'PUT', 'DELETE','PATCH','HEAD'], // Specify allowed HTTP methods
//   credentials: true ,// If you need to send cookies or authentication headers
//   optionsSuccessStatus: 200 // Some legacy browsers choke on 204
// }));
 
app.use(cors({}))
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
  db.run(`DROP TABLE IF EXISTS users`);
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

  db.run(`CREATE TABLE IF NOT EXISTS contact_form (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    phone TEXT,
    message TEXT,
    consent INTEGER DEFAULT 0,
    submission_time DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

 
  db.run(`
    CREATE TABLE IF NOT EXISTS lab_numbers (
      lab_no INTEGER PRIMARY KEY AUTOINCREMENT
    )
  `);
 db.run(`DROP TABLE IF EXISTS  test_bookings`)

db.run(`CREATE TABLE IF NOT EXISTS test_bookings (
  test_id INTEGER PRIMARY KEY AUTOINCREMENT,
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
)`, 
)


db.run(`DROP TABLE IF EXISTS test_details`)
  db.run(`
    CREATE TABLE IF NOT EXISTS test_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER,
      test_id TEXT,
      test_name TEXT,
      rate REAL,
      reference_range TEXT,
      interpretation TEXT,
      price_naira REAL,
      remark TEXT,
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
        db.run(`DROP TABLE IF EXISTS printed_tests`)
        // Create the printed_tests table with the updated schema
        db.run(`
          CREATE TABLE IF NOT EXISTS printed_tests (
            test_id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER,
            lab_no INTEGER,
            name TEXT,
            sex TEXT,
            age TEXT,
            age_unit TEXT,
            time TEXT,
            specimen TEXT,
            referred_by TEXT,
            date TEXT,
            investigation TEXT,
            rate REAL,
            reference_range TEXT,
            interpretation TEXT,
            price_naira REAL,
            remark TEXT,
            FOREIGN KEY (patient_id) REFERENCES patients(patient_no),
            FOREIGN KEY (lab_no) REFERENCES lab_numbers(lab_no),
            FOREIGN KEY (referred_by) REFERENCES test_bookings(referredBy),
            FOREIGN KEY (time) REFERENCES test_bookings(time),
            FOREIGN KEY (specimen) REFERENCES test_bookings(specimen),
            FOREIGN KEY (investigation) REFERENCES test_bookings(investigation)
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
db.run(`ALTER TABLE patients ADD COLUMN home_service TEXT;
 TEXT`, (err) => {
  if (err) {
    if (err.message.includes("duplicate column name")) {
      console.log("Column 'home service' already exists.");
    } else {
      console.error("Error adding 'home service' column:", err);
    }
  } else {
    console.log("'home service' column added successfully.");
  }
});
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
app.post('/register', async (req, res) => {
  const {
    first_name,
    last_name,
    dob,
    email,
    phone,
    test_type,
    sex,
    home_service,
    visit_time,
    payment_mode,
    test_submission_time,
  } = req.body;

  try {
    // Insert patient data into the database
    db.run(
      'INSERT INTO patients (first_name, last_name, dob, email, phone, test_type, sex, home_service, visit_time, payment_mode, test_submission_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        first_name,
        last_name,
        dob,
        email,
        phone,
        test_type,
        sex,
        home_service,
        visit_time || null, // If home_service is "No", visit_time will be null
        payment_mode,
        test_submission_time,
      ],
      function (err) {
        if (err) {
          console.error('Error inserting patient data:', err);
          return res.status(500).send('Registration failed due to server error');
        }

        const patientId = this.lastID;

        // Update the patient_no with the same value as the id
        db.run('UPDATE patients SET patient_no = ? WHERE id = ?', [patientId, patientId], function (err) {
          if (err) {
            console.error('Error updating patient number:', err);
            return res.status(500).send('Failed to set patient number');
          }

          // Send email and WhatsApp notifications to Osamedic Diagnostics
          const emailMessage = `Dear Osamedic Diagnostics,\n\nThe registration for the Test Of ${first_name} ${last_name} has been received successfully.\nTest Type: ${test_type}\n\nThank you.`;
          sendEmail('ailemendaniel76@gmail.com', 'Test Registration Confirmation', emailMessage);

          const smsMessage = `Dear Osamedic Diagnostics,\n\nThe registration for the Test Of ${first_name} ${last_name} has been received successfully.\nTest Type: ${test_type}\n\nThank you`;
          sendSMS("+2348027894448", smsMessage);

          const callUrl = 'https://demo.twilio.com/welcome/voice/';
          makeCall("+2347016724313", callUrl);

          // Send email to the client confirming test registration
          const clientEmailMessage = `Dear ${first_name} ${last_name},\n\nYour registration for the ${test_type} test has been received successfully.\nOur team will process your test shortly.\n\nThank you for choosing Osamedic Diagnostics.`;
          sendEmail(email, 'Your Test Registration Confirmation', clientEmailMessage);

          res.status(201).send('Patient registered successfully');
        });
      }
    );
  } catch (err) {
    console.error('Unexpected error during registration:', err);
    res.status(500).send('An unexpected error occurred during registration');
  }
});


//Endpoint to get list of all patients
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
  db.get('SELECT id, first_name, last_name, dob, email, phone, test_type, status, sex, home_service FROM patients WHERE id = ?', [id], (err, row) => {
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

// Endpoint to update patient payment status
app.put('/patients/:id/payment-status', (req, res) => {
  const { id } = req.params;
  const { paymentStatus } = req.body;
  db.run('UPDATE patients SET payment_status = ? WHERE id = ?', [paymentStatus, id], function (err) {
    if (err) {
      console.error('Error updating payment status:', err);
      return res.status(500).send('Failed to update payment status');
    }
    res.status(200).send('Payment status updated successfully');
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
  console.log('Received request body:', req.body);
  const { patient_no, lab_no, name, sex, age, time, specimen, investigation, referredBy, date, tests, serology, urinalysis, biochemistry, haematology, parasitology } = req.body;

  // Define required fields
  const requiredFields = ['patient_no', 'lab_no', 'name', 'sex', 'age', 'time', 'specimen', 'investigation', 'referredBy', 'date'];
  
  // Check for missing required fields
  const missingFields = requiredFields.filter(field => !req.body[field]);
  if (missingFields.length > 0) {
    return res.status(400).send(`Missing required fields: ${missingFields.join(', ')}`);
  }

  const testBookingQuery = `
    INSERT INTO test_bookings (patient_no, lab_no, name, sex, age, time, specimen, investigation, referredBy, date)
     VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(testBookingQuery, [patient_no, lab_no, name, sex, age, time, specimen, investigation, referredBy, date], function (err) {
    if (err) {
      console.error('Error saving test booking:', err);
      return res.status(500).send('Failed to save test booking');
    }

    const bookingId = this.lastID;

    // Insert into test_details table
    const testDetailsQuery = `
      INSERT INTO test_details (booking_id, test_id, test_name, rate, reference_range, interpretation, price_naira, remark )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const stmt = db.prepare(testDetailsQuery);
    for (const test of tests) {
      stmt.run([bookingId, test.id, test.name, test.rate, test.referenceRange, test.interpretation, test.price_naira, test.remark], function (err) {
        if (err) {
          console.error('Error saving test details:', err);
          return res.status(500).send('Failed to save test details');
        }
      });
    }
    stmt.finalize();

    // Insert into serology table if data is provided
    if (Array.isArray(serology)) {
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
    }

    // Insert into urinalysis table if data is provided
    if (urinalysis) {
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
    }

    // Insert into biochemistry table if data is provided
    if (biochemistry) {
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
    }

    // Insert into haematology table if data is provided
    if (Array.isArray(haematology)) {
      const haematologyQuery = `
        INSERT INTO haematology (investigation, result, reference_range)
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
    }

    // Insert into parasitology table if data is provided
    if (Array.isArray(parasitology)) {
      const parasitologyQuery = `
        INSERT INTO parasitology (test, methodology, result)
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
    }

    res.status(201).send('Test booking saved successfully');
  });
});

// Endpoint to delete test booking by IDs
app.post('/test-booking/:id', async (req, res) => {
  const { id } = req.params;
  
  const runQuery = (query, params) => {
    return new Promise((resolve, reject) => {
      db.run(query, params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  };

  try {
    await runQuery('BEGIN TRANSACTION');
    
    await runQuery('DELETE FROM test_bookings WHERE test_id = ?', [id]);
    await runQuery('DELETE FROM test_details WHERE booking_id = ?', [id]);
    await runQuery('DELETE FROM serology WHERE id = ?', [id]);
    await runQuery('DELETE FROM urinalysis WHERE id = ?', [id]);
    await runQuery('DELETE FROM biochemistry WHERE id = ?', [id]);
    await runQuery('DELETE FROM Haematology WHERE id = ?', [id]);
    await runQuery('DELETE FROM ParasitologyTests WHERE id = ?', [id]);

    await runQuery('COMMIT');
    res.status(200).send('Test booking deleted successfully');
  } catch (err) {
    await runQuery('ROLLBACK');
    console.error('Error deleting test booking:', err);
    res.status(500).send('Failed to delete test booking');
  }
});


// Endpoint to get all test bookings
app.get('/test-bookings', (req, res) => {
  const query = `
  SELECT tb.*, 
         td.test_name, td.rate, td.reference_range, td.interpretation, td.price_naira, td.remark,
         s.test AS serology_test, s.methodology AS serology_methodology, s.result AS serology_result,
         u.colour, u.appearance, u.pH, u.specific_gravity, u.urobilinogen, u.leukocyte, u.bilirubin, u.blood, u.nitrite, u.protein, u.glucose, u.ketones, u.comment,
         b.bilirubin_total, b.bilirubin_direct, b.ast_sgot, b.alt_sgpt, b.alp, b.albumin, b.total_protein, b.urea, b.creatinine, b.sodium, b.potassium, b.chloride, b.bicarbonate, b.total_cholesterol, b.hdl, b.ldl, b.triglycerides, b.vldl, b.fasting_blood_sugar,
         h.investigation AS haematology_investigation, h.result AS haematology_result, h.reference_range AS haematology_reference_range,
         p.test AS parasitology_test, p.methodology AS parasitology_methodology, p.result AS parasitology_result
  FROM test_bookings tb
  LEFT JOIN test_details td ON tb.test_id = td.booking_id
  LEFT JOIN serology s ON tb.patient_no = s.patient_no
  LEFT JOIN urinalysis u ON tb.patient_no = u.patient_no
  LEFT JOIN biochemistry b ON tb.patient_no = b.patient_no
  LEFT JOIN Haematology h ON tb.patient_no = h.patient_no
  LEFT JOIN parasitologyTests p ON tb.patient_no = p.patient_no
`;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error retrieving test bookings:', err);
      return res.status(500).send('Failed to retrieve test bookings');
    }

    const bookings = rows.reduce((acc, row) => {
      let booking = acc.find(b => b.id === row.id);
      if (!booking) {
        booking = {
          id: row.id,
          patient_id: row.patient_id,
          lab_no: row.lab_no,
          name: row.name,
          sex: row.sex,
          age: row.age,
          investigation: row.investigation,
          referredBy: row.referredBy,
          specimen: row.specimen,
          date: row.date,
           tests: [], serology: [], urinalysis: row.colour ? { colour: row.colour, appearance: row.appearance,
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
          } : null,
          biochemistry: row.bilirubin_total ? {
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
          } : null,
          haematology: [],
          parasitology: []
        };
        acc.push(booking);
      }
      if (row) {
        booking.tests.push({
          name: row.test_name,
          rate: row.rate,
          reference_range: row.reference_range,
          interpretation: row.interpretation,
          price_naira: row.price_naira,
          remark: row.remark,
        });
      }
      console.log(booking.tests)
      if (row.serology_test) {
        booking.serology.push({
          test: row.serology_test,
          methodology: row.serology_methodology,
          result: row.serology_result
        });
      }

      if (row.haematology_investigation) {
        booking.haematology.push({
          investigation: row.haematology_investigation,
          result: row.haematology_result,
          reference_range: row.haematology_reference_range
        });
      }

      return acc;
    }, []);
    console.log(bookings)
    res.status(200).json(bookings);
  });
});



// Endpoint to delete a test booking
app.delete('/test-bookings/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM test_bookings WHERE test_id = ?', id, function (err) {
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

app.post('/printed-tests', async (req, res) => {
  console.log('Received request body:', req.body);
  const { tests } = req.body;
  
  // Check if tests is provided and is an array
  if (!tests || !Array.isArray(tests) || tests.length === 0) {
    return res.status(400).send('No tests provided');
  }

  const printedTestQuery = `
    INSERT INTO printed_tests (
      patient_id, lab_no, name, sex, age, age_unit, time, specimen, 
      referred_by, date, investigation, rate, price_naira, 
      reference_range, interpretation, remark
    ) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const checkTestDetailsQuery = `
    SELECT test_id FROM test_details 
    WHERE test_name = ? AND rate = ? AND reference_range = ? AND interpretation = ? 
    AND price_naira = ? AND remark = ?
  `;

  const insertTestDetailsQuery = `
    INSERT INTO test_details (test_name, rate, reference_range, interpretation, price_naira, remark) 
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  try {
    for (const test of tests) {
      // Check if 'test.tests' exists and is an array
      if (!Array.isArray(test.tests)) {
        return res.status(400).send(`Invalid tests array for patient ${test.name}`);
      }

      const { lab_no, name, sex, age, investigation, specimen, date, patient_id, age_unit, time, referredBy } = test;

      for (const innerTest of test.tests) {
        const { test_name, rate, reference_range, interpretation, price_naira, remark } = innerTest;

        // Check if the test details already exist
        const testDetail = await getTestDetail(test_name, rate, reference_range, interpretation, price_naira, remark);

        let test_id;
        if (testDetail) {
          test_id = testDetail.test_id;
        } else {
          // Insert the test details if they don't exist
          test_id = await insertTestDetail(test_name, rate, reference_range, interpretation, price_naira, remark);
        }

        // Insert the printed test
        const values = [
          patient_id, lab_no, name, sex, age, age_unit, time, specimen, referredBy, date,
          investigation, rate, price_naira, reference_range, interpretation, remark
        ].map(value => (value === undefined ? null : value));

        await insertPrintedTest(values);
      }
    }

    res.status(201).send('Printed tests saved successfully');
  } catch (error) {
    console.error('Error saving printed test:', error);
    res.status(500).send('Failed to save printed test');
  }

  // Helper functions for async/await pattern

  async function getTestDetail(test_name, rate, reference_range, interpretation, price_naira, remark) {
    return new Promise((resolve, reject) => {
      db.get(checkTestDetailsQuery, [test_name, rate, reference_range, interpretation, price_naira, remark], (err, row) => {
        if (err) {
          console.error('Error checking test details:', err);
          return reject(err);
        }
        resolve(row);
      });
    });
  }

  async function insertTestDetail(test_name, rate, reference_range, interpretation, price_naira, remark) {
    return new Promise((resolve, reject) => {
      db.run(insertTestDetailsQuery, [test_name, rate, reference_range, interpretation, price_naira, remark], function (err) {
        if (err) {
          console.error('Error saving test details:', err);
          return reject(err);
        }
        resolve(this.lastID); // Return the inserted test detail's ID
      });
    });
  }

  async function insertPrintedTest(values) {
    return new Promise((resolve, reject) => {
      db.run(printedTestQuery, values, (err) => {
        if (err) {
          console.error('Error saving printed test:', err);
          return reject(err);
        }
        resolve();
      });
    });
  }
});


// Retrieve all printed tests
app.get('/masters', (req, res) => {
  db.all('SELECT * FROM printed_tests', [], (err, rows) => {
    if (err) {
      console.error('Error retrieving printed tests:', err);
      res.status(500).send('Error retrieving printed tests');
      return;
    }
    console.log("Retrieved data:", rows); // Log retrieved data
    res.status(200).json(rows);
  });
});



// // Retrieve printed tests with patient information
// app.get('/printed-tests', (req, res) => {
//   const query = `
//     SELECT pt.*, p.first_name, p.last_name, p.dob, p.email, p.phone
//     FROM printed_tests pt
//     LEFT JOIN patients p ON pt.patient_id = p.patient_no
//   `;
//   db.all(query, [], (err, rows) => {
//     if (err) {
//       console.error('Error retrieving printed tests:', err);
//       return res.status(500).send('Failed to retrieve printed tests');
//     }
//     const printedTests = rows.reduce((acc, row) => {
//       const test = {
//         test_id: row.test_id,
//         name: row.name,
//         sex: row.sex,
//         age: row.age,
//          specimen: row.specimen,
//         investigation: row.investigation,
//         referred_by: row.referred_by,
//         date: row.date,
//         test_name: row.test_name,
//         rate: row.rate,
//         price_naira: row.price_naira,
//         reference_range: row.reference_range,
//         interpretation: row.interpretation,
//         remark : row.remark
//       };
//       const patient = acc.find(p => p.patient_no === row.patient_id);
//       if (patient) {
//         patient.tests.push(test);
//       } else {
//         acc.push({
//           patient_no: row.patient_id,
//           first_name: row.first_name,
//           last_name: row.last_name,
//           dob: row.dob,
//           email: row.email,
//           phone: row.phone,
//           tests: [test]
//         });
//       }
//       return acc;
//     }, []);
//     res.status(200).json(printedTests);
//   });
// });

// // Retrieve all printed tests
// app.get('/masters', (req, res) => {
//   db.all('SELECT * FROM printed_tests', [], (err, rows) => {
//     if (err) {
//       console.error('Error retrieving printed tests:', err);
//       res.status(500).send('Error retrieving printed tests');
//       return;
//     }
//     console.log("Retrieved data:", JSON.stringify(rows, null, 2)); // Log retrieved data
//     res.status(200).json(rows);
//   });
// });
// Endpoint to get total prices of printed tests grouped by month, week, and gender
app.get('/printed-tests-summary', (req, res) => {
  const queryMonthly = `
    SELECT 
      strftime('%Y-%m', date) as month, 
      SUM(price_naira) as total_price
    FROM 
      printed_tests
    GROUP BY 
      strftime('%Y-%m', date)
  `;

  const queryWeekly = `
    SELECT 
      strftime('%Y-%W', date) as week, 
      SUM(price_naira) as total_price
    FROM 
      printed_tests
    GROUP BY 
      strftime('%Y-%W', date)
  `;

  const queryGender = `
    SELECT 
      sex, 
      SUM(price_naira) as total_price
    FROM 
      printed_tests
    GROUP BY 
      sex
  `;

  db.serialize(() => {
    db.all(queryMonthly, [], (err, monthlyResults) => {
      if (err) {
        console.error('Error retrieving monthly summary:', err);
        return res.status(500).send('Failed to retrieve monthly summary');
      }

      db.all(queryWeekly, [], (err, weeklyResults) => {
        if (err) {
          console.error('Error retrieving weekly summary:', err);
          return res.status(500).send('Failed to retrieve weekly summary');
        }

        db.all(queryGender, [], (err, genderResults) => {
          if (err) {
            console.error('Error retrieving gender summary:', err);
            return res.status(500).send('Failed to retrieve gender summary');
          }

          res.status(200).json({
            monthly: monthlyResults,
            weekly: weeklyResults,
            gender: genderResults
          });
        });
      });
    });
  });
});

// API to handle form submission
app.post('/submit-contact-form', (req, res) => {
  const { name, email, phone, message, consent } = req.body;

  // Insert data into the database
  const query = `INSERT INTO contact_form (name, email, phone, message, consent) VALUES (?, ?, ?, ?, ?)`;
  db.run(query, [name, email, phone, message, consent ? 1 : 0], function (err) {
    if (err) {
      console.error('Error saving form submission:', err);
      return res.status(500).send('Failed to submit form');
    }

    // Send confirmation email
    const confirmationMessage = `Dear ${name},\n\nThank you for reaching out to us. We have received your message and will get back to you shortly.\n\nBest Regards,\nOsamedic Diagnostics`;
    sendEmail(email, 'Contact Form Submission Confirmation', confirmationMessage);

    // Send notification email to admin
    const adminMessage = `New contact form submission from ${name} (${email}, ${phone}):\n\nMessage:\n${message}`;
    sendEmail(process.env.ADMIN_EMAIL, 'New Contact Form Submission', adminMessage);

    res.status(201).send('Form submitted successfully');
  });
});

// API to retrieve contact information
app.get('/contact-info', (req, res) => {
  const contactInfo = {
    email: 'ailemendaniel76@gmail.com',
    location: 'Lagos, LA NG',
    hours: [
      { day: 'Monday', open: '9:00am', close: '10:00pm' },
      { day: 'Tuesday', open: '9:00am', close: '10:00pm' },
      { day: 'Wednesday', open: '9:00am', close: '10:00pm' },
      { day: 'Thursday', open: '9:00am', close: '10:00pm' },
      { day: 'Friday', open: '9:00am', close: '10:00pm' },
      { day: 'Saturday', open: '9:00am', close: '6:00pm' },
      { day: 'Sunday', open: '9:00am', close: '12:00pm' },
    ],
  };
  res.status(200).json(contactInfo);
});

// Starting the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
